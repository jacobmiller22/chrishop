#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Cloudflare R2 Bucket Lifecycle Policy Provisioning Script
# Specification: Issue #159 / Story 2.36
#
# Idempotently applies lifecycle policies to Cloudflare R2 buckets:
#   - chrishop-media-prod    (InfrequentAccess transition for archives, abort multipart)
#   - chrishop-media-staging (InfrequentAccess @ 30d, expiration @ 90d, abort multipart)
#   - chrishop-media-preview (Expiration @ 7d, abort multipart)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

usage() {
  cat << USAGE
Usage: $(basename "$0") [OPTIONS]

Environment Variables:
  CLOUDFLARE_ACCOUNT_ID     Cloudflare Account ID (required for REST API fallback)
  CLOUDFLARE_API_TOKEN      Cloudflare API Token with R2 edit permissions (for REST API)
  DRY_RUN                   Set to 'true' or '1' to simulate without applying changes

Options:
  -e, --env ENV             Environment target: 'prod', 'staging', 'preview', or 'all' (default: all)
  -b, --bucket NAME         Specific bucket override (must be used with --file)
  -f, --file FILE           Lifecycle configuration JSON file path (used with --bucket)
  -a, --account ID          Cloudflare Account ID
  -t, --token TOKEN         Cloudflare API Token
  -d, --dry-run             Dry-run mode (validate config without making changes)
  -h, --help                Show this help message
USAGE
  exit "${1:-0}"
}

ENV_TARGET="all"
BUCKET_OVERRIDE=""
FILE_OVERRIDE=""
DRY_RUN_ARG=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -e|--env)
      ENV_TARGET="$2"
      shift 2
      ;;
    -b|--bucket)
      BUCKET_OVERRIDE="$2"
      shift 2
      ;;
    -f|--file)
      FILE_OVERRIDE="$2"
      shift 2
      ;;
    -a|--account)
      CLOUDFLARE_ACCOUNT_ID="$2"
      shift 2
      ;;
    -t|--token)
      CLOUDFLARE_API_TOKEN="$2"
      shift 2
      ;;
    -d|--dry-run)
      DRY_RUN_ARG=true
      shift
      ;;
    -h|--help)
      usage 0
      ;;
    *)
      echo "[ERROR] Unknown option: $1" >&2
      usage 1
      ;;
  esac
done

DRY_RUN="${DRY_RUN:-$DRY_RUN_ARG}"
CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"

# Resolve Wrangler executable
WRANGLER_BIN=""
if [[ -x "${REPO_ROOT}/node_modules/.bin/wrangler" ]]; then
  WRANGLER_BIN="${REPO_ROOT}/node_modules/.bin/wrangler"
elif command -v wrangler >/dev/null 2>&1; then
  WRANGLER_BIN="$(command -v wrangler)"
fi

validate_lifecycle_json() {
  local file="$1"
  if [[ ! -f "${file}" ]]; then
    echo "[ERROR] Lifecycle configuration file not found: ${file}" >&2
    return 1
  fi

  if command -v jq >/dev/null 2>&1; then
    if ! jq -e '.rules and (.rules | type == "array") and (.rules | length > 0)' "${file}" >/dev/null 2>&1; then
      echo "[ERROR] File ${file} must contain a non-empty 'rules' array." >&2
      return 1
    fi
  else
    # Basic node validation fallback
    node -e "const c = require('${file}'); if (!Array.isArray(c.rules) || c.rules.length === 0) process.exit(1);" || {
      echo "[ERROR] File ${file} must contain a non-empty 'rules' array." >&2
      return 1
    }
  fi
  return 0
}

