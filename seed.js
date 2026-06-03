import { getDb } from './server/db.js';

const db = getDb();

// Clear existing data
db.exec('DELETE FROM bookings');
db.exec('DELETE FROM properties');
db.exec("DELETE FROM sqlite_sequence WHERE name='properties' OR name='bookings'");

// Properties
const properties = [
  {
    name: '코지 강남 스튜디오',
    address: '서울 서초구 강남대로53길 25-3',
    description: '코엑스와 삼성역 인근의 모던한 스튜디오. 간이 주방과 세탁기 완비. 출장자에게 최적입니다.',
    platforms: ['airbnb', 'booking'],
    photos: [],
  },
  {
    name: '홍대 아티스트 로프트',
    address: '서울 마포구 와우산로29다길 17',
    description: '홍대 중심부의 넓은 로프트형 숙소. 클럽, 카페, 대중교통이 도보 거리입니다.',
    platforms: ['airbnb', 'liveanywhere'],
    photos: [],
  },
  {
    name: '성수 미니멀 플랫',
    address: '서울 성동구 성수이로7길 49',
    description: '트렌디한 성수동의 미니멀리스트 디자인 플랫. 인근 숲공원과 수제 카페가 있습니다.',
    platforms: ['airbnb', 'booking', 'liveanywhere'],
    photos: [],
  },
];

const insertProperty = db.prepare(
  'INSERT INTO properties (name, address, description, platforms, photos) VALUES (?, ?, ?, ?, ?)'
);

const propertyIds = [];
for (const p of properties) {
  const result = insertProperty.run(
    p.name, p.address, p.description,
    JSON.stringify(p.platforms),
    JSON.stringify(p.photos)
  );
  propertyIds.push(result.lastInsertRowid);
}

// Bookings — today-anchored dates
const today = new Date();
const y = today.getFullYear();
const m = String(today.getMonth() + 1).padStart(2, '0');

function dateStr(dayOffset) {
  const d = new Date(today);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

const bookings = [
  // Cozy Gangnam Studio — 3 bookings
  {
    property_id: propertyIds[0],
    guest_name: '김민지',
    check_in: dateStr(-3),
    check_out: dateStr(-1),
    status: 'checked_out',
    platform: 'airbnb',
    amount: 450000,
    settlement_date: dateStr(4),
    notes: '조용한 게스트, 깔끔하게 사용했습니다.',
  },
  {
    property_id: propertyIds[0],
    guest_name: '박재현',
    check_in: dateStr(5),
    check_out: dateStr(8),
    status: 'upcoming',
    platform: 'booking',
    amount: 520000,
    settlement_date: dateStr(15),
    notes: '',
  },
  {
    property_id: propertyIds[0],
    guest_name: '이수영',
    check_in: dateStr(-8),
    check_out: dateStr(-5),
    status: 'checked_out',
    platform: 'airbnb',
    amount: 380000,
    settlement_date: dateStr(-1),
    notes: '1일 연장했습니다.',
  },
  // Hongdae Artist Loft — 2 bookings
  {
    property_id: propertyIds[1],
    guest_name: '최유나',
    check_in: dateStr(1),
    check_out: dateStr(4),
    status: 'upcoming',
    platform: 'liveanywhere',
    amount: 680000,
    settlement_date: dateStr(12),
    notes: '생일 여행입니다.',
  },
  {
    property_id: propertyIds[1],
    guest_name: '정태우',
    check_in: dateStr(-2),
    check_out: dateStr(1),
    status: 'checked_in',
    platform: 'airbnb',
    amount: 490000,
    settlement_date: dateStr(8),
    notes: '',
  },
  // Seongsu Minimal Flat — 1 booking
  {
    property_id: propertyIds[2],
    guest_name: '해나 밀러',
    check_in: dateStr(3),
    check_out: dateStr(6),
    status: 'upcoming',
    platform: 'booking',
    amount: 410000,
    settlement_date: dateStr(14),
    notes: '싱가포르에서 온 관광객.',
  },
];

const insertBooking = db.prepare(
  `INSERT INTO bookings (property_id, guest_name, check_in, check_out, status, platform, amount, settlement_date, notes)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

for (const b of bookings) {
  insertBooking.run(
    b.property_id, b.guest_name, b.check_in, b.check_out,
    b.status, b.platform, b.amount, b.settlement_date, b.notes
  );
}

console.log(`✅ 시드 데이터 생성 완료: ${properties.length}개 숙소, ${bookings.length}개 예약`);
console.log(`📅 기준 날짜: 오늘=${dateStr(0)}, 월=${y}-${m}`);
