import { getDb } from './server/db.js';

const db = getDb();

// Clear existing data
db.exec('DELETE FROM bookings');
db.exec('DELETE FROM properties');
db.exec("DELETE FROM sqlite_sequence WHERE name='properties' OR name='bookings'");

// ============================================================
// 12 Properties — realistic Korean accommodations
// ============================================================
const properties = [
  {
    name: '코지 강남 스튜디오',
    address: '서울 서초구 강남대로53길 25-3',
    description: '코엑스와 삼성역 인근의 모던한 스튜디오. 간이 주방과 세탁기 완비. 출장자에게 최적입니다.',
    platforms: ['airbnb', 'booking'],
    tags: ['📈 예약 증가 중'],
  },
  {
    name: '홍대 아티스트 로프트',
    address: '서울 마포구 와우산로29다길 17',
    description: '홍대 중심부의 넓은 로프트형 숙소. 클럽, 카페, 대중교통이 도보 거리입니다.',
    platforms: ['airbnb', 'liveanywhere'],
    tags: [],
  },
  {
    name: '성수 미니멀 플랫',
    address: '서울 성동구 성수이로7길 49',
    description: '트렌디한 성수동의 미니멀리스트 디자인 플랫. 인근 숲공원과 수제 카페가 있습니다.',
    platforms: ['airbnb', 'booking', 'liveanywhere'],
    tags: ['🏆 수익률 1위'],
  },
  {
    name: '용산 리버뷰 하우스',
    address: '서울 용산구 이촌로 72길 12',
    description: '한강이 내려다보이는 고급 레지던스. 넓은 거실과 오픈 키친, 와인 셀러 완비.',
    platforms: ['airbnb', 'booking'],
    tags: ['💰 고객단가 TOP3'],
  },
  {
    name: '이태원 힐탑 스위트',
    address: '서울 용산구 이태원로 45길 21-7',
    description: '남산 뷰의 힐탑 스위트. 루프탑 테라스에서 서울 야경을 즐기세요.',
    platforms: ['airbnb', 'liveanywhere'],
    tags: [],
  },
  {
    name: '종로 한옥 게스트하우스',
    address: '서울 종로구 북촌로 11길 28',
    description: '북촌 한옥마을의 전통 한옥을 개조한 게스트하우스. 온돌방과 마당 정원.',
    platforms: ['airbnb', 'booking'],
    tags: [],
  },
  {
    name: '서촌 감성 주택',
    address: '서울 종로구 자하문로 16길 3-5',
    description: '경복궁 서편 조용한 주택가의 감성 숙소. 작은 정원과 갤러리 공간.',
    platforms: ['airbnb', 'booking', 'liveanywhere'],
    tags: [],
  },
  {
    name: '해운대 오션뷰 레지던스',
    address: '부산 해운대구 우동 612-8',
    description: '해운대 해변 바로 앞 오션뷰 레지던스. 커플 여행객에게 인기.',
    platforms: ['airbnb', 'booking'],
    tags: [],
  },
  {
    name: '제주 애월 바다집',
    address: '제주시 애월읍 애월해안로 567',
    description: '제주 서부 해안가의 단독 숙소. 넓은 마당과 바비큐 시설 완비.',
    platforms: ['airbnb', 'liveanywhere'],
    tags: [],
  },
  {
    name: '제주 성산의 뜨락',
    address: '제주 서귀포시 성산읍 일출로 214',
    description: '성산일출봉 인근의 조용한 전원주택. 여유로운 힐링 공간.',
    platforms: ['airbnb', 'booking'],
    tags: [],
  },
  {
    name: '여수 밤바다 펜션',
    address: '전남 여수시 돌산읍 돌산로 887-12',
    description: '여수 밤바다가 보이는 감성 펜션. 돌산갓김치와 게장 맛집 인근.',
    platforms: ['airbnb', 'booking', 'liveanywhere'],
    tags: [],
  },
  {
    name: '속초 바다뷰 스테이',
    address: '강원 속초시 대포동 347-1',
    description: '동해바다가 한눈에 보이는 뷰 맛집. 대포항 활어회와 설악산 국립공원 인근.',
    platforms: ['airbnb', 'booking'],
    tags: ['⭐ 게스트 만족도 높음'],
  },
];

