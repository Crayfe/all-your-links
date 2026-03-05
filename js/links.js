// js/links.js

import { showToast, toggleMenu } from './ui.js';
import { 
  initializeData,
  getActiveWorkspace,
  getBoxesByWorkspace,
  getBox,
  getItemsByBox,
  getItem,
  saveBox,
  saveItem,
  deleteBox as deleteBoxFromStorage,
  deleteItem as deleteItemFromStorage,
  trackItemClick,
  exportData,
  importData
} from './data-manager.js';
import { createBox, createLinkItem } from './data-model.js';
import { createBoxCard } from './renderer.js';

// ========== ELEMENTOS DEL DOM ==========
const list = document.getElementById('linksList');
const openNewTabCheckbox = document.getElementById('openNewTab');
const newLinkModal = document.getElementById('newLinkModal');

// ========== VARIABLES GLOBALES DRAG & DROP ==========
let sortableBoxes = null;
let sortableItems = [];
let isDragEnabled = false;

// ========== CONSTANTES ==========
export const GOOGLE_ICONS = {
  'mail.google.com': 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
  'drive.google.com': 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',
  'calendar.google.com': 'https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_11.ico',
  'docs.google.com': 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
  'sheets.google.com': 'https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico',
  'slides.google.com': 'https://ssl.gstatic.com/docs/presentations/images/favicon5.ico',
  'photos.google.com': 'https://www.gstatic.com/images/branding/product/1x/photos_48dp.png',
  'keep.google.com': 'https://ssl.gstatic.com/keep/icon_2020q4v2_128.png',
  'meet.google.com': 'https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v6/web-512dp/logo_meet_2020q4_color_2x_web_512dp.png',
  'maps.google.com': 'https://www.google.com/images/branding/product/ico/maps_32dp.ico',
  'translate.google.com': 'https://ssl.gstatic.com/images/branding/product/1x/translate_24dp.png'
};

// ========== UTILIDADES ==========

export function getFavicon(url) {
  try {
    const { hostname } = new URL(url);
    if (GOOGLE_ICONS[hostname]) return GOOGLE_ICONS[hostname];
    return `https://www.google.com/s2/favicons?sz=128&domain=${hostname}`;
  } catch (e) {
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"><circle cx="12" cy="12" r="10"/></svg>';
  }
}

function normalizeUrl(url) {
  url = url.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('www.') || (url.includes('.') && !url.includes(' '))) return `https://${url}`;
  return `https://${url}`;
}

// ========== RENDERIZADO ==========

export function renderLinks() {
  const workspace = getActiveWorkspace();
  if (!workspace) {
    list.innerHTML = '<p class="text-gray-400 text-center p-8">No hay workspaces disponibles</p>';
    return;
  }
  
  const boxes = getBoxesByWorkspace(workspace.id);
  list.innerHTML = '';
  
  if (boxes.length === 0) {
    list.innerHTML = '<p class="text-gray-400 text-center p-8">No hay cajas. Crea una para empezar a añadir enlaces.</p>';
    return;
  }
  
  boxes.forEach(box => {
    const items = getItemsByBox(box.id);
    list.appendChild(createBoxCard(box, items));
  });

  initializeDragAndDrop();
}

// ========== DRAG & DROP ==========

function updateDragButton(enabled) {
  const icon = document.getElementById('dragIcon');
  const text = document.getElementById('dragText');
  const btn  = document.getElementById('toggleDragBtn');

  if (enabled) {
    icon.innerHTML = '<path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />';
    text.textContent = 'Finalizar edición';
    btn.classList.remove('bg-purple-600', 'hover:bg-purple-500');
    btn.classList.add('bg-orange-600', 'hover:bg-orange-500');
  } else {
    icon.innerHTML = '<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />';
    text.textContent = 'Editar';
    btn.classList.remove('bg-orange-600', 'hover:bg-orange-500');
    btn.classList.add('bg-purple-600', 'hover:bg-purple-500');
  }
}

