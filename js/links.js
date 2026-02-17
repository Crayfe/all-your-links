// js/links.js

import { showToast, toggleMenu } from './ui.js';
import { 
  initializeData,
  getActiveWorkspace,
  getBoxesByWorkspace,
  getBox,
  getItemsByBox,
  getItem,
  saveBox,
  saveItem,
  deleteBox as deleteBoxFromStorage,
  deleteItem as deleteItemFromStorage,
  trackItemClick,
  exportData,
  importData
} from './data-manager.js';
import { createBox, createLinkItem } from './data-model.js';

// ========== ELEMENTOS DEL DOM ==========
const list = document.getElementById('linksList');
const openNewTabCheckbox = document.getElementById('openNewTab');
const newLinkModal = document.getElementById('newLinkModal');

// ========== VARIABLES GLOBALES DRAG & DROP ==========
let sortableBoxes = null;
let sortableItems = [];
let isDragEnabled = false;

// --- Utilidades ---
function getFavicon(url) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    
    // Iconos hardcodeados para servicios de Google (mejor calidad)
    const googleIcons = {
      'mail.google.com': 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
      'drive.google.com': 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',
      'calendar.google.com': 'https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_11.ico',
      'docs.google.com': 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
      'sheets.google.com': 'https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico',
      'slides.google.com': 'https://ssl.gstatic.com/docs/presentations/images/favicon5.ico',
      'photos.google.com': 'https://www.gstatic.com/images/branding/product/1x/photos_48dp.png',
      'keep.google.com': 'https://ssl.gstatic.com/keep/icon_2020q4v2_128.png',
      'meet.google.com': 'https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v6/web-512dp/logo_meet_2020q4_color_2x_web_512dp.png',
      'maps.google.com': 'https://www.google.com/images/branding/product/ico/maps_32dp.ico',
      'translate.google.com': 'https://ssl.gstatic.com/images/branding/product/1x/translate_24dp.png'
    };
    
    // Si es un servicio de Google conocido, usar icono hardcodeado
    if (googleIcons[hostname]) {
      return googleIcons[hostname];
    }
    
    // Fallback a Google Favicons con alta resolución
    return `https://www.google.com/s2/favicons?sz=128&domain=${hostname}`;
  } catch (e) {
    // Fallback: icono genérico
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"><circle cx="12" cy="12" r="10"/></svg>';
  }
}
/**
 * Normaliza una URL añadiendo https:// si falta el protocolo
 */
function normalizeUrl(url) {
  url = url.trim();
  
  // Si ya tiene protocolo, devolverla tal cual
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  
  // Si empieza con www., añadir https://
  if (url.startsWith('www.')) {
    return `https://${url}`;
  }
  
  // Si parece un dominio válido (tiene punto), añadir https://
  if (url.includes('.') && !url.includes(' ')) {
    return `https://${url}`;
  }
  
  // Si no, añadir https:// de todas formas
  return `https://${url}`;
}
// ========== RENDERIZADO ==========

/**
 * Renderiza el workspace activo con todas sus boxes
 */
export function renderLinks() {
  const workspace = getActiveWorkspace();
  if (!workspace) {
    list.innerHTML = '<p class="text-gray-400 text-center p-8">No hay workspaces disponibles</p>';
    return;
  }
  
  const boxes = getBoxesByWorkspace(workspace.id);
  list.innerHTML = '';
  
  if (boxes.length === 0) {
    list.innerHTML = '<p class="text-gray-400 text-center p-8">No hay cajas. Crea una para empezar a añadir enlaces.</p>';
    return;
  }
  
  // Renderizar cada box
  boxes.forEach(box => {
    const items = getItemsByBox(box.id);
    const boxElement = createBoxCard(box, items);
    list.appendChild(boxElement);
  });
  initializeDragAndDrop();
}
/**
 * Inicializa drag & drop en todas las cajas y sus items
 */
