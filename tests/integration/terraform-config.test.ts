import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { syncTerraformToWrangler } from '../../scripts/generate-wrangler-config';

describe('Story 4.12: Terraform Infrastructure as Code (IaC) Multi-Tier Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const terraformDir = path.join(rootDir, 'infra/terraform');
  const moduleDir = path.join(terraformDir, 'modules/cloudflare_stack');
  const envDir = path.join(terraformDir, 'environments');

  it('should verify root Terraform configuration and provider constraints', () => {
    const versionsPath = path.join(terraformDir, 'versions.tf');
    assert.ok(fs.existsSync(versionsPath), 'versions.tf must exist');
    const versions = fs.readFileSync(versionsPath, 'utf-8');
    assert.match(versions, /required_version\s*=\s*">= 1\.6\.0"/, 'Terraform version >= 1.6.0 required');
    assert.match(versions, /source\s*=\s*"cloudflare\/cloudflare"/, 'Cloudflare provider required');
    assert.match(versions, /version\s*=\s*"~> 4\.35"/, 'Cloudflare provider ~> 4.35 required');

    const backendPath = path.join(terraformDir, 'backend.tf');
    assert.ok(fs.existsSync(backendPath), 'backend.tf must exist');
    const backend = fs.readFileSync(backendPath, 'utf-8');
    assert.ok(backend.includes('backend "s3"'), 'S3 backend for Cloudflare R2 required');
    assert.ok(backend.includes('bucket                      = "chrishop-terraform-state"'), 'Dedicated state bucket required');
    assert.ok(backend.includes('skip_credentials_validation = true'), 'S3 compatibility options required');

    const mainPath = path.join(terraformDir, 'main.tf');
    assert.ok(fs.existsSync(mainPath), 'main.tf must exist');
    const main = fs.readFileSync(mainPath, 'utf-8');
    assert.ok(main.includes('module "stack"'), 'Must invoke cloudflare_stack module');

    const outputsPath = path.join(terraformDir, 'outputs.tf');
    assert.ok(fs.existsSync(outputsPath), 'outputs.tf must exist');
    const outputs = fs.readFileSync(outputsPath, 'utf-8');
    assert.ok(outputs.includes('output "d1_database_id"'), 'Must export d1_database_id');
    assert.ok(outputs.includes('output "kv_namespace_id"'), 'Must export kv_namespace_id');
    assert.ok(outputs.includes('output "r2_bucket_name"'), 'Must export r2_bucket_name');
    assert.ok(outputs.includes('output "storefront_url"'), 'Must export storefront_url');
  });

  it('should verify reusable cloudflare_stack module definitions', () => {
    const d1Path = path.join(moduleDir, 'd1.tf');
    assert.ok(fs.existsSync(d1Path), 'd1.tf must exist in module');
    const d1 = fs.readFileSync(d1Path, 'utf-8');
    assert.ok(d1.includes('resource "cloudflare_d1_database" "primary"'), 'Must define D1 database resource');
    assert.ok(d1.includes('name       = "chrishop-${var.environment}-db"'), 'D1 DB name must follow tier pattern');

    const kvPath = path.join(moduleDir, 'kv.tf');
    assert.ok(fs.existsSync(kvPath), 'kv.tf must exist in module');
    const kv = fs.readFileSync(kvPath, 'utf-8');
    assert.ok(kv.includes('resource "cloudflare_workers_kv_namespace" "cache"'), 'Must define KV cache namespace');

    const r2Path = path.join(moduleDir, 'r2.tf');
    assert.ok(fs.existsSync(r2Path), 'r2.tf must exist in module');
    const r2 = fs.readFileSync(r2Path, 'utf-8');
    assert.ok(r2.includes('resource "cloudflare_r2_bucket" "media"'), 'Must define R2 bucket resource');
    assert.ok(r2.includes('location   = "ENAM"'), 'Location must be ENAM');

    const dnsPath = path.join(moduleDir, 'dns.tf');
    assert.ok(fs.existsSync(dnsPath), 'dns.tf must exist in module');
    const dns = fs.readFileSync(dnsPath, 'utf-8');
    assert.ok(dns.includes('resource "cloudflare_record" "storefront"'), 'Must define DNS record');
    assert.ok(dns.includes('resource "cloudflare_workers_domain" "custom_domain"'), 'Must define custom worker domain');

    const secPath = path.join(moduleDir, 'security.tf');
    assert.ok(fs.existsSync(secPath), 'security.tf must exist in module');
    const sec = fs.readFileSync(secPath, 'utf-8');
    assert.ok(sec.includes('resource "cloudflare_turnstile_widget" "checkout"'), 'Must define Turnstile widget');
  });

  it('should verify production, staging, and preview environment configurations', () => {
    for (const env of ['production', 'staging', 'preview']) {
      const mainPath = path.join(envDir, env, 'main.tf');
      assert.ok(fs.existsSync(mainPath), `${env}/main.tf must exist`);
      const main = fs.readFileSync(mainPath, 'utf-8');
      assert.ok(main.includes(`key                         = "environments/${env}/terraform.tfstate"`), `${env} must declare dedicated state key`);
      assert.ok(main.includes('source = "../../modules/cloudflare_stack"'), `${env} must reference relative module`);

      const varPath = path.join(envDir, env, 'variables.tf');
      assert.ok(fs.existsSync(varPath), `${env}/variables.tf must exist`);

      const outPath = path.join(envDir, env, 'outputs.tf');
      assert.ok(fs.existsSync(outPath), `${env}/outputs.tf must exist`);
    }
  });

  it('should execute terraform fmt -check and terraform validate -no-color cleanly', () => {
    let hasTerraform = false;
    try {
      execSync('which terraform', { stdio: 'pipe' });
      hasTerraform = true;
    } catch {
      hasTerraform = false;
    }

    if (!hasTerraform) {
      console.log('Skipping CLI validation: terraform binary not in PATH');
      return;
    }

    // Check formatting
    const fmtResult = execSync('terraform fmt -recursive -check infra/terraform', { cwd: rootDir, encoding: 'utf-8' });
    assert.equal(fmtResult.trim(), '', 'All Terraform HCL files must be formatted cleanly');

    // Check root validation
    const validateRoot = execSync('cd infra/terraform && terraform validate -no-color', { cwd: rootDir, encoding: 'utf-8' });
    assert.ok(validateRoot.includes('Success! The configuration is valid.'), 'Root configuration must validate cleanly');

    // Check environments
    for (const env of ['production', 'staging', 'preview']) {
      const validateEnv = execSync(`cd infra/terraform/environments/${env} && terraform validate -no-color`, { cwd: rootDir, encoding: 'utf-8' });
      assert.ok(validateEnv.includes('Success! The configuration is valid.'), `environments/${env} must validate cleanly`);
    }
  });

  it('should verify generate-wrangler-config bridge script runs cleanly', () => {
    assert.doesNotThrow(() => {
      syncTerraformToWrangler({ env: 'staging', verify: true });
    }, 'Bridge script verification must pass');

    assert.doesNotThrow(() => {
      syncTerraformToWrangler({ env: 'staging', dryRun: true });
    }, 'Bridge script dry-run must pass');
  });

  it('should verify architectural migration specification exists in docs/analysis/', () => {
    const specPath = path.join(rootDir, 'docs/analysis/TERRAFORM_MIGRATION_SPEC.md');
    assert.ok(fs.existsSync(specPath), 'TERRAFORM_MIGRATION_SPEC.md must exist');
    const spec = fs.readFileSync(specPath, 'utf-8');
    assert.ok(spec.includes('Decoupled Hybrid Model'), 'Spec must describe Decoupled Hybrid Model');
    assert.ok(spec.includes('LocalStack'), 'Spec must address LocalStack comparison');
    assert.ok(spec.includes('Adversarial State Reconciliation'), 'Spec must define reconciliation protocol');
  });
});
