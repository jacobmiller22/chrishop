#!/usr/bin/env bash
set -euo pipefail

BRANCH_NAME="${1:-}"

if [ -z "$BRANCH_NAME" ]; then
  echo "❌ Error: Branch name is required."
  echo "Usage: pnpm run branch <branch-name>"
  echo "Example: pnpm run branch feature/story-1-24-my-feature"
  exit 1
fi

echo "🔄 Fetching latest origin/staging..."
git fetch origin staging

if command -v wt >/dev/null 2>&1; then
  echo "🚀 Provisioning worktree via worktrunk (wt) based on origin/staging..."
  wt switch --create "$BRANCH_NAME" --base origin/staging
else
  echo "🌿 Creating local git branch based on origin/staging..."
  git checkout -b "$BRANCH_NAME" origin/staging
fi

echo "✅ Branch '$BRANCH_NAME' successfully initialized from origin/staging."
