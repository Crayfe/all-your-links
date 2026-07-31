// js/core/sync-queue.js
// Cola de reintentos: si una escritura falla porque no hay conexión con
// el servidor, se guarda aquí en lugar de perderse, y se reintenta más
// tarde. Se persiste en localStorage para sobrevivir a cerrar el navegador
// con operaciones todavía pendientes de sincronizar.

import { api } from './api-client.js';

const QUEUE_KEY = 'sync_queue_v1';

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(method, path, body) {
  const queue = getQueue();
  queue.push({ method, path, body, queuedAt: new Date().toISOString() });
  saveQueue(queue);
}

export function getQueueLength() {
  return getQueue().length;
}

/**
 * Intenta reenviar las operaciones pendientes, en el mismo orden en que
 * se encolaron (importante: un PUT sobre un item que dependía de un POST
 * anterior de su caja no tendría sentido en otro orden). Se detiene en
 * el primer fallo — probablemente el servidor sigue sin responder — y
 * deja el resto en cola para el siguiente intento.
 */
export async function flushQueue() {
  const queue = getQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  let flushed = 0;
  while (queue.length > 0) {
    const op = queue[0];
    try {
      if (op.method === 'DELETE') await api.del(op.path);
      else if (op.method === 'POST') await api.post(op.path, op.body);
      else if (op.method === 'PUT') await api.put(op.path, op.body);
      else if (op.method === 'PATCH') await api.patch(op.path, op.body);
      queue.shift();
      flushed++;
    } catch {
      break;
    }
  }
  saveQueue(queue);
  return { flushed, remaining: queue.length };
}
