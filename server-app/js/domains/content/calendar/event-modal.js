// js/domains/content/calendar/event-modal.js
// Modal compartido de crear/editar/eliminar eventos propios de calendario.
// Un único modal en el DOM sirve a todas las cajas de calendario que existan;
// este módulo se auto-inicializa una sola vez al ser importado (los módulos
// ES son singleton — no importa cuántas cajas de calendario se monten,
// los listeners solo se cablean una vez).

import { bus, EVENTS } from '../../../core/events.js';
import { showToast } from '../../../shared/ui.js';
import { createNativeEvent, saveNativeEvent, deleteNativeEvent, getNativeEvent } from './native-events.js';

const modal        = document.getElementById('newEventModal');
const titleInput   = document.getElementById('newEventTitle');
const dateInput    = document.getElementById('newEventDate');
const allDayInput  = document.getElementById('newEventAllDay');
const timeField    = document.getElementById('newEventTimeField');
const timeInput    = document.getElementById('newEventTime');
const deleteBtn    = document.getElementById('deleteNewEvent');
const modalTitleEl = document.getElementById('eventModalTitle');

function toDateInputValue(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resetModal() {
  titleInput.value = '';
  allDayInput.checked = true;
  timeInput.value = '';
  timeField.classList.add('hidden');
  delete modal.dataset.editingId;
  deleteBtn.classList.add('hidden');
}

/**
 * Abre el modal. Si se pasa un evento existente, lo carga para editar;
 * si no, lo prepara para crear uno nuevo en la fecha indicada.
 */
export function openEventModal(date, existingEvent = null) {
  resetModal();

  if (existingEvent) {
    modalTitleEl.textContent = 'Editar evento';
    titleInput.value = existingEvent.title;
    dateInput.value = existingEvent.date;
    allDayInput.checked = existingEvent.allDay;
    timeField.classList.toggle('hidden', existingEvent.allDay);
    timeInput.value = existingEvent.time || '';
    modal.dataset.editingId = existingEvent.id;
    deleteBtn.classList.remove('hidden');
  } else {
    modalTitleEl.textContent = 'Nuevo evento';
    dateInput.value = toDateInputValue(date);
  }

  modal.classList.add('active');
  titleInput.focus();
}

function closeModal() {
  modal.classList.remove('active');
  resetModal();
}

function initEventModal() {
  allDayInput.addEventListener('change', () => {
    timeField.classList.toggle('hidden', allDayInput.checked);
  });

  document.getElementById('cancelNewEvent').addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  deleteBtn.addEventListener('click', () => {
    const id = modal.dataset.editingId;
    if (!id) return;
    if (confirm('¿Eliminar este evento?')) {
      deleteNativeEvent(id);
      bus.emit(EVENTS.CALENDAR_EVENTS_CHANGED);
      showToast('Evento eliminado', 'success');
      closeModal();
    }
  });

  document.getElementById('saveNewEvent').addEventListener('click', () => {
    const title  = titleInput.value.trim();
    const date   = dateInput.value;
    const allDay = allDayInput.checked;
    const time   = timeInput.value || null;

    if (!title) { showToast('El título es obligatorio', 'error'); return; }
    if (!date)  { showToast('La fecha es obligatoria', 'error'); return; }

    if (modal.dataset.editingId) {
      const event = getNativeEvent(modal.dataset.editingId);
      if (event) {
        Object.assign(event, { title, date, time: allDay ? null : time, allDay });
        saveNativeEvent(event);
        showToast('Evento actualizado', 'success');
      }
    } else {
      const newEvent = createNativeEvent(title, date, time, allDay);
      saveNativeEvent(newEvent);
      showToast('Evento creado', 'success');
    }

    bus.emit(EVENTS.CALENDAR_EVENTS_CHANGED);
    closeModal();
  });
}

initEventModal();
