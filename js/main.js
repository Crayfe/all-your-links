// js/main.js

import { showSection, showToast } from './ui.js';
import { initLinks } from './links.js';
import { initSearch } from './search.js';

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
  initLinks();
  initSearch();

  // ----- Sidebar -----
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  const enlacesSection = document.getElementById('enlacesSection');
  const profileSection = document.getElementById('profileSection');

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('sidebar-expanded');
    sidebar.classList.toggle('sidebar-collapsed');
  });

  document.getElementById('enlacesBtn').addEventListener('click', () => showSection(enlacesSection));
  document.getElementById('perfilBtn').addEventListener('click', () => showSection(profileSection));
  document.getElementById('profileOrb').addEventListener('click', () => showSection(profileSection));

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
});
