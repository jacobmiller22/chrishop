#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Hetzner Cloud Server Provisioning Script
# Specification: docs/deps/DEP_HETZNER.md
#
# Idempotently provisions a Hetzner Cloud VPS (CX22 for staging, CPX21 for prod)
# using either the official `hcloud` CLI or direct Hetzner Cloud REST API.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# Display usage information
usage() {
  cat << USAGE
Usage: $(basename "$0") [OPTIONS]

Environment Variables:
  HCLOUD_TOKEN          (Required) Hetzner Cloud API token
  ENVIRONMENT / ENV     Target environment: 'staging' (default) or 'production'
  SERVER_NAME           Custom server name (default: chrishop-\$ENV)
  SERVER_TYPE           Instance tier (default: cx22 for staging, cpx21 for production)
  SERVER_IMAGE          OS image (default: ubuntu-24.04)
  SERVER_LOCATION       Datacenter location (default: fsn1)
  SSH_KEY               SSH key name or public key in Hetzner (default: chrishop_deploy_key)
  CLOUD_INIT_FILE       Path to cloud-init config (default: infra/vps/cloud-init.yaml)
  RDNS_HOSTNAME         Reverse DNS hostname to configure (optional)
  DRY_RUN               Set to 'true' or '1' to simulate without provisioning

Options:
  -e, --env ENV         Set target environment (staging|production)
  -n, --name NAME       Set server name
  -t, --type TYPE       Set server type (e.g. cx22, cpx21)
  -l, --location LOC    Set location (e.g. fsn1, nbg1, ash)
  -d, --dry-run         Run in dry-run mode (no changes executed)
  -h, --help            Show this help message
USAGE
  exit "${1:-0}"
}

# Parse command-line flags
DRY_RUN_ARG=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    -e|--env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -n|--name)
      SERVER_NAME="$2"
      shift 2
      ;;
    -t|--type)
      SERVER_TYPE="$2"
      shift 2
      ;;
    -l|--location)
      SERVER_LOCATION="$2"
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

# Resolve configuration & defaults
ENVIRONMENT="${ENVIRONMENT:-${ENV:-staging}}"
SERVER_NAME="${SERVER_NAME:-chrishop-${ENVIRONMENT}}"
SERVER_IMAGE="${SERVER_IMAGE:-ubuntu-24.04}"
SERVER_LOCATION="${SERVER_LOCATION:-fsn1}"
SSH_KEY="${SSH_KEY:-chrishop_deploy_key}"
CLOUD_INIT_FILE="${CLOUD_INIT_FILE:-${REPO_ROOT}/infra/vps/cloud-init.yaml}"
RDNS_HOSTNAME="${RDNS_HOSTNAME:-}"
DRY_RUN="${DRY_RUN:-$DRY_RUN_ARG}"

if [[ -z "${SERVER_TYPE:-}" ]]; then
  case "${ENVIRONMENT}" in
    production|prod)
      SERVER_TYPE="cpx21"
      ;;
    staging|stage|*)
      SERVER_TYPE="cx22"
      ;;
  esac
fi

# ------------------------------------------------------------------------------
# 1. Environment & Pre-requisite Validation
# ------------------------------------------------------------------------------
echo "============================================================"
echo " ChrisShop Hetzner Cloud Server Provisioner"
echo " Environment : ${ENVIRONMENT}"
echo " Server Name : ${SERVER_NAME}"
echo " Server Type : ${SERVER_TYPE}"
echo " Location    : ${SERVER_LOCATION}"
echo " OS Image    : ${SERVER_IMAGE}"
echo "============================================================"

if [[ -z "${HCLOUD_TOKEN:-}" ]]; then
  echo "[ERROR] Missing required environment variable: HCLOUD_TOKEN" >&2
  echo "Please export your Hetzner Cloud API token before running this script." >&2
  echo "Example: export HCLOUD_TOKEN=\"<your_hetzner_token>\"" >&2
  exit 1
fi

USER_DATA_CONTENT=""
if [[ -f "${CLOUD_INIT_FILE}" ]]; then
  echo "[INFO] Using cloud-init user-data from: ${CLOUD_INIT_FILE}"
  USER_DATA_CONTENT="$(cat "${CLOUD_INIT_FILE}")"
else
  echo "[WARN] Cloud-init file not found at '${CLOUD_INIT_FILE}'. Provisioning without user-data."
fi

# Detect available tool: 'hcloud' CLI vs direct REST API with curl
HCLOUD_BIN="$(command -v hcloud || true)"
CURL_BIN="$(command -v curl || true)"

