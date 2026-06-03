import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// GET /api/bookings?property_id=&month=&year=
router.get('/', (req, res) => {
  const db = getDb();
  const { property_id, month, year } = req.query;

  let sql = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];

  if (property_id) {
    sql += ' AND property_id = ?';
    params.push(property_id);
  }

  if (month && year) {
    sql += " AND strftime('%m', check_in) = ? AND strftime('%Y', check_in) = ?";
    params.push(month.padStart(2, '0'), year);
  }

  sql += ' ORDER BY check_in ASC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// GET /api/bookings/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Booking not found' });
  res.json(row);
});

// POST /api/bookings
router.post('/', (req, res) => {
  const { property_id, guest_name, check_in, check_out, status, platform, amount, settlement_date, notes } = req.body;
  if (!property_id || !guest_name || !check_in || !check_out) {
    return res.status(400).json({ error: 'property_id, guest_name, check_in, check_out are required' });
  }
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO bookings (property_id, guest_name, check_in, check_out, status, platform, amount, settlement_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    property_id, guest_name, check_in, check_out,
    status || 'upcoming', platform || 'airbnb',
    amount || 0, settlement_date || null, notes || ''
  );
  const created = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// PUT /api/bookings/:id
router.put('/:id', (req, res) => {
  const { guest_name, check_in, check_out, status, platform, amount, settlement_date, notes } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Booking not found' });

  db.prepare(
    `UPDATE bookings SET guest_name=?, check_in=?, check_out=?, status=?, platform=?, amount=?, settlement_date=?, notes=?
     WHERE id=?`
  ).run(
    guest_name ?? existing.guest_name,
    check_in ?? existing.check_in,
    check_out ?? existing.check_out,
    status ?? existing.status,
    platform ?? existing.platform,
    amount ?? existing.amount,
    settlement_date ?? existing.settlement_date,
    notes ?? existing.notes,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/bookings/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Booking not found' });
  db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
