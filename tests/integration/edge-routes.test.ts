import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../../apps/web/src/app/api/health/route';

describe('Edge API Routes Integration', () => {
  it('should return 200 OK and healthy status payload from /api/health', async () => {
    const response = await GET();
    assert.equal(response.status, 200, 'Status must be 200 OK');

    const body = await response.json();
    assert.equal(body.status, 'healthy');
    assert.equal(body.service, '@chrishop/web');
    assert.ok(body.timestamp, 'Response must include timestamp');

    const timestamp = new Date(body.timestamp);
    assert.ok(!isNaN(timestamp.getTime()), 'Timestamp must be valid ISO Date');
  });
});
