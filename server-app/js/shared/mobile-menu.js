// js/shared/mobile-menu.js
// Menú kebab de móvil. No implementa ninguna lógica propia: cada opción
// reenvía el clic al botón de escritorio correspondiente (que sigue
// existiendo en el DOM, solo oculto visualmente por CSS). Así drag.js,
// boxes.js y demás no necesitan saber que existe una versión móvil —
// si mañana cambia su comportamiento, el kebab lo hereda gratis.

export function initMobileMenu() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const dropdown = document.getElementById('mobileMenuDropdown');
  if (!menuBtn || !dropdown) return;

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Reflejar el estado actual de "Editar"/"Finalizar edición" cada vez
    // que se abre, leyendo el botón real de escritorio.
    const desktopText = document.getElementById('dragText')?.textContent || 'Editar';
    document.getElementById('mobileDragText').textContent = desktopText;
    dropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#mobileMenuDropdown') && !e.target.closest('#mobileMenuBtn')) {
      dropdown.classList.add('hidden');
    }
  });

  const proxies = [
    ['mobileEditBtn', 'toggleDragBtn'],
    ['mobileNewBoxBtn', 'newBoxBtn'],
    ['mobileCreateNoteBtn', 'createNoteBtn'],
    ['mobileProfileBtn', 'profileOrb'],
    ['mobileLogoutBtn', 'logoutBtn']
  ];

  proxies.forEach(([mobileId, desktopId]) => {
    document.getElementById(mobileId)?.addEventListener('click', () => {
      dropdown.classList.add('hidden');
      document.getElementById(desktopId)?.click();
    });
  });
}
