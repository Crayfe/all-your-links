// background.js
const DASHBOARD_URL = 'http://localhost:8000';

// Auxiliar para limpiar entidades HTML básicas en el entorno del Service Worker (donde no hay DOMParser)
function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&iexcl;/g, '¡')
    .replace(/&iquest;/g, '¿');
}

// Crear la opción en el menú contextual
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-allyourlinks",
    title: "Guardar link en AllYourLinks",
    contexts: ["link"]
  });
});

// Escuchar el clic en el menú contextual
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-to-allyourlinks") return;

  const linkUrl = info.linkUrl;
  let linkTitle = info.selectionText?.trim();

  // 1. Plan A: Fetch directo desde Background (Bypassea CORS de cualquier web externa)
  if (!linkTitle) {
    try {
      // Timeout de 3 segundos para no bloquear la ejecución si la web externa es lenta
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(linkUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      const htmlText = await response.text();
      const match = htmlText.match(/<title>(.*?)<\/title>/i);
      
      if (match && match[1]) {
        linkTitle = decodeHtmlEntities(match[1])
          .replace(/ - YouTube/i, '')
          .trim();
      }
    } catch (fetchError) {
      console.warn("AllYourLinks: No se pudo obtener el <title> por fetch remoto, usando fallback del nodo.", fetchError);
    }
  }

  // 2. Plan B: Si el fetch falla (404, caída, etc.), extraer y limpiar el nodo <a> de la página origen
  if (!linkTitle && tab?.id) {
    try {
      const DOMResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (url) => {
          try {
            const parsed = new URL(url);
            const relativeUrl = parsed.pathname + parsed.search;
            const anchor = document.querySelector(`a[href="${url}"], a[href="${relativeUrl}"]`);
            
            if (anchor) {
              const clone = anchor.cloneNode(true);
              clone.querySelectorAll('span, ytd-thumbnail-overlay-time-status-renderer, #time-status, .video-time').forEach(el => el.remove());
              return clone.innerText.trim();
            }
          } catch {
            return null;
          }
        },
        args: [linkUrl]
      });
      linkTitle = DOMResult[0]?.result;
    } catch (e) {
      console.warn("AllYourLinks: Error en script de fallback del DOM", e);
    }
  }

  // 3. Fallback absoluto: URL en claro
  if (!linkTitle) {
    linkTitle = linkUrl;
  }

  // Estructura del item
  const newItem = {
    id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type: 'link',
    data: { title: linkTitle, url: linkUrl },
    metadata: {
      clickCount: 0,
      lastAccessed: null,
      createdAt: new Date().toISOString(),
      tags: []
    }
  };

const writeFromBackground = (item) => {
    const defaultBoxId = localStorage.getItem('default_save_box_id');
    if (!defaultBoxId) {
      console.warn('AllYourLinks: No se ha configurado una ruta de guardado por defecto.');
      return false;
    }

    const boxes = JSON.parse(localStorage.getItem('boxes_v2') || '[]');
    const items = JSON.parse(localStorage.getItem('items_v2') || '[]');
    
    const targetBox = boxes.find(b => b.id === defaultBoxId);
    if (!targetBox) {
      console.warn('AllYourLinks: La caja configurada ya no existe en el almacenamiento.');
      return false;
    }
    if ((targetBox.layout || '').startsWith('widget-')) {
      console.warn('AllYourLinks: La caja configurada es un widget y no admite enlaces. Reconfigura la ruta de guardado en Perfil.');
      return false;
    }

    // Filtrar los elementos de esta caja específica
    const boxItems = items.filter(i => i.boxId === defaultBoxId);
    
    // Encontrar el orden más alto registrado (si no hay ninguno, el valor inicial es -1)
    const maxOrder = boxItems.reduce((max, i) => (i.order > max ? i.order : max), -1);

    item.boxId = defaultBoxId;
    item.order = maxOrder + 1; // Garantiza la última posición absoluta de la cola
    
    items.push(item);
    localStorage.setItem('items_v2', JSON.stringify(items));
    return true;
  };

  try {
    const dashboardTabs = await chrome.tabs.query({ url: `${DASHBOARD_URL}/*` });

    if (dashboardTabs.length > 0) {
      await chrome.scripting.executeScript({
        target: { tabId: dashboardTabs[0].id },
        func: writeFromBackground,
        args: [newItem]
      });
      chrome.tabs.reload(dashboardTabs[0].id);
    } else {
      const tempTab = await chrome.tabs.create({ url: DASHBOARD_URL, active: false });
      await new Promise(resolve => setTimeout(resolve, 1000));
      await chrome.scripting.executeScript({
        target: { tabId: tempTab.id },
        func: writeFromBackground,
        args: [newItem]
      });
      await chrome.tabs.remove(tempTab.id);
    }
  } catch (e) {
    console.error("Error crítico en almacenamiento:", e);
  }
});