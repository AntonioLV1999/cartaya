# Diseño: carta digital

## Contexto

Proyecto nuevo: el repositorio solo contiene la configuración de OpenSpec y no hay specs vivas. El stack está fijado en `openspec/config.yaml` (Node.js 22 + Express + better-sqlite3; React 19 + Vite servido por Express; SSE; sesión con contraseña de establecimiento). La motivación y el alcance están en `proposal.md`; los requisitos, en `specs/carta-publica`, `specs/catalogo` y `specs/sesion-establecimiento`.

Restricciones que más condicionan el diseño: carga en menos de 2 s en 4G con hasta 150 platos, accesibilidad para personas mayores, y la regla de simplicidad (una sola cafetería, un solo proceso, un solo fichero de base de datos).

## Objetivos / No objetivos

**Objetivos:**
- Estructura de proyecto mínima que sirva también a los cambios siguientes (pedido, cocina).
- Modelo de datos que conserve los platos archivados para que el futuro pedido los referencie.
- Una única petición de datos para pintar la carta.

**No objetivos:**
- SSE en este cambio: la carta se actualiza al recargar (la spec no exige tiempo real). El canal SSE llegará con el pedido.
- Multi-establecimiento, CDN, renderizado en servidor (SSR) o PWA.

## Decisiones

### 1. Estructura: un solo paquete con `server/` y `web/`
Un `package.json` en la raíz; `server/` (Express, API, acceso a SQLite) y `web/` (React + Vite). En producción Express sirve `web/dist` y las fotos. En desarrollo, Vite con proxy hacia Express.
*Alternativa*: monorepo con workspaces → más piezas sin beneficio para una app de este tamaño.

### 2. Modelo de datos
```
categorias(id, nombre, posicion, archivada_en NULL|fecha)
platos(id, categoria_id, nombre, precio_centimos INTEGER, descripcion,
       foto NULL|nombre_fichero, sin_alergenos INTEGER 0/1,
       agotado INTEGER 0/1 DEFAULT 0, posicion, archivado_en NULL|fecha)
plato_alergenos(plato_id, alergeno)   -- alergeno: uno de 14 códigos fijos
sesiones(token_hash, creada_en, ultimo_uso_en)
intentos_login(ip, momento)
```
- **Precio en céntimos enteros** para evitar errores de coma flotante; el formato "3,50 €" se hace con `Intl.NumberFormat('es-ES', {style:'currency', currency:'EUR'})`.
- **Archivado con `archivado_en`** (borrado lógico): las consultas de la carta y de la administración filtran `archivado_en IS NULL`. Nunca hay `DELETE` de platos ni categorías; la BD lo refuerza con un trigger `BEFORE DELETE` que aborta.
- **Recuperar** es la operación inversa: `archivado_en = NULL` y `posicion = max + 1` de su ámbito. Un plato recuperado vuelve además con `agotado = 0`; si su categoría está archivada, se exige una categoría activa de destino. Una categoría recuperada vuelve vacía (sus platos ya estaban archivados, porque solo se archiva una categoría sin platos activos) y se rechaza si su nombre coincide con el de una categoría activa.
- **Agotado** es una marca sobre un plato activo (`agotado = 1`): no cambia su posición ni su archivado; la carta lo sigue devolviendo y una categoría con todos sus platos agotados sigue considerándose no vacía.
- **Alérgenos como lista fija en código** (`server/alergenos.js`, compartida con el frontend): códigos `gluten, crustaceos, huevos, pescado, cacahuetes, soja, leche, frutos_cascara, apio, mostaza, sesamo, sulfitos, altramuces, moluscos` con su nombre en español. Una tabla `CHECK (alergeno IN (...))` garantiza que no entran otros. No se modela como tabla editable porque la lista es legal, no del dueño.
- **Coherencia de la declaración** (alérgenos XOR `sin_alergenos`) validada en el servicio dentro de una transacción; un plato no se guarda si no la cumple.
- **Orden** con un entero `posicion` por ámbito (categorías globales; platos por categoría). Subir/bajar intercambia la posición con el vecino en una transacción. *Alternativa*: arrastrar y soltar → peor en móviles y para personas mayores; los botones ↑/↓ grandes son más simples.
- Migraciones: un único fichero `schema.sql` aplicado con `CREATE TABLE IF NOT EXISTS` al arrancar y `PRAGMA user_version` para futuras versiones. SQLite en modo WAL.

