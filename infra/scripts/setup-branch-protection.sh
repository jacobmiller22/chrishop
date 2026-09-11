#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# ChrisShop Monorepo - Programmatic Branch Protection Setup
# ==============================================================================
# Configures GitHub branch protection rules using the GitHub CLI (gh api).
#
# Supported Branch Profiles:
#   - production: Strict status checks, 1 required review approval, linear history,
#                 enforce admins, no force pushes, no deletions.
#   - staging:    Strict status checks, linear history, enforce admins, no force
#                 pushes, no deletions.
#   - main:       Strict status checks, linear history, enforce admins, no force
#                 pushes, no deletions.
#   - all:        Applies protection sequentially to staging, production, and main.
# ==============================================================================

TIER=""
BRANCH="main"
REPO=""
ENFORCE_ADMINS="true"
REQUIRE_REVIEWS=""
MIN_APPROVALS="1"
STATUS_CHECKS=()

print_usage() {
  cat <<HELP_EOF
Usage: $(basename "$0") [options]

Options:
  --tier <name>               Target tier preset: all | production | staging | main
  --branch <name>             Explicit target branch to protect (default: main)
  --repo <owner/repo>         GitHub repository name (default: auto-detected)
  --enforce-admins <bool>     Enforce rules on repository administrators (default: true)
  --require-reviews <bool>    Require pull request review approvals (default: based on tier)
  --min-approvals <num>       Number of required approving reviews if enabled (default: 1)
  --status-check <name>       Required status check context (can be specified multiple times)
  -h, --help                  Display this help message
HELP_EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tier)
      TIER="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --repo)
      REPO="$2"
      shift 2
      ;;
    --enforce-admins)
      ENFORCE_ADMINS="$2"
      shift 2
      ;;
    --require-reviews)
      REQUIRE_REVIEWS="$2"
      shift 2
      ;;
    --min-approvals)
      MIN_APPROVALS="$2"
      shift 2
      ;;
    --status-check)
      STATUS_CHECKS+=("$2")
      shift 2
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Error: Unknown argument '$1'" >&2
      print_usage >&2
      exit 1
      ;;
  esac
done

echo "🔒 ChrisShop Branch Protection Setup"
echo "====================================="

# Step 1: Verify GitHub CLI prerequisites
if ! command -v gh &>/dev/null; then
  echo "❌ Error: GitHub CLI ('gh') is not installed or not in PATH." >&2
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "❌ Error: GitHub CLI is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

# Step 2: Auto-detect repository if not provided
if [[ -z "$REPO" ]]; then
  if git rev-parse --is-inside-work-tree &>/dev/null; then
    REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
    if [[ -z "$REPO" ]]; then
      REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
      if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then
        REPO="${BASH_REMATCH[1]}"
      fi
    fi
  fi
fi

if [[ -z "$REPO" ]]; then
  REPO="jacobmiller22/chrishop"
fi

protect_branch() {
  local target_branch="$1"
  local req_reviews="$2"
  local min_appr="$3"
  shift 3
  local checks=("$@")

  echo "--------------------------------------------------"
  echo "Applying protection to branch: '$target_branch'"
  echo "Repository: $REPO"
  echo "Require Reviews: $req_reviews (Approvals: $min_appr)"
  echo "Enforce Admins: $ENFORCE_ADMINS"
  echo "Required Checks: ${checks[*]}"
  echo "--------------------------------------------------"

  # Construct JSON checks array
  local checks_json="["
  for i in "${!checks[@]}"; do
    checks_json+="\"${checks[$i]}\""
    if [[ $i -lt $((${#checks[@]} - 1)) ]]; then
      checks_json+=", "
    fi
  done
  checks_json+="]"

  local payload_file
  payload_file=$(mktemp)

  if [[ "$req_reviews" == "true" ]]; then
    cat > "$payload_file" <<JSON_EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ${checks_json}
  },
  "enforce_admins": ${ENFORCE_ADMINS},
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": ${min_appr}
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON_EOF
  else
    cat > "$payload_file" <<JSON_EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ${checks_json}
  },
  "enforce_admins": ${ENFORCE_ADMINS},
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON_EOF
  fi

  gh api --method PUT \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "repos/${REPO}/branches/${target_branch}/protection" \
    --input "$payload_file" >/dev/null

  rm -f "$payload_file"
  echo "✅ Protection applied to '${target_branch}'."
}

# Determine default checks if none provided
if [[ ${#STATUS_CHECKS[@]} -eq 0 ]]; then
  STATUS_CHECKS=("Lint, Typecheck, Test & Build" "Enforce Staged Promotion Rules")
fi

if [[ "$TIER" == "all" ]]; then
  protect_branch "staging" "${REQUIRE_REVIEWS:-false}" "$MIN_APPROVALS" "${STATUS_CHECKS[@]}"
  protect_branch "production" "${REQUIRE_REVIEWS:-true}" "$MIN_APPROVALS" "${STATUS_CHECKS[@]}"
  protect_branch "main" "${REQUIRE_REVIEWS:-false}" "$MIN_APPROVALS" "${STATUS_CHECKS[@]}"
elif [[ "$TIER" == "production" ]]; then
  protect_branch "production" "${REQUIRE_REVIEWS:-true}" "$MIN_APPROVALS" "${STATUS_CHECKS[@]}"
elif [[ "$TIER" == "staging" ]]; then
  protect_branch "staging" "${REQUIRE_REVIEWS:-false}" "$MIN_APPROVALS" "${STATUS_CHECKS[@]}"
elif [[ "$TIER" == "main" ]]; then
  protect_branch "main" "${REQUIRE_REVIEWS:-false}" "$MIN_APPROVALS" "${STATUS_CHECKS[@]}"
else
  # Default to single branch execution
  reviews_flag="${REQUIRE_REVIEWS:-false}"
  if [[ "$BRANCH" == "production" && -z "$REQUIRE_REVIEWS" ]]; then
    reviews_flag="true"
  fi
  protect_branch "$BRANCH" "$reviews_flag" "$MIN_APPROVALS" "${STATUS_CHECKS[@]}"
fi

echo ""
echo "Current Branch Protection Summary across Key Branches:"
for b in staging production main; do
  echo "==> Branch: $b"
  gh api "repos/${REPO}/branches/${b}/protection" --jq '{
    branch: "'"$b"'",
    required_status_checks: .required_status_checks.contexts,
    strict_checks: .required_status_checks.strict,
    enforce_admins: .enforce_admins.enabled,
    required_linear_history: .required_linear_history.enabled,
    allow_force_pushes: .allow_force_pushes.enabled,
    allow_deletions: .allow_deletions.enabled,
    required_reviews: (if .required_pull_request_reviews then .required_pull_request_reviews.required_approving_review_count else "disabled" end)
  }' 2>/dev/null || echo "Branch '$b' protection not set."
done
