// server/auth/session.js
// Tokens de sesión aleatorios con expiración deslizante: cada vez que se
// usa la sesión (cada petición autenticada), su caducidad se renueva
// una semana más. Así, mientras uses la app con cierta regularidad nunca
// notas que expira; si la dejas de usar una semana entera, caduca sola.

const crypto = require('crypto');
const db = require('../db/init.js');

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 semana

function newExpiry() {
  return new Date(Date.now() + SESSION_DURATION_MS).toISOString();
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO sessions (token, username, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, username, now, newExpiry());

  return token;
}

function getSession(token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!row) return null;

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    deleteSession(token);
    return null;
  }
  return row;
}

/**
 * Extiende la caducidad de una sesión una semana más desde ahora.
 * Se llama en cada petición autenticada válida (ver requireAuth).
 */
function renewSession(token) {
  db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run(newExpiry(), token);
}

function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

module.exports = { createSession, getSession, renewSession, deleteSession, SESSION_DURATION_MS };
