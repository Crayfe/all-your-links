// js/shared/background.js
// Aplica el fondo de la página, y mantiene en caché el fondo global por
// defecto (el de Perfil → Configuración) para que cualquier dashboard
// sin fondo propio pueda usarlo como respaldo, sin tener que volver a
// pedirlo al servidor en cada cambio de dashboard.

import { getSetting } from '../core/settings-client.js';

const BG_CACHE_KEY = 'customBackgroundUrl';
let _globalDefaultBg = null;

export function applyBackground(imgData) {
  const body = document.body;
  body.style.backgroundImage = '';
  body.style.backgroundSize = '';
  body.style.backgroundPosition = '';
  body.style.backgroundRepeat = '';
  body.classList.remove('bg-gray-100', 'dark:bg-gray-900');
  if (imgData) {
    body.style.backgroundImage = `url(${imgData})`;
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundRepeat = 'no-repeat';
  } else {
    body.classList.add('bg-gray-100', 'dark:bg-gray-900');
  }
}

/**
 * Carga y aplica el fondo global (Perfil → Configuración), y lo deja en
 * caché para que applyDashboardBackground() pueda usarlo de respaldo sin
 * red. Se llama una vez al arrancar la app.
 */
export async function initGlobalBackground() {
  try {
    const serverBgUrl = await getSetting('customBackgroundUrl');
    _globalDefaultBg = serverBgUrl || null;
    if (serverBgUrl) {
      applyBackground(serverBgUrl);
      localStorage.setItem(BG_CACHE_KEY, serverBgUrl);
    } else {
      localStorage.removeItem(BG_CACHE_KEY);
    }
  } catch {
    // Sin conexión al arrancar: usar lo último que sepamos localmente
    const cachedBgUrl = localStorage.getItem(BG_CACHE_KEY);
    _globalDefaultBg = cachedBgUrl || null;
    if (cachedBgUrl) applyBackground(cachedBgUrl);
  }
}

export function setGlobalDefaultBackground(url) {
  _globalDefaultBg = url || null;
}

/**
 * Aplica el fondo del dashboard indicado si tiene uno propio; si no,
 * cae al fondo global (Perfil), y si tampoco hay, quita cualquier fondo.
 * Se llama cada vez que se cambia o repinta un dashboard.
 */
export function applyDashboardBackground(dashboard) {
  applyBackground(dashboard?.backgroundUrl || _globalDefaultBg || null);
}
