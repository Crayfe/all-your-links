// data-model.js
// Definición de la estructura de datos del sistema (3 niveles)

/**
 * WORKSPACE (Vista completa)
 * Representa una vista/página completa (Enlaces, Notas, Feed, etc.)
 */
export const WorkspaceSchema = {
  id: '',          // Único, formato: "ws_TYPE" (ej: "ws_links")
  name: '',        // Nombre mostrado en UI
  type: '',        // 'links' | 'notes' | 'feed' | 'calendar' (extensible)
  active: false,   // Solo uno puede estar activo
  order: 0,        // Orden en la navegación
  createdAt: '',   // ISO timestamp
  updatedAt: ''    // ISO timestamp
};

/**
 * BOX (Caja/Tarjeta)
 * Contenedor de items dentro de un workspace
 */
export const BoxSchema = {
  id: '',           // Único, formato: "box_TIMESTAMP_RANDOM"
  workspaceId: '',  // ID del workspace al que pertenece
  title: '',        // Título de la caja
  layout: 'grid',   // 'grid' | 'list' | 'orbs'
  colSpan: 1,          // 1 | 2 | 3 — columnas que ocupa en el grid
  titleAlign: 'left',  // 'left' | 'center' | 'right'
  titleColor: '#f3f4f6', // color hex del título
  linkColor: '#ffffff',  // color hex del texto de los enlaces
  order: 0,         // Posición dentro del workspace
  createdAt: '',    // ISO timestamp
  updatedAt: ''     // ISO timestamp
};

/**
 * ITEM (Contenido)
 * Elemento individual dentro de una box
 */
export const ItemSchema = {
  id: '',           // Único, formato: "item_TIMESTAMP_RANDOM"
  boxId: '',        // ID de la box a la que pertenece
  type: 'link',     // 'link' | 'note' | 'rss_item' | 'task' (extensible)
  order: 0,         // Posición dentro de la box
  data: {},         // Datos específicos según el type
  metadata: {
    clickCount: 0,
    lastAccessed: null,
    createdAt: '',
    tags: []
  }
};

/**
 * Estructura específica para items tipo 'link'
 */
export const LinkDataSchema = {
  title: '',
  url: ''
};

// ========== GENERADORES ==========

/**
 * Genera un ID único
 */
export function generateId(prefix = 'item') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Crea un workspace con valores por defecto
 */
export function createWorkspace(name, type) {
  const now = new Date().toISOString();
  return {
    id: `ws_${type}`,
    name,
    type,
    active: false,
    order: 0,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Crea una box con valores por defecto
 */
export function createBox(workspaceId, title) {
  const now = new Date().toISOString();
  return {
    id: generateId('box'),
    workspaceId,
    title,
    layout: 'grid',
    colSpan: 1,
    titleAlign: 'left',
    titleColor: '#f3f4f6',
    linkColor: '#ffffff',
    order: 0,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Crea un item tipo 'link'
 */
export function createLinkItem(boxId, title, url) {
  const now = new Date().toISOString();
  return {
    id: generateId('item'),
    boxId,
    type: 'link',
    order: 0,
    data: {
      title,
      url
    },
    metadata: {
      clickCount: 0,
      lastAccessed: null,
      createdAt: now,
      tags: []
    }
  };
}

/**
 * Crea un item genérico (para futuros tipos)
 */
export function createItem(boxId, type, data) {
  const now = new Date().toISOString();
  return {
    id: generateId('item'),
    boxId,
    type,
    order: 0,
    data,
    metadata: {
      clickCount: 0,
      lastAccessed: null,
      createdAt: now,
      tags: []
    }
  };
}