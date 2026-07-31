// newtab.js

getDashboardUrl().then(dashboardUrl => {
  fetch(`${dashboardUrl}/api/health`, { signal: AbortSignal.timeout(3000) })
    .then((res) => {
      if (!res.ok) throw new Error();
      window.location.href = dashboardUrl;
    })
    .catch(() => {
      document.querySelector('.loader').innerHTML = `
        <div class="logo">📋 AllYourLinks</div>
        <p class="error-msg">
          El servidor no está disponible en<br>
          <span class="error-cmd">${dashboardUrl}</span>
        </p>
      `;
    });
});
