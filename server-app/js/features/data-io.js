// js/data-io.js
// Entrada/salida de datos: exportar/importar backup completo y
// configuración de la ruta de guardado por defecto de la extensión.
// No es específico de enlaces: opera sobre todos los datos de la app.

import { showToast } from '../shared/ui.js';
import { exportData, importData } from '../core/data-manager.js';
import { getSetting, setSetting } from '../core/settings-client.js';

// ========== EVENTOS DE CALENDARIO Y CONFIGURACIÓN ==========
// Estos datos viven fuera de la caché de data-manager.js (eventos propios
// en su propia key de localStorage, ajustes como claves sueltas). Antes
// export/import los ignoraba por completo — este fix hace que el backup
// sea de verdad completo.

const CALENDAR_EVENTS_KEY = 'calendar_native_events_v1';
const SETTINGS_KEYS = ['weatherApiKey', 'googleClientId', 'rssApiKey', 'default_save_box_id', 'abrirNuevaPestana'];

function gatherCalendarEvents() {
  try { return JSON.parse(localStorage.getItem(CALENDAR_EVENTS_KEY) || '[]'); } catch { return []; }
}

function gatherSettings() {
  const settings = {};
  SETTINGS_KEYS.forEach(key => {
    const value = localStorage.getItem(key);
    if (value !== null) settings[key] = value;
  });
  return settings;
}

function restoreCalendarEvents(events) {
  if (!Array.isArray(events)) return;
  localStorage.setItem(CALENDAR_EVENTS_KEY, JSON.stringify(events));
}

function restoreSettings(settings) {
  if (!settings || typeof settings !== 'object') return;
  Object.entries(settings).forEach(([key, value]) => {
    localStorage.setItem(key, value);
    // Si el campo correspondiente está visible ahora mismo en Configuración,
    // actualizarlo también para no requerir recargar la página.
    const input = document.getElementById(key);
    if (input) input.value = value;
  });
}

// ========== EXPORT / IMPORT ==========

function exportAllData() {
  const data = exportData();
  if (!data.items || data.items.length === 0) { showToast('No hay datos para exportar', 'info'); return; }
  data.calendarEvents = gatherCalendarEvents();
  data.settings = gatherSettings();
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataUri);
  a.setAttribute('download', `dashboard_backup_${Date.now()}.json`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Datos exportados con éxito', 'success');
}

function importFromFile(file, onImported) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      await importData(parsed); // workspaces/boxes/items + sincroniza con el servidor
      restoreCalendarEvents(parsed.calendarEvents);
      restoreSettings(parsed.settings);
      if (typeof onImported === 'function') onImported();
      showToast('Datos importados correctamente', 'success');
    } catch (error) {
      showToast(`Error al importar: ${error.message}`, 'error');
      console.error('Error de importación:', error);
    }
  };
  reader.readAsText(file);
}

// ========== INICIALIZACIÓN ==========

export function initDataIO(onImported) {
  const exportBtn   = document.getElementById('exportDataBtn');
  const importBtn   = document.getElementById('importDataBtn');
  const importInput = document.getElementById('importFileInput');
  exportBtn?.addEventListener('click', exportAllData);
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) { importFromFile(e.target.files[0], onImported); e.target.value = ''; }
    });
  }
  renderDefaultPathSelector();
}

// ========== CONFIGURACIÓN EXTENSIÓN: ruta de guardado por defecto ==========

