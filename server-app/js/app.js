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
  getDashboard,
  getBoxesByWorkspace,
  getItemsByBox,
  trackItemClick
} from './core/data-manager.js';
import { createBoxCard } from './domains/boxes/renderer.js';
import { applyDashboardBackground } from './shared/background.js';
import { restoreDragState, initDrag, initializeDragAndDrop, isDragging } from './domains/boxes/drag.js';
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

// Último snapshot renderizado del dashboard activo (cajas + sus items).
// Sirve para que la sincronización de fondo (DATA_REFRESHED, que puede
// dispararse por CUALQUIER cambio en CUALQUIER dashboard/nota/evento, no
// solo el que estás viendo) no fuerce un re-render completo —y el
// parpadeo/"tearing" que eso provoca— cuando lo que cambió no afecta en
// nada a lo que ya tienes pintado en pantalla.
let _lastRenderedSnapshot = null;

/**
 * Normaliza una caja dejando SOLO los campos que afectan a lo que se ve,
 * aplicando los mismos valores por defecto que usa el servidor.
 *
 * Es una lista blanca a propósito, no una lista de exclusiones: el
 * objeto local (recién creado en el navegador) y el que devuelve el
 * servidor difieren en bastante más que los timestamps — el servidor
 * rellena con defaults campos que localmente ni existen (statsLimit,
 * rssCount, calendarView, noteId...), y normaliza '' a null. Comparar
 * los objetos en crudo hacía que parecieran distintos tras cada
 * sincronización aunque en pantalla fuesen idénticos, provocando un
 * repintado completo (y su parpadeo) segundos después de cada guardado.
 */
function normalizeBoxForCompare(box) {
  return {
    id: box.id,
    workspaceId: box.workspaceId,
    title: box.title ?? '',
    layout: box.layout ?? 'grid',
    colSpan: box.colSpan ?? 1,
    titleAlign: box.titleAlign ?? 'left',
    showTitle: box.showTitle !== false,
    titleColor: box.titleColor ?? '#f3f4f6',
    titleFont: box.titleFont ?? 'Inter',
    linkColor: box.linkColor ?? '#ffffff',
    linkFontSize: box.linkFontSize ?? 14,
    bgColor: box.bgColor ?? '#000000',
    bgOpacity: box.bgOpacity ?? 0.7,
    gridCols: box.gridCols ?? 2,
    orbSize: box.orbSize ?? 80,
    listRowHeight: box.listRowHeight ?? 'normal',
    statsLimit: box.statsLimit ?? 5,
    rssFeedUrl: box.rssFeedUrl || null,
    rssCount: box.rssCount ?? 8,
    calendarView: box.calendarView ?? 'month',
    noteId: box.noteId || null,
    order: box.order ?? 0
  };
}

/** Mismo criterio para los enlaces: solo lo que afecta al render. */
function normalizeItemForCompare(item) {
  return {
    id: item.id,
    boxId: item.boxId,
    type: item.type ?? 'link',
    order: item.order ?? 0,
    data: item.data ?? {},
    // clickCount sí entra: el widget de estadísticas depende de él.
    // lastAccessed no, porque no cambia nada de lo que se ve.
    clickCount: item.metadata?.clickCount ?? 0,
    tags: item.metadata?.tags ?? []
  };
}

/**
 * Como JSON.stringify normal, pero ordena las claves de cada objeto
 * alfabéticamente antes de serializar, para que el orden de inserción
 * de las propiedades no haga parecer distintos dos objetos idénticos.
 */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',')}}`;
  }
  return JSON.stringify(value);
}

function computeDashboardSnapshot(dbId) {
  const boxes = getBoxesByWorkspace(dbId);
  return stableStringify(boxes.map(box => ({
    box: normalizeBoxForCompare(box),
    items: getItemsByBox(box.id).map(normalizeItemForCompare)
  })));
}

export function renderDashboard(dashboardId = null) {
  const dbId = dashboardId || getActiveWorkspace()?.id;
  if (!dbId) {
    list.innerHTML = '<p class="text-gray-400 text-center p-8">No hay dashboards disponibles</p>';
    return;
  }

  _lastRenderedSnapshot = computeDashboardSnapshot(dbId);

  // El dashboard por defecto (type='links', sin layoutConfig) no toca
  // este bloque para nada: list.style.gridTemplateColumns nunca se
  // establece, así que sigue pintándose con la clase estática de
  // siempre (md:grid-cols-3) exactamente igual que hasta ahora. Solo un
  // dashboard type='flex-grid' con su configuración define aquí su
  // propio número de columnas y proporción de anchos.
  const dashboard = getDashboard(dbId);
  if (dashboard?.type === 'flex-grid' && dashboard.layoutConfig?.template) {
    list.style.gridTemplateColumns = dashboard.layoutConfig.template;
  } else {
    list.style.gridTemplateColumns = '';
  }

  // Fondo propio de este dashboard si tiene uno; si no, el global de
  // Perfil (ver shared/background.js).
  applyDashboardBackground(dashboard);

  const boxes = getBoxesByWorkspace(dbId).filter(box => !box.parentBoxId);
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
    const boxId  = target.dataset.boxId || target.closest('[data-box-id]')?.dataset.boxId;

    if (boxId) {
      if (target.classList.contains('box-menu-btn'))    toggleMenu(boxId);
      if (target.classList.contains('box-edit-btn'))    editBox(boxId);
      if (target.classList.contains('box-delete-btn'))  deleteBox(boxId);
      if (target.classList.contains('add-link-btn'))    openNewLinkModal(boxId);
      // Lápiz de nota: siempre visible (no edit-only), abre directamente
      // en la pestaña de edición del contenido, no en Propiedades.
      if (target.closest('.note-edit-btn'))             editBox(boxId, { initialTab: 'note' });
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

  // Cuando llegan datos nuevos del servidor en segundo plano (stale-while-
  // revalidate: la UI ya se pintó con la caché, y esto llega después),
  // repintar SOLO si algo del dashboard que se está viendo cambió de
  // verdad — el cambio pudo venir de otro dashboard, otra nota o un
  // evento de calendario, y forzar un re-render completo sin necesidad
  // es lo que causaba el parpadeo/"tearing" al interactuar justo cuando
  // llega una de estas sincronizaciones periódicas (cada ~20s).
  bus.on(EVENTS.DATA_REFRESHED, () => {
    // Nunca reemplazar el DOM mientras el usuario está arrastrando algo
    // activamente: Sortable.js está manipulando esos nodos en directo, y
    // sustituirlos a mitad de gesto es justo lo que causaba el parpadeo/
    // "tearing" al arrastrar. Se pierde esta actualización concreta sin
    // problema — la siguiente comprobación periódica (~20s) la recogerá
    // en cuanto el arrastre termine.
    if (isDragging()) return;

    const dbId = getCurrentDashboardId() || getActiveWorkspace()?.id;
    if (!dbId) { renderDashboard(); return; }
    if (computeDashboardSnapshot(dbId) !== _lastRenderedSnapshot) {
      renderDashboard(dbId);
    }
  });

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
