// js/domains/content/rss/rss-widget.js
// Widget de lector RSS: muestra titulares de un feed configurado en la caja,
// con refresco automático mientras la caja está visible.

import { getFeedItems, getLastFetchTime } from './integrations/rss-proxy.js';
import { showToast } from '../../../shared/ui.js';

// Intervalo de refresco automático en minutos (también es la validez de la caché)
const AUTO_REFRESH_MINUTES = 15;

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return 'Hace menos de 1h';
  if (diffH < 24) return `Hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Hace ${diffD}d`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function renderItems(listEl, items) {
  if (items.length === 0) {
    listEl.innerHTML = `<p class="rss-empty">No hay titulares disponibles</p>`;
    return;
  }
  listEl.innerHTML = items.map(item => `
    <a href="${item.link}" target="_blank" rel="noopener" class="rss-item">
      <span class="rss-item-title">${item.title}</span>
      ${item.pubDate ? `<span class="rss-item-date">${formatRelativeDate(item.pubDate)}</span>` : ''}
    </a>
  `).join('');
}

function renderError(listEl, errorType) {
  const messages = {
    'rss-no-url': 'Configura la URL del feed en Editar caja',
    'rss-invalid-feed': 'La URL no parece ser un feed RSS/Atom válido',
    'rss-needs-key': 'Configura tu API key de rss2json en Perfil',
  };
  const msg = messages[errorType] || 'No se pudo cargar el feed';
  listEl.innerHTML = `<p class="rss-error">${msg}</p>`;
}

export async function mountRssWidget(container, box) {
  const feedUrl = box.rssFeedUrl || '';
  const count   = box.rssCount || 8;

  container.innerHTML = `
    <div class="rss-widget">
      <div class="rss-header">
        <span class="rss-status"></span>
        <button class="rss-refresh-btn" title="Actualizar ahora">⟳</button>
      </div>
      <div class="rss-list"></div>
    </div>
  `;

  const listEl    = container.querySelector('.rss-list');
  const statusEl  = container.querySelector('.rss-status');
  const refreshBtn = container.querySelector('.rss-refresh-btn');

  function updateStatus() {
    const last = getLastFetchTime(feedUrl);
    statusEl.textContent = last
      ? `Actualizado: ${last.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
      : '';
  }

  async function load(forceRefresh = false) {
    if (!feedUrl) { renderError(listEl, 'rss-no-url'); return; }
    try {
      const { items, stale } = await getFeedItems(feedUrl, count, AUTO_REFRESH_MINUTES, forceRefresh);
      renderItems(listEl, items);
      updateStatus();
      if (stale) showToast('Mostrando datos guardados (sin conexión al feed)', 'info');
    } catch (e) {
      renderError(listEl, e.message);
    }
  }

  refreshBtn.addEventListener('click', async () => {
    refreshBtn.classList.add('rss-refresh-spinning');
    await load(true);
    refreshBtn.classList.remove('rss-refresh-spinning');
  });

  await load();

  // Refresco automático mientras la caja siga en el DOM
  const interval = setInterval(() => load(), AUTO_REFRESH_MINUTES * 60 * 1000);
  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      clearInterval(interval);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
