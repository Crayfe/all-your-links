// js/domains/content/rss/integrations/rss-proxy.js
// Integración con rss2json.com: convierte un feed RSS/Atom a JSON,
// ya que los navegadores no pueden leer feeds de otros orígenes por CORS.
// Sin API key funciona con límite de peticiones por IP — por eso se cachea
// agresivamente por caja (una caché por feedUrl, no global).

const API_ENDPOINT = 'https://api.rss2json.com/v1/api.json';
const CACHE_PREFIX = 'rss_cache_';

// ========== CACHÉ POR FEED ==========

function cacheKey(feedUrl) {
  // Clave estable por URL de feed, para no mezclar cachés entre cajas distintas
  return CACHE_PREFIX + btoa(unescape(encodeURIComponent(feedUrl))).slice(0, 40);
}

function getCache(feedUrl) {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(feedUrl)) || 'null');
  } catch {
    return null;
  }
}

function setCache(feedUrl, items) {
  localStorage.setItem(cacheKey(feedUrl), JSON.stringify({ items, timestamp: Date.now() }));
}

function isCacheValid(cache, maxAgeMinutes) {
  if (!cache) return false;
  const ageMinutes = (Date.now() - cache.timestamp) / 60000;
  return ageMinutes < maxAgeMinutes;
}

// ========== NORMALIZACIÓN ==========

function normalizeItem(raw) {
  return {
    title: raw.title || '(Sin título)',
    link: raw.link || '#',
    pubDate: raw.pubDate || null,
    source: raw.author || ''
  };
}

// ========== FETCH ==========

async function fetchFeed(feedUrl, count) {
  const apiKey = localStorage.getItem('rssApiKey');
  let url = `${API_ENDPOINT}?rss_url=${encodeURIComponent(feedUrl)}&count=${count}`;
  if (apiKey) url += `&api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 422 || res.status === 429) throw new Error('rss-needs-key');
    throw new Error(`rss-api-${res.status}`);
  }
  const json = await res.json();
  if (json.status !== 'ok') throw new Error('rss-invalid-feed');
  return (json.items || []).map(normalizeItem);
}

// ========== API PÚBLICA ==========

/**
 * Obtiene los titulares de un feed. Usa caché si es reciente; si no,
 * pide datos frescos a la API y actualiza la caché.
 * @param {string} feedUrl   URL del feed RSS/Atom
 * @param {number} count     número de titulares a pedir
 * @param {number} maxAgeMinutes  minutos de validez de la caché
 * @param {boolean} forceRefresh  ignora la caché y pide datos frescos
 */
export async function getFeedItems(feedUrl, count = 8, maxAgeMinutes = 15, forceRefresh = false) {
  if (!feedUrl) throw new Error('rss-no-url');

  const cache = getCache(feedUrl);
  if (!forceRefresh && isCacheValid(cache, maxAgeMinutes)) {
    return { items: cache.items, fromCache: true, timestamp: cache.timestamp };
  }

  try {
    const items = await fetchFeed(feedUrl, count);
    setCache(feedUrl, items);
    return { items, fromCache: false, timestamp: Date.now() };
  } catch (e) {
    // Si falla la red pero hay caché (aunque caducada), mejor mostrarla que nada
    if (cache?.items) return { items: cache.items, fromCache: true, timestamp: cache.timestamp, stale: true };
    throw e;
  }
}

export function getLastFetchTime(feedUrl) {
  const cache = getCache(feedUrl);
  return cache ? new Date(cache.timestamp) : null;
}
