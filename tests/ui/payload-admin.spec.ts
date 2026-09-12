import { test, expect } from '@playwright/test';

test.describe('Payload CMS Admin Authentication & Accessibility', () => {


  test('1. Navigating to /admin redirects unauthenticated users to login or initial setup screen', async ({
    page,
  }) => {
    await page.goto('/admin');

    // Payload CMS redirects unauthenticated sessions to /admin/login or /admin/create-first-user
    await expect(page).toHaveURL(/\/admin(\/(login|create-first-user))?/);

    // Verify presence of Payload authentication form elements
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible();

    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toBeVisible();

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
  });

  test('2. Auth form accessibility attributes and labels', async ({ page }) => {
    await page.goto('/admin/login');

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible();

    // Verify email field attributes
    const emailType = await emailInput.getAttribute('type');
    expect(emailType).toBe('email');

    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toBeVisible();
    const passwordType = await passwordInput.getAttribute('type');
    expect(passwordType).toBe('password');

    // Verify submit button accessibility
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  test('3. Form validation triggers on empty or invalid credentials', async ({
    page,
  }) => {
    await page.goto('/admin/login');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    // Attempt submission with empty fields
    await submitBtn.click();

    // HTML5 or Payload validation should keep user on authentication screen
    await expect(page).toHaveURL(/\/admin\/(login|create-first-user)/);

    // Fill invalid email and verify input validation prevents submission
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await emailInput.fill('not-an-email');
    await submitBtn.click();

    // User remains on authentication screen
    await expect(page).toHaveURL(/\/admin\/(login|create-first-user)/);
  });
});
