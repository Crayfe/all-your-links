// server/db/init.js
// Abre (o crea) el archivo SQLite y aplica el esquema si hace falta.
// better-sqlite3 es síncrono: no hay callbacks ni promesas, lo que
// simplifica mucho el código de las rutas.

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'allyourlinks.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);

// Claves foráneas activas (SQLite las tiene desactivadas por defecto).
// Necesario para que ON DELETE CASCADE funcione (borrar un dashboard
// borra sus cajas, borrar una caja borra sus items).
db.pragma('foreign_keys = ON');

// Aplicar el esquema (CREATE TABLE IF NOT EXISTS es idempotente,
// se puede ejecutar en cada arranque sin problema)
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
db.exec(schema);

// ========== MIGRACIONES ==========
// CREATE TABLE IF NOT EXISTS no añade columnas nuevas a una tabla que ya
// existía de antes (bases de datos ya desplegadas). Estas migraciones
// añaden columnas nuevas de forma segura, ignorando el error si la
// columna ya existe (bases de datos nuevas, creadas ya con el esquema
// actualizado, no necesitan la migración).
function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some(c => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// boxes.note_id: enlaza una caja de tipo 'note' con su nota (relación 1
// a 1). Las cajas de otros tipos simplemente no usan esta columna.
addColumnIfMissing('boxes', 'note_id', "TEXT REFERENCES notes(id) ON DELETE SET NULL");
addColumnIfMissing('boxes', 'bullet_style', "TEXT DEFAULT 'disc'");
addColumnIfMissing('dashboards', 'layout_config', "TEXT");
addColumnIfMissing('dashboards', 'background_url', "TEXT");
addColumnIfMissing('boxes', 'parent_box_id', "TEXT REFERENCES boxes(id) ON DELETE SET NULL");
addColumnIfMissing('boxes', 'container_config', "TEXT");

module.exports = db;
