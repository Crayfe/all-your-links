// extension/config.js
// URL del dashboard, configurable desde el popup y guardada en el propio
// almacenamiento de la extensión (no en localStorage de ninguna página).
// Por defecto apunta al servidor real; puedes cambiarla a localhost si
// estás desarrollando en local.

const DEFAULT_DASHBOARD_URL = 'https://allyourlinks.duckdns.org';

async function getDashboardUrl() {
  const { dashboardUrl } = await chrome.storage.local.get('dashboardUrl');
  return dashboardUrl || DEFAULT_DASHBOARD_URL;
}

async function setDashboardUrl(url) {
  // Quita la barra final si la hay, para no duplicarla al construir rutas
  const clean = url.replace(/\/$/, '');
  await chrome.storage.local.set({ dashboardUrl: clean });
}
