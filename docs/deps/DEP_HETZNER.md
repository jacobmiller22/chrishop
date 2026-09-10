# Dependency Specification: Hetzner Cloud VPS (`DEP_HETZNER.md`)

This document specifies the architecture, provisioning, OS hardening, network security, and operational runbooks for **Hetzner Cloud VPS**, which hosts the ChrisShop production, staging, and ephemeral preview infrastructure.

---

## 1. Service Overview & Hardware Specifications

- **Provider**: Hetzner Cloud GmbH
- **Primary Datacenter Location**: Falkenstein (`fsn1`) or Nuremberg (`nbg1`), Germany (or Ashburn `ash`, US for North American proximity)
- **Target Instance Tiers**:
  - **Staging**: **CX22** (2 vCPU Intel/AMD x86, 4 GB RAM, 40 GB NVMe SSD, 20 TB traffic, ~€3.29/mo)
  - **Production**: **CPX21** (3 vCPU AMD EPYC™, 4 GB RAM, 80 GB NVMe SSD, 20 TB traffic, ~€7.05/mo)
- **Host Operating System**: Ubuntu 24.04 LTS (Noble Numbat, 64-bit)
- **Network Isolation**: All internal database (PostgreSQL) and caching (Redis) services communicate strictly over private container bridge networks (`chrishop-internal`), with zero exposure on the public host interface.

---

## 2. Interaction Tools & Interfaces

- **Command-Line Interface**: `hcloud` CLI (`brew install hcloud` on macOS; `apt install hcloud-cli` on Linux)
- **Configuration Management**: Ansible (`ansible-playbook -i infra/vps/inventory.ini infra/vps/playbook.yml`)
- **Server Initialization**: Cloud-Init (`infra/vps/cloud-init.yaml`)
- **Web Console**: Hetzner Cloud Console (`https://console.hetzner.cloud`)

---

## 3. Server Provisioning Specification

### CLI Provisioning Command

Servers are provisioned using the official `hcloud` CLI with cloud-init metadata injected at boot time:

```bash
# Set authentication context
export HCLOUD_TOKEN="<your_hetzner_api_token>"
hcloud context create chrishop

# Provision Production VPS (CPX21)
hcloud server create \
  --name chrishop-prod \
  --type cpx21 \
  --image ubuntu-24.04 \
  --location fsn1 \
  --ssh-key ~/.ssh/chrishop_deploy_key.pub \
  --user-data-from-file infra/vps/cloud-init.yaml \
  --label env=production \
  --label app=chrishop

# Provision Staging VPS (CX22)
hcloud server create \
  --name chrishop-staging \
  --type cx22 \
  --image ubuntu-24.04 \
  --location fsn1 \
  --ssh-key ~/.ssh/chrishop_deploy_key.pub \
  --user-data-from-file infra/vps/cloud-init.yaml \
  --label env=staging \
  --label app=chrishop
```

### Reverse DNS (PTR) Setup

To ensure legitimate outbound email delivery and consistent TLS handshakes:

- Staging PTR: `staging.chrishop.com` or `staging.shop.jacobmiller22.com`
- Production PTR: `chrishop.com` or `shop.jacobmiller22.com`

Configured via CLI:

```bash
hcloud server set-rdns chrishop-prod --ip <SERVER_IPV4> --hostname shop.jacobmiller22.com
```

---

## 4. OS Hardening & Cloud-Init Bootstrap

Server initialization is fully automated via `infra/vps/cloud-init.yaml`.

### 4.1 Cloud-Init Bootstrap Specification

```yaml
#cloud-config
package_update: true
package_upgrade: true

packages:
  - apt-transport-https
  - ca-certificates
  - curl
  - gnupg
  - lsb-release
  - ufw
  - fail2ban
  - git
  - jq
  - age
  - unattended-upgrades
  - logrotate

users:
  - default
  - name: deploy
    gecos: ChrisShop Deploy User
    sudo: ALL=(ALL) NOPASSWD:ALL
    groups: [sudo, docker]
    shell: /bin/bash
    ssh_authorized_keys:
      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... deploy@chrishop.com

write_files:
  # SSH Daemon Hardening
  - path: /etc/ssh/sshd_config.d/99-hardening.conf
    permissions: '0600'
    owner: root:root
    content: |
      PermitRootLogin no
      PasswordAuthentication no
      PubkeyAuthentication yes
      X11Forwarding no
      MaxAuthTries 3
      AllowUsers deploy

  # Fail2ban SSH Protection
  - path: /etc/fail2ban/jail.d/sshd.local
    permissions: '0644'
    owner: root:root
    content: |
      [sshd]
      enabled = true
      port = 22
      filter = sshd
      logpath = /var/log/auth.log
      maxretry = 3
      bantime = 3600
      findtime = 600

  # Docker Daemon Log Rotation & Driver Defaults
  - path: /etc/docker/daemon.json
    permissions: '0644'
    owner: root:root
    content: |
      {
        "log-driver": "json-file",
        "log-opts": {
          "max-size": "10m",
          "max-file": "3"
        },
        "live-restore": true,
        "userland-proxy": false
      }

runcmd:
  # Install official Docker Engine
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  - chmod a+r /etc/apt/keyrings/docker.asc
  - echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
  - apt-get update
  - apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  # Enable and configure UFW
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow 22/tcp comment 'SSH'
  - ufw allow 80/tcp comment 'HTTP / ACME'
  - ufw allow 443/tcp comment 'HTTPS'
  - ufw allow 443/udp comment 'HTTP/3 QUIC'
  - ufw --force enable

  # Restart hardened services
  - systemctl restart ssh
  - systemctl enable fail2ban && systemctl restart fail2ban
  - systemctl enable docker && systemctl restart docker
  - usermod -aG docker deploy
```

