// js/dashboard.js
// Gestión de dashboards: navegación, CRUD y renderizado en sidebar

import { showToast, toggleMenu, showSection } from '../../shared/ui.js';
import { buildGridTemplate } from '../../shared/grid-layout.js';
import { uploadFile } from '../../core/upload-client.js';
import { applyDashboardBackground } from '../../shared/background.js';
import { bus, EVENTS } from '../../core/events.js';
import {
  getDashboards,
  getDashboard,
  getActiveDashboard,
  saveDashboard,
  deleteDashboard as deleteDashboardFromStorage,
  setActiveDashboard,
  setPinnedDashboard,
  getPinnedDashboard
} from '../../core/data-manager.js';
import { createDashboard } from '../../core/data-model.js';

// Estado de sesión — no depende de localStorage para la sesión actual
let _activeDashboardId = null;

// ========== RENDERIZADO SIDEBAR ==========

export function renderDashboardList() {
  const container  = document.getElementById('dashboardList');
  if (!container) return;

  const dashboards = getDashboards().sort((a, b) => a.order - b.order);
  const active     = _activeDashboardId ? { id: _activeDashboardId } : getActiveDashboard();
  const pinned     = getPinnedDashboard();
  const isEditMode = document.body.classList.contains('drag-enabled');

  container.innerHTML = '';

  dashboards.forEach((db, index) => {
    const isActive = db.id === active?.id;
    const isPinned = db.id === pinned?.id;

    const btn = document.createElement('div');
    btn.className = `dashboard-item relative flex items-center group
      ${isActive ? 'bg-gray-700' : 'hover:bg-gray-700/60'}
      rounded-md transition-colors cursor-pointer`;
    btn.dataset.dashboardId = db.id;
    btn.dataset.tooltip = db.name;

    btn.innerHTML = `
      <!-- Botón principal: mini orbe (colapsado) + icono+nombre (expandido) -->
      <button class="dashboard-switch-btn flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5"
              data-dashboard-id="${db.id}" title="${db.name}">
        <!-- Mini orbe: visible solo en sidebar colapsada -->
        <span class="dashboard-mini-orb ${isActive ? 'is-active' : ''}" title="${db.name}">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mb-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.881a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
          </svg>
          <span class="dashboard-mini-label">${db.name}</span>
        </span>
        <!-- Icono SVG: visible solo en sidebar expandida -->
        <span class="dashboard-icon flex-shrink-0 w-6 h-6 flex items-center justify-center relative">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.881a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
          </svg>
          ${isPinned ? `<span class="pin-indicator absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-400" title="Dashboard de inicio"></span>` : ''}
        </span>
        <span class="dashboard-label sidebar-text truncate text-sm ${isActive ? 'text-white font-medium' : 'text-gray-300'}">
          ${db.name}
        </span>
      </button>

      <!-- Pin (siempre visible, no requiere modo edición) -->
      <button class="dashboard-pin-btn flex-shrink-0 px-1 py-2 opacity-0 group-hover:opacity-100 transition-opacity
                     ${isPinned ? '!opacity-100' : ''}"
              data-dashboard-id="${db.id}"
              title="${isPinned ? 'Dashboard de inicio' : 'Fijar como inicio'}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 ${isPinned ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      </button>

      <!-- Menú contextual (solo modo edición) -->
      <div class="dashboard-menu-wrap edit-only flex-shrink-0 relative">
        <button class="dashboard-menu-btn px-1 py-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
                data-dashboard-id="${db.id}">⋯</button>
        <div id="db-menu-${db.id}" class="menu-options hidden absolute right-0 top-8 bg-white border rounded shadow-md z-30 dark:bg-gray-700 dark:border-gray-600 min-w-[140px]">
          <button data-dashboard-id="${db.id}" class="block w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 dark:text-gray-200 dashboard-edit-btn">Editar</button>
          <button data-dashboard-id="${db.id}" class="block w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900 text-gray-700 dark:text-gray-200 dashboard-delete-btn ${dashboards.length <= 1 ? 'opacity-40 cursor-not-allowed' : ''}">Eliminar</button>
        </div>
      </div>
    `;

    container.appendChild(btn);
  });
}

// ========== CAMBIO DE DASHBOARD ==========

export function switchDashboard(id) {
  if (_activeDashboardId === id) return;
  _activeDashboardId = id;
  setActiveDashboard(id);
  updateBreadcrumb();
  renderDashboardList();

  // Vaciar el contenedor síncronamente evita el parpadeo del contenido anterior
  const linksContainer = document.getElementById('linksList');
  if (linksContainer) linksContainer.innerHTML = ''; 
  
  bus.emit(EVENTS.DASHBOARD_RENDER, id);
}

// ========== PIN ==========

