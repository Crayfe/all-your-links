// server/routes/items.js

const express = require('express');
const db = require('../db/init.js');

const router = express.Router();

function toClient(row) {
  return {
    id: row.id,
    boxId: row.box_id,
    type: row.type,
    order: row.order_index,
    data: JSON.parse(row.data),
    metadata: JSON.parse(row.metadata)
  };
}

// GET /api/items?boxId=xxx
router.get('/', (req, res) => {
  const { boxId } = req.query;
  const rows = boxId
    ? db.prepare('SELECT * FROM items WHERE box_id = ? ORDER BY order_index').all(boxId)
    : db.prepare('SELECT * FROM items ORDER BY order_index').all();
  res.json(rows.map(toClient));
});

// POST /api/items — crear
router.post('/', (req, res) => {
  const it = req.body;
  if (!it.id || !it.boxId) return res.status(400).json({ error: 'id y boxId son obligatorios' });

  const data = JSON.stringify(it.data || {});
  const metadata = JSON.stringify(it.metadata || { clickCount: 0, lastAccessed: null, createdAt: new Date().toISOString(), tags: [] });

  db.prepare(`
    INSERT INTO items (id, box_id, type, order_index, data, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(it.id, it.boxId, it.type || 'link', it.order || 0, data, metadata);

  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(it.id);
  res.status(201).json(toClient(row));
});

// PUT /api/items/:id — actualizar
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item no encontrado' });

  const it = req.body;
  const data = it.data !== undefined ? JSON.stringify(it.data) : existing.data;
  const metadata = it.metadata !== undefined ? JSON.stringify(it.metadata) : existing.metadata;

  db.prepare(`
    UPDATE items SET box_id = ?, type = ?, order_index = ?, data = ?, metadata = ?
    WHERE id = ?
  `).run(
    it.boxId ?? existing.box_id,
    it.type ?? existing.type,
    it.order ?? existing.order_index,
    data,
    metadata,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  res.json(toClient(row));
});

// POST /api/items/:id/click — incrementa clickCount y actualiza lastAccessed
// Endpoint de conveniencia: evita tener que mandar todo el objeto metadata
// solo para trackear un clic.
router.post('/:id/click', (req, res) => {
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item no encontrado' });

  const metadata = JSON.parse(existing.metadata);
  metadata.clickCount = (metadata.clickCount || 0) + 1;
  metadata.lastAccessed = new Date().toISOString();

  db.prepare('UPDATE items SET metadata = ? WHERE id = ?').run(JSON.stringify(metadata), req.params.id);
  res.json({ ok: true, clickCount: metadata.clickCount });
});

// DELETE /api/items/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Item no encontrado' });
  res.status(204).send();
});

module.exports = router;
