// search.js

// --- Elementos del DOM ---
const googleSearch = document.getElementById('googleSearch');
const googleBtn = document.getElementById('googleBtn');
const suggestions = document.getElementById('suggestions');

// --- Funciones de Búsqueda ---
function performSearch(query) {
  if (query) window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
  suggestions.classList.add('hidden');
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  googleBtn.addEventListener('click', () => {
    performSearch(googleSearch.value.trim());
  });

  googleSearch.addEventListener('keydown', e => {
    if (e.key === 'Enter') { 
      e.preventDefault(); 
      performSearch(googleSearch.value.trim()); 
    }
  });

googleSearch.addEventListener('input', async () => {
    const query = googleSearch.value.trim();
    if (!query) { suggestions.classList.add('hidden'); return; }
    
    try {
      // 1. URL de Google a consultar
      const targetUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
      
      // 2. Usar el proxy CORS para evitar el bloqueo del navegador
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`; 
      
      const res = await fetch(proxyUrl);
      const data = await res.json();
      
      // Renderizar sugerencias
      suggestions.innerHTML = data[1].map(s => `<li class="px-3 py-2 hover:bg-blue-100 cursor-pointer text-gray-800">${s}</li>`).join('');
      suggestions.classList.remove('hidden');
      
      // Asignar evento de clic a las sugerencias
      suggestions.querySelectorAll('li').forEach(li => {
        li.addEventListener('click', () => {
          googleSearch.value = li.textContent;
          performSearch(li.textContent);
        });
      });
    } catch (err) { 
      console.error('Error fetching suggestions:', err); 
      suggestions.classList.add('hidden'); 
    }
  });

  // Ocultar sugerencias al hacer clic fuera
  document.addEventListener('click', e => {
    if (!e.target.closest('#googleSearch') && !e.target.closest('#suggestions')) {
      suggestions.classList.add('hidden');
    }
  });
});
