// js/drag.js
// Gestión del drag & drop y modo edición

import { showToast } from './ui.js';
import { getActiveWorkspace, getBoxesByWorkspace, getBox, getItem, saveBox, saveItem } from './data-manager.js';

let sortableBoxes = null;
let sortableItems  = [];
let isDragEnabled  = false;

// ========== ESTADO ==========

export function getDragEnabled() {
  return isDragEnabled;
}

// ========== BOTÓN EDITAR ==========

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

// ========== SORTABLE ==========

export function initializeDragAndDrop() {
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
        const itemId   = evt.item.dataset.itemId;
        const newBoxId = evt.to.dataset.boxId;
        const oldBoxId = evt.from.dataset.boxId;
        const item = getItem(itemId);
        if (!item) return;
        if (oldBoxId !== newBoxId) { item.boxId = newBoxId; showToast('Enlace movido a otra caja', 'success'); }
        evt.to.querySelectorAll('.link-item').forEach((element, index) => {
          const i = getItem(element.dataset.itemId);
          if (i) { i.order = index; i.boxId = newBoxId; saveItem(i); }
        });
        // Importación dinámica para evitar dependencia circular
        if (oldBoxId !== newBoxId) {
          import('./links.js').then(m => m.renderLinks());
        }
      }
    });
    sortableItems.push(sortableInstance);
  });
}

export function toggleDragAndDrop() {
  isDragEnabled = !isDragEnabled;
  localStorage.setItem('dragEnabled', isDragEnabled);
  updateDragButton(isDragEnabled);
  document.body.classList.toggle('drag-enabled', isDragEnabled);
  showToast(isDragEnabled ? 'Modo edición activado' : 'Modo edición desactivado', isDragEnabled ? 'success' : 'info');
  setTimeout(() => initializeDragAndDrop(), 100);
}

export function restoreDragState() {
  if (localStorage.getItem('dragEnabled') === 'true') {
    isDragEnabled = true;
    document.body.classList.add('drag-enabled');
    updateDragButton(true);
  }
}

// ========== INICIALIZACIÓN ==========

export function initDrag() {
  document.getElementById('toggleDragBtn')?.addEventListener('click', toggleDragAndDrop);
}
