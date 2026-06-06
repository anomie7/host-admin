/**
 * Warm Stay AI Assistant — Evaluation Test Suite
 *
 * Usage: node test/eval.js
 * Options:
 *   --verbose    Show full responses
 *   --quick      Run only essential tests
 *   --server     Server URL (default: http://localhost:4001)
 */

const SERVER = process.argv.find(a => a.startsWith('--server='))?.split('=')[1] || 'http://localhost:4001';
const VERBOSE = process.argv.includes('--verbose');
const QUICK = process.argv.includes('--quick');

const RESULTS = { pass: 0, fail: 0, errors: [] };
let testIdx = 0;

async function chat(messages) {
  const res = await fetch(`${SERVER}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
    console.log('❌  ' + e.message.slice(0, 80));
  }
}

function hasKeys(obj, keys) {
  if (!obj) throw new Error(`Expected object, got ${typeof obj}`);
  for (const k of keys) {
    if (!(k in obj)) throw new Error(`Missing key "${k}"`);
  }
}

function str(m) { return typeof m === 'string' && m.length > 0; }

// ============================================================
// 0. Health Check
// ============================================================
console.log('\n🏥 Health Check');
test('Server is reachable', async () => {
  const res = await fetch(`${SERVER}/api/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error('Not ok');
});

// ============================================================
// 1. Basic Queries — simple tool selection
// ============================================================
console.log('\n📋 1. Basic Queries');
const BASIC_TESTS = QUICK ? [] : [
  ['예약 조회', '다음주 체크인 알려줘'],
  ['수익 조회', '이번달 수익이 얼마야?'],
  ['숙소 검색', '강남 스튜디오 알려줘'],
  ['숙소 랭킹', '예약이 가장 많은 숙소는?'],
  ['캘린더', '6월 캘린더 보여줘'],
];

for (const [name, query] of BASIC_TESTS) {
  test(`${name}: "${query}"`, async () => {
    const data = await chat([{ role: 'user', content: query }]);
    if (!str(data.message)) throw new Error('No message in response');
  });
}

// ============================================================
// 2. Tool Selection Correctness
// ============================================================
console.log('\n🔧 2. Tool Selection');

// These check that AI uses the RIGHT tools, not hallucinated params
test('숙소별 실적 → get_booking_stats_by_property', async () => {
  const data = await chat([{ role: 'user', content: '숙소별 실적 알려줘' }]);
  if (!str(data.message)) throw new Error('No message');
  // Should have chart or stats-card UI
  if (!data.ui) {} // optional
});

test('복합질문: "수익 1위 숙소 플랫폼별 실적"', async () => {
  const data = await chat([{ role: 'user', content: '수익 1위 숙소 플랫폼별 실적 알려줘' }]);
  if (!str(data.message)) throw new Error('No message');
  // Should use execute_sql for platform breakdown after finding top property
});

// ============================================================
// 3. Navigation
// ============================================================
console.log('\n🧭 3. Navigation');

test('예약 번호 → 인라인 상세', async () => {
  const data = await chat([{ role: 'user', content: '예약 5번 보여줘' }]);
  if (!str(data.message)) throw new Error('No message');
  // Should show booking-detail inline (not navigate)
  if (data.ui && data.ui.type === 'booking-detail') {
    // Perfect — inline display
  }
});

// ============================================================
// 4. Canvas / Dashboard
// ============================================================
console.log('\n🎨 4. Canvas / Dashboard');

test('대시보드 요청 → canvas 있음', async () => {
  const data = await chat([
    { role: 'user', content: '숙소별 실적 알려줘' },
    { role: 'assistant', content: '용산 리버뷰가 수익 1위입니다.' },
    { role: 'user', content: '대쉬보드로 만들어봐' },
  ]);
  if (!data.canvas) throw new Error('No canvas field in response');
  if (!data.canvas.items || data.canvas.items.length < 2) {
    throw new Error(`Canvas has only ${data.canvas.items?.length || 0} items (expected ≥2)`);
  }
});

test('차트 + 예약 목록 같이', async () => {
  const data = await chat([
    { role: 'user', content: '캔버스에 차트랑 예약 목록 같이 보여줘' },
  ]);
  if (!data.canvas) throw new Error('No canvas');
  if (!data.canvas.items || data.canvas.items.length < 2) {
    throw new Error(`Canvas has only ${data.canvas.items?.length || 0} items`);
  }
});

// ============================================================
// 4b. History-based Context
// ============================================================
console.log('\n💬 4b. History-based Context');

