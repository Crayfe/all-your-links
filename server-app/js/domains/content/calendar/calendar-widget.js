// js/calendar-widget.js
// Widget de calendario: vista mes/semana, eventos sincronizados desde Google
// Calendar combinados con eventos propios del proyecto (creados aquí mismo).

import { getStoredEvents, getLastSyncTime, syncGoogleCalendar } from './integrations/google-calendar.js';
import { getNativeEventsForDay } from './native-events.js';
import { openEventModal } from './event-modal.js';
import { saveBox } from '../../../core/data-manager.js';
import { showToast } from '../../../shared/ui.js';
import { bus, EVENTS } from '../../../core/events.js';

const DAYS_ES   = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// ========== UTILIDADES DE FECHA ==========

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Eventos de Google (solo lectura) para un día
function googleEventsForDay(events, date) {
  return events.filter(ev => sameDay(new Date(ev.start), date));
}

// Combina eventos de Google + propios para un día, normalizados para
// renderizado uniforme, marcando su origen para diferenciarlos visualmente.
function combinedEventsForDay(googleEvents, date) {
  const google = googleEventsForDay(googleEvents, date).map(ev => ({ ...ev, source: 'google' }));
  const native = getNativeEventsForDay(date).map(ev => ({
    id: ev.id,
    title: ev.title,
    start: ev.allDay ? ev.date : `${ev.date}T${ev.time || '00:00'}`,
    allDay: ev.allDay,
    source: 'native',
    _raw: ev // referencia al evento original para editar
  }));

  // Orden: eventos de todo el día primero, luego el resto por hora ascendente
  return [...native, ...google].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    if (a.allDay && b.allDay) return 0;
    return new Date(a.start) - new Date(b.start);
  });
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  d.setHours(0,0,0,0);
  return d;
}

// ========== RENDERIZADO: MES ==========

