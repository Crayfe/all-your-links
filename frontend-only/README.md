# AllYourLinks — Dashboard personal de enlaces

## Descripción y motivación

Este proyecto nació de una necesidad personal: tener un punto de partida propio para navegar por internet, sin depender de extensiones de terceros, servicios de suscripción ni montones de marcadores desorganizados.

La idea es simple: un dashboard hecho a medida, que crece contigo. Empezó como un gestor de enlaces y ha evolucionado hacia un sistema modular donde cada página es un lienzo en blanco que puedes rellenar con lo que necesites; ya sean enlaces estéticos, organizados, fuentes de investigación, accesos rápidos a cosas iportantes, y lo que vaya surgiendo (Si algo no me gusta o se queda corto, lo cambio. Si necesito algo nuevo, lo construyo) aprendiendo en el progreso.

---

## 📸 Vista previa

<div align="center">
  <img src="docs/images/example1.png" alt="Vista general del dashboard" width="100%">
</div>

<br>

<div align="center">
  <img src="docs/images/example2.png" alt="Layout de orbes con iconos" width="48%">
  &nbsp;
  <img src="docs/images/example3.png" alt="Modal de edición de caja" width="48%">
</div>

---

## 🚀 Cómo ejecutarlo

De lo único que te tienes que preocupar es de tener un navegador compatible basado en chromium para la persistencia de datos y la extension y por otro lado python para correr un servidor ligero en segundo plano. 

**1. Clona o descarga el repositorio:**
```bash
git clone https://github.com/crayfe/all-your-links.git
cd all-your-links
```

**2. Arranca el servidor local:**
```bash
python3 -m http.server 8000
```

En Windows puedes usar los scripts incluidos en `scripts/` para arrancar y detener el servidor sin abrir una terminal.

**3. Abre el navegador y accede a:**
```
http://localhost:8000
```

> El servidor de Python es necesario porque el proyecto usa módulos ES (`type="module"`), que los navegadores bloquean si se abre el HTML directamente como archivo local por restricciones CORS.

**4. (Opcional) Carga datos de ejemplo:**

En Configuración → Importar, selecciona cualquier archivo `.json` de la carpeta `examples/` para ver el dashboard con contenido de muestra.

**5. (Opcional pero muy recomendable) Instala la extensión:**

