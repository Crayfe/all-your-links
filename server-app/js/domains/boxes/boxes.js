// js/boxes.js
// Gestión de cajas: CRUD, modal y lógica de personalización visual

import { showToast } from '../../shared/ui.js';
import { bus, EVENTS } from '../../core/events.js';
import {
  getActiveWorkspace,
  getBoxesByWorkspace,
  getBox,
  getItemsByBox,
  saveBox,
  deleteBox as deleteBoxFromStorage,
  getDashboards
} from '../../core/data-manager.js';
import { createBox } from '../../core/data-model.js';
import { getCurrentDashboardId } from '../dashboard/dashboard.js';
import { createNote, saveNote as saveNoteRecord, deleteNote, getNote } from '../content/notes/notes-manager.js';
import { buildGridTemplate } from '../../shared/grid-layout.js';

// ========== PESTAÑAS DEL MODAL (Propiedades / Nota) ==========
// Solo se muestran para cajas de tipo 'note'. El lápiz de una nota entra
// directamente en la pestaña "Nota"; "Editar caja" (menú ⋯) entra en
// "Propiedades" primero. Ambas pestañas están siempre disponibles desde
// cualquiera de las dos entradas, solo cambia cuál se ve primero.

let noteEditorInstance = null;

function destroyNoteEditor() {
  if (noteEditorInstance) {
    noteEditorInstance.destroy();
    noteEditorInstance = null;
  }
}

function initNoteEditorIfNeeded(initialMarkdown) {
  if (noteEditorInstance) return; // ya montado, no recrear
  const container = document.getElementById('noteEditorContainer');
  if (!container || !window.toastui) return;

  noteEditorInstance = new window.toastui.Editor({
    el: container,
    height: '360px',
    initialEditType: 'wysiwyg',
    previewStyle: 'tab',
    initialValue: initialMarkdown || '',
    hideModeSwitch: false,
    theme: 'dark',
    toolbarItems: [
      ['heading', 'bold', 'italic', 'strike'],
      ['hr', 'quote'],
      ['ul', 'ol', 'task', 'indent', 'outdent'],
      ['table', 'image', 'link'],
      ['code', 'codeblock'],
      [
        {
          name: 'underline',
          tooltip: 'Subrayado',
          text: 'U',
          className: 'toastui-editor-toolbar-icons note-toolbar-custom-btn note-toolbar-btn-underline',
          command: 'underline'
        },
        {
          name: 'highlight',
          tooltip: 'Resaltar',
          text: 'H',
          className: 'toastui-editor-toolbar-icons note-toolbar-custom-btn note-toolbar-btn-highlight',
          command: 'highlight'
        }
      ]
    ]
  });

  // El Markdown estándar no tiene sintaxis propia para subrayado ni
  // resaltado — se consiguen envolviendo el texto seleccionado en
  // etiquetas HTML (<u>, <mark>), que Markdown deja pasar tal cual y el
  // navegador interpreta de forma nativa. addCommand registra la acción
  // que ejecuta cada botón de arriba.
  noteEditorInstance.addCommand('markdown', 'underline', () => {
    const selected = noteEditorInstance.getSelectedText();
    if (selected) noteEditorInstance.replaceSelection(`<u>${selected}</u>`);
    return true;
  });
  noteEditorInstance.addCommand('wysiwyg', 'underline', () => {
    const selected = noteEditorInstance.getSelectedText();
    if (selected) noteEditorInstance.replaceSelection(`<u>${selected}</u>`);
    return true;
  });
  noteEditorInstance.addCommand('markdown', 'highlight', () => {
    const selected = noteEditorInstance.getSelectedText();
    if (selected) noteEditorInstance.replaceSelection(`<mark>${selected}</mark>`);
    return true;
  });
  noteEditorInstance.addCommand('wysiwyg', 'highlight', () => {
    const selected = noteEditorInstance.getSelectedText();
    if (selected) noteEditorInstance.replaceSelection(`<mark>${selected}</mark>`);
    return true;
  });
}

