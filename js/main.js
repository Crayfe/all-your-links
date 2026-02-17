// main.js
import { showSection } from './ui.js';
import { showToast } from './ui.js';

function applyBackground(imgData) {
  const targetElement = document.body;

  targetElement.style.backgroundImage = '';
  targetElement.style.backgroundSize = '';
  targetElement.style.backgroundPosition = '';
  targetElement.style.backgroundRepeat = '';
  targetElement.classList.remove('bg-gray-100', 'dark:bg-gray-900');
  if (imgData) {
    targetElement.style.backgroundImage = `url(${imgData})`;
    targetElement.style.backgroundSize = 'cover';
    targetElement.style.backgroundPosition = 'center';
    targetElement.style.backgroundRepeat = 'no-repeat';
  } else {
    targetElement.classList.add('bg-gray-100', 'dark:bg-gray-900');
  }
}
document.addEventListener('DOMContentLoaded', () => {
  
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  const linkTexts = document.querySelectorAll('.sidebar-link-text');

  const enlacesBtn = document.getElementById('enlacesBtn');
  const perfilBtn = document.getElementById('perfilBtn');
  const enlacesSection = document.getElementById('enlacesSection');
  const profileSection = document.getElementById('profileSection');

  const bgUpload = document.getElementById('bgUpload');
  const removeBg = document.getElementById('removeBg');
    
  function toggleSidebar() {
    sidebar.classList.toggle('sidebar-expanded');
    sidebar.classList.toggle('sidebar-collapsed');
  }

  toggleBtn.addEventListener('click', toggleSidebar);

  enlacesBtn.addEventListener('click', () => showSection(enlacesSection));
  perfilBtn.addEventListener('click', () => showSection(profileSection));
  document.getElementById('profileOrb').addEventListener('click', () => showSection(profileSection));

  const savedBg = localStorage.getItem('customBackground');
  if (savedBg) applyBackground(savedBg);

  bgUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      localStorage.setItem('customBackground', ev.target.result);
      applyBackground(ev.target.result);
      showToast('Background aplicado', 'success');
    }
    reader.readAsDataURL(file);
  });

  removeBg.addEventListener('click', () => {
    localStorage.removeItem('customBackground');
    applyBackground(null);
    showToast('Background eliminado', 'success');
  });
});