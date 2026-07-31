// js/core/data-manager.js
// Gestión centralizada de datos: caché en memoria respaldada por el
// servidor (API REST + SQLite), con localStorage como caché offline.
//
// El resto de la aplicación no cambió ni una línea al introducir el
// backend: todas las funciones exportadas mantienen el mismo nombre y la
// misma forma síncrona que cuando leían/escribían localStorage
// directamente. Por eso esta migración pudo aislarse en un único archivo.

import { createWorkspace, createBox } from './data-model.js';
import { api, checkHealth } from './api-client.js';
import { enqueue, flushQueue } from './sync-queue.js';
import { bus, EVENTS } from './events.js';
import { isEditModeActive } from './edit-mode.js';

const STORAGE_KEYS = {
  WORKSPACES: 'workspaces_v2',
  BOXES: 'boxes_v2',
  ITEMS: 'items_v2',
  VERSION: 'data_version'
};

// Versión de datos del servidor confirmada por última vez en esta caché
// local. No confundir con STORAGE_KEYS.VERSION (esa es la versión del
// *esquema* de datos, un string fijo tipo "2.0"; esta es un contador que
// sube en cada escritura del servidor, usado para saber si hace falta
// refrescar sin descargar el volcado completo solo para comprobarlo).
const SERVER_DATA_VERSION_KEY = 'server_data_version';

const CURRENT_VERSION = '2.0';
const REFRESH_INTERVAL_MS = 20000;

// ========== ESTADO EN MEMORIA ==========
// Única fuente de verdad durante la sesión. Se carga una vez al arrancar
// (initDataStore) y se mantiene sincronizada en cada escritura.

let _workspaces = [];
let _boxes = [];
let _items = [];
let _online = false;

function mirrorToLocalStorage() {
  localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(_workspaces));
  localStorage.setItem(STORAGE_KEYS.BOXES, JSON.stringify(_boxes));
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(_items));
  localStorage.setItem(STORAGE_KEYS.VERSION, CURRENT_VERSION);
}

function loadFromLocalStorageCache() {
  try { _workspaces = JSON.parse(localStorage.getItem(STORAGE_KEYS.WORKSPACES) || '[]'); } catch { _workspaces = []; }
  try { _boxes = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOXES) || '[]'); } catch { _boxes = []; }
  try { _items = JSON.parse(localStorage.getItem(STORAGE_KEYS.ITEMS) || '[]'); } catch { _items = []; }
}

function getLocalDataVersion() {
  const raw = localStorage.getItem(SERVER_DATA_VERSION_KEY);
  return raw === null ? null : parseInt(raw, 10);
}

function setLocalDataVersion(v) {
  localStorage.setItem(SERVER_DATA_VERSION_KEY, String(v));
}

// ========== ARRANQUE ==========

/**
 * Arranca el almacén de datos. Debe llamarse (y esperarse con await) una
 * única vez, antes de que cualquier otro módulo pida datos — normalmente
 * desde main.js, antes de initApp().
 *
 * Patrón "stale-while-revalidate": si ya hay algo en la caché local, se
 * pinta al instante con eso (sin esperar red) y la comprobación contra
 * el servidor ocurre en segundo plano, repintando solo si hay algo nuevo
 * de verdad. Si es la primera vez en este navegador (caché vacía), no
 * hay nada que mostrar todavía, así que en ese caso sí se espera al
 * servidor antes de continuar.
 */
export async function initDataStore() {
  loadFromLocalStorageCache();
  const hasCachedData = _workspaces.length > 0 || _boxes.length > 0 || _items.length > 0;

  if (!hasCachedData) {
    await refreshFromServer({ blocking: true });
  } else {
    refreshFromServer({ blocking: false }); // sin await: no bloquea el arranque
  }
}

/**
 * Comprueba la versión de datos del servidor y, si difiere de la que
 * tenemos en caché (o es la primera carga), trae el volcado completo y
 * actualiza memoria + localStorage. Si coincide, no descarga nada más.
 */
