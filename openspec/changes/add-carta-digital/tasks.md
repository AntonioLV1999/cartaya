# Tareas: carta digital

## 1. Base del proyecto

- [x] 1.1 Crear `package.json` en la raíz con las dependencias de design.md (resumen de dependencias) y los scripts `dev`, `build`, `start`, `test`, `test:e2e`, `test:perf` y `hash-password`; verificar que `npm install` termina sin errores con Node.js 22
- [x] 1.2 Crear la estructura `server/` y `web/` con Vite configurado con dos *entries* (`web/carta.html`, `web/admin.html`) y proxy `/api` hacia Express; verificar que `npm run dev` sirve ambas páginas vacías
- [x] 1.3 Crear el servidor Express (`server/app.js` exportable para tests, `server/index.js` que escucha) con `compression`, estáticos de `web/dist` y rutas `/`, `/carta`, `/mesa/:id` → carta y `/admin` → administración; verificar con un test de humo de `supertest` que las cuatro rutas responden 200
- [ ] 1.4 Configurar `node:test`, Vitest, Playwright y Lighthouse CI para que `npm test`, `npm run test:e2e` y `npm run test:perf` se ejecuten (aunque haya pocos tests); verificar que los tres comandos terminan en verde

## 2. Base de datos y alérgenos

- [x] 2.1 Escribir `server/schema.sql` con las tablas de design.md (decisión 2, incluida la columna `agotado` de platos), `CHECK` de los 14 alérgenos, triggers que impiden `DELETE` de platos y categorías, WAL y `user_version`; aplicarlo al arrancar; verificar con un test que el esquema se crea en una BD vacía y que un `DELETE FROM platos` falla
- [x] 2.2 Crear `server/alergenos.js` (compartido con `web/`) con los 14 códigos y sus nombres en español; verificar con un test que hay exactamente 14 y que coinciden con el `CHECK` del esquema
- [x] 2.3 Crear la utilidad de formato de precio (céntimos → "3,50 €") compartida; verificar con tests unitarios "Formato del precio" (12,00 €) y casos de 2,80 € y 0,05 €
- [x] 2.4 Crear un script de semilla (`npm run seed`) con un catálogo de ejemplo de La Estación y una variante de 150 platos con foto para rendimiento; verificar que se carga sin errores en una BD vacía

## 3. Sesión de establecimiento (spec `sesion-establecimiento`)

- [x] 3.1 Implementar `npm run hash-password` con `crypto.scrypt` y la verificación con `timingSafeEqual` contra `CARTAYA_PASSWORD_HASH`; verificar con tests de que una contraseña correcta valida y una incorrecta no
- [x] 3.2 Implementar `POST/GET/DELETE /api/sesion` con token aleatorio, SHA-256 en `sesiones`, cookie `HttpOnly; SameSite=Strict` (`Secure` en producción) y caducidad de 30 días sin uso; verificar con tests "Contraseña correcta", "Contraseña incorrecta", "La sesión se mantiene", "Caducidad por inactividad" y "Cerrar la sesión"
- [x] 3.3 Implementar el límite de 5 intentos fallidos en 15 minutos por IP con `intentos_login`; verificar con el test "Bloqueo tras 5 intentos fallidos"
- [x] 3.4 Implementar el middleware que exige sesión en `/api/admin/*` (401 sin sesión); verificar con el test "Modificación sin sesión rechazada" sobre cada ruta de administración
- [x] 3.5 Verificar con el test "Sin contraseña en claro" que, tras varios inicios de sesión, la contraseña no aparece en la BD, en la configuración ni en la salida de registros del servidor
- [x] 3.6 Crear la pantalla de inicio de sesión de `admin.html` (campo de contraseña, mensaje "Contraseña incorrecta", aviso de bloqueo) y el botón "Cerrar sesión"; verificar con el test e2e "Acceso sin sesión"
- [ ] 3.7 Documentar en `README.md` cómo generar el hash y configurar `CARTAYA_PASSWORD_HASH`; verificar que siguiendo el README se inicia sesión en una instalación limpia

## 4. API del catálogo (spec `catalogo`)

- [x] 4.1 Implementar `/api/admin/categorias` (listar activas, crear, renombrar, subir, bajar, archivar) con validaciones y errores `422 {campo, mensaje}` en español; verificar con tests "Crear una categoría", "Nombre de categoría vacío", "Nombre de categoría repetido", "Renombrar una categoría", "Subir una categoría", "Archivar una categoría vacía" y "Archivar una categoría con platos activos"
- [x] 4.2 Implementar `/api/admin/platos` (listar activos por categoría, crear, editar, mover de categoría al final, subir, bajar, archivar) con validación de nombre, precio (> 0, máximo dos decimales) y descripción (≤ 140); verificar con tests "Crear un plato", "Precio no válido", "Descripción demasiado larga", "Cambiar el precio de un plato", "Mover un plato a otra categoría", "Bajar un plato" y "Archivar un plato" (incluido que el plato archivado conserva nombre, precio y alérgenos en la BD)
- [x] 4.3 Implementar la validación de la declaración de alérgenos (alérgenos XOR "Sin alérgenos") en una transacción; verificar con tests "Plato sin declaración de alérgenos", "Declaración contradictoria" y "Plato declarado sin alérgenos"
- [x] 4.4 Implementar `PUT/DELETE /api/admin/platos/:id/foto` con `express.raw`, límite de 5 MB, comprobación de tipo por cabecera y *magic bytes*, guardado en `data/fotos/<uuid>.<ext>`, borrado del fichero anterior y servido estático con caché inmutable; verificar con tests "Subir una foto válida", "Foto demasiado grande", "Formato no admitido" y "Quitar la foto" (API)
- [x] 4.5 Aceptar `agotado` en `PATCH /api/admin/platos/:id` sin cambiar posición ni archivado; verificar con tests "Marcar un plato como agotado" y "Volver a marcar un plato disponible"
- [x] 4.6 Implementar `GET /api/admin/archivados` y `POST /api/admin/categorias/:id/recuperar` y `POST /api/admin/platos/:id/recuperar` (al final de su ámbito, plato con `agotado = 0`, `categoriaId` obligatorio si su categoría está archivada, nombre de categoría único entre activas); verificar con tests "Ver los archivados", "Recuperar un plato", "Recuperar un plato de una categoría archivada", "Recuperar una categoría" y "Recuperar una categoría con nombre repetido"

