// js/main.js

import { showSection, showToast } from './shared/ui.js';
import { initApp } from './app.js';
import { initSearch } from './features/search/search.js';
import { initDashboard } from './domains/dashboard/dashboard.js';
import { hideSearchView } from './features/search/internal-search.js';
import { initDataStore } from './core/data-manager.js';
import { initNativeEventsStore } from './domains/content/calendar/native-events.js';
import { initNotesStore } from './domains/content/notes/notes-manager.js';
import { initMobileMenu } from './shared/mobile-menu.js';
import { checkAuth, login, logout } from './core/auth-client.js';
import { applyBackground, initGlobalBackground, setGlobalDefaultBackground } from './shared/background.js';
import { uploadFile } from './core/upload-client.js';
import { getSetting, setSetting } from './core/settings-client.js';

// ========== LOGIN ==========

function showLoginScreen() {
  return new Promise((resolve) => {
    const screen   = document.getElementById('loginScreen');
    const form     = document.getElementById('loginForm');
    const errorEl  = document.getElementById('loginError');
    const userInput = document.getElementById('loginUsername');

    screen.classList.remove('hidden');
    userInput.focus();

    form.addEventListener('submit', async function handler(e) {
      e.preventDefault();
      const username = userInput.value.trim();
      const password = document.getElementById('loginPassword').value;
      const submitBtn = document.getElementById('loginSubmit');

      errorEl.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Entrando...';

      const result = await login(username, password);

      if (result.ok) {
        form.removeEventListener('submit', handler);
        screen.classList.add('hidden');
        resolve();
      } else {
        errorEl.textContent = result.error;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar';
        document.getElementById('loginPassword').value = '';
      }
    });
  });
}

// ========== FONDO PERSONALIZADO ==========

// ========== INICIALIZACIÓN ==========

