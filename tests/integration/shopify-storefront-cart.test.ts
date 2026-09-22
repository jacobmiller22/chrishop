import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { shopify } from '../../apps/web/src/lib/shopify';
import { defaultShopifyMock } from '../../apps/web/src/lib/shopify-mock';
import {
  storefrontClient,
  createCart,
  getCart,
  addCartLines,
  updateCartLines,
  removeCartLines,
  updateBuyerIdentity,
  getOfficialStorefrontApiClient,
} from '../../apps/web/src/lib/shopify/storefront';
import { POST as cartCreatePost } from '../../apps/web/src/app/api/cart/create/route';
import { GET as cartGetHandler } from '../../apps/web/src/app/api/cart/[cartId]/route';
import { POST as cartLinesAddPost } from '../../apps/web/src/app/api/cart/lines/add/route';
import { POST as cartLinesUpdatePost } from '../../apps/web/src/app/api/cart/lines/update/route';
import { POST as cartLinesRemovePost } from '../../apps/web/src/app/api/cart/lines/remove/route';
import { POST as cartBuyerIdentityPost } from '../../apps/web/src/app/api/cart/buyer-identity/route';
import { TURNSTILE_TEST_TOKENS } from '../../apps/web/src/lib/turnstile';

describe('Story 3.2: Shopify Storefront API Cart & Checkout Integration', () => {
  beforeEach(() => {
    defaultShopifyMock.reset();
  });

  describe('1. Storefront Client Singleton & Official SDK Factory', () => {
    it('should export storefront client singleton and convenience cart methods', () => {
      assert.ok(storefrontClient, 'storefrontClient singleton must be exported');
      assert.equal(typeof createCart, 'function');
      assert.equal(typeof getCart, 'function');
      assert.equal(typeof addCartLines, 'function');
      assert.equal(typeof updateCartLines, 'function');
      assert.equal(typeof removeCartLines, 'function');
      assert.equal(typeof updateBuyerIdentity, 'function');
    });

    it('should initialize official @shopify/storefront-api-client instance', () => {
      const officialClient = getOfficialStorefrontApiClient({
        storeDomain: 'test-shop.myshopify.com',
        publicAccessToken: 'test_token',
      });
      assert.ok(officialClient, 'Official client instance must be created');
      assert.equal(typeof officialClient.request, 'function');
    });
  });

  describe('2. Headless Cart Lifecycle & Line Item Operations', () => {
    it('should create cart, assign checkout URL, and forward buyer IP', async () => {
      const buyerIp = '198.51.100.42';
      const variantId = 'gid://shopify/ProductVariant/201';

      const res = await createCart(variantId, 2, buyerIp);
      assert.ok(res.data?.cartCreate?.cart);
      const cart = res.data.cartCreate.cart;

      assert.ok(cart.id.startsWith('gid://shopify/Cart/'));
      assert.ok(cart.checkoutUrl.includes('/checkouts/c/'));
      assert.equal(cart.totalQuantity, 2);
      assert.equal(cart.lines.edges.length, 1);
      assert.equal(cart.lines.edges[0].node.quantity, 2);
      assert.equal(defaultShopifyMock.lastBuyerIp, buyerIp);
    });

    it('should append new line items to existing cart via cartLinesAdd', async () => {
      const createRes = await createCart('gid://shopify/ProductVariant/201', 1);
      const cartId = createRes.data.cartCreate.cart.id;

      const addRes = await addCartLines(cartId, [
        { merchandiseId: 'gid://shopify/ProductVariant/202', quantity: 2 },
      ]);
      assert.ok(addRes.data?.cartLinesAdd?.cart);
      const cart = addRes.data.cartLinesAdd.cart;

      assert.equal(cart.totalQuantity, 3);
      assert.equal(cart.lines.edges.length, 2);
    });

    it('should update line item quantities via cartLinesUpdate', async () => {
      const createRes = await createCart('gid://shopify/ProductVariant/201', 1);
      const cartId = createRes.data.cartCreate.cart.id;
      const lineId = createRes.data.cartCreate.cart.lines.edges[0].node.id;

      const updateRes = await updateCartLines(cartId, [{ id: lineId, quantity: 4 }]);
      assert.ok(updateRes.data?.cartLinesUpdate?.cart);
      const cart = updateRes.data.cartLinesUpdate.cart;

      assert.equal(cart.totalQuantity, 4);
      assert.equal(cart.lines.edges[0].node.quantity, 4);
    });

    it('should remove line items via cartLinesRemove', async () => {
      const createRes = await createCart('gid://shopify/ProductVariant/201', 1);
      const cartId = createRes.data.cartCreate.cart.id;

      const addRes = await addCartLines(cartId, [
        { merchandiseId: 'gid://shopify/ProductVariant/202', quantity: 1 },
      ]);
      const lineToRemove = addRes.data.cartLinesAdd.cart.lines.edges[0].node.id;

      const removeRes = await removeCartLines(cartId, [lineToRemove]);
      assert.ok(removeRes.data?.cartLinesRemove?.cart);
      const cart = removeRes.data.cartLinesRemove.cart;

      assert.equal(cart.lines.edges.length, 1);
      assert.equal(cart.totalQuantity, 1);
    });

    it('should preserve customer locale and currency via cartBuyerIdentityUpdate', async () => {
      const createRes = await createCart('gid://shopify/ProductVariant/201', 1);
      const cartId = createRes.data.cartCreate.cart.id;

      const identityRes = await updateBuyerIdentity(cartId, {
        email: 'customer@example.com',
        countryCode: 'CA',
      });

      assert.ok(identityRes.data?.cartBuyerIdentityUpdate?.cart);
      const cart = identityRes.data.cartBuyerIdentityUpdate.cart;
      assert.ok(
        cart.checkoutUrl.includes('locale=ca'),
        'Checkout URL must preserve country code/locale parameter'
      );
    });
  });

  describe('3. Edge Cart API Endpoints (/api/cart/*)', () => {
    it('POST /api/cart/create should create cart and forward buyer IP', async () => {
      const req = new NextRequest('http://localhost:3000/api/cart/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '203.0.113.15',
        },
        body: JSON.stringify({
          variantId: 'gid://shopify/ProductVariant/201',
          quantity: 1,
          turnstileToken: TURNSTILE_TEST_TOKENS.ALWAYS_PASSES,
        }),
      });

      const res = await cartCreatePost(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.cart.id);
      assert.ok(body.cart.checkoutUrl);
      assert.equal(body.forwardedBuyerIp, '203.0.113.15');
    });

    it('GET /api/cart/[cartId] should retrieve cart state', async () => {
      const createRes = await createCart('gid://shopify/ProductVariant/201', 1);
      const cartId = createRes.data.cartCreate.cart.id;

      const req = new NextRequest(`http://localhost:3000/api/cart/${encodeURIComponent(cartId)}`, {
        method: 'GET',
        headers: { 'cf-connecting-ip': '203.0.113.16' },
      });

      const res = await cartGetHandler(req, {
        params: Promise.resolve({ cartId: encodeURIComponent(cartId) }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.cart.id, cartId);
    });

    it('POST /api/cart/lines/add should append lines to cart', async () => {
      const createRes = await createCart('gid://shopify/ProductVariant/201', 1);
      const cartId = createRes.data.cartCreate.cart.id;

      const req = new NextRequest('http://localhost:3000/api/cart/lines/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId,
          variantId: 'gid://shopify/ProductVariant/202',
          quantity: 2,
        }),
      });

      const res = await cartLinesAddPost(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.cart.totalQuantity, 3);
    });

    it('POST /api/cart/lines/update should modify quantity of existing line', async () => {
      const createRes = await createCart('gid://shopify/ProductVariant/201', 1);
      const cartId = createRes.data.cartCreate.cart.id;
      const lineId = createRes.data.cartCreate.cart.lines.edges[0].node.id;

      const req = new NextRequest('http://localhost:3000/api/cart/lines/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId,
          lineId,
          quantity: 5,
        }),
      });

      const res = await cartLinesUpdatePost(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.cart.totalQuantity, 5);
    });

    it('POST /api/cart/lines/remove should remove line from cart', async () => {
      const createRes = await createCart('gid://shopify/ProductVariant/201', 1);
      const cartId = createRes.data.cartCreate.cart.id;

      const addRes = await addCartLines(cartId, [
        { merchandiseId: 'gid://shopify/ProductVariant/202', quantity: 1 },
      ]);
      const lineId = addRes.data.cartLinesAdd.cart.lines.edges[0].node.id;

      const req = new NextRequest('http://localhost:3000/api/cart/lines/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId,
          lineId,
        }),
      });

      const res = await cartLinesRemovePost(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.cart.totalQuantity, 1);
    });

    it('POST /api/cart/buyer-identity should update email and country code', async () => {
      const createRes = await createCart('gid://shopify/ProductVariant/201', 1);
      const cartId = createRes.data.cartCreate.cart.id;

      const req = new NextRequest('http://localhost:3000/api/cart/buyer-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId,
          buyerIdentity: {
            email: 'angler@example.com',
            countryCode: 'GB',
          },
        }),
      });

      const res = await cartBuyerIdentityPost(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.cart.checkoutUrl.includes('locale=gb'));
    });
  });

  describe('4. Inventory Stock Checks & Out-of-Stock User Errors', () => {
    it('should reject cart creation when requesting quantity exceeding inventory', async () => {
      defaultShopifyMock.setVariantStock('gid://shopify/ProductVariant/201', 2);

      const res = await createCart('gid://shopify/ProductVariant/201', 5);
      assert.equal(res.data.cartCreate.cart, null);
      assert.ok(res.data.cartCreate.userErrors.length > 0);
      assert.equal(res.data.cartCreate.userErrors[0].code, 'OUT_OF_STOCK');
    });

    it('should reject cartLinesAdd when variant is completely sold out', async () => {
      defaultShopifyMock.setVariantSoldOut('gid://shopify/ProductVariant/202');
      const createRes = await createCart('gid://shopify/ProductVariant/201', 1);
      const cartId = createRes.data.cartCreate.cart.id;

      const addRes = await addCartLines(cartId, [
        { merchandiseId: 'gid://shopify/ProductVariant/202', quantity: 1 },
      ]);
      assert.equal(addRes.data.cartLinesAdd.cart, null);
      assert.equal(addRes.data.cartLinesAdd.userErrors[0].code, 'OUT_OF_STOCK');
    });
  });
});
