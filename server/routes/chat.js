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

// Auto-generate UI from last data tool result when AI forgets render_ui
function autoGenerateUI(lastDataTool) {
  if (!lastDataTool || !lastDataTool.result) return null;
  const { name, result } = lastDataTool;

  try {
    switch (name) {
      case 'execute_sql': {
        const { columns, rows } = result || {};
        if (!columns || !rows || rows.length === 0) return null;

        // Check if result looks like booking data (has guest_name, check_in etc.)
        const colSet = new Set(columns.map(c => c.toLowerCase()));
        if (colSet.has('guest_name') && colSet.has('check_in')) {
          const bookings = rows.map(r => {
            const obj = {};
            columns.forEach((c, i) => { obj[c] = r[i]; });
            return obj;
          });
          return {
            type: 'booking-list',
            props: { title: '예약 목록', bookings: bookings.slice(0, 20) },
          };
        }

        // Check if it's aggregate data (has count, revenue, etc.)
        if (colSet.has('booking_count') || colSet.has('total_revenue') || (colSet.has('count') && columns.length <= 3)) {
          return {
            type: 'chart',
            props: { chartType: 'property-ranking', title: '조회 결과', sortBy: 'revenue', data: rows.map(r => {
              const obj = {};
              columns.forEach((c, i) => { obj[c] = r[i]; });
              return obj;
            }).slice(0, 10) },
          };
        }

        // Default: table view
        return {
          type: 'table',
          props: { title: '조회 결과', headers: columns, rows: rows.slice(0, 15) },
        };
      }
      case 'get_db_schema': {
        return null; // Schema info, no UI needed
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// Execute a plan array from AI (string steps like "execute_sql(...)" or "render_ui(type, props)")
function executePlanStep(step) {
  // Parse: "tool_name(arg1, arg2, ...)" or "tool_name({json args})"
  const match = step.trim().match(/^(\w+)\s*\(([\s\S]*)\)\s*$/);
  if (!match) return { error: `Cannot parse step: ${step}` };

  const name = match[1];
  let argsStr = match[2].trim();

  // Try JSON first: if args look like JSON object or array
  let args = {};
  if (argsStr.startsWith('{') || argsStr.startsWith('[')) {
    try { args = JSON.parse(argsStr); } catch {
      args = {};
    }
  } else if (argsStr) {
    // Positional args: try to parse as JSON or keep as single string arg
    try { args = { sql: JSON.parse(argsStr) }; } catch {
      args = { sql: argsStr };
    }
  }

  // Skip render_ui — handled by caller
  if (name === 'render_ui') {
    return { _render_ui: true, type: args.type, props: args.props };
  }

  return executeTool(name, args);
}

function parsePlanSteps(plan) {
  if (!Array.isArray(plan)) return [];
  return plan.map(step => (typeof step === 'string' ? step : JSON.stringify(step)));
}

// Auto-detect user intent and query data when AI fails to use tools
function autoQuery(userMessages) {
  const text = userMessages.map(m => m.content || '').join(' ');
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const thisYear = today.slice(0, 4);
  const thisMonth = today.slice(5, 7);

  try {
    // Detect month mentions
    const monthMatch = text.match(/(\d{1,2})\s*월/);
    const targetMonth = monthMatch ? String(parseInt(monthMatch[1])).padStart(2, '0') : null;

    // Detect intent keywords
    const wantsRevenue = /수익|매출|수입|돈|금액/.test(text);
    const wantsBookings = /예약|체크인|투숙|게스트/.test(text);
    const wantsRanking = /많은|TOP|순위|많이|가장|최고|인기/.test(text);
    const wantsOccupancy = /점유율|빈방|비율/.test(text);

    const timeFilter = targetMonth
      ? `strftime('%m', check_in) = '${targetMonth}' AND strftime('%Y', check_in) = '${thisYear}'`
      : `strftime('%Y', check_in) = '${thisYear}'`;
    const monthLabel = targetMonth ? `${parseInt(targetMonth)}월` : '올해';

    if (wantsRanking && (wantsRevenue || wantsBookings)) {
      const yearFilter = `strftime('%Y', b.check_in) = '${thisYear}'`;
      const monthFilter = targetMonth ? ` AND strftime('%m', b.check_in) = '${targetMonth}'` : '';
      const sql = `SELECT p.id, p.name, COUNT(*) as booking_count, SUM(b.amount) as total_revenue, AVG(b.amount) as avg_rate
        FROM bookings b JOIN properties p ON b.property_id = p.id
        WHERE b.status != 'cancelled' AND ${yearFilter}${monthFilter}
        GROUP BY b.property_id ORDER BY ${wantsRevenue ? 'total_revenue' : 'booking_count'} DESC LIMIT 5`;
      const rows = db.prepare(sql).all();
      return {
        ui: { type: 'chart', props: { chartType: 'property-ranking', title: `${monthLabel} 숙소별 통계`, sortBy: wantsRevenue ? 'revenue' : 'count', data: rows } },
        sql,
        count: rows.length,
      };
    }

    if (wantsRevenue && !wantsRanking) {
      const sql = `SELECT SUM(amount) as total, COUNT(*) as bookings, AVG(amount) as avg_rate
        FROM bookings WHERE status != 'cancelled' AND ${timeFilter}`;
      const row = db.prepare(sql).get();
      return {
        ui: { type: 'stats-card', props: { label: `${monthLabel} 수익`, value: `₩${(row.total || 0).toLocaleString()}`, subtext: `${row.bookings || 0}건 예약, 평균 ₩${Math.round(row.avg_rate || 0).toLocaleString()}` } },
        sql,
        count: row.bookings || 0,
      };
    }

    if (targetMonth && wantsBookings) {
      const sql = `SELECT b.*, p.name AS property_name FROM bookings b JOIN properties p ON b.property_id = p.id
        WHERE strftime('%m', b.check_in) = '${targetMonth}' AND strftime('%Y', b.check_in) = '${thisYear}'
        ORDER BY b.check_in ASC LIMIT 20`;
      const rows = db.prepare(sql).all();
      if (rows.length > 0) {
        return {
          ui: { type: 'booking-list', props: { title: `${parseInt(targetMonth)}월 예약 목록`, bookings: rows } },
          sql,
          count: rows.length,
        };
      }
    }

    if (wantsBookings) {
      const sql = `SELECT b.*, p.name AS property_name FROM bookings b JOIN properties p ON b.property_id = p.id
        ORDER BY b.check_in ASC LIMIT 20`;
      const rows = db.prepare(sql).all();
      if (rows.length > 0) {
        return {
          ui: { type: 'booking-list', props: { title: '예약 목록', bookings: rows } },
          sql,
          count: rows.length,
        };
      }
    }

    // Default: summary stats
    {
      const sql = `SELECT COUNT(*) as total, SUM(amount) as revenue FROM bookings WHERE strftime('%Y', check_in) = '${thisYear}' AND status != 'cancelled'`;
      const row = db.prepare(sql).get();
      return {
        ui: { type: 'stats-card', props: { label: '통계', value: `${row.total || 0}건`, subtext: `총 수익 ₩${(row.revenue || 0).toLocaleString()}` } },
        sql,
        count: row.total || 0,
      };
    }
  } catch (err) {
    console.error('autoQuery error:', err);
    return null;
  }
}

// ===== Tool Definitions =====

const TOOLS = [
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
  {
    type: 'function',
    function: {
      name: 'render_ui',
      description: '데이터 조회 결과를 UI 컴포넌트로 표시합니다. execute_sql()로 데이터를 조회한 후 반드시 이 함수를 호출해야 합니다. 호출하지 않으면 사용자에게 결과가 보이지 않습니다.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['stats-card', 'booking-list', 'booking-detail', 'property-card', 'chart', 'table', 'layout', 'html'], description: 'UI 컴포넌트 타입' },
          props: { type: 'object', description: '컴포넌트 속성 객체. 각 UI 타입에 맞는 props를 전달하세요.' },
        },
        required: ['type', 'props'],
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
        // Always return {columns, rows} format
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        if (rows.length > 200) {
          return {
            columns,
            truncated: true,
            total_rows: rows.length,
            rows: rows.slice(0, 200).map(r => columns.map(c => r[c])),
          };
        }
        return { columns, rows: rows.map(r => columns.map(c => r[c])) };
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
  return `You are a Korean host admin assistant for "Warm Stay". Today is ${today}.

## CRITICAL WORKFLOW (YOU MUST FOLLOW THIS EXACTLY)
1. Analyze what data the user needs
2. First output a JSON with your plan — ALWAYS include "plan" and "message"
3. Then IMMEDIATELY call the first tool in your plan
4. ALWAYS finish by calling render_ui() — this is MANDATORY
5. Finally output { "message": "한국어 요약" }

## ⚠️ NEVER ANSWER FROM MEMORY
You do NOT know the real booking data. Even if you think you know the answer,
you MUST look up actual data using tools. NEVER make up numbers.

## Response format
FIRST response (with plan + first tool call):
{ "plan": ["execute_sql(\"SELECT...\")", "render_ui(table, ...)"], "message": "한국어 설명" }
Then call execute_sql() as your first tool.

FINAL response (after all tools done):
{ "message": "한국어 요약" }
- Do NOT include "ui" in JSON — render_ui() tool handles that
- Never output markdown tables or raw data

## Available TOOLS (only 3 for data)
- get_db_schema(): Check table structures
- execute_sql(sql, params?): Run SELECT queries for data analysis
- render_ui(type, props): ALWAYS call last to show results

Data modification tools:
- update_booking_status(), add_property_tag(), remove_property_tag()

## UI types for render_ui
- stats-card: { label, value, subtext } — simple metrics
- booking-list: { title, bookings: [...] }
- chart: { chartType: "revenue"|"platform"|"property-ranking"|"summary"|"status", title, data }
- table: { title, headers, rows }
- html: { content: "HTML with inline styles" } — for custom layouts

## STRATEGY
- For ANY data question → call execute_sql() directly
- Before complex queries → call get_db_schema() first
- Use JOIN, GROUP BY, aggregation for analysis
- For visualizations → try chart or table first, html as fallback`;
}

// ===== Chat Handler =====

// Strip markdown bold from messages
function cleanMessage(msg) {
  if (typeof msg !== 'string') return msg;
  return msg.replace(/\*\*/g, '').replace(/__/g, '');
}

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

// Tool labels for progress display
const toolLabels = {
  get_db_schema: '🗄️ DB 구조 확인',
  execute_sql: '🔎 데이터 분석',
  add_property_tag: '🏷️ 태그 추가',
  remove_property_tag: '🏷️ 태그 제거',
  update_booking_status: '🔄 상태 변경',
  render_ui: '🎨 UI 렌더링',
};

function getToolLabel(name) {
  return toolLabels[name] || `🔧 ${name}`;
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
    let pendingUI = null;
    let lastDataTool = null; // Track last data query tool for auto-fallback
    let aiPlan = null; // Track AI's plan if provided
    const executedCalls = []; // Track all tool calls for auto-plan

    // Extract plan from first response content if present
    if (firstChoice.content) {
      try {
        const parsed = JSON.parse(firstChoice.content);
        if (parsed.plan) {
          aiPlan = parsed.plan;
          console.log(`📋 AI Plan: ${JSON.stringify(aiPlan)}`);
        }
      } catch {}
    }

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
          executedCalls.push(name);
          if (['add_property_tag', 'remove_property_tag', 'update_booking_status'].includes(name)) {
            dataModifyingTools.add(name);
          }
          
          // Intercept render_ui — don't execute, just store and return ok
          if (name === 'render_ui') {
            pendingUI = { type: args.type, props: args.props };
            console.log(`🎨 render_ui stored: ${args.type}`);
            const resultStr = JSON.stringify({ ok: true, rendered: args.type });
            messageLog.push({ role: 'tool', tool_call_id: tc.id, content: resultStr });
            continue;
          }

          const result = executeTool(name, args);
          const resultStr = JSON.stringify(result);
          // Track last data query tool for auto-fallback
          if (!['get_db_schema', 'render_ui'].includes(name)) {
            lastDataTool = { name, result };
          }
          
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
      const MAX_TOOL_ROUNDS = 20;

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
              executedCalls.push(name);
              if (['add_property_tag', 'remove_property_tag', 'update_booking_status'].includes(name)) {
                dataModifyingTools.add(name);
              }
              // Intercept render_ui
              if (name === 'render_ui') {
                pendingUI = { type: args.type, props: args.props };
                console.log(`🎨 render_ui (round ${toolRound + 2}): ${args.type}`);
                currentLog.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ ok: true, rendered: args.type }) });
                continue;
              }
              const result = executeTool(name, args);
              // Track last data query tool for auto-fallback
              if (!['get_db_schema', 'render_ui'].includes(name)) {
                lastDataTool = { name, result };
              }
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
        // Validate plan: check if render_ui was part of plan
        if (aiPlan && !aiPlan.some(s => s.includes('render_ui')) && !pendingUI) {
          console.log('⚠️  Plan missing render_ui — auto-generating UI');
        }
        // Merge pendingUI if AI used render_ui tool
        if (pendingUI) {
          result.ui = pendingUI;
          console.log(`🎨 Merged render_ui: ${pendingUI.type}`);
        } else if (lastDataTool && !result.ui) {
          // AI forgot render_ui — auto-generate UI from last data query
          const autoUI = autoGenerateUI(lastDataTool);
          if (autoUI) {
            result.ui = autoUI;
            console.log(`🔄 Auto-generated UI from ${lastDataTool.name}: ${autoUI.type}`);
          }
        }
        console.log('📦 AI response:', result.canvas ? `✅ canvas ${result.canvas.items?.length || 0} items` : 'no canvas');
        if (!result.canvas && isDashboardRequest(userMessages)) {
          result.canvas = buildAutoCanvas(userMessages, result.ui);
          console.log('🔄 Injected canvas into response');
        }
        if (dataModifyingTools.size > 0) {
          result._refetch = 'properties';
          console.log('🏷️  Data modified — injected _refetch flag');
        }
        if (aiPlan) {
          result.plan = aiPlan;
        } else if (executedCalls.length > 0) {
          // Auto-generate plan from actual tool call sequence
          const stepLabels = { get_db_schema: 'get_db_schema()', execute_sql: 'execute_sql()', render_ui: 'render_ui()' };
          result.plan = executedCalls.filter(n => n !== 'render_ui' || true).map(name => stepLabels[name] || name);
          console.log(`📋 Auto-plan from ${executedCalls.length} tool calls`);
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
      // Try auto-query as last resort
      const autoResult = autoQuery(userMessages);
      if (autoResult) {
        const fallbackResponse = { message: cleanMessage(finalContent) || `${autoResult.count}건 조회했습니다.`, ui: autoResult.ui };
        if (dataModifyingTools.size > 0) fallbackResponse._refetch = 'properties';
        return res.json(fallbackResponse);
      }
      const fallbackResponse = { message: finalContent, ui: null };
      if (dataModifyingTools.size > 0) {
        fallbackResponse._refetch = 'properties';
      }
      return res.json(fallbackResponse);
    }

    // No tool calls — direct response
    const content = firstChoice.content || '';
    const directResult = parseAIResponse(content);
    if (directResult) {
      // If AI provided a plan, execute it automatically (plan-first workflow)
      if (directResult.plan && Array.isArray(directResult.plan) && directResult.plan.length > 0) {
        console.log(`📋 Executing AI plan: ${JSON.stringify(directResult.plan)}`);
        const planSteps = parsePlanSteps(directResult.plan);
        for (const step of planSteps) {
          const stepResult = executePlanStep(step);
          if (stepResult && stepResult._render_ui) {
            // Store render_ui result but don't set yet
            directResult.ui = { type: stepResult.type, props: stepResult.props };
            console.log(`🎨 Plan render_ui: ${stepResult.type}`);
          } else if (stepResult && !stepResult.error) {
            // Feed data tool result back for next step
            lastDataTool = { name: step.split('(')[0], result: stepResult };
            console.log(`📦 Plan step executed: ${step.split('(')[0]}`);
          }
        }
        // If still no UI, auto-generate from last data tool
        if (!directResult.ui && lastDataTool) {
          const autoUI = autoGenerateUI(lastDataTool);
          if (autoUI) directResult.ui = autoUI;
        }
        if (!directResult.plan && executedCalls.length > 0) {
          const stepLabels = { get_db_schema: 'get_db_schema()', execute_sql: 'execute_sql()', render_ui: 'render_ui()' };
          directResult.plan = executedCalls.map(name => stepLabels[name] || name);
        }
        return res.json(directResult);
      }
      console.log('📦 Direct canvas:', directResult.canvas ? `✅ ${directResult.canvas.items?.length || 0} items` : 'no canvas');
      if (!directResult.canvas && isDashboardRequest(userMessages)) {
        directResult.canvas = buildAutoCanvas(userMessages, directResult.ui);
        console.log('🔄 Injected canvas into direct response');
      }
      return res.json(directResult);
    }
    // Fallback: if user asked for dashboard but AI didn't provide canvas, auto-create
    if (isDashboardRequest(userMessages)) {
      const canvas = buildAutoCanvas(userMessages);
      const msg = content.length > 300 ? content.slice(0, 300) + '…' : content;
      console.log('🔄 Auto-generating canvas (AI failed to include it)');
      return res.json({ message: msg, ui: null, canvas });
    }
    console.log('⚠️  Direct response not JSON — raw:', content.slice(0, 100).replace(/\n/g, ' '));
    // Try auto-query as last resort
    const autoResult = autoQuery(userMessages);
    if (autoResult) {
      return res.json({ message: cleanMessage(content) || `${autoResult.count}건 조회했습니다.`, ui: autoResult.ui });
    }
    return res.json({ message: cleanMessage(content), ui: null });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({
      message: '죄송합니다, 일시적인 오류가 발생했습니다. 다시 시도해주세요.',
      ui: null,
    });
  }
});

