import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

describe('Production Docker Compose (docker-compose.prod.yml)', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const prodComposePath = path.join(repoRoot, 'infra/docker/docker-compose.prod.yml');

  it('should exist and parse as valid YAML', () => {
    assert.ok(fs.existsSync(prodComposePath), 'docker-compose.prod.yml must exist');
    const content = fs.readFileSync(prodComposePath, 'utf-8');
    const compose = parse(content);
    assert.ok(compose && typeof compose === 'object', 'Must parse into a valid object');
    assert.ok(compose.services, 'Must contain services block');
  });

  it('should define all 5 required production services', () => {
    const content = fs.readFileSync(prodComposePath, 'utf-8');
    const compose = parse(content);
    const serviceNames = Object.keys(compose.services);

    const requiredServices = ['postgres', 'redis', 'cms', 'web', 'caddy'];
    for (const s of requiredServices) {
      assert.ok(serviceNames.includes(s), `Service '${s}' must be defined in production compose`);
    }
  });

  it('should ensure internal services have NO host port mappings exposed', () => {
    const content = fs.readFileSync(prodComposePath, 'utf-8');
    const compose = parse(content);

    const internalServices = ['postgres', 'redis', 'cms', 'web'];
    for (const s of internalServices) {
      const service = compose.services[s];
      assert.ok(service, `Service '${s}' must exist`);
      assert.ok(
        !service.ports || service.ports.length === 0,
        `Service '${s}' must not expose any host ports`
      );
    }
  });

  it('should configure Caddy as the only service exposing edge ports (80 and 443)', () => {
    const content = fs.readFileSync(prodComposePath, 'utf-8');
    const compose = parse(content);
    const caddy = compose.services.caddy;

    assert.ok(caddy.ports && caddy.ports.length > 0, 'Caddy must expose ports');
    const portStrings = caddy.ports.map((p: any) => String(p));
    assert.ok(
      portStrings.some((p: string) => p.includes('80') && p.includes(':80')),
      'Caddy must map port 80'
    );
    assert.ok(
      portStrings.some((p: string) => p.includes('443') && p.includes(':443')),
      'Caddy must map port 443'
    );
  });

  it('should configure restart: unless-stopped on all services', () => {
    const content = fs.readFileSync(prodComposePath, 'utf-8');
    const compose = parse(content);

    for (const [name, service] of Object.entries<any>(compose.services)) {
      assert.equal(
        service.restart,
        'unless-stopped',
        `Service '${name}' must have restart: unless-stopped`
      );
    }
  });

  it('should configure Docker log rotation across all services (max-size 10m, max-file 3)', () => {
    const content = fs.readFileSync(prodComposePath, 'utf-8');
    const compose = parse(content);

    for (const [name, service] of Object.entries<any>(compose.services)) {
      assert.ok(service.logging, `Service '${name}' must define logging block`);
      assert.equal(
        service.logging.driver,
        'json-file',
        `Service '${name}' must use json-file driver`
      );
      assert.equal(
        service.logging.options['max-size'],
        '10m',
        `Service '${name}' max-size must be 10m`
      );
      assert.equal(
        String(service.logging.options['max-file']),
        '3',
        `Service '${name}' max-file must be 3`
      );
    }
  });

  it('should configure container health checks on all dependent services', () => {
    const content = fs.readFileSync(prodComposePath, 'utf-8');
    const compose = parse(content);

    const checkServices = ['postgres', 'redis', 'cms', 'web', 'caddy'];
    for (const s of checkServices) {
      const service = compose.services[s];
      assert.ok(service.healthcheck, `Service '${s}' must configure a healthcheck`);
      assert.ok(service.healthcheck.test, `Service '${s}' healthcheck must have test command`);
      assert.ok(service.healthcheck.interval, `Service '${s}' healthcheck must have interval`);
      assert.ok(service.healthcheck.timeout, `Service '${s}' healthcheck must have timeout`);
      assert.ok(service.healthcheck.retries, `Service '${s}' healthcheck must have retries`);
    }
  });

  it('should reference custom Caddy image built from infra/caddy/Dockerfile', () => {
    const content = fs.readFileSync(prodComposePath, 'utf-8');
    const compose = parse(content);
    const caddy = compose.services.caddy;

    assert.ok(caddy.build, 'Caddy must configure build context');
    const buildPath = typeof caddy.build === 'string' ? caddy.build : caddy.build.context;
    assert.ok(buildPath.includes('../caddy'), 'Caddy build path must reference ../caddy');
  });

  it('should configure network isolation with internal backend network', () => {
    const content = fs.readFileSync(prodComposePath, 'utf-8');
    const compose = parse(content);

    assert.ok(compose.networks, 'Compose must define networks');
    assert.ok(compose.networks.internal, 'Compose must define internal network');
    assert.ok(compose.networks.edge, 'Compose must define edge network');

    // Databases must only be on internal network
    assert.deepEqual(
      compose.services.postgres.networks,
      ['internal'],
      'Postgres must only be on internal network'
    );
    assert.deepEqual(
      compose.services.redis.networks,
      ['internal'],
      'Redis must only be on internal network'
    );

    // Caddy must be on edge network
    assert.ok(compose.services.caddy.networks.includes('edge'), 'Caddy must be on edge network');
    assert.ok(
      !compose.services.caddy.networks.includes('internal'),
      'Caddy must not be directly on internal database network'
    );
  });

  it('should parameterize all sensitive secrets with no hardcoded fallback credentials', () => {
    const content = fs.readFileSync(prodComposePath, 'utf-8');
    const compose = parse(content);

    const postgresPw = compose.services.postgres.environment.POSTGRES_PASSWORD;
    assert.equal(postgresPw, '${POSTGRES_PASSWORD}', 'POSTGRES_PASSWORD must be parameterized');

    const cmsKey = compose.services.cms.environment.KEY;
    assert.equal(cmsKey, '${KEY}', 'CMS KEY must be parameterized');

    const cmsSecret = compose.services.cms.environment.SECRET;
    assert.equal(cmsSecret, '${SECRET}', 'CMS SECRET must be parameterized');

    const stripeSecret = compose.services.web.environment.STRIPE_SECRET_KEY;
    assert.equal(stripeSecret, '${STRIPE_SECRET_KEY}', 'STRIPE_SECRET_KEY must be parameterized');

    const caddyToken = compose.services.caddy.environment.CLOUDFLARE_API_TOKEN;
    assert.equal(
      caddyToken,
      '${CLOUDFLARE_API_TOKEN}',
      'CLOUDFLARE_API_TOKEN must be parameterized'
    );

    // Assert that default dev secret strings are nowhere in production compose
    assert.ok(!content.includes('chrishop_dev_secret'), 'Must not contain chrishop_dev_secret');
    assert.ok(!content.includes('AdminPassword123!'), 'Must not contain dev admin password');
    assert.ok(!content.includes('chrishop-secret-key'), 'Must not contain dev secret key');
    assert.ok(!content.includes('chrishop-secret-jwt'), 'Must not contain dev JWT secret');
  });
});
