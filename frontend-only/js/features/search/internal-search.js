// js/internal-search.js
// Buscador interno: busca en dashboards, cajas e items en tiempo real

import { getDashboards, getBoxesByWorkspace, getItems } from '../../core/data-manager.js';
import { sanitize } from '../../shared/utils.js';
import { switchDashboard } from '../../domains/dashboard/dashboard.js';

// ========== ELEMENTOS ==========

const enlacesSection  = document.getElementById('enlacesSection');
const searchSection   = document.getElementById('searchSection');
const searchResults   = document.getElementById('searchResults');
const searchEmpty     = document.getElementById('searchEmpty');
const searchCount     = document.getElementById('searchResultCount');

// ========== HIGHLIGHT ==========

function highlight(text, query) {
  if (!query) return sanitize(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return sanitize(text).replace(regex, '<mark class="search-highlight">$1</mark>');
}

// ========== BÚSQUEDA ==========

export function runSearch(query) {
  searchResults.innerHTML = '';
  searchEmpty.classList.add('hidden');
  searchCount.textContent = '';

  if (!query || query.length < 2) {
    searchCount.textContent = 'Escribe al menos 2 caracteres';
    return;
  }

  const q = query.toLowerCase();
  const dashboards = getDashboards().sort((a, b) => a.order - b.order);
  const allItems   = getItems();
  let totalMatches = 0;

  dashboards.forEach(db => {
    const boxes = getBoxesByWorkspace(db.id).sort((a, b) => a.order - b.order);

    boxes.forEach(box => {
      const boxMatches = [];

      // Buscar en nombre de la caja
      const boxNameMatch = box.title.toLowerCase().includes(q);

      // Buscar en items de la caja
      const boxItems = allItems.filter(i => i.boxId === box.id);
      boxItems.forEach(item => {
        if (item.type !== 'link') return;
        const { title = '', url = '' } = item.data || {};
        const tags = item.metadata?.tags || [];
        const tagsMatch = tags.some(tag => tag.toLowerCase().includes(q));
        if (
          title.toLowerCase().includes(q) ||
          url.toLowerCase().includes(q) ||
          tagsMatch
        ) {
          boxMatches.push({ ...item, _tagMatch: tagsMatch });
        }
      });

      if (!boxNameMatch && boxMatches.length === 0) return;

      totalMatches += boxMatches.length + (boxNameMatch ? 1 : 0);

      // Renderizar bloque de resultados
      const block = document.createElement('div');
      block.className = 'search-block';

      // Cabecera con contexto Dashboard › Caja — clicable para navegar
      const header = document.createElement('button');
      header.className = 'search-block-header search-block-header-btn';
      header.dataset.dashboardId = db.id;
      header.dataset.boxId = box.id;
      header.title = 'Ir a esta caja';
      header.innerHTML = `
        <span class="search-db-name">${sanitize(db.name)}</span>
        <span class="search-sep">›</span>
        <span class="search-box-name ${boxNameMatch ? 'search-highlight-box' : ''}">${highlight(box.title, boxNameMatch ? query : '')}</span>
        <span class="search-item-count">${boxMatches.length} enlace${boxMatches.length !== 1 ? 's' : ''}</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="search-goto-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H3a1 1 0 110-2h9.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      `;
      block.appendChild(header);

      // Items con coincidencias
      if (boxMatches.length > 0) {
        const list = document.createElement('div');
        list.className = 'search-items-list';

        boxMatches.forEach(item => {
          const { title, url } = item.data;
          const row = document.createElement('a');
          row.href = url;
          row.target = document.getElementById('openNewTab')?.checked ? '_blank' : '_self';
          row.className = 'search-result-item';
          row.addEventListener('click', () => {
            import('./search.js').then(m => m.resetSearchAfterNavigation());
          });
          const matchedTags = item._tagMatch
            ? (item.metadata?.tags || []).filter(t => t.toLowerCase().includes(query.toLowerCase()))
            : [];
          row.innerHTML = `
            <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=32"
                 class="search-favicon" alt="" onerror="this.style.opacity='0.3'">
            <div class="search-result-text">
              <span class="search-result-title">${highlight(title, query)}</span>
              <span class="search-result-url">${highlight(url, query)}</span>
              ${matchedTags.length > 0 ? `<span class="search-result-tag">#${sanitize(matchedTags[0])}</span>` : ''}
            </div>
          `;
          list.appendChild(row);
        });

        block.appendChild(list);
      }

      searchResults.appendChild(block);
    });
  });

  if (totalMatches === 0) {
    searchEmpty.classList.remove('hidden');
    searchCount.textContent = '';
  } else {
    searchCount.textContent = `${totalMatches} resultado${totalMatches !== 1 ? 's' : ''}`;
  }
}

// ========== MOSTRAR / OCULTAR VISTA ==========

export function showSearchView(query = '') {
  enlacesSection.classList.add('hidden');
  const profileSection = document.getElementById('profileSection');
  if (!profileSection.classList.contains('hidden')) profileSection.classList.add('hidden');
  searchSection.classList.remove('hidden');
  if (query && query.length >= 2) {
    runSearch(query);
  } else {
    searchResults.innerHTML = '';
    searchEmpty.classList.add('hidden');
    searchCount.textContent = query ? 'Escribe al menos 2 caracteres' : '';
  }
}

export function hideSearchView() {
  searchSection.classList.add('hidden');
  enlacesSection.classList.remove('hidden');
  searchResults.innerHTML = '';
  searchEmpty.classList.add('hidden');
  searchCount.textContent = '';
}

// ========== NAVEGACIÓN A CAJA ==========

function goToBox(dashboardId, boxId) {
  switchDashboard(dashboardId);
  hideSearchView();
  import('./search.js').then(m => m.resetSearchAfterNavigation());

  // Esperar a que renderDashboard (disparado por switchDashboard) pinte el DOM
  setTimeout(() => {
    const boxEl = document.querySelector(`.box-card[data-box-id="${boxId}"]`);
    if (!boxEl) return;
    boxEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    boxEl.classList.add('search-box-flash');
    setTimeout(() => boxEl.classList.remove('search-box-flash'), 1600);
  }, 150);
}

// Delegación de eventos para las cabeceras de resultados
searchResults.addEventListener('click', (e) => {
  const header = e.target.closest('.search-block-header-btn');
  if (!header) return;
  goToBox(header.dataset.dashboardId, header.dataset.boxId);
});
