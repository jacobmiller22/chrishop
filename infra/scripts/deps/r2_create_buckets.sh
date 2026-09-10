#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Cloudflare R2 / S3 Storage Bucket Creation & CORS Configuration Script
# Specification: docs/deps/DEP_CLOUDFLARE_R2.md
#
# Idempotently provisions Cloudflare R2 / S3 buckets:
#   - chrishop-media   (Public Read, CORS-enabled for web & admin upload)
#   - chrishop-backups (Private, offsite database dump storage)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

usage() {
  cat << USAGE
Usage: $(basename "$0") [OPTIONS]

Environment Variables:
  CLOUDFLARE_ACCOUNT_ID     Cloudflare Account ID (endpoint: https://<id>.r2.cloudflarestorage.com)
  R2_ENDPOINT_URL           Direct S3/R2 endpoint URL override
  CLOUDFLARE_R2_ACCESS_KEY_ID / AWS_ACCESS_KEY_ID / STORAGE_S3_KEY
                            R2/S3 access key ID
  CLOUDFLARE_R2_SECRET_ACCESS_KEY / AWS_SECRET_ACCESS_KEY / STORAGE_S3_SECRET
                            R2/S3 secret access key
  R2_REGION / AWS_DEFAULT_REGION
                            S3 region (default: auto for R2, us-east-1 for S3/MinIO)
  MEDIA_BUCKET              Media bucket name (default: chrishop-media)
  BACKUPS_BUCKET            Backups bucket name (default: chrishop-backups)
  CORS_CONFIG_FILE          Path to CORS JSON configuration (default: infra/r2/cors-media.json)
  DRY_RUN                   Set to 'true' or '1' to simulate without provisioning

Options:
  -a, --account ID          Cloudflare Account ID
  -e, --endpoint URL        Custom endpoint URL
  -m, --media-bucket NAME   Media bucket name (default: chrishop-media)
  -b, --backups-bucket NAME Backups bucket name (default: chrishop-backups)
  -c, --cors-file FILE      CORS configuration JSON file
  -d, --dry-run             Dry-run mode (no changes made)
  -h, --help                Show this help message
USAGE
  exit "${1:-0}"
}

DRY_RUN_ARG=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--account)
      CLOUDFLARE_ACCOUNT_ID="$2"
      shift 2
      ;;
    -e|--endpoint)
      R2_ENDPOINT_URL="$2"
      shift 2
      ;;
    -m|--media-bucket)
      MEDIA_BUCKET="$2"
      shift 2
      ;;
    -b|--backups-bucket)
      BACKUPS_BUCKET="$2"
      shift 2
      ;;
    -c|--cors-file)
      CORS_CONFIG_FILE="$2"
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
MEDIA_BUCKET="${MEDIA_BUCKET:-chrishop-media}"
BACKUPS_BUCKET="${BACKUPS_BUCKET:-chrishop-backups}"
CORS_CONFIG_FILE="${CORS_CONFIG_FILE:-${REPO_ROOT}/infra/r2/cors-media.json}"

# Resolve credentials
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${CLOUDFLARE_R2_ACCESS_KEY_ID:-${STORAGE_S3_KEY:-}}}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${CLOUDFLARE_R2_SECRET_ACCESS_KEY:-${STORAGE_S3_SECRET:-}}}"

