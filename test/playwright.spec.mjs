/**
 * Warm Stay Host Admin — Playwright E2E Tests
 *
 * Usage:
 *   npm run test              # headless
 *   npm run test:headed       # visible browser
 *
 * Prerequisites:
 *   - Server running on http://localhost:4001 (or let playwright start it)
 *   - DB seeded (npm run seed)
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4001';

// Helper: close side panel overlay so it doesn't block clicks
async function closeSidePanel(page) {
  const closeBtn = page.locator('.side-panel-close');
  if (await closeBtn.isVisible()) await closeBtn.click();
  await page.waitForTimeout(300);
}

// ──────────────────────────────────────────────
// 1. Page Load & Core Layout
// ──────────────────────────────────────────────

test.describe('Page Load & Layout', () => {
  test('loads the app and shows the dashboard title', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('h1')).toContainText('대시보드');
  });

  test('sidebar has 4 navigation links with aria-labels', async ({ page }) => {
    await page.goto(BASE);
    await closeSidePanel(page);
    const links = page.locator('nav[aria-label="메인 내비게이션"] a');
    await expect(links).toHaveCount(4);
  });

  test('sidebar: navigate to Properties', async ({ page }) => {
    await page.goto(BASE);
    await closeSidePanel(page);
    await page.locator('a[aria-label="숙소"]').click();
    await expect(page).toHaveURL(/\/properties/);
    await expect(page.locator('h1')).toContainText('숙소 목록');
  });

  test('sidebar: navigate to Calendar', async ({ page }) => {
    await page.goto(BASE);
    await closeSidePanel(page);
    await page.locator('a[aria-label="캘린더"]').click();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.locator('h1')).toContainText('캘린더');
  });

  test('sidebar: navigate to Canvas', async ({ page }) => {
    await page.goto(BASE);
    await closeSidePanel(page);
    await page.locator('a[aria-label="캔버스"]').click();
    await expect(page).toHaveURL(/\/canvas/);
    await expect(page.locator('h1')).toContainText('캔버스');
  });
});

// ──────────────────────────────────────────────
// 2. Dashboard
// ──────────────────────────────────────────────

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await closeSidePanel(page);
  });

  test('shows summary cards (revenue, occupancy, etc)', async ({ page }) => {
    await page.waitForTimeout(1500);
    const cards = page.locator('.card-top');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// ──────────────────────────────────────────────
// 3. Properties List
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// 4. Calendar
// ──────────────────────────────────────────────

test.describe('Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await closeSidePanel(page);
  });

  test('shows calendar grid with day headers', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Use exact match to avoid conflicting with suggestion button text
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

// ──────────────────────────────────────────────
// 5. AI Side Panel
// ──────────────────────────────────────────────

test.describe('AI Side Panel', () => {
  test('side panel is open by default', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await expect(page.locator('.side-panel.side-panel--open')).toBeVisible();
  });

  test('welcome message and suggestion buttons visible', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    // Check assistant message bubble content (not the header span)
    await expect(page.locator('.chat-bubble--assistant .chat-bubble-content')).toContainText('Warm Stay');
    const suggestions = page.locator('.chat-suggestion-btn');
    const count = await suggestions.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('clicking suggestion sends a message', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.locator('.chat-suggestion-btn').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('.chat-bubble--user')).toHaveCount(1);
  });

  test('session dropdown lets you create new chat', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.locator('.chat-session-toggle').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.chat-session-dropdown')).toBeVisible();
    await page.locator('.chat-session-item--new').click();
    await page.waitForTimeout(300);
    // After new session, welcome message bubble should be back
    await expect(page.locator('.chat-bubble--assistant .chat-bubble-content')).toContainText('Warm Stay');
  });

  test('close button hides side panel', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await page.locator('.side-panel-close').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.side-panel--open')).toHaveCount(0);
  });
});

// ──────────────────────────────────────────────
// 6. Canvas Multi-Session
// ──────────────────────────────────────────────

test.describe('Canvas Multi-Session', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/canvas`);
    await closeSidePanel(page);
  });

  test('shows empty state when no sessions exist', async ({ page }) => {
    await page.waitForTimeout(1000);
    await expect(page.locator('text=아직 캔버스가 비어있어요').or(page.locator('text=캔버스가 없어요'))).toBeVisible();
  });

  test('session dropdown and create new', async ({ page }) => {
    await page.waitForTimeout(500);
    await page.locator('button:has-text("🎨")').click();
    await page.waitForTimeout(300);
    await expect(page.locator('text=✚ 새 캔버스')).toBeVisible();
    await page.locator('text=✚ 새 캔버스').click();
    await page.waitForTimeout(300);
    await expect(page.locator('text=아직 캔버스가 비어있어요')).toBeVisible();
  });

  test('can create multiple sessions and see them in menu', async ({ page }) => {
    await page.waitForTimeout(500);
    // Create session 1
    await page.locator('button:has-text("🎨")').click();
    await page.waitForTimeout(200);
    await page.locator('text=✚ 새 캔버스').click();
    await page.waitForTimeout(300);
    // Create session 2
    await page.locator('button:has-text("🎨")').click();
    await page.waitForTimeout(200);
    await page.locator('text=✚ 새 캔버스').click();
    await page.waitForTimeout(300);
    // Open menu — should see ≥3 items (2 sessions + "새 캔버스")
    await page.locator('button:has-text("🎨")').click();
    await page.waitForTimeout(200);
    const items = page.locator('.chat-session-item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

// ──────────────────────────────────────────────
// 7. Mobile Responsive
// ──────────────────────────────────────────────

test.describe('Mobile Responsive', () => {
  test.use({ viewport: { width: 480, height: 800 } });

  test('sidebar narrow on mobile', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const sidebar = page.locator('.sidebar');
    const width = await sidebar.evaluate(el => el.offsetWidth);
    expect(width).toBeLessThanOrEqual(60);
  });

  test('side panel full width on mobile', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const panel = page.locator('.side-panel.side-panel--open');
    await expect(panel).toBeVisible();
    const width = await panel.evaluate(el => el.offsetWidth);
    expect(width).toBeGreaterThan(400);
  });
});

// ──────────────────────────────────────────────
// 8. API Data Integrity
// ──────────────────────────────────────────────

test.describe('API Data Integrity', () => {
  test('bookings API returns data', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/bookings?limit=5`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  test('properties API has 12 properties', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/properties`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(12);
  });

  test('dashboard charts API returns 12 months', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/dashboard/charts`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.monthlyRevenue).toBeDefined();
    expect(data.platformRevenue).toBeDefined();
    expect(data.monthlyRevenue.length).toBe(12);
  });
});
