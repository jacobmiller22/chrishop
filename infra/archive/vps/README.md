# ChrisShop Hetzner VPS Infrastructure Automation

This directory contains infrastructure-as-code (IaC) configuration for bootstrapping, hardening, and orchestrating the **Hetzner Cloud VPS** hosts serving the ChrisShop platform.

- **Staging VPS**: Hetzner **CX22** (2 vCPU x86, 4 GB RAM, 40 GB NVMe SSD)
- **Production VPS**: Hetzner **CPX21** (3 vCPU AMD EPYC, 4 GB RAM, 80 GB NVMe SSD)
- **Operating System**: Ubuntu 24.04 LTS (Noble Numbat, 64-bit)
- **Architecture Specifications**: [`DEP_HETZNER.md`](../../docs/deps/DEP_HETZNER.md) & [`HIGH_LEVEL_DESIGN.md`](../../docs/HIGH_LEVEL_DESIGN.md) Section 7.

---

## Directory Structure

```text
infra/vps/
├── README.md                      # Operational guide & runbooks (this document)
├── cloud-init.yaml                # Initial bootstrap & OS hardening configuration
├── inventory.ini                  # Staging and production host inventory template
├── playbook.yml                   # Top-level Ansible orchestration playbook
├── requirements.yml               # Required Ansible Galaxy collections
└── roles/
    ├── common/                    # Base OS hardening, swap, timezone, UFW, fail2ban
    │   ├── defaults/main.yml
    │   ├── handlers/main.yml
    │   └── tasks/main.yml
    ├── docker/                    # Docker Engine, daemon log rotation, internal bridge network
    │   ├── defaults/main.yml
    │   ├── handlers/main.yml
    │   └── tasks/main.yml
    ├── caddy/                     # Caddy edge proxy runner & systemd orchestration
    │   ├── defaults/main.yml
    │   ├── handlers/main.yml
    │   ├── tasks/main.yml
    │   └── templates/
    │       ├── Caddyfile.j2
    │       └── caddy-runner.service.j2
    └── backup/                    # Offsite database backup cron & disaster recovery restore
        ├── defaults/main.yml
        ├── tasks/main.yml
        └── templates/
            ├── backup.env.j2
            └── logrotate-backup.j2
```

---

## 1. Prerequisites & Tooling

Ensure the following tools are installed on your workstation or CI/CD runner:

1. **Hetzner Cloud CLI (`hcloud`)**:

   ```bash
   # macOS
   brew install hcloud

   # Linux
   apt-get install -y hcloud-cli
   ```

2. **Ansible & Python Dependencies**:

   ```bash
   python3 -m pip install "ansible-core>=2.15.0" pyyaml
   ```

3. **Install Required Ansible Galaxy Collections**:

   ```bash
   ansible-galaxy collection install -r infra/vps/requirements.yml
   ```

4. **SSH Keypair**:
   Ensure you have generated the deployment keypair:
   ```bash
   ssh-keygen -t ed25519 -C "deploy@chrishop.com" -f ~/.ssh/chrishop_deploy_key
   ```

---

## 2. Server Provisioning via `cloud-init.yaml`

Servers are created using the Hetzner Cloud API (`hcloud` CLI) with [`cloud-init.yaml`](cloud-init.yaml) passed via user-data:

```bash
# Authenticate context
export HCLOUD_TOKEN="<your_hetzner_api_token>"
hcloud context create chrishop

# Provision Staging VPS (CX22 in Falkenstein)
hcloud server create \
  --name chrishop-staging \
  --type cx22 \
  --image ubuntu-24.04 \
  --location fsn1 \
  --ssh-key ~/.ssh/chrishop_deploy_key.pub \
  --user-data-from-file infra/vps/cloud-init.yaml \
  --label env=staging \
  --label app=chrishop

# Provision Production VPS (CPX21 in Falkenstein)
hcloud server create \
  --name chrishop-prod \
  --type cpx21 \
  --image ubuntu-24.04 \
  --location fsn1 \
  --ssh-key ~/.ssh/chrishop_deploy_key.pub \
  --user-data-from-file infra/vps/cloud-init.yaml \
  --label env=production \
  --label app=chrishop
```

### Reverse DNS (PTR) Setup

Configure PTR records for legitimate outbound traffic:

```bash
# Staging PTR
hcloud server set-rdns chrishop-staging --ip <STAGING_IPV4> --hostname staging.shop.jacobmiller22.com

# Production PTR
hcloud server set-rdns chrishop-prod --ip <PROD_IPV4> --hostname shop.jacobmiller22.com
```

---

## 3. Host Inventory Configuration

Update [`inventory.ini`](inventory.ini) with the public IPv4 addresses assigned by Hetzner:

```ini
[staging]
chrishop-staging ansible_host=staging.shop.jacobmiller22.com server_tier=cx22 env=staging

[production]
chrishop-prod ansible_host=shop.jacobmiller22.com server_tier=cpx21 env=production
```

Test SSH connectivity across all inventory hosts:

```bash
ansible chrishop_servers -i infra/vps/inventory.ini -m ping
```

---

## 4. Ansible Playbook Execution

### Dry-Run Syntax Verification

Validate playbook and role syntax without connecting to hosts:

```bash
ansible-playbook -i infra/vps/inventory.ini infra/vps/playbook.yml --syntax-check
```

### Full Configuration Run

Apply the complete configuration across staging and production hosts:

```bash
ansible-playbook -i infra/vps/inventory.ini infra/vps/playbook.yml
```

### Targeted Execution

Run against a specific environment or role tag:

```bash
# Target Staging only
ansible-playbook -i infra/vps/inventory.ini infra/vps/playbook.yml --limit staging

# Target only Docker Engine and private bridge network setup
ansible-playbook -i infra/vps/inventory.ini infra/vps/playbook.yml --tags docker

# Target only Caddy proxy runner
ansible-playbook -i infra/vps/inventory.ini infra/vps/playbook.yml --tags caddy

# Target only Backup cron and scripts
ansible-playbook -i infra/vps/inventory.ini infra/vps/playbook.yml --tags backup
```

---

## 5. Post-Provisioning Verification & Health Checks

Execute the following commands on the remote VPS as `deploy` user to confirm proper operation:

### 1. Verify UFW Firewall

```bash
sudo ufw status verbose
```

Expected output:

- Status: `active`
- Allowed ports: `22/tcp` (SSH), `80/tcp` (HTTP), `443/tcp` (HTTPS), `443/udp` (QUIC)
- Default incoming: `deny`, default outgoing: `allow`

### 2. Verify Docker Engine & Daemon Presets

```bash
docker info
cat /etc/docker/daemon.json
docker network inspect chrishop-internal
```

Confirm:

- `log-driver: json-file` with `max-size: 10m` and `max-file: 3`
- `live-restore: true`
- Bridge network `chrishop-internal` exists

### 3. Verify Caddy Systemd Runner

```bash
systemctl status caddy-runner
docker ps | grep chrishop-caddy
```

### 4. Verify Automated Offsite Backup Cron

```bash
sudo crontab -l | grep chrishop
```

Confirm the daily 03:00 UTC schedule invoking `/opt/chrishop/scripts/backup.sh`.

---

## 6. Disaster Recovery & Manual Restores

To trigger an emergency backup immediately:

```bash
sudo /opt/chrishop/scripts/backup.sh
```

To restore a specific database archive:

```bash
sudo /opt/chrishop/scripts/restore.sh db_chrishop_prod_20260910_030000.sql.gz.age
```