async function refreshFromServer({ blocking }) {
  // Mientras el modo edición está activo, cualquier repintado disparado
  // por una sincronización de fondo puede chocar con Sortable.js
  // manipulando el DOM en directo (arrastrando cajas o enlaces) o con
  // widgets a medio editar, causando parpadeos. Se pausa por completo
  // aquí (nunca en la carga inicial bloqueante, solo en el ciclo
  // periódico de fondo) — al salir del modo edición se sincroniza de
  // inmediato una vez (ver toggleDragAndDrop en drag.js), así que no se
  // pierde nada, solo se retrasa hasta que termines de editar.
  if (!blocking && isEditModeActive()) return;

  const serverUp = await checkHealth();
  if (!serverUp) {
    if (_online) bus.emit(EVENTS.SERVER_CONNECTION_CHANGED, false);
    _online = false;
    return;
  }

  try {
    const { version: serverVersion } = await api.get('/data-version');
    const localVersion = getLocalDataVersion();

    if (!blocking && localVersion !== null && localVersion === serverVersion) {
      // Ya estamos al día: nos ahorramos descargar el volcado completo.
      if (!_online) bus.emit(EVENTS.SERVER_CONNECTION_CHANGED, true);
      _online = true;
      return;
    }

    const dump = await api.get('/export');
    _workspaces = dump.workspaces || [];
    _boxes = dump.boxes || [];
    _items = dump.items || [];
    mirrorToLocalStorage();
    setLocalDataVersion(serverVersion);

    const wasOffline = !_online;
    _online = true;
    await flushQueue();

    if (!blocking) {
      // Los datos llegaron después de que la UI ya se hubiera pintado
      // con la caché: avisar para que se repinte con lo nuevo.
      bus.emit(EVENTS.DATA_REFRESHED);
    }
    if (wasOffline) bus.emit(EVENTS.SERVER_CONNECTION_CHANGED, true);
  } catch (e) {
    console.warn('AllYourLinks: no se pudo refrescar desde el servidor, usando caché local.', e);
    if (_online) bus.emit(EVENTS.SERVER_CONNECTION_CHANGED, false);
    _online = false;
  }
}

export function isServerOnline() {
  return _online;
}

/**
 * Fuerza una comprobación/sincronización inmediata con el servidor, sin
 * esperar al próximo ciclo periódico. Se usa al salir del modo edición
 * (ver drag.js), para ponerse al día sin demora tras haber pausado los
 * refrescos de fondo mientras se editaba.
 */
export function refreshFromServerNow() {
  return refreshFromServer({ blocking: false });
}

// Revisa periódicamente si hay datos nuevos en el servidor (por ejemplo,
// un cambio hecho desde el móvil mientras esta pestaña sigue abierta), y
// de paso reintenta la conexión si estábamos offline.
setInterval(() => refreshFromServer({ blocking: false }), REFRESH_INTERVAL_MS);

/**
 * Envía una escritura al servidor en segundo plano. No bloquea: la UI ya
 * se actualizó de forma optimista sobre el estado en memoria antes de
 * llamar a esta función. Si falla (sin conexión), la operación se encola
 * para reintentar más tarde en lugar de perderse.
 */
function syncToServer(method, path, body) {
  const call = method === 'DELETE' ? api.del(path)
             : method === 'POST'   ? api.post(path, body)
             : method === 'PUT'    ? api.put(path, body)
             : method === 'PATCH'  ? api.patch(path, body)
             : Promise.reject(new Error(`Método no soportado: ${method}`));

  call.catch(() => {
    if (_online) {
      _online = false;
      bus.emit(EVENTS.SERVER_CONNECTION_CHANGED, false);
    }
    enqueue(method, path, body);
  });
}

// ========== DATOS POR DEFECTO ==========

export function initializeData() {
  if (_workspaces.length === 0) {
    const defaultDashboard = createWorkspace('Inicio', 'links');
    defaultDashboard.active = true;
    defaultDashboard.pinned = true;
    saveWorkspace(defaultDashboard);

    const defaultBox = createBox(defaultDashboard.id, 'Favoritos');
    saveBox(defaultBox);
  } else {
    // Migración: añadir campo pinned a dashboards existentes que no lo tengan
    let changed = false;
    _workspaces.forEach((ws, i) => {
      if (ws.pinned === undefined) {
        ws.pinned = (i === 0);
        changed = true;
      }
    });
    if (changed) mirrorToLocalStorage();
  }
}

// ========== WORKSPACES ==========

export function getWorkspaces() {
  return _workspaces;
}

export function getWorkspace(id) {
  return _workspaces.find(ws => ws.id === id);
}

export function getActiveWorkspace() {
  // Prioridad: pinned > active > primero
  return _workspaces.find(ws => ws.pinned)
      || _workspaces.find(ws => ws.active)
      || _workspaces[0];
}

export function saveWorkspace(workspace) {
  const index = _workspaces.findIndex(ws => ws.id === workspace.id);
  workspace.updatedAt = new Date().toISOString();

  if (index >= 0) {
    _workspaces[index] = workspace;
    syncToServer('PUT', `/dashboards/${workspace.id}`, workspace);
  } else {
    _workspaces.push(workspace);
    syncToServer('POST', '/dashboards', workspace);
  }
  mirrorToLocalStorage();
}

export function deleteWorkspace(id) {
  const boxIds = _boxes.filter(box => box.workspaceId === id).map(b => b.id);
  _workspaces = _workspaces.filter(ws => ws.id !== id);
  _boxes = _boxes.filter(box => box.workspaceId !== id);
  _items = _items.filter(item => !boxIds.includes(item.boxId));
  mirrorToLocalStorage();
  // El servidor borra en cascada (ON DELETE CASCADE): una sola petición
  // basta para eliminar también sus cajas e items del lado remoto.
  syncToServer('DELETE', `/dashboards/${id}`);
}

