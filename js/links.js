// js/links.js
// Gestión de enlaces (items tipo 'link'): renderizado, CRUD y delegación de eventos

import { showToast, toggleMenu } from './ui.js';
import {
  initializeData,
  getActiveWorkspace,
  getBoxesByWorkspace,
  getItemsByBox,
  getItem,
  saveItem,
  deleteItem as deleteItemFromStorage,
  trackItemClick,
  exportData,
  importData
} from './data-manager.js';
import { createLinkItem } from './data-model.js';
import { createBoxCard } from './renderer.js';
import { normalizeUrl } from './utils.js';
import { restoreDragState, initDrag, initializeDragAndDrop } from './drag.js';
import { editBox, deleteBox, initBoxModal } from './boxes.js';

// ========== ELEMENTOS DEL DOM ==========

const list               = document.getElementById('linksList');
const openNewTabCheckbox = document.getElementById('openNewTab');
const newLinkModal       = document.getElementById('newLinkModal');

// ========== RENDERIZADO ==========

export function renderLinks() {
  const workspace = getActiveWorkspace();
  if (!workspace) {
    list.innerHTML = '<p class="text-gray-400 text-center p-8">No hay dashboards disponibles</p>';
    return;
  }

  const boxes = getBoxesByWorkspace(workspace.id);
  list.innerHTML = '';

  if (boxes.length === 0) {
    list.innerHTML = '<p class="text-gray-400 text-center p-8">No hay cajas. Activa el modo edición y crea una para empezar.</p>';
    return;
  }

  boxes.forEach(box => {
    const items = getItemsByBox(box.id);
    list.appendChild(createBoxCard(box, items));
  });

  initializeDragAndDrop();
}

// ========== CRUD ITEMS ==========

function editItem(itemId) {
  const item = getItem(itemId);
  if (!item || item.type !== 'link') return;
  document.getElementById('newLinkTitle').value = item.data.title;
  document.getElementById('newLinkUrl').value   = item.data.url;
  document.getElementById('linkModalTitle').textContent = 'Editar enlace';
  newLinkModal.dataset.editingId = itemId;
  newLinkModal.classList.add('active');
  showToast('Edita el enlace y guarda para aplicar cambios', 'info');
}

function deleteItem(itemId) {
  if (confirm('¿Eliminar este enlace?')) {
    deleteItemFromStorage(itemId);
    renderLinks();
    showToast('Enlace eliminado', 'success');
  }
}

// ========== IMPORT / EXPORT ==========

function exportAllData() {
  const data = exportData();
  if (!data.items || data.items.length === 0) { showToast('No hay datos para exportar', 'info'); return; }
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataUri);
  a.setAttribute('download', `dashboard_backup_${Date.now()}.json`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Datos exportados con éxito', 'success');
}

function importFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      importData(JSON.parse(e.target.result));
      renderLinks();
      showToast('Datos importados correctamente', 'success');
    } catch (error) {
      showToast(`Error al importar: ${error.message}`, 'error');
      console.error('Error de importación:', error);
    }
  };
  reader.readAsText(file);
}

// ========== MODALES ==========

function initLinkModal() {
  document.getElementById('cancelNewLink').addEventListener('click', () => {
    delete newLinkModal.dataset.editingId;
    delete newLinkModal.dataset.targetBoxId;
    newLinkModal.classList.remove('active');
  });

  document.getElementById('saveNewLink').addEventListener('click', () => {
    const title = document.getElementById('newLinkTitle').value.trim();
    let   url   = document.getElementById('newLinkUrl').value.trim();
    if (!title) { showToast('El título es obligatorio', 'error'); return; }
    if (!url)   { showToast('La URL es obligatoria', 'error'); return; }
    url = normalizeUrl(url);
    try { new URL(url); } catch (e) { showToast('URL no válida', 'error'); return; }

    if (newLinkModal.dataset.editingId) {
      const item = getItem(newLinkModal.dataset.editingId);
      if (item && item.type === 'link') {
        item.data.title = title;
        item.data.url   = url;
        saveItem(item);
        showToast('Enlace actualizado', 'success');
      }
      delete newLinkModal.dataset.editingId;
    } else {
      const targetBoxId = newLinkModal.dataset.targetBoxId;
      if (!targetBoxId) { showToast('Error: no se especificó la caja destino', 'error'); return; }
      const newItem = createLinkItem(targetBoxId, title, url);
      newItem.order = getItemsByBox(targetBoxId).length;
      saveItem(newItem);
      showToast('Enlace guardado correctamente', 'success');
      delete newLinkModal.dataset.targetBoxId;
    }

    renderLinks();
    newLinkModal.classList.remove('active');
    document.getElementById('newLinkTitle').value = '';
    document.getElementById('newLinkUrl').value   = '';
  });

  newLinkModal.addEventListener('click', (e) => {
    if (e.target === newLinkModal) {
      delete newLinkModal.dataset.editingId;
      delete newLinkModal.dataset.targetBoxId;
      newLinkModal.classList.remove('active');
    }
  });
}

// ========== DELEGACIÓN DE EVENTOS ==========

function initEventDelegation() {
  list.addEventListener('click', (e) => {
    const target = e.target;
    const boxId  = target.dataset.boxId;

    if (boxId) {
      if (target.classList.contains('box-menu-btn'))    toggleMenu(boxId);
      if (target.classList.contains('box-edit-btn'))    editBox(boxId);
      if (target.classList.contains('box-delete-btn'))  deleteBox(boxId);
      if (target.classList.contains('add-link-btn')) {
        delete newLinkModal.dataset.editingId;
        document.getElementById('newLinkTitle').value = '';
        document.getElementById('newLinkUrl').value   = '';
        newLinkModal.dataset.targetBoxId = boxId;
        newLinkModal.classList.add('active');
      }
    }

    const itemId = target.dataset.itemId || target.closest('[data-item-id]')?.dataset.itemId;
    if (itemId) {
      const isMenuBtn   = target.classList.contains('item-menu-btn') || target.closest('.item-menu-btn');
      const isEditBtn   = target.classList.contains('item-edit-btn');
      const isDeleteBtn = target.classList.contains('item-delete-btn');
      if (isMenuBtn || isEditBtn || isDeleteBtn) { e.preventDefault(); e.stopPropagation(); }
      if (isMenuBtn)   toggleMenu(itemId);
      if (isEditBtn)   editItem(itemId);
      if (isDeleteBtn) deleteItem(itemId);
    }
  });

  list.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-item-id]');
    if (link) trackItemClick(link.dataset.itemId);
  });
}

function initImportExport() {
  const exportBtn   = document.getElementById('exportDataBtn');
  const importBtn   = document.getElementById('importDataBtn');
  const importInput = document.getElementById('importFileInput');
  exportBtn?.addEventListener('click', exportAllData);
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) { importFromFile(e.target.files[0]); e.target.value = ''; }
    });
  }
}

// ========== INICIALIZACIÓN ==========

export function initLinks() {
  initializeData();
  restoreDragState();
  renderLinks();
  openNewTabCheckbox.checked = localStorage.getItem('abrirNuevaPestana') === 'true';
  openNewTabCheckbox.addEventListener('change', () => {
    localStorage.setItem('abrirNuevaPestana', openNewTabCheckbox.checked);
    renderLinks();
    showToast('Preferencia actualizada', 'success');
  });
  initBoxModal();
  initLinkModal();
  initEventDelegation();
  initImportExport();
  initDrag();
}
