// js/domains/content/calendar/native-events.js
// CRUD de eventos propios del proyecto, independientes de cualquier
// integración externa (Google Calendar es solo una fuente más de datos,
// no la fuente de verdad). Globales al proyecto: cualquier widget de
// calendario que crees los ve todos, igual que los dashboards son globales.
//
// Mismo patrón que core/data-manager.js: caché en memoria respaldada por
// el servidor, con localStorage como caché offline. Antes de esta
// versión, este archivo solo tocaba localStorage y nunca llegaba a
// sincronizarse con el servidor en tiempo real — se perdía entre
// dispositivos o al recargar la base de datos.

import { generateId } from '../../../core/data-model.js';
import { api, checkHealth } from '../../../core/api-client.js';
import { enqueue } from '../../../core/sync-queue.js';

const STORAGE_KEY = 'calendar_native_events_v1';

let _events = [];

function mirrorToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_events));
}

function loadFromLocalStorageCache() {
  try { _events = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { _events = []; }
}

/**
 * Arranca el almacén de eventos propios. Se llama una vez desde main.js,
 * junto a initDataStore(). Carga primero de localStorage (instantáneo) y
 * si el servidor responde, sustituye por su versión y actualiza la caché.
 */
export async function initNativeEventsStore() {
  loadFromLocalStorageCache();
  const up = await checkHealth();
  if (!up) return;

  try {
    _events = await api.get('/calendar-events');
    mirrorToLocalStorage();
  } catch (e) {
    console.warn('AllYourLinks: no se pudieron cargar los eventos de calendario del servidor, usando caché local.', e);
  }
}

function syncToServer(method, path, body) {
  const call = method === 'DELETE' ? api.del(path)
             : method === 'POST'   ? api.post(path, body)
             : method === 'PUT'    ? api.put(path, body)
             : Promise.reject(new Error(`Método no soportado: ${method}`));

  call.catch(() => enqueue(method, path, body));
}

// ========== LECTURA ==========

export function getNativeEvents() {
  return _events;
}

function toDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getNativeEventsForDay(date) {
  const key = toDateKey(date);
  return getNativeEvents().filter(ev => ev.date === key);
}

export function getNativeEvent(id) {
  return _events.find(e => e.id === id);
}

// ========== CRUD ==========

/**
 * Crea un evento propio.
 * @param {string} title
 * @param {string} date   'YYYY-MM-DD'
 * @param {string|null} time  'HH:MM' o null si es todo el día
 * @param {boolean} allDay
 */
export function createNativeEvent(title, date, time, allDay) {
  return {
    id: generateId('cevt'),
    title,
    date,
    time: allDay ? null : (time || null),
    allDay: !!allDay,
    source: 'native',
    createdAt: new Date().toISOString()
  };
}

export function saveNativeEvent(event) {
  const idx = _events.findIndex(e => e.id === event.id);

  if (idx >= 0) {
    _events[idx] = event;
    syncToServer('PUT', `/calendar-events/${event.id}`, event);
  } else {
    _events.push(event);
    syncToServer('POST', '/calendar-events', event);
  }
  mirrorToLocalStorage();
}

export function deleteNativeEvent(id) {
  _events = _events.filter(e => e.id !== id);
  mirrorToLocalStorage();
  syncToServer('DELETE', `/calendar-events/${id}`);
}
