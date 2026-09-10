#!/usr/bin/env bash
set -euo pipefail

# ChrisShop Database Backup & Offsite Encryption Script
# Usage: ./backup.sh

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/tmp/chrishop_backups"
DB_NAME="${POSTGRES_DB:-chrishop_prod}"
DB_USER="${POSTGRES_USER:-chrishop}"
AGE_RECIPIENT_KEY="${AGE_PUBLIC_KEY}"
BUCKET_NAME="chrishop-backups"

mkdir -p "${BACKUP_DIR}"

DUMP_FILE="${BACKUP_DIR}/db_${DB_NAME}_${TIMESTAMP}.sql.gz"
ENC_FILE="${DUMP_FILE}.age"

echo "[INFO] Running pg_dump for database ${DB_NAME}..."
docker exec chrishop-postgres pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${DUMP_FILE}"

echo "[INFO] Encrypting database dump with age..."
age -r "${AGE_RECIPIENT_KEY}" "${DUMP_FILE}" > "${ENC_FILE}"

echo "[INFO] Uploading encrypted backup to offsite R2 bucket ${BUCKET_NAME}..."
aws --endpoint-url "${R2_ENDPOINT_URL}" s3 cp "${ENC_FILE}" "s3://${BUCKET_NAME}/database/${TIMESTAMP}/db_${DB_NAME}_${TIMESTAMP}.sql.gz.age"

echo "[INFO] Cleaning up local temporary files..."
rm -f "${DUMP_FILE}" "${ENC_FILE}"

echo "[SUCCESS] Offsite backup completed successfully: db_${DB_NAME}_${TIMESTAMP}.sql.gz.age"