function initializeDragAndDrop() {
  // Limpiar instancias anteriores de forma segura
  if (sortableBoxes) {
    try {
      sortableBoxes.destroy();
    } catch (e) {
      console.warn('Error al destruir sortableBoxes:', e);
    }
    sortableBoxes = null;
  }
  
  sortableItems.forEach(s => {
    try {
      s.destroy();
    } catch (e) {
      console.warn('Error al destruir sortable item:', e);
    }
  });
  sortableItems = [];
  
  // Si el drag está deshabilitado, salir
  if (!isDragEnabled) {
    return;
  }
  
  // ========== DRAG & DROP DE CAJAS ==========
  const boxesContainer = document.getElementById('linksList');
  
  if (boxesContainer) {
    sortableBoxes = Sortable.create(boxesContainer, {
      animation: 150,
      handle: '.drag-handle',
      draggable: '.box-card',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      disabled: false, // Asegurar que esté habilitado
      
      onEnd: function(evt) {
        const workspace = getActiveWorkspace();
        const boxes = getBoxesByWorkspace(workspace.id);
        
        const boxElements = boxesContainer.querySelectorAll('.box-card');
        boxElements.forEach((element, index) => {
          const boxId = element.dataset.boxId;
          const box = boxes.find(b => b.id === boxId);
          if (box) {
            box.order = index;
            saveBox(box);
          }
        });
        
        showToast('Orden de cajas actualizado', 'success');
      }
    });
  }
  
  // ========== DRAG & DROP DE ITEMS (enlaces) ==========
  const itemContainers = document.querySelectorAll('.items-container');
  
  itemContainers.forEach(container => {
    const sortableInstance = Sortable.create(container, {
      animation: 150,
      handle: '.link-item',
      draggable: '.link-item',
      group: 'links',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      disabled: false, // Asegurar que esté habilitado
      
      onMove: function(evt) {
        evt.to.classList.add('sortable-drag-over');
      },
      
      onEnd: function(evt) {
        document.querySelectorAll('.items-container').forEach(c => {
          c.classList.remove('sortable-drag-over');
        });
        
        const itemElement = evt.item;
        const itemId = itemElement.dataset.itemId;
        const newContainer = evt.to;
        const newBoxId = newContainer.dataset.boxId;
        const oldBoxId = evt.from.dataset.boxId;
        
        const item = getItem(itemId);
        if (!item) return;
        
        if (oldBoxId !== newBoxId) {
          item.boxId = newBoxId;
          showToast('Enlace movido a otra caja', 'success');
        }
        
        const itemElements = newContainer.querySelectorAll('.link-item');
        itemElements.forEach((element, index) => {
          const id = element.dataset.itemId;
          const i = getItem(id);
          if (i) {
            i.order = index;
            i.boxId = newBoxId;
            saveItem(i);
          }
        });
        
        if (oldBoxId !== newBoxId) {
          renderLinks();
        }
      }
    });
    
    sortableItems.push(sortableInstance);
  });
}
/**
 * Activa o desactiva el drag & drop
 */
function toggleDragAndDrop() {
  isDragEnabled = !isDragEnabled;
  
  // Guardar preferencia en localStorage
  localStorage.setItem('dragEnabled', isDragEnabled);
  
  // Actualizar UI del botón
  const icon = document.getElementById('dragIcon');
  const text = document.getElementById('dragText');
  const btn = document.getElementById('toggleDragBtn');
  
  if (isDragEnabled) {
    // Modo EDICIÓN activado - icono de candado abierto
    icon.innerHTML = '<path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />';
    text.textContent = 'Finalizar edición';
    btn.classList.remove('bg-purple-600', 'hover:bg-purple-500');
    btn.classList.add('bg-orange-600', 'hover:bg-orange-500');
    document.body.classList.add('drag-enabled');
    showToast('Modo edición activado', 'success');
  } else {
    // Modo BLOQUEADO - icono de candado cerrado
    icon.innerHTML = '<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />';
    text.textContent = 'Editar';
    btn.classList.remove('bg-orange-600', 'hover:bg-orange-500');
    btn.classList.add('bg-purple-600', 'hover:bg-purple-500');
    document.body.classList.remove('drag-enabled');
    showToast('Modo edición desactivado', 'info');
  }
  
  // Re-inicializar drag & drop (seguro)
  setTimeout(() => {
    initializeDragAndDrop();
  }, 100);
}

/**
 * Crea una card para una box con sus items
 */
