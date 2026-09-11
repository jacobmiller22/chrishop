#!/usr/bin/env bash
# ==============================================================================
# ChrisShop Local Scheduled Backlog Grooming & Refinement Runner
# Invoked by macOS launchd (com.chrishop.backlog-refinement) or manual CLI.
# ==============================================================================
set -euo pipefail

# 1. Determine Repository Root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

# 2. Configure Execution Environment & Paths
export PATH="${HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.config/nvm/versions/node/$(ls ${HOME}/.config/nvm/versions/node 2>/dev/null | tail -n 1)/bin:${PATH:-}"

LOG_DIR="${HOME}/.chrishop/logs"
mkdir -p "${LOG_DIR}"

TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"
LOG_FILE="${LOG_DIR}/refinement-$(date +%Y%m%d_%H%M%S).log"
LATEST_LOG="${LOG_DIR}/refinement-latest.log"
REPORT_FILE="${LOG_DIR}/refinement-report-$(date +%Y%m%d_%H%M%S).md"
LATEST_REPORT="${LOG_DIR}/refinement-report-latest.md"

# Load local refinement environment if present (e.g. ANTHROPIC_API_KEY or GEMINI_API_KEY)
if [[ -f "${HOME}/.chrishop/refinement.env" ]]; then
  # shellcheck disable=SC1090
  source "${HOME}/.chrishop/refinement.env"
elif [[ -f "${REPO_ROOT}/.env" ]]; then
  # Fallback to repo .env
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
  set +a
fi

REFINEMENT_MODEL="${REFINEMENT_MODEL:-claude-3-opus-20240229}"

echo "================================================================================"
echo "🚀 ChrisShop Backlog Refinement Runner"
echo "🕒 Timestamp: ${TIMESTAMP}"
echo "📁 Monorepo:  ${REPO_ROOT}"
echo "🤖 Model:     ${REFINEMENT_MODEL}"
echo "================================================================================"

# 3. Verify Prerequisites
if ! command -v gh >/dev/null 2>&1; then
  echo "❌ Error: GitHub CLI ('gh') is not installed or not in PATH."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "⚠️ Warning: GitHub CLI is not authenticated. Run 'gh auth login'."
fi

# 4. Monorepo Health Check
echo "🔍 Running Monorepo Health Check (pnpm run check)..."
if command -v pnpm >/dev/null 2>&1; then
  if pnpm run check >/dev/null 2>&1; then
    echo "✅ Typecheck & Linting passed."
  else
    echo "⚠️ Warning: 'pnpm run check' reported errors. Review in local dev."
  fi
else
  echo "ℹ️ Note: pnpm not found in PATH; skipping automated typecheck."
fi

# 5. Execute Adversarial Refinement Auditor
echo "🛡️ Executing Adversarial Backlog Audit..."
PYTHON_BIN="$(command -v python3 || echo "python3")"

"${PYTHON_BIN}" "${SCRIPT_DIR}/refinement_audit.py" \
  --output "${REPORT_FILE}" \
  --model "${REFINEMENT_MODEL}"

# 6. Execute Adversarial Roadmap & Milestone Audit
echo "🗺️ Executing Adversarial Roadmap & Milestone Audit..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm run audit:roadmap || true
fi

# Link latest report
ln -sf "${REPORT_FILE}" "${LATEST_REPORT}"

echo "================================================================================"
echo "✅ Refinement run complete!"
echo "📄 Report written to: ${REPORT_FILE}"
echo "🔗 Symlinked to:      ${LATEST_REPORT}"
echo "================================================================================"
