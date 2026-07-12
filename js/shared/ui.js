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
 * Alterna la visibilidad del menú de opciones.
 * @param {string} id - El ID del elemento (puede ser boxId o itemId).
 * @param {string} type - Tipo de menú: 'box' o 'item' (opcional, se autodetecta).
 */

export function toggleMenu(id, type = null) {
  // Ocultar todos los menús primero
  document.querySelectorAll('.menu-options').forEach(el => el.classList.add('hidden'));
  
  // Intentar encontrar el menú (puede ser box-menu-ID o menu-ID)
  let menu = document.getElementById(`box-menu-${id}`);
  if (!menu) {
    menu = document.getElementById(`menu-${id}`);
  }
  
  if (menu) {
    menu.classList.toggle('hidden');
  } else {
    console.warn(`No se encontró menú para ID: ${id}`);
  }
}

// Ocultar menús al hacer clic fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-container') && 
      !e.target.closest('.box-menu-btn') && 
      !e.target.closest('.item-menu-btn')) {
    document.querySelectorAll('.menu-options').forEach(el => el.classList.add('hidden'));
  }
});
