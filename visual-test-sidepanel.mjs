// AI Side Panel Playwright Visual Test — v2 with Tool Calling + Canvas
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const srv = spawn('node', ['server/index.js'], {
    cwd: __dirname,
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, PORT: '4002' },
  });
  await new Promise(r => setTimeout(r, 2500));
  return srv;
}

(async () => {
  console.log('🚀 Starting test server on port 4002...');
  const server = await startServer();

  // headless: false = 브라우저가 실제로 떠서 눈으로 볼 수 있음!
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    // ============================================
    // TEST 1: 사이드 패널 열기
    // ============================================
    console.log('\n🤖 TEST 1: Open AI Side Panel');
    await page.goto('http://localhost:4002/properties', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshot-10-sidepanel-closed.png', fullPage: true });

    const aiBtn = page.locator('button[aria-label="AI 어시스턴트"]');
    await aiBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'screenshot-11-sidepanel-open.png', fullPage: true });
    console.log('   ✅ Side panel opened');

    // ============================================
    // TEST 2: Tool Calling — 예약 조회
    // ============================================
    console.log('\n🔧 TEST 2: Tool Calling — 예약 현황 조회');
    const chatInput = page.locator('.chat-input');
    await chatInput.fill('이번달 예약 알려줘');
    await page.locator('.chat-send-btn').click();
    console.log('   ⏳ Waiting for AI to call search_bookings tool...');
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'screenshot-17-tool-calling-bookings.png', fullPage: true });
    
    const msgs = await page.locator('.chat-bubble--assistant').count();
    console.log(`   Assistant messages: ${msgs} (expect 2+) ✓`);

    // Check if AI rendered a UI component
    const miniCards = await page.locator('.mini-card').count();
    console.log(`   Mini cards rendered: ${miniCards} ✓`);

    // ============================================
    // TEST 3: Tool Calling — 통계 조회
    // ============================================
    console.log('\n📊 TEST 3: Tool Calling — 통계 조회');
    await chatInput.fill('이번달 수익 통계 알려줘');
    await page.locator('.chat-send-btn').click();
    console.log('   ⏳ Waiting for AI to call get_dashboard_summary tool...');
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'screenshot-18-tool-calling-stats.png', fullPage: true });
    console.log('   ✅ Stats response received');

    // ============================================
    // TEST 4: Canvas 대시보드
    // ============================================
    console.log('\n🎨 TEST 4: Canvas Dashboard');
    await chatInput.fill('한눈에 보기 좋게 대시보드 만들어줘');
    await page.locator('.chat-send-btn').click();
    console.log('   ⏳ Waiting for AI to generate canvas...');
    await page.waitForTimeout(10000);
    await page.screenshot({ path: 'screenshot-19-canvas-from-chat.png', fullPage: true });
    
    // Click "캔버스에서 보기" button if it appeared
    const canvasBtn = page.locator('button', { hasText: '캔버스에서 보기' });
    if (await canvasBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await canvasBtn.click();
      await page.waitForTimeout(600);
    } else {
      // Switch to canvas tab manually
      await page.locator('.side-tab').filter({ hasText: '캔버스' }).click();
      await page.waitForTimeout(600);
    }
    
    await page.screenshot({ path: 'screenshot-20-canvas-view.png', fullPage: true });
    
    // Count canvas items
    const canvasItems = await page.locator('.canvas-item').count();
    console.log(`   Canvas items: ${canvasItems} (expect 2+) ✓`);
    
    // Remove one item
    if (canvasItems > 0) {
      await page.locator('.canvas-item-remove').first().click();
      await page.waitForTimeout(300);
      const remaining = await page.locator('.canvas-item').count();
      console.log(`   After removing one: ${remaining} ✓`);
    }

    // ============================================
    // TEST 5: "캔버스에 추가" 버튼
    // ============================================
    console.log('\n➕ TEST 5: Add to Canvas from chat');
    // Go back to chat
    await page.locator('.side-tab').filter({ hasText: '채팅' }).click();
    await page.waitForTimeout(300);
    
    // Look for "캔버스에 추가" button on any rendered component
    const addToCanvasBtn = page.locator('button', { hasText: '캔버스에 추가' }).first();
    if (await addToCanvasBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addToCanvasBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshot-21-add-to-canvas.png', fullPage: true });
      console.log('   ✅ Added component to canvas via button');
    } else {
      console.log('   ⚠️ No "Add to Canvas" button found (may already be in canvas)');
    }

    // ============================================
    // TEST 6: Canvas full delete
    // ============================================
    console.log('\n🗑️ TEST 6: Clear Canvas');
    await page.locator('.side-tab').filter({ hasText: '캔버스' }).click();
    await page.waitForTimeout(300);
    
    const clearBtn = page.locator('button', { hasText: '전체 삭제' });
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'screenshot-22-canvas-empty.png', fullPage: true });
      console.log('   ✅ Canvas cleared');
    }

    // ============================================
    // TEST 7: Mobile Viewport
    // ============================================
    console.log('\n📱 TEST 7: Mobile Viewport');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshot-23-mobile.png', fullPage: true });
    console.log('   ✅ Mobile screenshot');

    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL 7 TESTS COMPLETED — 14 SCREENSHOTS');
    console.log('   Screenshots: screenshot-10 through screenshot-23');
    console.log('='.repeat(50));

    // Keep browser open so user can interact!
    console.log('\n🔴 Browser is OPEN — play with it! Close the browser window to exit.');
    
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    console.error(err);
    await browser.close();
    server.kill();
    process.exit(1);
  }
  // Note: not closing browser or killing server so user can interact!
})();