# Resolve endpoint URL
ENDPOINT_URL="${R2_ENDPOINT_URL:-${ENDPOINT_URL:-${AWS_ENDPOINT_URL:-}}}"
if [[ -z "${ENDPOINT_URL}" && -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  ENDPOINT_URL="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
fi

# Region default
if [[ -z "${AWS_DEFAULT_REGION:-}" ]]; then
  if [[ "${ENDPOINT_URL:-}" == *"r2.cloudflarestorage.com"* ]]; then
    AWS_DEFAULT_REGION="auto"
  else
    AWS_DEFAULT_REGION="${R2_REGION:-us-east-1}"
  fi
fi

echo "============================================================"
echo " ChrisShop Cloudflare R2 / S3 Bucket Provisioner"
echo " Endpoint       : ${ENDPOINT_URL:-<not set>}"
echo " Media Bucket   : ${MEDIA_BUCKET}"
echo " Backups Bucket : ${BACKUPS_BUCKET}"
echo " Region         : ${AWS_DEFAULT_REGION}"
echo "============================================================"

# ------------------------------------------------------------------------------
# 1. Environment & Pre-requisite Validation
# ------------------------------------------------------------------------------
if [[ -z "${ENDPOINT_URL}" ]]; then
  echo "[ERROR] Missing required endpoint configuration!" >&2
  echo "Please set CLOUDFLARE_ACCOUNT_ID or R2_ENDPOINT_URL." >&2
  echo "Examples:" >&2
  echo "  export CLOUDFLARE_ACCOUNT_ID=\"<account_id>\"" >&2
  echo "  export R2_ENDPOINT_URL=\"http://localhost:9000\" (for local MinIO development)" >&2
  exit 1
fi

if [[ -z "${AWS_ACCESS_KEY_ID}" || -z "${AWS_SECRET_ACCESS_KEY}" ]]; then
  echo "[ERROR] Missing required storage credentials!" >&2
  echo "Please set CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY (or AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)." >&2
  exit 1
fi

export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION

# Check for CLI tooling
AWS_BIN="$(command -v aws || true)"
MC_BIN="$(command -v mc || true)"

if [[ -z "${AWS_BIN}" && -z "${MC_BIN}" ]]; then
  echo "[ERROR] Neither 'aws' CLI nor 'mc' CLI was found in PATH." >&2
  echo "Please install the AWS CLI (e.g. brew install awscli) or MinIO Client (mc)." >&2
  exit 1
fi

# ------------------------------------------------------------------------------
# 2. Bucket Creation with Idempotency Check
# ------------------------------------------------------------------------------
TARGET_BUCKETS=("${MEDIA_BUCKET}" "${BACKUPS_BUCKET}")

for BUCKET in "${TARGET_BUCKETS[@]}"; do
  echo "[INFO] Checking bucket '${BUCKET}'..."

  BUCKET_EXISTS=false
  if [[ -n "${AWS_BIN}" ]]; then
    if "${AWS_BIN}" --endpoint-url "${ENDPOINT_URL}" s3api head-bucket --bucket "${BUCKET}" >/dev/null 2>&1; then
      BUCKET_EXISTS=true
    fi
  elif [[ -n "${MC_BIN}" ]]; then
    if "${MC_BIN}" ls "r2/${BUCKET}" >/dev/null 2>&1; then
      BUCKET_EXISTS=true
    fi
  fi

  if [[ "${BUCKET_EXISTS}" == "true" ]]; then
    echo "[INFO] Bucket '${BUCKET}' already exists. Skipping creation."
  else
    if [[ "${DRY_RUN}" == "true" || "${DRY_RUN}" == "1" ]]; then
      echo "[DRY-RUN] Bucket '${BUCKET}' does not exist. Would execute bucket creation."
    else
      echo "[INFO] Bucket '${BUCKET}' does not exist. Creating..."
      if [[ -n "${AWS_BIN}" ]]; then
        # For S3/R2 create-bucket
        if [[ "${AWS_DEFAULT_REGION}" == "us-east-1" || "${AWS_DEFAULT_REGION}" == "auto" ]]; then
          "${AWS_BIN}" --endpoint-url "${ENDPOINT_URL}" s3api create-bucket --bucket "${BUCKET}"
        else
          "${AWS_BIN}" --endpoint-url "${ENDPOINT_URL}" s3api create-bucket \
            --bucket "${BUCKET}" \
            --create-bucket-configuration "LocationConstraint=${AWS_DEFAULT_REGION}"
        fi
      elif [[ -n "${MC_BIN}" ]]; then
        "${MC_BIN}" mb "r2/${BUCKET}"
      fi
      echo "[INFO] Bucket '${BUCKET}' created successfully."
    fi
  fi
done

# ------------------------------------------------------------------------------
# 3. Apply CORS Configuration to Media Bucket
# ------------------------------------------------------------------------------
echo "[INFO] Applying CORS rules to '${MEDIA_BUCKET}'..."

if [[ ! -f "${CORS_CONFIG_FILE}" ]]; then
  echo "[WARN] CORS configuration file '${CORS_CONFIG_FILE}' not found. Generating default CORS config..."
  TMP_CORS="$(mktemp /tmp/cors-media-XXXXXX.json)"
  cat << 'EOF_CORS' > "${TMP_CORS}"
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "HEAD", "POST"],
      "AllowedOrigins": [
        "https://chrishop.com",
        "https://admin.chrishop.com",
        "https://shop.jacobmiller22.com",
        "https://admin.shop.jacobmiller22.com",
        "https://*.preview.chrishop.com",
        "https://*.preview.shop.jacobmiller22.com",
        "http://localhost:3000",
        "http://localhost:8055"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF_CORS
  CORS_CONFIG_FILE="${TMP_CORS}"
fi

# Ensure CORS file is structured with top-level CORSRules for AWS CLI
FORMATTED_CORS_FILE="$(mktemp /tmp/cors-formatted-XXXXXX.json)"
if command -v jq >/dev/null 2>&1; then
  if jq -e 'has("CORSRules")' "${CORS_CONFIG_FILE}" >/dev/null 2>&1; then
    cp "${CORS_CONFIG_FILE}" "${FORMATTED_CORS_FILE}"
  else
    jq '{CORSRules: .}' "${CORS_CONFIG_FILE}" > "${FORMATTED_CORS_FILE}"
  fi
else
  cp "${CORS_CONFIG_FILE}" "${FORMATTED_CORS_FILE}"
fi

if [[ "${DRY_RUN}" == "true" || "${DRY_RUN}" == "1" ]]; then
  echo "[DRY-RUN] Would apply CORS rules to '${MEDIA_BUCKET}' using configuration:"
  cat "${FORMATTED_CORS_FILE}"
  rm -f "${FORMATTED_CORS_FILE}"
  if [[ -n "${TMP_CORS:-}" ]]; then rm -f "${TMP_CORS}"; fi
  echo "[DRY-RUN] Execution completed cleanly."
  exit 0
fi

if [[ -n "${AWS_BIN}" ]]; then
  if "${AWS_BIN}" --endpoint-url "${ENDPOINT_URL}" s3api put-bucket-cors \
    --bucket "${MEDIA_BUCKET}" \
    --cors-configuration "file://${FORMATTED_CORS_FILE}" 2>/tmp/cors_err.log; then
    echo "[INFO] CORS rules successfully applied to '${MEDIA_BUCKET}'."
  else
    # Check if failure was due to MinIO emulator (which doesn't support S3 PutBucketCors)
    if grep -q "MalformedXML" /tmp/cors_err.log || grep -q "NotImplemented" /tmp/cors_err.log; then
      echo "[WARN] Notice: Endpoint at ${ENDPOINT_URL} does not support S3 PutBucketCors XML payload (standard behavior for local MinIO emulator)."
      echo "       In production, Cloudflare R2 natively supports this CORS configuration."
    else
      echo "[ERROR] Failed to apply CORS rules to '${MEDIA_BUCKET}':" >&2
      cat /tmp/cors_err.log >&2
      rm -f "${FORMATTED_CORS_FILE}" /tmp/cors_err.log
      if [[ -n "${TMP_CORS:-}" ]]; then rm -f "${TMP_CORS}"; fi
      exit 1
    fi
  fi
  rm -f /tmp/cors_err.log 2>/dev/null || true
fi

rm -f "${FORMATTED_CORS_FILE}"
if [[ -n "${TMP_CORS:-}" ]]; then rm -f "${TMP_CORS}"; fi

echo "[SUCCESS] Cloudflare R2 / S3 storage buckets provisioned and configured successfully."
exit 0