if [[ -z "${HCLOUD_BIN}" && -z "${CURL_BIN}" ]]; then
  echo "[ERROR] Neither 'hcloud' CLI nor 'curl' is installed. Cannot interact with Hetzner API." >&2
  exit 1
fi

# ------------------------------------------------------------------------------
# 2. Idempotency Check: Verify if Server Already Exists
# ------------------------------------------------------------------------------
echo "[INFO] Checking whether server '${SERVER_NAME}' already exists..."

SERVER_EXISTS=false
EXISTING_SERVER_ID=""
EXISTING_SERVER_IP=""
EXISTING_SERVER_STATUS=""

if [[ -n "${HCLOUD_BIN}" ]]; then
  if "${HCLOUD_BIN}" server describe "${SERVER_NAME}" --token "${HCLOUD_TOKEN}" >/dev/null 2>&1; then
    SERVER_EXISTS=true
    EXISTING_SERVER_ID="$("${HCLOUD_BIN}" server describe "${SERVER_NAME}" --token "${HCLOUD_TOKEN}" -o format='{{.ID}}' 2>/dev/null || echo "")"
    EXISTING_SERVER_IP="$("${HCLOUD_BIN}" server describe "${SERVER_NAME}" --token "${HCLOUD_TOKEN}" -o format='{{.PublicNet.IPv4.IP}}' 2>/dev/null || echo "")"
    EXISTING_SERVER_STATUS="$("${HCLOUD_BIN}" server describe "${SERVER_NAME}" --token "${HCLOUD_TOKEN}" -o format='{{.Status}}' 2>/dev/null || echo "existing")"
  fi
else
  # Use Hetzner Cloud REST API
  RESPONSE="$("${CURL_BIN}" -s -f \
    -H "Authorization: Bearer ${HCLOUD_TOKEN}" \
    "https://api.hetzner.cloud/v1/servers?name=${SERVER_NAME}" 2>/dev/null || echo "")"

  if [[ -n "${RESPONSE}" ]]; then
    MATCH_COUNT="$(echo "${RESPONSE}" | jq -r '.servers | length' 2>/dev/null || echo "0")"
    if [[ "${MATCH_COUNT}" -gt 0 ]]; then
      SERVER_EXISTS=true
      EXISTING_SERVER_ID="$(echo "${RESPONSE}" | jq -r '.servers[0].id' 2>/dev/null || echo "")"
      EXISTING_SERVER_IP="$(echo "${RESPONSE}" | jq -r '.servers[0].public_net.ipv4.ip' 2>/dev/null || echo "")"
      EXISTING_SERVER_STATUS="$(echo "${RESPONSE}" | jq -r '.servers[0].status' 2>/dev/null || echo "existing")"
    fi
  fi
fi

if [[ "${SERVER_EXISTS}" == "true" ]]; then
  echo "[INFO] Server '${SERVER_NAME}' already exists!"
  echo "       Server ID : ${EXISTING_SERVER_ID}"
  echo "       Status    : ${EXISTING_SERVER_STATUS}"
  echo "       IPv4      : ${EXISTING_SERVER_IP}"
  echo "[SUCCESS] Idempotency check satisfied. No provisioning changes required."
  exit 0
fi

# ------------------------------------------------------------------------------
# 3. Server Provisioning Execution
# ------------------------------------------------------------------------------
if [[ "${DRY_RUN}" == "true" || "${DRY_RUN}" == "1" ]]; then
  echo "[DRY-RUN] Server '${SERVER_NAME}' does not exist."
  echo "[DRY-RUN] Simulated action: Would provision Hetzner server '${SERVER_NAME}':"
  echo "          - Type: ${SERVER_TYPE}"
  echo "          - Image: ${SERVER_IMAGE}"
  echo "          - Location: ${SERVER_LOCATION}"
  echo "          - Labels: env=${ENVIRONMENT}, app=chrishop"
  echo "          - Cloud-Init: ${CLOUD_INIT_FILE}"
  if [[ -n "${RDNS_HOSTNAME}" ]]; then
    echo "          - Reverse DNS: ${RDNS_HOSTNAME}"
  fi
  echo "[DRY-RUN] Execution completed cleanly."
  exit 0
fi

echo "[INFO] Server '${SERVER_NAME}' not found. Initiating creation..."

PROVISIONED_IP=""

