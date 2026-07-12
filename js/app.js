// js/app.js
// Orquestador central de la aplicación: renderiza el dashboard activo,
// coordina la delegación global de eventos e inicializa los módulos.
// (Antes esta lógica vivía en links.js, mezclada con la gestión de enlaces.)

import { showToast, toggleMenu } from './shared/ui.js';
import { bus, EVENTS } from './core/events.js';
import { getCurrentDashboardId } from './domains/dashboard/dashboard.js';
import {
  initializeData,
  getActiveWorkspace,
  getBoxesByWorkspace,
  getItemsByBox,
  trackItemClick
} from './core/data-manager.js';
import { createBoxCard } from './domains/boxes/renderer.js';
import { restoreDragState, initDrag, initializeDragAndDrop } from './domains/boxes/drag.js';
import { editBox, deleteBox, initBoxModal } from './domains/boxes/boxes.js';
import { initDataIO } from './features/data-io.js';
import {
  editItem,
  deleteItem,
  initLinkModal,
  openNewLinkModal
} from './domains/content/links/links.js';

// ========== ELEMENTOS DEL DOM ==========

const list               = document.getElementById('linksList');
const openNewTabCheckbox = document.getElementById('openNewTab');

// ========== RENDERIZADO DEL DASHBOARD ==========

export function renderDashboard(dashboardId = null) {
  const dbId = dashboardId || getActiveWorkspace()?.id;
  if (!dbId) {
    list.innerHTML = '<p class="text-gray-400 text-center p-8">No hay dashboards disponibles</p>';
    return;
  }

  const boxes = getBoxesByWorkspace(dbId);
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

// ========== DELEGACIÓN GLOBAL DE EVENTOS ==========

function initEventDelegation() {
  list.addEventListener('click', (e) => {
    const target = e.target;
    const boxId  = target.dataset.boxId;

    if (boxId) {
      if (target.classList.contains('box-menu-btn'))    toggleMenu(boxId);
      if (target.classList.contains('box-edit-btn'))    editBox(boxId);
      if (target.classList.contains('box-delete-btn'))  deleteBox(boxId);
      if (target.classList.contains('add-link-btn'))    openNewLinkModal(boxId);
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

// ========== INICIALIZACIÓN DE LA APP ==========

export function initApp() {
  initializeData();
  restoreDragState();

  // El bus es la vía por la que otros módulos piden repintar el dashboard,
  // sin necesidad de importar app.js.
  bus.on(EVENTS.DASHBOARD_RENDER, (dashboardId) => renderDashboard(dashboardId));

  renderDashboard();

  openNewTabCheckbox.checked = localStorage.getItem('abrirNuevaPestana') === 'true';
  openNewTabCheckbox.addEventListener('change', () => {
    localStorage.setItem('abrirNuevaPestana', openNewTabCheckbox.checked);
    renderDashboard();
    showToast('Preferencia actualizada', 'success');
  });

  initBoxModal();
  initLinkModal();
  initEventDelegation();
  initDataIO(() => renderDashboard());
  initDrag();
}
