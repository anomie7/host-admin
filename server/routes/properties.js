import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|webp|gif)$/i;
    cb(null, allowed.test(path.extname(file.originalname)));
  },
});

const router = Router();

// GET /api/properties
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM properties ORDER BY updated_at DESC').all();
  res.json(rows.map(r => ({
    ...r,
    photos: JSON.parse(r.photos || '[]'),
    platforms: JSON.parse(r.platforms || '[]'),
  })));
});

// GET /api/properties/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Property not found' });
  res.json({
    ...row,
    photos: JSON.parse(row.photos || '[]'),
    platforms: JSON.parse(row.platforms || '[]'),
  });
});

// POST /api/properties
router.post('/', (req, res) => {
  const { name, address, description, platforms } = req.body;
  if (!name || !address) {
    return res.status(400).json({ error: 'Name and address are required' });
  }
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO properties (name, address, description, platforms) VALUES (?, ?, ?, ?)'
  ).run(name, address, description || '', JSON.stringify(platforms || []));
  const created = db.prepare('SELECT * FROM properties WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({
    ...created,
    photos: JSON.parse(created.photos || '[]'),
    platforms: JSON.parse(created.platforms || '[]'),
  });
});

// PUT /api/properties/:id
router.put('/:id', (req, res) => {
  const { name, address, description, platforms } = req.body;
  if (!name || !address) {
    return res.status(400).json({ error: 'Name and address are required' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });

  db.prepare(
    `UPDATE properties SET name = ?, address = ?, description = ?, platforms = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(name, address, description || '', JSON.stringify(platforms || []), req.params.id);

  const updated = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  res.json({
    ...updated,
    photos: JSON.parse(updated.photos || '[]'),
    platforms: JSON.parse(updated.platforms || '[]'),
  });
});

// DELETE /api/properties/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });
  db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/properties/:id/photos
router.post('/:id/photos', upload.array('photos', 10), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });

  const currentPhotos = JSON.parse(existing.photos || '[]');
  const newPhotos = req.files.map(f => `/uploads/${f.filename}`);
  const allPhotos = [...currentPhotos, ...newPhotos];

  db.prepare(`UPDATE properties SET photos = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(allPhotos), req.params.id);

  res.json({ photos: allPhotos });
});

// DELETE /api/properties/:id/photos
router.delete('/:id/photos', (req, res) => {
  const { photo } = req.body;
  if (!photo) return res.status(400).json({ error: 'photo path required' });

  const db = getDb();
  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });

  const currentPhotos = JSON.parse(existing.photos || '[]');
  const filtered = currentPhotos.filter(p => p !== photo);

  // Remove file from disk
  const filePath = path.join(uploadsDir, path.basename(photo));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare(`UPDATE properties SET photos = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(filtered), req.params.id);

  res.json({ photos: filtered });
});

export default router;