Abre `chrome://extensions si usas Chrome o brave://extensions/ si usas Brave, activa el modo desarrollador e importa la carpeta `extension/`. Esto hace que cada nueva pestaña cargue el dashboard automáticamente y habilita las funciones de guardado rápido.

---

## Características

### Dashboard y navegación

| Característica | Descripción |
|---|---|
| Múltiples dashboards | Crea y gestiona varios dashboards independientes, cada uno con su propio contenido y configuración visual |
| Dashboard de inicio | Fija un dashboard como vista por defecto al abrir una nueva pestaña |
| Breadcrumb contextual | La barra superior muestra en todo momento en qué dashboard estás |
| Sidebar adaptable | Panel lateral colapsable con mini-orbes identificativos por dashboard |
| Modo edición | Todos los controles de edición (arrastrar, menús contextuales, crear cajas) están ocultos por defecto y se activan con un botón explícito |

### Cajas

| Característica | Descripción |
|---|---|
| Layouts | Cada caja puede usar uno de cuatro layouts: Grid, Lista, Orbes o Referencia |
| Columnas configurables | Grid y Referencia permiten elegir entre 1 y 5 columnas |
| Personalización visual | Color y opacidad de fondo, color y fuente del título, color y tamaño de fuente de los enlaces |
| Ancho flexible | Las cajas pueden ocupar 1, 2 o 3 columnas del layout principal |
| Densidad vertical | El layout Lista permite elegir entre densidad compacta, normal y espaciada |
| Tamaño de orbes | El layout Orbes permite ajustar el tamaño de cada orbe con un slider |
| Mover entre dashboards | Una caja y todo su contenido puede migrarse a otro dashboard desde el modal de edición |
| Drag & drop | Las cajas se pueden reordenar arrastrando cuando el modo edición está activo |

### Fuentes disponibles para títulos

Inter, Playfair Display, Oswald, Raleway, Space Mono, Pacifico, Rock Salt — cargadas desde Google Fonts.

### Enlaces

| Característica | Descripción |
|---|---|
| Favicons resilientes | Sistema de 3 niveles: iconos hardcodeados para servicios populares → Google Favicons API → SVG genérico |
| Tracking de uso | Cada clic registra `clickCount` y `lastAccessed` para uso futuro en estadísticas |
| Drag & drop entre cajas | Los enlaces se pueden mover entre cajas arrastrando |
| Abrir en nueva pestaña | Preferencia global configurable desde el panel de configuración |

### Layout Referencia

Diseñado para recolectar fuentes durante una investigación. Muestra el título del enlace y la URL en claro, con la URL en tipografía monoespaciada. Soporta múltiples columnas con colapso automático cuando el espacio no es suficiente para mantener una anchura mínima legible.

### Datos

| Característica | Descripción |
|---|---|
| Persistencia | Todo se guarda en `localStorage`, sin servidor ni cuenta necesaria |
| Export / Import | Exporta todos tus datos a JSON y vuelve a importarlos en cualquier momento |
| Fondo personalizado | Sube una imagen como fondo del dashboard, guardada en base64 |
| Versionado | Campo `data_version` para gestionar migraciones futuras del modelo de datos |

### Widgets

| Característica | Descripción |
|---|---|
| Hora, fecha y clima | Reloj en vivo, fecha localizada y clima actual (OpenWeatherMap) con geolocalización del navegador |
| Calendario | Vista mes/semana con navegación, proporción fija 2:1 entre calendario y panel del día, altura constante entre meses de 5 y 6 semanas |
| Eventos propios | Sistema de eventos nativo del proyecto, independiente de cualquier integración externa. Se crean, editan y eliminan desde el propio widget |
| Sincronización con Google Calendar | Importación puntual (no en vivo) de eventos vía OAuth de un solo uso — Google Calendar es una fuente de datos más, no la fuente de verdad |
| Estadísticas | Ranking global de enlaces más usados por número de clics, calculado sobre los items reales sin duplicarlos |
| Lector RSS | Titulares de un feed configurable, con caché local y refresco automático (rss2json.com) |
| Sin título opcional | Cualquier caja (widget o de contenido) puede ocultar su cabecera en modo estático manteniéndola visible y resaltada en modo edición |

---

## 🔌 Extensión para Chromium

La extensión complementa el dashboard con integración directa en el navegador. Está en la carpeta `extension/` y se instala en modo desarrollador.

### Funciones

**Nueva pestaña:** Cada vez que abres una pestaña nueva, la extensión comprueba si el servidor está disponible y redirige automáticamente al dashboard. Si el servidor no está levantado, muestra un mensaje informativo en lugar de una página de error.

**Popup de guardado rápido:** Al hacer clic en el icono de la extensión se abre un popup con el título y la URL de la pestaña activa, precargados y listos para guardar. Puedes editar el título y elegir en qué caja guardarlo, con las cajas agrupadas por dashboard.

**Menú contextual:** Con el botón derecho sobre cualquier enlace de cualquier página web aparece la opción "Guardar link en AllYourLinks". La extensión intenta obtener el título real del enlace en tres pasos: fetch directo a la URL para leer el `<title>`, lectura del nodo `<a>` en el DOM de la página actual, y como fallback usa la URL en claro. El enlace se guarda en la caja configurada como destino por defecto.

### Permisos requeridos

| Permiso | Motivo |
|---|---|
| `activeTab` | Leer la URL y título de la pestaña activa |
| `scripting` | Leer y escribir en el `localStorage` del dashboard |
| `tabs` | Buscar si hay una pestaña del dashboard abierta |
| `contextMenus` | Añadir la opción al menú de botón derecho |
| `host_permissions` | Acceso a `localhost:8000` y a cualquier URL para el fetch de títulos |

---

## Arquitectura del proyecto

### Estructura de carpetas

```
all-your-links/
├── index.html                  # Página principal
├── style.css                   # Estilos globales
├── js/
│   ├── main.js                 # Punto de entrada
│   ├── app.js                  # Orquestador: renderizado del dashboard, delegación global de eventos
│   ├── core/                   # Núcleo agnóstico a dominios concretos
│   │   ├── data-model.js       # Schemas, factories, generador de IDs
│   │   ├── data-manager.js     # CRUD y persistencia en localStorage
│   │   └── events.js           # Bus de eventos (pub/sub) para desacoplar módulos
│   ├── domains/
│   │   ├── dashboard/
│   │   │   └── dashboard.js    # Navegación entre dashboards, sidebar, sistema de pin
│   │   ├── boxes/
│   │   │   ├── boxes.js        # CRUD de cajas, modal de personalización
│   │   │   ├── drag.js         # Drag & drop, modo edición
│   │   │   └── renderer.js     # Creación de nodos DOM, dispatch por tipo de contenido
│   │   └── content/            # Cada tipo de contenido, autocontenido en su carpeta
│   │       ├── links/
│   │       │   └── links.js
│   │       ├── clock/
│   │       │   └── clock-widget.js
│   │       ├── calendar/
│   │       │   ├── calendar-widget.js
│   │       │   ├── native-events.js       # Eventos propios (independientes de Google)
│   │       │   ├── event-modal.js         # Modal compartido de crear/editar evento
│   │       │   └── integrations/
│   │       │       └── google-calendar.js # Importación puntual vía OAuth
│   │       ├── stats/
│   │       │   └── stats-widget.js
│   │       └── rss/
│   │           ├── rss-widget.js
│   │           └── integrations/
│   │               └── rss-proxy.js       # Integración con rss2json.com
│   ├── features/                # Funcionalidades transversales, no ligadas a un dominio
│   │   ├── data-io.js           # Export/import de backup, config. de la extensión
│   │   └── search/
│   │       ├── search.js        # Selector de motor + sugerencias
│   │       └── internal-search.js
│   └── shared/                  # Utilidades usadas por cualquier módulo
│       ├── ui.js                # Toasts, navegación entre secciones, menús
│       └── utils.js             # Favicons, sanitización, normalización de URLs
├── extension/
│   ├── manifest.json           # Configuración de la extensión (Manifest V3)
│   ├── background.js           # Service worker: menú contextual y guardado desde cualquier página
│   ├── popup.html/css/js       # Popup de guardado rápido desde la pestaña activa
│   └── newtab.html/css/js      # Override de nueva pestaña con redirección al dashboard
├── scripts/                    # Instaladores y desinstaladores para Windows y Linux
├── examples/                   # Archivos JSON de ejemplo para importar
└── docs/
    └── images/                 # Capturas de pantalla para el README