function initializeDragAndDrop() {
  if (sortableBoxes) {
    try { sortableBoxes.destroy(); } catch (e) { console.warn('Error al destruir sortableBoxes:', e); }
    sortableBoxes = null;
  }
  sortableItems.forEach(s => { try { s.destroy(); } catch (e) { console.warn('Error al destruir sortable item:', e); } });
  sortableItems = [];

  if (!isDragEnabled) return;

  const boxesContainer = document.getElementById('linksList');
  if (boxesContainer) {
    sortableBoxes = Sortable.create(boxesContainer, {
      animation: 150,
      handle: '.drag-handle',
      draggable: '.box-card',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onEnd(evt) {
        const workspace = getActiveWorkspace();
        const boxes = getBoxesByWorkspace(workspace.id);
        boxesContainer.querySelectorAll('.box-card').forEach((element, index) => {
          const box = boxes.find(b => b.id === element.dataset.boxId);
          if (box) { box.order = index; saveBox(box); }
        });
        showToast('Orden de cajas actualizado', 'success');
      }
    });
  }

  document.querySelectorAll('.items-container').forEach(container => {
    const sortableInstance = Sortable.create(container, {
      animation: 150,
      handle: '.link-item',
      draggable: '.link-item',
      group: 'links',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onMove(evt) { evt.to.classList.add('sortable-drag-over'); },
      onEnd(evt) {
        document.querySelectorAll('.items-container').forEach(c => c.classList.remove('sortable-drag-over'));
        const itemId = evt.item.dataset.itemId;
        const newBoxId = evt.to.dataset.boxId;
        const oldBoxId = evt.from.dataset.boxId;
        const item = getItem(itemId);
        if (!item) return;
        if (oldBoxId !== newBoxId) { item.boxId = newBoxId; showToast('Enlace movido a otra caja', 'success'); }
        evt.to.querySelectorAll('.link-item').forEach((element, index) => {
          const i = getItem(element.dataset.itemId);
          if (i) { i.order = index; i.boxId = newBoxId; saveItem(i); }
        });
        if (oldBoxId !== newBoxId) renderLinks();
      }
    });
    sortableItems.push(sortableInstance);
  });
}

function toggleDragAndDrop() {
  isDragEnabled = !isDragEnabled;
  localStorage.setItem('dragEnabled', isDragEnabled);
  updateDragButton(isDragEnabled);
  document.body.classList.toggle('drag-enabled', isDragEnabled);
  showToast(isDragEnabled ? 'Modo edición activado' : 'Modo edición desactivado', isDragEnabled ? 'success' : 'info');
  setTimeout(() => initializeDragAndDrop(), 100);
}

function restoreDragState() {
  if (localStorage.getItem('dragEnabled') === 'true') {
    isDragEnabled = true;
    document.body.classList.add('drag-enabled');
    updateDragButton(true);
  }
}

// ========== CRUD ITEMS ==========

