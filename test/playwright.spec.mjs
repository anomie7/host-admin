/**
 * Warm Stay Host Admin — Playwright E2E Tests
 * Usage: npm run test
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4001';

test.describe('Page Load & Layout', () => {
  test('loads and shows dashboard title', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('h1')).toContainText('대시보드');
  });

  test('sidebar has 4 navigation links', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('nav[aria-label="메인 내비게이션"] a')).toHaveCount(4);
  });

  test('navigate to Properties', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('a[aria-label="숙소"]').click();
    await expect(page).toHaveURL(/\/properties/);
  });

  test('navigate to Calendar', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('a[aria-label="캘린더"]').click();
    await expect(page).toHaveURL(/\/calendar/);
  });

  test('navigate to Canvas', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('a[aria-label="캔버스"]').click();
    await expect(page).toHaveURL(/\/canvas/);
  });
});

test.describe('Side Panel (always visible)', () => {
  test('side panel is visible by default', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await expect(page.locator('.side-panel')).toBeVisible();
  });

  test('welcome message visible', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await expect(page.locator('.chat-bubble--assistant .chat-bubble-content')).toContainText('Warm Stay');
    const suggestions = page.locator('.chat-suggestion-btn');
    const count = await suggestions.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('sidebar links clickable with panel open (no overlay)', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    // Sidebar should be clickable even with panel open
    await page.locator('a[aria-label="캘린더"]').click();
    await expect(page).toHaveURL(/\/calendar/);
  });
});

test.describe('Dashboard', () => {
  test('shows summary cards', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1500);
    const cards = page.locator('.card-top');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Properties', () => {
  test('shows at least 10 property cards', async ({ page }) => {
    await page.goto(`${BASE}/properties`);
    await page.waitForTimeout(1500);
    const cards = page.locator('.card h3');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });
});

test.describe('Calendar', () => {
  test('shows day headers', async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await page.waitForTimeout(2000);
    await expect(page.locator('text=/^일$/')).toBeVisible();
    await expect(page.locator('text=/^토$/')).toBeVisible();
  });
});

test.describe('Canvas Multi-Session', () => {
  test('shows empty state', async ({ page }) => {
    await page.goto(`${BASE}/canvas`);
    await page.waitForTimeout(1000);
    await expect(page.locator('text=아직 캔버스가 비어있어요').or(page.locator('text=캔버스가 없어요'))).toBeVisible();
  });
});

test.describe('Mobile', () => {
  test.use({ viewport: { width: 480, height: 800 } });

  test('side panel exists on mobile', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await expect(page.locator('.side-panel')).toBeVisible();
  });
});

test.describe('API Data', () => {
  test('bookings API works', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/bookings?limit=5`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  test('properties = 12', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/properties`);
    const data = await res.json();
    expect(data.length).toBe(12);
  });
});

test.describe('Property Tags', () => {
  test('tags visible on cards', async ({ page }) => {
    await page.goto(`${BASE}/properties`);
    await page.waitForTimeout(2000);
    const tags = page.locator('span').filter({ hasText: /🏆|📈|💰|⭐/ });
    const count = await tags.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('tags API CRUD', async ({ page }) => {
    const tag = 'e2e-test';

    const addRes = await page.request.post(`${BASE}/api/properties/1/tags`, {
      headers: { 'Content-Type': 'application/json' },
      data: { tag },
    });
    expect((await addRes.json()).tags).toContain(tag);

    const delRes = await page.request.delete(`${BASE}/api/properties/1/tags`, {
      headers: { 'Content-Type': 'application/json' },
      data: { tag },
    });
    expect((await delRes.json()).tags).not.toContain(tag);
  });
});
