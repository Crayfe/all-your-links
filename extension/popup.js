// popup.js

const STORAGE_KEY_BOXES = 'boxes_v2';
const STORAGE_KEY_ITEMS = 'items_v2';
const STORAGE_KEY_DASHBOARDS = 'dashboards_v2';
const DASHBOARD_URL    = 'http://localhost:8000';

// ========== UTILIDADES ==========

function generateId(prefix = 'item') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function renderError() {
  document.getElementById('content').innerHTML = `
    <div class="server-error">
      <p>El servidor no está disponible.<br>
      Ejecuta <code>python3 -m http.server 8000</code><br>
      en la carpeta del proyecto.</p>
      <button class="btn btn-secondary" style="width:100%" onclick="window.close()">Cerrar</button>
    </div>
  `;
}

// ========== DATOS ==========

function getBoxes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOXES);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function getItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveItem(item) {
  const items = getItems();
  items.push(item);
  localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
}

function getItemsByBox(boxId) {
  return getItems().filter(i => i.boxId === boxId);
}

// ========== RENDER DEL FORMULARIO ==========

function renderForm(tab, data) {
  const { boxes, dashboards } = data;
  let optionsHTML = '';

  // Solo cajas de contenido (grid, list, orbs, reference) son destino válido
  // para guardar un enlace. Las cajas widget (reloj, calendario, stats, rss)
  // no gestionan items y no deben aparecer como opción.
  const linkBoxes = (boxes || []).filter(b => !(b.layout || '').startsWith('widget-'));

  // 1. Intentar agrupar por dashboards si existen
  if (dashboards && dashboards.length > 0) {
    const sortedDashboards = [...dashboards].sort((a, b) => (a.order || 0) - (b.order || 0));

    sortedDashboards.forEach(db => {
      // Comprobar tanto workspaceId como dashboardId por seguridad
      const dbBoxes = linkBoxes
        .filter(b => b.workspaceId === db.id || b.dashboardId === db.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      if (dbBoxes.length > 0) {
        optionsHTML += `<optgroup label="${escapeHtml(db.name || db.title || 'Dashboard')}">`;
        dbBoxes.forEach(b => {
          optionsHTML += `<option value="${b.id}">${escapeHtml(b.title)}</option>`;
        });
        optionsHTML += `</optgroup>`;
      }
    });
  }

  // 2. Fallback: Si no se logró agrupar (por diferencias de nomenclatura) 
  // pero hay cajas, mostramos una lista plana para que siga funcionando.
  if (!optionsHTML && linkBoxes.length > 0) {
    const sortedBoxes = [...linkBoxes].sort((a, b) => (a.order || 0) - (b.order || 0));
    sortedBoxes.forEach(b => {
      optionsHTML += `<option value="${b.id}">${escapeHtml(b.title)}</option>`;
    });
  }

  if (!optionsHTML) {
    optionsHTML = '<option value="" disabled>No hay cajas disponibles</option>';
  }

  document.getElementById('content').innerHTML = `
    <div class="form-section">
      <div class="form-title">Guardar enlace actual</div>

      <div class="field">
        <label>Título</label>
        <input type="text" id="linkTitle" placeholder="Nombre del enlace" value="${escapeHtml(tab.title || '')}">
      </div>

      <div class="field">
        <label>URL</label>
        <input type="text" id="linkUrl" value="${escapeHtml(tab.url || '')}" readonly>
      </div>

      <div class="box-selector">
        <label>Guardar en</label>
        <select id="boxSelect">${optionsHTML}</select>
      </div>

      <div class="btn-row">
        <button class="btn btn-secondary" id="btnCancel">Cancelar</button>
        <button class="btn btn-primary" id="btnSave" ${!optionsHTML.includes('value="') ? 'disabled' : ''}>
          Guardar enlace
        </button>
      </div>
    </div>
  `;

  document.getElementById('btnCancel').addEventListener('click', () => window.close());
  document.getElementById('btnSave').addEventListener('click', () => saveLink());
  document.getElementById('linkTitle').focus();
  document.getElementById('linkTitle').select();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ========== GUARDAR ENLACE ==========

function saveLink() {
  const title   = document.getElementById('linkTitle').value.trim();
  const url     = document.getElementById('linkUrl').value.trim();
  const boxId   = document.getElementById('boxSelect').value;
  const saveBtn = document.getElementById('btnSave');

  if (!title) { showToast('El título es obligatorio', 'error'); return; }
  if (!boxId) { showToast('Selecciona una caja', 'error'); return; }

  const existingItems = getItemsByBox(boxId);

  const newItem = {
    id: generateId('item'),
    boxId,
    type: 'link',
    order: existingItems.length,
    data: { title, url },
    metadata: {
      clickCount: 0,
      lastAccessed: null,
      createdAt: new Date().toISOString(),
      tags: []
    }
  };

  saveItem(newItem);

  saveBtn.disabled = true;
  saveBtn.textContent = '✓ Guardado';
  showToast(`"${title}" guardado correctamente`);

  setTimeout(() => window.close(), 1500);
}

// ========== INICIALIZACIÓN ==========

async function init() {
  try {
    const response = await fetch(DASHBOARD_URL, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error();
  } catch {
    renderError();
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let fetchedData = { boxes: [], dashboards: [] };

  try {
    const dashboardTabs = await chrome.tabs.query({ url: `${DASHBOARD_URL}/*` });
    const fetchFunc = () => {
      const rawBoxes = localStorage.getItem('boxes_v2') || '[]';
      // Buscar la clave de dashboards independientemente de si los llamaste dashboards o workspaces
      const rawDashboards = localStorage.getItem('dashboards_v2') || 
                            localStorage.getItem('workspaces_v2') || 
                            localStorage.getItem('dashboards') || 
                            localStorage.getItem('workspaces') || '[]';
      return {
        boxes: JSON.parse(rawBoxes),
        dashboards: JSON.parse(rawDashboards)
      };
    };

    if (dashboardTabs.length > 0) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: dashboardTabs[0].id },
        func: fetchFunc
      });
      fetchedData = results[0].result;
    } else {
      const tempTab = await chrome.tabs.create({ url: DASHBOARD_URL, active: false });
      await new Promise(resolve => setTimeout(resolve, 800));
      const results = await chrome.scripting.executeScript({
        target: { tabId: tempTab.id },
        func: fetchFunc
      });
      fetchedData = results[0].result;
      await chrome.tabs.remove(tempTab.id);
    }
  } catch (e) {
    console.warn('No se pudo leer localStorage del dashboard:', e);
  }

  renderForm(tab, fetchedData);
}

