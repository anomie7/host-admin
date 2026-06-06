#!/usr/bin/env node

/**
 * Warm Stay AI Assistant — UI Quality Evaluation
 *
 * Tests whether AI responses include appropriate visual UI components
 * and whether those UIs are readable and well-structured.
 *
 * Usage: node test/eval-ui.js [--verbose] [--quick]
 */

const SERVER = process.argv.includes('--server') ? process.argv[process.argv.indexOf('--server') + 1] : 'http://localhost:4001';
const VERBOSE = process.argv.includes('--verbose');
const QUICK = process.argv.includes('--quick');

const RESULTS = { pass: 0, fail: 0, errors: [] };
let testIdx = 0;

async function chat(messages, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SERVER}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function str(m) { return typeof m === 'string' && m.length > 0; }

function show(data) {
  if (!VERBOSE) return;
  const ui = data.ui;
  if (!ui) { console.log('  → NO UI'); return; }
  if (ui.type === 'layout') {
    const children = ui.props?.children || [];
    console.log(`  → layout(${children.length}개):`);
    for (const c of children) {
      const p = c.props || {};
      if (c.type === 'stats-card') console.log(`      stats-card: "${p.label}" = ${p.value}`);
      else if (c.type === 'chart') console.log(`      chart: ${p.chartType} "${p.title || ''}"`);
      else if (c.type === 'booking-list') console.log(`      booking-list: ${p.title || ''}`);
      else console.log(`      ${c.type}: ${JSON.stringify(p).slice(0, 60)}`);
    }
  } else {
    console.log(`  → ${ui.type}: ${JSON.stringify(ui.props).slice(0, 80)}`);
  }
}