function pinDashboard(id) {
  const db = getDashboard(id);
  if (!db) return;
  const isPinned = getPinnedDashboard()?.id === id;
  if (isPinned) {
    showToast(`"${db.name}" ya es el dashboard de inicio`, 'info');
    return;
  }
  setPinnedDashboard(id);
  renderDashboardList();
  showToast(`"${db.name}" fijado como dashboard de inicio`, 'success');
}

// ========== CRUD ==========

// ========== GRID PERSONALIZABLE ==========
// Solo para dashboards type='flex-grid'. El dashboard por defecto
// (type='links', sin layoutConfig) nunca pasa por aquí — sigue
// exactamente igual que siempre, gestionado por la clase CSS estática
// de #linksList.

function updateFlexGridOptionsVisibility() {
  const isFlexGrid = document.getElementById('dashboardLayoutType').value === 'flex-grid';
  document.getElementById('flexGridOptions').classList.toggle('hidden', !isFlexGrid);
}

function editDashboard(id) {
  const db = getDashboard(id);
  if (!db) return;
  const modal = document.getElementById('dashboardModal');
  document.getElementById('dashboardModalTitle').textContent = 'Editar dashboard';
  document.getElementById('dashboardName').value = db.name;

  const isFlexGrid = db.type === 'flex-grid' && db.layoutConfig;
  document.getElementById('dashboardLayoutType').value = isFlexGrid ? 'flex-grid' : 'default';
  if (isFlexGrid) {
    document.getElementById('dashboardColumns').value = db.layoutConfig.columns || 3;
    document.getElementById('dashboardRatio').value = db.layoutConfig.ratio || 'equal';
  }
  updateFlexGridOptionsVisibility();

  modal.dataset.backgroundUrl = db.backgroundUrl || '';
  updateDashboardBgStatus(db.backgroundUrl);

  modal.dataset.editingId = id;
  modal.classList.add('active');
}

function deleteDashboard(id) {
  const db = getDashboard(id);
  if (!db) return;
  if (getDashboards().length <= 1) {
    showToast('No puedes eliminar el único dashboard', 'error');
    return;
  }
  if (confirm(`¿Eliminar el dashboard "${db.name}" y todas sus cajas?`)) {
    const ok = deleteDashboardFromStorage(id);
    if (ok) {
      renderDashboardList();
      bus.emit(EVENTS.DASHBOARD_RENDER);
      showToast('Dashboard eliminado', 'success');
    }
  }
}

// ========== MODAL ==========

function resetDashboardModal() {
  document.getElementById('dashboardName').value = '';
  document.getElementById('dashboardLayoutType').value = 'default';
  document.getElementById('dashboardColumns').value = '3';
  document.getElementById('dashboardRatio').value = 'equal';
  updateFlexGridOptionsVisibility();
  const modal = document.getElementById('dashboardModal');
  modal.dataset.backgroundUrl = '';
  updateDashboardBgStatus('');
  delete modal.dataset.editingId;
}

function updateDashboardBgStatus(url) {
  const status = document.getElementById('dashboardBgStatus');
  const removeBtn = document.getElementById('removeDashboardBg');
  if (url) {
    status.textContent = 'Fondo propio de este dashboard';
    removeBtn.classList.remove('hidden');
  } else {
    status.textContent = 'Usando el fondo global';
    removeBtn.classList.add('hidden');
  }
}