if [[ -n "${HCLOUD_BIN}" ]]; then
  HCLOUD_CMD=(
    "${HCLOUD_BIN}" server create
    --name "${SERVER_NAME}"
    --type "${SERVER_TYPE}"
    --image "${SERVER_IMAGE}"
    --location "${SERVER_LOCATION}"
    --label "env=${ENVIRONMENT}"
    --label "app=chrishop"
    --token "${HCLOUD_TOKEN}"
  )

  if [[ -n "${SSH_KEY}" ]]; then
    HCLOUD_CMD+=(--ssh-key "${SSH_KEY}")
  fi

  if [[ -f "${CLOUD_INIT_FILE}" ]]; then
    HCLOUD_CMD+=(--user-data-from-file "${CLOUD_INIT_FILE}")
  fi

  echo "[INFO] Running: ${HCLOUD_CMD[*]}"
  CREATE_OUTPUT="$("${HCLOUD_CMD[@]}")"
  echo "${CREATE_OUTPUT}"

  PROVISIONED_IP="$("${HCLOUD_BIN}" server describe "${SERVER_NAME}" --token "${HCLOUD_TOKEN}" -o format='{{.PublicNet.IPv4.IP}}' 2>/dev/null || echo "")"
else
  # Native Hetzner REST API payload
  echo "[INFO] Invoking Hetzner Cloud REST API (POST https://api.hetzner.cloud/v1/servers)..."

  # Construct JSON payload
  PAYLOAD="$(jq -n \
    --arg name "${SERVER_NAME}" \
    --arg server_type "${SERVER_TYPE}" \
    --arg image "${SERVER_IMAGE}" \
    --arg location "${SERVER_LOCATION}" \
    --arg user_data "${USER_DATA_CONTENT}" \
    --arg env "${ENVIRONMENT}" \
    --arg ssh_key "${SSH_KEY}" \
    '{
      name: $name,
      server_type: $server_type,
      image: $image,
      location: $location,
      labels: { env: $env, app: "chrishop" },
      start_after_create: true
    }
    | if ($user_data | length) > 0 then .user_data = $user_data else . end
    | if ($ssh_key | length) > 0 then .ssh_keys = [$ssh_key] else . end
    '
  )"

  API_RESPONSE="$("${CURL_BIN}" -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST "https://api.hetzner.cloud/v1/servers" \
    -H "Authorization: Bearer ${HCLOUD_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${PAYLOAD}")"

  HTTP_CODE="$(echo "${API_RESPONSE}" | grep "HTTP_STATUS:" | cut -d: -f2)"
  BODY="$(echo "${API_RESPONSE}" | sed '/HTTP_STATUS:/d')"

  if [[ "${HTTP_CODE}" != "201" && "${HTTP_CODE}" != "200" ]]; then
    echo "[ERROR] Hetzner API server creation failed with HTTP status ${HTTP_CODE}:" >&2
    echo "${BODY}" >&2
    exit 1
  fi

  PROVISIONED_ID="$(echo "${BODY}" | jq -r '.server.id // empty')"
  PROVISIONED_IP="$(echo "${BODY}" | jq -r '.server.public_net.ipv4.ip // empty')"
  ROOT_PASSWORD="$(echo "${BODY}" | jq -r '.root_password // empty')"

  echo "[INFO] Server created successfully (ID: ${PROVISIONED_ID}, IPv4: ${PROVISIONED_IP})"
  if [[ -n "${ROOT_PASSWORD}" ]]; then
    echo "[WARN] Server root password generated (store securely): ${ROOT_PASSWORD}"
  fi
fi

# ------------------------------------------------------------------------------
# 4. Optional Reverse DNS (PTR) Configuration
# ------------------------------------------------------------------------------
if [[ -n "${RDNS_HOSTNAME}" && -n "${PROVISIONED_IP}" ]]; then
  echo "[INFO] Setting Reverse DNS (PTR) for ${PROVISIONED_IP} -> ${RDNS_HOSTNAME}..."
  if [[ -n "${HCLOUD_BIN}" ]]; then
    "${HCLOUD_BIN}" server set-rdns "${SERVER_NAME}" --ip "${PROVISIONED_IP}" --hostname "${RDNS_HOSTNAME}" --token "${HCLOUD_TOKEN}" || {
      echo "[WARN] Failed to set RDNS via hcloud CLI." >&2
    }
  else
    "${CURL_BIN}" -s -X POST "https://api.hetzner.cloud/v1/servers/${PROVISIONED_ID}/actions/change_dns_ptr" \
      -H "Authorization: Bearer ${HCLOUD_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"ip\": \"${PROVISIONED_IP}\", \"dns_ptr\": \"${RDNS_HOSTNAME}\"}" >/dev/null 2>&1 || {
      echo "[WARN] Failed to set RDNS via Hetzner API." >&2
    }
  fi
fi

echo "[SUCCESS] Hetzner server '${SERVER_NAME}' provisioning completed successfully."
exit 0
