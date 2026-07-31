// js/links.js
// Tipo de contenido "enlace": CRUD de items tipo 'link' y su modal.
// La orquestación del dashboard y la delegación global de eventos
// viven en app.js; aquí solo lo específico de enlaces.

import { showToast } from '../../../shared/ui.js';
import { getCurrentDashboardId } from '../../dashboard/dashboard.js';
import {
  getItemsByBox,
  getItem,
  saveItem,
  deleteItem as deleteItemFromStorage
} from '../../../core/data-manager.js';
import { createLinkItem } from '../../../core/data-model.js';
import { normalizeUrl } from '../../../shared/utils.js';
import { bus, EVENTS } from '../../../core/events.js';

// ========== ELEMENTOS DEL DOM ==========

const newLinkModal = document.getElementById('newLinkModal');

// ========== HELPERS ==========

function parseTags(raw) {
  return raw
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

function clearLinkModalFields() {
  document.getElementById('newLinkTitle').value = '';
  document.getElementById('newLinkUrl').value   = '';
  document.getElementById('newLinkTags').value  = '';
}

// ========== CRUD ==========

export function editItem(itemId) {
  const item = getItem(itemId);
  if (!item || item.type !== 'link') return;
  document.getElementById('newLinkTitle').value = item.data.title;
  document.getElementById('newLinkUrl').value   = item.data.url;
  document.getElementById('newLinkTags').value  = (item.metadata?.tags || []).join(', ');
  document.getElementById('linkModalTitle').textContent = 'Editar enlace';
  newLinkModal.dataset.editingId = itemId;
  newLinkModal.classList.add('active');
  showToast('Edita el enlace y guarda para aplicar cambios', 'info');
}

export function deleteItem(itemId) {
  if (confirm('¿Eliminar este enlace?')) {
    deleteItemFromStorage(itemId);
    bus.emit(EVENTS.DASHBOARD_RENDER, getCurrentDashboardId());
    showToast('Enlace eliminado', 'success');
  }
}

// ========== MODAL ==========

// Abre el modal para crear un enlace nuevo en una caja concreta.
// Llamado desde la delegación de eventos de app.js (botón "add-link-btn").
export function openNewLinkModal(boxId) {
  delete newLinkModal.dataset.editingId;
  clearLinkModalFields();
  document.getElementById('linkModalTitle').textContent = 'Nuevo enlace';
  newLinkModal.dataset.targetBoxId = boxId;
  newLinkModal.classList.add('active');
}

export function initLinkModal() {
  document.getElementById('cancelNewLink').addEventListener('click', () => {
    delete newLinkModal.dataset.editingId;
    delete newLinkModal.dataset.targetBoxId;
    newLinkModal.classList.remove('active');
  });

  document.getElementById('saveNewLink').addEventListener('click', () => {
    const title = document.getElementById('newLinkTitle').value.trim();
    let   url   = document.getElementById('newLinkUrl').value.trim();
    const tags  = parseTags(document.getElementById('newLinkTags').value);
    if (!title) { showToast('El título es obligatorio', 'error'); return; }
    if (!url)   { showToast('La URL es obligatoria', 'error'); return; }
    url = normalizeUrl(url);
    try { new URL(url); } catch (e) { showToast('URL no válida', 'error'); return; }

    if (newLinkModal.dataset.editingId) {
      const item = getItem(newLinkModal.dataset.editingId);
      if (item && item.type === 'link') {
        item.data.title = title;
        item.data.url   = url;
        item.metadata   = item.metadata || {};
        item.metadata.tags = tags;
        saveItem(item);
        showToast('Enlace actualizado', 'success');
      }
      delete newLinkModal.dataset.editingId;
    } else {
      const targetBoxId = newLinkModal.dataset.targetBoxId;
      if (!targetBoxId) { showToast('Error: no se especificó la caja destino', 'error'); return; }
      const newItem = createLinkItem(targetBoxId, title, url);
      newItem.order = getItemsByBox(targetBoxId).length;
      newItem.metadata.tags = tags;
      saveItem(newItem);
      showToast('Enlace guardado correctamente', 'success');
      delete newLinkModal.dataset.targetBoxId;
    }

    bus.emit(EVENTS.DASHBOARD_RENDER, getCurrentDashboardId());
    newLinkModal.classList.remove('active');
    clearLinkModalFields();
  });

  newLinkModal.addEventListener('click', (e) => {
    if (e.target === newLinkModal) {
      delete newLinkModal.dataset.editingId;
      delete newLinkModal.dataset.targetBoxId;
      newLinkModal.classList.remove('active');
    }
  });
}