function showPropsTab() {
  document.getElementById('boxPanelProps').classList.remove('hidden');
  document.getElementById('boxPanelNote').classList.add('hidden');
  document.getElementById('boxTabProps').classList.add('box-modal-tab-active');
  document.getElementById('boxTabNote').classList.remove('box-modal-tab-active');
}

function showNoteTab() {
  document.getElementById('boxPanelProps').classList.add('hidden');
  document.getElementById('boxPanelNote').classList.remove('hidden');
  document.getElementById('boxTabNote').classList.add('box-modal-tab-active');
  document.getElementById('boxTabProps').classList.remove('box-modal-tab-active');
  // El editor necesita el contenedor ya visible para medir su tamaño
  const existingNote = getEditingNote();
  initNoteEditorIfNeeded(existingNote?.content || '');
}

function getEditingNote() {
  const modal = document.getElementById('newBoxModal');
  const boxId = modal.dataset.editingBoxId;
  if (!boxId) return null;
  const box = getBox(boxId);
  return box?.noteId ? getNote(box.noteId) : null;
}

// ========== CONFLICTO AL CAMBIAR DE TIPO ==========
// Cambiar el layout de una caja que ya tiene contenido de un tipo
// incompatible (enlaces guardados, o una nota con texto) no borra ese
// contenido — solo deja de mostrarse mientras la caja sea de otro tipo.
// Se avisa igual que al eliminar una caja o un dashboard, para que no
// sea una sorpresa silenciosa.

function boxHasIncompatibleContent(box, newLayout) {
  if (!box || box.layout === newLayout) return false;

  if (box.layout === 'note') {
    const note = box.noteId ? getNote(box.noteId) : null;
    return !!(note && note.content && note.content.trim().length > 0);
  }
  return getItemsByBox(box.id).length > 0;
}

function describeExistingContent(box) {
  if (box.layout === 'note') return 'el contenido de esta nota';
  const count = getItemsByBox(box.id).length;
  return `${count} enlace${count !== 1 ? 's' : ''} guardado${count !== 1 ? 's' : ''}`;
}

// ========== CONTENEDORES ==========
// Solo un nivel: un contenedor no puede pertenecer a otro (evita anidar
// contenedores dentro de contenedores, que complicaría mucho el CSS y
// la prevención de ciclos para poco beneficio real).

function getDescendantBoxIds(boxId, workspaceId) {
  const all = getBoxesByWorkspace(workspaceId);
  const descendants = new Set();
  let frontier = [boxId];
  while (frontier.length > 0) {
    const next = all.filter(b => frontier.includes(b.parentBoxId)).map(b => b.id);
    next.forEach(id => descendants.add(id));
    frontier = next;
  }
  return descendants;
}

function populateParentBoxSelect(workspaceId, excludeBoxId) {
  const select = document.getElementById('newBoxParent');
  const currentValue = select.value;
  select.innerHTML = '<option value="">Ninguno (nivel superior del dashboard)</option>';

  const excluded = excludeBoxId ? getDescendantBoxIds(excludeBoxId, workspaceId) : new Set();
  if (excludeBoxId) excluded.add(excludeBoxId);

  getBoxesByWorkspace(workspaceId)
    .filter(b => b.layout === 'container' && !excluded.has(b.id))
    .forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.title || '(contenedor sin título)';
      select.appendChild(opt);
    });

  select.value = currentValue; // conserva la selección si sigue siendo válida
}

// ========== HELPERS MODAL ==========

