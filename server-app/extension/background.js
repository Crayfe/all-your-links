// background.js
importScripts('config.js');

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

// Crear las opciones del menú contextual
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-allyourlinks",
    title: "Guardar link en AllYourLinks",
    contexts: ["link"]
  });
  chrome.contextMenus.create({
    id: "save-note-to-allyourlinks",
    title: "Guardar como nota en AllYourLinks",
    contexts: ["selection"]
  });
});

// ========== GUARDADO VÍA API ==========
// Habla directamente con el servidor (con la cookie de sesión del
// navegador) en vez de inyectar scripts que tocaban el localStorage de
// la pestaña del dashboard. Esto es necesario desde que los datos viven
// en el servidor: escribir solo en localStorage nunca llegaría a
// guardarse de verdad, y podría perderse en la siguiente sincronización.

async function apiGet(dashboardUrl, path) {
  const res = await fetch(`${dashboardUrl}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`API GET ${path} -> ${res.status}`);
  return res.json();
}

async function apiPost(dashboardUrl, path, body) {
  const res = await fetch(`${dashboardUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API POST ${path} -> ${res.status}`);
  return res.json();
}

async function saveItemViaApi(item) {
  const dashboardUrl = await getDashboardUrl();

  // La caja de destino por defecto se guarda en la tabla `settings`
  // del servidor (configurable en Perfil → Extensión).
  const settings = await apiGet(dashboardUrl, '/api/settings');
  const defaultBoxId = settings.default_save_box_id;
  if (!defaultBoxId) {
    console.warn('AllYourLinks: No se ha configurado una ruta de guardado por defecto en Perfil.');
    return { ok: false, reason: 'no-default-box' };
  }

  // Comprobar que la caja sigue existiendo y admite enlaces
  const boxes = await apiGet(dashboardUrl, '/api/boxes');
  const targetBox = boxes.find(b => b.id === defaultBoxId);
  if (!targetBox) {
    console.warn('AllYourLinks: La caja configurada ya no existe.');
    return { ok: false, reason: 'box-not-found' };
  }
  if ((targetBox.layout || '').startsWith('widget-') || ['note', 'container'].includes(targetBox.layout)) {
    console.warn('AllYourLinks: La caja configurada no admite enlaces (es un widget, una nota o un contenedor).');
    return { ok: false, reason: 'box-is-widget' };
  }

  // Calcular el siguiente order dentro de esa caja
  const existingItems = await apiGet(dashboardUrl, `/api/items?boxId=${defaultBoxId}`);
  const maxOrder = existingItems.reduce((max, i) => (i.order > max ? i.order : max), -1);

  await apiPost(dashboardUrl, '/api/items', {
    ...item,
    boxId: defaultBoxId,
    order: maxOrder + 1
  });

  return { ok: true, dashboardUrl };
}

/**
 * Crea una nota nueva a partir de un texto seleccionado, con su propia
 * caja, en el dashboard configurado (Perfil → Extensión). Una nota
 * SIEMPRE necesita su propia caja (no se "añade" a una existente, a
 * diferencia de un enlace en una lista) — por eso aquí, a diferencia de
 * saveItemViaApi, se crean DOS cosas: la nota y la caja que la muestra.
 */
/**
 * Crea una nota nueva a partir de un texto seleccionado, con su propia
 * caja, en el destino configurado (Perfil → Extensión) — que puede ser
 * un dashboard entero (la caja se crea a nivel superior) o un
 * contenedor concreto (la caja se crea como hija suya). Como los IDs de
 * dashboards ("db_...") y de cajas ("box_...") nunca colisionan, un
 * único ajuste guarda cualquiera de los dos y aquí se distingue
 * comprobando en qué colección aparece.
 *
 * Una nota SIEMPRE necesita su propia caja (no se "añade" a una
 * existente, a diferencia de un enlace en una lista) — por eso, a
 * diferencia de saveItemViaApi, se crean DOS cosas: la nota y la caja
 * que la muestra.
 */
async function saveSelectionAsNote(selectionText, pageTitle, sourceUrl) {
  const dashboardUrl = await getDashboardUrl();

  const [settings, dashboards, boxes] = await Promise.all([
    apiGet(dashboardUrl, '/api/settings'),
    apiGet(dashboardUrl, '/api/dashboards'),
    apiGet(dashboardUrl, '/api/boxes')
  ]);

  const destinationId = settings.default_note_destination_id;
  let targetWorkspaceId = null;
  let parentBoxId = null;

  const asContainer = destinationId && boxes.find(b => b.id === destinationId && b.layout === 'container');
  const asDashboard = destinationId && dashboards.find(d => d.id === destinationId);

  if (asContainer) {
    targetWorkspaceId = asContainer.workspaceId;
    parentBoxId = asContainer.id;
  } else if (asDashboard) {
    targetWorkspaceId = asDashboard.id;
  } else {
    // Sin destino configurado (o ya no existe): usar el dashboard fijado
    // (pinned), o si tampoco hay, el primero que exista — igual de
    // razonable que obligar a configurarlo antes de poder usar la
    // función ni una vez.
    const fallback = dashboards.find(d => d.pinned) || dashboards[0];
    if (!fallback) {
      console.warn('AllYourLinks: no hay ningún dashboard donde guardar la nota.');
      return { ok: false, reason: 'no-destination' };
    }
    targetWorkspaceId = fallback.id;
  }

  // Título corto: el propio título de la página (o la URL si no hay),
  // sin prefijo — se identifica el origen de un vistazo sin ser verboso.
  const sourceLabel = pageTitle?.trim() || sourceUrl;
  const title = sourceLabel.length > 60 ? sourceLabel.slice(0, 57).trim() + '…' : sourceLabel;

  // La URL como hipervínculo real al final (no solo texto plano): así
  // el origen queda sin ambigüedad y es un clic directo a la fuente,
  // sin depender de que el título de la página fuera descriptivo.
  const content = `${selectionText}\n\n[${sourceUrl}](${sourceUrl})`;

  const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const boxId = `box_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // ESPERAR a que la nota exista de verdad en el servidor antes de crear
  // la caja que la referencia (boxes.note_id tiene clave foránea a
  // notes.id) — si no se espera, la petición de la caja puede llegar
  // antes que la de la nota y la inserción falla por la restricción,
  // perdiéndose la caja en la siguiente sincronización de fondo sin
  // ningún aviso (mismo motivo que en boxes.js del propio dashboard).
  await apiPost(dashboardUrl, '/api/notes', { id: noteId, type: 'quick', title, content });

  // El "order" se calcula entre HERMANAS reales: si va dentro de un
  // contenedor, entre las demás cajas de ESE contenedor; si va a nivel
  // superior de un dashboard, entre las demás cajas sueltas de ese
  // dashboard (nunca mezclando ambos grupos, que usan el mismo campo
  // "order" con significados distintos).
  const siblingBoxes = parentBoxId
    ? boxes.filter(b => b.parentBoxId === parentBoxId)
    : boxes.filter(b => b.workspaceId === targetWorkspaceId && !b.parentBoxId);
  const maxOrder = siblingBoxes.reduce((max, b) => (b.order > max ? b.order : max), -1);

  await apiPost(dashboardUrl, '/api/boxes', {
    id: boxId,
    workspaceId: targetWorkspaceId,
    parentBoxId,
    title,
    layout: 'note',
    noteId,
    order: maxOrder + 1
  });

  return { ok: true, dashboardUrl };
}

// Escuchar el clic en el menú contextual
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-note-to-allyourlinks") {
    const selectionText = info.selectionText?.trim();
    if (!selectionText) return;
    const sourceUrl = info.pageUrl || tab?.url || '';

    try {
      const result = await saveSelectionAsNote(selectionText, tab?.title, sourceUrl);
      if (!result.ok) {
        console.warn('AllYourLinks: revisa la configuración de "Dashboard de notas" en Perfil.');
        return;
      }
      const dashboardTabs = await chrome.tabs.query({ url: `${result.dashboardUrl}/*` });
      dashboardTabs.forEach(t => chrome.tabs.reload(t.id));
    } catch (e) {
      console.error("AllYourLinks: no se pudo guardar la nota. ¿Has iniciado sesión en el dashboard?", e);
    }
    return;
  }

  if (info.menuItemId !== "save-to-allyourlinks") return;

  const linkUrl = info.linkUrl;
  let linkTitle = info.selectionText?.trim();

  // 1. Plan A: Fetch directo desde Background (Bypassea CORS de cualquier web externa)
  if (!linkTitle) {
    try {
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

  try {
    const result = await saveItemViaApi(newItem);

    if (!result.ok) {
      if (result.reason === 'no-default-box' || result.reason === 'box-not-found' || result.reason === 'box-is-widget') {
        console.warn('AllYourLinks: revisa la configuración de "Ruta de guardado por defecto" en Perfil.');
      }
      return;
    }

    // Si el dashboard está abierto en alguna pestaña, recargarla para que
    // se vea el enlace nuevo de inmediato.
    const dashboardTabs = await chrome.tabs.query({ url: `${result.dashboardUrl}/*` });
    dashboardTabs.forEach(t => chrome.tabs.reload(t.id));
  } catch (e) {
    // Fallo de red o 401 (sesión no iniciada en el navegador): no hay
    // pestaña a la que avisar, se deja constancia en la consola de la
    // extensión (chrome://extensions → Service worker → consola).
    console.error("AllYourLinks: no se pudo guardar el enlace. ¿Has iniciado sesión en el dashboard?", e);
  }
});
