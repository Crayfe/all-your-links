// server/routes/auth.js

const express = require('express');
const db = require('../db/init.js');
const { verifyPassword } = require('../auth/password.js');
const { createSession, deleteSession, SESSION_DURATION_MS } = require('../auth/session.js');
const { parseCookies, SESSION_COOKIE, requireAuth } = require('../middleware/require-auth.js');

const router = express.Router();

// No hay endpoint público de registro: el único usuario se crea con
// server/scripts/create-user.js directamente en la máquina del servidor.

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
    // Mensaje genérico a propósito: no revelar si falló el usuario o la contraseña
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const token = createSession(username);

  // httpOnly: el JS del navegador no puede leer la cookie (protege de XSS).
  // Max-Age de 1 semana, coherente con la expiración deslizante del lado
  // servidor (auth/session.js): cada petición autenticada la renueva.
  // En un futuro despliegue con HTTPS, añadir "Secure" a este string.
  const oneWeekSeconds = SESSION_DURATION_MS / 1000;
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${oneWeekSeconds}`);
  res.json({ ok: true, username });
});

router.post('/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (token) deleteSession(token);

  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  // req.username lo pone el middleware requireAuth si la sesión es válida
  res.json({ username: req.username });
});

module.exports = router;
