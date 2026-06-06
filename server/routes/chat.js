import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Dashboard keywords to detect canvas requests
const DASHBOARD_KEYWORDS = ['대시보드', '대쉬보드', '캔버스', 'canvas', '만들어줘', '만들어 봐', '만들어달라', '보기 좋게', '한눈에', '시각화', '이 대화를 토대로', '지금까지 얘기'];

function isDashboardRequest(messages) {
  if (!messages || messages.length === 0) return false;
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) return false;
  const text = lastUser.content || '';
  return DASHBOARD_KEYWORDS.some(kw => text.includes(kw));
}

function buildAutoCanvas(messages) {
  const db = getDb();
  const yearRow = db.prepare("SELECT strftime('%Y', MAX(check_in)) as year FROM bookings").get();
  const thisYear = (yearRow && yearRow.year) || new Date().getFullYear().toString();

  // Detect if the conversation mentions a specific month
  let focusMonth = null;
  if (messages) {
    const allText = messages.map(m => m.content || '').join(' ');
    const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const monthNamesFull = ['일월','이월','삼월','사월','오월','유월','칠월','팔월','구월','시월','십일월','십이월'];
    // Check for "N월" patterns (e.g., "6월 수익", "7월 예약")
    const monthMatch = allText.match(/(\d{1,2})월/);
    if (monthMatch) {
      focusMonth = parseInt(monthMatch[1]);
    }
  }

  // If a specific month is mentioned, get data for that month + annual
  const targetYear = thisYear;

  // For aggregate data: use the specific month if detected, else full year
  const timeFilter = focusMonth
    ? `strftime('%m', check_in) = '${String(focusMonth).padStart(2, '0')}' AND strftime('%Y', check_in) = '${targetYear}'`
    : `strftime('%Y', check_in) = '${targetYear}'`;

  // Summary data
  const totalStats = db.prepare(`
    SELECT COUNT(*) as totalBookings, SUM(amount) as totalRevenue, AVG(amount) as avgRate
    FROM bookings WHERE ${timeFilter} AND status != 'cancelled'
  `).get();

  let occupancyRate;
  if (focusMonth) {
    const daysInMonth = new Date(parseInt(targetYear), focusMonth, 0).getDate();
    const occ = db.prepare(`
      SELECT COUNT(DISTINCT check_in) as days FROM bookings
      WHERE ${timeFilter} AND status != 'cancelled'
    `).get();
    occupancyRate = Math.round((occ.days / daysInMonth) * 100);
  } else {
    const totalDays = db.prepare(`
      SELECT COUNT(DISTINCT check_in) as days FROM bookings
      WHERE ${timeFilter} AND status != 'cancelled'
    `).get();
    occupancyRate = Math.round((totalDays.days / 365) * 100);
  }

  // Monthly revenue
  const monthlyRevenue = db.prepare(`
    SELECT strftime('%m', check_in) as month, SUM(amount) as revenue, COUNT(*) as bookings
    FROM bookings WHERE strftime('%Y', check_in) = ? AND status != 'cancelled'
    GROUP BY strftime('%m', check_in) ORDER BY month
  `).all(targetYear);

  // Platform revenue
  const platformRevenue = db.prepare(`
    SELECT platform, SUM(amount) as revenue, COUNT(*) as bookings
    FROM bookings WHERE ${timeFilter} AND status != 'cancelled'
    GROUP BY platform
  `).all();

  // Status distribution (full year)
  const statusDistribution = db.prepare(`
    SELECT status, COUNT(*) as count FROM bookings
    WHERE strftime('%Y', check_in) = ? GROUP BY status
  `).all(targetYear);

  // Property ranking
  const propertyRanking = db.prepare(`
    SELECT p.name as property_name, COUNT(*) as booking_count, SUM(b.amount) as total_revenue, AVG(b.amount) as avg_rate
    FROM bookings b JOIN properties p ON b.property_id = p.id
    WHERE ${timeFilter} AND b.status != 'cancelled'
    GROUP BY b.property_id ORDER BY total_revenue DESC LIMIT 5
  `).all();

  const title = focusMonth ? `${focusMonth}월 대시보드` : '전체 대시보드';

  const items = [
    {
      type: 'chart', id: 'c1',
      props: { chartType: 'summary', title: focusMonth ? `${focusMonth}월 통계` : '종합 통계', data: {
        totalRevenue: totalStats.totalRevenue || 0,
        totalBookings: totalStats.totalBookings || 0,
        avgRate: Math.round(totalStats.avgRate || 0),
        occupancyRate,
      }},
    },
    {
      type: 'chart', id: 'c2',
      props: { chartType: 'revenue', title: '월별 수익', data: monthlyRevenue.map(r => ({
        month: r.month, revenue: r.revenue || 0, bookings: r.bookings || 0,
      }))},
    },
    {
      type: 'chart', id: 'c3',
      props: { chartType: 'platform', title: focusMonth ? `${focusMonth}월 플랫폼별 수익` : '플랫폼별 수익', data: platformRevenue.map(r => ({
        platform: r.platform, revenue: r.revenue || 0, bookings: r.bookings || 0,
      }))},
    },
    {
      type: 'chart', id: 'c4',
      props: { chartType: 'property-ranking', title: focusMonth ? `${focusMonth}월 숙소별 수익 TOP5` : '숙소별 수익 TOP5', sortBy: 'revenue', data: propertyRanking.map(r => ({
        property_name: r.property_name, booking_count: r.booking_count,
        total_revenue: r.total_revenue || 0, avg_rate: Math.round(r.avg_rate || 0),
      }))},
    },
    {
      type: 'chart', id: 'c5',
      props: { chartType: 'status', title: '예약 상태 분포', data: statusDistribution.map(r => ({
        status: r.status, count: r.count,
      }))},
    },
  ];

  return { title, items };
}

