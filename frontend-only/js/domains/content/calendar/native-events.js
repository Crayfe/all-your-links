// js/domains/content/calendar/native-events.js
// CRUD de eventos propios del proyecto, independientes de cualquier
// integración externa (Google Calendar es solo una fuente más de datos,
// no la fuente de verdad). Globales al proyecto: cualquier widget de
// calendario que crees los ve todos, igual que los dashboards son globales.

import { generateId } from '../../../core/data-model.js';

const STORAGE_KEY = 'calendar_native_events_v1';

// ========== ALMACENAMIENTO ==========

export function getNativeEvents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAll(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function toDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getNativeEventsForDay(date) {
  const key = toDateKey(date);
  return getNativeEvents().filter(ev => ev.date === key);
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
  const events = getNativeEvents();
  const idx = events.findIndex(e => e.id === event.id);
  if (idx >= 0) events[idx] = event;
  else events.push(event);
  saveAll(events);
}

export function deleteNativeEvent(id) {
  saveAll(getNativeEvents().filter(e => e.id !== id));
}

export function getNativeEvent(id) {
  return getNativeEvents().find(e => e.id === id);
}