```

### Módulos JS — responsabilidades

| Módulo | Responsabilidad |
|---|---|
| `main.js` | Inicializa la aplicación, gestiona el fondo personalizado |
| `app.js` | Orquestador central: renderiza el dashboard activo, delegación global de eventos, escucha el bus para repintar |
| `core/data-model.js` | Schemas de referencia, factories, generador de IDs |
| `core/data-manager.js` | Todas las operaciones de lectura/escritura sobre localStorage |
| `core/events.js` | Bus de eventos mínimo (envoltorio de `EventTarget`) — permite que los módulos se comuniquen sin importarse entre sí |
| `domains/dashboard/dashboard.js` | CRUD de dashboards, sidebar, navegación, sistema de pin |
| `domains/boxes/boxes.js` | CRUD de cajas, modal de personalización con opciones contextuales por tipo de contenido |
| `domains/boxes/drag.js` | Drag & drop, toggle de modo edición |
| `domains/boxes/renderer.js` | Creación de nodos DOM; despacha el renderizado según el `layout` de cada caja |
| `domains/content/links/links.js` | CRUD de enlaces y su modal — el tipo de contenido original, ya no acoplado a la orquestación |
| `domains/content/clock/clock-widget.js` | Widget de hora/fecha/clima |
| `domains/content/calendar/*` | Widget de calendario, eventos propios, modal de evento, integración Google Calendar |
| `domains/content/stats/stats-widget.js` | Widget de ranking de enlaces más usados |
| `domains/content/rss/*` | Widget de lector RSS e integración con rss2json |
| `features/data-io.js` | Export/import de backup, configuración de la extensión |
| `features/search/*` | Buscador con selector de motor y búsqueda interna |
| `shared/ui.js` / `shared/utils.js` | Utilidades transversales |

### Modelo de datos

El sistema usa tres niveles jerárquicos almacenados en `localStorage` de forma independiente:

```
Dashboard (workspaces_v2)
    └── Box (boxes_v2)
            └── Item (items_v2)
```

Cada nivel referencia al superior por ID. Esta separación permite operaciones eficientes sobre cualquier nivel sin deserializar toda la jerarquía.

| Key localStorage | Contenido |
|---|---|
| `workspaces_v2` | Array de dashboards con `id`, `name`, `active`, `pinned`, `order` |
| `boxes_v2` | Array de cajas con `workspaceId`, configuración visual y de layout |
| `items_v2` | Array de items con `boxId`, `type`, `data` y `metadata` (clickCount, tags) |
| `data_version` | Versión del modelo (`"2.0"`) para gestión de migraciones |
| `dragEnabled` | Estado del modo edición entre sesiones |
| `abrirNuevaPestana` | Preferencia de apertura de enlaces |
| `customBackground` | Imagen de fondo en base64 |
| `calendar_native_events_v1` | Eventos propios de calendario, globales al proyecto |
| `google_calendar_events` / `google_calendar_last_sync` | Caché de la última importación desde Google Calendar |
| `rss_cache_*` | Caché por feed del widget RSS (una key por URL de feed) |
| `weatherApiKey` / `googleClientId` / `rssApiKey` | Credenciales de las integraciones externas, configuradas por el usuario |

Los IDs siguen el formato `{prefix}_{timestamp}_{random}` (ej: `item_1708123456789_a3f2`) para garantizar unicidad incluso con creación simultánea.

---

## Notas técnicas

### Estrategia de estilos

El proyecto usa una combinación deliberada de Tailwind CSS (vía CDN) y CSS propio en `style.css`. Tailwind gestiona utilidades rápidas de espaciado, colores y tipografía, especialmente en los elementos generados dinámicamente desde JS. El CSS propio gestiona todos los componentes con lógica de estado: sidebar, layouts, drag & drop, modo edición, dashboards. Esta división funciona bien para el estado actual del proyecto. Cuando se implemente el backend (Fase 4), tiene sentido migrar a Tailwind con build step (Vite) para purgar clases no usadas.

### CSS custom properties para personalización de cajas

Cada `box-card` expone variables CSS que los elementos hijos consumen directamente, evitando pasar props a través del DOM:

```css
--link-font-size   /* tamaño de fuente de los enlaces */
--grid-cols        /* número de columnas del grid */
--orb-size         /* tamaño del orbe en px */
--list-padding-y   /* densidad vertical de la lista */
```

### Bus de eventos y desacoplamiento entre dominios

Los módulos de `domains/` no se importan entre sí para coordinarse. En su lugar, emiten y escuchan eventos a través de `core/events.js`:

```js
import { bus, EVENTS } from '../../core/events.js';

