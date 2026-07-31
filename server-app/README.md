# AllYourLinks — server-app

Dashboard personal autoalojado: backend propio (Node.js + Express + SQLite) desplegado en un servidor doméstico, con autenticación, HTTPS real, sincronización entre dispositivos, y un sistema de notas y widgets construido encima.

## Características

- **Cajas configurables**: enlaces (tarjetas, lista, orbes, referencia), notas, widgets (reloj/clima, calendario, estadísticas, RSS), y cajas contenedoras que agrupan otras cajas con su propia disposición interna
- **Notas**: cada nota es una caja del dashboard, con editor visual (Toast UI Editor), checkboxes interactivos sin necesidad de abrir ningún modal, imágenes, y Markdown por debajo — portable y legible fuera de la app si hiciera falta
- **Dashboards personalizables**: por defecto en 3 columnas, o con número de columnas y proporción de anchos a tu gusto; fondo de pantalla propio por dashboard
- **Sincronización real**: los datos viven en SQLite en el servidor, no en el navegador — patrón *stale-while-revalidate* (se pinta al instante con la caché local, se actualiza en segundo plano si algo cambió)
- **Autenticación** con sesión de expiración deslizante y protección contra fuerza bruta
- **Extensión de navegador** (Chrome/Chromium) para guardar enlaces con clic derecho, y fragmentos de texto seleccionados como notas nuevas
- Interfaz adaptada a móvil, con su propia barra de navegación

## Arquitectura

```
server-app/
├── index.html, style.css, style-mobile.css   — frontend
├── js/
│   ├── core/          — capa de datos: API client, caché, sincronización
│   ├── domains/        — dashboards, cajas, notas, calendario
│   ├── features/       — búsqueda, import/export
│   └── shared/         — utilidades, UI, componentes compartidos
├── extension/          — extensión de navegador (Manifest V3)
└── server/
    ├── server.js        — punto de entrada (Express)
    ├── db/              — esquema SQLite, migraciones
    ├── routes/          — API REST
    ├── auth/            — hash de contraseñas, sesiones
    └── middleware/       — autenticación, control de versión de datos
```

## Instalación

**Requisitos**: Node.js 20 LTS (versiones más recientes pueden no tener binarios precompilados de `better-sqlite3` y obligar a compilar desde el código fuente).

```bash
cd server
npm install
node scripts/create-user.js tu_usuario tu_contraseña
npm start
```

Por defecto arranca en el puerto `8000`. La primera vez que accedas verás la pantalla de login.

## Despliegue en servidor dedicado (opcional, para acceso permanente)

1. **Arranque automático**: `systemd` con `Restart=on-failure`, para que sobreviva a cortes de luz
2. **Acceso remoto**: DuckDNS (DNS dinámico) + Caddy como proxy inverso (HTTPS automático vía Let's Encrypt) + redirección de puertos 80/443 en el router
3. Ver los comentarios en el propio código (`server/db/init.js`, `server/auth/`) para el detalle de cada pieza

## Notas de desarrollo

- Sin dependencias de build ni framework de frontend: JavaScript nativo con módulos ES, Tailwind vía CDN
- El esquema de base de datos se migra solo al arrancar (`ALTER TABLE ADD COLUMN` cuando hace falta una columna nueva), sin necesidad de tocar la base de datos a mano al actualizar
- La extensión de navegador habla directamente con la API REST (con la cookie de sesión del navegador), no con el `localStorage` de ninguna pestaña