function renderMonthGrid(container, refDate, events) {
  const year  = refDate.getFullYear();
  const month = refDate.getMonth();
  const today = new Date();

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let cellsHTML = '';
  for (let i = 0; i < startOffset; i++) {
    cellsHTML += `<div class="cal-cell cal-cell-empty"></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d);
    const isToday = sameDay(cellDate, today);
    const dayEvents = combinedEventsForDay(events, cellDate);
    cellsHTML += `
      <button class="cal-cell ${isToday ? 'cal-cell-today' : ''}" data-date="${cellDate.toISOString()}">
        <span class="cal-cell-num">${d}</span>
        ${dayEvents.length > 0 ? `<span class="cal-cell-dot" title="${dayEvents.length} evento${dayEvents.length !== 1 ? 's' : ''}"></span>` : ''}
      </button>
    `;
  }
  // Siempre 6 filas x 7 columnas (42 celdas): rellena las que falten con vacías
  // para que la altura de la caja nunca cambie entre meses de 5 y 6 semanas.
  const totalCells = startOffset + daysInMonth;
  const trailingEmpty = 42 - totalCells;
  for (let i = 0; i < trailingEmpty; i++) {
    cellsHTML += `<div class="cal-cell cal-cell-empty"></div>`;
  }

  container.innerHTML = `
    <div class="cal-weekdays">
      ${DAYS_ES.map(d => `<span>${d}</span>`).join('')}
    </div>
    <div class="cal-grid">${cellsHTML}</div>
  `;
}

// ========== RENDERIZADO: SEMANA ==========

function renderWeekGrid(container, refDate, events) {
  const today = new Date();
  const start = startOfWeek(refDate);

  let cellsHTML = '';
  for (let i = 0; i < 7; i++) {
    const cellDate = new Date(start);
    cellDate.setDate(start.getDate() + i);
    const isToday = sameDay(cellDate, today);
    const dayEvents = combinedEventsForDay(events, cellDate);
    cellsHTML += `
      <button class="cal-week-cell ${isToday ? 'cal-cell-today' : ''}" data-date="${cellDate.toISOString()}">
        <span class="cal-week-label">${DAYS_ES[i]}</span>
        <span class="cal-cell-num">${cellDate.getDate()}</span>
        <span class="cal-week-count ${dayEvents.length === 0 ? 'cal-week-count-empty' : ''}">${dayEvents.length || ''}</span>
      </button>
    `;
  }

  container.innerHTML = `<div class="cal-week-grid">${cellsHTML}</div>`;
}

// ========== LISTA DE EVENTOS DEL DÍA SELECCIONADO ==========

function renderDayEvents(container, date, events) {
  const dayEvents = combinedEventsForDay(events, date);
  const label = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const header = `
    <div class="cal-day-header">
      <p class="cal-day-title">${label}</p>
      <button class="cal-day-add-btn" title="Añadir evento">+</button>
    </div>
  `;

  if (dayEvents.length === 0) {
    container.innerHTML = `${header}<p class="cal-day-empty">Sin eventos</p>`;
    return;
  }

  container.innerHTML = `
    ${header}
    <div class="cal-day-events">
      ${dayEvents.map(ev => `
        <div class="cal-event-item cal-event-${ev.source} ${ev.source === 'native' ? 'cal-event-editable' : ''}" ${ev.source === 'native' ? `data-event-id="${ev.id}"` : ''}>
          <span class="cal-event-time">${ev.allDay ? 'Todo el día' : new Date(ev.start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
          <span class="cal-event-title">${ev.title}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ========== MONTAJE ==========

export function mountCalendarWidget(container, box) {
  let view = box.calendarView || 'month';
  let refDate = new Date();
  let selectedDate = new Date();
  let events = getStoredEvents();

  container.innerHTML = `
    <div class="cal-widget">
      <div class="cal-main-row">
        <div class="cal-calendar-col">
          <div class="cal-header">
            <div class="cal-nav-group">
              <button class="cal-nav-btn" data-nav="-1">‹</button>
              <span class="cal-title"></span>
              <button class="cal-nav-btn" data-nav="1">›</button>
            </div>
            <div class="cal-header-actions">
              <button class="cal-view-toggle">Semana</button>
              <button class="cal-sync-btn" title="Sincronizar con Google Calendar">⟳</button>
            </div>
          </div>
          <div class="cal-body"></div>
        </div>
        <div class="cal-day-panel"></div>
      </div>
    </div>
  `;

  const titleEl    = container.querySelector('.cal-title');
  const bodyEl     = container.querySelector('.cal-body');
  const dayPanelEl = container.querySelector('.cal-day-panel');
  const toggleBtn  = container.querySelector('.cal-view-toggle');
  const syncBtn    = container.querySelector('.cal-sync-btn');

  function updateTitle() {
    if (view === 'month') {
      titleEl.textContent = `${MONTHS_ES[refDate.getMonth()]} ${refDate.getFullYear()}`;
    } else {
      const start = startOfWeek(refDate);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      titleEl.textContent = `${start.getDate()} ${MONTHS_ES[start.getMonth()].slice(0,3)} – ${end.getDate()} ${MONTHS_ES[end.getMonth()].slice(0,3)}`;
    }
  }

  function updateSyncStatus() {
    const last = getLastSyncTime();
    const statusText = last
      ? `Última sincronización: ${last.toLocaleDateString('es-ES')} ${last.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
      : 'Sin sincronizar todavía';
    syncBtn.title = `Sincronizar con Google Calendar\n${statusText}`;
  }

  function render() {
    updateTitle();
    bodyEl.className = `cal-body cal-body-${view}`;
    if (view === 'month') renderMonthGrid(bodyEl, refDate, events);
    else renderWeekGrid(bodyEl, refDate, events);
    renderDayEvents(dayPanelEl, selectedDate, events);
    updateSyncStatus();
    toggleBtn.textContent = view === 'month' ? 'Semana' : 'Mes';
  }

  container.querySelectorAll('.cal-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = parseInt(btn.dataset.nav);
      if (view === 'month') refDate.setMonth(refDate.getMonth() + dir);
      else refDate.setDate(refDate.getDate() + dir * 7);
      render();
    });
  });

  toggleBtn.addEventListener('click', () => {
    view = view === 'month' ? 'week' : 'month';
    box.calendarView = view;
    saveBox(box);
    render();
  });

  syncBtn.addEventListener('click', async () => {
    syncBtn.classList.add('cal-sync-spinning');
    try {
      events = await syncGoogleCalendar();
      showToast('Calendario sincronizado', 'success');
      render();
    } catch (e) {
      const msg = e.message === 'no-client-id'
        ? 'Configura el Client ID de Google en Perfil'
        : e.message === 'gis-not-loaded'
        ? 'No se pudo cargar Google Identity Services'
        : 'Error al sincronizar. Revisa el Client ID';
      showToast(msg, 'error');
    } finally {
      syncBtn.classList.remove('cal-sync-spinning');
    }
  });

  bodyEl.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-date]');
    if (!cell) return;
    selectedDate = new Date(cell.dataset.date);
    renderDayEvents(dayPanelEl, selectedDate, events);
  });

  // Botón "+ Añadir evento" y clic en un evento propio para editarlo
  dayPanelEl.addEventListener('click', (e) => {
    if (e.target.closest('.cal-day-add-btn')) {
      openEventModal(selectedDate);
      return;
    }
    const eventEl = e.target.closest('.cal-event-editable');
    if (eventEl) {
      const nativeEvents = getNativeEventsForDay(selectedDate);
      const existing = nativeEvents.find(ev => ev.id === eventEl.dataset.eventId);
      if (existing) openEventModal(selectedDate, existing);
    }
  });

  // Repintar cuando se cree/edite/elimine un evento propio (desde este widget
  // u otro, si hay varias cajas de calendario abiertas a la vez)
  const unsubscribe = bus.on(EVENTS.CALENDAR_EVENTS_CHANGED, () => render());

  // Limpiar la suscripción si la caja se elimina del DOM (cambio de dashboard,
  // borrado de la caja) para no acumular listeners huérfanos
  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      unsubscribe();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  render();
}
