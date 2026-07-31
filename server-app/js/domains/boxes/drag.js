// js/drag.js
// Gestión del drag & drop y modo edición

import { showToast } from '../../shared/ui.js';
import { bus, EVENTS } from '../../core/events.js';
import { getActiveWorkspace, getBoxesByWorkspace, getBox, getItem, saveBox, saveItem, refreshFromServerNow } from '../../core/data-manager.js';
import { getCurrentDashboardId } from '../dashboard/dashboard.js';
import { setEditMode } from '../../core/edit-mode.js';

let sortableBoxes = null;
let sortableItems  = [];
let isDragEnabled  = false;

// Se pone a true justo cuando empieza un arrastre y a false cuando
// termina. Un re-render completo del dashboard (por ejemplo, al llegar
// una sincronización de fondo) mientras esto es true sustituiría los
// nodos DOM que Sortable.js está manipulando en directo bajo el ratón,
// interrumpiendo el gesto con un parpadeo visible. app.js consulta este
// estado antes de repintar por una sincronización de fondo.
let isDraggingActive = false;

export function isDragging() {
  return isDraggingActive;
}

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
      draggable: '.box-card, .box-container',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onStart() { isDraggingActive = true; },
      onEnd(evt) {
        isDraggingActive = false;
        const currentId = getCurrentDashboardId() || getActiveWorkspace()?.id;
        const boxes = getBoxesByWorkspace(currentId);

        // Solo hijos DIRECTOS: querySelectorAll('.box-card') buscaría en
        // todo el árbol, incluidas las cajas anidadas dentro de un
        // contenedor — contándolas por error en el orden del nivel
        // superior y descuadrando también el suyo propio dentro del
        // contenedor (que usa el mismo campo "order", pero con otro
        // significado: su posición entre las hermanas de ESE contenedor).
        Array.from(boxesContainer.children)
          .filter(el => el.classList.contains('box-card') || el.classList.contains('box-container'))
          .forEach((element, index) => {
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
      onStart() { isDraggingActive = true; },
      onMove(evt) { evt.to.classList.add('sortable-drag-over'); },
      onEnd(evt) {
        isDraggingActive = false;
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
          const currentId = getCurrentDashboardId();
          bus.emit(EVENTS.DASHBOARD_RENDER, currentId);
        }
      }
    });
    sortableItems.push(sortableInstance);
  });
}

export function toggleDragAndDrop() {
  isDragEnabled = !isDragEnabled;
  setEditMode(isDragEnabled);
  localStorage.setItem('dragEnabled', isDragEnabled);
  updateDragButton(isDragEnabled);
  document.body.classList.toggle('drag-enabled', isDragEnabled);
  showToast(isDragEnabled ? 'Modo edición activado' : 'Modo edición desactivado', isDragEnabled ? 'success' : 'info');
  // Rerenderizar lista de dashboards para mostrar/ocultar menú contextual
  bus.emit(EVENTS.DASHBOARD_LIST_CHANGED);
  setTimeout(() => initializeDragAndDrop(), 100);

  // Al SALIR del modo edición, sincronizar de inmediato en vez de esperar
  // al próximo ciclo periódico (~20s) — así cualquier cambio que haya
  // podido quedar pendiente en otro dispositivo mientras estabas editando
  // se refleja sin demora perceptible.
  if (!isDragEnabled) {
    refreshFromServerNow();
  }
}

export function restoreDragState() {
  if (localStorage.getItem('dragEnabled') === 'true') {
    isDragEnabled = true;
    setEditMode(true);
    document.body.classList.add('drag-enabled');
    updateDragButton(true);
  }
}

// ========== INICIALIZACIÓN ==========

export function initDrag() {
  document.getElementById('toggleDragBtn')?.addEventListener('click', toggleDragAndDrop);
}