function editItem(itemId) {
  const item = getItem(itemId);
  if (!item || item.type !== 'link') return;
  document.getElementById('newLinkTitle').value = item.data.title;
  document.getElementById('newLinkUrl').value = item.data.url;
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

// ========== CRUD BOXES ==========

function editBox(boxId) {
  const box = getBox(boxId);
  if (!box) return;
  const newBoxModal = document.getElementById('newBoxModal');
  document.getElementById('boxModalTitle').textContent = 'Editar caja';
  document.getElementById('newBoxTitle').value = box.title;
  document.getElementById('newBoxLayout').value = box.layout || 'grid';
  newBoxModal.dataset.editingBoxId = boxId;
  newBoxModal.classList.add('active');
}

function deleteBox(boxId) {
  const box = getBox(boxId);
  if (!box) return;
  const items = getItemsByBox(boxId);
  const confirmMsg = items.length > 0
    ? `¿Eliminar la caja "${box.title}" y sus ${items.length} enlaces?`
    : `¿Eliminar la caja "${box.title}"?`;
  if (confirm(confirmMsg)) {
    deleteBoxFromStorage(boxId);
    renderLinks();
    showToast('Caja eliminada', 'success');
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

// ========== INICIALIZACIÓN ==========

function initBoxModal() {
  const newBoxModal = document.getElementById('newBoxModal');
  const newBoxBtn = document.getElementById('newBoxBtn');

  if (newBoxBtn) {
    newBoxBtn.addEventListener('click', () => {
      document.getElementById('boxModalTitle').textContent = 'Nueva caja';
      document.getElementById('newBoxTitle').value = '';
      document.getElementById('newBoxLayout').value = 'grid';
      delete newBoxModal.dataset.editingBoxId;
      newBoxModal.classList.add('active');
    });
  }

  document.getElementById('cancelNewBox').addEventListener('click', () => {
    newBoxModal.classList.remove('active');
  });

  document.getElementById('saveNewBox').addEventListener('click', () => {
    const title = document.getElementById('newBoxTitle').value.trim();
    const layout = document.getElementById('newBoxLayout').value;
    if (!title) { showToast('El nombre de la caja es obligatorio', 'error'); return; }
    const workspace = getActiveWorkspace();
    if (!workspace) { showToast('No hay workspace activo', 'error'); return; }

    if (newBoxModal.dataset.editingBoxId) {
      const box = getBox(newBoxModal.dataset.editingBoxId);
      if (box) { box.title = title; box.layout = layout; saveBox(box); showToast('Caja actualizada', 'success'); }
      delete newBoxModal.dataset.editingBoxId;
    } else {
      const newBox = createBox(workspace.id, title);
      newBox.layout = layout;
      newBox.order = getBoxesByWorkspace(workspace.id).length;
      saveBox(newBox);
      showToast('Caja creada', 'success');
    }

    renderLinks();
    newBoxModal.classList.remove('active');
    document.getElementById('newBoxTitle').value = '';
    document.getElementById('newBoxLayout').value = 'grid';
  });

  newBoxModal.addEventListener('click', (e) => {
    if (e.target === newBoxModal) newBoxModal.classList.remove('active');
  });
}

function initLinkModal() {
  document.getElementById('cancelNewLink').addEventListener('click', () => {
    delete newLinkModal.dataset.editingId;
    delete newLinkModal.dataset.targetBoxId;
    newLinkModal.classList.remove('active');
  });

  document.getElementById('saveNewLink').addEventListener('click', () => {
    const title = document.getElementById('newLinkTitle').value.trim();
    let url = document.getElementById('newLinkUrl').value.trim();
    if (!title) { showToast('El título es obligatorio', 'error'); return; }
    if (!url) { showToast('La URL es obligatoria', 'error'); return; }
    url = normalizeUrl(url);
    try { new URL(url); } catch (e) { showToast('URL no válida', 'error'); return; }

    if (newLinkModal.dataset.editingId) {
      const item = getItem(newLinkModal.dataset.editingId);
      if (item && item.type === 'link') {
        item.data.title = title;
        item.data.url = url;
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
    document.getElementById('newLinkUrl').value = '';
  });

  newLinkModal.addEventListener('click', (e) => {
    if (e.target === newLinkModal) {
      delete newLinkModal.dataset.editingId;
      delete newLinkModal.dataset.targetBoxId;
      newLinkModal.classList.remove('active');
    }
  });
}

function initEventDelegation() {
  list.addEventListener('click', (e) => {
    const target = e.target;
    const boxId = target.dataset.boxId;

    if (boxId) {
      if (target.classList.contains('box-menu-btn')) toggleMenu(boxId);
      if (target.classList.contains('box-edit-btn')) editBox(boxId);
      if (target.classList.contains('box-delete-btn')) deleteBox(boxId);
      if (target.classList.contains('add-link-btn')) {
        delete newLinkModal.dataset.editingId;
        document.getElementById('newLinkTitle').value = '';
        document.getElementById('newLinkUrl').value = '';
        newLinkModal.dataset.targetBoxId = boxId;
        newLinkModal.classList.add('active');
      }
    }

    let itemId = target.dataset.itemId || target.closest('[data-item-id]')?.dataset.itemId;
    if (itemId) {
      const isMenuBtn = target.classList.contains('item-menu-btn') || target.closest('.item-menu-btn');
      const isEditBtn = target.classList.contains('item-edit-btn');
      const isDeleteBtn = target.classList.contains('item-delete-btn');
      if (isMenuBtn || isEditBtn || isDeleteBtn) { e.preventDefault(); e.stopPropagation(); }
      if (isMenuBtn) toggleMenu(itemId);
      if (isEditBtn) editItem(itemId);
      if (isDeleteBtn) deleteItem(itemId);
    }
  });

  list.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-item-id]');
    if (link) trackItemClick(link.dataset.itemId);
  });

  document.getElementById('toggleDragBtn')?.addEventListener('click', toggleDragAndDrop);
}

function initImportExport() {
  const exportBtn = document.getElementById('exportDataBtn');
  const importBtn = document.getElementById('importDataBtn');
  const importInput = document.getElementById('importFileInput');
  exportBtn?.addEventListener('click', exportAllData);
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) { importFromFile(e.target.files[0]); e.target.value = ''; }
    });
  }
}

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
}
