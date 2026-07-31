// server/middleware/bump-version.js
// Incrementa el contador de versión automáticamente tras cualquier
// escritura exitosa (POST/PUT/PATCH/DELETE con respuesta 2xx), sin tener
// que acordarse de llamarlo a mano en cada ruta nueva que se añada.

const { bumpVersion } = require('../db/version.js');

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

function bumpVersionOnWrite(req, res, next) {
  if (MUTATING_METHODS.includes(req.method)) {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        bumpVersion();
      }
    });
  }
  next();
}

module.exports = { bumpVersionOnWrite };