// ===== Tool Definitions =====

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_bookings',
      description: '예약 정보를 검색합니다. 날짜 범위, 게스트명, 숙소명, 상태 등으로 필터링 가능합니다.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: '예약 ID로 직접 조회 (단건)' },
          date_from: { type: 'string', description: '검색 시작일 (YYYY-MM-DD). 생략시 전체 기간' },
          date_to: { type: 'string', description: '검색 종료일 (YYYY-MM-DD). 생략시 전체 기간' },
          guest_name: { type: 'string', description: '게스트명으로 검색 (부분일치)' },
          property_name: { type: 'string', description: '숙소명으로 검색 (부분일치)' },
          status: { type: 'string', enum: ['upcoming', 'checked_in', 'checked_out', 'cancelled'], description: '예약 상태로 필터링' },
          platform: { type: 'string', enum: ['airbnb', 'booking', 'liveanywhere'], description: '플랫폼으로 필터링' },
          limit: { type: 'number', description: '최대 결과 수 (기본 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_dashboard_summary',
      description: '대시보드 요약 정보를 가져옵니다. 오늘의 체크인/체크아웃, 이번달 수익/예약건수/점유율, 정산 예정 내역을 반환합니다.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_properties',
      description: '숙소 정보를 검색합니다.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '숙소명 또는 주소로 검색 (부분일치)' },
          id: { type: 'number', description: '숙소 ID로 직접 조회' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_calendar',
      description: '특정 월의 캘린더 데이터를 가져옵니다. 날짜별로 그룹화된 예약 목록을 반환합니다.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'number', description: '월 (1-12)' },
          year: { type: 'number', description: '연도 (예: 2026)' },
        },
        required: ['month', 'year'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_chart_data',
      description: '대시보드 차트 데이터를 가져옵니다. 월별 수익, 플랫폼별 수익, 월별 점유율, 상태 분포를 반환합니다. (숙소별 통계는 get_booking_stats_by_property를 사용하세요)',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_booking_stats_by_property',
      description: '숙소별 예약 통계를 반환합니다. 예약 건수 순으로 정렬되어 있어 "예약이 가장 많은 숙소", "수익이 가장 높은 숙소" 등을 알 수 있습니다. 특정 숙소 하나만 조회할 때는 property_id를 사용하세요. (참고: group_by 파라미터는 없습니다 — 플랫폼별 분석은 search_bookings()를 써야 함)',
      parameters: {
        type: 'object',
        properties: {
          property_id: { type: 'number', description: '특정 숙소 ID로 필터링 (단건 조회). 플랫폼별/월별 등 세부 분석은 안 되고 전체 합계만 반환합니다.' },
          sort_by: { type: 'string', enum: ['booking_count', 'revenue'], description: '정렬 기준 (기본: booking_count)' },
          year: { type: 'number', description: '연도 필터 (기본: 전체)' },
          limit: { type: 'number', description: '최대 결과 수 (기본: 전체)' },
          exclude_cancelled: { type: 'boolean', description: '취소된 예약 제외 여부 (기본: true)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_db_schema',
      description: '데이터베이스의 테이블 구조(컬럼명, 타입)를 반환합니다. execute_sql()을 사용하기 전에 먼저 호출해서 테이블 구조를 파악하세요.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_sql',
      description: '읽기 전용 SQL SELECT 쿼리를 실행합니다. 자유로운 데이터 분석이 필요할 때 사용하세요. JOIN, GROUP BY, WHERE, ORDER BY, LIMIT, LIKE, COUNT, SUM, AVG 등 모든 SELECT 구문이 가능합니다.',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: '실행할 SQL SELECT 문. SELECT로 시작해야 하며, INSERT/UPDATE/DELETE/DROP/ALTER/CREATE는 허용되지 않습니다. 예: "SELECT p.name, COUNT(*) as cnt FROM bookings b JOIN properties p ON b.property_id = p.id GROUP BY b.property_id ORDER BY cnt DESC LIMIT 5"' },
          params: { type: 'array', items: { type: 'string' }, description: 'SQL ? 플레이스홀더에 바인딩할 값들 (선택사항)' },
        },
        required: ['sql'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_property_tag',
      description: '숙소에 태그/라벨을 추가합니다. 사용자가 "이 숙소에 수익률 1위 라벨 붙여줘" 라고 하면 이 툴을 사용하세요. (데이터 조작 툴 — 주의해서 사용)',
      parameters: {
        type: 'object',
        properties: {
          property_id: { type: 'number', description: '태그를 추가할 숙소 ID' },
          tag: { type: 'string', description: '추가할 태그 문자열 (예: "🏆 수익률 1위", "💰 고객단가 TOP3", "📈 예약 증가 중")' },
        },
        required: ['property_id', 'tag'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_property_tag',
      description: '숙소의 태그/라벨을 제거합니다.',
      parameters: {
        type: 'object',
        properties: {
          property_id: { type: 'number', description: '태그를 제거할 숙소 ID' },
          tag: { type: 'string', description: '제거할 태그 문자열' },
        },
        required: ['property_id', 'tag'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_booking_status',
      description: '예약 상태를 변경합니다. 사용자가 "예약 1번을 체크인으로 바꿔줘" 라고 하면 이 툴을 사용하세요. (데이터 조작 툴 — 주의해서 사용)',
      parameters: {
        type: 'object',
        properties: {
          booking_id: { type: 'number', description: '상태를 변경할 예약 ID' },
          status: { type: 'string', enum: ['upcoming', 'checked_in', 'checked_out', 'cancelled'], description: '변경할 상태' },
        },
        required: ['booking_id', 'status'],
      },
    },
  },
];

// ===== Tool Implementations =====

function executeTool(name, args) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  switch (name) {
    case 'search_bookings': {
      const { date_from, date_to, guest_name, property_name, status, platform, limit = 20, id } = args || {};
      let sql = `SELECT b.*, p.name AS property_name FROM bookings b JOIN properties p ON b.property_id = p.id WHERE 1=1`;
      const params = [];

      if (id) {
        sql += ` AND b.id = ?`;
        params.push(id);
        const row = db.prepare(sql).get(...params);
        if (!row) return [];
        return [{
          id: row.id,
          guest_name: row.guest_name,
          property_name: row.property_name,
          property_id: row.property_id,
          check_in: row.check_in,
          check_out: row.check_out,
          status: row.status,
          platform: row.platform,
          amount: row.amount,
          settlement_date: row.settlement_date,
          notes: row.notes,
        }];
      }

      if (date_from) { sql += ` AND b.check_in >= ?`; params.push(date_from); }
      if (date_to) { sql += ` AND b.check_in <= ?`; params.push(date_to); }
      if (guest_name) { sql += ` AND b.guest_name LIKE ?`; params.push(`%${guest_name}%`); }
      if (property_name) { sql += ` AND p.name LIKE ?`; params.push(`%${property_name}%`); }
      if (status) { sql += ` AND b.status = ?`; params.push(status); }
      if (platform) { sql += ` AND b.platform = ?`; params.push(platform); }

      sql += ` ORDER BY b.check_in ASC LIMIT ?`;
      params.push(limit);

      const rows = db.prepare(sql).all(...params);
      return rows.map(r => ({
        id: r.id,
        guest_name: r.guest_name,
        property_name: r.property_name,
        property_id: r.property_id,
        check_in: r.check_in,
        check_out: r.check_out,
        status: r.status,
        platform: r.platform,
        amount: r.amount,
        settlement_date: r.settlement_date,
        notes: r.notes,
      }));
    }

    case 'get_dashboard_summary': {
      const thisMonth = today.slice(5, 7);
      const thisYear = today.slice(0, 4);
      const daysInMonth = new Date(parseInt(thisYear), parseInt(thisMonth), 0).getDate();

      const todayCheckins = db.prepare(`SELECT COUNT(*) as count, SUM(amount) as revenue FROM bookings WHERE check_in = ? AND status != 'cancelled'`).get(today);
      const todayCheckouts = db.prepare(`SELECT COUNT(*) as count FROM bookings WHERE check_out = ? AND status != 'cancelled'`).get(today);
      const monthStats = db.prepare(`SELECT COUNT(*) as total_bookings, SUM(amount) as total_revenue, AVG(amount) as avg_rate FROM bookings WHERE strftime('%m', check_in) = ? AND strftime('%Y', check_in) = ? AND status != 'cancelled'`).get(thisMonth, thisYear);
      const settlements = db.prepare(`SELECT COUNT(*) as count, SUM(amount) as total FROM bookings WHERE settlement_date IS NOT NULL AND strftime('%m', settlement_date) = ? AND strftime('%Y', settlement_date) = ? AND settlement_date >= ? AND status != 'cancelled'`).get(thisMonth, thisYear, today);
      const occupiedDays = db.prepare(`SELECT COUNT(DISTINCT check_in) as days FROM bookings WHERE strftime('%m', check_in) = ? AND strftime('%Y', check_in) = ? AND status != 'cancelled'`).get(thisMonth, thisYear);
      const platformRevenue = db.prepare(`SELECT platform, COUNT(*) as bookings, SUM(amount) as revenue FROM bookings WHERE strftime('%m', check_in) = ? AND strftime('%Y', check_in) = ? AND status != 'cancelled' GROUP BY platform`).all(thisMonth, thisYear);
      const recentBookings = db.prepare(`SELECT b.*, p.name AS property_name FROM bookings b JOIN properties p ON b.property_id = p.id ORDER BY b.created_at DESC LIMIT 5`).all();

      return {
        today: { checkIns: todayCheckins.count || 0, checkInRevenue: todayCheckins.revenue || 0, checkOuts: todayCheckouts.count || 0 },
        month: {
          totalBookings: monthStats.total_bookings || 0,
          totalRevenue: monthStats.total_revenue || 0,
          avgRate: Math.round(monthStats.avg_rate || 0),
          occupancyRate: Math.round((occupiedDays.days / daysInMonth) * 100),
        },
        settlements: { count: settlements.count || 0, total: settlements.total || 0 },
        platformRevenue: platformRevenue.map(p => ({ platform: p.platform, bookings: p.bookings, revenue: p.revenue })),
        recentBookings: recentBookings.map(r => ({ ...r, status_label: r.status })),
      };
    }

    case 'search_properties': {
      const { query, id } = args || {};
      if (id) {
        const row = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
        if (!row) return [];
        return [{ ...row, photos: JSON.parse(row.photos || '[]'), platforms: JSON.parse(row.platforms || '[]') }];
      }
      if (query) {
        const rows = db.prepare('SELECT * FROM properties WHERE name LIKE ? OR address LIKE ? ORDER BY updated_at DESC').all(`%${query}%`, `%${query}%`);
        return rows.map(r => ({ ...r, photos: JSON.parse(r.photos || '[]'), platforms: JSON.parse(r.platforms || '[]') }));
      }
      const rows = db.prepare('SELECT * FROM properties ORDER BY updated_at DESC').all();
      return rows.map(r => ({ ...r, photos: JSON.parse(r.photos || '[]'), platforms: JSON.parse(r.platforms || '[]') }));
    }

    case 'get_calendar': {
      const { month, year } = args || {};
      if (!month || !year) return { error: 'month and year required' };
      const rows = db.prepare(`SELECT b.*, p.name AS property_name FROM bookings b JOIN properties p ON b.property_id = p.id WHERE strftime('%m', b.check_in) = ? AND strftime('%Y', b.check_in) = ? ORDER BY b.check_in ASC`).all(String(month).padStart(2, '0'), String(year));
      const grouped = {};
      for (const row of rows) {
        const date = row.check_in;
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(row);
      }
      return grouped;
    }

    case 'get_chart_data': {
      const yearRow = db.prepare("SELECT strftime('%Y', MAX(check_in)) as year FROM bookings").get();
      const thisYear = (yearRow && yearRow.year) || new Date().getFullYear().toString();
      const monthlyRevenue = db.prepare(`
        SELECT strftime('%m', check_in) as month, SUM(amount) as revenue, COUNT(*) as bookings
        FROM bookings WHERE strftime('%Y', check_in) = ? AND status != 'cancelled'
        GROUP BY strftime('%m', check_in) ORDER BY month
      `).all(thisYear);
      const platformRevenue = db.prepare(`
        SELECT platform, SUM(amount) as revenue, COUNT(*) as bookings
        FROM bookings WHERE strftime('%Y', check_in) = ? AND status != 'cancelled'
        GROUP BY platform
      `).all(thisYear);
      const monthlyOccupancy = db.prepare(`
        SELECT strftime('%m', check_in) as month, COUNT(DISTINCT check_in) as occupied_days, COUNT(*) as bookings
        FROM bookings WHERE strftime('%Y', check_in) = ? AND status != 'cancelled'
        GROUP BY strftime('%m', check_in) ORDER BY month
      `).all(thisYear);
      const statusDistribution = db.prepare(`
        SELECT status, COUNT(*) as count
        FROM bookings WHERE strftime('%Y', check_in) = ?
        GROUP BY status
      `).all(thisYear);
      const monthlyPlatform = db.prepare(`
        SELECT strftime('%m', check_in) as month, platform, SUM(amount) as revenue
        FROM bookings WHERE strftime('%Y', check_in) = ? AND status != 'cancelled'
        GROUP BY strftime('%m', check_in), platform ORDER BY month, platform
      `).all(thisYear);
      return { monthlyRevenue, platformRevenue, monthlyOccupancy, statusDistribution, monthlyPlatform };
    }

    case 'get_booking_stats_by_property': {
      const { sort_by = 'booking_count', year, limit, exclude_cancelled = true, property_id } = args || {};
      let sql = `SELECT p.id, p.name, COUNT(*) as booking_count, SUM(b.amount) as total_revenue, AVG(b.amount) as avg_rate, p.platforms`;
      sql += ` FROM bookings b JOIN properties p ON b.property_id = p.id WHERE 1=1`;
      const params = [];
      if (exclude_cancelled) { sql += ` AND b.status != 'cancelled'`; }
      if (year) { sql += ` AND strftime('%Y', b.check_in) = ?`; params.push(String(year)); }
      if (property_id) { sql += ` AND b.property_id = ?`; params.push(property_id); }
      sql += ` GROUP BY b.property_id ORDER BY ${sort_by === 'revenue' ? 'total_revenue' : 'booking_count'} DESC`;
      if (limit) { sql += ` LIMIT ?`; params.push(limit); }

      const rows = db.prepare(sql).all(...params);
      return rows.map(r => ({
        property_id: r.id,
        property_name: r.name,
        booking_count: r.booking_count,
        total_revenue: r.total_revenue || 0,
        avg_rate: Math.round(r.avg_rate || 0),
        platforms: JSON.parse(r.platforms || '[]'),
      }));
    }

    case 'get_db_schema': {
      const db = getDb();
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
      const schema = tables.map(t => {
        const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
        return {
          table: t.name,
          columns: cols.map(c => ({
            name: c.name,
            type: c.type,
            notnull: !!c.notnull,
            pk: !!c.pk,
          })),
          row_count: db.prepare(`SELECT COUNT(*) as cnt FROM ${t.name}`).get().cnt,
        };
      });
      return schema;
    }

    case 'execute_sql': {
      const { sql } = args || {};
      if (!sql || typeof sql !== 'string') return { error: 'sql parameter is required' };
      
      // Security: only allow SELECT statements
      const trimmed = sql.trim().replace(/\/\*.*?\*\//gs, ''); // strip comments
      if (!/^SELECT\b/i.test(trimmed)) {
        return { error: 'Only SELECT queries are allowed' };
      }
      const dangerous = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|VACUUM|REINDEX|PRAGMA\s+(?!table_info))\b/i;
      if (dangerous.test(trimmed)) {
        return { error: 'Only SELECT queries are allowed' };
      }

      try {
        const db = getDb();
        const params = args.params || [];
        const stmt = db.prepare(trimmed);
        const rows = stmt.all(...params);
        // Limit results to prevent huge responses
        if (rows.length > 200) {
          return {
            truncated: true,
            total_rows: rows.length,
            rows: rows.slice(0, 200),
          };
        }
        return rows;
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'add_property_tag': {
      const { property_id, tag } = args || {};
      if (!property_id || !tag) return { error: 'property_id and tag are required' };
      const db = getDb();
      const existing = db.prepare('SELECT tags FROM properties WHERE id = ?').get(property_id);
      if (!existing) return { error: 'Property not found' };
      const currentTags = JSON.parse(existing.tags || '[]');
      if (currentTags.includes(tag)) return { ok: true, tags: currentTags, message: '이미 있는 태그입니다' };
      const newTags = [...currentTags, tag];
      db.prepare("UPDATE properties SET tags = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(newTags), property_id);
      return { ok: true, tags: newTags, message: `"${tag}" 태그가 추가되었습니다` };
    }

    case 'remove_property_tag': {
      const { property_id, tag } = args || {};
      if (!property_id || !tag) return { error: 'property_id and tag are required' };
      const db = getDb();
      const existing = db.prepare('SELECT tags FROM properties WHERE id = ?').get(property_id);
      if (!existing) return { error: 'Property not found' };
      const currentTags = JSON.parse(existing.tags || '[]');
      if (!currentTags.includes(tag)) return { ok: true, tags: currentTags, message: '해당 태그가 없습니다' };
      const filtered = currentTags.filter(t => t !== tag);
      db.prepare("UPDATE properties SET tags = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(filtered), property_id);
      return { ok: true, tags: filtered, message: `"${tag}" 태그가 제거되었습니다` };
    }

    case 'update_booking_status': {
      const { booking_id, status } = args || {};
      if (!booking_id || !status) return { error: 'booking_id and status are required' };
      const validStatuses = ['upcoming', 'checked_in', 'checked_out', 'cancelled'];
      if (!validStatuses.includes(status)) return { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
      const db = getDb();
      const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id);
      if (!existing) return { error: 'Booking not found' };
      db.prepare("UPDATE bookings SET status = ?, notes = CASE WHEN notes = '' THEN ? ELSE notes || ' | ' || ? END WHERE id = ?")
        .run(status, `상태가 ${existing.status}에서 ${status}로 변경됨`, `상태가 ${existing.status}에서 ${status}로 변경됨`, booking_id);
      const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id);
      return { ok: true, booking: updated, message: `예약 #${booking_id} 상태가 ${status}로 변경되었습니다` };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ===== System Prompt =====

function getSystemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a helpful host admin assistant for "Warm Stay" — a property management tool for Korean hosts.

Today's date is ${today}. Use this to calculate relative dates.

## Response format

Always respond with a JSON object:
{ "message": "한국어 요약", "ui": { "type": "...", "props": { ... } } }

- "message": always include, in Korean
- "ui": include for ALL data responses (stats, bookings, charts, properties). Skip only for greetings.
- "canvas": include when user asks for 대시보드/캔버스/한눈에 — array of chart widgets

## Available UI types

{ "type": "stats-card", "props": { "label": "이름", "value": "값", "subtext": "부가설명" } }
{ "type": "booking-list", "props": { "title": "제목", "bookings": [{id, guest_name, property_name, check_in, check_out, status, amount}] } }
{ "type": "booking-detail", "props": { "booking": {id, guest_name, property_name, check_in, check_out, status, amount, notes} } }
{ "type": "property-card", "props": { "name": "숙소명", "address": "주소", "platforms": ["airbnb"] } }

Chart types:
- chart / revenue: line chart of monthly revenue
- chart / platform: bar chart of revenue by platform
- chart / occupancy: bar chart of monthly occupancy %
- chart / status: pie chart of booking status distribution
- chart / summary: 4-key-metric card (total revenue, bookings, avg rate, occupancy)
- chart / property-ranking: horizontal bar of property revenue ranking (props: sortBy, data)

Layout (for combining multiple components):
{ "type": "layout", "props": { "columns": 2, "children": [ {type, props}, ... ] } }

## Tool selection guide

For simple queries use the shortcut tools: get_dashboard_summary(), search_bookings(), get_booking_stats_by_property(), get_chart_data(), search_properties(), get_calendar()

For custom/complex analysis (e.g. "성수 플랫을 플랫폼별로 나눠봐", "평균 숙박일", "게스트별 매출 순위"):
→ call get_db_schema() first, then execute_sql() with a SELECT query

For data modification (user must explicitly ask):
- update_booking_status(booking_id, status): change booking status
- add_property_tag(property_id, tag): add label to property
- remove_property_tag(property_id, tag): remove label from property

## Key rules
1. Always use tools for REAL data. Never make up numbers.
2. Include "ui" in every data response. Text-only is not enough.
3. For multi-metric answers use layout to show several components at once.
4. For complex custom queries always use execute_sql — don't try to force shortcut tools.
5. Always respond in Korean. Keep message concise.`;
}

// ===== Chat Handler =====

async function callDeepSeek(messages, toolsEnabled = true) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { error: 'NO_API_KEY' };
  }

  const body = {
    model: 'deepseek-chat',
    messages,
    max_tokens: 8192,
    temperature: 0.1,
  };

  if (toolsEnabled) {
    body.tools = TOOLS;
    body.tool_choice = 'auto';
  }

  const res = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('DeepSeek API error:', res.status, errText);
    return { error: 'API_ERROR' };
  }

  const data = await res.json();
  return data;
}

router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    // Strip any existing system messages, we use our own
    const userMessages = messages.filter(m => m.role !== 'system');
    const fullMessages = [{ role: 'system', content: getSystemPrompt() }, ...userMessages];

    // First call — with tools
    const firstResponse = await callDeepSeek(fullMessages, true);

    if (firstResponse.error === 'NO_API_KEY') {
      return res.status(503).json({
        message: 'AI 어시스턴트를 사용하려면 DeepSeek API 키가 필요합니다. 관리자에게 문의해주세요.',
        ui: null,
      });
    }

    if (firstResponse.error === 'API_ERROR') {
      return res.status(502).json({
        message: 'AI 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.',
        ui: null,
      });
    }

    const firstChoice = firstResponse.choices?.[0]?.message;
    if (!firstChoice) {
      return res.status(502).json({ message: 'AI 응답을 받지 못했습니다.', ui: null });
    }

    // Check if AI wants to call tools
    const dataModifyingTools = new Set();
    if (firstChoice.tool_calls && firstChoice.tool_calls.length > 0) {
      // Add the assistant's tool call message to the conversation
      const messageLog = [...fullMessages, firstChoice];

      // Execute each tool call
      for (const tc of firstChoice.tool_calls) {
        if (tc.type === 'function') {
          const { name, arguments: argsStr } = tc.function;
          let args = {};
          try { args = JSON.parse(argsStr); } catch {}
          
          console.log(`🔧 Tool call: ${name}(${JSON.stringify(args)})`);
          if (['add_property_tag', 'remove_property_tag', 'update_booking_status'].includes(name)) {
            dataModifyingTools.add(name);
          }
          const result = executeTool(name, args);
          const resultStr = JSON.stringify(result);
          
          messageLog.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: resultStr,
          });
        }
      }

      // Keep calling DeepSeek with tools enabled (up to 3 rounds) until AI produces a text response
      let finalContent = null;
      let currentLog = messageLog;
      let toolRound = 0;
      const MAX_TOOL_ROUNDS = 8;

      while (toolRound < MAX_TOOL_ROUNDS) {
        const response = await callDeepSeek(currentLog, true);
        
        if (response.error) {
          return res.status(502).json({ message: 'AI 응답 생성 중 오류가 발생했습니다.', ui: null });
        }

        const choice = response.choices?.[0]?.message;
        if (!choice) {
          return res.status(502).json({ message: 'AI 응답을 받지 못했습니다.', ui: null });
        }

        // If AI called more tools, execute them and continue
        if (choice.tool_calls && choice.tool_calls.length > 0) {
          currentLog.push(choice);
          for (const tc of choice.tool_calls) {
            if (tc.type === 'function') {
              const { name, arguments: argsStr } = tc.function;
              let args = {};
              try { args = JSON.parse(argsStr); } catch {}
              console.log(`🔧 Tool call (round ${toolRound + 2}): ${name}(${JSON.stringify(args)})`);
              if (['add_property_tag', 'remove_property_tag', 'update_booking_status'].includes(name)) {
                dataModifyingTools.add(name);
              }
              const result = executeTool(name, args);
              currentLog.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(result),
              });
            }
          }
          toolRound++;
          continue;
        }

        // Text response — done
        finalContent = choice.content || '';
        break;
      }

      if (!finalContent) {
        // Build a fallback response from the last tool results
        const lastToolMsg = [...currentLog].reverse().find(m => m.role === 'tool');
        if (lastToolMsg) {
          try {
            const toolData = JSON.parse(lastToolMsg.content);
            finalContent = JSON.stringify({
              message: '조회 결과를 정리했습니다.',
              ui: { type: 'stats-card', props: { label: '조회 결과', value: `${Array.isArray(toolData) ? toolData.length : 1}건`, subtext: '데이터를 확인해주세요' } },
            });
          } catch {
            finalContent = '데이터 조회가 완료되었습니다. 자세한 내용은 위 데이터를 참고해주세요.';
          }
        } else {
          finalContent = '데이터 조회가 완료되었습니다. 자세한 내용은 위 데이터를 참고해주세요.';
        }
      }

      const result = parseAIResponse(finalContent);
      if (result) {
        console.log('📦 AI response:', result.canvas ? `✅ canvas ${result.canvas.items?.length || 0} items` : 'no canvas');
        if (dataModifyingTools.size > 0) {
          result._refetch = 'properties';
          console.log('🏷️  Data modified — injected _refetch flag');
        }
        return res.json(result);
      }
      // Fallback
      if (isDashboardRequest(userMessages)) {
        const canvas = buildAutoCanvas(userMessages);
        const msg = finalContent.length > 300 ? finalContent.slice(0, 300) + '…' : finalContent;
        const response = { message: msg, ui: null, canvas };
        if (dataModifyingTools.size > 0) {
          response._refetch = 'properties';
        }
        console.log('🔄 Auto-generating canvas (AI failed to include it)');
        return res.json(response);
      }
      console.log('⚠️  AI response not JSON — raw:', finalContent.slice(0, 100).replace(/\n/g, ' '));
      const fallbackResponse = { message: finalContent, ui: null };
      if (dataModifyingTools.size > 0) {
        fallbackResponse._refetch = 'properties';
      }
      return res.json(fallbackResponse);
    }

    // No tool calls — direct response
    const content = firstChoice.content || '';
    const result = parseAIResponse(content);
    if (result) {
      console.log('📦 Direct canvas:', result.canvas ? `✅ ${result.canvas.items?.length || 0} items` : 'no canvas');
      return res.json(result);
    }
    // Fallback: if user asked for dashboard but AI didn't provide canvas, auto-create
    if (isDashboardRequest(userMessages)) {
      const canvas = buildAutoCanvas(userMessages);
      const msg = content.length > 300 ? content.slice(0, 300) + '…' : content;
      console.log('🔄 Auto-generating canvas (AI failed to include it)');
      return res.json({ message: msg, ui: null, canvas });
    }
    console.log('⚠️  Direct response not JSON — raw:', content.slice(0, 100).replace(/\n/g, ' '));
    return res.json({ message: content, ui: null });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({
      message: '죄송합니다, 일시적인 오류가 발생했습니다. 다시 시도해주세요.',
      ui: null,
    });
  }
});

function parseAIResponse(content) {
  if (!content) return null;
  
  // Try 1: Direct JSON parse (whole response is JSON)
  try {
    const parsed = JSON.parse(content);
    if (parsed.message) {
      return { message: parsed.message, ui: parsed.ui || null, canvas: parsed.canvas || null, navigate: parsed.navigate || null };
    }
  } catch {}

  // Try 2: Find last JSON block in the text (most common pattern: text + JSON)
  // Look for { at start of JSON and } at end
  let lastJsonStart = -1;
  let lastJsonEnd = -1;
  for (let i = content.length - 1; i >= 0; i--) {
    if (content[i] === '}' && lastJsonEnd === -1) lastJsonEnd = i + 1;
    if (content[i] === '{' && lastJsonEnd !== -1) { lastJsonStart = i; break; }
  }
  
  if (lastJsonStart !== -1 && lastJsonEnd !== -1) {
    const jsonStr = content.slice(lastJsonStart, lastJsonEnd);
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.message || parsed.canvas) {
        return {
          message: parsed.message || '완료했습니다.',
          ui: parsed.ui || null,
          canvas: parsed.canvas || null,
          navigate: parsed.navigate || null,
        };
      }
    } catch {}
  }

  // Try 3: Complex canvas JSON extraction (balanced braces)
  // Start from the last { and try to find matching balanced }
  for (let i = content.length - 1; i >= 0; i--) {
    if (content[i] === '{') {
      let depth = 0;
      let j = i;
      while (j < content.length) {
        if (content[j] === '{') depth++;
        if (content[j] === '}') depth--;
        if (depth === 0) break;
        j++;
      }
      if (depth === 0) {
        const jsonStr = content.slice(i, j + 1);
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.canvas || (parsed.message && (parsed.ui || parsed.navigate || parsed.canvas))) {
            return {
              message: parsed.message || '완료했습니다.',
              ui: parsed.ui || null,
              canvas: parsed.canvas || null,
              navigate: parsed.navigate || null,
            };
          }
        } catch {}
      }
    }
  }

  return null;
}

export default router;
