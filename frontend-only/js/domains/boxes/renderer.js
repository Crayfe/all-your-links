// js/renderer.js

import {
  getFavicon,
  sanitize
} from '../../shared/utils.js';

function getLinkTarget() {
  const checkbox = document.getElementById('openNewTab');
  return checkbox?.checked ? '_blank' : '_self';
}

// ========== FUNCIONES DE RENDERIZADO ==========

/**
 * Crea una card completa para una box con sus items
 */
export function createBoxCard(box, items) {
  const layoutClass = box.layout === 'orbs'      ? 'layout-orbs'
                    : box.layout === 'list'      ? 'layout-list'
                    : box.layout === 'reference' ? 'layout-reference'
                    : 'layout-grid';

  const colSpanClass = box.colSpan === 3 ? 'md:col-span-3'
                     : box.colSpan === 2 ? 'md:col-span-2'
                     : 'md:col-span-1';

  const titleColor   = box.titleColor   || '#f3f4f6';
  const titleAlign   = box.titleAlign   || 'left';
  const titleFont    = box.titleFont    || 'Inter';
  const linkColor    = box.linkColor    || '#ffffff';
  const linkFontSize = box.linkFontSize || 14;
  const bgColor      = box.bgColor      || '#000000';
  const bgOpacity    = box.bgOpacity    ?? 0.7;
  const gridCols     = box.gridCols     || 2;
  const orbSize      = box.orbSize      || 80;
  const listRowHeight = box.listRowHeight || 'normal';

  // Convertir hex + opacidad a rgba
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substring(0,2), 16);
  const g = parseInt(hex.substring(2,4), 16);
  const b = parseInt(hex.substring(4,6), 16);
  const bgStyle = `rgba(${r},${g},${b},${bgOpacity})`;

  const card = document.createElement('div');
  card.className = `box-card ${colSpanClass} p-4 rounded-lg shadow`;
  card.style.backgroundColor = bgStyle;
  card.dataset.boxId = box.id;
  card.dataset.boxOrder = box.order;
  // Pasar vars CSS al contenedor para que las usen los hijos
  card.style.setProperty('--link-font-size', `${linkFontSize}px`);
  card.style.setProperty('--grid-cols', gridCols);
  card.style.setProperty('--orb-size', `${orbSize}px`);
  card.style.setProperty('--list-row-height', listRowHeight);
  const listPaddingMap = { compact: '0.1rem', normal: '0.3rem', relaxed: '0.65rem' };
  card.style.setProperty('--list-padding-y', listPaddingMap[listRowHeight] || '0.3rem');

  const isWidgetLayout = box.layout === 'widget-clock' || box.layout === 'widget-calendar' || box.layout === 'widget-stats' || box.layout === 'widget-rss';
  const titleHidden = box.showTitle === false;

  card.innerHTML = `
    <div class="box-header flex items-center justify-between mb-3 ${titleHidden ? 'title-hidden' : ''}">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <span class="drag-handle text-gray-500 hover:text-gray-300 transition cursor-grab text-xl flex-shrink-0" title="Arrastra para reordenar">⋮⋮</span>
        <h3 class="box-title text-lg font-semibold flex-1 min-w-0" style="color: ${titleColor}; text-align: ${titleAlign}; font-family: ${titleFont}, sans-serif">${sanitize(box.title)}</h3>
        ${titleHidden ? '<span class="title-hidden-badge edit-only" title="Este título no se muestra en uso normal">oculto</span>' : ''}
      </div>
      <div class="flex gap-2 items-center">
        <div class="relative">
          <button data-box-id="${box.id}" class="edit-only text-gray-300 hover:text-white px-2 box-menu-btn">⋯</button>
          <div id="box-menu-${box.id}" class="menu-options hidden absolute right-0 top-8 bg-white border rounded shadow-md z-10 dark:bg-gray-700 dark:border-gray-600 min-w-[160px]">
            ${!isWidgetLayout ? `<button data-box-id="${box.id}" class="block w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 dark:text-gray-200 add-link-btn">Nuevo enlace</button>` : ''}
            <button data-box-id="${box.id}" class="block w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 dark:text-gray-200 box-edit-btn">Editar caja</button>
            <button data-box-id="${box.id}" class="block w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900 text-gray-700 dark:text-gray-200 box-delete-btn">Eliminar caja</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Widget de hora/clima: la caja entera es el widget, sin items
  if (box.layout === 'widget-clock') {
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'clock-widget-container';
    widgetContainer.dataset.boxId = box.id;
    card.appendChild(widgetContainer);
    // La inicialización del contenido (reloj + clima) la gestiona clock-widget.js
    import('../content/clock/clock-widget.js').then(m => m.mountClockWidget(widgetContainer, box));
    return card;
  }

  // Widget de calendario: la caja entera es el widget, sin items
  if (box.layout === 'widget-calendar') {
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'calendar-widget-container';
    widgetContainer.dataset.boxId = box.id;
    card.appendChild(widgetContainer);
    import('../content/calendar/calendar-widget.js').then(m => m.mountCalendarWidget(widgetContainer, box));
    return card;
  }

  // Widget de estadísticas: ranking de más usados, calculado sobre items reales
  if (box.layout === 'widget-stats') {
    const widgetContainer = document.createElement('div');
    widgetContainer.dataset.boxId = box.id;
    card.appendChild(widgetContainer);
    import('../content/stats/stats-widget.js').then(m => m.mountStatsWidget(widgetContainer, box));
    return card;
  }

  // Widget de RSS: la caja entera es el widget, sin items
  if (box.layout === 'widget-rss') {
    const widgetContainer = document.createElement('div');
    widgetContainer.dataset.boxId = box.id;
    card.appendChild(widgetContainer);
    import('../content/rss/rss-widget.js').then(m => m.mountRssWidget(widgetContainer, box));
    return card;
  }

  // Contenedor de items como nodo real para Sortable
  const itemsContainer = document.createElement('div');
  itemsContainer.className = `items-container ${layoutClass}`;
  itemsContainer.dataset.boxId = box.id;

  if (items.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'text-gray-400 text-sm italic';
    emptyMsg.textContent = 'No hay enlaces en esta caja';
    itemsContainer.appendChild(emptyMsg);
  } else {
    items
      .filter(item => item.type === 'link')
      .forEach(item => {
        const el = box.layout === 'orbs'
          ? createOrbElement(item, linkColor)
          : box.layout === 'reference'
          ? createReferenceElement(item, linkColor)
          : createLinkElement(item, linkColor, box.layout);
        itemsContainer.appendChild(el);
      });
  }

  card.appendChild(itemsContainer);
  return card;
}

/**
 * Crea el nodo DOM para un enlace en formato lista/grid
 */
export function createLinkElement(item, linkColor = '#ffffff', layout = 'list') {
  const { title, url } = item.data;
  const target = getLinkTarget();
  const isGrid = layout === 'grid';

  const el = document.createElement('div');
  // Grid: sin mb (el gap del grid ya separa), Lista: mb-1 para separación mínima
  el.className = isGrid
    ? 'link-item flex items-center justify-between bg-white/10 rounded hover:bg-black/60 transition'
    : 'link-item flex items-center justify-between bg-white/10 rounded mb-1 hover:bg-black/60 transition';
  el.dataset.itemId = item.id;
  el.dataset.itemOrder = item.order;

  // Grid: abultado (p-3, icono grande, texto con wrap libre)
  // Lista: compacto (py-0.5 px-2, icono pequeño, texto sm truncado)
  const aClass    = isGrid ? 'flex items-center gap-3 flex-1 p-3 min-w-0'        : 'flex items-center gap-2 flex-1 py-0.5 px-2 min-w-0';
  const fontStyle = `font-size: var(--link-font-size, 14px)`;
  const imgClass  = isGrid ? 'w-6 h-6 rounded flex-shrink-0'                     : 'w-4 h-4 rounded flex-shrink-0';
  const spanClass = isGrid ? 'break-words min-w-0'                               : 'truncate text-sm';
  const btnClass  = isGrid ? 'edit-only text-gray-200 hover:text-white px-2 p-3 item-menu-btn' : 'edit-only text-gray-200 hover:text-white px-2 py-0.5 item-menu-btn';

  el.innerHTML = `
    <a href="${sanitize(url)}" target="${target}" class="${aClass}" data-item-id="${item.id}" style="color: ${linkColor}; ${fontStyle}">
      <img src="${getFavicon(url)}" alt="icono" class="${imgClass}">
      <span class="${spanClass}">${sanitize(title)}</span>
    </a>
    <div class="menu-container relative flex-shrink-0">
      <button data-item-id="${item.id}" class="${btnClass}">⋯</button>
      <div id="menu-${item.id}" class="menu-options hidden absolute right-0 top-8 bg-white border rounded shadow-md z-10 dark:bg-gray-700 dark:border-gray-600">
        <button data-item-id="${item.id}" class="block w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 item-edit-btn">Editar</button>
        <button data-item-id="${item.id}" class="block w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900 text-gray-700 item-delete-btn">Eliminar</button>
      </div>
    </div>
  `;

  return el;
}

/**
 * Crea el nodo DOM para un enlace en formato orbe
 */
export function createOrbElement(item, linkColor = '#ffffff') {
  const { title, url } = item.data;
  const target = getLinkTarget();

  const el = document.createElement('div');
  el.className = 'orb-item link-item relative group';
  el.dataset.itemId = item.id;
  el.dataset.itemOrder = item.order;

  el.innerHTML = `
    <div class="orb-menu-btn edit-only absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition">
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
      <div class="orb-icon-container rounded-full bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-sm hover:from-white/30 hover:to-white/10 flex items-center justify-center transition cursor-pointer shadow-lg hover:shadow-xl hover:scale-105 border border-white/10" style="width: var(--orb-size, 80px); height: var(--orb-size, 80px)">
        <img src="${getFavicon(url)}" alt="${sanitize(title)}" class="object-contain" style="width: calc(var(--orb-size, 80px) * 0.6); height: calc(var(--orb-size, 80px) * 0.6)" loading="lazy" onerror="this.style.opacity='0.5'">
      </div>
      <span class="orb-title text-sm text-center" style="color: ${linkColor}; max-width: calc(var(--orb-size, 80px) + 20px); font-size: var(--link-font-size, 14px)">${sanitize(title)}</span>
    </a>
  `;

  return el;
}

/**
 * Crea el nodo DOM para un enlace en formato referencia bibliográfica
 */
export function createReferenceElement(item, linkColor = '#ffffff') {
  const { title, url } = item.data;
  const target = getLinkTarget();

  const el = document.createElement('div');
  el.className = 'ref-item link-item';
  el.dataset.itemId = item.id;
  el.dataset.itemOrder = item.order;

  el.innerHTML = `
    <a href="${sanitize(url)}" target="${target}" class="ref-link flex-1 min-w-0" data-item-id="${item.id}">
      <span class="ref-title" style="color: ${linkColor}; font-size: var(--link-font-size, 14px)">${sanitize(title)}</span>
      <span class="ref-url">${sanitize(url)}</span>
    </a>
    <div class="menu-container relative flex-shrink-0">
      <button data-item-id="${item.id}" class="edit-only text-gray-400 hover:text-white px-2 py-1 item-menu-btn opacity-0 ref-menu-trigger">⋯</button>
      <div id="menu-${item.id}" class="menu-options hidden absolute right-0 top-8 bg-white border rounded shadow-md z-10 dark:bg-gray-700 dark:border-gray-600">
        <button data-item-id="${item.id}" class="block w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 item-edit-btn">Editar</button>
        <button data-item-id="${item.id}" class="block w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900 text-gray-700 item-delete-btn">Eliminar</button>
      </div>
    </div>
  `;

  return el;
}
