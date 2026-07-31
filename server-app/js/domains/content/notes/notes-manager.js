// js/domains/content/notes/notes-manager.js
// CRUD de notas. Globales al proyecto (no pertenecen a ninguna caja
// concreta), igual que los eventos de calendario propios — mismo patrón
// de caché en memoria respaldada por el servidor, con localStorage como
// caché offline (ver domains/content/calendar/native-events.js).

import { generateId } from '../../../core/data-model.js';
import { api, checkHealth } from '../../../core/api-client.js';
import { enqueue } from '../../../core/sync-queue.js';

const STORAGE_KEY = 'notes_v1';

let _notes = [];

function mirrorToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_notes));
}

function loadFromLocalStorageCache() {
  try { _notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { _notes = []; }
}

/**
 * Arranca el almacén de notas. Se llama una vez desde main.js, junto a
 * initDataStore(). Carga primero de localStorage (instantáneo) y si el
 * servidor responde, sustituye por su versión y actualiza la caché.
 */
export async function initNotesStore() {
  loadFromLocalStorageCache();
  const up = await checkHealth();
  if (!up) return;

  try {
    _notes = await api.get('/notes');
    mirrorToLocalStorage();
  } catch (e) {
    console.warn('AllYourLinks: no se pudieron cargar las notas del servidor, usando caché local.', e);
  }
}

function syncToServer(method, path, body) {
  const call = method === 'DELETE' ? api.del(path)
             : method === 'POST'   ? api.post(path, body)
             : method === 'PUT'    ? api.put(path, body)
             : Promise.reject(new Error(`Método no soportado: ${method}`));

  // Se devuelve la promesa para que quien necesite ESPERAR a que la
  // escritura llegue de verdad al servidor pueda hacerlo (ver boxes.js:
  // al vincular una nota nueva a una caja, hay que esperar a que la nota
  // exista en el servidor antes de guardar la caja que la referencia,
  // o la clave foránea de boxes.note_id puede rechazar la inserción por
  // una carrera entre las dos peticiones). El resto de llamadas puede
  // seguir ignorando el valor de retorno y comportarse igual que antes
  // (disparar y olvidar).
  return call.catch(() => enqueue(method, path, body));
}

// ========== LECTURA ==========

export function getNotes() {
  return _notes;
}

export function getNote(id) {
  return _notes.find(n => n.id === id);
}

// ========== CRUD ==========

/**
 * Crea una nota nueva (todavía sin guardar — ver saveNote).
 * @param {string} title
 * @param {string} content   Markdown
 * @param {string} type      'quick' por defecto; reservado para futuras
 *                           plantillas de colección (libros, recetas...)
 */
export function createNote(title, content, type = 'quick') {
  const now = new Date().toISOString();
  return {
    id: generateId('note'),
    type,
    title,
    content,
    properties: {},
    createdAt: now,
    updatedAt: now
  };
}

export function saveNote(note) {
  const idx = _notes.findIndex(n => n.id === note.id);
  note.updatedAt = new Date().toISOString();

  let syncPromise;
  if (idx >= 0) {
    _notes[idx] = note;
    syncPromise = syncToServer('PUT', `/notes/${note.id}`, note);
  } else {
    _notes.unshift(note); // las nuevas arriba del todo (orden por recencia)
    syncPromise = syncToServer('POST', '/notes', note);
  }
  // Mantener el orden por actualización más reciente, coherente con el
  // servidor (ORDER BY updated_at DESC)
  _notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  mirrorToLocalStorage();
  return syncPromise;
}

export function deleteNote(id) {
  _notes = _notes.filter(n => n.id !== id);
  mirrorToLocalStorage();
  syncToServer('DELETE', `/notes/${id}`);
}