async function run() {
  const tests = [];

  function define(name, fn) {
    tests.push({ name, fn });
  }

  async function runAll() {
    for (const { name, fn } of tests) {
      testIdx++;
      const label = `[${String(testIdx).padStart(2, '0')}] ${name}`;
      process.stdout.write(`  ${label} ... `);
      try {
        await fn();
        RESULTS.pass++;
        console.log('✅');
      } catch (e) {
        RESULTS.fail++;
        RESULTS.errors.push({ name, error: e.message });
        console.log('❌  ' + e.message.slice(0, 120));
      }
    }
  }

  // ============================================================
  // 1. Health Check
  // ============================================================
  console.log('\n🏥 Health Check');
  define('Server reachable', async () => {
    const res = await fetch(`${SERVER}/api/health`);
    const data = await res.json();
    if (!data.ok) throw new Error('Not ok');
  });

  // ============================================================
  // 2. UI Presence — 모든 데이터 응답에 ui가 있는가?
  // ============================================================
  console.log('\n🎯 2. UI 필수 포함 테스트');

  const UI_TESTS = QUICK ? [
    ['월 수익', '이번달 총 수익이 얼마지?'],
    ['예약 랭킹', '예약 제일 많은 숙소는?'],
    ['숙소별 실적', '숙소별 실적 알려줘'],
  ] : [
    ['월 수익', '이번달 총 수익이 얼마지?'],
    ['다음주 체크인', '다음주 체크인 누구야?'],
    ['예약 랭킹', '예약 제일 많은 숙소는?'],
    ['숙소별 실적', '숙소별 실적 알려줘'],
    ['플랫폼별 수익', '플랫폼별 수익 비교해줘'],
    ['7월 예약', '7월 예약 보여줘'],
    ['월별 추이', '월별 수익 추이 알려줘'],
    ['게스트 검색', '"김민지" 예약 내역 알려줘'],
    ['숙소 분석', '강남 스튜디오 예약 현황 알려줘'],
    ['캘린더', '6월 캘린더 보여줘'],
  ];

  for (const [name, query] of UI_TESTS) {
    define(`"${name}": ui 필드 포함`, async () => {
      const data = await chat([{ role: 'user', content: query }]);
      if (!data.ui) throw new Error('응답에 ui 필드가 없습니다 (텍스트만 반환됨)');
      if (!data.ui.type) throw new Error('ui.type이 없습니다');
      show(data);
    });
  }

  // ============================================================
  // 3. Layout / UI Quality
  // ============================================================
  console.log('\n📐 3. UI 품질 평가');

  if (!QUICK) {
    define('"이번달 수익": layout이 3개 이상 children', async () => {
      const data = await chat([{ role: 'user', content: '이번달 총 수익이 얼마지?' }]);
      if (!data.ui) throw new Error('ui 없음');
      if (data.ui.type === 'layout') {
        const children = data.ui.props?.children || [];
        if (children.length < 3) throw new Error(`예상 ≥3, 실제 ${children.length}개`);
      }
      show(data);
    });

    define('"숙소별 실적": 차트 또는 stats-card 포함', async () => {
      const data = await chat([{ role: 'user', content: '숙소별 실적 알려줘' }]);
      if (!data.ui) throw new Error('ui 없음');
      const items = data.ui.type === 'layout' ? (data.ui.props?.children || []) : [data.ui];
      const hasChart = items.some(c => c.type === 'chart');
      const hasStats = items.some(c => c.type === 'stats-card');
      if (!hasChart && !hasStats) throw new Error('차트나 통계 카드가 없습니다');
      show(data);
    });
  }

  // ============================================================
  // 4. Readability
  // ============================================================
  console.log('\n👁️ 4. 가독성 평가');

  define('stats-card 라벨/값이 비어있지 않음', async () => {
    const data = await chat([{ role: 'user', content: '이번달 수익 알려줘' }]);
    if (!data.ui) throw new Error('ui 없음');
    const items = data.ui.type === 'layout' ? (data.ui.props?.children || []) : [data.ui];
    for (const item of items) {
      if (item.type === 'stats-card') {
        const label = item.props?.label || '';
        const value = item.props?.value || '';
        if (label.length < 1) throw new Error('stats-card label이 비어있음');
        if (value.length < 1) throw new Error('stats-card value가 비어있음');
      }
    }
  });

  define('chart 데이터가 빈 배열이 아님', async () => {
    const data = await chat([{ role: 'user', content: '월별 수익 추이 알려줘' }]);
    if (!data.ui) throw new Error('ui 없음');
    const items = data.ui.type === 'layout' ? (data.ui.props?.children || []) : [data.ui];
    for (const item of items) {
      if (item.type === 'chart' && item.props?.chartType !== 'summary') {
        const chartData = item.props?.data;
        if (chartData && Array.isArray(chartData) && chartData.length === 0) {
          throw new Error(`${item.props?.chartType} 차트 데이터가 비어있음`);
        }
      }
    }
  });

  // ============================================================
  // 5. Compound scenarios
  // ============================================================
  console.log('\n🧪 5. 복합 시나리오');

  define('복합 질문 → ui 응답', async () => {
    const data = await chat([{ role: 'user', content: '플랫폼별 수익이랑 예약 제일 많은 숙소 둘 다 알려줘' }]);
    if (!data.ui) throw new Error('ui 없음');
    show(data);
  });

  define('캔버스 대시보드 3개+ 아이템', async () => {
    const data = await chat([
      { role: 'user', content: '숙소별 실적 알려줘' },
      { role: 'assistant', content: '용산 리버뷰가 1위입니다.' },
      { role: 'user', content: '한눈에 보기 좋게 만들어봐' },
    ]);
    if (!data.canvas) throw new Error('canvas 필드 없음');
    if (!data.canvas.items || data.canvas.items.length < 3) {
      throw new Error(`아이템 ${data.canvas.items?.length || 0}개 (≥3 필요)`);
    }
    show(data);
  });

  // ============================================================
  // Run & Summary
  // ============================================================
  await runAll();

  const total = RESULTS.pass + RESULTS.fail;
  const pct = total > 0 ? Math.round((RESULTS.pass / total) * 100) : 0;

  console.log('\n' + '='.repeat(50));
  console.log(`📊 UI Evaluation: ${RESULTS.pass}/${total} passed (${pct}%)`);
  if (RESULTS.fail > 0) {
    console.log(`\n❌ Failures:`);
    for (const e of RESULTS.errors) {
      console.log(`   ${e.name}: ${e.error}`);
    }
  }
  console.log('='.repeat(50));

  process.exit(RESULTS.fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