function createBoxCard(box, items) {
  const card = document.createElement('div');
  card.className = 'box-card p-4 rounded-lg shadow mb-4 bg-black/70 cursor-move';
  card.dataset.boxId = box.id;
  card.dataset.boxOrder = box.order;
  
  // Header de la box
  const header = document.createElement('div');
  header.className = 'box-header flex items-center justify-between mb-3';

  // Título con handle de drag
  const titleContainer = document.createElement('div');
  titleContainer.className = 'flex items-center gap-2';

  const dragHandle = document.createElement('span');
  dragHandle.className = 'drag-handle text-gray-500 hover:text-gray-300 transition cursor-grab text-xl';
  dragHandle.innerHTML = '⋮⋮';
  dragHandle.title = 'Arrastra para reordenar';

  const title = document.createElement('h3');
  title.textContent = box.title;
  title.className = 'text-lg font-semibold text-gray-100';

  titleContainer.appendChild(dragHandle);
  titleContainer.appendChild(title);
  
  // Botones de acciones de la box
  const boxActions = document.createElement('div');
  boxActions.className = 'flex gap-2 items-center';
  boxActions.innerHTML = `
    <div class="relative">
      <button data-box-id="${box.id}" class="text-gray-300 hover:text-white px-2 box-menu-btn">⋯</button>
      <div id="box-menu-${box.id}" class="menu-options hidden absolute right-0 top-8 bg-white border rounded shadow-md z-10 dark:bg-gray-700 dark:border-gray-600 min-w-[160px]">
        <button data-box-id="${box.id}" class="block w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 dark:text-gray-200 add-link-btn">Nuevo enlace</button>
        <button data-box-id="${box.id}" class="block w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 dark:text-gray-200 box-edit-btn">Editar caja</button>
        <button data-box-id="${box.id}" class="block w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900 text-gray-700 dark:text-gray-200 box-delete-btn">Eliminar caja</button>
      </div>
    </div>
  `;
  
  header.appendChild(titleContainer);
  header.appendChild(boxActions);
  card.appendChild(header);
  
  // Contenedor de items (sortable)
const itemsContainer = document.createElement('div');
itemsContainer.className = 'items-container';
itemsContainer.dataset.boxId = box.id;

// Aplicar clase según el layout
if (box.layout === 'orbs') {
  itemsContainer.classList.add('layout-orbs');
} else if (box.layout === 'list') {
  itemsContainer.classList.add('layout-list');
} else {
  itemsContainer.classList.add('layout-grid');
}

// Renderizar items (enlaces)
if (items.length === 0) {
  const emptyMsg = document.createElement('p');
  emptyMsg.className = 'text-gray-400 text-sm italic';
  emptyMsg.textContent = 'No hay enlaces en esta caja';
  itemsContainer.appendChild(emptyMsg);
} else {
  items.forEach(item => {
    if (item.type === 'link') {
      // Renderizar según el layout de la box
      const itemElement = box.layout === 'orbs' 
        ? createOrbElement(item) 
        : createLinkElement(item);
      itemsContainer.appendChild(itemElement);
    }
  });
}

card.appendChild(itemsContainer);
  
  return card;
}

/**
 * Crea el elemento HTML para un item tipo 'link'
 */
function createLinkElement(item) {
  const linkItem = document.createElement('div');
  linkItem.className = 'link-item flex items-center justify-between p-2 bg-white/10 text-white rounded mb-2 hover:bg-black/60 transition cursor-move';
  linkItem.dataset.itemId = item.id;
  linkItem.dataset.itemOrder = item.order;
  const target = openNewTabCheckbox.checked ? '_blank' : '_self';
  const { title, url } = item.data;
  
  linkItem.innerHTML = `
    <a href="${url}" 
       target="${target}" 
       class="flex items-center gap-3 flex-1"
       data-item-id="${item.id}">
      <img src="${getFavicon(url)}" alt="icono" class="w-6 h-6 rounded">
      <span>${title}</span>
    </a>
    <div class="menu-container relative">
      <button data-item-id="${item.id}" class="text-gray-200 hover:text-white px-2 item-menu-btn">⋯</button>
      
      <div id="menu-${item.id}" class="menu-options hidden absolute right-0 top-8 bg-white border rounded shadow-md z-10 dark:bg-gray-700 dark:border-gray-600">
        <button data-item-id="${item.id}" class="block w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 item-edit-btn">Editar</button>
        <button data-item-id="${item.id}" class="block w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900 text-gray-700 item-delete-btn">Eliminar</button>
      </div>
    </div>
  `;
  
  return linkItem;
}
/**
 * Crea el elemento HTML para un item tipo 'link' en formato orbe
 */
