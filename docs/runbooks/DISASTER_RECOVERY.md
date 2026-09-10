# Operational Runbook: Disaster Recovery (`DISASTER_RECOVERY.md`)

This runbook documents step-by-step procedures for recovering the **ChrisShop** platform following a host hardware failure, server outage, database corruption, or ransomware compromise.

---

## 1. Service Level Objectives (SLOs)

- **Recovery Point Objective (RPO)**: **< 24 Hours** (Maximum data loss capped by daily automated backups at 02:00 UTC).
- **Recovery Time Objective (RTO)**: **< 15 Minutes** (Complete environment rebuild and database restoration from offsite encrypted archive).

---

## 2. Emergency Recovery Steps

### Step 1: Provision Replacement VPS Host
If the original Hetzner VPS host is unreachable or destroyed, provision a new Hetzner CPX21 server:

```bash
# Provision new VPS host
hcloud server create --name chrishop-prod-recovery --type cpx21 --image ubuntu-24.04 --ssh-key deploy_key
```

### Step 2: Run Ansible OS Hardening & Docker Stack Setup
Apply host OS hardening and initialize container directories:

```bash
ansible-playbook -i infra/vps/inventory.ini infra/vps/playbook.yml
```

### Step 3: Fetch Master Age Decryption Key
Retrieve the master `age` decryption key from GitHub Encrypted Secrets or offsite password manager:

```bash
mkdir -p /etc/age
echo "${AGE_SECRET_KEY}" > /etc/age/chrishop_backup.key
chmod 600 /etc/age/chrishop_backup.key
```

### Step 4: Run Restore Script
List available backups in offsite R2 archive and execute system restoration:

```bash
# List available backups
aws --endpoint-url https://... s3 ls s3://chrishop-backups/database/

# Execute restoration
./infra/scripts/restore.sh db_chrishop_prod_20260909_020000.sql.gz.age
```

### Step 5: Start Container Stack & Verify Health Check
Start production containers and verify `/api/health`:

```bash
docker compose -f infra/docker/docker-compose.prod.yml up -d

# Verify health endpoint
curl -f https://chrishop.com/api/health
```

---

## 3. Post-Recovery Checklist

1. Verify storefront product catalog loads cleanly (`https://chrishop.com`).
2. Verify Directus Admin UI login with 2FA (`https://admin.chrishop.com`).
3. Verify Redis connection and stock reservation key expiry (`redis-cli ping`).
4. Trigger test Discord alert to confirm `#dev-alerts` communication channel.
