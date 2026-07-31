// js/core/settings-client.js
// Ajustes que sí viven sincronizados en el servidor (tabla `settings`),
// a diferencia de las API keys (clima, Google, RSS) que por ahora siguen
// siendo solo locales a cada navegador.

export async function getSetting(key) {
  const res = await fetch('/api/settings', { credentials: 'include' });
  if (!res.ok) throw new Error('No se pudo leer la configuración');
  const all = await res.json();
  return all[key] ?? null;
}

export async function setSetting(key, value) {
  const res = await fetch(`/api/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  });
  if (!res.ok) throw new Error('No se pudo guardar la configuración');
}
