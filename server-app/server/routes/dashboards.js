// server/routes/dashboards.js

const express = require('express');
const db = require('../db/init.js');

const router = express.Router();

function toClient(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    layoutConfig: row.layout_config ? JSON.parse(row.layout_config) : null,
    backgroundUrl: row.background_url || null,
    active: !!row.active,
    pinned: !!row.pinned,
    order: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// GET /api/dashboards — lista todos
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM dashboards ORDER BY order_index').all();
  res.json(rows.map(toClient));
});

// GET /api/dashboards/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Dashboard no encontrado' });
  res.json(toClient(row));
});

// POST /api/dashboards — crear
router.post('/', (req, res) => {
  const { id, name, type, layoutConfig, backgroundUrl, active, pinned, order } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id y name son obligatorios' });

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO dashboards (id, name, type, layout_config, background_url, active, pinned, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, type || 'links', layoutConfig ? JSON.stringify(layoutConfig) : null, backgroundUrl || null, active ? 1 : 0, pinned ? 1 : 0, order || 0, now, now);

  const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(id);
  res.status(201).json(toClient(row));
});

// PUT /api/dashboards/:id — actualizar (reemplaza los campos provistos)
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Dashboard no encontrado' });

  const { name, type, layoutConfig, backgroundUrl, active, pinned, order } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE dashboards
    SET name = ?, type = ?, layout_config = ?, background_url = ?, active = ?, pinned = ?, order_index = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name ?? existing.name,
    type ?? existing.type,
    layoutConfig !== undefined ? (layoutConfig ? JSON.stringify(layoutConfig) : null) : existing.layout_config,
    backgroundUrl !== undefined ? (backgroundUrl || null) : existing.background_url,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    pinned !== undefined ? (pinned ? 1 : 0) : existing.pinned,
    order ?? existing.order_index,
    now,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(req.params.id);
  res.json(toClient(row));
});

// PATCH /api/dashboards/:id/pin — fija este como único pinned (desmarca los demás)
router.patch('/:id/pin', (req, res) => {
  const target = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Dashboard no encontrado' });

  const now = new Date().toISOString();
  const setAllUnpinned = db.prepare('UPDATE dashboards SET pinned = 0, updated_at = ?');
  const setPinned = db.prepare('UPDATE dashboards SET pinned = 1, updated_at = ? WHERE id = ?');

  db.transaction(() => {
    setAllUnpinned.run(now);
    setPinned.run(now, req.params.id);
  })();

  res.json({ ok: true });
});

// DELETE /api/dashboards/:id — cascada elimina sus cajas e items
router.delete('/:id', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS n FROM dashboards').get().n;
  if (count <= 1) {
    return res.status(400).json({ error: 'No se puede eliminar el único dashboard' });
  }
  const result = db.prepare('DELETE FROM dashboards WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Dashboard no encontrado' });
  res.status(204).send();
});

module.exports = router;
