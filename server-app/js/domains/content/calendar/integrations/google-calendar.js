// js/google-calendar.js
// Sincronización puntual con Google Calendar (OAuth vía Google Identity Services)
// No hay reautenticación automática: el usuario pulsa "Sincronizar" cuando quiere
// traer los datos más recientes. Los eventos se guardan en localStorage.

const EVENTS_KEY    = 'google_calendar_events';
const LAST_SYNC_KEY  = 'google_calendar_last_sync';
const SCOPE          = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient = null;

// ========== DATOS LOCALES ==========

export function getStoredEvents() {
  try {
    return JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function getLastSyncTime() {
  const ts = localStorage.getItem(LAST_SYNC_KEY);
  return ts ? new Date(parseInt(ts)) : null;
}

function saveEvents(events) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
}

// ========== OAUTH + FETCH ==========

function ensureTokenClient(clientId) {
  return new Promise((resolve, reject) => {
    if (typeof google === 'undefined' || !google.accounts?.oauth2) {
      reject(new Error('gis-not-loaded'));
      return;
    }
    if (tokenClient) { resolve(tokenClient); return; }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: () => {} // se sobreescribe por llamada, ver requestToken()
    });
    resolve(tokenClient);
  });
}

function requestToken(client) {
  return new Promise((resolve, reject) => {
    client.callback = (response) => {
      if (response.error) reject(new Error(response.error));
      else resolve(response.access_token);
    };
    client.requestAccessToken({ prompt: '' });
  });
}

function normalizeEvent(raw) {
  const start = raw.start?.dateTime || raw.start?.date;
  const end   = raw.end?.dateTime || raw.end?.date;
  const allDay = !raw.start?.dateTime;
  return {
    id: raw.id,
    title: raw.summary || '(Sin título)',
    start,
    end,
    allDay,
    location: raw.location || '',
    htmlLink: raw.htmlLink || ''
  };
}

async function fetchEvents(accessToken) {
  const now = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
  const timeMax = new Date(now.getFullYear(), now.getMonth() + 4, 0).toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
    `&singleEvents=true&orderBy=startTime&maxResults=250`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`calendar-api-${res.status}`);
  const json = await res.json();
  return (json.items || []).map(normalizeEvent);
}

// ========== SINCRONIZACIÓN ==========

export async function syncGoogleCalendar() {
  const clientId = localStorage.getItem('googleClientId');
  if (!clientId) throw new Error('no-client-id');

  const client = await ensureTokenClient(clientId);
  const accessToken = await requestToken(client);
  const events = await fetchEvents(accessToken);
  saveEvents(events);
  return events;
}
