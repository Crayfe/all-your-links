// popup.js

const STORAGE_KEY_BOXES = 'boxes_v2';
const STORAGE_KEY_ITEMS = 'items_v2';
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

function renderForm(tab, boxes) {
  const sortedBoxes = [...boxes].sort((a, b) => a.order - b.order);

  const optionsHTML = sortedBoxes.length > 0
    ? sortedBoxes.map(b => `<option value="${b.id}">${b.title}</option>`).join('')
    : '<option value="" disabled>No hay cajas disponibles</option>';

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
        <button class="btn btn-primary" id="btnSave" ${sortedBoxes.length === 0 ? 'disabled' : ''}>
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
  // Comprobar que el servidor está disponible y leer localStorage
  try {
    const response = await fetch(DASHBOARD_URL, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error();
  } catch {
    renderError();
    return;
  }

  // Leer la pestaña activa
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Leer boxes del localStorage del dashboard mediante content script
  // Como no podemos acceder al localStorage de otro origen directamente,
  // usamos chrome.scripting para leerlo desde la pestaña del dashboard si está abierta,
  // o abrimos una pestaña oculta para obtenerlo.
  // Solución práctica: fetch al dashboard y parsear las keys directamente.

  let boxes = [];

  try {
    // Intentar leer desde una pestaña del dashboard ya abierta
    const dashboardTabs = await chrome.tabs.query({ url: `${DASHBOARD_URL}/*` });

    if (dashboardTabs.length > 0) {
      // Hay una pestaña del dashboard abierta — leer su localStorage
      const results = await chrome.scripting.executeScript({
        target: { tabId: dashboardTabs[0].id },
        func: () => {
          const raw = localStorage.getItem('boxes_v2');
          return raw || '[]';
        }
      });
      boxes = JSON.parse(results[0].result);
    } else {
      // No hay pestaña abierta — abrir una en segundo plano temporalmente
      const tempTab = await chrome.tabs.create({ url: DASHBOARD_URL, active: false });
      await new Promise(resolve => setTimeout(resolve, 800));
      const results = await chrome.scripting.executeScript({
        target: { tabId: tempTab.id },
        func: () => {
          const raw = localStorage.getItem('boxes_v2');
          return raw || '[]';
        }
      });
      boxes = JSON.parse(results[0].result);
      await chrome.tabs.remove(tempTab.id);
    }
  } catch (e) {
    console.warn('No se pudo leer localStorage del dashboard:', e);
    boxes = [];
  }

  renderForm(tab, boxes);
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
