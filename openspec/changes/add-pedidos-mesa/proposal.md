# Propuesta: pedidos desde la mesa

## Por qué

Con la carta digital ya en marcha, el cliente de La Estación ve la carta en su móvil al escanear el QR de su mesa, pero para pedir tiene que esperar a que llegue un camarero. Queremos que pida desde esa misma carta, sin registrarse ni dar ningún dato, y que el pedido quede listo para que cocina lo reciba (el panel de cocina será el siguiente cambio). Es el paso que convierte la carta en una herramienta de trabajo para el local en las horas punta.

## Qué cambia

- **Mesas con QR propio**: el dueño da de alta las mesas del local desde la administración (p. ej. "Mesa 7", "Terraza 2"). Cada mesa recibe un código aleatorio no adivinable; su QR abre la carta en `/mesa/<código>` con la mesa ya identificada. El dueño puede ver e imprimir el QR de cada mesa, renombrar mesas sin que cambie su QR y archivar las que ya no se usan.
- **Pedido en curso**: desde la carta abierta por el QR de una mesa, el visitante añade platos activos y disponibles, ajusta cantidades y escribe una nota opcional por plato ("sin cebolla", "poco hecho") de hasta 140 caracteres. El pedido en curso vive solo en su móvil hasta que lo confirma.
- **Resumen y confirmación**: antes de enviarlo, el visitante ve el resumen con cada plato, cantidad, nota y el total en euros con IVA incluido, y lo confirma. No se pide registro, email, teléfono ni dato personal alguno.
- **Pedido confirmado**: queda registrado como pedido de la mesa (nunca de una persona), con un número de pedido del día y el estado "Recibido", disponible para el futuro panel de cocina. El visitante ve en su móvil la confirmación con el número de pedido y el estado, que se actualiza en tiempo real cuando cambie.
- **Varios pedidos por mesa**: una mesa puede confirmar tantos pedidos como quiera durante el servicio; cada confirmación es un pedido independiente con su propio número.
- **Carta que cambia mientras se decide**: si al confirmar algún plato del pedido ya no está activo, está agotado o ha cambiado de precio, el sistema no envía el pedido: retira los platos no disponibles, actualiza los precios, se lo indica al visitante y le muestra el resumen corregido para que vuelva a confirmar.
- **Carta sin mesa**: la carta abierta sin mesa (`/carta`) o con un código de mesa no válido sigue mostrándose completa, pero solo para consultar; no permite pedir e indica que se pida al personal.

## Capacidades

### Capacidades nuevas
- `mesas`: gestión de las mesas del local por el dueño (alta, nombre, código y QR, impresión y archivado).
- `pedido-mesa`: pedido del visitante desde la carta de una mesa (pedido en curso, notas, resumen, confirmación, número y estado del pedido, varios pedidos por mesa y retirada de platos no disponibles).

### Capacidades modificadas
- `carta-publica`: el requisito "Acceso público a la carta" pasa a referirse a la dirección de mesa como `/mesa/<código>` (código del QR de la mesa) en lugar de un identificador libre, y precisa que un código no válido también muestra la carta.

## Fuera de alcance

- Pago online (se paga en caja, como siempre), propinas y dividir la cuenta.
- Llamar al camarero desde el móvil.
- Pedidos para llevar.
- Panel de cocina y cambios de estado del pedido más allá de "Recibido" (cambio `panel-cocina`).
- Modificar o cancelar un pedido ya confirmado desde el móvil (se pide al personal).
- Compartir un mismo pedido en curso entre varios móviles de la misma mesa.
- Cambiar el código de una mesa sin archivarla (si un QR se filtra, se archiva la mesa y se crea otra).

## Decisiones de negocio

Origen: **Andrés** = requisito expresado por el cliente; **Equipo** = decisión tomada por el equipo para desbloquear el cambio, pendiente de validar con Andrés antes de archivar.

