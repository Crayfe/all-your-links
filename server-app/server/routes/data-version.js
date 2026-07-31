// server/routes/data-version.js

const express = require('express');
const { getVersion } = require('../db/version.js');

const router = express.Router();

// GET /api/data-version — ligerísimo, solo el número. El cliente lo
// compara con su copia en caché para saber si hace falta traer datos
// nuevos, sin tener que descargar el volcado completo para comprobarlo.
router.get('/', (req, res) => {
  res.json({ version: getVersion() });
});

module.exports = router;
