// data-manager.js
// Gestión centralizada de datos (localStorage) - 3 niveles

import { createWorkspace, createBox, createLinkItem } from './data-model.js';

const STORAGE_KEYS = {
  WORKSPACES: 'workspaces_v2',
  BOXES: 'boxes_v2',
  ITEMS: 'items_v2',
  VERSION: 'data_version'
};

const CURRENT_VERSION = '2.0';

// ========== INICIALIZACIÓN ==========

/**
 * Inicializa el sistema de datos
 * Crea workspace + box por defecto si no existen
 */
export function initializeData() {
  localStorage.setItem(STORAGE_KEYS.VERSION, CURRENT_VERSION);
  
  const workspaces = getWorkspaces();
  
  // Si no hay workspaces, crear el de "Enlaces" por defecto
  if (workspaces.length === 0) {
    const linksWorkspace = createWorkspace('Enlaces', 'links');
    linksWorkspace.active = true;
    saveWorkspace(linksWorkspace);
    
    // Crear una box por defecto dentro del workspace
    const defaultBox = createBox(linksWorkspace.id, 'Favoritos');
    saveBox(defaultBox);
  }
}

// ========== WORKSPACES ==========

export function getWorkspaces() {
  const data = localStorage.getItem(STORAGE_KEYS.WORKSPACES);
  return data ? JSON.parse(data) : [];
}

export function getWorkspace(id) {
  const workspaces = getWorkspaces();
  return workspaces.find(ws => ws.id === id);
}

export function getActiveWorkspace() {
  const workspaces = getWorkspaces();
  return workspaces.find(ws => ws.active) || workspaces[0];
}

export function saveWorkspace(workspace) {
  const workspaces = getWorkspaces();
  const index = workspaces.findIndex(ws => ws.id === workspace.id);
  
  workspace.updatedAt = new Date().toISOString();
  
  if (index >= 0) {
    workspaces[index] = workspace;
  } else {
    workspaces.push(workspace);
  }
  
  localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(workspaces));
}

export function deleteWorkspace(id) {
  const workspaces = getWorkspaces().filter(ws => ws.id !== id);
  localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(workspaces));
  
  // Eliminar también todas las boxes de ese workspace
  const boxes = getBoxes().filter(box => box.workspaceId !== id);
  localStorage.setItem(STORAGE_KEYS.BOXES, JSON.stringify(boxes));
  
  // Eliminar items de esas boxes
  const boxIds = boxes.map(b => b.id);
  const items = getItems().filter(item => boxIds.includes(item.boxId));
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
}

export function setActiveWorkspace(id) {
  const workspaces = getWorkspaces();
  workspaces.forEach(ws => {
    ws.active = (ws.id === id);
  });
  localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(workspaces));
}

// ========== BOXES ==========

export function getBoxes() {
  const data = localStorage.getItem(STORAGE_KEYS.BOXES);
  return data ? JSON.parse(data) : [];
}

export function getBox(id) {
  const boxes = getBoxes();
  return boxes.find(box => box.id === id);
}

export function getBoxesByWorkspace(workspaceId) {
  return getBoxes()
    .filter(box => box.workspaceId === workspaceId)
    .sort((a, b) => a.order - b.order);
}

export function saveBox(box) {
  const boxes = getBoxes();
  const index = boxes.findIndex(b => b.id === box.id);
  
  box.updatedAt = new Date().toISOString();
  
  if (index >= 0) {
    boxes[index] = box;
  } else {
    boxes.push(box);
  }
  
  localStorage.setItem(STORAGE_KEYS.BOXES, JSON.stringify(boxes));
}

export function deleteBox(id) {
  const boxes = getBoxes().filter(box => box.id !== id);
  localStorage.setItem(STORAGE_KEYS.BOXES, JSON.stringify(boxes));
  
  // Eliminar también todos los items de esa box
  const items = getItems().filter(item => item.boxId !== id);
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
}

// ========== ITEMS ==========

export function getItems() {
  const data = localStorage.getItem(STORAGE_KEYS.ITEMS);
  return data ? JSON.parse(data) : [];
}

export function getItem(id) {
  const items = getItems();
  return items.find(item => item.id === id);
}

export function getItemsByBox(boxId) {
  return getItems()
    .filter(item => item.boxId === boxId)
    .sort((a, b) => a.order - b.order);
}

export function saveItem(item) {
  const items = getItems();
  const index = items.findIndex(i => i.id === item.id);
  
  if (index >= 0) {
    items[index] = item;
  } else {
    items.push(item);
  }
  
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
}

export function deleteItem(id) {
  const items = getItems().filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
}

// ========== TRACKING ==========

export function trackItemClick(itemId) {
  const item = getItem(itemId);
  if (!item) return;
  
  item.metadata.clickCount++;
  item.metadata.lastAccessed = new Date().toISOString();
  
  saveItem(item);
}

// ========== EXPORT / IMPORT ==========

export function exportData() {
  return {
    version: CURRENT_VERSION,
    workspaces: getWorkspaces(),
    boxes: getBoxes(),
    items: getItems(),
    exportedAt: new Date().toISOString()
  };
}

export function importData(data) {
  if (!data.version || !data.workspaces || !data.boxes || !data.items) {
    throw new Error('Formato de datos inválido');
  }
  
  localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(data.workspaces));
  localStorage.setItem(STORAGE_KEYS.BOXES, JSON.stringify(data.boxes));
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(data.items));
  localStorage.setItem(STORAGE_KEYS.VERSION, data.version);
}