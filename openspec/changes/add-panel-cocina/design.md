# Diseño: panel de cocina

## Contexto

Estado actual (cambio `add-pedidos-mesa`, archivado):

- `server/pedidos.js` expone `confirmar`, `obtener` y `cambiarEstado`. Este último acepta cualquier texto que cumpla `/^[a-z-]+$/`, sin transiciones, y esa expresión rechazaría `en_preparacion` por el guion bajo. Emite `estado-cambiado`; `confirmar` emite `pedido-registrado`, que nadie escucha todavía.
- `server/rutas-pedidos.js` ya sirve SSE al móvil del visitante (`retry`, latido de 25 s, liberación al cerrar). `app.js` excluye de la compresión las rutas que acaban en `/eventos`.
- `textoEstado` solo conoce "Recibido"; su texto de respaldo convertiría `en_preparacion` en "En_preparacion".
- `schema.sql` se aplica entero en cada arranque y fija `user_version` sin condiciones. Hasta ahora solo había `CREATE ... IF NOT EXISTS`, que no añade columnas a una tabla ya existente.
- Sesión: `exigirSesion` protege `/api/admin`, y `sesionValida` renueva `ultimo_uso_en` con cada uso. La cookie es `SameSite=Strict`, con `path=/`.
- El estado provisional `listo` aparece en `server/pedidos.test.js`, `web/src/carta/pedido/pedido.test.jsx` y `web/e2e/pedido.spec.js`. `scripts/servidor-prueba.js` tiene una ruta `/prueba/pedidos/:token/estado` para simular la cocina.
- `scripts/comprobar-escenarios.js` también cuenta los escenarios de los deltas en curso (ver riesgos).

Motivación y alcance: `proposal.md`. Requisitos: `specs/panel-cocina` y los deltas de `specs/pedido-mesa` y `specs/sesion-establecimiento`.

## Objetivos / No objetivos

**Objetivos:**
- Una única regla de transiciones, en el servidor, que no dependa de lo que muestre el panel.
- Migrar sin pérdida una base de datos desplegada con pedidos.
- Un panel que no pueda quedarse desincronizado sin que el personal lo sepa.

**No objetivos:**
- Varios procesos de servidor: el emisor de eventos sigue siendo en memoria.
- Mantener la pantalla de la tablet encendida (ver riesgos).
- Reescribir el SSE del visitante más allá de extraer lo que se comparte.

## Decisiones

### 1. Esquema versión 3 y primera migración real

`pedidos` gana `cancelado_en INTEGER NULL`, en milisegundos como `creado_en`.

- `schema.sql` incluye la columna en el `CREATE TABLE` (bases nuevas) y pasa a `PRAGMA user_version = 3`.
- `abrirBD` añade, después de aplicar el esquema, `ALTER TABLE pedidos ADD COLUMN cancelado_en INTEGER` solo si `PRAGMA table_info(pedidos)` no la tiene. No se puede usar `user_version` para decidirlo, porque `schema.sql` lo sobrescribe antes. Comprobar la columna es idempotente y no obliga a reestructurar `schema.sql`.
- `estado` sigue sin `CHECK`: añadirlo exigiría reconstruir la tabla, y las transiciones ya se validan en un único punto.
- No se guardan horas de inicio ni de servicio (decisión de negocio en `proposal.md`). Si llegan las métricas, los pedidos anteriores no tendrán esos datos, lo que se acepta.

*Alternativa*: un sistema de migraciones numeradas. Es excesivo para una sola columna.

### 2. Transiciones en una tabla y una actualización condicional

Identificadores: `recibido`, `en_preparacion`, `servido`, `cancelado`.

```js
const TRANSICIONES = {
  recibido: ['en_preparacion', 'cancelado'],
  en_preparacion: ['servido'],
};
```

`cambiarEstado(token, nuevo)` lee el pedido, comprueba `TRANSICIONES[actual]?.includes(nuevo)` y ejecuta `UPDATE ... WHERE token = ? AND estado = ?`, fijando `cancelado_en` si el estado nuevo es `cancelado`. Si no procede, lanza `ErrorValidacion` con estado 409: "Este pedido ya no se puede cancelar" para una cancelación y "Este pedido ya ha cambiado de estado" para el resto.

