// server/middleware/require-auth.js
// Protege rutas comprobando la cookie de sesión. Parsea la cabecera
// Cookie a mano (es una línea, sin necesidad de añadir cookie-parser
// como dependencia solo para esto).

const { getSession, renewSession, SESSION_DURATION_MS } = require('../auth/session.js');

const SESSION_COOKIE = 'ayl_session';

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  renewSession(token); // expiración deslizante: +1 semana en el servidor

  // La cookie del navegador tiene su propio Max-Age fijado al crearse;
  // sin reenviarla aquí, el navegador dejaría de mandarla pasada una
  // semana desde el login, aunque el servidor siguiera considerando la
  // sesión válida. Reenviarla en cada uso hace que ambos lados avancen
  // la caducidad al unísono.
  const oneWeekSeconds = SESSION_DURATION_MS / 1000;
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${oneWeekSeconds}`);

  req.username = session.username;
  next();
}

module.exports = { requireAuth, parseCookies, SESSION_COOKIE };
