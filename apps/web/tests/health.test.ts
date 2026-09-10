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
    assert.ok(body.timestamp, 'Response must include timestamp');

    // Verify timestamp is valid ISO string
    const date = new Date(body.timestamp);
    assert.ok(!isNaN(date.getTime()), 'Timestamp must be a valid ISO Date');
  });
});