### 3. API
- `GET /api/carta` (pública): devuelve en un solo JSON las categorías activas no vacías, ordenadas, con sus platos activos ordenados (nombre, precio en céntimos, descripción, URL de foto, alérgenos o `sinAlergenos`, y `agotado`). Cabecera `Cache-Control: no-cache` con `ETag`, para que recargar sea barato y siempre fresco.
- `POST /api/sesion`, `DELETE /api/sesion`, `GET /api/sesion` (estado).
- `/api/admin/categorias` y `/api/admin/platos`: `GET`, `POST`, `PATCH /:id`, `POST /:id/subir`, `POST /:id/bajar`, `POST /:id/archivar`, `POST /:id/recuperar`; `PUT|DELETE /api/admin/platos/:id/foto`. `PATCH /api/admin/platos/:id` acepta también `agotado` (true/false). `GET /api/admin/archivados` devuelve las categorías y platos archivados; `POST /api/admin/platos/:id/recuperar` acepta `{categoriaId}`, obligatorio si la categoría del plato está archivada (`422` si falta). Todo bajo un middleware que exige sesión (401 si no la hay).
- Errores de validación: `422` con `{campo, mensaje}` en español, que el formulario muestra junto al campo.

### 4. Sesión de establecimiento
- La contraseña se configura como hash en la variable de entorno `CARTAYA_PASSWORD_HASH`, generado con un script `npm run hash-password` que usa `crypto.scrypt` de Node (sin dependencias). Verificación con `crypto.timingSafeEqual`.
- Al iniciar sesión se genera un token aleatorio de 32 bytes, se guarda su SHA-256 en `sesiones` y se envía en una cookie `HttpOnly; Secure; SameSite=Strict; Path=/` de 30 días. Cada uso actualiza `ultimo_uso_en`; caduca a los 30 días sin uso.
- `SameSite=Strict` cubre CSRF para una app de un solo origen; además las rutas de admin solo aceptan `application/json` (las fotos, `image/*`).
- Límite de intentos con la tabla `intentos_login` (5 en 15 min por IP); se limpian los registros antiguos al consultar. `app.set('trust proxy', …)` configurable si se despliega detrás de un proxy.
- *Alternativa*: `express-session` → dependencia nueva para algo que son ~60 líneas con `crypto`.

### 5. Fotos
- El móvil del dueño valida tipo (JPEG/PNG/WebP) y tamaño (≤ 5 MB) antes de subir y **reduce la foto en el navegador** con `<canvas>` a 800 px de lado mayor en WebP (calidad 0,8), lo que deja ficheros de ~60–120 KB. Se sube como cuerpo binario con `express.raw({type: ['image/jpeg','image/png','image/webp'], limit: '5mb'})`.
- El servidor vuelve a validar tipo (por cabecera y por *magic bytes*) y tamaño, guarda el fichero en `data/fotos/<uuid>.<ext>` y lo sirve con `express.static` y `Cache-Control: public, max-age=31536000, immutable` (nombre nuevo en cada sustitución). Al sustituir o quitar, el fichero anterior se borra.
- *Alternativas*: `multer` para multipart y `sharp` para redimensionar en servidor → dos dependencias (una nativa) que no hacen falta si el navegador reduce la foto.
- Riesgo asumido: si el navegador no puede reducir la foto (muy antiguo), se sube el original validado de ≤ 5 MB; se sirve igualmente con `loading="lazy"`.

