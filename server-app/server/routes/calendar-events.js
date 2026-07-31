// server/routes/calendar-events.js

const express = require('express');
const db = require('../db/init.js');

const router = express.Router();

function toClient(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time,
    allDay: !!row.all_day,
    source: 'native',
    createdAt: row.created_at
  };
}

// GET /api/calendar-events — todos los eventos propios (son globales)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM calendar_events ORDER BY date, time').all();
  res.json(rows.map(toClient));
});

// POST /api/calendar-events — crear
router.post('/', (req, res) => {
  const { id, title, date, time, allDay } = req.body;
  if (!id || !title || !date) return res.status(400).json({ error: 'id, title y date son obligatorios' });

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO calendar_events (id, title, date, time, all_day, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, title, date, allDay ? null : (time || null), allDay ? 1 : 0, now);

  const row = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id);
  res.status(201).json(toClient(row));
});

// PUT /api/calendar-events/:id — actualizar
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Evento no encontrado' });

  const { title, date, time, allDay } = req.body;
  db.prepare(`
    UPDATE calendar_events SET title = ?, date = ?, time = ?, all_day = ?
    WHERE id = ?
  `).run(
    title ?? existing.title,
    date ?? existing.date,
    allDay !== undefined ? (allDay ? null : (time || null)) : existing.time,
    allDay !== undefined ? (allDay ? 1 : 0) : existing.all_day,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
  res.json(toClient(row));
});

// DELETE /api/calendar-events/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Evento no encontrado' });
  res.status(204).send();
});

module.exports = router;