### 4.2 UFW Firewall Port Matrix

| Port / Protocol | Direction | Source        | Service / Process | Rationale                                                                         |
| --------------- | --------- | ------------- | ----------------- | --------------------------------------------------------------------------------- |
| `22/tcp`        | Inbound   | Any / Bastion | OpenSSH           | Secure deployment & remote administrative access                                  |
| `80/tcp`        | Inbound   | Any           | Caddy             | Let's Encrypt HTTP-01 challenge & automatic HTTP ➔ HTTPS redirect                 |
| `443/tcp`       | Inbound   | Any           | Caddy             | Production & Staging HTTPS storefront traffic                                     |
| `443/udp`       | Inbound   | Any           | Caddy             | HTTP/3 (QUIC) low-latency mobile asset loading                                    |
| `5432/tcp`      | Internal  | Docker Bridge | PostgreSQL 16     | **BLOCKED from public interface**. Accessible only by `web` and `cms` containers. |
| `6379/tcp`      | Internal  | Docker Bridge | Redis 7 OSS       | **BLOCKED from public interface**. Accessible only by `web` and `cms` containers. |
| `8055/tcp`      | Internal  | Docker Bridge | Directus CMS      | Directus HTTP API; reverse-proxied via Caddy (`admin.chrishop.com`).              |
| `3000/tcp`      | Internal  | Docker Bridge | Next.js Web       | Storefront Node.js server; reverse-proxied via Caddy.                             |

---

## 5. Reconciled Configuration Files & Monorepo Paths

The following table clarifies the canonical path and implementation status for all Hetzner infrastructure assets:

| Path                                      | Status      | Scheduled Story | Description                                                   |
| ----------------------------------------- | ----------- | --------------- | ------------------------------------------------------------- |
| `infra/vps/cloud-init.yaml`               | `[PLANNED]` | Story 2.10      | Base OS bootstrap and hardening specification                 |
| `infra/vps/playbook.yml`                  | `[PLANNED]` | Story 2.10      | Ansible automation for system packages and docker maintenance |
| `infra/vps/inventory.ini`                 | `[PLANNED]` | Story 2.10      | Server IP inventory for Staging & Production VPS hosts        |
| `infra/scripts/deps/hetzner_provision.sh` | `[PLANNED]` | Story 2.12      | CLI wrapper script for automated VPS creation                 |
| `infra/docker/docker-compose.prod.yml`    | `[PLANNED]` | Story 2.8       | Production multi-container composition                        |
| `infra/docker/docker-compose.staging.yml` | `[PLANNED]` | Story 2.9       | Staging multi-container composition                           |
| `infra/docker/docker-compose.dev.yml`     | `[EXISTS]`  | Phase 1         | Local development container stack                             |

---

## 6. Control Operations, Monitoring & Disaster Runbooks

### 6.1 Server Health & Status Commands

```bash
# Verify VPS status in Hetzner Cloud API
hcloud server describe chrishop-prod

# Verify live resource metrics (CPU, disk, traffic)
hcloud server metrics chrishop-prod --type cpu

# SSH remote administration as deploy user
ssh deploy@<VPS_IP> -i ~/.ssh/chrishop_deploy_key

# Check firewall rules and active bans
sudo ufw status verbose
sudo fail2ban-client status sshd

# Inspect active Docker containers
docker compose -f infra/docker/docker-compose.prod.yml ps
```

### 6.2 Server Reboot & Rescue Mode

```bash
# Graceful ACPI reboot
hcloud server reboot chrishop-prod

# Hard reset (only if server is non-responsive)
hcloud server reset chrishop-prod

# Enable Rescue Mode (Debian-based RAM system for emergency maintenance)
hcloud server enable-rescue chrishop-prod --ssh-key ~/.ssh/chrishop_deploy_key.pub
hcloud server reboot chrishop-prod
```

### 6.3 Snapshot & Image Backup

Before major infrastructure or schema migrations:

```bash
hcloud server create-image chrishop-prod \
  --type snapshot \
  --description "pre-migration-snapshot-$(date +%Y%m%d%H%M)"
```
