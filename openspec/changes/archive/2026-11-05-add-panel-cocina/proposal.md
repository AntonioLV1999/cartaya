# Propuesta: panel de cocina

## Por qué

Los visitantes de La Estación ya piden desde su mesa, pero el pedido se queda registrado en estado "Recibido" sin que nadie lo vea: cocina y barra no tienen dónde consultarlo ni cómo indicar que está en marcha. Este cambio añade la pantalla con la que el personal gestiona los pedidos entrantes, en una tablet apoyada en la barra, y cierra el circuito: lo que el visitante confirma aparece solo en cocina, y lo que cocina hace se ve en su móvil.

## Qué cambia

- **Panel de cocina**: una pantalla nueva en `/cocina`, pensada para una tablet, protegida con la sesión de establecimiento.
- **Pedidos activos**: el panel muestra los pedidos del día en estado "Recibido" o "En preparación", del más antiguo al más reciente, con número de pedido, mesa, platos, cantidades, notas y tiempo transcurrido.
- **Estados del pedido**: el personal pasa cada pedido de "Recibido" a "En preparación" y de "En preparación" a "Servido". No hay saltos ni retrocesos, y el sistema rechaza cualquier otra transición.
- **Cancelación**: un pedido solo se cancela mientras está en "Recibido". Queda en estado "Cancelado" con el momento de la cancelación y no se borra.
- **Tiempo real**: los pedidos nuevos y los cambios de estado aparecen solos por Server-Sent Events, sin recargar. Si se pierde la conexión, el panel lo avisa y se recupera solo.
- **Aviso simple**: al llegar un pedido nuevo suena un tono breve y el pedido se resalta.
- **Histórico del día**: los pedidos servidos y cancelados salen de la vista activa y se consultan en el histórico del día.
- **Móvil del visitante**: la confirmación muestra los estados nuevos, también "Cancelado", con el mecanismo que ya existe.

## Capacidades

### Capacidades nuevas
- `panel-cocina`: gestión de los pedidos del día por el personal (acceso, pedidos activos, transiciones de estado, cancelación, tiempo real, aviso de pedido nuevo, histórico del día y legibilidad en tablet).

### Capacidades modificadas
- `pedido-mesa`: "Confirmación sin datos personales" admite el momento de la cancelación entre los datos del pedido registrado; "Confirmación del pedido en el móvil" enumera los estados posibles e incluye el pedido cancelado.
- `sesion-establecimiento`: "Inicio de sesión con contraseña de establecimiento" y "Duración y cierre de la sesión" pasan a cubrir también el panel de cocina, no solo la administración.

## Fuera de alcance

- Métricas y estadísticas, incluidos los tiempos medios de preparación.
- Impresión de tickets.
- Gestión de turnos o empleados.
- Notificaciones sonoras configurables (volumen, tono o reglas de aviso).
- Cancelar o corregir un pedido que ya está en preparación: se resuelve hablando.
- Histórico de días anteriores.
- Mostrar los alérgenos en el panel (ver decisiones).

## Decisiones de negocio

Origen: **Andrés** = requisito expresado por el cliente; **Equipo** = decisión tomada por el equipo para desbloquear el cambio. Andrés validó todas las decisiones de origen Equipo el 2026-11-05.

| Fecha | Origen | Decisión |
|-------|--------|----------|
| 2026-11-04 | Andrés | El panel es la pantalla con la que cocina y barra gestionan los pedidos, en una tablet apoyada en la barra, y requiere la sesión de establecimiento. |
| 2026-11-04 | Andrés | Los pedidos confirmados entran en "Recibido". Las únicas transiciones válidas son Recibido → En preparación → Servido, sin saltos ni retrocesos. |
| 2026-11-04 | Andrés | Un pedido solo se cancela mientras está en "Recibido". Con la plancha encendida no se cancela desde la aplicación: se resuelve hablando. La cancelación registra el momento y no borra el pedido. |
| 2026-11-04 | Andrés | El panel muestra los pedidos del día por antigüedad, con mesa, platos, cantidades, notas y tiempo transcurrido, y se actualiza en tiempo real sin recargar. |
| 2026-11-04 | Andrés | Los pedidos servidos salen de la vista activa y se consultan en un histórico del día. |
| 2026-11-04 | Andrés | Quedan fuera: métricas, impresión de tickets, turnos y empleados, y notificaciones sonoras configurables. Basta un aviso simple. |
| 2026-11-04 | Equipo | **Pedidos cancelados**: salen de la vista activa y aparecen en el histórico del día, con la etiqueta "Cancelado" y la hora de cancelación. |
| 2026-11-04 | Equipo | **El visitante ve la cancelación**: su confirmación muestra "Cancelado" como cualquier otro estado. El sistema no le da más explicaciones; el motivo se lo cuenta el personal. |
| 2026-11-04 | Equipo | **Confirmar antes de cancelar**: cancelar pide una confirmación en el propio panel, porque no se puede deshacer y el visitante lo ve en su móvil. Avanzar de estado no la pide, para no frenar el trabajo en hora punta. |
| 2026-11-04 | Equipo | **"Del día" es el día de servicio de Madrid**, el mismo que numera los pedidos. Un pedido sin servir a medianoche deja de verse en el panel. Si La Estación llegara a abrir pasada la medianoche, habría que revisar esta decisión. |
| 2026-11-04 | Equipo | **Número de pedido visible**: el panel lo muestra además de lo pedido, porque es el dato que el visitante enseña o dice en barra. |
| 2026-11-04 | Equipo | **Tiempo transcurrido**: en minutos desde la confirmación, solo en los pedidos activos. El histórico muestra la hora de confirmación, porque un contador sin parar no significa nada en un pedido terminado. |
| 2026-11-04 | Equipo | **Solo se guarda el momento de la cancelación**: no se guardan las horas de inicio y de servicio, que únicamente servirían para las métricas que quedan fuera de alcance. |
| 2026-11-04 | Equipo | **Aviso simple**: un tono breve generado por el navegador, sin ajustes, más el resaltado del pedido. Como los navegadores no permiten sonar sin una primera pulsación, el panel ofrece "Activar sonido" mientras el sonido esté bloqueado. |
| 2026-11-04 | Equipo | **Conexión perdida**: el panel muestra un aviso visible mientras no recibe datos, porque en cocina un panel desconectado parece un panel sin pedidos. |
| 2026-11-04 | Equipo | **Alérgenos fuera del panel**: el encargo no los incluye y el visitante ya los ve antes de confirmar; lo que cocina debe tener en cuenta llega en la nota del plato. El diseño anterior guardó `plato_id` para poder enlazarlos más adelante. Por ser un asunto de seguridad alimentaria, requería validación expresa de Andrés, que la dio el 2026-11-05. |

## Impacto

- Base de datos: columna nueva `pedidos.cancelado_en` (esquema versión 3). Es la primera migración que altera una tabla existente, así que hace falta un paso de migración además de `schema.sql`.
- API nueva tras la sesión de establecimiento: cambio de estado de un pedido y flujo SSE de los pedidos del día.
- `server/pedidos.js`: `cambiarEstado` deja de aceptar cualquier texto y aplica las transiciones válidas. Los tests y el servidor de pruebas que usan el estado provisional `listo` se actualizan.
- Frontend: entrada nueva de Vite `cocina`, separada de la carta, de modo que no afecta al presupuesto de carga de la carta.
- Dependencias: ninguna nueva.
