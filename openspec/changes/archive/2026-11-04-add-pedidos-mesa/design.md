# Diseño: pedidos desde la mesa

## Contexto

Estado actual (cambio `add-carta-digital`, archivado): Express sirve `GET /api/carta` (pública), `/api/sesion` y `/api/admin/*` tras `sesion.exigirSesion`; las páginas `/`, `/carta` y `/mesa/:id` sirven el mismo `carta.html`, sin leer el identificador. SQLite con `schema.sql` idempotente (`PRAGMA user_version = 1`), precios en céntimos, platos y categorías con borrado lógico y triggers que impiden `DELETE`. El frontend tiene dos *entries* de Vite (`carta` y `admin`); el JS de la carta está en ~58 KB brotli frente a un presupuesto de 60 KB (requisito de carga < 2 s). `scripts/comprobar-escenarios.js` exige un test con el nombre exacto de cada escenario, también de los deltas de cambios en curso.

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/mesas`, `specs/pedido-mesa` y el delta de `specs/carta-publica`.

## Objetivos / No objetivos

**Objetivos:**
- Modelo de pedido que el futuro `panel-cocina` pueda leer y hacer avanzar de estado sin migrar datos.
- Validación del pedido íntegramente en el servidor, en una transacción, contra el catálogo vigente.
- Canal SSE reutilizable: lo usa ya la confirmación del visitante y lo usará la cocina.
- Mantener la carta por debajo del presupuesto de carga.

**No objetivos:**
- Estados distintos de "recibido" y operaciones para cambiarlos (llegan con `panel-cocina`).
- Sincronizar un pedido en curso entre móviles, o guardar pedidos en curso en el servidor.
- Protección antiabuso más allá de códigos no adivinables y límites de tamaño (ver riesgos).

## Decisiones

### 1. Modelo de datos (esquema versión 2)
```
mesas(id, nombre, codigo TEXT UNIQUE, archivada_en NULL|fecha)
pedidos(id, mesa_id → mesas, dia TEXT 'AAAA-MM-DD' (Madrid), numero INTEGER,
        token TEXT UNIQUE, estado TEXT NOT NULL DEFAULT 'recibido',
        total_centimos INTEGER, creado_en INTEGER,
        UNIQUE(dia, numero))
pedido_lineas(pedido_id → pedidos, posicion, plato_id → platos,
              nombre TEXT, precio_centimos INTEGER, cantidad INTEGER CHECK 1..20,
              nota TEXT NOT NULL DEFAULT '' CHECK length <= 140,
              PRIMARY KEY (pedido_id, posicion))
```
- Se añaden a `schema.sql` con `CREATE TABLE IF NOT EXISTS`; las tablas existentes no cambian, así que basta subir `PRAGMA user_version = 2` (no hay datos que transformar). Trigger `BEFORE DELETE` en `mesas`, como en platos y categorías.
- **Copia de nombre y precio en cada línea** (decisión de precio histórico del cambio anterior): editar o archivar un plato o renombrar la mesa no altera el pedido. `plato_id` se guarda para estadísticas futuras y para que cocina enlace con alérgenos.
- **`estado` sin `CHECK`**: hoy solo vale `'recibido'`, validado en código. Un `CHECK` obligaría a reconstruir la tabla en SQLite cuando `panel-cocina` añada estados. *Alternativa*: tabla de estados → más piezas sin beneficio.
- **Sin columnas de IP, navegador ni sesión** en `pedidos` (requisito "Confirmación sin datos personales"). Express no registra peticiones; el manejador de errores ya no vuelca cuerpos y no se añade ningún *logger*.
- **Número del día**: dentro de la transacción de creación, `numero = COALESCE(MAX(numero), 0) + 1 WHERE dia = ?`. `dia` se calcula con `Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' })` sobre el reloj inyectable `ahora` (los tests fijan medianoche). better-sqlite3 es síncrono y la transacción es `IMMEDIATE`, así que no hay carreras entre dos móviles; `UNIQUE(dia, numero)` lo garantiza igualmente.

