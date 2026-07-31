// server/auth/password.js
// Hash y verificación de contraseñas usando scrypt, incluido de serie en
// Node.js — sin dependencias externas como bcrypt.

const crypto = require('crypto');

const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const candidateHash = crypto.scryptSync(password, salt, KEY_LENGTH);
  const storedHash = Buffer.from(hash, 'hex');
  // Comparación en tiempo constante: evita filtrar por temporización
  // cuánto de la contraseña coincide.
  if (candidateHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(candidateHash, storedHash);
}

module.exports = { hashPassword, verifyPassword };