document.addEventListener('DOMContentLoaded', async () => {
  // ----- Autenticación -----
  // Bloquea el resto del arranque hasta que haya una sesión válida: o ya
  // existía (cookie de una visita anterior) o el usuario acaba de
  // iniciarla en la pantalla de login.
  const existingUser = await checkAuth();
  if (!existingUser) {
    await showLoginScreen();
  }

  // ----- Arranque del almacén de datos -----
  // Debe completarse antes que nada más: carga desde el servidor (o cae
  // a la caché local si no hay conexión) y deja lista la caché en
  // memoria que usan initApp/initDashboard y todo lo demás.
  await initDataStore();

  // Eventos propios de calendario: mismo patrón, caché+servidor. Antes
  // de este fix vivían solo en localStorage y no llegaban al servidor
  // hasta un export/import manual — por eso se perdían entre dispositivos.
  await initNativeEventsStore();

  // Notas: mismo patrón (caché en memoria + servidor + localStorage offline)
  await initNotesStore();

  // Fondo global (Perfil): se carga ANTES de initApp/initDashboard para
  // que esté ya en caché cuando se pinte el primer dashboard — si no,
  // el primer render podría no encontrar el respaldo global todavía
  // listo y mostrarse un instante sin fondo hasta que llegue.
  await initGlobalBackground();

  // ----- Módulos -----
  initApp();
  initSearch();
  initDashboard();
  initMobileMenu();

  // ----- Sidebar -----
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  const profileSection = document.getElementById('profileSection');

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('sidebar-expanded');
    sidebar.classList.toggle('sidebar-collapsed');
  });

  document.getElementById('profileOrb').addEventListener('click', () => { hideSearchView(); showSection(profileSection); });

  // ----- Fondo personalizado (ajustes de Perfil) -----
  // La imagen vive en el servidor (server/uploads/), y solo guardamos su
  // URL — ni el archivo en sí ni un blob base64 gigante en localStorage.
  // La URL se sincroniza vía /api/settings, así que viaja entre
  // dispositivos: la subes una vez y aparece en cualquier otro sitio
  // donde inicies sesión. Este es el fondo GLOBAL (Perfil), que actúa de
  // respaldo para cualquier dashboard sin fondo propio (ver
  // shared/background.js y app.js).
  const BG_CACHE_KEY = 'customBackgroundUrl';

  document.getElementById('bgUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    let url;
    try {
      url = await uploadFile(file);
    } catch (err) {
      showToast(err.message || 'No se pudo subir la imagen', 'error');
      return;
    }

    applyBackground(url);
    setGlobalDefaultBackground(url);
    localStorage.setItem(BG_CACHE_KEY, url);

    try {
      await setSetting('customBackgroundUrl', url);
      showToast('Fondo aplicado', 'success');
    } catch {
      showToast('Fondo aplicado localmente, pero no se pudo sincronizar con el servidor', 'info');
    }
  });

  document.getElementById('removeBg').addEventListener('click', async () => {
    applyBackground(null);
    setGlobalDefaultBackground(null);
    localStorage.removeItem(BG_CACHE_KEY);
    try {
      await setSetting('customBackgroundUrl', '');
    } catch { /* se sincronizará la próxima vez que haya conexión */ }
    showToast('Fondo eliminado', 'success');
  });

  // ----- Widget de clima: API key -----
  // Mismo patrón que el fondo: se sincroniza con el servidor vía
  // /api/settings, así que no hay que volver a escribirla en cada
  // dispositivo. localStorage queda solo como caché para arrancar rápido
  // y para seguir funcionando si el servidor no responde en ese momento.
  const weatherApiKeyInput = document.getElementById('weatherApiKey');
  weatherApiKeyInput.value = localStorage.getItem('weatherApiKey') || '';
  try {
    const serverValue = await getSetting('weatherApiKey');
    if (serverValue !== null) {
      weatherApiKeyInput.value = serverValue;
      localStorage.setItem('weatherApiKey', serverValue);
    }
  } catch { /* sin conexión: se queda con lo que hubiera en caché local */ }

  let weatherKeySaveTimeout = null;
  weatherApiKeyInput.addEventListener('input', () => {
    clearTimeout(weatherKeySaveTimeout);
    weatherKeySaveTimeout = setTimeout(async () => {
      const value = weatherApiKeyInput.value.trim();
      localStorage.setItem('weatherApiKey', value);
      localStorage.removeItem('weather_cache'); // forzar refresco con la nueva key
      try {
        await setSetting('weatherApiKey', value);
        showToast('API key de clima guardada', 'success');
      } catch {
        showToast('Guardada localmente; se sincronizará cuando haya conexión', 'info');
      }
    }, 600);
  });

  // ----- Widget de calendario: Client ID -----
  const googleClientIdInput = document.getElementById('googleClientId');
  googleClientIdInput.value = localStorage.getItem('googleClientId') || '';
  try {
    const serverValue = await getSetting('googleClientId');
    if (serverValue !== null) {
      googleClientIdInput.value = serverValue;
      localStorage.setItem('googleClientId', serverValue);
    }
  } catch { /* sin conexión: caché local */ }

  let clientIdSaveTimeout = null;
  googleClientIdInput.addEventListener('input', () => {
    clearTimeout(clientIdSaveTimeout);
    clientIdSaveTimeout = setTimeout(async () => {
      const value = googleClientIdInput.value.trim();
      localStorage.setItem('googleClientId', value);
      try {
        await setSetting('googleClientId', value);
        showToast('Client ID de Google guardado', 'success');
      } catch {
        showToast('Guardado localmente; se sincronizará cuando haya conexión', 'info');
      }
    }, 600);
  });

  // ----- Widget de RSS: API key de rss2json -----
  const rssApiKeyInput = document.getElementById('rssApiKey');
  rssApiKeyInput.value = localStorage.getItem('rssApiKey') || '';
  try {
    const serverValue = await getSetting('rssApiKey');
    if (serverValue !== null) {
      rssApiKeyInput.value = serverValue;
      localStorage.setItem('rssApiKey', serverValue);
    }
  } catch { /* sin conexión: caché local */ }

  let rssKeySaveTimeout = null;
  rssApiKeyInput.addEventListener('input', () => {
    clearTimeout(rssKeySaveTimeout);
    rssKeySaveTimeout = setTimeout(async () => {
      const value = rssApiKeyInput.value.trim();
      localStorage.setItem('rssApiKey', value);
      try {
        await setSetting('rssApiKey', value);
        showToast('API key de RSS guardada', 'success');
      } catch {
        showToast('Guardada localmente; se sincronizará cuando haya conexión', 'info');
      }
    }, 600);
  });

  // ----- Cerrar sesión -----
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await logout();
    window.location.reload();
  });
});
