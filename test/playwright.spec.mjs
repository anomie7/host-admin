/**
 * Warm Stay Host Admin — Playwright E2E Tests
 *
 * Usage:
 *   npm run test              # headless
 *   npm run test:headed       # visible browser
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4001';

async function closeSidePanel(page) {
  const closeBtn = page.locator('.side-panel-close');
  if (await closeBtn.isVisible()) await closeBtn.click();
  await page.waitForTimeout(300);
}

test.describe('Page Load & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await closeSidePanel(page);
  });

  test('loads the app and shows the dashboard title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('대시보드');
  });

  test('sidebar has 4 navigation links with aria-labels', async ({ page }) => {
    const links = page.locator('nav[aria-label="메인 내비게이션"] a');
    await expect(links).toHaveCount(4);
  });

  test('navigate to Properties', async ({ page }) => {
    await page.locator('a[aria-label="숙소"]').click();
    await expect(page).toHaveURL(/\/properties/);
    await expect(page.locator('h1')).toContainText('숙소 목록');
  });

  test('navigate to Calendar', async ({ page }) => {
    await page.locator('a[aria-label="캘린더"]').click();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.locator('h1')).toContainText('캘린더');
  });

  test('navigate to Canvas', async ({ page }) => {
    await page.locator('a[aria-label="캔버스"]').click();
    await expect(page).toHaveURL(/\/canvas/);
    await expect(page.locator('h1')).toContainText('캔버스');
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await closeSidePanel(page);
  });

  test('shows summary cards', async ({ page }) => {
    await page.waitForTimeout(1500);
    const cards = page.locator('.card-top');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Properties', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/properties`);
    await closeSidePanel(page);
  });

  test('shows at least 10 property cards', async ({ page }) => {
    await page.waitForTimeout(1500);
    const cards = page.locator('.card h3');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });
});

test.describe('Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await closeSidePanel(page);
  });

  test('shows day headers', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.locator('text=/^일$/')).toBeVisible();
    await expect(page.locator('text=/^토$/')).toBeVisible();
  });

  test('can navigate months', async ({ page }) => {
    await page.waitForTimeout(1500);
    const initialText = await page.locator('h2').textContent();
    await page.locator('button[aria-label="다음 달"]').click();
    await page.waitForTimeout(500);
    const newText = await page.locator('h2').textContent();
    expect(newText).not.toBe(initialText);
  });
});

test.describe('AI Side Panel', () => {
  test('side panel is open by default', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await expect(page.locator('.side-panel.side-panel--open')).toBeVisible();
  });

  test('welcome message visible', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await expect(page.locator('.chat-bubble--assistant .chat-bubble-content')).toContainText('Warm Stay');
    const suggestions = page.locator('.chat-suggestion-btn');
    const count = await suggestions.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('suggestion sends a message', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.locator('.chat-suggestion-btn').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('.chat-bubble--user')).toHaveCount(1);
  });

  test('session toggle works', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.locator('.chat-session-toggle').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.chat-session-dropdown')).toBeVisible();
    await page.locator('.chat-session-item--new').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.chat-bubble--assistant .chat-bubble-content')).toContainText('Warm Stay');
  });

  test('close button hides panel', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await page.locator('.side-panel-close').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.side-panel--open')).toHaveCount(0);
  });
});

test.describe('Canvas Multi-Session', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/canvas`);
    await closeSidePanel(page);
  });

  test('shows empty state', async ({ page }) => {
    await page.waitForTimeout(1000);
    await expect(page.locator('text=아직 캔버스가 비어있어요').or(page.locator('text=캔버스가 없어요'))).toBeVisible();
  });

  test('create new canvas session', async ({ page }) => {
    await page.waitForTimeout(500);
    await page.locator('button:has-text("🎨")').click();
    await page.waitForTimeout(300);
    await page.locator('text=✚ 새 캔버스').click();
    await page.waitForTimeout(300);
    await expect(page.locator('text=아직 캔버스가 비어있어요')).toBeVisible();
  });
});

test.describe('Mobile Responsive', () => {
  test.use({ viewport: { width: 480, height: 800 } });

  test('narrow sidebar', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const sidebar = page.locator('.sidebar');
    const width = await sidebar.evaluate(el => el.offsetWidth);
    expect(width).toBeLessThanOrEqual(60);
  });

  test('full width panel', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const panel = page.locator('.side-panel.side-panel--open');
    await expect(panel).toBeVisible();
    const width = await panel.evaluate(el => el.offsetWidth);
    expect(width).toBeGreaterThan(400);
  });
});

test.describe('API Data', () => {
  test('bookings API works', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/bookings?limit=5`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  test('properties API has 12', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/properties`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(12);
  });

  test('charts API returns 12 months', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/dashboard/charts`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.monthlyRevenue.length).toBe(12);
  });
});

test.describe('Property Tags', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/properties`);
    await closeSidePanel(page);
  });

  test('tags visible on cards', async ({ page }) => {
    await page.waitForTimeout(2000);
    const tagBadges = page.locator('span').filter({ hasText: /🏆|📈|💰|⭐/ });
    const count = await tagBadges.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('API returns tags for property', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/properties/3`);
    const data = await res.json();
    expect(Array.isArray(data.tags)).toBeTruthy();
    expect(data.tags.length).toBeGreaterThanOrEqual(1);
  });

  test('tags API add/remove', async ({ page }) => {
    const tag = 'test-tag-e2e';

    const addRes = await page.request.post(`${BASE}/api/properties/1/tags`, {
      headers: { 'Content-Type': 'application/json' },
      data: { tag },
    });
    const addData = await addRes.json();
    expect(addData.tags).toContain(tag);

    const delRes = await page.request.delete(`${BASE}/api/properties/1/tags`, {
      headers: { 'Content-Type': 'application/json' },
      data: { tag },
    });
    const delData = await delRes.json();
    expect(delData.tags).not.toContain(tag);
  });
});

test.describe('Booking Status Change', () => {
  test('update booking via API', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/bookings?limit=1`);
    const bookings = await res.json();
    expect(bookings.length).toBeGreaterThanOrEqual(1);

    const updateRes = await page.request.put(`${BASE}/api/bookings/${bookings[0].id}`, {
      headers: { 'Content-Type': 'application/json' },
      data: { notes: 'updated via test' },
    });
    const updated = await updateRes.json();
    expect(updated.notes).toBe('updated via test');
  });
});
