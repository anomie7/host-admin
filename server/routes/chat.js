import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Available tables + fields for DB query enrichment
const TABLES = {
  bookings: ['id', 'property_id', 'guest_name', 'check_in', 'check_out', 'status', 'platform', 'amount', 'settlement_date', 'notes'],
  properties: ['id', 'name', 'address', 'description', 'platforms'],
};

function buildSystemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a helpful host admin assistant for "Warm Stay" — a property management tool for Korean hosts.

Today's date: ${today}

Database tables:
- properties (id, name, address, description, photos, platforms, created_at, updated_at)
- bookings (id, property_id, guest_name, check_in, check_out, status, platform, amount, settlement_date, notes)

Booking statuses: upcoming (입실 예정), checked_in (입실 중), checked_out (퇴실 완료), cancelled (취소됨)
Platforms: airbnb (에어비앤비), booking (부킹닷컴), liveanywhere (리브애니웨어)

When the user asks about bookings or data, ALWAYS respond with a JSON object in this format:
{ "message": "한국어 자연어 응답", "ui": { "type": "...", "props": { ... } } }

UI type formats:

booking-list → { "type": "booking-list", "props": { "title": "제목", "bookings": [{ "id": 1, "guest_name": "이름", "property_name": "숙소명", "check_in": "날짜", "check_out": "날짜", "status": "upcoming", "platform": "airbnb", "amount": 450000 }] } }
booking-detail → { "type": "booking-detail", "props": { "booking": { ... } } }
stats-card → { "type": "stats-card", "props": { "label": "레이블", "value": "값", "subtext": "부가설명" } }
property-card → { "type": "property-card", "props": { "name": "숙소명", "address": "주소", "platforms": ["airbnb"] } }

Rules:
1. Extract the user's intent and filter criteria (dates, guest names, property names, statuses)
2. Generate appropriate booking/property data that matches what would be in the DB
3. Always respond in Korean
4. If the user is just greeting or chatting (no data request), set ui: null
5. Keep message concise and friendly
6. Use realistic hotel booking data in your examples`;
}

router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        message: 'AI 어시스턴트를 사용하려면 DeepSeek API 키가 필요합니다. 관리자에게 문의해주세요.',
        ui: null,
      });
    }

    const systemPrompt = buildSystemPrompt();
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(m => m.role !== 'system'),
    ];

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: fullMessages,
        max_tokens: 2048,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API error:', response.status, errText);
      return res.status(502).json({
        message: 'AI 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.',
        ui: null,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Try to parse JSON from the response
    let parsed;
    try {
      // First try parsing the entire response as JSON
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON block from the response
      const match = content.match(/\{[\s\S]*"message"[\s\S]*"ui"[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
      } else {
        parsed = null;
      }
    }

    if (parsed && parsed.message) {
      // Enrich booking-list with real DB data if available
      if (parsed.ui?.type === 'booking-list' && parsed.ui.props?.bookings) {
        try {
          const db = getDb();
          const today = new Date().toISOString().slice(0, 10);
          // Try to get actual bookings for context
          const realBookings = db.prepare(`
            SELECT b.*, p.name AS property_name
            FROM bookings b
            JOIN properties p ON b.property_id = p.id
            WHERE b.check_in >= ?
            ORDER BY b.check_in ASC
            LIMIT 10
          `).all(today);
          if (realBookings.length > 0) {
            parsed.ui.props.bookings = realBookings.map(b => ({
              id: b.id,
              guest_name: b.guest_name,
              property_name: b.property_name,
              check_in: b.check_in,
              check_out: b.check_out,
              status: b.status,
              platform: b.platform,
              amount: b.amount,
            }));
          }
        } catch (dbErr) {
          console.error('DB enrichment error:', dbErr);
          // Fall back to AI-generated data
        }
      }

      // Enrich stats-card with real DB data
      if (parsed.ui?.type === 'stats-card' && parsed.ui.props?.label?.includes('예약')) {
        try {
          const db = getDb();
          const today = new Date().toISOString().slice(0, 10);
          const thisMonth = today.slice(5, 7);
          const thisYear = today.slice(0, 4);
          const stats = db.prepare(`
            SELECT COUNT(*) as count, SUM(amount) as total
            FROM bookings
            WHERE strftime('%m', check_in) = ? AND strftime('%Y', check_in) = ? AND status != 'cancelled'
          `).get(thisMonth, thisYear);
          if (stats.count > 0) {
            parsed.ui.props.value = `${stats.count}건`;
            parsed.ui.props.subtext = `₩${Number(stats.total || 0).toLocaleString()}`;
          }
        } catch (dbErr) {
          console.error('DB enrichment error:', dbErr);
        }
      }

      res.json({
        message: parsed.message,
        ui: parsed.ui || null,
      });
    } else {
      // Fallback: return the raw content as a text message
      res.json({
        message: content,
        ui: null,
      });
    }
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({
      message: '죄송합니다, 일시적인 오류가 발생했습니다. 다시 시도해주세요.',
      ui: null,
    });
  }
});

export default router;
