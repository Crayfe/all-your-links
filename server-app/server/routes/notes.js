// server/routes/notes.js
// CRUD de notas. Son globales al proyecto (como los dashboards), no
// pertenecen a ninguna caja concreta — cualquier widget de notas que
// crees las ve todas, con la opción de filtrar por tipo si hace falta.

const express = require('express');
const db = require('../db/init.js');

const router = express.Router();

function toClient(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    properties: JSON.parse(row.properties || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// GET /api/notes?type=quick — lista, más recientes primero
router.get('/', (req, res) => {
  const { type } = req.query;
  const rows = type
    ? db.prepare('SELECT * FROM notes WHERE type = ? ORDER BY updated_at DESC').all(type)
    : db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all();
  res.json(rows.map(toClient));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Nota no encontrada' });
  res.json(toClient(row));
});

// POST /api/notes — crear
router.post('/', (req, res) => {
  const { id, title, content, type, properties } = req.body;
  if (!id) return res.status(400).json({ error: 'id es obligatorio' });
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO notes (id, type, title, content, properties, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, type || 'quick', title || '', content || '', JSON.stringify(properties || {}), now, now);

  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  res.status(201).json(toClient(row));
});

// PUT /api/notes/:id — actualizar
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Nota no encontrada' });

  const { title, content, type, properties } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE notes SET title = ?, content = ?, type = ?, properties = ?, updated_at = ?
    WHERE id = ?
  `).run(
    title ?? existing.title,
    content ?? existing.content,
    type ?? existing.type,
    properties !== undefined ? JSON.stringify(properties) : existing.properties,
    now,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  res.json(toClient(row));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Nota no encontrada' });
  res.status(204).send();
});

module.exports = router;
