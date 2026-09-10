import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

describe('VPS Infrastructure-as-Code Integrity (Story 2.10)', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const infraVpsDir = path.join(repoRoot, 'infra/archive/vps');

  it('should have infra/vps/cloud-init.yaml with required bootstrap directives', () => {
    const cloudInitPath = path.join(infraVpsDir, 'cloud-init.yaml');
    assert.ok(fs.existsSync(cloudInitPath), 'cloud-init.yaml must exist in infra/vps/');

    const content = fs.readFileSync(cloudInitPath, 'utf-8');
    assert.ok(content.startsWith('#cloud-config'), 'cloud-init.yaml must begin with #cloud-config');

    const parsed = parse(content);
    assert.equal(parsed.timezone, 'Etc/UTC', 'Timezone must be configured as Etc/UTC');
    assert.ok(parsed.swap, 'Swap configuration must be present');
    assert.equal(parsed.swap.filename, '/swapfile');
    assert.equal(parsed.swap.size, 2147483648, 'Swap size must be 2GB');

    // Packages
    assert.ok(Array.isArray(parsed.packages), 'Packages list must exist');
    const requiredPkgs = ['ufw', 'fail2ban', 'git', 'jq', 'age', 'unattended-upgrades'];
    for (const pkg of requiredPkgs) {
      assert.ok(parsed.packages.includes(pkg), `Required package ${pkg} must be in packages`);
    }

    // Deploy user
    assert.ok(Array.isArray(parsed.users), 'Users list must exist');
    const deployUser = parsed.users.find((u: any) => u.name === 'deploy');
    assert.ok(deployUser, 'Deploy user must be specified');
    assert.ok(deployUser.groups.includes('docker'), 'Deploy user must be in docker group');
    assert.ok(deployUser.groups.includes('sudo'), 'Deploy user must be in sudo group');
    assert.ok(deployUser.ssh_import_id, 'Deploy user must configure ssh_import_id');
  });

  it('should have infra/vps/inventory.ini defining staging and production tiers', () => {
    const inventoryPath = path.join(infraVpsDir, 'inventory.ini');
    assert.ok(fs.existsSync(inventoryPath), 'inventory.ini must exist in infra/vps/');

    const content = fs.readFileSync(inventoryPath, 'utf-8');
    assert.ok(content.includes('[staging]'), 'Inventory must define [staging] group');
    assert.ok(content.includes('[production]'), 'Inventory must define [production] group');
    assert.ok(
      content.includes('[chrishop_servers:children]'),
      'Inventory must define [chrishop_servers:children]'
    );
    assert.ok(content.includes('server_tier=cx22'), 'Staging must reference Hetzner CX22 tier');
    assert.ok(
      content.includes('server_tier=cpx21'),
      'Production must reference Hetzner CPX21 tier'
    );
  });

  it('should have infra/vps/playbook.yml orchestrating modular roles', () => {
    const playbookPath = path.join(infraVpsDir, 'playbook.yml');
    assert.ok(fs.existsSync(playbookPath), 'playbook.yml must exist in infra/vps/');

    const parsed = parse(fs.readFileSync(playbookPath, 'utf-8'));
    assert.ok(Array.isArray(parsed), 'Playbook must be a list of plays');
    const play = parsed[0];
    assert.equal(play.hosts, 'chrishop_servers');
    assert.equal(play.become, true);

    const roleNames = play.roles.map((r: any) => r.role);
    const expectedRoles = ['common', 'docker', 'caddy', 'backup'];
    for (const role of expectedRoles) {
      assert.ok(roleNames.includes(role), `Playbook must include modular role '${role}'`);
    }
  });

  it('should have all 4 modular Ansible roles structured correctly', () => {
    const rolesDir = path.join(infraVpsDir, 'roles');
    const roles = ['common', 'docker', 'caddy', 'backup'];

    for (const role of roles) {
      const taskPath = path.join(rolesDir, role, 'tasks/main.yml');
      const defaultsPath = path.join(rolesDir, role, 'defaults/main.yml');
      assert.ok(fs.existsSync(taskPath), `Role '${role}' must contain tasks/main.yml`);
      assert.ok(fs.existsSync(defaultsPath), `Role '${role}' must contain defaults/main.yml`);

      // Verify task file is valid YAML
      const taskParsed = parse(fs.readFileSync(taskPath, 'utf-8'));
      assert.ok(Array.isArray(taskParsed), `Role '${role}' tasks/main.yml must parse to an array`);
    }
  });

  it('should have infra/vps/README.md with execution and runbook documentation', () => {
    const readmePath = path.join(infraVpsDir, 'README.md');
    assert.ok(fs.existsSync(readmePath), 'README.md must exist in infra/vps/');

    const content = fs.readFileSync(readmePath, 'utf-8');
    assert.ok(
      content.includes('hcloud server create'),
      'README must provide hcloud server create command'
    );
    assert.ok(
      content.includes('ansible-playbook'),
      'README must document ansible-playbook execution'
    );
    assert.ok(content.includes('ufw status verbose'), 'README must document firewall verification');
    assert.ok(content.includes('backup.sh'), 'README must document backup verification');
  });
});
