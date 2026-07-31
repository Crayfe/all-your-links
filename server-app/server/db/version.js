// server/db/version.js
// Contador de versión de datos: se incrementa en cada escritura, para
// que el cliente pueda comprobar con una petición ligera (GET
// /api/data-version) si sus datos en caché siguen actualizados, sin
// tener que descargar el volcado completo solo para comprobarlo.

const db = require('./init.js');

function bumpVersion() {
  db.prepare('UPDATE data_version SET version = version + 1 WHERE id = 1').run();
}

function getVersion() {
  const row = db.prepare('SELECT version FROM data_version WHERE id = 1').get();
  return row ? row.version : 0;
}

module.exports = { bumpVersion, getVersion };
