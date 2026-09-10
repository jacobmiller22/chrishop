#!/usr/bin/env bash
set -euo pipefail

# ChrisShop Disaster Recovery Restore Script
# Usage: ./restore.sh <backup_filename.sql.gz.age>

BACKUP_FILE="${1:-}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "[ERROR] Please specify backup filename to restore."
  exit 1
fi

AGE_KEY_FILE="${AGE_SECRET_KEY_PATH:-/etc/age/chrishop_backup.key}"
DB_NAME="${POSTGRES_DB:-chrishop_prod}"
DB_USER="${POSTGRES_USER:-chrishop}"

echo "[INFO] Downloading backup file ${BACKUP_FILE} from offsite R2 archive..."
aws --endpoint-url "${R2_ENDPOINT_URL}" s3 cp "s3://chrishop-backups/database/${BACKUP_FILE}" "/tmp/${BACKUP_FILE}"

echo "[INFO] Decrypting backup file with age..."
age -d -i "${AGE_KEY_FILE}" "/tmp/${BACKUP_FILE}" | gunzip > /tmp/restore_dump.sql

echo "[INFO] Restoring database dump to ${DB_NAME}..."
docker exec -i chrishop-postgres psql -U "${DB_USER}" -d "${DB_NAME}" < /tmp/restore_dump.sql

echo "[INFO] Cleaning up restore artifacts..."
rm -f "/tmp/${BACKUP_FILE}" /tmp/restore_dump.sql

echo "[SUCCESS] Database restoration complete!"
