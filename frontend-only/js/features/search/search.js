// js/search.js

// ========== MOTORES DE BÚSQUEDA ==========

const ENGINES = {
  google: {
    name: 'Google',
    url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    placeholder: 'Buscar en Google...',
    suggestions: true,
    icon: `<svg viewBox="0 0 24 24" class="w-4 h-4"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    url: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    placeholder: 'Buscar en DuckDuckGo...',
    suggestions: false,
    icon: `<svg viewBox="0 0 24 24" class="w-4 h-4"><circle cx="12" cy="12" r="12" fill="#DE5833"/><path fill="white" d="M12 4.5C7.86 4.5 4.5 7.86 4.5 12S7.86 19.5 12 19.5 19.5 16.14 19.5 12 16.14 4.5 12 4.5zm0 2c1.7 0 3.26.6 4.47 1.6L7.1 17.47A7.46 7.46 0 0 1 4.5 12c0-4.14 3.36-7.5 7.5-7.5zm0 15c-1.7 0-3.26-.6-4.47-1.6l9.37-9.87A7.46 7.46 0 0 1 19.5 12c0 4.14-3.36 7.5-7.5 7.5z"/></svg>`
  },
  perplexity: {
    name: 'Perplexity',
    url: q => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`,
    placeholder: 'Buscar en Perplexity...',
    suggestions: false,
    icon: `<svg viewBox="0 0 24 24" class="w-4 h-4" fill="none"><rect width="24" height="24" rx="4" fill="#20808D"/><path d="M12 4L6 8v4l6 4 6-4V8L12 4z" fill="white" opacity="0.9"/><path d="M6 12v4l6 4 6-4v-4l-6 4-6-4z" fill="white" opacity="0.5"/></svg>`
  },
  internal: {
    name: 'Búsqueda interna',
    url: null,
    placeholder: 'Buscar en mis dashboards...',
    suggestions: false,
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.881a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>`
  }
};

// ========== ESTADO ==========

let currentEngine = localStorage.getItem('searchEngine') || 'google';
let lastExternalEngine = localStorage.getItem('lastExternalEngine') || 'google';

// ========== ELEMENTOS DEL DOM ==========

const googleSearch   = document.getElementById('googleSearch');
const googleBtn      = document.getElementById('googleBtn');
const suggestions    = document.getElementById('suggestions');
const engineBtn      = document.getElementById('engineBtn');
const engineIcon     = document.getElementById('engineIcon');
const engineDropdown = document.getElementById('engineDropdown');

// ========== MOTOR ==========

function setEngine(key) {
  currentEngine = key;
  localStorage.setItem('searchEngine', key);
  if (key !== 'internal') {
    lastExternalEngine = key;
    localStorage.setItem('lastExternalEngine', key);
  }
  const engine = ENGINES[key];
  engineIcon.innerHTML = engine.icon;
  googleSearch.placeholder = engine.placeholder;
  suggestions.classList.add('hidden');

  // Marcar opción activa en el dropdown
  document.querySelectorAll('.engine-option').forEach(btn => {
    const isActive = btn.dataset.engine === key;
    btn.classList.toggle('bg-gray-700', isActive);
    btn.classList.toggle('text-white', isActive);
  });

  // Si es búsqueda interna y hay texto, lanzar búsqueda
  if (key === 'internal') {
    import('./internal-search.js').then(m => m.showSearchView(googleSearch.value.trim()));
  } else {
    import('./internal-search.js').then(m => m.hideSearchView());
  }
}

// ========== BÚSQUEDA EXTERNA ==========

function performSearch(query) {
  if (!query) return;
  suggestions.classList.add('hidden');
  if (currentEngine === 'internal') {
    import('./internal-search.js').then(m => m.runSearch(query));
    return;
  }
  window.location.href = ENGINES[currentEngine].url(query);
}

// ========== SUGERENCIAS GOOGLE ==========

async function fetchSuggestions(query) {
  if (!query || !ENGINES[currentEngine].suggestions) {
    suggestions.classList.add('hidden');
    return;
  }
  try {
    const targetUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
    const proxyUrl  = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    const res  = await fetch(proxyUrl);
    const data = await res.json();
    suggestions.innerHTML = data[1]
      .map(s => `<li style="padding:0.5rem 1rem; cursor:pointer; color:#f3f4f6; font-size:0.875rem" onmouseover="this.style.background='#374151'" onmouseout="this.style.background=''">${s}</li>`)
      .join('');
    suggestions.classList.remove('hidden');
    suggestions.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        googleSearch.value = li.textContent;
        performSearch(li.textContent);
      });
    });
  } catch {
    suggestions.classList.add('hidden');
  }
}

// ========== INICIALIZACIÓN ==========

/**
 * Vuelve al último motor externo usado y limpia el campo de búsqueda.
 * Se llama tras navegar a un resultado desde la búsqueda interna.
 */
export function resetSearchAfterNavigation() {
  googleSearch.value = '';
  setEngine(lastExternalEngine);
}

export function initSearch() {
  // Aplicar motor guardado
  setEngine(currentEngine);

  // Botón buscar
  googleBtn.addEventListener('click', () => performSearch(googleSearch.value.trim()));

  // Enter
  googleSearch.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); performSearch(googleSearch.value.trim()); }
    if (e.key === 'Escape') {
      suggestions.classList.add('hidden');
      engineDropdown.classList.add('hidden');
      if (currentEngine === 'internal' && !googleSearch.value.trim()) {
        import('./internal-search.js').then(m => m.hideSearchView());
      }
    }
  });

  // Input: sugerencias o búsqueda interna en tiempo real
  googleSearch.addEventListener('input', () => {
    const query = googleSearch.value.trim();
    if (currentEngine === 'internal') {
      import('./internal-search.js').then(m => m.runSearch(query));
    } else {
      fetchSuggestions(query);
    }
  });

  // Toggle dropdown de motores
  engineBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    engineDropdown.classList.toggle('hidden');
  });

  // Selección de motor
  document.querySelectorAll('.engine-option').forEach(btn => {
    btn.addEventListener('click', () => {
      setEngine(btn.dataset.engine);
      engineDropdown.classList.add('hidden');
      googleSearch.focus();
    });
  });

  // Cerrar dropdown y sugerencias al hacer clic fuera
  document.addEventListener('click', e => {
    if (!e.target.closest('#searchWrapper')) {
      suggestions.classList.add('hidden');
      engineDropdown.classList.add('hidden');
    }
  });
}
