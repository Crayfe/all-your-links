// js/shared/grid-layout.js
// Construye un valor de grid-template-columns a partir de un número de
// columnas y una proporción de anchos. Compartido entre los dashboards
// de tipo "Grid personalizable" y las cajas contenedoras, que usan
// exactamente el mismo mecanismo para su disposición interna.

export function buildGridTemplate(columns, ratio) {
  if (ratio === 'equal' || columns < 2) return `repeat(${columns}, 1fr)`;

  const parts = ratio.split(':').map(Number);
  // Si se cambia el número de columnas después de elegir una proporción
  // pensada para otro número, se recorta o rellena con 1fr en vez de
  // romper — más previsible que un error.
  const fractions = [];
  for (let i = 0; i < columns; i++) fractions.push(parts[i] ?? 1);
  return fractions.map(f => `${f}fr`).join(' ');
}