### 2. Códigos de mesa y enlaces de pedido
- **Código de mesa**: 10 caracteres de `crypto.randomBytes` sobre el alfabeto `23456789abcdefghjkmnpqrstuvwxyz` (sin 0/o, 1/l/i, para poder dictarlo si hace falta): ~49 bits, inviable de adivinar por fuerza bruta contra un servidor de cafetería. Se genera al crear la mesa, se reintenta si colisiona con `UNIQUE` y nunca se reutiliza (las mesas archivadas conservan el suyo).
- **Token del pedido**: 16 bytes aleatorios en base64url. Es el enlace secreto de la confirmación (`/mesa/<código>/pedidos/<token>`); no se deduce de la mesa ni del número. Se guarda tal cual: solo da acceso a ver un pedido sin datos personales, no a modificar nada, así que no merece hash (a diferencia de la sesión de establecimiento).
- *Alternativa*: número de mesa en la URL → descartada por Andrés (cualquiera podría pedir para la mesa 7 desde casa).

### 3. API pública
| Método y ruta | Uso |
|---|---|
| `GET /api/mesas/:codigo` | `{nombre}` si la mesa está activa; `404` si no existe o está archivada (la carta pasa a solo consulta). |
| `POST /api/mesas/:codigo/pedidos` | Confirma un pedido. Cuerpo: `{lineas: [{platoId, cantidad, nota, precioCentimos}]}`. |
| `GET /api/pedidos/:token` | Confirmación: número, mesa, líneas, total, estado. `404` si el token no existe. |
| `GET /api/pedidos/:token/eventos` | SSE con el estado del pedido. |

Respuestas de `POST …/pedidos`:
- `201` con el pedido registrado (incluye `token` y `numero`).
- `409 {motivo: 'carta-cambiada', retirados: [{platoId, nombre}], precios: [{platoId, nombre, precioCentimos}]}`: algún plato no está activo, está agotado o su categoría está archivada, o el `precioCentimos` enviado no coincide con el vigente. **No se registra nada.** Se devuelven ambas listas a la vez para que el visitante corrija todo en un único paso.
- `410 {mensaje: 'Esta mesa ya no admite pedidos. Avise a nuestro personal'}` si la mesa está archivada; `404` si el código no existe.
- `422 {campo, mensaje}` para cantidades fuera de 1..20, más de 30 líneas, nota de más de 140 caracteres, `platoId` repetido o pedido vacío.
- La validación y la inserción ocurren en **una sola transacción** que lee los platos vigentes; así es imposible registrar un plato archivado o con precio distinto entre la comprobación y la escritura.
- El `precioCentimos` que envía el cliente es solo el **precio que vio**, para detectar cambios; el pedido siempre se registra con el precio leído del catálogo en la transacción.
- CSRF y abuso básico: la ruta solo acepta `application/json` (un formulario de otra web no puede enviarlo sin *preflight* CORS, que no se habilita) y `express.json({limit: '20kb'})`.
- El nombre "visible" de la mesa en la carta sale de `GET /api/mesas/:codigo` en paralelo con `/api/carta` (se añade al `preload` del HTML solo cuando la ruta es de mesa); `/api/carta` no cambia y sigue siendo cacheable por `ETag`.

### 4. Tiempo real con SSE
- Un emisor en memoria (`EventEmitter` de Node) en `server/pedidos-eventos.js` con los eventos `pedido-registrado` y `estado-cambiado`. El servicio de pedidos emite tras confirmar la transacción.
- `GET /api/pedidos/:token/eventos` responde `text/event-stream`, envía el estado actual nada más conectar (así el móvil se corrige solo tras una reconexión) y después cada `estado-cambiado` de ese pedido. Comentario `: latido` cada 25 s para que los proxies no corten la conexión; se libera el oyente al cerrarse.
- Hoy ningún flujo cambia el estado; el servicio expone `cambiarEstado(token|id, estado)` interno, usado por los tests del escenario "El estado se actualiza sin recargar" y, después, por `panel-cocina`. `compression` debe desactivarse para esta ruta (si no, almacena el flujo): se filtra por `Content-Type`.
- En el navegador, `EventSource` nativo (reconecta solo). *Alternativas*: *polling* o WebSockets → excluidos por el stack fijado.

