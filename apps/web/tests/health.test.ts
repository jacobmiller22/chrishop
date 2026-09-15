import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../src/app/api/health/route';

describe('Storefront Health API Route (/api/health)', () => {
  it('should return HTTP 200 and healthy status payload', async () => {
    const response = await GET();
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.status, 'healthy');
    assert.equal(body.service, '@chrishop/web');
    assert.equal(body.runtime, 'cloudflare-workers');
    assert.ok(body.timestamp, 'Response must include timestamp');
    assert.ok(body.bindings, 'Response must include bindings object');

    // Verify timestamp is valid ISO string
    const date = new Date(body.timestamp);
    assert.ok(!isNaN(date.getTime()), 'Timestamp must be a valid ISO Date');
  });

  it('should report all 6 bindings active when configured in environment', async () => {
    const originalEnv = { ...process.env };
    try {
      process.env.DB = 'mock-d1-db';
      process.env.NEXT_CACHE_WORKERS_KV = 'mock-kv';
      process.env.BUCKET = 'mock-r2-bucket';
      process.env.ASSETS = 'mock-assets';
      process.env.SITE_URL = 'https://chrishop.jacobmiller22.com';
      process.env.CMS_URL = 'https://chrishop.jacobmiller22.com';

      const response = await GET();
      const body = await response.json();

      assert.equal(body.status, 'healthy');
      assert.equal(body.bindings.d1, true, 'd1 binding must be online');
      assert.equal(body.bindings.kv, true, 'kv binding must be online');
      assert.equal(body.bindings.r2, true, 'r2 binding must be online');
      assert.equal(body.bindings.assets, true, 'assets binding must be online');
      assert.equal(body.bindings.site, true, 'site binding must be online');
      assert.equal(body.bindings.cms, true, 'cms binding must be online');
    } finally {
      process.env = originalEnv;
    }
  });
});
