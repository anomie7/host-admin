import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import propertiesRouter from './routes/properties.js';
import bookingsRouter from './routes/bookings.js';
import fs from 'fs';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API routes
app.use('/api/properties', propertiesRouter);
app.use('/api/bookings', bookingsRouter);

// Calendar endpoint — bookings grouped by date for a given month
app.get('/api/calendar', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });

  const db = getDb();
  const rows = db.prepare(`
    SELECT b.*, p.name AS property_name
    FROM bookings b
    JOIN properties p ON b.property_id = p.id
    WHERE strftime('%m', b.check_in) = ? AND strftime('%Y', b.check_in) = ?
    ORDER BY b.check_in ASC
  `).all(month.padStart(2, '0'), year);

  // Group by date
  const grouped = {};
  for (const row of rows) {
    const date = row.check_in;
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(row);
  }

  res.json(grouped);
});

// Dashboard summary endpoint
app.get('/api/dashboard/summary', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(5, 7);
  const thisYear = today.slice(0, 4);

  // Today's check-ins
  const todayCheckIns = db.prepare(
    `SELECT COUNT(*) as count, SUM(amount) as revenue FROM bookings WHERE check_in = ? AND status != 'cancelled'`
  ).get(today);

  // Today's check-outs
  const todayCheckOuts = db.prepare(
    `SELECT COUNT(*) as count FROM bookings WHERE check_out = ? AND status != 'cancelled'`
  ).get(today);

  // Monthly stats
  const monthlyStats = db.prepare(`
    SELECT COUNT(*) as total_bookings, SUM(amount) as total_revenue,
           AVG(amount) as avg_rate
    FROM bookings
    WHERE strftime('%m', check_in) = ? AND strftime('%Y', check_in) = ? AND status != 'cancelled'
  `).get(thisMonth, thisYear);

  // Upcoming settlements this month
  const settlements = db.prepare(`
    SELECT COUNT(*) as count, SUM(amount) as total
    FROM bookings
    WHERE settlement_date IS NOT NULL
      AND strftime('%m', settlement_date) = ? AND strftime('%Y', settlement_date) = ?
      AND settlement_date >= ? AND status != 'cancelled'
  `).get(thisMonth, thisYear, today);

  // Platform breakdown for this month
  const platformRevenue = db.prepare(`
    SELECT platform, COUNT(*) as bookings, SUM(amount) as revenue
    FROM bookings
    WHERE strftime('%m', check_in) = ? AND strftime('%Y', check_in) = ? AND status != 'cancelled'
    GROUP BY platform
  `).all(thisMonth, thisYear);

  // Occupancy: count distinct dates with bookings
  const occupiedDays = db.prepare(`
    SELECT COUNT(DISTINCT check_in) as days
    FROM bookings
    WHERE strftime('%m', check_in) = ? AND strftime('%Y', check_in) = ? AND status != 'cancelled'
  `).get(thisMonth, thisYear);

  const daysInMonth = new Date(parseInt(thisYear), parseInt(thisMonth), 0).getDate();
  const occupancyRate = Math.round((occupiedDays.days / daysInMonth) * 100);

  // Recent bookings (for activity feed)
  const recentBookings = db.prepare(`
    SELECT b.*, p.name AS property_name
    FROM bookings b
    JOIN properties p ON b.property_id = p.id
    ORDER BY b.created_at DESC LIMIT 5
  `).all();

  res.json({
    today: {
      checkIns: todayCheckIns.count,
      checkInRevenue: todayCheckIns.revenue || 0,
      checkOuts: todayCheckOuts.count,
    },
    month: {
      totalBookings: monthlyStats.total_bookings || 0,
      totalRevenue: monthlyStats.total_revenue || 0,
      avgRate: Math.round(monthlyStats.avg_rate || 0),
      occupancyRate,
    },
    settlements: {
      count: settlements.count || 0,
      total: settlements.total || 0,
    },
    platformRevenue,
    recentBookings: recentBookings.map(r => ({
      ...r,
      status_label: r.status === 'checked_in' ? '입실 중'
        : r.status === 'upcoming' ? '입실 예정'
        : r.status === 'checked_out' ? '퇴실 완료' : '취소됨',
    })),
  });
});

// CSV export
app.get('/api/bookings/export/csv', (req, res) => {
  const { month, year } = req.query;
  const db = getDb();

  let rows;
  if (month && year) {
    rows = db.prepare(`
      SELECT b.id, p.name as property_name, b.guest_name, b.check_in, b.check_out,
             b.status, b.platform, b.amount, b.settlement_date, b.notes
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      WHERE strftime('%m', b.check_in) = ? AND strftime('%Y', b.check_in) = ?
      ORDER BY b.check_in ASC
    `).all(month.padStart(2, '0'), year);
  } else {
    rows = db.prepare(`
      SELECT b.id, p.name as property_name, b.guest_name, b.check_in, b.check_out,
             b.status, b.platform, b.amount, b.settlement_date, b.notes
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      ORDER BY b.check_in DESC
    `).all();
  }

  const statusMap = {
    upcoming: '입실 예정', checked_in: '입실 중',
    checked_out: '퇴실 완료', cancelled: '취소됨',
  };

  const header = 'ID,숙소명,게스트명,체크인,체크아웃,상태,플랫폼,금액,정산예정일,메모';
  const csvRows = rows.map(r =>
    `${r.id},"${r.property_name}","${r.guest_name}",${r.check_in},${r.check_out},${statusMap[r.status] || r.status},${r.platform},${r.amount},${r.settlement_date || ''},"${(r.notes || '').replace(/"/g, '""')}"`
  );

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=bookings-${year || 'all'}-${month || 'all'}.csv`);
  res.send('\uFEFF' + header + '\n' + csvRows.join('\n')); // BOM for Excel
});

// Serve built frontend (for production / Railway)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Auto-init DB + seed if empty
const db = getDb();
const propertyCount = db.prepare('SELECT COUNT(*) as count FROM properties').get();
if (propertyCount.count === 0) {
  console.log('🌱 DB is empty — auto-seeding...');
  spawnSync('node', ['seed.js'], { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
}

// SPA catch-all — all non-API, non-file routes serve index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return;
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).json({ message: 'Host Admin API — frontend not built (run vite build first)' });
  }
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`🏨 Host Admin server running on http://localhost:${PORT}`);
});
