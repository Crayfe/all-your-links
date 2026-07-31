# AllYourLinks

Un dashboard personal hecho a medida, que empezó como un simple gestor de enlaces y ha ido creciendo con el tiempo hasta convertirse en un pequeño sistema propio: notas, widgets, disposiciones personalizables, una extensión de navegador, y un servidor propio corriendo en casa.

Este repositorio contiene **dos versiones** del proyecto, cada una en su propia carpeta:

## 📁 [`frontend-only/`](./frontend-only) — la versión original

La primera versión del proyecto: un dashboard puramente estático (HTML + JS + CSS, sin backend propio), con los datos guardados en el `localStorage` del navegador. Nació de una necesidad personal — tener un punto de partida propio para navegar por internet, sin depender de extensiones de terceros ni de montones de marcadores desorganizados — y fue el terreno de pruebas donde tomó forma la idea central: un dashboard hecho de cajas, cada una configurable a tu gusto.

Esta versión queda **congelada tal cual está**, como referencia de dónde partió todo. Tiene su propio `README.md` con instrucciones para ejecutarla.

## 📁 [`server-app/`](./server-app) — la versión actual, en desarrollo activo

La evolución natural de la idea: en vez de vivir solo en el navegador, ahora hay un servidor propio (Node.js + Express + SQLite) desplegado en un PC linux doméstico de bajo consumo a modo de servidor, con HTTPS real y acceso remoto. Los datos ya no se quedan atrapados en un único navegador — se sincronizan entre dispositivos, con caché local para seguir funcionando sin conexión.

Sobre esa base se ha ido construyendo bastante más:

- **Autenticación** propia, con sesión de expiración deslizante
- **Sistema de notas** tipo Google Keep pero más ambicioso: cada nota es una caja del dashboard, con editor visual (WYSIWYG), checkboxes interactivos, imágenes, y Markdown por debajo para que el contenido sea siempre portable
- **Dashboards personalizables**: número de columnas, proporciones de ancho asimétricas, y cajas contenedoras que agrupan otras cajas con su propia disposición interna
- **Fondo de pantalla independiente** por cada dashboard
- **Extensión de navegador** para guardar enlaces y, ahora también, fragmentos de texto seleccionados como notas nuevas — todo sincronizado con el servidor
- Widgets de reloj/clima, calendario, estadísticas de uso y lector RSS
- Interfaz adaptada a móvil, con navegación propia para pantallas pequeñas

El desarrollo activo continúa aquí. La carpeta `frontend-only/` recibe, como mucho, alguna mejora puntual que no dependa del backend (un ajuste visual, un widget nuevo) cuando tiene sentido llevarla a las dos versiones.

Consulta el `README.md` dentro de [`server-app/`](./server-app) para instrucciones de instalación, arquitectura, y todo el detalle técnico.

---

*Proyecto personal de Crayfe.*
