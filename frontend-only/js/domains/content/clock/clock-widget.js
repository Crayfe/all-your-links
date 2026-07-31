// js/clock-widget.js
// Widget de hora, fecha y clima para cajas con layout 'widget-clock'

const WEATHER_CACHE_KEY = 'weather_cache';
const WEATHER_CACHE_MINUTES = 10;

const WEATHER_ICONS = {
  '01d': '☀️', '01n': '🌙',
  '02d': '⛅', '02n': '☁️',
  '03d': '☁️', '03n': '☁️',
  '04d': '☁️', '04n': '☁️',
  '09d': '🌧️', '09n': '🌧️',
  '10d': '🌦️', '10n': '🌧️',
  '11d': '⛈️', '11n': '⛈️',
  '13d': '❄️', '13n': '❄️',
  '50d': '🌫️', '50n': '🌫️'
};

// ========== RELOJ ==========

function formatTime(date) {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(date) {
  const str = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ========== CLIMA ==========

function getWeatherCache() {
  try {
    return JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
  } catch {
    return null;
  }
}

function setWeatherCache(data) {
  localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
}

function isCacheValid(cache) {
  if (!cache) return false;
  const ageMinutes = (Date.now() - cache.timestamp) / 60000;
  return ageMinutes < WEATHER_CACHE_MINUTES;
}

async function fetchWeather(lat, lon, apiKey) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=es&appid=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  const json = await res.json();
  return {
    temp: Math.round(json.main.temp),
    feelsLike: Math.round(json.main.feels_like),
    description: json.weather[0].description,
    icon: json.weather[0].icon,
    city: json.name
  };
}

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocalización no soportada')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { timeout: 8000, maximumAge: 600000 }
    );
  });
}

async function getWeatherData() {
  const cache = getWeatherCache();
  if (isCacheValid(cache)) return cache.data;

  const apiKey = localStorage.getItem('weatherApiKey');
  if (!apiKey) return { error: 'no-key' };

  try {
    const { lat, lon } = await getLocation();
    const data = await fetchWeather(lat, lon, apiKey);
    setWeatherCache(data);
    return data;
  } catch (e) {
    console.warn('Widget clima: error al obtener datos', e);
    // Si hay cache aunque esté caducado, mejor mostrarlo que nada
    if (cache?.data) return cache.data;
    return { error: e.message?.includes('403') || e.message?.includes('401') ? 'invalid-key' : 'fetch-error' };
  }
}

// ========== RENDERIZADO ==========

function renderClock(container) {
  const now = new Date();
  const timeEl = container.querySelector('.clock-widget-time');
  const dateEl = container.querySelector('.clock-widget-date');
  if (timeEl) timeEl.textContent = formatTime(now);
  if (dateEl) dateEl.textContent = formatDate(now);
}

function renderWeather(container, weather) {
  const weatherEl = container.querySelector('.clock-widget-weather');
  if (!weatherEl) return;

  if (weather.error === 'no-key') {
    weatherEl.innerHTML = `<span class="clock-widget-weather-msg">Configura tu API key de clima en Perfil</span>`;
    return;
  }
  if (weather.error === 'invalid-key') {
    weatherEl.innerHTML = `<span class="clock-widget-weather-msg">API key inválida o aún no activa</span>`;
    return;
  }
  if (weather.error) {
    weatherEl.innerHTML = `<span class="clock-widget-weather-msg">No se pudo obtener el clima</span>`;
    return;
  }

  const icon = WEATHER_ICONS[weather.icon] || '🌡️';
  weatherEl.innerHTML = `
    <span class="clock-widget-weather-icon">${icon}</span>
    <div class="clock-widget-weather-info">
      <span class="clock-widget-temp">${weather.temp}°C</span>
      <span class="clock-widget-desc">${weather.description} · ${weather.city}</span>
    </div>
  `;
}

// ========== MONTAJE ==========

export async function mountClockWidget(container, box) {
  const linkColor = box.linkColor || '#ffffff';
  const linkFontSize = box.linkFontSize || 14;

  container.innerHTML = `
    <div class="clock-widget" style="color: ${linkColor}">
      <div class="clock-widget-timedate">
        <div class="clock-widget-time" style="font-size: ${linkFontSize + 54}px"></div>
        <div class="clock-widget-date" style="font-size: ${linkFontSize + 2}px"></div>
      </div>
      <div class="clock-widget-weather" style="font-size: ${linkFontSize}px"></div>
    </div>
  `;

  renderClock(container);
  const tick = setInterval(() => renderClock(container), 1000 * 30);

  // Limpiar el intervalo si el nodo se elimina del DOM (cambio de caja/dashboard)
  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      clearInterval(tick);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const weather = await getWeatherData();
  renderWeather(container, weather);
}