export function setActiveWorkspace(id) {
  _workspaces.forEach(ws => { ws.active = (ws.id === id); });
  mirrorToLocalStorage();
  const updated = getWorkspace(id);
  if (updated) syncToServer('PUT', `/dashboards/${id}`, updated);
}

// ========== DASHBOARDS (aliases limpios sobre workspaces) ==========

export const getDashboards      = getWorkspaces;
export const getDashboard       = getWorkspace;
export const getActiveDashboard = getActiveWorkspace;
export const saveDashboard      = saveWorkspace;

export function deleteDashboard(id) {
  const dashboards = getDashboards();
  if (dashboards.length <= 1) return false; // No eliminar el último
  const wasActive = getDashboard(id)?.active;
  const wasPinned = getDashboard(id)?.pinned;
  deleteWorkspace(id);
  if (wasActive || wasPinned) {
    const remaining = getDashboards();
    if (remaining.length > 0) {
      if (wasActive) setActiveWorkspace(remaining[0].id);
      if (wasPinned) setPinnedDashboard(remaining[0].id);
    }
  }
  return true;
}

export function setActiveDashboard(id) {
  setActiveWorkspace(id);
}

export function setPinnedDashboard(id) {
  _workspaces.forEach(db => { db.pinned = (db.id === id); });
  mirrorToLocalStorage();
  syncToServer('PATCH', `/dashboards/${id}/pin`);
}

export function getPinnedDashboard() {
  return _workspaces.find(db => db.pinned) || _workspaces[0];
}

// ========== BOXES ==========

export function getBoxes() {
  return _boxes;
}

export function getBox(id) {
  return _boxes.find(box => box.id === id);
}

export function getBoxesByWorkspace(workspaceId) {
  return _boxes
    .filter(box => box.workspaceId === workspaceId)
    .sort((a, b) => a.order - b.order);
}

export function saveBox(box) {
  const index = _boxes.findIndex(b => b.id === box.id);
  box.updatedAt = new Date().toISOString();

  if (index >= 0) {
    _boxes[index] = box;
    syncToServer('PUT', `/boxes/${box.id}`, box);
  } else {
    _boxes.push(box);
    syncToServer('POST', '/boxes', box);
  }
  mirrorToLocalStorage();
}

export function deleteBox(id) {
  _boxes = _boxes.filter(box => box.id !== id);
  _items = _items.filter(item => item.boxId !== id);
  mirrorToLocalStorage();
  syncToServer('DELETE', `/boxes/${id}`); // cascada en servidor
}

// ========== ITEMS ==========

export function getItems() {
  return _items;
}

export function getItem(id) {
  return _items.find(item => item.id === id);
}

export function getItemsByBox(boxId) {
  return _items
    .filter(item => item.boxId === boxId)
    .sort((a, b) => a.order - b.order);
}

export function saveItem(item) {
  const index = _items.findIndex(i => i.id === item.id);

  if (index >= 0) {
    _items[index] = item;
    syncToServer('PUT', `/items/${item.id}`, item);
  } else {
    _items.push(item);
    syncToServer('POST', '/items', item);
  }
  mirrorToLocalStorage();
}

export function deleteItem(id) {
  _items = _items.filter(item => item.id !== id);
  mirrorToLocalStorage();
  syncToServer('DELETE', `/items/${id}`);
}

// ========== TRACKING ==========

export function trackItemClick(itemId) {
  const item = getItem(itemId);
  if (!item) return;

  item.metadata.clickCount++;
  item.metadata.lastAccessed = new Date().toISOString();
  mirrorToLocalStorage();

  // Endpoint dedicado del servidor: más ligero que mandar el item entero
  // solo para registrar un clic.
  syncToServer('POST', `/items/${itemId}/click`);
}

// ========== EXPORT / IMPORT ==========

export function exportData() {
  return {
    version: CURRENT_VERSION,
    workspaces: _workspaces,
    boxes: _boxes,
    items: _items,
    exportedAt: new Date().toISOString()
  };
}

/**
 * Importa un volcado completo, sustituyendo todos los datos actuales.
 * Ahora es asíncrona (antes no lo era) porque además de actualizar la
 * caché local, manda el volcado entero al servidor de una sola vez en
 * lugar de una petición por cada dashboard/caja/item.
 */
export async function importData(data) {
  if (!data.version || !data.workspaces || !data.boxes || !data.items) {
    throw new Error('Formato de datos inválido');
  }

  _workspaces = data.workspaces;
  _boxes = data.boxes;
  _items = data.items;
  mirrorToLocalStorage();

  try {
    await api.post('/import', data);
    _online = true;
  } catch (e) {
    console.warn('AllYourLinks: no se pudo sincronizar el import con el servidor; quedó guardado localmente.', e);
    _online = false;
  }
}