| Fecha | Origen | Decisión |
|-------|--------|----------|
| 2026-11-04 | Andrés | Cada mesa tiene un QR único e impreso que abre la carta con la mesa ya identificada. Un pedido pertenece a una mesa, nunca a una persona. |
| 2026-11-04 | Andrés | El visitante añade platos de la carta, indica cantidades y puede escribir una nota libre por plato de hasta 140 caracteres. |
| 2026-11-04 | Andrés | Antes de enviar, el visitante ve el resumen con el total en euros y lo confirma. La confirmación no pide registro, email, teléfono ni ningún dato personal. |
| 2026-11-04 | Andrés | El pedido confirmado llega a cocina (panel de cocina, cambio futuro) y el visitante ve en su móvil la confirmación con el número de pedido y su estado. |
| 2026-11-04 | Andrés | Una mesa puede tener varios pedidos a lo largo del servicio; cada confirmación es un pedido independiente. |
| 2026-11-04 | Andrés | Si un plato deja de estar activo entre que se añadió y la confirmación, el sistema lo indica y lo retira del pedido antes de enviarlo. |
| 2026-11-04 | Andrés | Quedan fuera: pago online, propinas, dividir la cuenta, llamar al camarero y pedidos para llevar. |
| 2026-11-04 | Andrés | **Agotados**: un plato agotado no se puede añadir al pedido; si se agota antes de confirmar, se retira igual que uno archivado. |
| 2026-11-04 | Andrés | **Código de mesa aleatorio**: el QR lleva un código no adivinable, no el número de mesa, para que nadie pueda enviar pedidos a una mesa tecleando su dirección. |
| 2026-11-04 | Andrés | **Mesas desde la administración**: el dueño crea, renombra y archiva las mesas y obtiene sus QR para imprimir desde la administración, con la sesión de establecimiento. |
| 2026-11-04 | Andrés | **Estado del pedido**: en este cambio el único estado es "Recibido"; el panel de cocina añadirá los demás. La confirmación del móvil ya se actualiza sola cuando el estado cambie. |
| 2026-11-04 | Equipo | **Nombre de mesa**: texto libre obligatorio de hasta 30 caracteres ("Mesa 7", "Terraza 2"), sin repetirse entre mesas activas (sin distinguir mayúsculas). Renombrar no cambia el código ni el QR impreso. |
| 2026-11-04 | Equipo | **Mesas archivadas**: una mesa no se borra, se archiva (sus pedidos históricos la referencian). Su QR deja de permitir pedidos, pero sigue mostrando la carta para consultar. No se recuperan: se crea una mesa nueva con QR nuevo. |
| 2026-11-04 | Equipo | **Solo se pide desde el QR de una mesa**: la carta sin mesa o con un código no válido es solo de consulta y muestra "Para pedir, escanee el código QR de su mesa o avise a nuestro personal". |
| 2026-11-04 | Equipo | **Pedido en curso en el móvil**: el pedido sin confirmar se guarda solo en el navegador del visitante (sobrevive a recargar la página) y no llega al servidor hasta confirmarlo. Cada móvil de una mesa lleva su propio pedido en curso. |
| 2026-11-04 | Equipo | **Una línea por plato**: añadir otra vez el mismo plato suma cantidad; la nota es una por plato ("uno sin cebolla" se escribe en la nota). |
| 2026-11-04 | Equipo | **Cantidades**: entre 1 y 20 unidades por plato y como mucho 30 platos distintos por pedido, para evitar errores de dedo y bromas. Bajar la cantidad por debajo de 1 quita el plato del pedido. |
| 2026-11-04 | Equipo | **Precio confirmado**: el pedido guarda nombre y precio de cada plato en el momento de confirmar (decisión de precio histórico del cambio anterior). Si un precio cambió mientras el visitante decidía, no se envía: se le muestra el resumen con el precio nuevo para que vuelva a confirmar. Así nunca se cobra un total distinto del que confirmó. |
| 2026-11-04 | Equipo | **Retirada antes de enviar**: si al confirmar hay platos no disponibles, el pedido no se envía; se retiran, se indica cuáles con su nombre y el visitante vuelve a confirmar el resumen corregido. Si no queda ningún plato, no hay nada que confirmar. |
| 2026-11-04 | Equipo | **Número de pedido**: número correlativo del día, empezando en 1 cada día (hora de Madrid), fácil de decir en voz alta en barra. |
| 2026-11-04 | Equipo | **Ver mis pedidos**: el móvil recuerda los pedidos confirmados ese día desde esa mesa y permite volver a ver su confirmación tras recargar. Nadie más puede consultarlos sin el enlace secreto de la confirmación. |
| 2026-11-04 | Equipo | **Sin rastro personal**: el pedido no guarda dirección IP, navegador ni ningún otro dato del visitante; solo mesa, hora, platos, cantidades, notas, precios y estado. |

## Impacto

- Base de datos: tablas nuevas `mesas`, `pedidos` y `pedido_lineas` (esquema versión 2); las existentes no cambian.
- API pública nueva para consultar una mesa por su código, confirmar pedidos, consultar un pedido confirmado y recibir sus cambios de estado por Server-Sent Events. API de administración nueva para mesas y sus QR.
- Frontend: la carta pública incorpora el pedido en curso, el resumen y la confirmación; la administración, una sección "Mesas" con impresión de QR. Hay que vigilar el presupuesto de JS de la carta (requisito de carga en menos de 2 s).
- Configuración: dirección pública del local para componer la URL de los QR.
- Dependencias: una nueva en producción para generar los códigos QR, justificada en design.md.
