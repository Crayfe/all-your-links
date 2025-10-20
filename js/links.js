// js/links.js

import { showToast, toggleMenu } from './ui.js'; // Importamos funciones comunes de interfaz

// --- Variables y Configuración ---
export let links = JSON.parse(localStorage.getItem('misEnlaces')) || [];
const list = document.getElementById('linksList');
const openNewTabCheckbox = document.getElementById('openNewTab');
const newLinkMenu = document.getElementById('newLinkMenu');

// --- Utilidades ---
function getFavicon(url) {
  try {
    const domain = new URL(url).hostname; 
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
  }
}

export function saveLinks() { 
  localStorage.setItem('misEnlaces', JSON.stringify(links)); 
  renderLinks(); 
}

// --- Renderizado de Enlaces ---
export function renderLinks() {
  const grouped = {};
  
  // MODIFICACIÓN CLAVE: Agrupamos guardando el índice global (globalIndex)
  links.forEach((link, globalIndex) => { 
    const cat = link.category || 'Sin categoría';
    if (!grouped[cat]) grouped[cat] = [];
    
    // Almacenamos el objeto del enlace Y su índice global en el grupo
    grouped[cat].push({ link, globalIndex }); 
  });

  list.innerHTML = '';
  for (const cat in grouped) {
    const catCard = document.createElement('div');
    catCard.className = 'p-4 rounded-lg shadow mb-4 bg-black/70'; 
    
    // Header de categoría: Asegúrate de que el texto sea visible
    const catHeader = document.createElement('h3');
    catHeader.textContent = cat;
    // Aseguramos que el texto sea oscuro en claro, y claro en oscuro
    catHeader.className = 'text-lg font-semibold mb-2 text-gray-100'; 
    catCard.appendChild(catHeader);
    catCard.appendChild(catHeader);

    // Iteramos sobre el objeto que contiene el índice global
    grouped[cat].forEach((item) => {
      const link = item.link;
      const indexToUse = item.globalIndex; // <-- ¡Este es el índice que usamos!
      
      // Elemento de Enlace
      const linkItem = document.createElement('div');
      linkItem.className = 'flex items-center justify-between p-2 bg-black/70 text-white rounded mb-2 hover:bg-black/60 transition';
      
      linkItem.innerHTML = `
        <a href="${link.url}" target="${openNewTabCheckbox.checked ? '_blank' : '_self'}" class="flex items-center gap-3 flex-1">
          <img src="${getFavicon(link.url)}" alt="icono" class="w-6 h-6 rounded">
          <span>${link.title}</span>
        </a>
        <div class="menu-container relative">
          <button data-index="${indexToUse}" class="text-gray-200 hover:text-white px-2 link-menu-btn">⋯</button>
          
          <div id="menu-${indexToUse}" class="menu-options hidden absolute right-0 top-8 bg-white border rounded shadow-md z-10 dark:bg-gray-700 dark:border-gray-600">
            <button data-index="${indexToUse}" class="block w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 link-edit-btn">Editar</button>
            <button data-index="${indexToUse}" class="block w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900 text-gray-700 link-delete-btn">Eliminar</button>
          </div>
        </div>
      `;
      catCard.appendChild(linkItem);
    });

    list.appendChild(catCard);
  }
  
  // Re-adjuntar Event Listeners para los botones de menú
  document.querySelectorAll('.link-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => toggleMenu(e.target.dataset.index));
  });
  
  // USAMOS parseInt() PARA ASEGURAR ÍNDICES NUMÉRICOS
  document.querySelectorAll('.link-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => editLink(parseInt(e.target.dataset.index)));
  });
  document.querySelectorAll('.link-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => deleteLink(parseInt(e.target.dataset.index)));
  });
}

// --- CRUD ---
export function editLink(index) {
  const numericIndex = parseInt(index); 
  const link = links[numericIndex];
  
  document.getElementById('newLinkTitle').value = link.title;
  document.getElementById('newLinkUrl').value = link.url;
  document.getElementById('newLinkCategory').value = link.category;
  
  // Eliminar el enlace antiguo y abrir el menú para guardar el nuevo/editado
  links.splice(numericIndex, 1);
  saveLinks(); 
  
  newLinkMenu.classList.remove('hidden');
  showToast('Edita el enlace y guarda para aplicar cambios');
}

