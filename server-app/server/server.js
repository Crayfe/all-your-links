// server/server.js
// Servidor autosuficiente: sirve tanto la API REST como los archivos
// estáticos del frontend (index.html, style.css, js/). Sustituye por
// completo al servidor de Python — solo hace falta tener Node instalado.

const express = require('express');
const path = require('path');
const { requireAuth } = require('./middleware/require-auth.js');
const { bumpVersionOnWrite } = require('./middleware/bump-version.js');

const app = express();
const PORT = process.env.PORT || 8000;

// Cuando el servidor va detrás de un proxy inverso (Caddy) que termina el
// HTTPS, Express necesita esto para saber que la petición original llegó
// por HTTPS (vía la cabecera X-Forwarded-Proto) aunque internamente
// Caddy le hable en HTTP simple. Sin esto, req.secure siempre daría false
// y la cookie nunca se marcaría como Secure.
app.set('trust proxy', 1);

// Parseo de JSON en el body de las peticiones
app.use(express.json());

// ========== AUTENTICACIÓN ==========
// /api/auth/login y /api/auth/logout son públicas (obviamente: no puedes
// necesitar sesión para iniciar sesión). /api/auth/me exige sesión, lo
// protege internamente el propio router.
app.use('/api/auth', require('./routes/auth.js'));

// Comprobación de salud pública: no expone datos, solo confirma que el
// servidor responde. Sin esto, ni la propia pantalla de login del
// frontend podría comprobar disponibilidad antes de autenticar.
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Versión de datos: pública en el sentido de que no expone contenido,
// solo un número — pero la dejamos protegida igualmente por consistencia
// y porque el cliente ya tiene sesión cuando la consulta en la práctica.
app.use('/api/data-version', requireAuth, require('./routes/data-version.js'));

// ========== API REST (protegida) ==========
// A partir de aquí, todas las rutas de datos exigen sesión iniciada.
// bumpVersionOnWrite incrementa el contador de versión automáticamente
// tras cualquier escritura exitosa, sin tener que llamarlo a mano en
// cada ruta — así ninguna futura ruta nueva se olvida de hacerlo.

app.use('/api/dashboards', requireAuth, bumpVersionOnWrite, require('./routes/dashboards.js'));
app.use('/api/boxes', requireAuth, bumpVersionOnWrite, require('./routes/boxes.js'));
app.use('/api/items', requireAuth, bumpVersionOnWrite, require('./routes/items.js'));
app.use('/api/calendar-events', requireAuth, bumpVersionOnWrite, require('./routes/calendar-events.js'));
app.use('/api/notes', requireAuth, bumpVersionOnWrite, require('./routes/notes.js'));
app.use('/api/settings', requireAuth, bumpVersionOnWrite, require('./routes/settings.js'));
app.use('/api', requireAuth, bumpVersionOnWrite, require('./routes/import-export.js')); // expone /api/export y /api/import

// Subida de archivos: la acción de subir exige sesión, pero el archivo ya
// subido se sirve públicamente por su URL (igual que cualquier estático),
// ya que un <img src="..."> no puede mandar cookies de sesión con facilidad.
app.use('/api/uploads', requireAuth, require('./routes/uploads.js'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== ARCHIVOS ESTÁTICOS DEL FRONTEND ==========
// La raíz del proyecto (donde viven index.html, style.css, js/) está un
// nivel por encima de server/.
const projectRoot = path.join(__dirname, '..');
app.use(express.static(projectRoot));

// Cualquier ruta no reconocida como archivo estático ni como API devuelve
// index.html, para que la navegación del lado del cliente siga funcionando.
app.get('*', (req, res) => {
  res.sendFile(path.join(projectRoot, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AllYourLinks corriendo en http://localhost:${PORT}`);
});