apply_lifecycle_policy() {
  local bucket="$1"
  local config_file="$2"

  echo "------------------------------------------------------------"
  echo "[INFO] Processing lifecycle policy for bucket: ${bucket}"
  echo "[INFO] Configuration file: ${config_file}"

  validate_lifecycle_json "${config_file}"

  if [[ "${DRY_RUN}" == "true" || "${DRY_RUN}" == "1" ]]; then
    echo "[DRY-RUN] Validated lifecycle configuration for '${bucket}':"
    if command -v jq >/dev/null 2>&1; then
      jq . "${config_file}"
    else
      cat "${config_file}"
    fi
    echo "[DRY-RUN] Simulation successful. No remote changes applied."
    return 0
  fi

  # Attempt application via Wrangler CLI first
  if [[ -n "${WRANGLER_BIN}" ]]; then
    echo "[INFO] Applying lifecycle rules via Wrangler CLI..."
    if "${WRANGLER_BIN}" r2 bucket lifecycle set "${bucket}" --file "${config_file}" -y; then
      echo "[SUCCESS] Successfully applied lifecycle policy to '${bucket}' via Wrangler."
      return 0
    else
      echo "[WARN] Wrangler command failed. Checking REST API fallback..."
    fi
  fi

  # REST API Fallback
  if [[ -n "${CLOUDFLARE_ACCOUNT_ID}" && -n "${CLOUDFLARE_API_TOKEN}" ]]; then
    echo "[INFO] Applying lifecycle rules via Cloudflare REST API..."
    local api_url="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${bucket}/lifecycle"
    local http_response
    local http_status

    http_response=$(curl -s -w "\n%{http_code}" -X PUT "${api_url}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data-binary "@${config_file}")

    http_status=$(echo "${http_response}" | tail -n1)
    local body
    body=$(echo "${http_response}" | sed '$d')

    if [[ "${http_status}" == "200" || "${http_status}" == "201" ]]; then
      echo "[SUCCESS] Successfully applied lifecycle policy to '${bucket}' via REST API."
      return 0
    else
      echo "[ERROR] Failed to apply lifecycle policy to '${bucket}' via REST API (HTTP ${http_status}):" >&2
      echo "${body}" >&2
      return 1
    fi
  fi

  echo "[ERROR] Neither Wrangler CLI nor valid Cloudflare REST API credentials (CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN) could apply lifecycle policy to '${bucket}'." >&2
  return 1
}

echo "============================================================"
echo " ChrisShop Cloudflare R2 Bucket Lifecycle Provisioner"
echo " Target Environment : ${ENV_TARGET}"
echo " Dry Run Mode       : ${DRY_RUN}"
echo "============================================================"

# Handle direct bucket and file override
if [[ -n "${BUCKET_OVERRIDE}" ]]; then
  if [[ -z "${FILE_OVERRIDE}" ]]; then
    echo "[ERROR] When specifying --bucket, --file must also be provided." >&2
    exit 1
  fi
  apply_lifecycle_policy "${BUCKET_OVERRIDE}" "${FILE_OVERRIDE}"
  exit 0
fi

declare -a TARGETS=()

case "${ENV_TARGET}" in
  prod|production)
    TARGETS+=("chrishop-media-prod:${REPO_ROOT}/infra/r2/lifecycle-prod.json")
    ;;
  staging)
    TARGETS+=("chrishop-media-staging:${REPO_ROOT}/infra/r2/lifecycle-staging.json")
    ;;
  preview)
    TARGETS+=("chrishop-media-preview:${REPO_ROOT}/infra/r2/lifecycle-preview.json")
    ;;
  all)
    TARGETS+=("chrishop-media-prod:${REPO_ROOT}/infra/r2/lifecycle-prod.json")
    TARGETS+=("chrishop-media-staging:${REPO_ROOT}/infra/r2/lifecycle-staging.json")
    TARGETS+=("chrishop-media-preview:${REPO_ROOT}/infra/r2/lifecycle-preview.json")
    ;;
  *)
    echo "[ERROR] Invalid environment target: '${ENV_TARGET}'. Expected: prod, staging, preview, all." >&2
    exit 1
    ;;
esac

for item in "${TARGETS[@]}"; do
  bucket="${item%%:*}"
  config="${item##*:}"
  apply_lifecycle_policy "${bucket}" "${config}"
done

echo "============================================================"
echo "[SUCCESS] All target lifecycle policies processed successfully."
echo "============================================================"
exit 0