const insertProperty = db.prepare(
  'INSERT INTO properties (name, address, description, platforms, photos, tags) VALUES (?, ?, ?, ?, ?, ?)'
);

const propertyIds = [];
for (const p of properties) {
  const result = insertProperty.run(
    p.name, p.address, p.description,
    JSON.stringify(p.platforms),
    JSON.stringify([]),
    JSON.stringify(p.tags || [])
  );
  propertyIds.push(Number(result.lastInsertRowid));
}

console.log(`✅ ${properties.length}개 숙소 데이터 생성 완료`);

// ============================================================
// 120 Bookings — evenly distributed across 2026 (10/month)
// ============================================================

const guestNames = [
  '김민지', '박재현', '이수영', '최유나', '정태우', '강서연', '윤도현', '한지민',
  '송미경', '이상호', '김태희', '박준호', '배수진', '유재민', '전혜진', '현승우',
  '김은정', '이종민', '하지영', '강민수', '서현주', '임성민', '신세영', '차승민',
  'Emma Wilson', 'John Smith', 'Sarah Johnson', 'Michael Chen', 'Lisa Park',
  'David Kim', 'Anna Müller', 'James Brown', 'Yuki Tanaka', 'Maria Garcia',
  'Tomás Rivera', 'Natalie Wong', 'Pierre Dubois', 'Aiko Sato', 'Oliver Lee',
  'Sophie Martin', 'Liam O\'Brien', 'Mei Lin', 'Carlos Ruiz', 'Hannah Weber',
];

const propertyWeights = [12, 10, 12, 8, 8, 10, 8, 10, 8, 10, 12, 12]; // total = 120

// Distribute 120 bookings across properties proportionally
function distributeBookings(total, weights) {
  const result = [];
  let remaining = total;
  const sum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    const count = i === weights.length - 1
      ? remaining
      : Math.round((weights[i] / sum) * total);
    result.push(count);
    remaining -= count;
  }
  return result;
}

const countsPerProperty = distributeBookings(120, propertyWeights);

// Generate a booking amount based on property index and randomness
function generateAmount(propIdx) {
  // Base amounts by property tier
  const baseAmounts = [120000, 150000, 110000, 250000, 200000, 100000, 130000, 180000, 160000, 140000, 150000, 170000];
  const base = baseAmounts[propIdx % baseAmounts.length];
  const nightlyRate = base + Math.round((Math.random() - 0.5) * 60000);
  const nights = [1, 2, 2, 3, 1, 3, 2, 4, 2, 1, 3, 2][Math.floor(Math.random() * 12)];
  return nightlyRate * nights;
}

function randomDate(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = 1 + Math.floor(Math.random() * daysInMonth);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const platforms = ['airbnb', 'booking', 'liveanywhere'];
const statuses = ['upcoming', 'checked_in', 'checked_out', 'cancelled'];
const statusWeights = [0.35, 0.10, 0.45, 0.10]; // mostly upcoming + checked_out

function pickWeighted(items, weights) {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < items.length; i++) {
    cum += weights[i];
    if (r <= cum) return items[i];
  }
  return items[items.length - 1];
}

const reviewNotes = [
  '조용한 게스트, 깔끔하게 사용했습니다.',
  '친절한 가족 단위 손님이었어요.',
  '숙소를 깨끗이 사용해주고 갔습니다.',
  '1일 연장했습니다.',
  '다시 방문하고 싶다고 했어요.',
  '체크인 시간보다 일찍 도착했으나 양해해주셨어요.',
  '생일 여행이었는데 너무 좋아했어요.',
  '주변 맛집 추천해달라고 하셨어요.',
  '다음에도 예약 의사 밝혔습니다.',
  '커플 여행객, 로맨틱한 분위기 좋아했어요.',
  '출장 방문객, 와이파이 안정적이라고 만족.',
  '외국인 관광객, 한국 전통문화에 관심 많았음.',
  '반려동물 동반, 깔끔하게 사용했습니다.',
  '',
  '',
  '',
  '',
];

