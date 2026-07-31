// js/data-io.js
// Entrada/salida de datos: exportar/importar backup completo y
// configuración de la ruta de guardado por defecto de la extensión.
// No es específico de enlaces: opera sobre todos los datos de la app.

import { showToast } from '../shared/ui.js';
import { exportData, importData } from '../core/data-manager.js';

// ========== EXPORT / IMPORT ==========

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

function importFromFile(file, onImported) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      importData(JSON.parse(e.target.result));
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

function renderDefaultPathSelector() {
  const workspaces = JSON.parse(localStorage.getItem('workspaces_v2') || '[]');
  const allBoxes = JSON.parse(localStorage.getItem('boxes_v2') || '[]');
  const currentDefault = localStorage.getItem('default_save_box_id') || '';

  // Solo cajas de contenido son destino válido: las widget (reloj, calendario,
  // stats, rss) no gestionan enlaces y no deben poder configurarse aquí.
  const boxes = allBoxes.filter(b => !(b.layout || '').startsWith('widget-'));

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

    const fieldHTML = `
      <div id="defaultSaveBoxField" style="margin-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem;">
        <label style="display:block; font-size:0.72rem; color:#9ca3af; margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">
          Ruta de guardado por defecto (Extensión)
        </label>
        <select id="defaultSaveBoxSelect" style="width:100%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); padding:0.5rem; color:#fff; border-radius:6px; outline:none; font-size:0.85rem; cursor:pointer;">
          ${optionsHTML}
        </select>
      </div>
    `;

    importBtn.parentElement.insertAdjacentHTML('beforeend', fieldHTML);

    document.getElementById('defaultSaveBoxSelect').addEventListener('change', (e) => {
      localStorage.setItem('default_save_box_id', e.target.value);
      showToast('Configuración de extensión actualizada', 'success');
    });
  }
}