// ===== SSE Streaming endpoint with Plan-First progress =====

router.post('/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event, data) => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
  };

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      send('error', { error: 'messages array required' });
      return res.end();
    }

    const userMessages = messages.filter(m => m.role !== 'system');
    const fullMessages = [{ role: 'system', content: getSystemPrompt() }, ...userMessages];
    const dataModifyingTools = new Set();
    let pendingUI = null;
    let lastDataTool = null;

    let currentLog = fullMessages;
    let toolRound = 0;
    let planSteps = []; // Track plan: [{label, status}]
    let planSent = false;

    // Helper: send step event
    const sendStep = (index, status) => {
      if (index >= 0 && index < planSteps.length) {
        planSteps[index].status = status;
        send('step', { index, status, steps: planSteps.map(s => s.label) });
      }
    };

    for (let round = 0; round < 20; round++) {
      const response = await callDeepSeek(currentLog, round === 0 || true);
      if (response.error === 'NO_API_KEY') {
        send('complete', { message: 'AI 어시스턴트를 사용하려면 DeepSeek API 키가 필요합니다.', ui: null });
        return res.end();
      }
      if (response.error === 'API_ERROR') {
        send('complete', { message: 'AI 서비스에 일시적인 문제가 있습니다.', ui: null });
        return res.end();
      }

      const choice = response.choices?.[0]?.message;
      if (!choice) {
        send('complete', { message: 'AI 응답을 받지 못했습니다.', ui: null });
        return res.end();
      }

      // On first round, extract plan from AI content
      if (round === 0 && choice.content && !planSent) {
        // Try to extract plan from JSON
        const planMatch = choice.content.match(/"plan"\s*:\s*(\[[\s\S]*?(?<!\\)"\])/);
        if (planMatch) {
          try {
            const plan = JSON.parse(planMatch[1]);
            if (Array.isArray(plan) && plan.length > 0) {
              planSteps = plan.map(s => ({
                label: getToolLabel(s.split('(')[0]),
                status: 'pending'
              }));
              send('plan', { steps: planSteps.map(s => s.label) });
              planSent = true;
              console.log(`📋 SSE AI plan: ${JSON.stringify(planSteps.map(s => s.label))}`);
            }
          } catch {}
        }
      }

      // If no tool calls, we have the final response
      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        const content = choice.content || '';
        const result = parseAIResponse(content);
        if (result) {
          if (dataModifyingTools.size > 0) result._refetch = 'properties';
          // Auto-generate plan if none yet
          if (!planSent && planSteps.length === 0) {
            planSteps = [{ label: '🔎 데이터 분석', status: 'completed' }];
            send('plan', { steps: planSteps.map(s => s.label) });
          }
          // Mark all steps completed
          planSteps.forEach((_, i) => sendStep(i, 'completed'));
          send('complete', result);
        } else {
          send('complete', { message: cleanMessage(content), ui: null });
        }
        return res.end();
      }

      // Process tool calls
      currentLog.push(choice);
      
      // Auto-generate plan from first batch of tool calls
      if (!planSent) {
        // Get all data tools from this batch
        const newDataTools = choice.tool_calls
          .filter(tc => tc.function?.name !== 'render_ui')
          .map(tc => getToolLabel(tc.function.name));
        // Add render_ui at the end if any data tools exist
        if (newDataTools.length > 0) {
          // Also include render_ui
          const allSteps = [...newDataTools, '🎨 UI 생성'];
          planSteps = allSteps.map(label => ({ label, status: 'pending' }));
          send('plan', { steps: planSteps.map(s => s.label) });
          planSent = true;
          console.log(`📋 SSE auto-plan: ${JSON.stringify(planSteps.map(s => s.label))}`);
        }
      } else {
        // Plan already exists, but new data tools might appear in later rounds
        // Append them to the plan if they're not already there
        for (const tc of choice.tool_calls) {
          if (tc.function?.name === 'render_ui') continue;
          const label = getToolLabel(tc.function.name);
          const alreadyInPlan = planSteps.some(s => s.label === label);
          if (!alreadyInPlan) {
            // Insert before the last render_ui step (or at end)
            const renderUiIdx = planSteps.findIndex(s => s.label === '🎨 UI 생성');
            if (renderUiIdx >= 0) {
              planSteps.splice(renderUiIdx, 0, { label, status: 'pending' });
            } else {
              planSteps.push({ label, status: 'pending' });
            }
            // Re-send full plan
            send('plan', { steps: planSteps.map(s => s.label) });
            console.log(`📋 SSE plan extended: +${label}`);
          }
        }
      }

      let stepIndex = 0;
      for (const tc of choice.tool_calls) {
        if (tc.type !== 'function') continue;
        const { name, arguments: argsStr } = tc.function;
        let args = {};
        try { args = JSON.parse(argsStr); } catch {}

        const label = getToolLabel(name);
        send('tool', { name, label, status: 'running' });

        // Find the best matching step: exact label match, then first pending
        const exactIdx = planSteps.findIndex(s => s.label === label);
        const firstPendingIdx = planSteps.findIndex(s => s.status === 'pending');
        const activeIdx = exactIdx >= 0 ? exactIdx : firstPendingIdx;
        
        if (activeIdx >= 0 && activeIdx < planSteps.length) {
          sendStep(activeIdx, 'running');
        }

        if (['add_property_tag', 'remove_property_tag', 'update_booking_status'].includes(name)) {
          dataModifyingTools.add(name);
        }

        // Intercept render_ui
        if (name === 'render_ui') {
          pendingUI = { type: args.type, props: args.props };
          console.log(`🎨 SSE render_ui: ${args.type}`);
          send('tool', { name, label, status: 'done' });
          if (activeIdx >= 0) sendStep(activeIdx, 'completed');
          currentLog.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ ok: true, rendered: args.type }) });
          stepIndex++;
          continue;
        }

        // Execute the tool
        const startTime = Date.now();
        const result = executeTool(name, args);
        const elapsed = Date.now() - startTime;
        
        // Track last data tool for fallback
        if (!['get_db_schema', 'render_ui'].includes(name)) {
          lastDataTool = { name, result };
        }

        send('tool', { name, label, status: 'done', elapsed });
        if (activeIdx >= 0) sendStep(activeIdx, 'completed');

        currentLog.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
        stepIndex++;
      }
    }

    // Max rounds — fallback
    if (pendingUI) {
      send('complete', { message: '조회 완료', ui: pendingUI });
    } else {
      const autoUI = autoGenerateUI(lastDataTool);
      send('complete', { message: '조회 완료', ui: autoUI || null });
    }
    res.end();

  } catch (err) {
    console.error('Stream error:', err);
    try { send('complete', { message: '오류가 발생했습니다.', ui: null }); res.end(); } catch {}
  }
});

function parseAIResponse(content) {
  if (!content) return null;
  
  // Try 1: Direct JSON parse (whole response is JSON)
  try {
    const parsed = JSON.parse(content);
    if (parsed.message) {
      return { message: cleanMessage(parsed.message), ui: parsed.ui || null, canvas: parsed.canvas || null, navigate: parsed.navigate || null, plan: parsed.plan || null };
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
          message: cleanMessage(parsed.message || '완료했습니다.'),
          ui: parsed.ui || null,
          canvas: parsed.canvas || null,
          navigate: parsed.navigate || null,
          plan: parsed.plan || null,
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
              message: cleanMessage(parsed.message || '완료했습니다.'),
              ui: parsed.ui || null,
              canvas: parsed.canvas || null,
              navigate: parsed.navigate || null,
              plan: parsed.plan || null,
            };
          }
        } catch {}
      }
    }
  }

  return null;
}

export default router;