// Emitir: "algo cambió, quien esté interesado que reaccione"
bus.emit(EVENTS.DASHBOARD_RENDER, dashboardId);

// Escuchar
bus.on(EVENTS.DASHBOARD_RENDER, (id) => renderDashboard(id));
```

Esto sustituye al patrón previo de `import('./otro-modulo.js').then(...)` para romper dependencias circulares. El resultado: ningún dominio (`boxes`, `drag`, `dashboard`, tipos de contenido) importa `app.js` — solo `main.js` lo hace, para arrancar la aplicación. Si se elimina un dominio, el resto sigue funcionando sin imports rotos.

### Tipos de contenido como módulos autocontenidos

Cada carpeta bajo `domains/content/` es un tipo de contenido independiente (enlaces, reloj, calendario, estadísticas, RSS). Añadir uno nuevo no requiere tocar `core/` ni el bus — solo:

1. Crear la carpeta con su lógica de renderizado
2. Registrar el `layout` correspondiente en `domains/boxes/renderer.js` (el único punto de acoplamiento restante, candidato a convertirse en un registro de tipos en una futura iteración)
3. Añadir la opción al modal de caja en `index.html`

### Extensión: lectura y escritura en localStorage del dashboard

La extensión no tiene acceso directo al `localStorage` del dashboard porque cada origen tiene el suyo. Lo resuelve inyectando scripts en la pestaña del dashboard con `chrome.scripting.executeScript`, que sí tiene acceso al `localStorage` de `localhost:8000`. Si no hay ninguna pestaña del dashboard abierta, crea una en segundo plano, opera sobre ella y la cierra.

---

## 🗺️ Roadmap

### Fase 1 — Frontend base (completada)
- [x] Sistema de cajas y enlaces con drag & drop
- [x] Múltiples layouts: Grid, Lista, Orbes, Referencia
- [x] Personalización visual por caja (color, fuente, opacidad, columnas, tamaño de orbes)
- [x] Múltiples dashboards con sistema de pin y navegación en sidebar
- [x] Modo edición que oculta todos los controles de modificación
- [x] Export / import de datos en JSON
- [x] Extensión para Chromium: nueva pestaña, popup de guardado, menú contextual
- [x] Barra de búsqueda integrada con sugerencias de Google

### Fase 2 — Completar el frontend (completada)
- [x] Barra de búsqueda con selector de motor (Google, DuckDuckGo, Perplexity, Interno)
- [x] Buscador interno con vista dedicada y navegación a resultados
- [x] Tags en items, buscables desde el buscador interno

### Fase 3 — Widgets (completada)
- [x] Widget de hora, fecha y clima
- [x] Widget de calendario con eventos propios + importación de Google Calendar
- [x] Widget de estadísticas (ranking de más usados)
- [x] Lector de RSS con caché

### Refactor de arquitectura (completado, fuera del roadmap original)
- [x] Separación de la orquestación (`app.js`) de la lógica de enlaces
- [x] Reorganización en `core/domains/features/shared`
- [x] Bus de eventos para desacoplar dominios

### Fase 4 — Backend en servidor dedicado (planificado)
- [ ] API REST con Node.js / Express
- [ ] Base de datos SQLite o PostgreSQL — migración desde localStorage
- [ ] Autenticación JWT
- [ ] Sincronización multi-dispositivo
- [ ] Backup automático
- [ ] Migración a Tailwind con build step (Vite) para CSS optimizado

### Fase 5 — Integraciones avanzadas (futuro)
- [ ] Dashboard de inversiones con APIs financieras autenticadas y gráficos
- [ ] Panel de control para ESP32 — Raspberry como broker intermediario
- [ ] Extensión mejorada sincronizada con el backend
- [ ] Responsive mobile / PWA

---

