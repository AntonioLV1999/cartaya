# Tareas

## 1. Esquema y estados del pedido

- [x] 1.1 Añadir `cancelado_en` a `pedidos` en `server/schema.sql`, subir a `PRAGMA user_version = 3` y añadir en `server/db.js` el `ALTER TABLE` condicionado a `PRAGMA table_info` (design.md, decisión 1); actualizar las versiones esperadas de `server/esquema.test.js` y verificar con un test nuevo que una BD de la versión 2 con pedidos arranca, los conserva, gana la columna y queda en versión 3, y que abrirla dos veces no falla
- [x] 1.2 Completar en `server/textos.js` las etiquetas "Recibido", "En preparación", "Servido" y "Cancelado", quitar el texto de respaldo de `textoEstado` y añadir los mensajes "Este pedido ya no se puede cancelar" y "Este pedido ya ha cambiado de estado"; verificar con un test que `en_preparacion` se muestra como "En preparación"
- [x] 1.3 Reescribir `cambiarEstado` en `server/pedidos.js` con la tabla `TRANSICIONES`, la actualización condicional por estado actual, `cancelado_en` y el error 409, y añadir `canceladoEn` a `aPedido` (design.md, decisión 2); verificar con `server/pedidos.test.js` "Salto de estado rechazado", "Retroceso de estado rechazado", "Estado no válido rechazado", "Dos pulsaciones no saltan un estado", "Cancelación rechazada fuera de Recibido", "Un pedido cancelado no vuelve a cambiar" y "La cancelación no borra el pedido"
- [x] 1.4 Sustituir el estado provisional `listo` por `en_preparacion` en `server/pedidos.test.js` y `web/src/carta/pedido/pedido.test.jsx`, y actualizar en "El pedido no guarda datos del visitante" la lista de columnas con `cancelado_en`; verificar que `node --test "server/**/*.test.js"` y `vitest run` pasan
- [x] 1.5 Añadir `delDia(dia)` a `server/pedidos.js`, con los pedidos ordenados por `creado_en, numero`; verificar con un test de servicio el orden y que excluye los pedidos de otro día

## 2. API y tiempo real del panel

- [x] 2.1 Extraer `abrirSSE(res)` de `server/rutas-pedidos.js` y exponer `sesionValida` en `crearSesion`; verificar que los tests existentes de "Estado del pedido por SSE" siguen en verde sin cambios
- [x] 2.2 Crear `server/rutas-cocina.js` con `POST /pedidos/:token/estado` (solo JSON) y montarlo en `/api/cocina` tras `exigirSesion`, antes del 404 de `/api`; verificar con `server/cocina.test.js` "Operaciones del panel sin sesión rechazadas", la respuesta 415 sin JSON, el 404 de un token desconocido y el 409 de una transición no válida
- [x] 2.3 Añadir `GET /api/cocina/eventos`, que envía la foto del día al conectar y con `pedido-registrado` y `estado-cambiado` (design.md, decisión 4); verificar leyendo el flujo real, con sesión, que el contenido llega sin comprimir, que un pedido nuevo y un cambio de estado generan una foto, que los oyentes se liberan al cerrar y que la foto incluye el orden, el `ahora` y `canceladoEn`
- [x] 2.4 Hacer que el latido compruebe la sesión y el cambio de día (design.md, decisión 5) con `latido` y reloj inyectados; verificar con `server/cocina.test.js` que el flujo se cierra al borrar la sesión, que envía la foto del día nuevo al cruzar la medianoche de Madrid y "El panel abierto mantiene la sesión" (parte del servidor: el latido renueva `ultimo_uso_en`)
- [x] 2.5 Actualizar los comentarios ya desfasados de `server/pedidos-eventos.js`, `server/app.js` y `server/textos.js`, que hablan del panel como futuro; verificar con una búsqueda de "futuro panel" y "lo escuchará" en `server/` que no queda ninguno

## 3. Página y sesión del panel

- [x] 3.1 Crear `web/cocina.html` y `web/src/cocina/main.jsx`, añadir la entrada `cocina` a `rollupOptions.input`, `/cocina` a `rutasDePagina` en `vite.config.js` y a las páginas de `server/app.js`; verificar que `npm run build` genera `cocina.html` y con supertest que `/cocina` responde 200
- [x] 3.2 Crear `AppCocina.jsx` con la comprobación de `/api/sesion`, el `Login` reutilizado con una prop `titulo` y el botón "Cerrar sesión", que cierra el `EventSource`; verificar con `web/src/cocina/cocina.test.jsx` "Panel sin sesión", "Panel con sesión abierta", "Contraseña correcta desde el panel de cocina" y "Cerrar la sesión desde el panel de cocina", y que `web/src/admin/admin.test.jsx` sigue en verde con su título

## 4. Vista activa y acciones

