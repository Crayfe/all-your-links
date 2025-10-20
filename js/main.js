// main.js
import { showSection } from './ui.js';

// --- Navegación entre vistas ---
const enlacesBtn = document.getElementById('enlacesBtn');
const noticiasBtn = document.getElementById('noticiasBtn');
const perfilBtn = document.getElementById('perfilBtn');

const enlacesSection = document.getElementById('enlacesSection');
const noticiasSection = document.getElementById('noticiasSection');
const profileSection = document.getElementById('profileSection');

document.addEventListener('DOMContentLoaded', () => {
  // Event listeners para el menú lateral y el orb
  enlacesBtn.addEventListener('click', () => showSection(enlacesSection));
  noticiasBtn.addEventListener('click', () => showSection(noticiasSection));
  perfilBtn.addEventListener('click', () => showSection(profileSection));
  document.getElementById('profileOrb').addEventListener('click', () => showSection(profileSection));
});


// --- Noticias con RSS (Xataka) ---
//const newsList = document.getElementById('newsList');

async function fetchNews() {
  newsList.innerHTML = '<p class="text-center text-gray-500">Cargando noticias...</p>';
  try {
    const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://xataka.com/feeds/rss2.0/');
    const data = await res.json();
    
    // VERIFICACIÓN CLAVE: Asegurarse de que 'data.items' exista y que 'data.status' sea 'ok'
    if (data.status !== 'ok' || !data.items) {
      newsList.innerHTML = '<p class="text-center text-red-500">Error al cargar noticias: La fuente RSS falló o está vacía.</p>'; 
      console.error('Error en la API de RSS:', data);
      return; // Detener la ejecución si hay un problema
    }

    newsList.innerHTML = ''; // Limpiar el mensaje de carga

    data.items.forEach(item => {
      // ... (El resto del código de renderizado sigue igual)
      // ...
      newsList.appendChild(card);
    });
  } catch (err) { 
    // Esto captura errores de red o JSON inválido
    newsList.innerHTML = '<p class="text-center text-red-500">Error de conexión o de formato al cargar noticias.</p>'; 
    console.error(err);
  }
}

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
  // Cargar noticias y background al inicio
  //fetchNews();

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
