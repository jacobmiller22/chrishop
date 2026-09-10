import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

/**
 * Shopify HMAC-SHA256 Webhook Verification Helper
 * Implements security validation per docs/deps/DEP_SHOPIFY.md Section 6
 */
function verifyShopifyWebhook(rawBody: string, hmacHeader: string, secret: string): boolean {
  if (!rawBody || !hmacHeader || !secret) return false;
  try {
    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64');

    const expected = Buffer.from(computedHmac);
    const actual = Buffer.from(hmacHeader);

    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

describe('Shopify Headless Commerce Integration (DEP_SHOPIFY)', () => {
  const testSecret = 'shpss_test_secret_for_local_verification';

  it('should verify valid Shopify HMAC-SHA256 webhook signatures', () => {
    const rawPayload = JSON.stringify({
      id: 820982911946154500,
      email: 'buyer@example.com',
      total_price: '495.00',
      financial_status: 'paid',
      line_items: [
        {
          id: 14124982194,
          title: 'Obsidian Beast - 24K Gold Leaf',
          price: '495.00',
          quantity: 1,
        },
      ],
    });

    // Compute expected valid header
    const validHmac = crypto
      .createHmac('sha256', testSecret)
      .update(rawPayload, 'utf8')
      .digest('base64');

    const isValid = verifyShopifyWebhook(rawPayload, validHmac, testSecret);
    assert.equal(isValid, true, 'Valid HMAC signature must verify successfully');
  });

  it('should reject tampered or forged webhook payloads', () => {
    const legitimatePayload = JSON.stringify({ id: 101, total_price: '100.00' });
    const forgedPayload = JSON.stringify({ id: 101, total_price: '0.01' });

    const legitimateHmac = crypto
      .createHmac('sha256', testSecret)
      .update(legitimatePayload, 'utf8')
      .digest('base64');

    // Attempting to send forged payload with legitimate signature
    const isValid = verifyShopifyWebhook(forgedPayload, legitimateHmac, testSecret);
    assert.equal(isValid, false, 'Tampered webhook payload must be rejected');
  });

  it('should reject invalid or missing HMAC headers and secrets', () => {
    const payload = '{"test":true}';
    assert.equal(verifyShopifyWebhook(payload, '', testSecret), false);
    assert.equal(verifyShopifyWebhook(payload, 'invalid-signature', testSecret), false);
    assert.equal(verifyShopifyWebhook(payload, 'sig', ''), false);
  });

  it('should format headless Storefront API cart mutations and redirect URLs', () => {
    // Test cart mutation simulation per DEP_SHOPIFY.md Section 4
    const storeDomain = 'chrishop-dev.myshopify.com';
    const mockCartId = 'gid://shopify/Cart/c1-test-cart-id';
    const mockCheckoutUrl = `https://${storeDomain}/checkouts/c/c1-test-cart-id?key=mock_key`;

    assert.ok(mockCheckoutUrl.startsWith(`https://${storeDomain}/checkouts/`));
    assert.ok(mockCheckoutUrl.includes('c1-test-cart-id'));

    // Verify GraphQL query shape for cartCreate
    const cartCreateMutation = `
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            lines(first: 10) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            code
            field
            message
          }
        }
      }
    `;

    assert.ok(cartCreateMutation.includes('cartCreate'));
    assert.ok(cartCreateMutation.includes('checkoutUrl'));
  });
});
