#!/usr/bin/env node

/**
 * Warm Stay AI Assistant — Comprehensive Evaluation Test Suite v2
 *
 * Tests the new plan-first architecture with reduced tool set.
 * Uses http module for sandbox compatibility.
 *
 * Usage: node test/eval.js [--verbose] [--quick] [--server=http://...]
 */

const http = require('http');
const SERVER = process.argv.find(a => a.startsWith('--server='))?.split('=')[1] || 'http://localhost:4001';
const VERBOSE = process.argv.includes('--verbose');
const QUICK = process.argv.includes('--quick');

const RESULTS = { pass: 0, fail: 0, errors: [] };
let testIdx = 0;

function httpRequest(method, path, body, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      timeout: timeoutMs,
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function chat(messages) {
  return httpRequest('POST', '/api/chat', { messages });
}

function test(name, fn) {
  testIdx++;
  const label = `[${String(testIdx).padStart(2, '0')}] ${name}`;
  process.stdout.write(`  ${label} ... `);
  try {
    fn();
    RESULTS.pass++;
    console.log('✅');
  } catch (e) {
    RESULTS.fail++;
    RESULTS.errors.push({ name, error: e.message });
    console.log('❌  ' + e.message.slice(0, 120));
  }
}

function hasUI(data) {
  return data && data.ui && data.ui.type;
}
function str(m) { return typeof m === 'string' && m.length > 0; }

// ============================================================
(async () => {

// 0. Health Check
console.log('\n🏥 Health Check');
try {
  const health = await httpRequest('GET', '/api/health');
  test('Server reachable', () => { if (!health.ok) throw new Error('Not ok'); });
} catch (e) {
  test('Server reachable', () => { throw e; });
  console.log('\n❌ Server not reachable. Start server with: node server/index.js');
  process.exit(1);
}

// 1. Basic Queries
console.log('\n📋 1. Basic Queries');
const BASIC = QUICK ? [
  ['월 수익', '이번달 수익 알려줘'],
  ['예약', '7월 예약 보여줘'],
  ['숙소 랭킹', '예약 제일 많은 숙소는?'],
] : [
  ['월 수익', '이번달 수익 알려줘'],
  ['예약', '7월 예약 보여줘'],
  ['숙소 랭킹', '예약 제일 많은 숙소는?'],
  ['수익 TOP3', '수익 가장 높은 숙소 TOP3'],
  ['게스트 검색', '김민지 예약 내역 알려줘'],
  ['월별 추이', '월별 수익 추이 알려줘'],
  ['플랫폼', '플랫폼별 수익 비교해줘'],
  ['숙소별', '숙소별 실적 알려줘'],
];
for (const [n, q] of BASIC) {
  try { const d = await chat([{role:'user',content:q}]);
    test(`${n}: "${q}"`, () => { if (!str(d.message)) throw new Error('No message'); });
  } catch(e) { test(`${n}: "${q}"`, () => { throw e; }); }
}

// 2. UI Presence (critical)
console.log('\n🎯 2. UI Presence (critical)');
const UI = QUICK ? BASIC : [
  ['월 수익', '이번달 수익 알려줘'],
  ['예약', '7월 예약 보여줘'],
  ['숙소 랭킹', '예약 제일 많은 숙소는?'],
  ['수익 TOP3', '수익 가장 높은 숙소 TOP3'],
  ['게스트 검색', '김민지 예약 내역 알려줘'],
  ['월별 추이', '월별 수익 추이 알려줘'],
  ['플랫폼', '플랫폼별 수익 비교해줘'],
  ['숙소별', '숙소별 실적 알려줘'],
];
for (const [n, q] of UI) {
  try { const d = await chat([{role:'user',content:q}]);
    test(`"${n}": has UI`, () => {
      if (!hasUI(d)) throw new Error(`No UI (type:${d.ui?.type||'none'})`);
      if (VERBOSE) console.log(`\n    → ${d.ui.type}: ${JSON.stringify(d.ui.props).slice(0,80)}`);
    });
  } catch(e) { test(`"${n}": has UI`, () => { throw e; }); }
}

// 3. Plan in Response
console.log('\n📋 3. Plan in Response');
if (!QUICK) {
  for (const [n, q] of [['월 수익','이번달 수익 알려줘'], ['예약','7월 예약 보여줘']]) {
    try { const d = await chat([{role:'user',content:q}]);
      test(`"${n}": has data`, () => {
        if (!str(d.message)) throw new Error('No message');
        if (d.plan && VERBOSE) console.log(`\n    → plan: ${JSON.stringify(d.plan).slice(0,100)}`);
      });
    } catch(e) { test(`"${n}": has data`, () => { throw e; }); }
  }
}

// 4. UI Quality
console.log('\n📐 4. UI Quality');
if (!QUICK) {
  try {
    const d = await chat([{role:'user',content:'이번달 수익 알려줘'}]);
    test('stats-card has label+value', () => {
      if (!hasUI(d)) throw new Error('No UI');
      const items = d.ui.type === 'layout' ? (d.ui.props?.children||[]) : [d.ui];
      for (const item of items) {
        if (item.type === 'stats-card') {
          if (!item.props?.label||!item.props?.value) throw new Error('Empty');
          if ((item.props.value||'').includes('NaN')) throw new Error('NaN');
        }
      }
    });
  } catch(e) { test('stats-card quality', () => { throw e; }); }

  try {
    const d = await chat([{role:'user',content:'월별 수익 추이 알려줘'}]);
    test('chart has data', () => {
      if (!hasUI(d)) throw new Error('No UI');
      const items = d.ui.type === 'layout' ? (d.ui.props?.children||[]) : [d.ui];
      for (const item of items) {
        if (item.type === 'chart') {
          const cd = item.props?.data;
          if (cd && Array.isArray(cd) && cd.length===0) throw new Error('Empty chart data');
        }
      }
    });
  } catch(e) { test('chart quality', () => { throw e; }); }

  try {
    const d = await chat([{role:'user',content:'7월 예약 보여줘'}]);
    test('booking-list has valid bookings', () => {
      if (!hasUI(d)) throw new Error('No UI');
      if (d.ui.type === 'booking-list') {
        const bks = d.ui.props?.bookings||[];
        if (bks.length===0) throw new Error('Empty');
        if (!bks[0].guest_name||!bks[0].check_in) throw new Error('Bad shape');
      }
    });
  } catch(e) { test('booking-list quality', () => { throw e; }); }
}

// 5. HTML Renderer
console.log('\n🔧 5. HTML Renderer');
if (!QUICK) {
  try {
    const d = await chat([{role:'user',content:'플랫폼별 수익이랑 예약 많은 숙소 둘 다 커스텀 레이아웃으로 보여줘'}]);
    test('produces html/layout', () => {
      if (!hasUI(d)) throw new Error('No UI');
      const valid = ['html','layout','chart','table'];
      if (!valid.includes(d.ui.type)) throw new Error(`Got ${d.ui.type}`);
    });
  } catch(e) { test('produces html/layout', () => { throw e; }); }
}

// 6. Canvas / Dashboard
console.log('\n🎨 6. Canvas/Dashboard');
if (!QUICK) {
  try {
    const d = await chat([
      {role:'user',content:'숙소별 실적 알려줘'},
      {role:'assistant',content:'해운대 오션뷰가 1위입니다.'},
      {role:'user',content:'대쉬보드로 만들어봐'},
    ]);
    test('dashboard → canvas ≥2', () => {
      if (!d.canvas) throw new Error('No canvas');
      if (!d.canvas.items||d.canvas.items.length<2) throw new Error(`${d.canvas.items?.length||0} items`);
    });
  } catch(e) { test('dashboard → canvas', () => { throw e; }); }
}

// 7. Edge Cases
console.log('\n⚡ 7. Edge Cases');
const EDGE = QUICK ? [
  ['짧은 질문','안녕'],['영어','Show me bookings for July'],
] : [
  ['예약 999','예약 999번 보여줘'],['짧은 질문','안녕'],
  ['영어','Show me bookings for July'],['특수문자','@@@'],
];
for (const [n, q] of EDGE) {
  try { const d = await chat([{role:'user',content:q}]);
    test(`Edge: "${n}"`, () => { if (!str(d.message)) throw new Error('No message'); });
  } catch(e) { test(`Edge: "${n}"`, () => { throw e; }); }
}

// Summary
const t = RESULTS.pass + RESULTS.fail;
const pct = t > 0 ? Math.round((RESULTS.pass/t)*100) : 0;
console.log('\n' + '='.repeat(50));
console.log(`📊 Evaluation: ${RESULTS.pass}/${t} passed (${pct}%)`);
if (RESULTS.fail > 0) {
  console.log('\n❌ Failures:');
  for (const e of RESULTS.errors) console.log(`   • ${e.name}: ${e.error}`);
}
console.log('='.repeat(50));
process.exit(RESULTS.fail > 0 ? 1 : 0);

})().catch(e => { console.error('Fatal:', e); process.exit(1); });