### 5. Frontend de la carta
- **Rutas** (sin librería de enrutado, por presupuesto de JS): `AppCarta` lee `location.pathname`: `/carta` o `/` → solo consulta; `/mesa/:codigo` → carta con pedido; `/mesa/:codigo/pedidos/:token` → confirmación. El resumen es una vista dentro de la misma página (estado de React + `history.pushState` para que "atrás" vuelva a la carta). Express añade `/mesa/:codigo/pedidos/:token` a las rutas que sirven `carta.html`.
- **Pedido en curso en `localStorage`** bajo la clave `cartaya:pedido:<código>` (`[{platoId, nombre, precioCentimos, alergenos, sinAlergenos, cantidad, nota}]`); se lee al arrancar y se escribe en cada cambio. Al cargar, las líneas cuyo plato ya no aparezca en la carta se mantienen hasta confirmar: la retirada la decide el servidor, en un único sitio (decisión 3). Si `localStorage` no está disponible (navegación privada antigua), el pedido funciona solo en memoria.
- **Mis pedidos** en `cartaya:mis-pedidos:<código>`: `[{token, numero, dia}]`, filtrando al leer los de días anteriores. La carta de la mesa muestra "Mis pedidos de hoy" con enlace a cada confirmación.
- **Al recibir `409`**: se aplican `retirados` y `precios` al pedido en curso, se muestra un aviso con `role="alert"` que nombra cada plato ("Croquetas ya no está disponible y se ha retirado de su pedido"; "Café con leche ha cambiado de precio") y se vuelve al resumen; si queda vacío, se indica y se ofrece volver a la carta.
- **Componentes**: `Plato` recibe un `alAñadir` opcional; sin él (carta sin mesa) no hay botón, lo que reutiliza el mismo componente en ambos modos. Barra fija inferior "N platos · total — Ver mi pedido". Resumen con controles − / + de 48 px con `aria-label` ("Quitar un Café con leche"), `textarea` de nota con `maxLength=140` y contador. La confirmación muestra el número de pedido a ≥ 2,5 rem.
- **Presupuesto de JS**: el código del pedido se carga con `import()` dinámico solo en rutas de mesa, de modo que `/carta` no crece. En `/mesa/:codigo` el texto de la carta se pinta antes de cargar el trozo del pedido (el botón "Añadir" aparece al llegar, en milisegundos). El test de rendimiento existente se amplía a una ruta de mesa.

### 6. Administración de mesas
- `GET/POST /api/admin/mesas`, `PATCH /api/admin/mesas/:id` (`{nombre}`), `POST /api/admin/mesas/:id/archivar`, `GET /api/admin/mesas/:id/qr.svg`, bajo `exigirSesion` y el filtro JSON existentes. Validaciones con `ErrorValidacion` (422) como en el catálogo.
- Sección "Mesas" en la administración: lista con nombre, botones "Renombrar", "Ver QR" y "Eliminar" (con confirmación), y "Imprimir todos los QR". La impresión es una vista con una hoja por mesa (`@media print`, `break-after: page`) con el QR a ~8 cm, el nombre y "Escanee para ver la carta y pedir"; se imprime con el diálogo del navegador (`window.print()`).
- **Dirección pública** para componer la URL del QR: variable de entorno `CARTAYA_URL_PUBLICA` (p. ej. `https://laestacion.cartaya.es`); si falta, se usa el origen de la petición (válido en desarrollo). Se documenta en el README.