export function updateLayoutOptions(layout) {
  document.getElementById('layoutOptionsGrid').classList.toggle('hidden', layout !== 'grid' && layout !== 'reference');
  document.getElementById('layoutOptionsOrbs').classList.toggle('hidden', layout !== 'orbs');
  document.getElementById('layoutOptionsList').classList.toggle('hidden', layout !== 'list');
  document.getElementById('layoutOptionsStats').classList.toggle('hidden', layout !== 'widget-stats');
  document.getElementById('layoutOptionsRss').classList.toggle('hidden', layout !== 'widget-rss');
  document.getElementById('layoutOptionsContainer').classList.toggle('hidden', layout !== 'container');
  // Un contenedor no puede pertenecer a otro contenedor (solo un nivel)
  document.getElementById('parentBoxSection').classList.toggle('hidden', layout === 'container');

  document.getElementById('boxModalTabs').classList.toggle('hidden', layout !== 'note');
  document.getElementById('deleteNoteFromBoxModal').classList.toggle('hidden', layout !== 'note' || !document.getElementById('newBoxModal').dataset.editingBoxId);

  const titleInput = document.getElementById('newBoxTitle');
  const isWidget = layout === 'widget-clock' || layout === 'widget-calendar' || layout === 'widget-stats' || layout === 'widget-rss';
  titleInput.placeholder = isWidget ? 'Opcional — se asigna un nombre automático' : layout === 'note' ? 'Título de la nota (opcional)' : 'Ej: Favoritos, Herramientas...';

  // La sección de color/tamaño de texto no aplica a los widgets de solo
  // visualización (reloj, calendario, stats, RSS no tienen "enlaces" ni
  // "texto" configurable aquí — cada uno gestiona su propio estilo). Para
  // notas, la misma sección pasa a llamarse "Texto" y controla el color/
  // tamaño del contenido de la nota en vez de los enlaces.
  const linkTextSection = document.getElementById('linkTextSection');
  const linkSectionLabel = document.getElementById('linkSectionLabel');
  linkTextSection.classList.toggle('hidden', isWidget);
  linkSectionLabel.textContent = layout === 'note' ? 'Texto' : 'Enlaces';
}

function populateDashboardSelect(currentWorkspaceId) {
  const select = document.getElementById('newBoxDashboard');
  if (!select) return;
  const dashboards = getDashboards().sort((a, b) => a.order - b.order);
  select.innerHTML = dashboards.map(db =>
    `<option value="${db.id}" ${db.id === currentWorkspaceId ? 'selected' : ''}>${db.name}</option>`
  ).join('');
}

export function resetBoxModal() {
  document.getElementById('newBoxTitle').value = '';
  document.getElementById('newBoxShowTitle').checked = true;
  document.getElementById('newBoxLayout').value = 'grid';
  document.getElementById('newBoxColSpan').value = '1';
  document.getElementById('newBoxTitleAlign').value = 'left';
  document.getElementById('newBoxTitleColor').value = '#f3f4f6';
  document.getElementById('newBoxTitleColorText').value = '#f3f4f6';
  document.getElementById('newBoxTitleFont').value = 'Inter';
  document.getElementById('newBoxLinkColor').value = '#ffffff';
  document.getElementById('newBoxLinkColorText').value = '#ffffff';
  document.getElementById('newBoxLinkFontSize').value = '14';
  document.getElementById('linkFontSizeVal').textContent = '14';
  document.getElementById('newBoxBgColor').value = '#000000';
  document.getElementById('newBoxBgColorText').value = '#000000';
  document.getElementById('newBoxBgOpacity').value = '70';
  document.getElementById('bgOpacityVal').textContent = '70';
  document.getElementById('newBoxGridCols').value = '2';
  document.getElementById('gridColsVal').textContent = '2';
  document.getElementById('newBoxOrbSize').value = '80';
  document.getElementById('orbSizeVal').textContent = '80';
  document.getElementById('newBoxStatsLimit').value = '5';
  document.getElementById('statsLimitVal').textContent = '5';
  document.getElementById('newBoxRssUrl').value = '';
  document.getElementById('newBoxRssCount').value = '8';
  document.getElementById('rssCountVal').textContent = '8';
  document.getElementById('newBoxContainerColumns').value = '2';
  document.getElementById('newBoxContainerRatio').value = 'equal';
  document.getElementById('newBoxParent').value = '';
  document.getElementById('newBoxListRowHeight').value = 'normal';
  showPropsTab();
  destroyNoteEditor();
  updateLayoutOptions('grid');
}

// ========== CRUD ==========

