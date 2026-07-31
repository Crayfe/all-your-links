// js/core/api-client.js
// Envoltorio mínimo sobre fetch para hablar con la API del servidor.
// Express sirve tanto el frontend como la API desde el mismo origen
// (mismo puerto), así que no hace falta configurar CORS ni una URL base
// distinta: las peticiones son siempre relativas a donde se sirve la app.

const BASE = '/api';
const TIMEOUT_MS = 4000;

async function request(method, path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `${method} ${path} → ${res.status}`);
    }

    if (res.status === 204) return null; // sin contenido (delete, etc.)
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

export const api = {
  get:   (path)       => request('GET', path),
  post:  (path, body) => request('POST', path, body ?? {}),
  put:   (path, body) => request('PUT', path, body ?? {}),
  patch: (path, body) => request('PATCH', path, body ?? {}),
  del:   (path)       => request('DELETE', path)
};

/**
 * Comprueba si el servidor está disponible, con timeout corto.
 * Nunca lanza: si algo falla, devuelve false.
 */
export async function checkHealth() {
  try {
    await request('GET', '/health');
    return true;
  } catch {
    return false;
  }
}