// ========== GUARDAR USANDO SCRIPTING EN EL DASHBOARD ==========
// Sobreescribimos saveLink para escribir en el localStorage correcto

const _saveLink = saveLink;

async function saveLink() {
  const title   = document.getElementById('linkTitle').value.trim();
  const url     = document.getElementById('linkUrl').value.trim();
  const boxId   = document.getElementById('boxSelect').value;
  const saveBtn = document.getElementById('btnSave');

  if (!title) { showToast('El título es obligatorio', 'error'); return; }
  if (!boxId) { showToast('Selecciona una caja', 'error'); return; }

  const newItem = {
    id: generateId('item'),
    boxId,
    type: 'link',
    order: 0,
    data: { title, url },
    metadata: {
      clickCount: 0,
      lastAccessed: null,
      createdAt: new Date().toISOString(),
      tags: []
    }
  };

  try {
    const dashboardTabs = await chrome.tabs.query({ url: `${DASHBOARD_URL}/*` });

    const writeFunc = (item) => {
      const items = JSON.parse(localStorage.getItem('items_v2') || '[]');
      // Ajustar order al número de items existentes en esa caja
      item.order = items.filter(i => i.boxId === item.boxId).length;
      items.push(item);
      localStorage.setItem('items_v2', JSON.stringify(items));
      return true;
    };

    if (dashboardTabs.length > 0) {
      await chrome.scripting.executeScript({
        target: { tabId: dashboardTabs[0].id },
        func: writeFunc,
        args: [newItem]
      });
      // Recargar el dashboard para que aparezca el nuevo enlace
      await chrome.tabs.reload(dashboardTabs[0].id);
    } else {
      // Escribir en pestaña temporal
      const tempTab = await chrome.tabs.create({ url: DASHBOARD_URL, active: false });
      await new Promise(resolve => setTimeout(resolve, 800));
      await chrome.scripting.executeScript({
        target: { tabId: tempTab.id },
        func: writeFunc,
        args: [newItem]
      });
      await chrome.tabs.remove(tempTab.id);
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '✓ Guardado';
    showToast(`"${title}" guardado correctamente`);
    setTimeout(() => window.close(), 1500);

  } catch (e) {
    console.error('Error al guardar:', e);
    showToast('Error al guardar el enlace', 'error');
  }
}

init();
