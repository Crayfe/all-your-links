// server/routes/settings.js
// Almacén clave-valor simple: sustituye a las keys sueltas que vivían
// directamente en localStorage (weatherApiKey, googleClientId, rssApiKey,
// abrirNuevaPestana, default_save_box_id...).

const express = require('express');
const db = require('../db/init.js');

const router = express.Router();

// GET /api/settings — todas las claves como un objeto plano { key: value }
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const result = {};
  rows.forEach(r => { result[r.key] = r.value; });
  res.json(result);
});

// PUT /api/settings/:key — crea o actualiza una clave
router.put('/:key', (req, res) => {
  const { value } = req.body;
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(req.params.key, value ?? '');
  res.json({ key: req.params.key, value });
});

// DELETE /api/settings/:key
router.delete('/:key', (req, res) => {
  db.prepare('DELETE FROM settings WHERE key = ?').run(req.params.key);
  res.status(204).send();
});

module.exports = router;
