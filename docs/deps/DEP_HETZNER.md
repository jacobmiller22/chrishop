# Dependency Specification: Hetzner Cloud VPS (`DEP_HETZNER.md`)

This document specifies the integration, tooling, management scripts, and operational procedures for **Hetzner Cloud VPS**, which hosts the production and staging multi-container Docker stacks.

---

## 1. Service Overview & Provisioning Specs

- **Provider**: Hetzner Cloud (Falkenstein / Nuremberg datacenter location)
- **Staging Instance**: **CX22** (2 vCPU x86, 4 GB RAM, 40 GB NVMe, ~€3.29/mo)
- **Production Target**: **CPX21** (3 vCPU AMD EPYC, 4 GB RAM, 80 GB NVMe, ~€7.05/mo)
- **Host OS**: Ubuntu 24.04 LTS (64-bit)

---

## 2. Interaction Tools & Interfaces

- **Command Line Tool**: `hcloud` CLI (`brew install hcloud`)
- **Configuration Management**: Ansible (`ansible-playbook -i infra/vps/inventory.ini infra/vps/playbook.yml`)
- **Server Initialization**: Cloud-Init (`infra/vps/cloud-init.yaml`)
- **Web Console**: Hetzner Cloud Console UI (`https://console.hetzner.cloud`)

---

## 3. Configuration Files & Scripts

- `infra/vps/cloud-init.yaml` - Base OS bootstrap (creates `deploy` user, installs Docker Engine, docker-compose plugin, ufw, fail2ban).
- `infra/vps/playbook.yml` - Hardening & service configuration.
- `infra/vps/inventory.ini` - IP address inventory for Staging & Production VPS hosts.
- `infra/scripts/deps/hetzner_provision.sh` - CLI script creating Hetzner server via `hcloud server create`.

---

## 4. Control Operations & Health Checks

- **Server Health Check**: `hcloud server describe chrishop-prod`
- **SSH Access**: `ssh deploy@<vps-ip> -i ~/.ssh/chrishop_deploy_key`
- **UFW Firewall Status**: `sudo ufw status verbose` (Ports allowed: 80/tcp, 443/tcp, 22/tcp)
- **Docker Stack Health**: `docker compose -f infra/docker/docker-compose.prod.yml ps`
