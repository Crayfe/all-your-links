// js/core/events.js
// Bus de eventos mínimo de la aplicación.
//
// Permite que los módulos se comuniquen sin conocerse entre sí: en lugar de
// que boxes.js importe app.js para llamar a renderDashboard(), boxes.js emite
// un evento y quien esté interesado (app.js) lo escucha. Esto rompe las
// dependencias directas y hace el proyecto más desacoplado y enchufable.
//
// Uso:
//   import { bus, EVENTS } from '../core/events.js';
//   bus.on(EVENTS.DASHBOARD_RENDER, (id) => { ... });
//   bus.emit(EVENTS.DASHBOARD_RENDER, dashboardId);

// Nombres de eventos centralizados: una única fuente de verdad.
// Evita strings sueltos y typos silenciosos por el código.
export const EVENTS = {
  // Hay que repintar el contenido del dashboard activo.
  // payload: dashboardId (opcional; si no viene, se usa el activo)
  DASHBOARD_RENDER: 'dashboard:render',

  // La lista de dashboards (sidebar) ha cambiado y debe repintarse.
  // payload: ninguno
  DASHBOARD_LIST_CHANGED: 'dashboard:list-changed',

  // Los eventos propios de calendario han cambiado (creado/editado/eliminado).
  // payload: ninguno — cada widget de calendario montado se resuscribe y repinta.
  CALENDAR_EVENTS_CHANGED: 'calendar:events-changed',
};

class EventBus {
  constructor() {
    this._target = new EventTarget();
  }

  /**
   * Suscribe un callback a un evento.
   * @returns función para cancelar la suscripción.
   */
  on(eventName, callback) {
    const handler = (e) => callback(e.detail);
    this._target.addEventListener(eventName, handler);
    return () => this._target.removeEventListener(eventName, handler);
  }

  /**
   * Emite un evento con datos opcionales.
   */
  emit(eventName, detail = null) {
    this._target.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

// Instancia única compartida por toda la aplicación.
export const bus = new EventBus();
