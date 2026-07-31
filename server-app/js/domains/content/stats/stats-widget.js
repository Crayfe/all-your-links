// js/domains/content/stats/stats-widget.js
// Widget de estadísticas: ranking global de enlaces más usados por clickCount.
// No gestiona items propios: calcula una vista sobre los items reales existentes.

import { getItems } from '../../../core/data-manager.js';
import { createLinkElement } from '../../boxes/renderer.js';

// Obtiene el top N de enlaces por clickCount, de todos los dashboards y cajas.
function getTopLinks(limit) {
  return getItems()
    .filter(item => item.type === 'link')
    .map(item => ({ item, clicks: item.metadata?.clickCount || 0 }))
    .filter(entry => entry.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit);
}

export function mountStatsWidget(container, box) {
  const limit     = box.statsLimit || 5;
  const linkColor = box.linkColor || '#ffffff';
  const topLinks  = getTopLinks(limit);

  container.innerHTML = '';
  container.className = 'stats-widget-container';

  if (topLinks.length === 0) {
    container.innerHTML = `<p class="stats-empty">Aún no hay clics registrados.<br>Usa tus enlaces desde el dashboard y volverán aquí.</p>`;
    return;
  }

  const list = document.createElement('div');
  list.className = 'stats-list layout-list';

  topLinks.forEach(({ item, clicks }, index) => {
    // Reutiliza el renderizado de enlace en modo lista
    const el = createLinkElement(item, linkColor, 'list');
    el.classList.add('stats-item');

    // Número de posición a la izquierda
    const rank = document.createElement('span');
    rank.className = 'stats-rank';
    rank.textContent = `${index + 1}`;
    el.prepend(rank);

    // Contador de clics a la derecha
    const count = document.createElement('span');
    count.className = 'stats-count';
    count.title = `${clicks} clic${clicks !== 1 ? 's' : ''}`;
    count.textContent = clicks;
    el.appendChild(count);

    list.appendChild(el);
  });

  container.appendChild(list);
}
