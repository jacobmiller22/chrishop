#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Directus CMS Schema Synchronization Script
# Specification: docs/deps/DEP_DIRECTUS.md
#
# Idempotently applies version-controlled schema snapshot
# (apps/cms/snapshot.yaml / infra/directus/snapshot.yaml) to the target Directus instance.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

usage() {
  cat << USAGE
Usage: $(basename "$0") [OPTIONS] [SNAPSHOT_PATH]

Arguments:
  SNAPSHOT_PATH         Optional path to snapshot YAML file
                        (default: infra/directus/snapshot.yaml or apps/cms/snapshot.yaml)

Environment Variables:
  DIRECTUS_URL          Directus instance base URL (default: http://localhost:8055)
  ADMIN_TOKEN / DIRECTUS_TOKEN
                        Static admin token for authentication
  ADMIN_EMAIL           Directus admin email (default: admin@chrishop.com)
  ADMIN_PASSWORD        Directus admin password (default: AdminPassword123!)
  DIRECTUS_TIMEOUT      Seconds to wait for Directus readiness (default: 30)
  FORCE_DIRECT_API      Set to 'true' to force REST API curl sync instead of pnpm

Options:
  -u, --url URL         Directus URL
  -s, --snapshot FILE   Path to snapshot YAML file
  -t, --token TOKEN     Admin bearer token
  -w, --timeout SECS    Wait timeout in seconds (default: 30)
  -h, --help            Show this help message
USAGE
  exit "${1:-0}"
}

CUSTOM_SNAPSHOT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -u|--url)
      DIRECTUS_URL="$2"
      shift 2
      ;;
    -s|--snapshot)
      CUSTOM_SNAPSHOT="$2"
      shift 2
      ;;
    -t|--token)
      ADMIN_TOKEN="$2"
      shift 2
      ;;
    -w|--timeout)
      DIRECTUS_TIMEOUT="$2"
      shift 2
      ;;
    -h|--help)
      usage 0
      ;;
    *)
      if [[ -z "${CUSTOM_SNAPSHOT}" && "$1" != -* ]]; then
        CUSTOM_SNAPSHOT="$1"
        shift
      else
        echo "[ERROR] Unknown option: $1" >&2
        usage 1
      fi
      ;;
  esac
done

DIRECTUS_URL="${DIRECTUS_URL:-http://localhost:8055}"
DIRECTUS_URL="${DIRECTUS_URL%/}" # Strip trailing slash
DIRECTUS_TIMEOUT="${DIRECTUS_TIMEOUT:-30}"
ADMIN_TOKEN="${ADMIN_TOKEN:-${DIRECTUS_TOKEN:-${DIRECTUS_ADMIN_TOKEN:-}}}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@chrishop.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-AdminPassword123!}"
FORCE_DIRECT_API="${FORCE_DIRECT_API:-false}"

# ------------------------------------------------------------------------------
# 1. Locate and Validate Snapshot File
# ------------------------------------------------------------------------------
SNAPSHOT_FILE=""
if [[ -n "${CUSTOM_SNAPSHOT}" ]]; then
  SNAPSHOT_FILE="${CUSTOM_SNAPSHOT}"
elif [[ -f "${REPO_ROOT}/infra/directus/snapshot.yaml" ]]; then
  SNAPSHOT_FILE="${REPO_ROOT}/infra/directus/snapshot.yaml"
elif [[ -f "${REPO_ROOT}/apps/cms/snapshot.yaml" ]]; then
  SNAPSHOT_FILE="${REPO_ROOT}/apps/cms/snapshot.yaml"
fi

echo "============================================================"
echo " ChrisShop Directus Schema Synchronizer"
echo " Directus URL : ${DIRECTUS_URL}"
echo " Snapshot     : ${SNAPSHOT_FILE}"
echo "============================================================"

if [[ -z "${SNAPSHOT_FILE}" || ! -f "${SNAPSHOT_FILE}" ]]; then
  echo "[ERROR] Snapshot YAML file not found!" >&2
  echo "Looked for:" >&2
  echo "  - ${CUSTOM_SNAPSHOT:-<none specified>}" >&2
  echo "  - ${REPO_ROOT}/infra/directus/snapshot.yaml" >&2
  echo "  - ${REPO_ROOT}/apps/cms/snapshot.yaml" >&2
  exit 1
fi

# ------------------------------------------------------------------------------
# 2. Directus Liveness & Readiness Verification
# ------------------------------------------------------------------------------
echo "[INFO] Verifying Directus liveness at ${DIRECTUS_URL}/server/ping..."
START_TIME="$(date +%s)"
READY=false

while true; do
  HTTP_RES="$(curl -s -o /dev/null -w "%{http_code}" "${DIRECTUS_URL}/server/ping" 2>/dev/null || echo "000")"
  if [[ "${HTTP_RES}" == "200" ]]; then
    READY=true
    break
  fi

  CURRENT_TIME="$(date +%s)"
  ELAPSED=$(( CURRENT_TIME - START_TIME ))
  if [[ ${ELAPSED} -ge ${DIRECTUS_TIMEOUT} ]]; then
    break
  fi

  echo "       Directus not ready yet (HTTP ${HTTP_RES}). Waiting 2s... (${ELAPSED}/${DIRECTUS_TIMEOUT}s)"
  sleep 2
