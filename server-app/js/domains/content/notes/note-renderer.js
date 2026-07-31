// js/domains/content/notes/note-renderer.js
// Renderiza el contenido de una nota DIRECTAMENTE dentro de su caja del
// dashboard (la caja ES la nota, no hay lista ni contenedor intermedio).
//
// Las líneas de checklist (`- [ ] algo`, `* [ ] algo` o `+ [ ] algo` —
// los tres marcadores de lista son válidos en Markdown, y distintos
// editores usan uno u otro; Toast UI Editor, por ejemplo, no
// necesariamente serializa con guion) se detectan y renderizan como
// checkboxes reales de HTML, interactivos sin abrir ningún modal: al
// marcar/desmarcar se reescribe esa casilla concreta en el Markdown de
// la nota y se guarda al instante. El resto del contenido (títulos,
// negrita, tablas, imágenes, listas normales...) se delega en marked.js.

import { getNote, saveNote } from './notes-manager.js';
import { bus, EVENTS } from '../../../core/events.js';

// Acepta -, * o + como marcador de lista (los tres son válidos en
// CommonMark/GFM). Indentación con cualquier cantidad de espacios/tabs.
const CHECKBOX_RE = /^(\s*)[-*+]\s*\[([ xX])\]\s?(.*)$/;

/**
 * Divide el markdown en bloques: unos de checklist (procesados a mano
 * para tener checkboxes reales) y otros de markdown normal (delegados a
 * marked.js). Cada checkbox lleva su posición de aparición (0, 1, 2...)
 * entre TODAS las casillas de la nota — no su número de línea — para
 * poder localizarla de nuevo al alternarla, sin depender de que el
 * Markdown guardado conserve exactamente el mismo formato con el que se
 * generó (distintos editores reformatean espacios/saltos de línea).
 */
function renderNoteContent(markdown) {
  const lines = (markdown || '').split('\n');
  let html = '';
  let buffer = [];
  let checkboxIndex = 0;

  function flushBuffer() {
    if (buffer.length === 0) return;
    html += window.marked ? window.marked.parse(buffer.join('\n')) : buffer.join('\n');
    buffer = [];
  }

  lines.forEach((line) => {
    const match = line.match(CHECKBOX_RE);
    if (match) {
      flushBuffer();
      const [, indent, mark, text] = match;
      const checked = mark.toLowerCase() === 'x';
      html += `
        <label class="note-checkbox-item" style="padding-left:${indent.length * 0.8}em">
          <input type="checkbox" class="note-checkbox" data-cb-index="${checkboxIndex}" ${checked ? 'checked' : ''}>
          <span class="${checked ? 'note-checkbox-done' : ''}">${escapeHtml(text)}</span>
        </label>`;
      checkboxIndex++;
    } else {
      buffer.push(line);
    }
  });
  flushBuffer();

  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Alterna la N-ésima casilla de checklist de la nota (contando solo
 * líneas de checklist, en orden de aparición) entre marcada/desmarcada,
 * y guarda la nota actualizada.
 */
function toggleCheckboxAt(note, targetIndex) {
  const lines = note.content.split('\n');
  let seen = -1;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(CHECKBOX_RE);
    if (!match) continue;
    seen++;
    if (seen === targetIndex) {
      const newMark = match[2].toLowerCase() === 'x' ? ' ' : 'x';
      lines[i] = lines[i].replace(CHECKBOX_RE, `$1- [${newMark}] $3`);
      note.content = lines.join('\n');
      saveNote(note);
      return;
    }
  }
}

export function mountNoteBox(container, box) {
  // Recuerda qué versión de la nota se pintó por última vez, para no
  // repintar (destruir y recrear todo el contenido) cuando llega una
  // sincronización de fondo que no trajo ningún cambio real para ESTA
  // nota — eso es lo que causaba el parpadeo: cada ~20s, cualquier
  // escritura en CUALQUIER parte de la app disparaba un repintado
  // incondicional aquí, aunque esta nota en concreto siguiera exactamente
  // igual.
  let lastRenderedUpdatedAt = undefined;

  function render() {
    const note = box.noteId ? getNote(box.noteId) : null;
    const currentUpdatedAt = note?.updatedAt ?? null;

    if (currentUpdatedAt === lastRenderedUpdatedAt) return; // nada cambió, no tocar el DOM
    lastRenderedUpdatedAt = currentUpdatedAt;

    if (!note) {
      container.innerHTML = `<p class="note-box-empty">Esta nota está vacía. Usa el lápiz para escribir algo.</p>`;
      return;
    }

    container.innerHTML = `<div class="note-box-body markdown-preview">${renderNoteContent(note.content)}</div>`;

    container.querySelectorAll('.note-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const cbIndex = parseInt(cb.dataset.cbIndex, 10);
        toggleCheckboxAt(note, cbIndex);
        // Reflejar el tachado al instante sin esperar un repintado completo
        const span = cb.nextElementSibling;
        if (span) span.classList.toggle('note-checkbox-done', cb.checked);
        // El propio toggle actualiza note.updatedAt (dentro de saveNote) —
        // adelantamos aquí el registro para que el DATA_REFRESHED que esa
        // misma escritura provoque no dispare igualmente un repintado
        // completo innecesario del mismo cambio que ya se ve reflejado.
        lastRenderedUpdatedAt = note.updatedAt;
      });
    });
  }

  render();

  // Repintar si la nota cambia desde otro sitio (se editó en el modal,
  // o llegó una sincronización de fondo con datos nuevos del servidor) —
  // pero solo de verdad cuando el contenido cambió, gracias al chequeo
  // de arriba.
  const unsubscribe = bus.on(EVENTS.DATA_REFRESHED, render);

  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      unsubscribe();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
