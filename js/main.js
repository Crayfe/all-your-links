// js/main.js

import { showSection, showToast } from './shared/ui.js';
import { initApp } from './app.js';
import { initSearch } from './features/search/search.js';
import { initDashboard } from './domains/dashboard/dashboard.js';
import { hideSearchView } from './features/search/internal-search.js';

// ========== FONDO PERSONALIZADO ==========

function applyBackground(imgData) {
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

// ========== INICIALIZACIÓN ==========

document.addEventListener('DOMContentLoaded', () => {
  // ----- Módulos -----
  initApp();
  initSearch();
  initDashboard();

  // ----- Sidebar -----
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  const profileSection = document.getElementById('profileSection');

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('sidebar-expanded');
    sidebar.classList.toggle('sidebar-collapsed');
  });

  document.getElementById('profileOrb').addEventListener('click', () => { hideSearchView(); showSection(profileSection); });

  // ----- Fondo personalizado -----
  const savedBg = localStorage.getItem('customBackground');
  if (savedBg) applyBackground(savedBg);

  document.getElementById('bgUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      localStorage.setItem('customBackground', ev.target.result);
      applyBackground(ev.target.result);
      showToast('Background aplicado', 'success');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('removeBg').addEventListener('click', () => {
    localStorage.removeItem('customBackground');
    applyBackground(null);
    showToast('Background eliminado', 'success');
  });

  // ----- Widget de clima: API key -----
  const weatherApiKeyInput = document.getElementById('weatherApiKey');
  weatherApiKeyInput.value = localStorage.getItem('weatherApiKey') || '';
  let weatherKeySaveTimeout = null;
  weatherApiKeyInput.addEventListener('input', () => {
    clearTimeout(weatherKeySaveTimeout);
    weatherKeySaveTimeout = setTimeout(() => {
      localStorage.setItem('weatherApiKey', weatherApiKeyInput.value.trim());
      localStorage.removeItem('weather_cache'); // forzar refresco con la nueva key
      showToast('API key de clima guardada', 'success');
    }, 600);
  });

  // ----- Widget de calendario: Client ID -----
  const googleClientIdInput = document.getElementById('googleClientId');
  googleClientIdInput.value = localStorage.getItem('googleClientId') || '';
  let clientIdSaveTimeout = null;
  googleClientIdInput.addEventListener('input', () => {
    clearTimeout(clientIdSaveTimeout);
    clientIdSaveTimeout = setTimeout(() => {
      localStorage.setItem('googleClientId', googleClientIdInput.value.trim());
      showToast('Client ID de Google guardado', 'success');
    }, 600);
  });

  // ----- Widget de RSS: API key de rss2json -----
  const rssApiKeyInput = document.getElementById('rssApiKey');
  rssApiKeyInput.value = localStorage.getItem('rssApiKey') || '';
  let rssKeySaveTimeout = null;
  rssApiKeyInput.addEventListener('input', () => {
    clearTimeout(rssKeySaveTimeout);
    rssKeySaveTimeout = setTimeout(() => {
      localStorage.setItem('rssApiKey', rssApiKeyInput.value.trim());
      showToast('API key de RSS guardada', 'success');
    }, 600);
  });
});
