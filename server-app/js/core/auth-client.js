// js/core/auth-client.js
// Comprobación de sesión y login/logout contra el servidor. La cookie de
// sesión es httpOnly (el JS no puede leerla ni tiene por qué), así que
// aquí solo hablamos con los endpoints /api/auth/*; el navegador se
// encarga de mandar la cookie automáticamente en cada petición same-origin.

const BASE = '/api/auth';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Comprueba si ya hay una sesión válida (cookie existente de una visita
 * anterior). No lanza: devuelve null si no hay sesión.
 */
export async function checkAuth() {
  const { ok, data } = await request('GET', '/me');
  return ok ? data.username : null;
}

/**
 * Intenta iniciar sesión. Devuelve { ok, username } o { ok: false, error }.
 */
export async function login(username, password) {
  const { ok, data } = await request('POST', '/login', { username, password });
  return ok ? { ok: true, username: data.username } : { ok: false, error: data.error || 'Error al iniciar sesión' };
}

export async function logout() {
  await request('POST', '/logout');
}
