#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# ChrisShop Monorepo - Programmatic Branch Protection Setup
# ==============================================================================
# Configures GitHub branch protection rules using the GitHub CLI (gh api).
#
# Default Guardrails:
#   - Required status check: "Lint, Typecheck, Test & Build"
#   - Strict status checks: Up-to-date branch required before merging
#   - Linear history: Merge commits blocked (squash or rebase required)
#   - Enforce on administrators: True
#   - Force pushes: Disabled
#   - Deletions: Disabled
#   - Conversation resolution: Required
#   - PR Review approval requirement: Optional (default: false for solo workflows)
# ==============================================================================

BRANCH="main"
REPO=""
ENFORCE_ADMINS="true"
REQUIRE_REVIEWS="false"
MIN_APPROVALS="1"
STATUS_CHECK="Lint, Typecheck, Test & Build"

print_usage() {
  cat <<HELP_EOF
Usage: $(basename "$0") [options]

Options:
  --branch <name>             Target branch to protect (default: main)
  --repo <owner/repo>         GitHub repository name (default: auto-detected)
  --enforce-admins <bool>     Enforce rules on repository administrators (default: true)
  --require-reviews <bool>    Require pull request review approvals (default: false)
  --min-approvals <num>       Number of required approving reviews if enabled (default: 1)
  --status-check <name>       Required status check context (default: "Lint, Typecheck, Test & Build")
  -h, --help                  Display this help message
HELP_EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
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
      STATUS_CHECK="$2"
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

echo "Repository: $REPO"
echo "Target Branch: $BRANCH"
echo "Enforce Admins: $ENFORCE_ADMINS"
echo "Require Reviews: $REQUIRE_REVIEWS"
echo "Required Check: $STATUS_CHECK"
echo ""

# Step 3: Construct branch protection JSON payload
PAYLOAD_FILE=$(mktemp)
trap 'rm -f "$PAYLOAD_FILE"' EXIT

if [[ "$REQUIRE_REVIEWS" == "true" ]]; then
  REVIEWS_PAYLOAD=$(cat <<JSON_EOF
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": ${MIN_APPROVALS}
  },
JSON_EOF
)
else
  REVIEWS_PAYLOAD=$(cat <<JSON_EOF
  "required_pull_request_reviews": null,
JSON_EOF
)
fi

cat > "$PAYLOAD_FILE" <<JSON_EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "${STATUS_CHECK}"
    ]
  },
  "enforce_admins": ${ENFORCE_ADMINS},
${REVIEWS_PAYLOAD}
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON_EOF

echo "Applying protection rules to '$BRANCH' on '$REPO'..."

# Step 4: Apply branch protection via GitHub API
HTTP_RESPONSE=$(gh api --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "repos/${REPO}/branches/${BRANCH}/protection" \
  --input "$PAYLOAD_FILE" 2>&1)

echo "✅ Branch protection successfully applied to '${BRANCH}'!"

# Step 5: Query and display applied protection summary
echo ""
echo "Current Branch Protection Summary:"
gh api "repos/${REPO}/branches/${BRANCH}/protection" --jq '{
  url: .url,
  required_status_checks: .required_status_checks.contexts,
  strict_checks: .required_status_checks.strict,
  enforce_admins: .enforce_admins.enabled,
  required_linear_history: .required_linear_history.enabled,
  allow_force_pushes: .allow_force_pushes.enabled,
  allow_deletions: .allow_deletions.enabled,
  required_reviews: (if .required_pull_request_reviews then .required_pull_request_reviews.required_approving_review_count else "disabled" end)
}'
