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
import { createBoxCard, createLinkElement, createOrbElement } from './renderer.js';

// ========== ELEMENTOS DEL DOM ==========
const list = document.getElementById('linksList');
const openNewTabCheckbox = document.getElementById('openNewTab');
const newLinkModal = document.getElementById('newLinkModal');

// ========== VARIABLES GLOBALES DRAG & DROP ==========
let sortableBoxes = null;
let sortableItems = [];
let isDragEnabled = false;

// ========== VARIABLES GLOBALES DRAG & DROP ==========
const GOOGLE_ICONS = {
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

// --- Utilidades ---
/**
 * Extrae el icono de la pagina a la que apunta un link para renderizarlo en la pagina
 */
export function getFavicon(url) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    // Si es un servicio de Google conocido, usar icono hardcodeado
    if (GOOGLE_ICONS[hostname]) {
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
 * Actualiza botón de drag and drop
 */
function updateDragButton(enabled) {
  const icon = document.getElementById('dragIcon');
  const text = document.getElementById('dragText');
  const btn  = document.getElementById('toggleDragBtn');

  if (enabled) {
    icon.innerHTML = '<path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />';
    text.textContent = 'Finalizar edición';
    btn.classList.remove('bg-purple-600', 'hover:bg-purple-500');
    btn.classList.add('bg-orange-600', 'hover:bg-orange-500');
  } else {
    icon.innerHTML = '<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />';
    text.textContent = 'Editar';
    btn.classList.remove('bg-orange-600', 'hover:bg-orange-500');
    btn.classList.add('bg-purple-600', 'hover:bg-purple-500');
  }
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
  updateDragButton(isDragEnabled);
  document.body.classList.toggle('drag-enabled', isDragEnabled);
  showToast(isDragEnabled ? 'Modo edición activado' : 'Modo edición desactivado', isDragEnabled ? 'success' : 'info');
  
  // Re-inicializar drag & drop (seguro)
  setTimeout(() => {
    initializeDragAndDrop();
  }, 100);
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
    updateDragButton(true);
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