export function deleteLink(index) { 
  const numericIndex = parseInt(index); 
  if (confirm('¿Eliminar este enlace?')) { 
    links.splice(numericIndex, 1); 
    saveLinks(); 
    showToast('Enlace eliminado', 'success'); 
  }
}

// --- Funciones de Importar/Exportar Datos ---

/**
 * Exporta el objeto 'links' actual a un archivo JSON descargable.
 */
function exportData() {
  if (links.length === 0) {
    showToast('No hay enlaces para exportar.', 'info');
    return;
  }
  
  const dataStr = JSON.stringify(links, null, 2); // Formateado bonito
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

  const exportFileName = 'dashboard_links_backup.json';

  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileName);
  document.body.appendChild(linkElement);
  linkElement.click();
  document.body.removeChild(linkElement);
  
  showToast('Datos exportados con éxito.', 'success');
}

/**
 * Lee un archivo JSON de enlaces y lo fusiona con los enlaces existentes.
 * @param {File} file - El archivo JSON seleccionado por el usuario.
 */
function importData(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedLinks = JSON.parse(e.target.result);
      
      if (!Array.isArray(importedLinks)) {
        throw new Error('El archivo JSON no contiene un formato de lista válido.');
      }

      // Fusionar los enlaces importados con los existentes
      links = [...links, ...importedLinks]; 
      
      saveLinks(); 
      showToast(`${importedLinks.length} enlaces importados correctamente.`, 'success');

    } catch (error) {
      showToast(`Error al importar: ${error.message}`, 'error');
      console.error('Error de importación:', error);
    }
  };
  reader.readAsText(file);
}


// --- Inicialización y Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  renderLinks();
  
  // Preferencia abrir en nueva pestaña
  openNewTabCheckbox.checked = localStorage.getItem('abrirNuevaPestana') === 'true';
  openNewTabCheckbox.addEventListener('change', () => {
    localStorage.setItem('abrirNuevaPestana', openNewTabCheckbox.checked);
    renderLinks();
    showToast('Preferencia actualizada', 'success');
  });

  // Gestión de Nuevo Enlace
  document.getElementById('newLinkBtn').addEventListener('click', () => newLinkMenu.classList.toggle('hidden'));
  document.getElementById('cancelNewLink').addEventListener('click', () => newLinkMenu.classList.add('hidden'));

  document.getElementById('saveNewLink').addEventListener('click', () => {
    const title = document.getElementById('newLinkTitle').value.trim();
    const url = document.getElementById('newLinkUrl').value.trim();
    const category = document.getElementById('newLinkCategory').value.trim();
    
    if (!title) { showToast('El título es obligatorio', 'error'); return; }
    if (!url || !/^https?:\/\/.+/.test(url)) { showToast('URL no válida', 'error'); return; }
    
    links.push({ title, url, category });
    saveLinks();
    newLinkMenu.classList.add('hidden');
    newLinkMenu.querySelectorAll('input').forEach(i => i.value = '');
    showToast('Enlace guardado correctamente', 'success');
  });


  // --- Conexión Importar/Exportar ---
  const exportBtn = document.getElementById('exportDataBtn');
  const importBtn = document.getElementById('importDataBtn'); // Botón visible
  const importInput = document.getElementById('importFileInput'); // Input oculto

  if (exportBtn) {
      exportBtn.addEventListener('click', exportData);
  }

  if (importBtn && importInput) {
      // Conecta el botón visible al click del input oculto
      importBtn.addEventListener('click', () => importInput.click());
      
      // Conecta el evento 'change' al input oculto
      importInput.addEventListener('change', (e) => {
          if (e.target.files.length > 0) {
              importData(e.target.files[0]);
              e.target.value = ''; // Resetear el input
          }
      });
  }
});