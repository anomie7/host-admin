#!/usr/bin/env node

/**
 * Warm Stay AI Assistant — UI Quality Evaluation v2
 *
 * Tests UI component quality, diversity, plan-first compliance, and HTML renderer.
 * Uses http module for sandbox compatibility.
 *
 * Usage: node test/eval-ui.js [--verbose] [--quick] [--server=http://...]
 */

const http = require('http');
const SERVER = process.argv.find(a => a.startsWith('--server='))?.split('=')[1] || 'http://localhost:4001';
const VERBOSE = process.argv.includes('--verbose');
const QUICK = process.argv.includes('--quick');

const RESULTS = { pass: 0, fail: 0, errors: [] };
let testIdx = 0;

function httpReq(method, path, body, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER);
    const opts = {
      hostname: url.hostname, port: url.port, path: url.pathname,
      method, headers: body ? { 'Content-Type': 'application/json' } : {},
      timeout: timeoutMs,
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function chat(m) { return httpReq('POST', '/api/chat', { messages: m }); }

function hasUI(d) { return d && d.ui && d.ui.type; }
function str(m) { return typeof m === 'string' && m.length > 0; }

function show(d) {
  if (!VERBOSE) return;
  const ui = d.ui; if (!ui) { console.log('  → NO UI'); return; }
  if (ui.type === 'layout') {
    const ch = ui.props?.children||[];
    console.log(`  → layout(${ch.length} items):`);
    for (const c of ch) {
      const p = c.props||{};
      if (c.type==='stats-card') console.log(`      stats-card: "${p.label}" = ${p.value}`);
      else if (c.type==='chart') console.log(`      chart: ${p.chartType} "${(p.title||'').slice(0,30)}"`);
      else if (c.type==='booking-list') console.log(`      booking-list: ${(p.title||'').slice(0,30)} (${p.bookings?.length||0}건)`);
      else if (c.type==='table') console.log(`      table: ${(p.title||'').slice(0,30)} (${p.rows?.length||0}행)`);
      else console.log(`      ${c.type}: ${JSON.stringify(p).slice(0,80)}`);
    }
  } else if (ui.type==='html') console.log(`  → html (${(ui.props?.content||'').length} chars)`);
  else console.log(`  → ${ui.type}: ${JSON.stringify(ui.props).slice(0,100)}`);
}

function collectItems(ui) {
  if (!ui||!ui.type) return [];
  if (ui.type==='layout') return (ui.props?.children||[]).flatMap(c => collectItems(c));
  return [ui];
}

async function run() {
  const tests = [];
  function def(name, fn) { tests.push({ name, fn }); }

  async function runAll() {
    for (const { name, fn } of tests) {
      testIdx++;
      const label = `[${String(testIdx).padStart(2,'0')}] ${name}`;
      process.stdout.write(`  ${label} ... `);
      try { await fn(); RESULTS.pass++; console.log('✅'); }
      catch(e) { RESULTS.fail++; RESULTS.errors.push({name,error:e.message}); console.log('❌  '+e.message.slice(0,120)); }
    }
  }

  // 1. Health
  console.log('\n🏥 Health Check');
  def('Server reachable', async () => {
    const h = await httpReq('GET', '/api/health');
    if (!h.ok) throw new Error('Not ok');
  });

  // 2. UI 필수 포함
  console.log('\n🎯 2. UI 필수 포함');
  const UI_TESTS = QUICK ? [
    ['월 수익','이번달 총 수익이 얼마지?'],
    ['예약 랭킹','예약 제일 많은 숙소는?'],
  ] : [
    ['월 수익','이번달 총 수익이 얼마지?'],
    ['예약 랭킹','예약 제일 많은 숙소는?'],
    ['숙소별 실적','숙소별 실적 알려줘'],
    ['플랫폼','플랫폼별 수익 비교해줘'],
    ['7월 예약','7월 예약 보여줘'],
    ['월별 추이','월별 수익 추이 알려줘'],
    ['게스트','김민지 예약 내역 알려줘'],
    ['수익 TOP3','수익 가장 높은 숙소 TOP3'],
    ['숙소 분석','강남 스튜디오 예약 현황'],
  ];
  for (const [n, q] of UI_TESTS) {
    def(`"${n}": UI 필수`, async () => {
      const d = await chat([{role:'user',content:q}]);
      if (!d.ui) throw new Error('ui 필드 없음');
      if (!d.ui.type) throw new Error('ui.type 없음');
      show(d);
    });
  }

  // 3. 타입 다양성
  console.log('\n🎨 3. 타입 다양성');
  if (!QUICK) {
    def('stats-card 지원', async () => {
      const d = await chat([{role:'user',content:'이번달 총 수익이 얼마지?'}]);
      if (!hasUI(d)) throw new Error('ui 없음');
      const items = collectItems(d.ui);
      if (!items.some(c => c.type==='stats-card')) throw new Error(`stats-card 없음 (${items.map(c=>c.type).join(',')})`);
      show(d);
    });
    def('booking-list 지원', async () => {
      const d = await chat([{role:'user',content:'7월 예약 보여줘'}]);
      if (!hasUI(d)) throw new Error('ui 없음');
      const items = collectItems(d.ui);
      if (!items.some(c => c.type==='booking-list')) throw new Error(`booking-list 없음 (${items.map(c=>c.type).join(',')})`);
      show(d);
    });
    def('chart(revenue) 지원', async () => {
      const d = await chat([{role:'user',content:'월별 수익 추이 알려줘'}]);
      if (!hasUI(d)) throw new Error('ui 없음');
      const items = collectItems(d.ui);
      if (!items.some(c => c.type==='chart')) throw new Error(`chart 없음`);
      show(d);
    });
    def('html 타입 가능', async () => {
      const d = await chat([{role:'user',content:'플랫폼별 수익이랑 예약 많은 숙소 둘 다 커스텀 레이아웃으로 보여줘'}]);
      if (!hasUI(d)) throw new Error('ui 없음');
      const valid = ['html','layout','chart','table'];
      if (!valid.includes(d.ui.type)) throw new Error(`예상 html/layout, 실제 ${d.ui.type}`);
      show(d);
    });
  }

  // 4. UI 품질
  console.log('\n📐 4. UI 품질');
  def('stats-card 값 비어있지 않음', async () => {
    const d = await chat([{role:'user',content:'이번달 수익 알려줘'}]);
    if (!hasUI(d)) throw new Error('ui 없음');
    for (const item of collectItems(d.ui)) {
      if (item.type==='stats-card') {
        if (!item.props?.label||!item.props?.value) throw new Error('label/value 비어있음');
        if ((item.props.value||'').includes('NaN')) throw new Error('NaN');
      }
    }
  });
  def('chart 데이터 비어있지 않음', async () => {
    const d = await chat([{role:'user',content:'월별 수익 추이 알려줘'}]);
    if (!hasUI(d)) throw new Error('ui 없음');
    for (const item of collectItems(d.ui)) {
      if (item.type==='chart' && item.props?.chartType!=='summary') {
        const cd = item.props?.data;
        if (cd && Array.isArray(cd) && cd.length===0) throw new Error(`${item.props?.chartType} 비어있음`);
      }
    }
  });
  def('booking-list에 guest_name 있음', async () => {
    const d = await chat([{role:'user',content:'7월 예약 보여줘'}]);
    if (!hasUI(d)) throw new Error('ui 없음');
    for (const item of collectItems(d.ui)) {
      if (item.type==='booking-list') {
        const bks = item.props?.bookings||[];
        if (bks.length>0 && (!bks[0].guest_name||!bks[0].check_in)) throw new Error('booking shape bad');
      }
    }
  });

  // 5. 복합 시나리오
  console.log('\n🧪 5. 복합 시나리오');
  if (!QUICK) {
    def('캔버스 대시보드 ≥3 아이템', async () => {
      const d = await chat([
        {role:'user',content:'숙소별 실적 알려줘'},
        {role:'assistant',content:'해운대 오션뷰가 1위입니다.'},
        {role:'user',content:'한눈에 보기 좋게 만들어봐'},
      ]);
      if (!d.canvas) throw new Error('canvas 없음');
      if (!d.canvas.items||d.canvas.items.length<3) throw new Error(`${d.canvas.items?.length||0}개 (<3)`);
      show(d);
    });
    def('히스토리 기반 캔버스 ≥3', async () => {
      const d = await chat([
        {role:'user',content:'6월 수익 알려줘'},
        {role:'assistant',content:'₩3,350,230'},
        {role:'user',content:'7월 예약도 보여줘'},
        {role:'assistant',content:'7월에 10건'},
        {role:'user',content:'이 대화를 토대로 대시보드로 만들어봐'},
      ]);
      if (!d.canvas) throw new Error('canvas 없음');
      if (!d.canvas.items||d.canvas.items.length<3) throw new Error(`${d.canvas.items?.length||0}개`);
      show(d);
    });
  }

  // Run
  await runAll();

  const t = RESULTS.pass + RESULTS.fail;
  const pct = t > 0 ? Math.round((RESULTS.pass/t)*100) : 0;
  console.log('\n' + '='.repeat(50));
  console.log(`📊 UI Evaluation: ${RESULTS.pass}/${t} passed (${pct}%)`);
  if (RESULTS.fail > 0) {
    console.log('\n❌ Failures:');
    for (const e of RESULTS.errors) console.log(`   • ${e.name}: ${e.error}`);
  }
  console.log('='.repeat(50));
  process.exit(RESULTS.fail > 0 ? 1 : 0);
}
run().catch(e => { console.error('Fatal:', e); process.exit(1); });
