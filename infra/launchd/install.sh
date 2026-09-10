#!/usr/bin/env bash
# ==============================================================================
# ChrisShop launchd Service Installer & Manager
# Installs, manages, and tests the com.chrishop.backlog-refinement LaunchAgent
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_LABEL="com.chrishop.backlog-refinement"
PLIST_FILENAME="${SERVICE_LABEL}.plist"
TEMPLATE_PLIST="${SCRIPT_DIR}/${PLIST_FILENAME}"
TARGET_DIR="${HOME}/Library/LaunchAgents"
TARGET_PLIST="${TARGET_DIR}/${PLIST_FILENAME}"
LOG_DIR="${HOME}/.chrishop/logs"
ENV_FILE="${HOME}/.chrishop/refinement.env"

# Resolve the permanent main repository directory (not a temporary worktree)
resolve_main_repo() {
  if command -v git >/dev/null 2>&1; then
    local main_worktree
    main_worktree="$(git -C "${SCRIPT_DIR}" worktree list --porcelain 2>/dev/null | head -n 1 | awk '{print $2}' || true)"
    if [[ -n "${main_worktree}" && -d "${main_worktree}" ]]; then
      echo "${main_worktree}"
      return
    fi
  fi
  # Fallback to 2 directories above script
  cd "${SCRIPT_DIR}/../.." && pwd
}

MAIN_REPO="$(resolve_main_repo)"

usage() {
  cat <<EOF
ChrisShop Backlog Refinement Service Manager

Usage:
  ./install.sh install     Install and load the launchd service (runs at 02:00 & 14:00)
  ./install.sh uninstall   Unload and remove the launchd service
  ./install.sh status      Check if service is registered and active
  ./install.sh run-now     Trigger a refinement run immediately
  ./install.sh logs        Tail recent refinement logs

EOF
}

cmd_install() {
  echo "📦 Installing ChrisShop Backlog Refinement Service..."
  echo "📁 Main Repository: ${MAIN_REPO}"
  echo "📄 Target Plist:    ${TARGET_PLIST}"

  mkdir -p "${TARGET_DIR}"
  mkdir -p "${LOG_DIR}"

  # Seed refinement.env if missing
  if [[ ! -f "${ENV_FILE}" ]]; then
    cat <<'ENVEOF' > "${ENV_FILE}"
# ChrisShop Autonomous Backlog Refinement Environment
# Configure your Anthropic API key to enable Claude Opus adversarial critique:
# ANTHROPIC_API_KEY=sk-ant-api03-...
# REFINEMENT_MODEL=claude-3-opus-20240229

# Or Google Gemini:
# GEMINI_API_KEY=AIzaSy...
ENVEOF
    echo "💡 Created template configuration at ${ENV_FILE}"
  fi

  # Generate destination plist with resolved paths
  sed \
    -e "s|__REPO_ROOT__|${MAIN_REPO}|g" \
    -e "s|__HOME__|${HOME}|g" \
    "${TEMPLATE_PLIST}" > "${TARGET_PLIST}"

  # Unload previous registration if active
  if launchctl list 2>/dev/null | grep -q "${SERVICE_LABEL}"; then
    echo "🔄 Unloading previous service instance..."
    launchctl bootout "gui/$(id -u)/${SERVICE_LABEL}" 2>/dev/null || launchctl unload "${TARGET_PLIST}" 2>/dev/null || true
  fi

  echo "🚀 Loading service into launchctl..."
  if launchctl bootstrap "gui/$(id -u)" "${TARGET_PLIST}" 2>/dev/null; then
    echo "✅ Service successfully bootstrapped via 'launchctl bootstrap'!"
  else
    echo "ℹ️ Falling back to 'launchctl load'..."
    launchctl load "${TARGET_PLIST}"
  fi

  echo ""
  echo "================================================================================"
  echo "🎉 Success! The backlog refinement daemon is active."
  echo "🕒 Schedule: Everyday at 02:00 and 14:00 EDT/EST (every 12 hours)."
  echo "📄 Plist:    ${TARGET_PLIST}"
  echo "📝 Logs:     ${LOG_DIR}/backlog-refinement.out.log"
  echo "             ${LOG_DIR}/backlog-refinement.err.log"
  echo "💡 Tip: Run './install.sh run-now' to test execution right now."
  echo "================================================================================"
}

cmd_uninstall() {
  echo "🛑 Unloading ${SERVICE_LABEL}..."
  if launchctl list 2>/dev/null | grep -q "${SERVICE_LABEL}"; then
    launchctl bootout "gui/$(id -u)/${SERVICE_LABEL}" 2>/dev/null || launchctl unload "${TARGET_PLIST}" 2>/dev/null || true
  fi

  if [[ -f "${TARGET_PLIST}" ]]; then
    rm -f "${TARGET_PLIST}"
    echo "🗑️ Removed ${TARGET_PLIST}"
  fi

  echo "✅ Service successfully uninstalled."
}

cmd_status() {
  echo "🔍 Service Status for ${SERVICE_LABEL}:"
  echo "--------------------------------------------------------------------------------"
  if launchctl list 2>/dev/null | grep -q "${SERVICE_LABEL}"; then
    echo "🟢 Status: LOADED and ACTIVE in launchctl"
    launchctl list 2>/dev/null | grep "${SERVICE_LABEL}"
  else
    echo "🔴 Status: NOT LOADED in launchctl"
  fi
  echo "--------------------------------------------------------------------------------"
  echo "Target Plist:  ${TARGET_PLIST} ($([[ -f "${TARGET_PLIST}" ]] && echo "Found" || echo "Missing"))"
  echo "Main Repo:     ${MAIN_REPO}"
  echo "Logs Dir:      ${LOG_DIR}"
  if [[ -f "${LOG_DIR}/refinement-latest.md" ]]; then
    echo "📄 Latest Report: ${LOG_DIR}/refinement-latest.md"
  fi
}

cmd_run_now() {
  echo "⚡ Executing refinement runner immediately..."
  if [[ -x "${SCRIPT_DIR}/refinement-runner.sh" ]]; then
    "${SCRIPT_DIR}/refinement-runner.sh"
  elif [[ -x "${MAIN_REPO}/infra/launchd/refinement-runner.sh" ]]; then
    "${MAIN_REPO}/infra/launchd/refinement-runner.sh"
  else
    echo "❌ Error: refinement-runner.sh not found." >&2
    exit 1
  fi
}

cmd_logs() {
  local stdout_log="${LOG_DIR}/backlog-refinement.out.log"
  local stderr_log="${LOG_DIR}/backlog-refinement.err.log"
  local latest_log="${LOG_DIR}/refinement-latest.log"

  echo "📄 Recent stdout log (${stdout_log}):"
  if [[ -f "${stdout_log}" ]]; then
    tail -n 25 "${stdout_log}"
  else
    echo "(No stdout log generated yet)"
  fi

  echo ""
  echo "⚠️ Recent stderr log (${stderr_log}):"
  if [[ -f "${stderr_log}" ]]; then
    tail -n 25 "${stderr_log}"
  else
    echo "(No stderr log generated yet)"
  fi
}

ACTION="${1:-}"
case "${ACTION}" in
  install)
    cmd_install
    ;;
  uninstall)
    cmd_uninstall
    ;;
  status)
    cmd_status
    ;;
  run-now)
    cmd_run_now
    ;;
  logs)
    cmd_logs
    ;;
  *)
    usage
    exit 1
    ;;
esac
