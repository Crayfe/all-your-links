// js/renderer.js

import { getFavicon } from './links.js';

// ========== UTILIDADES ==========

/**
 * Sanea strings para evitar XSS al insertar datos de usuario en innerHTML
 */
function sanitize(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Devuelve el target correcto según la preferencia de nueva pestaña
 */
function getLinkTarget() {
  const checkbox = document.getElementById('openNewTab');
  return checkbox?.checked ? '_blank' : '_self';
}

// ========== FUNCIONES DE RENDERIZADO ==========

/**
 * Crea una card completa para una box con sus items
 */
export function createBoxCard(box, items) {
  const layoutClass = box.layout === 'orbs' ? 'layout-orbs'
                    : box.layout === 'list' ? 'layout-list'
                    : 'layout-grid';

  const itemsHTML = items.length === 0
    ? '<p class="text-gray-400 text-sm italic">No hay enlaces en esta caja</p>'
    : items
        .filter(item => item.type === 'link')
        .map(item => box.layout === 'orbs' ? createOrbHTML(item) : createLinkHTML(item))
        .join('');

  const card = document.createElement('div');
  card.className = 'box-card p-4 rounded-lg shadow mb-4 bg-black/70 cursor-move';
  card.dataset.boxId = box.id;
  card.dataset.boxOrder = box.order;

  card.innerHTML = `
    <div class="box-header flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="drag-handle text-gray-500 hover:text-gray-300 transition cursor-grab text-xl" title="Arrastra para reordenar">⋮⋮</span>
        <h3 class="text-lg font-semibold text-gray-100">${sanitize(box.title)}</h3>
      </div>
      <div class="flex gap-2 items-center">
        <div class="relative">
          <button data-box-id="${box.id}" class="text-gray-300 hover:text-white px-2 box-menu-btn">⋯</button>
          <div id="box-menu-${box.id}" class="menu-options hidden absolute right-0 top-8 bg-white border rounded shadow-md z-10 dark:bg-gray-700 dark:border-gray-600 min-w-[160px]">
            <button data-box-id="${box.id}" class="block w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 dark:text-gray-200 add-link-btn">Nuevo enlace</button>
            <button data-box-id="${box.id}" class="block w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 dark:text-gray-200 box-edit-btn">Editar caja</button>
            <button data-box-id="${box.id}" class="block w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900 text-gray-700 dark:text-gray-200 box-delete-btn">Eliminar caja</button>
          </div>
        </div>
      </div>
    </div>
    <div class="items-container ${layoutClass}" data-box-id="${box.id}">
      ${itemsHTML}
    </div>
  `;

  return card;
}

/**
 * Genera el HTML para un enlace en formato lista/grid
 */
export function createLinkElement(item) {
  const el = document.createElement('div');
  el.className = 'link-item flex items-center justify-between p-2 bg-white/10 text-white rounded mb-2 hover:bg-black/60 transition cursor-move';
  el.dataset.itemId = item.id;
  el.dataset.itemOrder = item.order;
  el.innerHTML = createLinkHTML(item);
  return el;
}

/**
 * Genera el HTML para un enlace en formato orbe
 */
export function createOrbElement(item) {
  const el = document.createElement('div');
  el.className = 'orb-item link-item relative group';
  el.dataset.itemId = item.id;
  el.dataset.itemOrder = item.order;
  el.innerHTML = createOrbHTML(item);
  return el;
}

// ========== HELPERS DE HTML (uso interno) ==========

function createLinkHTML(item) {
  const { title, url } = item.data;
  const target = getLinkTarget();

  return `
    <a href="${sanitize(url)}" target="${target}" class="flex items-center gap-3 flex-1" data-item-id="${item.id}">
      <img src="${getFavicon(url)}" alt="icono" class="w-6 h-6 rounded">
      <span>${sanitize(title)}</span>
    </a>
    <div class="menu-container relative">
      <button data-item-id="${item.id}" class="text-gray-200 hover:text-white px-2 item-menu-btn">⋯</button>
      <div id="menu-${item.id}" class="menu-options hidden absolute right-0 top-8 bg-white border rounded shadow-md z-10 dark:bg-gray-700 dark:border-gray-600">
        <button data-item-id="${item.id}" class="block w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 item-edit-btn">Editar</button>
        <button data-item-id="${item.id}" class="block w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900 text-gray-700 item-delete-btn">Eliminar</button>
      </div>
    </div>
  `;
}

function createOrbHTML(item) {
  const { title, url } = item.data;
  const target = getLinkTarget();

  return `
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
    <a href="${sanitize(url)}" target="${target}" class="orb-link flex flex-col items-center gap-2" data-item-id="${item.id}" title="${sanitize(title)}">
      <div class="orb-icon-container w-20 h-20 rounded-full bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-sm hover:from-white/30 hover:to-white/10 flex items-center justify-center transition cursor-pointer shadow-lg hover:shadow-xl hover:scale-105 border border-white/10">
        <img src="${getFavicon(url)}" alt="${sanitize(title)}" class="w-12 h-12 object-contain" loading="lazy" onerror="this.style.opacity='0.5'">
      </div>
      <span class="orb-title text-sm text-white text-center max-w-[100px]">${sanitize(title)}</span>
    </a>
  `;
}
