// ui.js

// --- 1. Toast de Notificación ---
export const toast = document.getElementById('toast');

/**
 * Muestra una notificación temporal.
 * @param {string} message - El mensaje a mostrar.
 * @param {'success'|'error'|'info'} type - El tipo de notificación.
 */
export function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.classList.remove('hidden', 'opacity-0');
  toast.classList.add('opacity-100');
  toast.style.backgroundColor = type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#1f2937';
  
  setTimeout(() => {
    toast.classList.remove('opacity-100'); 
    toast.classList.add('opacity-0'); 
    setTimeout(() => toast.classList.add('hidden'), 500);
  }, 2500);
}


// --- 2. Navegación entre Vistas ---
const enlacesSection = document.getElementById('enlacesSection');
const profileSection = document.getElementById('profileSection');

/**
 * Muestra solo una sección y oculta las demás.
 * @param {HTMLElement} sec - La sección HTML a mostrar.
 */
export function showSection(sec) {
  enlacesSection.classList.add('hidden');
  profileSection.classList.add('hidden');
  sec.classList.remove('hidden');
}


// --- 3. Menú Flotante de Opciones ---
/**
 * Alterna la visibilidad del menú de opciones de un enlace.
 * @param {number} index - El índice del enlace.
 */
export function toggleMenu(index) {
  // Ocultar todos los menús primero (para evitar que se solapen)
  document.querySelectorAll('.menu-options').forEach(el => el.classList.add('hidden'));
  
  // Mostrar el menú deseado
  const menu = document.getElementById(`menu-${index}`);
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

// Ocultar menús al hacer clic fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-container')) {
    document.querySelectorAll('.menu-options').forEach(el => el.classList.add('hidden'));
  }
});
