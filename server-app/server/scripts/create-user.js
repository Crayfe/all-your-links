#!/usr/bin/env node
// server/scripts/create-user.js
// Crea (o actualiza la contraseña de) un usuario. Se ejecuta directamente
// en la máquina del servidor — no existe ningún endpoint HTTP para esto,
// precisamente para que no pueda hacerse desde fuera.
//
// Uso:
//   node scripts/create-user.js <usuario> <contraseña>
//
// Si prefieres no dejar la contraseña en el historial de la terminal,
// puedes pasarla por variable de entorno:
//   CREATE_USER_PASSWORD=tu_contraseña node scripts/create-user.js tu_usuario

const db = require('../db/init.js');
const { hashPassword } = require('../auth/password.js');

const username = process.argv[2];
const password = process.argv[3] || process.env.CREATE_USER_PASSWORD;

if (!username || !password) {
  console.error('Uso: node scripts/create-user.js <usuario> <contraseña>');
  console.error('   o: CREATE_USER_PASSWORD=xxx node scripts/create-user.js <usuario>');
  process.exit(1);
}

const { hash, salt } = hashPassword(password);
const now = new Date().toISOString();

const existing = db.prepare('SELECT username FROM users WHERE username = ?').get(username);

if (existing) {
  db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE username = ?')
    .run(hash, salt, username);
  console.log(`Contraseña actualizada para el usuario "${username}".`);
} else {
  db.prepare('INSERT INTO users (username, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)')
    .run(username, hash, salt, now);
  console.log(`Usuario "${username}" creado correctamente.`);
}
