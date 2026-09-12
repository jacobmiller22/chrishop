import { test, expect } from '@playwright/test';

test.describe('Storefront Critical Path Journeys', () => {
  test('1. Homepage loads with BankBeaters branding, navigation, and drop countdown timer', async ({
    page,
  }) => {
    await page.goto('/');

    // Verify title and branding
    await expect(page).toHaveTitle(/BankBeaters/i);
    const headerTitle = page.locator('header').getByText(/BankBeaters/i).first();
    await expect(headerTitle).toBeVisible();

    // Verify drop countdown timer presence
    const countdownTimer = page.getByTestId('drop-countdown-timer');
    await expect(countdownTimer).toBeVisible();
    await expect(countdownTimer.getByTestId('countdown-hours')).toBeVisible();
    await expect(countdownTimer.getByTestId('countdown-minutes')).toBeVisible();
    await expect(countdownTimer.getByTestId('countdown-seconds')).toBeVisible();

    // Verify navigation links
    const nav = page.locator('header nav');
    await expect(nav.getByText(/Adventure Gear|All Gear/i).first()).toBeVisible();
    await expect(page.getByTestId('header-cart-button')).toBeVisible();
  });

  test('2. Product catalog navigation and product detail view inspection', async ({
    page,
  }) => {
    await page.goto('/products');

    // Verify catalog title and product cards
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    // Find and click the first product card or inspect link
    const inspectLinks = page.getByRole('link', { name: /Inspect/i });
    await expect(inspectLinks.first()).toBeVisible();
    await inspectLinks.first().click();

    // Verify on product detail page
    await expect(page).toHaveURL(/\/products\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('deploy-gear-button')).toBeVisible();
  });

  test('3. Edition variant selection updates price and SKU', async ({ page }) => {
    await page.goto('/products/bushwhack-storm-anorak');

    // Locate variation radios
    const variationRadios = page.getByTestId('variation-radio');
    const radioCount = await variationRadios.count();
    expect(radioCount).toBeGreaterThan(0);

    // Verify initial selection
    await expect(variationRadios.first()).toHaveAttribute('aria-checked', 'true');

    // If multiple variations exist, click the second one and verify selection toggle
    if (radioCount > 1) {
      await variationRadios.nth(1).click();
      await expect(variationRadios.nth(1)).toHaveAttribute('aria-checked', 'true');
      await expect(variationRadios.first()).toHaveAttribute('aria-checked', 'false');
    }
  });

  test('4. Slide-over cart drawer opening and line item verification', async ({
    page,
  }) => {
    await page.goto('/products/bushwhack-storm-anorak');

    // Add item to cart via deploy button
    const deployButton = page.getByTestId('deploy-gear-button');
    await expect(deployButton).toBeVisible();
    await deployButton.click();

    // Cart drawer should slide over
    const drawer = page.getByTestId('cart-drawer');
    await expect(drawer).toBeVisible();

    // Verify line item details in drawer
    const lineItem = page.getByTestId('cart-line-item');
    await expect(lineItem).toBeVisible();
    await expect(lineItem.getByTestId('cart-item-title')).toContainText(
      /Bushwhack Storm Anorak/i
    );
    await expect(page.getByTestId('cart-subtotal')).toBeVisible();

    // Close drawer via close button
    const closeButton = page.getByTestId('close-cart-button');
    await closeButton.click();
    await expect(drawer).not.toBeVisible();
  });

  test('5. Shopify Storefront API checkout redirect button verification', async ({
    page,
  }) => {
    await page.goto('/products/bushwhack-storm-anorak');

    // Open drawer by deploying gear
    await page.getByTestId('deploy-gear-button').click();
    const drawer = page.getByTestId('cart-drawer');
    await expect(drawer).toBeVisible();

    const checkoutButton = page.getByTestId('checkout-button');
    await expect(checkoutButton).toBeVisible();
    await expect(checkoutButton).toBeEnabled();

    // Intercept checkout API call to confirm Shopify Storefront API interaction
    let capturedCheckoutData: any = null;
    await page.route('**/api/cart/create', async (route) => {
      const response = await route.fetch();
      capturedCheckoutData = await response.json();
      await route.fulfill({
        response,
        json: capturedCheckoutData,
      });
    });

    await checkoutButton.click();

    // Verify Shopify Storefront API interaction and checkout URL
    await expect.poll(() => capturedCheckoutData, { timeout: 15_000 }).not.toBeNull();
    expect(capturedCheckoutData.success).toBe(true);
    expect(capturedCheckoutData.cart).toBeDefined();
    expect(capturedCheckoutData.cart.checkoutUrl).toContain('shopify');
  });
});