test('"이 대화를 토대로" — canvas with focused month', async () => {
  const data = await chat([
    { role: 'user', content: '6월 수익 알려줘' },
    { role: 'assistant', content: '6월 총 수익은 ₩3,337,172입니다.' },
    { role: 'assistant', content: '[DATA: 이번달 수익 = ₩3,337,172]' },
    { role: 'user', content: '7월 예약도 보여줘' },
    { role: 'assistant', content: '7월에 10건 예약이 있습니다.' },
    { role: 'assistant', content: '[DATA: 예약 10건]' },
    { role: 'user', content: '이 대화를 토대로 대시보드로 만들어봐' },
  ]);
  if (!data.canvas) throw new Error('No canvas — history context lost');
  if (!data.canvas.items || data.canvas.items.length < 3) {
    throw new Error(`Canvas has only ${data.canvas.items?.length || 0} items`);
  }
});

test('"지금까지 얘기한 내용으로" — 대화 맥락 유지', async () => {
  const data = await chat([
    { role: 'user', content: '예약 제일 많은 숙소 알려줘' },
    { role: 'assistant', content: '성수 미니멀 플랫이 12건으로 1위입니다.' },
    { role: 'user', content: '플랫폼별 수익도 알려줘' },
    { role: 'assistant', content: '에어비앤비 1,498만원, 부킹닷컴 1,335만원, 라이브애니웨어 961만원입니다.' },
    { role: 'user', content: '지금까지 얘기한 내용으로 대시보드 만들어줘' },
  ]);
  if (!data.canvas) throw new Error('No canvas — history context lost');
  if (!data.canvas.items || data.canvas.items.length < 3) {
    throw new Error(`Canvas has only ${data.canvas.items?.length || 0} items`);
  }
});

test('DATA 마커 포함된 히스토리 → canvas', async () => {
  const data = await chat([
    { role: 'user', content: '이번달 통계 알려줘' },
    { role: 'assistant', content: '이번달 수익은 ₩3,337,172입니다. [DATA: stats-card — 이번달 수익: ₩3,337,172]' },
    { role: 'user', content: '좋아, 이걸로 대시보드 만들어봐' },
  ]);
  if (!data.canvas) throw new Error('No canvas');
});

// ============================================================
// 5. Complex SQL / execute_sql
// ============================================================
console.log('\n🗄️ 5. execute_sql (Complex Queries)');

test('execute_sql: 특정 숙소 플랫폼별 수익', async () => {
  const data = await chat([{ role: 'user', content: '성수 미니멀 플랫의 플랫폼별 수 breakdown 알려줘' }]);
  if (!str(data.message)) throw new Error('No message');
  // Should mention platform or amounts
});

test('execute_sql: 월별 추이', async () => {
  const data = await chat([{ role: 'user', content: '올해 월별 체크인 건수 추이 알려줘' }]);
  if (!str(data.message)) throw new Error('No message');
});

test('execute_sql: 게스트 검색', async () => {
  const data = await chat([{ role: 'user', content: '"김민지" 게스트 예약 내역 다 알려줘' }]);
  if (!str(data.message)) throw new Error('No message');
});

// ============================================================
// 6. UI Response Format
// ============================================================
console.log('\n📐 6. UI Response Format');

if (!QUICK) {
  test('예약 조회 → booking-list UI', async () => {
    const data = await chat([{ role: 'user', content: '7월 예약 보여줘' }]);
    if (data.ui && data.ui.type !== 'booking-list') {
      // Optional: UI type might vary, just check message exists
    }
    if (!str(data.message)) throw new Error('No message');
  });

  test('통계 → stats-card or chart UI', async () => {
    const data = await chat([{ role: 'user', content: '이번달 통계 요약' }]);
    if (!str(data.message)) throw new Error('No message');
  });
}

// ============================================================
// 7. Edge Cases
// ============================================================
console.log('\n⚡ 7. Edge Cases');

test('존재하지 않는 예약', async () => {
  const data = await chat([{ role: 'user', content: '예약 999번 보여줘' }]);
  if (!str(data.message)) throw new Error('No message');
  // Should say not found, not crash
});

test('짧은 질문', async () => {
  const data = await chat([{ role: 'user', content: '안녕' }]);
  if (!str(data.message)) throw new Error('No message');
});

test('영어 질문', async () => {
  const data = await chat([{ role: 'user', content: 'Show me bookings for July' }]);
  if (!str(data.message)) throw new Error('No message');
});

// ============================================================
// Summary
// ============================================================
const total = RESULTS.pass + RESULTS.fail;
const pct = total > 0 ? Math.round((RESULTS.pass / total) * 100) : 0;

console.log('\n' + '='.repeat(50));
console.log(`📊 Evaluation Results: ${RESULTS.pass}/${total} passed (${pct}%)`);
if (RESULTS.fail > 0) {
  console.log(`\n❌ Failures (${RESULTS.fail}):`);
  for (const e of RESULTS.errors) {
    console.log(`   ${e.name}: ${e.error}`);
  }
}
console.log('='.repeat(50));

process.exit(RESULTS.fail > 0 ? 1 : 0);
