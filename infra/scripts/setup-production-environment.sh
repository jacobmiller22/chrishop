#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# ChrisShop Monorepo - GitHub Actions Production Environment Setup
# ==============================================================================
# Configures the 'production' environment in GitHub Actions with:
#   - Required human approval gate (reviewer: jacobmiller22)
#   - Deployment branch policy restricted to protected branches (production)
#   - Automated query and verification of applied environment settings
# ==============================================================================

REPO=""
REVIEWER_LOGIN="jacobmiller22"

print_usage() {
  cat <<HELP_EOF
Usage: $(basename "$0") [options]

Options:
  --repo <owner/repo>         GitHub repository name (default: auto-detected)
  --reviewer <username>       GitHub username of required reviewer (default: jacobmiller22)
  -h, --help                  Display this help message
HELP_EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --reviewer)
      REVIEWER_LOGIN="$2"
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

echo "🛡️ ChrisShop Production Environment Setup"
echo "=========================================="

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

# Step 3: Resolve Reviewer User ID
echo "Resolving User ID for reviewer '${REVIEWER_LOGIN}'..."
REVIEWER_ID=$(gh api "users/${REVIEWER_LOGIN}" --jq '.id' 2>/dev/null || true)

if [[ -z "$REVIEWER_ID" ]]; then
  echo "❌ Error: Could not resolve GitHub User ID for '${REVIEWER_LOGIN}'." >&2
  exit 1
fi

echo "Repository: $REPO"
echo "Target Environment: production"
echo "Reviewer: ${REVIEWER_LOGIN} (ID: ${REVIEWER_ID})"
echo ""

# Step 4: Construct Environment Configuration Payload
PAYLOAD_FILE=$(mktemp)
trap 'rm -f "$PAYLOAD_FILE"' EXIT

cat > "$PAYLOAD_FILE" <<JSON_EOF
{
  "prevent_self_review": false,
  "reviewers": [
    {
      "type": "User",
      "id": ${REVIEWER_ID}
    }
  ],
  "deployment_branch_policy": {
    "protected_branches": true,
    "custom_branch_policies": false
  }
}
JSON_EOF

echo "Configuring GitHub Actions environment 'production' on '$REPO'..."

gh api --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "repos/${REPO}/environments/production" \
  --input "$PAYLOAD_FILE" >/dev/null

echo "✅ Environment 'production' successfully configured!"

echo ""
echo "Current Environment Configuration Summary:"
gh api "repos/${REPO}/environments/production" --jq '{
  name: .name,
  html_url: .html_url,
  created_at: .created_at,
  can_admins_bypass: .can_admins_bypass,
  reviewers: [.protection_rules[]? | select(.type=="required_reviewers") | .reviewers[].reviewer.login],
  deployment_branch_policy: .deployment_branch_policy
}'