- **La petición indica el estado destino, no "avanza"**. Con un "avanzar" genérico, una doble pulsación o dos tablets llevarían un pedido de Recibido a Servido. Con destino explícito, la segunda petición recibe 409.
- `includes` sobre una tabla indexada por el estado guardado evita problemas con valores como `__proto__`; `nuevo` nunca se usa como clave.
- `textoEstado` pasa a una tabla completa ("Recibido", "En preparación", "Servido", "Cancelado") y pierde el texto de respaldo.
- El móvil del visitante no necesita cambios de código: ya recibe `estadoTexto` por SSE.

### 3. API del panel

Rutas nuevas en `server/rutas-cocina.js`, montadas en `/api/cocina` tras `sesion.exigirSesion`:

| Método y ruta | Uso |
|---|---|
| `GET /api/cocina/eventos` | SSE con los pedidos del día. |
| `POST /api/cocina/pedidos/:token/estado` | Cuerpo `{estado}`. `200` con el pedido, `404` si no existe, `409` si la transición no es válida, `415` si no es JSON. |

Se exige JSON como en `/api/admin`, para reforzar `SameSite` frente a CSRF. Cancelar es una transición más, de ahí que no tenga ruta propia.

El panel identifica cada pedido por su `token`. Es el enlace secreto de la confirmación, pero solo lo recibe quien tiene la sesión de establecimiento y da acceso a menos de lo que ya ve el panel. Añadir otro identificador público no aportaría nada.

*Alternativa*: colgar las rutas de `/api/admin`. Se descarta para no mezclar pedidos en `crearRutasAdmin`, que es del catálogo.

### 4. Tiempo real: la foto completa del día en cada evento

Cada evento SSE (`event: pedidos`) lleva todos los pedidos del día: `{dia, ahora, pedidos: [...]}`, ordenados por `creado_en, numero`. Se envía al conectar y cada vez que se emite `pedido-registrado` o `estado-cambiado`. El cliente reparte en vista activa e histórico según `estado`.

- Reconectar y sincronizar son lo mismo: no hay orden de eventos que respetar, ni un `GET` inicial que pueda cruzarse con un evento, ni `Last-Event-ID`.
- Coste: un día fuerte ronda 200 pedidos y unas decenas de KB por cambio, entre 1 o 2 tablets. Es asumible, y es la opción más simple.
- `pedidos.delDia(dia)` reutiliza `aPedido`, que añade `canceladoEn`.

*Alternativa*: enviar solo el pedido cambiado. Es más ligero, pero obliga a fusionar estado en el cliente y a resolver la resincronización aparte.

El tiempo transcurrido se calcula en el cliente, que lo refresca cada 30 s, con el desfase entre `ahora` y su reloj, para no depender del reloj de la tablet.

### 5. El latido comprueba la sesión y el cambio de día

Cada 25 s, en vez de enviar solo un comentario, el flujo:

1. Llama a `sesionValida(req)` (`crearSesion` pasa a exponerla). Si ya no es válida, cierra el flujo.
2. Compara `diaDeServicio(ahora())` con el último día enviado. Si cambia, envía la foto del día nuevo.
3. En otro caso, envía `: latido`.

Esto resuelve con un solo mecanismo tres requisitos: la sesión cerrada con el panel abierto, el paso de día y que un panel abierto cuente como uso de la sesión. El retraso máximo es de 25 s, irrelevante para ambos casos. Pulsar "Cerrar sesión" en el propio panel cierra el `EventSource` en el acto.

*Alternativa*: temporizador a medianoche más un registro de flujos por sesión. Son más piezas para el mismo resultado.

Se extrae de `rutas-pedidos.js` una función `abrirSSE(res)` con las cabeceras y el `retry`, compartida por ambos flujos. La ruta acaba en `/eventos`, así que el filtro de compresión de `app.js` ya la cubre.

### 6. Frontend

Entrada nueva de Vite: `web/cocina.html` y `web/src/cocina/` (`main.jsx`, `AppCocina.jsx`, `PanelCocina.jsx`, `TarjetaPedido.jsx`, `aviso.js`). La página se sirve en `/cocina` y se añade a `rutasDePagina` y a `rollupOptions.input`. Va separada de `admin` porque es otra pantalla con otro dispositivo, y no pesa sobre el presupuesto de la carta.

