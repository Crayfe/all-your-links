// js/core/edit-mode.js
// Estado mínimo y compartido de si el modo edición está activo ahora
// mismo. Vive en su propio módulo neutral (no en drag.js) porque
// data-manager.js necesita consultarlo para pausar los refrescos de
// fondo mientras editas, y drag.js ya depende de data-manager.js —
// si data-manager.js importara directamente de drag.js, se formaría
// una dependencia circular entre ambos.

let _editModeActive = false;

export function setEditMode(active) {
  _editModeActive = active;
}

export function isEditModeActive() {
  return _editModeActive;
}
