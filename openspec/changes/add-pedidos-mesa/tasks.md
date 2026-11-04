# Tareas

## 1. Esquema y dependencia

- [ ] 1.1 Añadir a `server/schema.sql` las tablas `mesas`, `pedidos` y `pedido_lineas`, el trigger que impide borrar mesas y `PRAGMA user_version = 2` (design.md, decisión 1); verificar con `server/esquema.test.js` que una BD de la versión 1 con datos arranca, conserva sus platos y queda en versión 2
- [ ] 1.2 Añadir `qrcode-generator` a `dependencies` y registrar su justificación en el README; verificar que `npm install` y `npm test` siguen en verde

## 2. Mesas (servidor)

- [ ] 2.1 Crear `server/mesas.js` con crear, renombrar, archivar, listar activas y buscar por código, generación de códigos de 10 caracteres sin reutilización y validaciones de nombre (obligatorio, ≤ 30, único entre activas sin distinguir mayúsculas); verificar con `server/mesas.test.js` los escenarios "Crear una mesa", "Nombre de mesa vacío", "Nombre de mesa demasiado largo", "Nombre de mesa repetido", "Códigos de mesa distintos y no adivinables", "Renombrar una mesa conserva su QR", "Archivar una mesa" y "Crear una mesa con el nombre de una archivada"
- [ ] 2.2 Generar el SVG del QR de una mesa con `qrcode-generator` (nivel M) apuntando a `<CARTAYA_URL_PUBLICA>/mesa/<código>`, con el origen de la petición como respaldo; verificar con un test que la matriz del SVG coincide con la generada para la URL esperada
- [ ] 2.3 Montar `/api/admin/mesas` (`GET`, `POST`, `PATCH /:id`, `POST /:id/archivar`, `GET /:id/qr.svg`) tras `exigirSesion`; verificar con supertest "Gestión de mesas sin sesión rechazada" y que las respuestas sin sesión no contienen ningún código
- [ ] 2.4 Montar `GET /api/mesas/:codigo` pública (`{nombre}` o 404 si no existe o está archivada) y documentar `CARTAYA_URL_PUBLICA` en el README; verificar con supertest los casos de mesa activa, archivada e inexistente

## 3. Mesas (administración)

- [ ] 3.1 Añadir la sección "Mesas" a la administración (lista, crear, renombrar, eliminar con confirmación, ver QR) con mensajes de error junto al campo; verificar con Vitest "Cancelar el archivado de una mesa" y "QR de una mesa"
- [ ] 3.2 Crear la vista de impresión con una hoja por mesa (QR, nombre y "Escanee para ver la carta y pedir") para una mesa o todas; verificar con Vitest "Imprimir todos los QR"
- [ ] 3.3 Verificar con Playwright y axe-core a 360 px "Gestión de mesas desde el móvil", y que el QR mostrado decodifica a la dirección de mesa (design.md, decisión 8)

## 4. Pedidos (servidor)

- [ ] 4.1 Crear `server/pedidos.js` con la confirmación en una transacción `IMMEDIATE`: validación de límites (1..20 unidades, ≤ 30 platos, nota ≤ 140 recortada, sin repetidos, no vacío), comprobación de mesa activa, platos activos no agotados con categoría activa y precio visto, copia de nombre y precio, total, número del día en hora de Madrid y token; verificar con `server/pedidos.test.js` "Pedido fuera de límites rechazado", "Pedido con nota demasiado larga rechazado", "Pedido registrado en estado Recibido", "El pedido conserva el precio confirmado", "Números correlativos del día", "El número vuelve a empezar cada día" (reloj inyectado), "Pedir el postre después" y "Dos móviles en la misma mesa"
- [ ] 4.2 Devolver `409 carta-cambiada` con `retirados` y `precios` sin registrar nada, y `410` para mesa archivada; verificar con supertest "Plato archivado mientras se decide", "Plato agotado mientras se decide", "Todos los platos retirados", "Precio cambiado mientras se decide" y "Confirmar en una mesa archivada" (parte del servidor)
- [ ] 4.3 Montar `POST /api/mesas/:codigo/pedidos` (solo JSON, límite 20 KB) y `GET /api/pedidos/:token`; verificar con supertest "Un pedido no se consulta por su número" y "El pedido no guarda datos del visitante" (revisando columnas y filas: sin IP ni navegador)
- [ ] 4.4 Crear el emisor `server/pedidos-eventos.js`, `cambiarEstado` interno y `GET /api/pedidos/:token/eventos` (estado inicial al conectar, latido cada 25 s, sin compresión, `X-Accel-Buffering: no`, liberación al cerrar); verificar con un test que lee el flujo que un cambio de estado llega al cliente conectado y que el oyente se libera al desconectar