function createOrbElement(item) {
  const orb = document.createElement('div');
  orb.className = 'orb-item link-item relative group';
  orb.dataset.itemId = item.id;
  orb.dataset.itemOrder = item.order;
  
  const { title, url } = item.data;
  const target = openNewTabCheckbox.checked ? '_blank' : '_self';
  
  orb.innerHTML = `
  <div class="orb-menu-btn absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition">
    <button data-item-id="${item.id}" class="text-white hover:text-gray-300 p-1.5 item-menu-btn bg-black/70 rounded-full hover:bg-black/90 shadow-lg">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
      </svg>
    </button>
    
    <div id="menu-${item.id}" class="menu-options hidden absolute right-0 top-10 bg-white border rounded shadow-md z-30 dark:bg-gray-700 dark:border-gray-600 min-w-[140px]">
      <button data-item-id="${item.id}" class="block w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 dark:text-gray-200 item-edit-btn">Editar</button>
      <button data-item-id="${item.id}" class="block w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900 text-gray-700 dark:text-gray-200 item-delete-btn">Eliminar</button>
    </div>
  </div>
  
  <a href="${url}" 
     target="${target}" 
     class="orb-link flex flex-col items-center gap-2"
     data-item-id="${item.id}"
     title="${title}">
    <div class="orb-icon-container w-20 h-20 rounded-full bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-sm hover:from-white/30 hover:to-white/10 flex items-center justify-center transition cursor-pointer shadow-lg hover:shadow-xl hover:scale-105 border border-white/10">
      <img src="${getFavicon(url)}" 
           alt="${title}" 
           class="w-12 h-12 object-contain"
           loading="lazy"
           onerror="this.style.opacity='0.5'">
    </div>
    <span class="orb-title text-sm text-white text-center max-w-[100px]">${title}</span>
  </a>
`;
  
  return orb;
}
// ========== CRUD ITEMS ==========

/**
 * Edita un item tipo 'link'
 */
function editItem(itemId) {
  const item = getItem(itemId);
  if (!item || item.type !== 'link') return;
  
  // Cargar datos en el formulario
  document.getElementById('newLinkTitle').value = item.data.title;
  document.getElementById('newLinkUrl').value = item.data.url;
  
  // Cambiar título del modal
  document.getElementById('linkModalTitle').textContent = 'Editar enlace';

  // Guardar el ID para editarlo después
  newLinkModal.dataset.editingId = itemId;
  
  // Abrir el menú
  newLinkModal.classList.add('active');
  showToast('Edita el enlace y guarda para aplicar cambios', 'info');
}

/**
 * Elimina un item
 */
function deleteItem(itemId) {
  if (confirm('¿Eliminar este enlace?')) {
    deleteItemFromStorage(itemId);
    renderLinks();
    showToast('Enlace eliminado', 'success');
  }
}

// ========== CRUD BOXES ==========

/**
 * Edita el nombre de una box
 */
function editBox(boxId) {
  const box = getBox(boxId);
  if (!box) return;
  
  // Cambiar título del modal
  document.getElementById('boxModalTitle').textContent = 'Editar caja';
  
  // Cargar datos actuales en el formulario
  document.getElementById('newBoxTitle').value = box.title;
  document.getElementById('newBoxLayout').value = box.layout || 'grid';
  
  // Guardar el ID de la caja que se está editando
  newBoxModal.dataset.editingBoxId = boxId;
  
  // Abrir el modal
  newBoxModal.classList.add('active');
}

/**
 * Elimina una box y todos sus items
 */
function deleteBox(boxId) {
  const box = getBox(boxId);
  if (!box) return;
  
  const items = getItemsByBox(boxId);
  const confirmMsg = items.length > 0 
    ? `¿Eliminar la caja "${box.title}" y sus ${items.length} enlaces?`
    : `¿Eliminar la caja "${box.title}"?`;
  
  if (confirm(confirmMsg)) {
    deleteBoxFromStorage(boxId);
    renderLinks();
    showToast('Caja eliminada', 'success');
  }
}

// --- Funciones de Importar/Exportar Datos ---

// ========== IMPORT / EXPORT ==========

/**
 * Exporta todos los datos a un archivo JSON
 */
function exportAllData() {
  const data = exportData();
  
  if (!data.items || data.items.length === 0) {
    showToast('No hay datos para exportar', 'info');
    return;
  }
  
  const dataStr = JSON.stringify(data, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  const exportFileName = `dashboard_backup_${Date.now()}.json`;

  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileName);
  document.body.appendChild(linkElement);
  linkElement.click();
  document.body.removeChild(linkElement);
  
  showToast('Datos exportados con éxito', 'success');
}

/**
 * Importa datos desde un archivo JSON
 */
function importFromFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      
      importData(data);
      renderLinks();
      
      showToast('Datos importados correctamente', 'success');
    } catch (error) {
      showToast(`Error al importar: ${error.message}`, 'error');
      console.error('Error de importación:', error);
    }
  };
  reader.readAsText(file);
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar datos
  initializeData();
  const savedDragState = localStorage.getItem('dragEnabled');
if (savedDragState === 'true') {
  isDragEnabled = true;
  document.body.classList.add('drag-enabled');
  
  const icon = document.getElementById('dragIcon');
  const text = document.getElementById('dragText');
  const btn = document.getElementById('toggleDragBtn');
  
  // Candado abierto
  icon.innerHTML = '<path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />';
  text.textContent = 'Finalizar edición';
  btn.classList.remove('bg-purple-600', 'hover:bg-purple-500');
  btn.classList.add('bg-orange-600', 'hover:bg-orange-500');
  }
  renderLinks();
  
  // Preferencia abrir en nueva pestaña
  openNewTabCheckbox.checked = localStorage.getItem('abrirNuevaPestana') === 'true';
  openNewTabCheckbox.addEventListener('change', () => {
    localStorage.setItem('abrirNuevaPestana', openNewTabCheckbox.checked);
    renderLinks();
    showToast('Preferencia actualizada', 'success');
  });

// ====== BOTÓN "NUEVA CAJA" ======
  const newBoxModal = document.getElementById('newBoxModal');
  const newBoxBtn = document.getElementById('newBoxBtn');
  
  if (newBoxBtn) {
    newBoxBtn.addEventListener('click', () => {
      // Cambiar título del modal
      document.getElementById('boxModalTitle').textContent = 'Nueva caja';
      
      // Limpiar formulario
      document.getElementById('newBoxTitle').value = '';
      document.getElementById('newBoxLayout').value = 'grid'; // Valor por defecto
      delete newBoxModal.dataset.editingBoxId;
      
      // Abrir modal
      newBoxModal.classList.add('active');
    });
  }
  
  document.getElementById('cancelNewBox').addEventListener('click', () => {
    newBoxModal.classList.remove('active');
  });
  
  document.getElementById('saveNewBox').addEventListener('click', () => {
    const title = document.getElementById('newBoxTitle').value.trim();
    const layout = document.getElementById('newBoxLayout').value;
    
    if (!title) {
      showToast('El nombre de la caja es obligatorio', 'error');
      return;
    }
    
    const workspace = getActiveWorkspace();
    if (!workspace) {
      showToast('No hay workspace activo', 'error');
      return;
    }
    
    // Modo EDICIÓN
    if (newBoxModal.dataset.editingBoxId) {
      const box = getBox(newBoxModal.dataset.editingBoxId);
      if (box) {
        box.title = title;
        box.layout = layout;
        saveBox(box);
        showToast('Caja actualizada', 'success');
      }
      delete newBoxModal.dataset.editingBoxId;
    }
    // Modo CREACIÓN
    else {
      const boxes = getBoxesByWorkspace(workspace.id);
      const newBox = createBox(workspace.id, title);
      newBox.layout = layout;
      newBox.order = boxes.length;
      saveBox(newBox);
      showToast('Caja creada', 'success');
    }
    
    renderLinks();
    newBoxModal.classList.remove('active');
    document.getElementById('newBoxTitle').value = '';
    document.getElementById('newBoxLayout').value = 'grid';
  });

  // ====== MENÚ "NUEVO ENLACE" (ahora se abre desde cada caja) ======
  document.getElementById('cancelNewLink').addEventListener('click', () => {
    delete newLinkModal.dataset.editingId;
    delete newLinkModal.dataset.targetBoxId;
    newLinkModal.classList.remove('active');
  });
