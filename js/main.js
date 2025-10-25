// main.js
import { showSection } from './ui.js';

// --- Navegación entre vistas ---
const enlacesBtn = document.getElementById('enlacesBtn');
const perfilBtn = document.getElementById('perfilBtn');

const enlacesSection = document.getElementById('enlacesSection');
const profileSection = document.getElementById('profileSection');

document.addEventListener('DOMContentLoaded', () => {
  // Event listeners para el menú lateral y el orb
  enlacesBtn.addEventListener('click', () => showSection(enlacesSection));
  perfilBtn.addEventListener('click', () => showSection(profileSection));
  document.getElementById('profileOrb').addEventListener('click', () => showSection(profileSection));
});

// --- Background personalizado ---
import { showToast } from './ui.js';

const bgUpload = document.getElementById('bgUpload');
const removeBg = document.getElementById('removeBg');
const targetElement = document.body;
const DEFAULT_BG_CLASS = 'bg-gray-100 dark:bg-gray-900';

function applyBackground(imgData) {
  // Primero, limpiamos las propiedades de fondo para evitar conflictos
  targetElement.style.backgroundImage = '';
  targetElement.style.backgroundSize = '';
  targetElement.style.backgroundPosition = '';
  targetElement.style.backgroundRepeat = '';
  
  // Limpiamos las clases de fondo por defecto
  targetElement.classList.remove('bg-gray-100', 'dark:bg-gray-900');

  if (imgData) {
    // Aplicamos la imagen personalizada
    targetElement.style.backgroundImage = `url(${imgData})`;
    targetElement.style.backgroundSize = 'cover';       // <-- CLAVE: Escala para cubrir toda el área
    targetElement.style.backgroundPosition = 'center'; // Centra la imagen
    targetElement.style.backgroundRepeat = 'no-repeat';
  } else {
    // Si no hay imagen, volvemos al fondo por defecto
    targetElement.classList.add('bg-gray-100', 'dark:bg-gray-900');
  }
}

document.addEventListener('DOMContentLoaded', () => {

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
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const menuTitle = document.getElementById('menuTitle');
    const linkTexts = document.querySelectorAll('.sidebar-link-text');
    const actionButtons = document.querySelectorAll('#sidebar nav button');
    
    function toggleSidebar() {
        const isExpanded = sidebar.classList.toggle('is-expanded');

        if (isExpanded) {
            menuTitle.classList.remove('hidden');
        } else {
            menuTitle.classList.add('hidden');
        }

        linkTexts.forEach(span => {
            if (isExpanded) {
                span.classList.remove('hidden');
            } else {
                setTimeout(() => {
                    span.classList.add('hidden');
                }, 300);
            }
        });
    }

    sidebar.addEventListener('click', (event) => {
        if (event.target.closest('button[data-action]') === null) {
            toggleSidebar();
        }
    });
});