## 5. Pedido en la carta (frontend)

- [ ] 5.1 Enrutado por `location.pathname` en `AppCarta` (`/carta`, `/mesa/:codigo`, `/mesa/:codigo/pedidos/:token`), consulta de la mesa en paralelo con la carta, aviso de solo consulta y ruta nueva en Express; actualizar el test existente "Entrada desde el QR de una mesa" a `/mesa/<código>` y verificar "Dirección de mesa con código desconocido", "Carta de una mesa activa", "Carta sin mesa solo para consultar", "Código de mesa no válido" y "QR de una mesa archivada"
- [ ] 5.2 Pedido en curso en `localStorage` por mesa, botón "Añadir" solo en platos disponibles, barra fija con unidades y total, cantidades y notas con sus límites; verificar con Vitest "Añadir un plato", "Añadir otra vez el mismo plato", "Un plato agotado no se puede añadir", "Aumentar y disminuir la cantidad", "Quitar un plato bajando su cantidad", "Cantidad máxima por plato", "Máximo de platos distintos", "Añadir una nota a un plato", "Nota demasiado larga", "El pedido en curso sobrevive a recargar" y "Nada se envía antes de confirmar"
- [ ] 5.3 Resumen con mesa, platos, cantidades, notas, alérgenos, importes y total, y botón "Confirmar pedido"; verificar con Vitest "Resumen con el total", "Volver a la carta sin enviar", "Pedido vacío no se confirma" y "Confirmar sin identificarse"
- [ ] 5.4 Tratamiento del `409` y `410` en el resumen (retirar, actualizar precios, aviso con `role="alert"` nombrando cada plato, pedido vacío); verificar con Vitest "Confirmar tras la retirada" y los mensajes de los escenarios de 4.2 en el cliente
- [ ] 5.5 Confirmación con número de pedido en grande, mesa, platos, total y estado por `EventSource`, vaciado del pedido en curso y "Mis pedidos de hoy" en `localStorage`; verificar con Vitest "Confirmación con número y estado" y "Volver a ver un pedido confirmado"
- [ ] 5.6 Cargar el código del pedido con `import()` dinámico solo en rutas de mesa; verificar con `npm run build` que el JS de `/carta` no crece y sigue ≤ 60 KB brotli

## 6. Comprobaciones de extremo a extremo

- [ ] 6.1 Playwright: flujo completo desde `/mesa/<código>` (añadir, nota, resumen, confirmar, ver número) y "El estado se actualiza sin recargar" cambiando el estado con `cambiarEstado` desde el servidor de prueba; verificar que pasan
- [ ] 6.2 Playwright + axe-core: "Pedido usable en el móvil" a 360 px y con texto al 200 % sobre pedido en curso, resumen y confirmación; verificar que pasa sin incidencias
- [ ] 6.3 Ampliar `scripts/perf.js` a una ruta de mesa con 150 platos; verificar con `npm run test:perf` que el texto de la carta sigue visible en menos de 2 s en `/carta` y en `/mesa/<código>`
- [ ] 6.4 Ejecutar `npm test` (incluye `test:escenarios`) y `npm run test:e2e`; verificar que todos los escenarios de `mesas`, `pedido-mesa` y `carta-publica` tienen su test y pasan
- [ ] 6.5 Prueba manual en el móvil de Andrés con 4G: imprimir un QR, escanearlo, pedir y ver la confirmación; anotar el resultado en el README

## Workflow follow-up

- Validar con Andrés las decisiones marcadas como "Equipo" en proposal.md antes de archivar.
- Archivar el cambio con `/opsx:archive` y comprobar que las specs vivas `mesas`, `pedido-mesa` y `carta-publica` quedan actualizadas.