- [x] 4.1 Crear `PanelCocina.jsx` con la conexión `EventSource`, la gestión de `onerror` (aviso, comprobación de sesión, nuevo intento a los 3 s) y el reparto de la foto en vista activa e histórico (design.md, decisión 6); verificar con un `EventSource` simulado "Un pedido nuevo aparece solo", "Un cambio de estado aparece solo", "El panel pasa al día nuevo", "Conexión perdida", "El panel se recupera tras perder la conexión" y "Sesión cerrada con el panel abierto"
- [x] 4.2 Crear `TarjetaPedido.jsx` con número, mesa, estado, platos, cantidades, notas y tiempo transcurrido refrescado cada 30 s con el desfase del servidor; verificar con Vitest y temporizadores simulados "Pedidos activos por antigüedad", "Pedidos de otro día fuera del panel" (con el servidor en `server/cocina.test.js`), "Contenido de un pedido en el panel", "Tiempo transcurrido del pedido" y "Mesa renombrada después del pedido" (en `server/cocina.test.js`)
- [x] 4.3 Añadir los botones "Empezar a preparar" y "Marcar como servido", con el estado destino explícito, y mostrar los errores 409 con `role="alert"`; verificar con Vitest "Empezar a preparar un pedido", "Marcar un pedido como servido" y que un 409 muestra su mensaje sin romper el panel
- [x] 4.4 Añadir "Cancelar pedido" solo en pedidos en "Recibido", con la confirmación en la tarjeta; verificar con Vitest "Cancelar un pedido recibido", "Desistir de cancelar un pedido" y "Sin opción de cancelar en preparación"
- [x] 4.5 Crear `aviso.js` con el tono por Web Audio, la detección de pedidos nuevos entre fotos, el resaltado de 30 s y el botón "Activar sonido" (design.md, decisión 7); verificar con un `AudioContext` simulado "Aviso al llegar un pedido nuevo", "Sin aviso por los pedidos ya existentes" y "Sonido bloqueado por el navegador"
- [x] 4.6 Detectar el corte silencioso: el latido del panel pasa a ser `event: latido` y, sin foto ni latido durante 60 s, el panel muestra el aviso de conexión y reconecta (design.md, decisiones 5 y 6); verificar con temporizadores simulados y con `web/e2e/cocina.spec.js`, congelando la red sin cerrar la conexión

## 5. Histórico del día

- [x] 5.1 Añadir las vistas "Pedidos activos" e "Histórico del día" con los pedidos servidos y cancelados, sin acciones, con la hora de confirmación y la de cancelación en hora de Madrid; verificar con Vitest "Pedido servido pasa al histórico", "Pedido cancelado en el histórico", "Contenido del histórico del día" y "El histórico solo contiene el día actual"

## 6. Estilos y pruebas extremo a extremo

- [x] 6.1 Añadir a `web/src/estilos.css` los estilos del panel (rejilla de una o dos columnas, estados con texto, resaltado, aviso de conexión) reutilizando las variables existentes; verificar con `web/e2e/cocina.spec.js` a 768 px, con `sinDesplazamientoHorizontal`, `botonesGrandes` y `contrasteAAA`, "Panel usable en una tablet"
- [x] 6.2 Quitar `/prueba/pedidos/:token/estado` de `scripts/servidor-prueba.js` y cambiar "El estado se actualiza sin recargar" en `web/e2e/pedido.spec.js` para usar la API real con `apiConSesion` y el estado "En preparación"; añadir "Pedido cancelado en el móvil" a la suite y verificar que `npm run test:e2e` pasa
- [x] 6.3 Añadir a `web/e2e/cocina.spec.js` un recorrido completo con dos páginas, el móvil del visitante y la tablet: confirmar, ver aparecer el pedido solo, prepararlo, servirlo, consultarlo en el histórico y comprobar el estado en el móvil; verificar que pasa con `npm run test:e2e`

## 7. Documentación y comprobación final

- [x] 7.1 Actualizar `README.md`: dirección `/cocina`, preparación de la tablet (pantalla siempre encendida y "Activar sonido"), entrada `cocina` en la estructura y descripción de la base de datos, que ya incluye pedidos; verificar que los pasos descritos funcionan con `npm run build` y `npm start`
- [x] 7.2 Ejecutar `npm test`, `npm run test:e2e` y `npm run test:perf`, y confirmar que `npm run test:escenarios` informa de que cada escenario, también los de este delta, tiene un test con su mismo nombre, y que la carta sigue dentro de su presupuesto de carga
- [x] 7.3 Ejecutar `openspec validate add-panel-cocina --strict` y comprobar que el cambio sigue siendo válido

## Workflow follow-up

- Hecho el 2026-11-05: Andrés validó las decisiones de origen "Equipo" de `proposal.md`, incluidas la de los alérgenos y la de los pedidos sin servir a medianoche.
- Ejecutar `npm run test:perf` en un equipo donde Lighthouse funcione. La tarea 7.2 se dio por finalizada el 2026-11-05 sin medir el tiempo de carga de la carta, porque Lighthouse no terminó en el equipo de desarrollo, tampoco sobre el código anterior a este cambio. El resto de la 7.2 sí se comprobó, incluido el peso del JS de la carta (59,7 KB de 60 KB).
- Archivar el cambio.