export function editBox(boxId, options = {}) {
  const box = getBox(boxId);
  if (!box) return;
  const newBoxModal = document.getElementById('newBoxModal');
  document.getElementById('boxModalTitle').textContent = 'Editar caja';
  document.getElementById('newBoxTitle').value = box.title;
  document.getElementById('newBoxShowTitle').checked = box.showTitle !== false;
  document.getElementById('newBoxLayout').value = box.layout || 'grid';
  document.getElementById('newBoxColSpan').value = box.colSpan || 1;
  document.getElementById('newBoxTitleAlign').value = box.titleAlign || 'left';
  document.getElementById('newBoxTitleColor').value = box.titleColor || '#f3f4f6';
  document.getElementById('newBoxTitleColorText').value = box.titleColor || '#f3f4f6';
  document.getElementById('newBoxTitleFont').value = box.titleFont || 'Inter';
  document.getElementById('newBoxLinkColor').value = box.linkColor || '#ffffff';
  document.getElementById('newBoxLinkColorText').value = box.linkColor || '#ffffff';
  const fontSize = box.linkFontSize || 14;
  document.getElementById('newBoxLinkFontSize').value = fontSize;
  document.getElementById('linkFontSizeVal').textContent = fontSize;
  const bgColor = box.bgColor || '#000000';
  const bgOpacity = Math.round((box.bgOpacity ?? 0.7) * 100);
  document.getElementById('newBoxBgColor').value = bgColor;
  document.getElementById('newBoxBgColorText').value = bgColor;
  document.getElementById('newBoxBgOpacity').value = bgOpacity;
  document.getElementById('bgOpacityVal').textContent = bgOpacity;
  const gridCols = box.gridCols || 2;
  document.getElementById('newBoxGridCols').value = gridCols;
  document.getElementById('gridColsVal').textContent = gridCols;
  const orbSize = box.orbSize || 80;
  document.getElementById('newBoxOrbSize').value = orbSize;
  document.getElementById('orbSizeVal').textContent = orbSize;
  document.getElementById('newBoxListRowHeight').value = box.listRowHeight || 'normal';
  const statsLimit = box.statsLimit || 5;
  document.getElementById('newBoxStatsLimit').value = statsLimit;
  document.getElementById('statsLimitVal').textContent = statsLimit;
  document.getElementById('newBoxRssUrl').value = box.rssFeedUrl || '';
  const rssCount = box.rssCount || 8;
  document.getElementById('newBoxRssCount').value = rssCount;
  document.getElementById('rssCountVal').textContent = rssCount;
  document.getElementById('newBoxContainerColumns').value = box.containerConfig?.columns || 2;
  document.getElementById('newBoxContainerRatio').value = box.containerConfig?.ratio || 'equal';
  populateParentBoxSelect(box.workspaceId, box.id);
  document.getElementById('newBoxParent').value = box.parentBoxId || '';
  updateLayoutOptions(box.layout || 'grid');
  populateDashboardSelect(box.workspaceId);
  newBoxModal.dataset.editingBoxId = boxId;
  newBoxModal.dataset.originalLayout = box.layout || 'grid';
  newBoxModal.classList.add('active');

  if (box.layout === 'note' && options.initialTab === 'note') {
    showNoteTab();
  } else {
    showPropsTab();
  }
}

export function deleteBox(boxId) {
  const box = getBox(boxId);
  if (!box) return;
  const items = getItemsByBox(boxId);

  const isContainer = box.layout === 'container';
  const children = isContainer
    ? getBoxesByWorkspace(box.workspaceId).filter(b => b.parentBoxId === boxId)
    : [];

  const confirmMsg = isContainer && children.length > 0
    ? `¿Eliminar el contenedor "${box.title}"? Sus ${children.length} caja(s) dentro no se borran, vuelven al nivel superior del dashboard.`
    : items.length > 0
    ? `¿Eliminar la caja "${box.title}" y sus ${items.length} enlaces?`
    : `¿Eliminar la caja "${box.title}"?`;

  if (confirm(confirmMsg)) {
    // El servidor libera a las hijas por cascada (ON DELETE SET NULL en
    // parent_box_id), pero el estado local en memoria no se entera solo
    // de eso — hay que reflejarlo aquí también, o la vista se queda
    // desincronizada (las hijas seguirían "escondidas" con un
    // parentBoxId que ya no existe) hasta la próxima recarga completa.
    children.forEach(child => {
      child.parentBoxId = null;
      saveBox(child);
    });

    deleteBoxFromStorage(boxId);
    const boxElement = document.querySelector(`.box-card[data-box-id="${boxId}"], .box-container[data-box-id="${boxId}"]`);
    if (boxElement) boxElement.remove();
    if (children.length > 0) bus.emit(EVENTS.DASHBOARD_RENDER, getCurrentDashboardId());
    showToast('Caja eliminada', 'success');
  }
}