document.getElementById('saveNewLink').addEventListener('click', () => {
  const title = document.getElementById('newLinkTitle').value.trim();
  let url = document.getElementById('newLinkUrl').value.trim();
  
  if (!title) {
    showToast('El título es obligatorio', 'error');
    return;
  }
  
  if (!url) {
    showToast('La URL es obligatoria', 'error');
    return;
  }
  
  // Normalizar la URL (añadir https:// si falta)
  url = normalizeUrl(url);
  
  // Validar que sea una URL válida después de normalizar
  try {
    new URL(url);
  } catch (e) {
    showToast('URL no válida', 'error');
    return;
  }
  
  // Modo EDICIÓN
  if (newLinkModal.dataset.editingId) {
    const item = getItem(newLinkModal.dataset.editingId);
    if (item && item.type === 'link') {
      item.data.title = title;
      item.data.url = url; // ← URL ya normalizada
      saveItem(item);
      showToast('Enlace actualizado', 'success');
    }
    delete newLinkModal.dataset.editingId;
  } 
  // Modo CREACIÓN
  else {
    const targetBoxId = newLinkModal.dataset.targetBoxId;
    if (!targetBoxId) {
      showToast('Error: no se especificó la caja destino', 'error');
      return;
    }
    
    const existingItems = getItemsByBox(targetBoxId);
    const newItem = createLinkItem(targetBoxId, title, url); // ← URL ya normalizada
    newItem.order = existingItems.length;
    saveItem(newItem);
    showToast('Enlace guardado correctamente', 'success');
    delete newLinkModal.dataset.targetBoxId;
  }
  
  renderLinks();
  newLinkModal.classList.remove('active');
  document.getElementById('newLinkTitle').value = '';
  document.getElementById('newLinkUrl').value = '';
});

  // ====== CERRAR MODALES AL HACER CLICK EN EL OVERLAY ======
  newLinkModal.addEventListener('click', (e) => {
    if (e.target === newLinkModal) {
      delete newLinkModal.dataset.editingId;
      delete newLinkModal.dataset.targetBoxId;
      newLinkModal.classList.remove('active');
    }
  });
  
  newBoxModal.addEventListener('click', (e) => {
    if (e.target === newBoxModal) {
      newBoxModal.classList.remove('active');
    }
  });
  // ====== EVENT DELEGATION para elementos dinámicos ======
  list.addEventListener('click', (e) => {
    const target = e.target;
    
    console.log('=== CLICK DEBUG ===');
    console.log('Target:', target);
    console.log('Target classes:', target.className);
    console.log('Closest button:', target.closest('button'));
    // ===== BOXES =====
    const boxId = target.dataset.boxId;
    if (boxId) {
      if (target.classList.contains('box-menu-btn')) {
        toggleMenu(boxId);
      }
      if (target.classList.contains('box-edit-btn')) {
        editBox(boxId);
      }
      if (target.classList.contains('box-delete-btn')) {
        deleteBox(boxId);
      }
      // Botón "+ Enlace"
      if (target.classList.contains('add-link-btn')) {
        // Limpiar formulario
        delete newLinkModal.dataset.editingId;
        document.getElementById('newLinkTitle').value = '';
        document.getElementById('newLinkUrl').value = '';
        
        // Guardar la caja destino
        newLinkModal.dataset.targetBoxId = boxId;
        
        // Abrir menú
        newLinkModal.classList.add('active');
      }
    }
    
    // ===== ITEMS =====
    let itemId = target.dataset.itemId;
if (!itemId) {
  const closestWithId = target.closest('[data-item-id]');
  if (closestWithId) {
    itemId = closestWithId.dataset.itemId;
  }
}

if (itemId) {
  // Verificar si es un botón de menú
  const isMenuBtn = target.classList.contains('item-menu-btn') || target.closest('.item-menu-btn');
  const isEditBtn = target.classList.contains('item-edit-btn');
  const isDeleteBtn = target.classList.contains('item-delete-btn');
  
  // Prevenir que el click abra el enlace
  if (isMenuBtn || isEditBtn || isDeleteBtn) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  if (isMenuBtn) {
    toggleMenu(itemId);
  }
  if (isEditBtn) {
    editItem(itemId);
  }
  if (isDeleteBtn) {
    deleteItem(itemId);
  }
}
  });
  // ====== TOGGLE DRAG & DROP ======
  const toggleDragBtn = document.getElementById('toggleDragBtn');
  if (toggleDragBtn) {
    toggleDragBtn.addEventListener('click', toggleDragAndDrop);
  }
  // Tracking de clicks en enlaces
  list.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-item-id]');
    if (link) {
      const itemId = link.dataset.itemId;
      trackItemClick(itemId);
    }
  });

  // ====== IMPORT / EXPORT ======
  const exportBtn = document.getElementById('exportDataBtn');
  const importBtn = document.getElementById('importDataBtn');
  const importInput = document.getElementById('importFileInput');

  if (exportBtn) {
    exportBtn.addEventListener('click', exportAllData);
  }

  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        importFromFile(e.target.files[0]);
        e.target.value = '';
      }
    });
  }
});