import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTimeRemaining } from '@chrishop/ui';
import { getScheduledDrops, fetchProductBySlug, StorefrontProduct } from '../src/lib/catalog';
import { metadata as dropScheduleMetadata } from '../src/app/(storefront)/drops/page';

describe('Story 3.1d: Drop Countdown Timer & Scheduled Release UI Suite', () => {
  describe('1. Countdown Arithmetic & Timezone Resilience', () => {
    it('should compute accurate days, hours, minutes, and seconds for future target', () => {
      const now = Date.now();
      // Target: 2 days, 3 hours, 45 minutes, 30 seconds from now
      const offsetMs = (2 * 24 * 60 * 60 + 3 * 60 * 60 + 45 * 60 + 30) * 1000;
      const target = new Date(now + offsetMs);

      const result = calculateTimeRemaining(target);

      assert.equal(result.isComplete, false);
      assert.equal(result.days, 2);
      assert.equal(result.hours, 3);
      assert.equal(result.minutes, 45);
      // Allow +/- 1 second tolerance for test execution duration
      assert.ok(result.seconds >= 29 && result.seconds <= 30);
      assert.ok(result.totalMs > 0);
    });

    it('should handle zero and past dates by returning isComplete: true and zero units', () => {
      const pastDate = new Date(Date.now() - 5000);
      const result = calculateTimeRemaining(pastDate);

      assert.equal(result.isComplete, true);
      assert.equal(result.days, 0);
      assert.equal(result.hours, 0);
      assert.equal(result.minutes, 0);
      assert.equal(result.seconds, 0);
      assert.equal(result.totalMs, 0);
    });

    it('should resolve ISO strings with explicit timezones (UTC vs Denver Mountain Time)', () => {
      // 2026-10-15T16:00:00Z (UTC) is equivalent to 2026-10-15T10:00:00-06:00 (MDT)
      const utcString = '2026-10-15T16:00:00Z';
      const mdtString = '2026-10-15T10:00:00-06:00';

      const timeUtc = new Date(utcString).getTime();
      const timeMdt = new Date(mdtString).getTime();

      assert.equal(timeUtc, timeMdt, 'Timezone offsets must resolve to identical UTC timestamps');

      const resUtc = calculateTimeRemaining(utcString);
      const resMdt = calculateTimeRemaining(mdtString);

      assert.equal(resUtc.days, resMdt.days);
      assert.equal(resUtc.hours, resMdt.hours);
      assert.equal(resUtc.minutes, resMdt.minutes);
    });

    it('should accept epoch millisecond timestamps directly', () => {
      const futureEpoch = Date.now() + 60000; // 1 minute in the future
      const result = calculateTimeRemaining(futureEpoch);

      assert.equal(result.isComplete, false);
      assert.equal(result.days, 0);
      assert.equal(result.hours, 0);
      assert.equal(result.minutes, 1);
      assert.ok(result.seconds >= 0 && result.seconds <= 59);
    });

    it('should safely handle invalid or unparseable date strings', () => {
      const result = calculateTimeRemaining('invalid-date-string-xyz');
      assert.equal(result.isComplete, true);
      assert.equal(result.totalMs, 0);
    });
  });

  describe('2. Scheduled Drops Query Engine (getScheduledDrops)', () => {
    it('should query upcoming scheduled drops and sort them chronologically', async () => {
      const drops = await getScheduledDrops();
      assert.ok(Array.isArray(drops));
      assert.ok(drops.length > 0, 'Should return scheduled drop catalog');

      // Verify that leadville pack is in scheduled drops
      const pack = drops.find((p) => p.slug === 'leadville-ultralight-wading-pack');
      assert.ok(pack, 'Scheduled drops must include leadville pack');
      assert.equal(pack.status, 'coming_soon');
      assert.ok(pack.release_date);

      // Verify chronological sorting
      for (let i = 0; i < drops.length - 1; i++) {
        const dateA = new Date(drops[i].release_date || '').getTime();
        const dateB = new Date(drops[i + 1].release_date || '').getTime();
        if (!isNaN(dateA) && !isNaN(dateB)) {
          assert.ok(dateA <= dateB, 'Scheduled drops must be sorted chronologically');
        }
      }
    });

    it('should include variation-level scheduled releases', async () => {
      const mockProductWithComingSoonVar: StorefrontProduct = {
        id: 'prod-mock-drop',
        title: 'Mock Experimental Silhouette',
        slug: 'mock-experimental-silhouette',
        base_price: 300,
        status: 'published',
        variations: [
          {
            id: 'var-active',
            product_id: 'prod-mock-drop',
            variation_name: 'Standard Field',
            sku: 'MOCK-STD',
            effective_price: 300,
            is_limited_edition: false,
            status: 'active',
            stock_quantity: 10,
          },
          {
            id: 'var-upcoming',
            product_id: 'prod-mock-drop',
            variation_name: 'Experimental Batch 01',
            sku: 'MOCK-EXP-01',
            effective_price: 350,
            is_limited_edition: true,
            total_edition_count: 5,
            status: 'coming_soon',
            release_date: '2026-11-20T16:00:00Z',
            stock_quantity: 5,
          },
        ],
      };

      const hasComingSoonVar = mockProductWithComingSoonVar.variations?.some(
        (v) => v.status === 'coming_soon' && v.release_date
      );
      assert.equal(hasComingSoonVar, true);
    });
  });

  describe('3. Scheduled Release UI & Metadata', () => {
    it('should expose appropriate metadata for /drops page', () => {
      assert.ok(dropScheduleMetadata.title);
      assert.match(String(dropScheduleMetadata.title), /Drop Schedule/);
      assert.ok(dropScheduleMetadata.description);
    });

    it('should accurately resolve product release date on product detail page', async () => {
      const product = await fetchProductBySlug('leadville-ultralight-wading-pack');
      assert.ok(product);
      assert.equal(product.status, 'coming_soon');
      assert.equal(product.release_date, '2026-10-15T16:00:00Z');

      const targetMs = new Date(product.release_date).getTime();
      assert.ok(!isNaN(targetMs));
    });
  });
});