### 6. Rendimiento de la carta (< 2 s en 4G)
- La ruta de la carta (`/`, `/carta`, `/mesa/:id`) es un *entry* de Vite separado del de administración (`web/carta.html` y `web/admin.html`), así el cliente no descarga el código de administración. Objetivo: JS de la carta ≤ 60 KB transferidos con brotli (React incluido). Con gzip no es alcanzable con React 19 (solo React ocupa ~68 KB gzip), y cambiar de librería rompería el stack fijado.
- Los datos de la carta se piden en paralelo con el JS mediante `<link rel="preload" href="/api/carta" as="fetch" crossorigin>` en el HTML.
- Fotos con `loading="lazy"`, `width`/`height` fijos (sin saltos de maquetación) y fondo neutro mientras cargan; un `onerror` oculta la imagen para no mostrar iconos rotos.
- Express con compresión: se añade `compression` (dependencia justificada: el JSON de 150 platos se reduce ~70 %, clave en 4G; precomprimir no sirve para `/api/carta`, que cambia con el catálogo).
- Estáticos precomprimidos: tras `vite build`, un script con `zlib` de Node (sin dependencias) genera `.br` (brotli calidad 11) y `.gz` de cada JS y CSS. Express sirve la variante precomprimida según `Accept-Encoding` (con `Vary: Accept-Encoding`) y, si no hay ninguna, el original pasa por `compression`. Brotli al vuelo (calidad baja, por velocidad) no alcanza el objetivo; precomprimido sí (~58 KB). Los navegadores móviles actuales aceptan brotli por HTTPS.
- Verificación: test de rendimiento con Lighthouse CI (perfil móvil, red 4G simulada) sobre un catálogo sembrado de 150 platos con foto; umbral LCP del texto < 2 s.

### 7. Accesibilidad y estilo
- CSS propio con variables: texto base 18 px (1.125rem), tamaños en `rem`, colores con contraste ≥ 7:1 (texto casi negro sobre fondo blanco cálido), botones de 48 px mínimo, maquetación de una columna fluida para soportar zoom del 200 %.
- Alérgenos como etiquetas con **texto** (no solo iconos ni solo color) en el propio bloque del plato. "Sin alérgenos" con el mismo estilo.
- "Agotado" como etiqueta de texto con el mismo contraste ≥ 7:1; un plato agotado no se atenúa (bajaría el contraste).
- Cabecera con el nombre "La Estación" y, debajo, el aviso fijo de alergias antes de la primera categoría.
- Índice de categorías fijo arriba con enlaces de ancla.

### 8. Tests
- `node:test` + `supertest` para la API y la BD (dependencia de desarrollo justificada: probar Express sin levantar puertos); Vitest + Testing Library para componentes React (dependencias de desarrollo, encajan con Vite); Playwright para los escenarios de extremo a extremo (zoom 200 %, 360 px, contraste con `axe-core`), y Lighthouse CI para el tiempo de carga.
- Cada test lleva en su nombre el nombre exacto del escenario de la spec, p. ej. `test('Plato sin declaración de alérgenos', …)`.

### Resumen de dependencias
| Dependencia | Tipo | Justificación |
|---|---|---|
| express, better-sqlite3, react, react-dom, vite | stack fijado | — |
| compression | producción | Reduce JSON y estáticos en 4G (decisión 6). |
| supertest | desarrollo | Tests HTTP de la API. |
| vitest, @testing-library/react, jsdom | desarrollo | Tests de componentes con Vite. |
| @playwright/test, @axe-core/playwright | desarrollo | Escenarios e2e de accesibilidad y móvil. |
| @lhci/cli | desarrollo | Medir el requisito de < 2 s. |

## Riesgos / Compromisos

- [Un plato o categoría archivado por error] → confirmación antes de archivar y recuperación desde la lista de archivados de la administración.
- [Lighthouse en CI no es un móvil real] → además se hará una comprobación manual en el móvil de Andrés con 4G antes de dar el cambio por terminado.
- [Fotos en disco fuera de la BD] → la copia de seguridad debe incluir `data/` completo (BD + fotos); se documenta en el README.
- [Bloqueo por IP compartida del local] → el bloqueo dura solo 15 minutos y solo se activa con 5 fallos.
- [Cookie `Secure` en desarrollo sin HTTPS] → `Secure` solo cuando `NODE_ENV=production`.

## Plan de despliegue

Primer despliegue: instalar dependencias, `npm run build`, generar el hash con `npm run hash-password`, configurar `CARTAYA_PASSWORD_HASH` y `CARTAYA_DATA_DIR`, y arrancar `npm start`. El esquema se crea solo al arrancar. Vuelta atrás: detener el proceso; no hay datos previos que migrar.

## Preguntas abiertas

- Contenido inicial del catálogo: ¿lo carga Andrés a mano o se le prepara un script de carga desde la carta plastificada actual? No cambia specs ni diseño.