function initDashboardModal() {
  const modal      = document.getElementById('dashboardModal');
  const newDbBtn   = document.getElementById('newDashboardBtn');

  newDbBtn?.addEventListener('click', () => {
    document.getElementById('dashboardModalTitle').textContent = 'Nuevo dashboard';
    resetDashboardModal();
    modal.classList.add('active');
  });

  document.getElementById('cancelDashboard').addEventListener('click', () => {
    modal.classList.remove('active');
    resetDashboardModal();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) { modal.classList.remove('active'); resetDashboardModal(); }
  });

  document.getElementById('dashboardLayoutType').addEventListener('change', updateFlexGridOptionsVisibility);

  document.getElementById('dashboardBgUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      modal.dataset.backgroundUrl = url;
      updateDashboardBgStatus(url);
    } catch (err) {
      showToast(err.message || 'No se pudo subir la imagen', 'error');
    }
    e.target.value = '';
  });

  document.getElementById('removeDashboardBg').addEventListener('click', () => {
    modal.dataset.backgroundUrl = '';
    updateDashboardBgStatus('');
  });

  document.getElementById('saveDashboard').addEventListener('click', () => {
    const name = document.getElementById('dashboardName').value.trim();
    if (!name) { showToast('El nombre es obligatorio', 'error'); return; }

    const layoutType = document.getElementById('dashboardLayoutType').value;
    let type = 'links';
    let layoutConfig = null;

    if (layoutType === 'flex-grid') {
      const columns = parseInt(document.getElementById('dashboardColumns').value, 10);
      const ratio = document.getElementById('dashboardRatio').value;
      type = 'flex-grid';
      layoutConfig = { columns, ratio, template: buildGridTemplate(columns, ratio) };
    }

    const backgroundUrl = modal.dataset.backgroundUrl || null;

    if (modal.dataset.editingId) {
      const db = getDashboard(modal.dataset.editingId);
      if (db) {
        db.name = name;
        db.type = type;
        db.layoutConfig = layoutConfig;
        db.backgroundUrl = backgroundUrl;
        saveDashboard(db);
        showToast('Dashboard actualizado', 'success');
        // Solo repintar el contenido si es el dashboard que tienes
        // abierto ahora mismo — renderDashboard(id) pinta lo que se le
        // pida sin comprobar cuál está "activo", así que forzarlo para
        // uno que no estés viendo mostraría sus cajas sin que la barra
        // lateral/breadcrumb cambiasen a la vez, un lío visual.
        if (getCurrentDashboardId() === db.id) {
          bus.emit(EVENTS.DASHBOARD_RENDER, db.id);
        }
      }
    } else {
      const dashboards = getDashboards();
      const newDb = createDashboard(name);
      newDb.order = dashboards.length;
      newDb.type = type;
      newDb.layoutConfig = layoutConfig;
      newDb.backgroundUrl = backgroundUrl;
      saveDashboard(newDb);
      showToast(`Dashboard "${name}" creado`, 'success');
    }

    modal.classList.remove('active');
    resetDashboardModal();
    updateBreadcrumb();
    renderDashboardList();
  });
}

// ========== DELEGACIÓN DE EVENTOS ==========

function initEventDelegation() {
  const container = document.getElementById('dashboardList');
  if (!container) return;

  container.addEventListener('click', (e) => {
    // Cambiar dashboard
    const switchBtn = e.target.closest('.dashboard-switch-btn');
    if (switchBtn) {
      showSection(document.getElementById('enlacesSection'));
      switchDashboard(switchBtn.dataset.dashboardId);
      return;
    }

    // Pin
    const pinBtn = e.target.closest('.dashboard-pin-btn');
    if (pinBtn) {
      pinDashboard(pinBtn.dataset.dashboardId);
      return;
    }

    // Menú contextual
    const menuBtn = e.target.closest('.dashboard-menu-btn');
    if (menuBtn) {
      e.stopPropagation();
      document.querySelectorAll('.menu-options').forEach(el => el.classList.add('hidden'));
      const menu = document.getElementById(`db-menu-${menuBtn.dataset.dashboardId}`);
      menu?.classList.toggle('hidden');
      return;
    }

    // Editar
    const editBtn = e.target.closest('.dashboard-edit-btn');
    if (editBtn) {
      document.querySelectorAll('.menu-options').forEach(el => el.classList.add('hidden'));
      editDashboard(editBtn.dataset.dashboardId);
      return;
    }

    // Eliminar
    const deleteBtn = e.target.closest('.dashboard-delete-btn');
    if (deleteBtn && !deleteBtn.classList.contains('cursor-not-allowed')) {
      document.querySelectorAll('.menu-options').forEach(el => el.classList.add('hidden'));
      deleteDashboard(deleteBtn.dataset.dashboardId);
      return;
    }
  });
}

// ========== INICIALIZACIÓN ==========

export function updateBreadcrumb() {
  const db = _activeDashboardId ? getDashboard(_activeDashboardId) : getActiveDashboard();
  const el = document.getElementById('activeDashboardName');
  if (el) el.textContent = db?.name || '';
}

export function initDashboard() {
  // Al arrancar, cargar siempre el dashboard pinned
  const pinned = getPinnedDashboard();
  const startId = pinned?.id || getActiveDashboard()?.id;
  if (startId) {
    _activeDashboardId = startId;
    setActiveDashboard(startId);
  }

  // Repintar la lista del sidebar cuando algún módulo lo solicite
  // (p. ej. drag.js al entrar/salir de modo edición).
  bus.on(EVENTS.DASHBOARD_LIST_CHANGED, () => renderDashboardList());

  // Datos nuevos llegados del servidor en segundo plano: la lista de
  // dashboards (sidebar) también podría haber cambiado desde otro
  // dispositivo, así que se repinta igual que con DASHBOARD_LIST_CHANGED.
  bus.on(EVENTS.DATA_REFRESHED, () => { renderDashboardList(); updateBreadcrumb(); });

  updateBreadcrumb();
  renderDashboardList();
  initDashboardModal();
  initEventDelegation();
}
// ========== Otros ==========

// Añade esta función para exponer el estado interno
export function getCurrentDashboardId() {
  return _activeDashboardId;
}