// newtab.js

const DASHBOARD_URL = 'http://localhost:8000';

fetch(DASHBOARD_URL, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
  .then(() => {
    window.location.href = DASHBOARD_URL;
  })
  .catch(() => {
    document.querySelector('.loader').innerHTML = `
      <div class="logo">📋 AllYourLinks</div>
      <p class="error-msg">
        El servidor no está disponible.<br>
        <span class="error-cmd">Ejecuta: <code>python3 -m http.server 8000</code></span>
      </p>
    `;
  });
