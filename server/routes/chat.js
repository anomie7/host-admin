import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

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
];

// ===== Tool Implementations =====

function executeTool(name, args) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  switch (name) {
    case 'search_bookings': {
      const { date_from, date_to, guest_name, property_name, status, platform, limit = 20 } = args || {};
      let sql = `SELECT b.*, p.name AS property_name FROM bookings b JOIN properties p ON b.property_id = p.id WHERE 1=1`;
      const params = [];

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

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ===== System Prompt =====

function getSystemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a helpful host admin assistant for "Warm Stay" — a property management tool for Korean hosts.

Today's date is ${today}. Use this to calculate relative dates like "오늘", "다음주", "이번달".

You have access to tools that can query the database. Use them to answer user questions about bookings, properties, and statistics.

## YOUR RESPONSE FORMAT

After getting the data you need (either from tools or from conversation context), respond with a JSON object:

{ "message": "한국어 자연어 응답", "ui": { "type": "...", "props": { ... } } }

## UI TYPES

booking-list: { "type": "booking-list", "props": { "title": "제목", "bookings": [{ "id": 1, "guest_name": "이름", "property_name": "숙소명", "check_in": "날짜", "check_out": "날짜", "status": "upcoming", "platform": "airbnb", "amount": 450000 }] } }

booking-detail: { "type": "booking-detail", "props": { "booking": { "id": 1, "guest_name": "이름", "property_name": "숙소명", ... } } }

stats-card: { "type": "stats-card", "props": { "label": "레이블", "value": "값", "subtext": "부가설명" } }

property-card: { "type": "property-card", "props": { "name": "숙소명", "address": "주소", "platforms": ["airbnb"] } }

## CANVAS FEATURE

You can also build visual dashboards by including a "canvas" field in your response:

{ "message": "...", "ui": { ... }, "canvas": { "title": "대시보드 제목", "items": [{ "type": "booking-list", "props": {...}, "id": "unique-id" }, { "type": "stats-card", "props": {...}, "id": "unique-id" }] } }

The "canvas" field is an object with "title" and "items" (array of UI components). Each item needs a unique "id" (use "c1", "c2", etc.).

Use canvas when:
- The user asks "캔버스에 보여줘", "대시보드 만들어줘", "한눈에 보여줘"
- You want to present multiple components together as a dashboard

## RULES

1. Always use tools to get REAL data from the database. Do NOT make up data.
2. Summarize the data in natural Korean.
3. Include the "ui" field with the appropriate component type to render the data visually.
4. If the user is just chatting (greeting, casual talk), use the check_intent tool or just respond with message only (ui: null).
5. Always respond in Korean.
6. Keep messages concise and friendly.`;
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
    max_tokens: 4096,
    temperature: 0.3,
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
          const result = executeTool(name, args);
          const resultStr = JSON.stringify(result);
          
          messageLog.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: resultStr,
          });
        }
      }

      // Second call — get AI response with tool results (no tools this round to force final response)
      const secondResponse = await callDeepSeek(messageLog, false);
      
      if (secondResponse.error) {
        return res.status(502).json({ message: 'AI 응답 생성 중 오류가 발생했습니다.', ui: null });
      }

      const secondChoice = secondResponse.choices?.[0]?.message;
      if (!secondChoice) {
        return res.status(502).json({ message: 'AI 응답을 받지 못했습니다.', ui: null });
      }

      // Parse the final response
      const content = secondChoice.content || '';
      const result = parseAIResponse(content);
      if (result) {
        return res.json(result);
      }
      return res.json({ message: content, ui: null });
    }

    // No tool calls — direct response
    const content = firstChoice.content || '';
    const result = parseAIResponse(content);
    if (result) {
      return res.json(result);
    }
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
  try {
    const parsed = JSON.parse(content);
    if (parsed.message) {
      return { message: parsed.message, ui: parsed.ui || null, canvas: parsed.canvas || null };
    }
  } catch {
    // Try to extract JSON block
    const match = content.match(/\{[\s\S]*"message"[\s\S]*"ui"[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.message) {
          return { message: parsed.message, ui: parsed.ui || null, canvas: parsed.canvas || null };
        }
      } catch {}
    }
    // Try canvas-only response
    const canvasMatch = content.match(/\{[\s\S]*"canvas"[\s\S]*\}/);
    if (canvasMatch) {
      try {
        const parsed = JSON.parse(canvasMatch[0]);
        if (parsed.canvas) {
          return { message: parsed.message || '캔버스를 준비했습니다.', ui: parsed.ui || null, canvas: parsed.canvas };
        }
      } catch {}
    }
  }
  return null;
}

export default router;