## 5. API de la carta pública (spec `carta-publica`)

- [x] 5.1 Implementar `GET /api/carta` (pública, sin sesión) con categorías activas no vacías ordenadas y sus platos activos ordenados (con su marca `agotado`), con `ETag` y `Cache-Control: no-cache`; verificar con tests "Consulta de la carta sin identificación", "Categorías en el orden del dueño", "Platos en el orden manual de su categoría", "Categoría sin platos activos oculta", "Se muestran todos los platos activos", "Un plato archivado no aparece" y "Categoría con todos sus platos agotados"
- [x] 5.2 Verificar con un test de API que cada plato de `/api/carta` trae al menos un alérgeno o `sinAlergenos: true` (base de "Ningún plato sin información de alérgenos")

## 6. Interfaz de la carta pública

- [x] 6.1 Crear la hoja de estilos propia con variables (texto base 18 px en `rem`, contraste ≥ 7:1, botones ≥ 48 px, una columna fluida); verificar con `axe-core` en Playwright que no hay fallos de contraste AAA
- [x] 6.2 Crear `carta.html` con `<link rel="preload" href="/api/carta">` y los componentes de cabecera ("La Estación" y aviso de alergias), índice de categorías, categoría y plato (nombre, precio formateado, descripción, foto `loading="lazy"` con dimensiones fijas y ocultación si falla, alérgenos como etiquetas de texto o "Sin alérgenos", etiqueta "Agotado"); verificar con tests de componente "Nombre del establecimiento en la cabecera", "Aviso de alergias visible", "Plato con todos sus datos", "Plato sin foto", "Plato con alérgenos", "Plato sin alérgenos" y "Plato agotado en la carta"
- [x] 6.3 Verificar con tests e2e en 360 px: "Entrada desde el QR de una mesa", "Sin registro del cliente final", "Ningún plato sin información de alérgenos", "Navegación entre categorías", "Tamaño de texto y contraste", "Texto ampliado" y "Los cambios del catálogo se reflejan al recargar"
- [ ] 6.4 Verificar con Lighthouse CI (perfil móvil, 4G simulado, semilla de 150 platos con foto) los escenarios "Carga en móvil de gama media con 4G" y "Las fotos no bloquean el texto", y que el JS de la carta pesa ≤ 60 KB transferidos con brotli
- [ ] 6.5 Precomprimir en el build los JS y CSS (`.br` calidad 11 y `.gz`) con `zlib` y servir desde Express la variante que acepte el navegador, con `Vary: Accept-Encoding`; verificar con tests de `supertest` que se sirve `.br`, `.gz` o el original según `Accept-Encoding` con el `Content-Type` correcto

## 7. Interfaz de administración

- [x] 7.1 Crear la lista de categorías activas con crear, renombrar, subir/bajar y eliminar con confirmación (mostrando el aviso si tiene platos activos); verificar con tests de componente de los errores en español junto al campo
- [x] 7.2 Crear la lista de platos por categoría y el formulario de plato (nombre, precio en euros, descripción con contador de 140, categoría, los 14 alérgenos con nombre escrito y la casilla "Sin alérgenos"); verificar con el test "Lista de alérgenos disponible" y "Cancelar el archivado"
- [x] 7.3 Implementar en el navegador la validación de foto (tipo y ≤ 5 MB) y su reducción con `<canvas>` a 800 px en WebP antes de subirla, con vuelta al original si el navegador no puede; verificar con un test de componente que una imagen grande se sube reducida y que un PDF o una foto de 8 MB se rechazan con su mensaje
- [x] 7.4 Verificar con el test e2e "Gestión completa desde el móvil" (360 px, botones ≥ 48 px, sin desplazamiento horizontal) recorriendo crear, editar, ordenar y archivar categorías y platos, marcar un plato como agotado, recuperar un archivado y subir una foto
- [x] 7.5 Añadir en la lista de platos un botón grande para marcar como agotado / disponible, con el estado visible en texto; verificar con un test de componente que el botón cambia el estado y la etiqueta
- [x] 7.6 Crear la lista de archivados (categorías y platos) con el botón "Recuperar", el selector de categoría activa cuando la del plato está archivada y el error de nombre repetido junto a la categoría; verificar con tests de componente de cada caso

## 8. Verificación integrada

- [ ] 8.1 Ejecutar `npm test`, `npm run test:e2e` y `npm run test:perf` y verificar que todos pasan y que cada escenario de las tres specs tiene un test con su mismo nombre (comprobación por script que cruza los nombres de `#### Scenario:` con los nombres de test)
- [ ] 8.2 Comprobar a mano en un móvil real con 4G que la carta carga en menos de 2 s y que la administración se usa con comodidad; anotar el resultado en el PR
- [ ] 8.3 Documentar en `README.md` el arranque, la semilla y la copia de seguridad de `data/` (BD + fotos); verificar que el README permite levantar el proyecto desde cero

## Seguimiento del flujo

- Confirmar con Andrés los supuestos marcados en proposal.md antes de archivar el cambio.
- Archivar el cambio con `/opsx:archive` cuando esté implementado y verificado.