### 7. Generación del QR — dependencia nueva
Se añade **`qrcode-generator`** (producción) para generar el SVG del QR en el servidor.
- *Justificación*: codificar QR exige Reed-Solomon, selección de máscara y tablas de versiones (~600 líneas delicadas que habría que probar contra lectores reales); un QR mal generado es un QR impreso inservible. La librería es JavaScript puro, sin dependencias, licencia MIT, ~20 KB, estable desde hace años, y solo se usa en el servidor (no afecta al presupuesto de la carta).
- *Alternativas*: `qrcode` → arrastra dependencias de CLI y PNG que no se usan; generar el QR en el navegador del dueño → mete la librería en el *bundle* de administración sin ventaja; servicio externo de QR → filtra los códigos de mesa a un tercero.
- Nivel de corrección de errores **M** (resiste manchas de café en la pegatina sin hacer el QR demasiado denso).

### 8. Tests
- `node:test` + `supertest` para la API de mesas y pedidos (validaciones, 409/410/422, transacción, número del día con reloj inyectado, ausencia de datos personales revisando columnas y filas, SSE leyendo el flujo de la respuesta).
- Vitest + Testing Library para el pedido en curso, `localStorage`, resumen, aviso de retirada y confirmación.
- Playwright para los flujos completos desde `/mesa/<código>`, la impresión de QR (decodificando el SVG generado con el propio test para comprobar la URL) y la accesibilidad a 360 px y 200 % con `axe-core`.
- Cada test lleva el nombre exacto de su escenario; `npm run test:escenarios` ya incluye los deltas de cambios en curso.

### Resumen de dependencias
| Dependencia | Tipo | Justificación |
|---|---|---|
| qrcode-generator | producción | Generar el QR de cada mesa (decisión 7). |
| — | desarrollo | Ninguna nueva. Para decodificar el QR en el test e2e se usa `BarcodeDetector` de Chromium en Playwright; si no está disponible, se compara el SVG con la matriz que genera la propia librería para la URL esperada. |

## Riesgos / Compromisos

- [Alguien fotografía un QR y pide desde fuera del local] → el código no se adivina, pero se puede copiar. Si ocurre, el dueño archiva la mesa y crea otra con QR nuevo. Los pedidos sin pago previo ya tienen este riesgo con el camarero; cocina verá la mesa y la hora.
- [Bromas con pedidos enormes] → límites de 20 unidades y 30 platos distintos por pedido y cuerpo máximo de 20 KB.
- [Conexiones SSE abiertas consumen memoria] → como mucho una por móvil con confirmación abierta, decenas en un local; el oyente se libera al cerrar y hay latido para detectar cortes.
- [Un despliegue detrás de un proxy que almacena respuestas] → `Cache-Control: no-cache` y `X-Accel-Buffering: no` en el flujo SSE.
- [Presupuesto de JS de la carta superado] → carga diferida del pedido (decisión 5) y verificación con el test de rendimiento en `/carta` y en una ruta de mesa.
- [`localStorage` borrado por el navegador] → se pierde el pedido en curso o la lista de "mis pedidos", nunca un pedido registrado; el visitante puede pedir al personal su número.
- [Reloj del servidor mal configurado altera el número del día] → el número usa la zona `Europe/Madrid` explícita, no la del sistema; se documenta mantener NTP activo.

## Plan de despliegue

1. `npm install` (añade `qrcode-generator`), `npm run build`.
2. Configurar `CARTAYA_URL_PUBLICA` con la dirección pública del local.
3. Arrancar: el esquema crea las tablas nuevas y pasa a `user_version = 2` sin tocar datos existentes.
4. El dueño crea las mesas, imprime los QR y los coloca. Los QR antiguos de prueba con `/mesa/<número>` (si los hubiera) pasan a carta de solo consulta.
Vuelta atrás: desplegar la versión anterior; las tablas nuevas quedan sin usar y no interfieren con la carta.

## Preguntas abiertas

- Formato físico de los QR (pegatina, metacrilato, tamaño): no cambia el diseño; la hoja de impresión es A4 con un QR por hoja y se puede ajustar en CSS.
