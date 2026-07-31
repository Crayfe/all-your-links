// popup.js
// Habla directamente con la API del servidor (con la cookie de sesión
// del navegador), sin necesidad de buscar ni abrir pestañas del
// dashboard como hacía la versión anterior basada en localStorage.

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderError(message) {
  document.getElementById('content').innerHTML = `
    <div class="server-error">
      <p>${message}</p>
      <button class="btn btn-secondary" style="width:100%" onclick="window.close()">Cerrar</button>
    </div>
  `;
}

// ========== API ==========

async function apiGet(dashboardUrl, path) {
  const res = await fetch(`${dashboardUrl}${path}`, { credentials: 'include' });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

async function apiPost(dashboardUrl, path, body) {
  const res = await fetch(`${dashboardUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

function generateId(prefix = 'item') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ========== RENDER DEL FORMULARIO ==========

function renderForm(tab, dashboardUrl, dashboards, boxes) {
  // Solo cajas que muestran una lista de enlaces son destino válido:
  // ni widgets (reloj, calendario, stats, RSS), ni notas (muestran texto,
  // no una lista), ni contenedores (muestran otras cajas, no enlaces).
  // Guardar en cualquiera de esas guardaría el enlace en el servidor
  // pero no se vería en ningún sitio.
  const NON_LINK_LAYOUTS = ['note', 'container'];
  const linkBoxes = boxes.filter(b =>
    !(b.layout || '').startsWith('widget-') && !NON_LINK_LAYOUTS.includes(b.layout)
  );

  let optionsHTML = '';
  const sortedDashboards = [...dashboards].sort((a, b) => (a.order || 0) - (b.order || 0));

  sortedDashboards.forEach(db => {
    const dbBoxes = linkBoxes
      .filter(b => b.workspaceId === db.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (dbBoxes.length > 0) {
      optionsHTML += `<optgroup label="${escapeHtml(db.name)}">`;
      dbBoxes.forEach(b => {
        optionsHTML += `<option value="${b.id}">${escapeHtml(b.title)}</option>`;
      });
      optionsHTML += `</optgroup>`;
    }
  });

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
  document.getElementById('btnSave').addEventListener('click', () => saveLink(dashboardUrl));
  document.getElementById('linkTitle').focus();
  document.getElementById('linkTitle').select();
}

// ========== GUARDAR ENLACE ==========

async function saveLink(dashboardUrl) {
  const title   = document.getElementById('linkTitle').value.trim();
  const url     = document.getElementById('linkUrl').value.trim();
  const boxId   = document.getElementById('boxSelect').value;
  const saveBtn = document.getElementById('btnSave');

  if (!title) { showToast('El título es obligatorio', 'error'); return; }
  if (!boxId) { showToast('Selecciona una caja', 'error'); return; }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  try {
    // Calcular el siguiente order dentro de la caja elegida
    const { data: existingItems } = await apiGet(dashboardUrl, `/api/items?boxId=${boxId}`);
    const maxOrder = (existingItems || []).reduce((max, i) => (i.order > max ? i.order : max), -1);

    const newItem = {
      id: generateId('item'),
      boxId,
      type: 'link',
      order: maxOrder + 1,
      data: { title, url },
      metadata: { clickCount: 0, lastAccessed: null, createdAt: new Date().toISOString(), tags: [] }
    };

    const result = await apiPost(dashboardUrl, '/api/items', newItem);

    if (!result.ok) {
      if (result.status === 401) {
        showToast('Inicia sesión en el dashboard primero', 'error');
      } else {
        showToast('Error al guardar el enlace', 'error');
      }
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar enlace';
      return;
    }

    // Si el dashboard está abierto en alguna pestaña, recargarla
    const dashboardTabs = await chrome.tabs.query({ url: `${dashboardUrl}/*` });
    dashboardTabs.forEach(t => chrome.tabs.reload(t.id));

    saveBtn.textContent = '✓ Guardado';
    showToast(`"${title}" guardado correctamente`);
    setTimeout(() => window.close(), 1200);
  } catch (e) {
    console.error('Error al guardar:', e);
    showToast('No se pudo conectar con el servidor', 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar enlace';
  }
}

// ========== INICIALIZACIÓN ==========

async function loadAndRender() {
  const dashboardUrl = await getDashboardUrl();
  document.getElementById('openDashboardLink').href = dashboardUrl;

  // Comprobación de disponibilidad (endpoint público, no requiere sesión)
  try {
    const health = await fetch(`${dashboardUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!health.ok) throw new Error();
  } catch {
    renderError(`El servidor no está disponible en<br><code>${escapeHtml(dashboardUrl)}</code>`);
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const dashboardsRes = await apiGet(dashboardUrl, '/api/dashboards');
  if (dashboardsRes.status === 401) {
    renderError(`Inicia sesión en el dashboard primero:<br><a href="${escapeHtml(dashboardUrl)}" target="_blank">${escapeHtml(dashboardUrl)}</a>`);
    return;
  }
  if (!dashboardsRes.ok) {
    renderError('No se pudieron cargar tus dashboards.');
    return;
  }

  const boxesRes = await apiGet(dashboardUrl, '/api/boxes');
  const boxes = boxesRes.ok ? boxesRes.data : [];

  renderForm(tab, dashboardUrl, dashboardsRes.data, boxes);
}

function init() {
  document.getElementById('settingsBtn').addEventListener('click', async () => {
    const current = await getDashboardUrl();
    const newUrl = prompt('URL del servidor de AllYourLinks:', current);
    if (newUrl && newUrl.trim()) {
      await setDashboardUrl(newUrl.trim());
      loadAndRender();
    }
  });

  loadAndRender();
}

init();