const insertBooking = db.prepare(
  `INSERT INTO bookings (property_id, guest_name, check_in, check_out, status, platform, amount, settlement_date, notes)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

let bookingId = 0;
let guestIdx = 0;

for (let propIdx = 0; propIdx < propertyIds.length; propIdx++) {
  const pid = propertyIds[propIdx];
  const count = countsPerProperty[propIdx];

  for (let b = 0; b < count; b++) {
    bookingId++;

    // Assign guest cycling through list
    const guestName = guestNames[guestIdx % guestNames.length];
    guestIdx++;

    // Distribute month evenly across the year
    const month = ((bookingId - 1) % 12) + 1;

    // Pick check-in date (avoid weekends bias slightly)
    let checkIn = randomDate(2026, month);

    // Stay length: 1-4 nights
    const stayLength = 1 + Math.floor(Math.random() * 4);
    const checkOut = addDays(checkIn, stayLength);

    // Status — recent months more likely upcoming/future
    const statusMonth = month;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();

    let status;
    if (currentYear > 2026 || (currentYear === 2026 && statusMonth > currentMonth + 1)) {
      // Future months — mostly upcoming, some cancelled
      status = Math.random() < 0.2 ? 'cancelled' : 'upcoming';
    } else if (currentYear === 2026 && statusMonth === currentMonth + 1) {
      // Next month — mix
      status = pickWeighted(statuses, [0.5, 0.2, 0.2, 0.1]);
    } else if (currentYear === 2026 && statusMonth === currentMonth) {
      // This month — active mix
      status = pickWeighted(statuses, [0.2, 0.35, 0.35, 0.1]);
    } else {
      // Past months — mostly checked_out, some cancelled
      status = Math.random() < 0.85 ? 'checked_out' : 'cancelled';
    }

    // Platform (properties[propIdx].platforms is already a JS array, not a JSON string)
    const propertyPlatforms = properties[propIdx].platforms;
    const platform = propertyPlatforms[Math.floor(Math.random() * propertyPlatforms.length)];

    // Amount
    const amount = generateAmount(propIdx);
    const notes = reviewNotes[Math.floor(Math.random() * reviewNotes.length)];

    // Settlement date: 3-7 days after checkout (null for cancelled/upcoming in far future)
    let settlementDate = null;
    if (status !== 'cancelled') {
      const settlementOffset = 3 + Math.floor(Math.random() * 5);
      settlementDate = addDays(checkOut, settlementOffset);
    }

    insertBooking.run(
      pid, guestName, checkIn, checkOut, status, platform, amount, settlementDate, notes
    );
  }
}

// Count results
const propCount = db.prepare('SELECT COUNT(*) as count FROM properties').get();
const bookingCount = db.prepare('SELECT COUNT(*) as count FROM bookings').get();

console.log(`✅ 시드 데이터 생성 완료:`);
console.log(`   🏠 숙소: ${propCount.count}개`);
console.log(`   📋 예약: ${bookingCount.count}개 (2026년 12개월 분포)`);
console.log(`   👤 게스트: ${guestNames.length}명`);

// Show monthly breakdown
const monthlyBreakdown = db.prepare(`
  SELECT strftime('%m', check_in) as month, COUNT(*) as count
  FROM bookings
  GROUP BY strftime('%m', check_in)
  ORDER BY month
`).all();
console.log(`   📊 월별 분포: ${monthlyBreakdown.map(r => `${r.month}월=${r.count}건`).join(', ')}`);

const statusBreakdown = db.prepare(`
  SELECT status, COUNT(*) as count
  FROM bookings
  GROUP BY status
`).all();
console.log(`   📊 상태별 분포: ${statusBreakdown.map(r => `${r.status}=${r.count}건`).join(', ')}`);
