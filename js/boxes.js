// js/boxes.js
// Gestión de cajas: CRUD, modal y lógica de personalización visual

import { showToast } from './ui.js';
import {
  getActiveWorkspace,
  getBoxesByWorkspace,
  getBox,
  getItemsByBox,
  saveBox,
  deleteBox as deleteBoxFromStorage
} from './data-manager.js';
import { createBox } from './data-model.js';
import { getCurrentDashboardId } from './dashboard.js';

// ========== HELPERS MODAL ==========

export function updateLayoutOptions(layout) {
  document.getElementById('layoutOptionsGrid').classList.toggle('hidden', layout !== 'grid');
  document.getElementById('layoutOptionsOrbs').classList.toggle('hidden', layout !== 'orbs');
  document.getElementById('layoutOptionsList').classList.toggle('hidden', layout !== 'list');
}

export function resetBoxModal() {
  document.getElementById('newBoxTitle').value = '';
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
  document.getElementById('newBoxListRowHeight').value = 'normal';
  updateLayoutOptions('grid');
}

// ========== CRUD ==========

export function editBox(boxId) {
  const box = getBox(boxId);
  if (!box) return;
  const newBoxModal = document.getElementById('newBoxModal');
  document.getElementById('boxModalTitle').textContent = 'Editar caja';
  document.getElementById('newBoxTitle').value = box.title;
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
  updateLayoutOptions(box.layout || 'grid');
  newBoxModal.dataset.editingBoxId = boxId;
  newBoxModal.classList.add('active');
}

export function deleteBox(boxId) {
  const box = getBox(boxId);
  if (!box) return;
  const items = getItemsByBox(boxId);
  const confirmMsg = items.length > 0
    ? `¿Eliminar la caja "${box.title}" y sus ${items.length} enlaces?`
    : `¿Eliminar la caja "${box.title}"?`;
  if (confirm(confirmMsg)) {
    deleteBoxFromStorage(boxId);
    const boxElement = document.querySelector(`.box-card[data-box-id="${boxId}"]`);
    if (boxElement) boxElement.remove();
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
    delete newBoxModal.dataset.editingBoxId;
    newBoxModal.classList.add('active');
  });

  document.getElementById('cancelNewBox').addEventListener('click', () => {
    newBoxModal.classList.remove('active');
  });

  newBoxModal.addEventListener('click', (e) => {
    if (e.target === newBoxModal) newBoxModal.classList.remove('active');
  });

  document.getElementById('saveNewBox').addEventListener('click', () => {
    const title         = document.getElementById('newBoxTitle').value.trim();
    const layout        = document.getElementById('newBoxLayout').value;
    const colSpan       = parseInt(document.getElementById('newBoxColSpan').value) || 1;
    const titleAlign    = document.getElementById('newBoxTitleAlign').value;
    const titleColor    = document.getElementById('newBoxTitleColor').value;
    const titleFont     = document.getElementById('newBoxTitleFont').value;
    const linkColor     = document.getElementById('newBoxLinkColor').value;
    const linkFontSize  = parseInt(document.getElementById('newBoxLinkFontSize').value) || 14;
    const bgColor       = document.getElementById('newBoxBgColor').value;
    const bgOpacity     = parseInt(document.getElementById('newBoxBgOpacity').value) / 100;
    const gridCols      = parseInt(document.getElementById('newBoxGridCols').value) || 2;
    const orbSize       = parseInt(document.getElementById('newBoxOrbSize').value) || 80;
    const listRowHeight = document.getElementById('newBoxListRowHeight').value;

    if (!title) { showToast('El nombre de la caja es obligatorio', 'error'); return; }
    const currentId = getCurrentDashboardId();
    let workspace = null;
    
    if (currentId) {
      workspace = { id: currentId }; 
    } else {
      workspace = getActiveWorkspace();
    }
    
    if (!workspace) { showToast('No hay dashboard activo', 'error'); return; }

    if (newBoxModal.dataset.editingBoxId) {
      const box = getBox(newBoxModal.dataset.editingBoxId);
      if (box) {
        Object.assign(box, { title, layout, colSpan, titleAlign, titleColor, titleFont,
          linkColor, linkFontSize, bgColor, bgOpacity, gridCols, orbSize, listRowHeight });
        saveBox(box);
        showToast('Caja actualizada', 'success');
      }
      delete newBoxModal.dataset.editingBoxId;
    } else {
      const newBox = createBox(workspace.id, title);
      Object.assign(newBox, { layout, colSpan, titleAlign, titleColor, titleFont,
        linkColor, linkFontSize, bgColor, bgOpacity, gridCols, orbSize, listRowHeight });
      newBox.order = getBoxesByWorkspace(workspace.id).length;
      saveBox(newBox);
      showToast('Caja creada', 'success');
    }

    import('./links.js').then(m => m.renderLinks(currentId));
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