// ========== MODAL ==========

export function initBoxModal() {
  const newBoxModal = document.getElementById('newBoxModal');
  const newBoxBtn   = document.getElementById('newBoxBtn');

  newBoxBtn?.addEventListener('click', () => {
    document.getElementById('boxModalTitle').textContent = 'Nueva caja';
    resetBoxModal();
    const currentId = getCurrentDashboardId();
    const workspaceId = currentId || getActiveWorkspace()?.id;
    populateDashboardSelect(workspaceId);
    populateParentBoxSelect(workspaceId, null);
    delete newBoxModal.dataset.editingBoxId;
    newBoxModal.classList.add('active');
  });

  document.getElementById('cancelNewBox').addEventListener('click', () => {
    newBoxModal.classList.remove('active');
  });

  newBoxModal.addEventListener('click', (e) => {
    if (e.target === newBoxModal) newBoxModal.classList.remove('active');
  });

  // Pestañas Propiedades / Nota
  document.getElementById('boxTabProps').addEventListener('click', showPropsTab);
  document.getElementById('boxTabNote').addEventListener('click', showNoteTab);

  // "Crear nota": siempre accesible, sin pasar por modo edición del
  // dashboard. Abre el modal ya con el tipo "Nota" y directamente en su
  // pestaña de edición, para escribir sin fricción.
  document.getElementById('createNoteBtn')?.addEventListener('click', () => {
    document.getElementById('boxModalTitle').textContent = 'Nueva nota';
    resetBoxModal();
    const currentId = getCurrentDashboardId();
    const workspaceId = currentId || getActiveWorkspace()?.id;
    populateDashboardSelect(workspaceId);
    populateParentBoxSelect(workspaceId, null);
    delete newBoxModal.dataset.editingBoxId;
    document.getElementById('newBoxLayout').value = 'note';
    updateLayoutOptions('note');
    newBoxModal.classList.add('active');
    showNoteTab();
  });

  document.getElementById('deleteNoteFromBoxModal').addEventListener('click', () => {
    const boxId = newBoxModal.dataset.editingBoxId;
    const box = boxId && getBox(boxId);
    if (!box || !box.noteId) return;
    if (!confirm('¿Eliminar esta nota? Esta acción no se puede deshacer.')) return;

    deleteNote(box.noteId);
    box.noteId = null;
    saveBox(box);
    bus.emit(EVENTS.DASHBOARD_RENDER, getCurrentDashboardId());
    newBoxModal.classList.remove('active');
    resetBoxModal();
    showToast('Nota eliminada', 'success');
  });

  document.getElementById('saveNewBox').addEventListener('click', async () => {
    const WIDGET_DEFAULT_TITLES = { 'widget-clock': 'Hora y Clima', 'widget-calendar': 'Calendario', 'widget-stats': 'Más usados', 'widget-rss': 'RSS', 'note': 'Nota sin título' };
    let title = document.getElementById('newBoxTitle').value.trim();
    const layout        = document.getElementById('newBoxLayout').value;
    const colSpan       = parseInt(document.getElementById('newBoxColSpan').value) || 1;
    const titleAlign    = document.getElementById('newBoxTitleAlign').value;
    const showTitle     = document.getElementById('newBoxShowTitle').checked;
    const titleColor    = document.getElementById('newBoxTitleColor').value;
    const titleFont     = document.getElementById('newBoxTitleFont').value;
    const linkColor     = document.getElementById('newBoxLinkColor').value;
    const linkFontSize  = parseInt(document.getElementById('newBoxLinkFontSize').value) || 14;
    const bgColor       = document.getElementById('newBoxBgColor').value;
    const bgOpacity     = parseInt(document.getElementById('newBoxBgOpacity').value) / 100;
    const gridCols      = parseInt(document.getElementById('newBoxGridCols').value) || 2;
    const orbSize       = parseInt(document.getElementById('newBoxOrbSize').value) || 80;
    const listRowHeight = document.getElementById('newBoxListRowHeight').value;
    const statsLimit    = parseInt(document.getElementById('newBoxStatsLimit').value) || 5;
    const rssFeedUrl    = document.getElementById('newBoxRssUrl').value.trim();
    const rssCount      = parseInt(document.getElementById('newBoxRssCount').value) || 8;
    const parentBoxId   = document.getElementById('newBoxParent').value || null;
    const containerConfig = layout === 'container'
      ? (() => {
          const columns = parseInt(document.getElementById('newBoxContainerColumns').value, 10);
          const ratio = document.getElementById('newBoxContainerRatio').value;
          return { columns, ratio, template: buildGridTemplate(columns, ratio) };
        })()
      : null;

    if (!title && WIDGET_DEFAULT_TITLES[layout]) {
      title = WIDGET_DEFAULT_TITLES[layout];
    }
    if (!title) { showToast('El nombre de la caja es obligatorio', 'error'); return; }
    const currentId = getCurrentDashboardId();
    let workspace = null;
    
    if (currentId) {
      workspace = { id: currentId }; 
    } else {
      workspace = getActiveWorkspace();
    }
    
    if (!workspace) { showToast('No hay dashboard activo', 'error'); return; }

    const selectedDashboardId = document.getElementById('newBoxDashboard').value;

    if (newBoxModal.dataset.editingBoxId) {
      const box = getBox(newBoxModal.dataset.editingBoxId);
      if (box) {
        // Aviso si el cambio de tipo deja contenido existente sin
        // mostrarse (no se borra nada, solo deja de verse mientras la
        // caja sea de otro tipo).
        if (boxHasIncompatibleContent(box, layout)) {
          const proceed = confirm(
            `Esta caja tiene ${describeExistingContent(box)}. Si cambias el tipo, dejarán de mostrarse (no se borran) hasta que vuelvas a este tipo. ¿Continuar?`
          );
          if (!proceed) return;
        }

        const moved = selectedDashboardId && selectedDashboardId !== box.workspaceId;
        let noteId = box.noteId;

        if (layout === 'note') {
          // Sembrar el editor con el contenido REAL existente si nunca se
          // visitó la pestaña "Nota" en esta sesión del modal — si no, al
          // entrar solo para cambiar otra cosa (p.ej. "Pertenece a") se
          // crea el editor en blanco y ese blanco sobrescribe la nota de
          // verdad al guardar, perdiendo lo que había escrito.
          const existingNote = box.noteId ? getNote(box.noteId) : null;
          initNoteEditorIfNeeded(existingNote?.content || '');
          const markdown = noteEditorInstance ? noteEditorInstance.getMarkdown() : '';
          if (existingNote) {
            existingNote.title = title;
            existingNote.content = markdown;
            saveNoteRecord(existingNote);
          } else {
            const newNote = createNote(title, markdown);
            // ESPERAR a que la nota exista de verdad en el servidor antes
            // de guardar la caja que la referencia (boxes.note_id tiene
            // clave foránea a notes.id) — si no se espera, la petición de
            // la caja puede llegar antes que la de la nota y la
            // inserción falla por la restricción, perdiéndose la caja en
            // la siguiente sincronización de fondo sin ningún aviso.
            await saveNoteRecord(newNote);
            noteId = newNote.id;
          }
        }

        // Si esta caja ERA un contenedor y deja de serlo, sus hijas no
        // se borran ni quedan huérfanas: se promueven al nivel superior
        // del dashboard (mismo criterio que al eliminar un contenedor).
        if (box.layout === 'container' && layout !== 'container') {
          const children = getBoxesByWorkspace(box.workspaceId).filter(b => b.parentBoxId === box.id);
          if (children.length > 0) {
            children.forEach(child => { child.parentBoxId = null; saveBox(child); });
            showToast(`${children.length} caja(s) del contenedor pasaron al nivel superior`, 'info');
          }
        }

        Object.assign(box, { title, layout, colSpan, titleAlign, showTitle, titleColor, titleFont,
          linkColor, linkFontSize, bgColor, bgOpacity, gridCols, orbSize, listRowHeight, statsLimit, rssFeedUrl, rssCount,
          noteId, parentBoxId, containerConfig, workspaceId: selectedDashboardId || box.workspaceId });
        saveBox(box);
        showToast(moved ? 'Caja movida al nuevo dashboard' : 'Caja actualizada', 'success');
      }
      delete newBoxModal.dataset.editingBoxId;
      delete newBoxModal.dataset.originalLayout;
    } else {
      const newBox = createBox(workspace.id, title);
      let noteId = null;

      if (layout === 'note') {
        initNoteEditorIfNeeded('');
        const markdown = noteEditorInstance ? noteEditorInstance.getMarkdown() : '';
        const newNote = createNote(title, markdown);
        // Mismo motivo que arriba: esperar a que la nota exista de
        // verdad en el servidor antes de guardar la caja que la enlaza.
        await saveNoteRecord(newNote);
        noteId = newNote.id;
      }

      Object.assign(newBox, { layout, colSpan, titleAlign, showTitle, titleColor, titleFont,
        linkColor, linkFontSize, bgColor, bgOpacity, gridCols, orbSize, listRowHeight, statsLimit, rssFeedUrl, rssCount, noteId,
        parentBoxId, containerConfig });
      newBox.order = getBoxesByWorkspace(workspace.id).length;
      saveBox(newBox);
      showToast('Caja creada', 'success');
    }

    bus.emit(EVENTS.DASHBOARD_RENDER, currentId);
    newBoxModal.classList.remove('active');
    resetBoxModal();
  });

  // Layout contextual
  document.getElementById('newBoxLayout').addEventListener('change', (e) => {
    updateLayoutOptions(e.target.value);
  });

  // Sliders con label en tiempo real
  document.getElementById('newBoxBgOpacity').addEventListener('input', (e) => {
    document.getElementById('bgOpacityVal').textContent = e.target.value;
  });
  document.getElementById('newBoxLinkFontSize').addEventListener('input', (e) => {
    document.getElementById('linkFontSizeVal').textContent = e.target.value;
  });
  document.getElementById('newBoxGridCols').addEventListener('input', (e) => {
    document.getElementById('gridColsVal').textContent = e.target.value;
  });
  document.getElementById('newBoxOrbSize').addEventListener('input', (e) => {
    document.getElementById('orbSizeVal').textContent = e.target.value;
  });
  document.getElementById('newBoxStatsLimit').addEventListener('input', (e) => {
    document.getElementById('statsLimitVal').textContent = e.target.value;
  });
  document.getElementById('newBoxRssCount').addEventListener('input', (e) => {
    document.getElementById('rssCountVal').textContent = e.target.value;
  });

  // Sincronizar color bg
  document.getElementById('newBoxBgColor').addEventListener('input', (e) => {
    document.getElementById('newBoxBgColorText').value = e.target.value;
  });
  document.getElementById('newBoxBgColorText').addEventListener('input', (e) => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) document.getElementById('newBoxBgColor').value = val;
  });

  // Sincronizar color título
  document.getElementById('newBoxTitleColor').addEventListener('input', (e) => {
    document.getElementById('newBoxTitleColorText').value = e.target.value;
  });
  document.getElementById('newBoxTitleColorText').addEventListener('input', (e) => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) document.getElementById('newBoxTitleColor').value = val;
  });

  // Sincronizar color enlaces
  document.getElementById('newBoxLinkColor').addEventListener('input', (e) => {
    document.getElementById('newBoxLinkColorText').value = e.target.value;
  });
  document.getElementById('newBoxLinkColorText').addEventListener('input', (e) => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) document.getElementById('newBoxLinkColor').value = val;
  });
}