- Reutiliza `api.js` y `Login.jsx` de `web/src/admin/`. `Login` recibe una prop `titulo`, porque hoy lleva escrito "Administración".
- `AppCocina` repite el patrón de `AppAdmin`: comprobar `/api/sesion`, y mostrar `Login` o el panel.
- **Conexión**: `EventSource` reconecta solo ante un corte de red, pero se rinde (`readyState === CLOSED`) ante un 401. En `onerror` el panel muestra el aviso de conexión perdida. Si el estado es `CLOSED`, consulta `/api/sesion`: sin sesión vuelve al login; con sesión, crea otro `EventSource` a los 3 s. Al llegar una foto se quita el aviso.
- **Vistas**: dos botones con `aria-pressed` ("Pedidos activos", "Histórico del día"), como las pestañas de la administración.
- **Cancelar**: la confirmación va en la propia tarjeta (`¿Cancelar el pedido 15?` con "Sí, cancelar" y "No"), sin `window.confirm`, para mantener el tamaño de los botones y poder probarla.
- **Errores**: un 409 se muestra como aviso con `role="alert"`. El estado real llega por SSE, no hace falta recargar nada.
- Se mantiene una columna en vertical y dos en horizontal con CSS Grid en `estilos.css`, reutilizando sus variables de tamaño y contraste.

### 7. Aviso de pedido nuevo

`aviso.js` genera un tono de unos 300 ms con la Web Audio API: sin ficheros ni dependencias. El panel detecta los pedidos nuevos comparando tokens entre una foto y la siguiente; la primera foto no avisa. Tras una reconexión sí avisa de lo que haya llegado mientras tanto, que es justo lo que interesa.

El navegador deja el `AudioContext` en `suspended` hasta una pulsación. El panel intenta reanudarlo en cada pulsación y muestra "Activar sonido" mientras siga suspendido. El resaltado se quita a los 30 s o al cambiar de estado el pedido.

### 8. Pruebas

- `server/pedidos.test.js` y un `server/cocina.test.js` nuevo cubren transiciones, cancelación y SSE con `latido` y reloj inyectados.
- `web/src/cocina/cocina.test.jsx`, con un `EventSource` simulado como el de `pedido.test.jsx`.
- `web/e2e/cocina.spec.js` con `test.use({ viewport: { width: 768, height: 1024 } })`, porque la configuración general es de móvil.
- Se elimina la ruta `/prueba/pedidos/:token/estado`: los e2e usan la API real con `apiConSesion`, que hace innecesaria una puerta trasera.

## Riesgos / Compromisos

- **[Spec en curso sin tests]** → `npm test` falla en `test:escenarios` desde que este delta existe y hasta terminar la implementación, porque el comprobador cuenta los cambios en curso. Es el comportamiento previsto del proyecto; el cambio solo se da por terminado con el comprobador en verde.
- **[La pantalla de la tablet se apaga]** → un panel dormido no avisa. Se documenta en el README que la tablet debe configurarse para no apagar la pantalla. La API Wake Lock se descarta en este cambio por simplicidad.
- **[Marcar como servido por error]** → no hay retroceso, por requisito, y el pedido pasa al histórico. Se acepta; sigue visible en el histórico y lo demás se resuelve hablando.
- **[Un pedido sin servir a medianoche desaparece]** → es consecuencia de "pedidos del día" (decisión registrada en `proposal.md`). Sigue en la base de datos.
- **[Emisor en memoria]** → solo funciona con un proceso, que es como se despliega.
- **[Sonido bloqueado tras recargar]** → la tablet se queda muda hasta una pulsación. Por eso el botón "Activar sonido" queda visible y el resaltado no depende del audio.
- **[Bases desplegadas con un estado raro]** → no debería haber: en producción ninguna ruta permitía cambiar el estado. Un pedido con un estado desconocido no aparecería en ninguna vista.

## Plan de migración

1. Hacer copia de la carpeta de datos, como indica el README.
2. Desplegar y arrancar: `abrirBD` añade la columna y deja la versión 3. No se transforma ningún dato.
3. Abrir `/cocina` en la tablet, iniciar sesión y pulsar "Activar sonido".

Marcha atrás: el código anterior ignora `cancelado_en`, así que basta volver a la versión previa. Los pedidos en estados nuevos seguirían mostrándose al visitante con el texto de respaldo.

## Preguntas abiertas

- La tablet concreta y su navegador. Solo afecta a la comprobación final del sonido y de la pantalla encendida, no a lo diseñado.