async function renderDefaultPathSelector() {
  const workspaces = JSON.parse(localStorage.getItem('workspaces_v2') || '[]');
  const allBoxes = JSON.parse(localStorage.getItem('boxes_v2') || '[]');

  // Se pinta primero con lo último que sepamos en local (instantáneo), y
  // si el servidor responde con un valor distinto, se actualiza — mismo
  // patrón que el fondo del dashboard: la extensión necesita este valor
  // sincronizado de verdad entre dispositivos, no solo en este navegador.
  let currentDefault = localStorage.getItem('default_save_box_id') || '';
  try {
    const serverValue = await getSetting('default_save_box_id');
    if (serverValue !== null) {
      currentDefault = serverValue;
      localStorage.setItem('default_save_box_id', serverValue);
    }
  } catch { /* sin conexión: se queda con lo que hubiera en caché local */ }

  // Solo cajas que muestran una lista de enlaces son destino válido: ni
  // widgets (reloj, calendario, stats, rss), ni notas (muestran texto),
  // ni contenedores (muestran otras cajas) gestionan enlaces.
  const NON_LINK_LAYOUTS = ['note', 'container'];
  const boxes = allBoxes.filter(b =>
    !(b.layout || '').startsWith('widget-') && !NON_LINK_LAYOUTS.includes(b.layout)
  );

  let optionsHTML = `<option value="" disabled ${!currentDefault ? 'selected' : ''}>Selecciona una caja...</option>`;

  workspaces.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(ws => {
    const wsBoxes = boxes
      .filter(b => b.workspaceId === ws.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (wsBoxes.length > 0) {
      optionsHTML += `<optgroup label="${ws.name}">`;
      wsBoxes.forEach(box => {
        const isSelected = box.id === currentDefault ? 'selected' : '';
        optionsHTML += `<option value="${box.id}" ${isSelected}>${box.title}</option>`;
      });
      optionsHTML += `</optgroup>`;
    }
  });

  const importBtn = document.getElementById('importDataBtn');
  if (importBtn) {
    document.getElementById('defaultSaveBoxField')?.remove();

    // Destino para notas guardadas con "Guardar como nota" (clic derecho
    // sobre texto seleccionado). Puede ser un DASHBOARD entero (la caja
    // se crea a nivel superior) o un CONTENEDOR concreto (la caja se
    // crea como hija suya) — los IDs de dashboards ("db_...") y cajas
    // ("box_...") nunca colisionan, así que un único valor sirve para
    // cualquiera de los dos; se distingue en qué lista aparece.
    let currentNoteDestination = localStorage.getItem('default_note_destination_id') || '';
    try {
      const serverValue = await getSetting('default_note_destination_id');
      if (serverValue !== null) {
        currentNoteDestination = serverValue;
        localStorage.setItem('default_note_destination_id', serverValue);
      }
    } catch { /* sin conexión: caché local */ }

    const containers = allBoxes.filter(b => b.layout === 'container');
    const workspaceNameById = Object.fromEntries(workspaces.map(ws => [ws.id, ws.name]));

    let destinationOptionsHTML = `<option value="">Automático (el dashboard fijado, o el primero)</option>`;
    if (workspaces.length > 0) {
      destinationOptionsHTML += `<optgroup label="Dashboards">`;
      workspaces.forEach(ws => {
        const isSelected = ws.id === currentNoteDestination ? 'selected' : '';
        destinationOptionsHTML += `<option value="${ws.id}" ${isSelected}>${ws.name}</option>`;
      });
      destinationOptionsHTML += `</optgroup>`;
    }
    if (containers.length > 0) {
      destinationOptionsHTML += `<optgroup label="Contenedores">`;
      containers.forEach(c => {
        const isSelected = c.id === currentNoteDestination ? 'selected' : '';
        const parentName = workspaceNameById[c.workspaceId] || '?';
        destinationOptionsHTML += `<option value="${c.id}" ${isSelected}>📦 ${c.title || '(sin título)'} (${parentName})</option>`;
      });
      destinationOptionsHTML += `</optgroup>`;
    }

    const fieldHTML = `
      <div id="defaultSaveBoxField" style="margin-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem;">
        <label style="display:block; font-size:0.72rem; color:#9ca3af; margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">
          Ruta de guardado por defecto (Extensión)
        </label>
        <select id="defaultSaveBoxSelect" style="width:100%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); padding:0.5rem; color:#fff; border-radius:6px; outline:none; font-size:0.85rem; cursor:pointer; margin-bottom: 0.85rem;">
          ${optionsHTML}
        </select>
        <label style="display:block; font-size:0.72rem; color:#9ca3af; margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">
          Destino de notas (Extensión — "Guardar como nota")
        </label>
        <select id="defaultNoteDestinationSelect" style="width:100%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); padding:0.5rem; color:#fff; border-radius:6px; outline:none; font-size:0.85rem; cursor:pointer;">
          ${destinationOptionsHTML}
        </select>
      </div>
    `;

    importBtn.parentElement.insertAdjacentHTML('beforeend', fieldHTML);

    document.getElementById('defaultNoteDestinationSelect').addEventListener('change', async (e) => {
      const value = e.target.value;
      localStorage.setItem('default_note_destination_id', value);
      try {
        await setSetting('default_note_destination_id', value);
        showToast('Configuración de extensión actualizada', 'success');
      } catch {
        showToast('Guardado localmente; se sincronizará cuando haya conexión', 'info');
      }
    });

    document.getElementById('defaultSaveBoxSelect').addEventListener('change', async (e) => {
      const value = e.target.value;
      localStorage.setItem('default_save_box_id', value);
      try {
        await setSetting('default_save_box_id', value);
        showToast('Configuración de extensión actualizada', 'success');
      } catch {
        showToast('Guardado localmente; se sincronizará cuando haya conexión', 'info');
      }
    });
  }
}
