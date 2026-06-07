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

  test('side panel opens and closes on mobile', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    // Panel starts open — close via panel's close button
    const closeBtn = page.locator('.side-panel-close');
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(page.locator('.side-panel.side-panel--open')).toHaveCount(0);
    // Open via toggle button
    const toggleBtn = page.locator('button[aria-label="AI 어시스턴트"]');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('.side-panel.side-panel--open')).toBeVisible();
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

test.describe('AI Booking Detail', () => {
  test('booking-list shows property_name and guest_name for each item', async () => {
    test.skip(!process.env.DEEPSEEK_API_KEY, 'DEEPSEEK_API_KEY not set');

    // Use global fetch which Playwright provides
    const res = await fetch(`${BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: '2월 예약 건들 상세하게 보여줘' }] }),
    });
    const body = await res.text();
    const lines = body.split('\n');
    let lastData = '';
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('event: complete')) break;
      if (lines[i].startsWith('data: ')) lastData = lines[i].slice(6);
    }
    const data = JSON.parse(lastData);

    expect(data.ui).toBeTruthy();
    expect(data.ui.type).toBe('booking-list');
    expect(data.ui.props).toBeTruthy();
    expect(Array.isArray(data.ui.props.bookings)).toBe(true);
    expect(data.ui.props.bookings.length).toBeGreaterThan(0);

    // Every booking must have required fields
    for (const b of data.ui.props.bookings) {
      expect(b.guest_name).toBeTruthy();
      expect(b.property_name).toBeTruthy();
      expect(b.check_in).toBeTruthy();
      expect(b.check_out).toBeTruthy();
      expect(b.status).toBeTruthy();
    }
  });

  test('booking-list renders in chat with visible property names', async ({ page }) => {
    test.skip(!process.env.DEEPSEEK_API_KEY, 'DEEPSEEK_API_KEY not set');

    await page.goto(BASE);
    await page.waitForTimeout(1500);

    // Click collapse button to open side panel if not already open
    const panel = page.locator('.side-panel.side-panel--open');
    if (!(await panel.isVisible().catch(() => false))) {
      const collapse = page.locator('.side-panel-collapse');
      if (await collapse.isVisible().catch(() => false)) {
        await collapse.click();
        await page.waitForTimeout(500);
      }
    }

    // Find chat input
    const chatInput = page.locator('textarea.chat-input').first();
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    // Type query and submit via button click
    const query = '2월 예약 건들 상세하게 보여줘';
    await chatInput.fill(query);
    await page.waitForTimeout(300);
    const sendBtn = page.locator('button[aria-label="전송"], button.chat-send-btn, button:has-text("➤")').first();
    if (await sendBtn.isVisible().catch(() => false)) {
      await sendBtn.click();
    } else {
      await chatInput.press('Enter');
    }

    // Wait for AI to generate response (plan → execute → render)
    await page.waitForTimeout(35000);

    // Check for booking items
    const bookingItems = page.locator('.mini-booking-item');
    const count = await bookingItems.count();
    expect(count).toBeGreaterThan(0);

    // First item should show property name
    const firstItem = bookingItems.first();
    await expect(firstItem).toContainText(/숙소|스튜디오|하우스|레지던스|펜션|플랫|스테이|게스트하우스/);
    await expect(firstItem).toContainText(/→|입실|체크|퇴실|취소|김|이|박|최|정|강|한|송|윤/);
  });
});