done

if [[ "${READY}" != "true" ]]; then
  echo "[ERROR] Directus instance at ${DIRECTUS_URL} failed to respond within ${DIRECTUS_TIMEOUT}s." >&2
  echo "Ensure the container or service is running (e.g. docker compose -f infra/docker/docker-compose.dev.yml up -d cms)." >&2
  exit 1
fi

echo "[INFO] Directus instance is healthy and accepting requests."

# ------------------------------------------------------------------------------
# 3. Synchronize Schema Snapshot
# ------------------------------------------------------------------------------
PNPM_BIN="$(command -v pnpm || true)"
SCHEMA_APPLY_TS="${REPO_ROOT}/apps/cms/scripts/schema-apply.ts"

if [[ "${FORCE_DIRECT_API}" != "true" && -n "${PNPM_BIN}" && -f "${SCHEMA_APPLY_TS}" ]]; then
  echo "[INFO] Applying schema snapshot using repo toolchain (pnpm --filter @chrishop/cms schema:apply)..."
  
  export DIRECTUS_URL
  if [[ -n "${ADMIN_TOKEN}" ]]; then
    export ADMIN_TOKEN
  fi
  export ADMIN_EMAIL
  export ADMIN_PASSWORD

  (
    cd "${REPO_ROOT}"
    "${PNPM_BIN}" --filter @chrishop/cms schema:apply
  )
else
  # Direct REST API invocation fallback using curl
  echo "[INFO] Applying schema snapshot directly via Directus REST API..."

  AUTH_HEADER=""
  if [[ -n "${ADMIN_TOKEN}" ]]; then
    AUTH_HEADER="Authorization: Bearer ${ADMIN_TOKEN}"
  else
    echo "[INFO] Authenticating against ${DIRECTUS_URL}/auth/login..."
    LOGIN_PAYLOAD="$(jq -n --arg email "${ADMIN_EMAIL}" --arg pw "${ADMIN_PASSWORD}" '{email: $email, password: $pw}')"
    LOGIN_RES="$(curl -s -f -X POST "${DIRECTUS_URL}/auth/login" \
      -H "Content-Type: application/json" \
      -d "${LOGIN_PAYLOAD}" 2>/dev/null || echo "")"
    
    ACCESS_TOKEN="$(echo "${LOGIN_RES}" | jq -r '.data.access_token // empty')"
    if [[ -z "${ACCESS_TOKEN}" ]]; then
      echo "[ERROR] Directus authentication failed for ${ADMIN_EMAIL}." >&2
      exit 1
    fi
    AUTH_HEADER="Authorization: Bearer ${ACCESS_TOKEN}"
  fi

  # Convert YAML snapshot to JSON for API submission
  JSON_SNAPSHOT="$(ruby -ryaml -rjson -e 'puts JSON.generate(YAML.load(ARGF.read))' < "${SNAPSHOT_FILE}" 2>/dev/null || \
    python3 -c 'import sys, yaml, json; print(json.dumps(yaml.safe_load(sys.stdin)))' < "${SNAPSHOT_FILE}" 2>/dev/null || \
    npx -y js-yaml "${SNAPSHOT_FILE}" 2>/dev/null || true)"

  if [[ -z "${JSON_SNAPSHOT}" ]]; then
    echo "[ERROR] Failed to parse YAML snapshot into JSON." >&2
    exit 1
  fi

  echo "[INFO] Requesting schema diff from Directus..."
  DIFF_RES="$(curl -s -X POST "${DIRECTUS_URL}/schema/diff" \
    -H "Content-Type: application/json" \
    -H "${AUTH_HEADER}" \
    -d "${JSON_SNAPSHOT}")"

  HAS_DIFF="$(echo "${DIFF_RES}" | jq -r '.data.diff // empty')"

  if [[ -n "${HAS_DIFF}" && "${HAS_DIFF}" != "null" ]]; then
    echo "[INFO] Schema changes detected. Applying diff..."
    DIFF_PAYLOAD="$(echo "${DIFF_RES}" | jq -c '.data.diff')"
    APPLY_RES="$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${DIRECTUS_URL}/schema/apply" \
      -H "Content-Type: application/json" \
      -H "${AUTH_HEADER}" \
      -d "${DIFF_PAYLOAD}")"

    APPLY_CODE="$(echo "${APPLY_RES}" | grep "HTTP_STATUS:" | cut -d: -f2)"
    if [[ "${APPLY_CODE}" != "200" && "${APPLY_CODE}" != "204" ]]; then
      echo "[ERROR] Directus schema apply failed with HTTP ${APPLY_CODE}:" >&2
      echo "${APPLY_RES}" | sed '/HTTP_STATUS:/d' >&2
      exit 1
    fi
    echo "[INFO] Directus schema diff successfully applied."
  else
    echo "[INFO] Schema is already in sync with snapshot (no diff detected)."
  fi
fi

echo "[SUCCESS] Directus schema snapshot successfully synchronized."
exit 0
