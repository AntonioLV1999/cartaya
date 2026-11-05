# panel-cocina Specification

## Purpose

Permite al personal de La Estación gestionar desde una tablet los pedidos del día: verlos aparecer en tiempo real, hacerlos avanzar de estado, cancelarlos mientras no se hayan empezado a preparar y consultar el histórico del día.

## Requirements

### Requirement: Acceso al panel con la sesión de establecimiento
El panel de cocina MUST estar disponible en la dirección `/cocina` y MUST requerir la sesión de establecimiento. Sin sesión, el sistema MUST pedir la contraseña de establecimiento y MUST NOT mostrar ni dejar modificar ningún pedido.

#### Scenario: Panel sin sesión
- **GIVEN** un navegador sin sesión de establecimiento y el pedido 15 de "Mesa 7" registrado hoy
- **WHEN** alguien abre el panel de cocina
- **THEN** el sistema pide la contraseña de establecimiento y no muestra ningún pedido

#### Scenario: Panel con sesión abierta
- **GIVEN** un navegador con la sesión de establecimiento abierta
- **WHEN** el personal abre el panel de cocina
- **THEN** el panel muestra los pedidos activos sin volver a pedir la contraseña

#### Scenario: Operaciones del panel sin sesión rechazadas
- **WHEN** alguien sin sesión de establecimiento intenta cambiar el estado de un pedido o recibir los pedidos del día
- **THEN** el sistema lo rechaza, el pedido no cambia y la respuesta no contiene ningún pedido

### Requirement: Pedidos activos del día
La vista activa del panel MUST mostrar los pedidos del día en estado "Recibido" o "En preparación", del más antiguo al más reciente. El día MUST ser el mismo día según la hora de Madrid que numera los pedidos.

#### Scenario: Pedidos activos por antigüedad
- **GIVEN** hoy los pedidos 14 y 15 en estado "Recibido" y el pedido 13 en estado "En preparación"
- **WHEN** el personal abre el panel de cocina
- **THEN** la vista activa muestra los pedidos en el orden 13, 14 y 15

#### Scenario: Pedidos de otro día fuera del panel
- **GIVEN** un pedido de ayer que quedó en estado "Recibido"
- **WHEN** el personal abre el panel de cocina hoy
- **THEN** ese pedido no aparece en la vista activa ni en el histórico del día

### Requirement: Contenido de cada pedido en el panel
Cada pedido de la vista activa MUST mostrar su número de pedido, el nombre de la mesa, su estado, el tiempo transcurrido desde la confirmación en minutos y, por cada plato, su nombre, su cantidad y su nota si la tiene. Los datos MUST ser los del pedido registrado, aunque después se haya editado el plato o renombrado la mesa.

#### Scenario: Contenido de un pedido en el panel
- **GIVEN** el pedido 15 de "Mesa 7" con 2 "Café con leche" con la nota "uno descafeinado" y 1 "Tostada con tomate"
- **WHEN** el personal lo ve en la vista activa
- **THEN** el panel muestra "Pedido 15", "Mesa 7", "Recibido", 2 "Café con leche" con la nota "uno descafeinado" y 1 "Tostada con tomate"

#### Scenario: Tiempo transcurrido del pedido
- **GIVEN** un pedido confirmado hace 12 minutos que sigue en la vista activa
- **WHEN** pasan 3 minutos más sin que se recargue el panel
- **THEN** el pedido muestra "15 min" en lugar de "12 min"

#### Scenario: Mesa renombrada después del pedido
- **GIVEN** el pedido 15 registrado en "Mesa 7"
- **WHEN** el dueño renombra la mesa a "Terraza 1" y el personal mira el panel de cocina
- **THEN** el pedido 15 sigue mostrando "Mesa 7"

### Requirement: Transiciones de estado del pedido
Desde el panel, el personal MUST poder pasar un pedido de "Recibido" a "En preparación" y de "En preparación" a "Servido". Son las únicas transiciones de avance válidas: el sistema MUST rechazar cualquier salto o retroceso, sin modificar el pedido, e indicarlo al personal.

#### Scenario: Empezar a preparar un pedido
- **GIVEN** el pedido 15 en estado "Recibido"
- **WHEN** el personal pulsa "Empezar a preparar" en el pedido 15
- **THEN** el pedido 15 pasa a "En preparación" y sigue en la vista activa

#### Scenario: Marcar un pedido como servido
- **GIVEN** el pedido 15 en estado "En preparación"
- **WHEN** el personal pulsa "Marcar como servido" en el pedido 15
- **THEN** el pedido 15 pasa a "Servido"

#### Scenario: Salto de estado rechazado
- **GIVEN** un pedido en estado "Recibido"
- **WHEN** se intenta pasarlo directamente a "Servido"
- **THEN** el sistema lo rechaza y el pedido sigue en "Recibido"

#### Scenario: Retroceso de estado rechazado
- **GIVEN** un pedido en estado "En preparación" y otro en estado "Servido"
- **WHEN** se intenta devolver el primero a "Recibido" y el segundo a "En preparación"
- **THEN** el sistema rechaza ambos cambios y los dos pedidos conservan su estado

#### Scenario: Estado no válido rechazado
- **GIVEN** un pedido en estado "Recibido"
- **WHEN** se intenta pasarlo a un estado que no existe
- **THEN** el sistema lo rechaza y el pedido sigue en "Recibido"

#### Scenario: Dos pulsaciones no saltan un estado
- **GIVEN** un pedido en estado "Recibido"
- **WHEN** llegan dos peticiones seguidas para pasarlo a "En preparación"
- **THEN** el pedido queda en "En preparación", no en "Servido", y la segunda petición se rechaza

### Requirement: Cancelación de un pedido
El personal MUST poder cancelar un pedido solo mientras esté en estado "Recibido", tras confirmarlo en el panel. El pedido cancelado MUST pasar al estado "Cancelado", registrar el momento de la cancelación y MUST NOT borrarse. Un pedido en cualquier otro estado MUST NOT poder cancelarse.

#### Scenario: Cancelar un pedido recibido
- **GIVEN** el pedido 15 en estado "Recibido"
- **WHEN** el personal pulsa "Cancelar pedido" y lo confirma
- **THEN** el pedido 15 pasa a "Cancelado" y se registra el momento de la cancelación

#### Scenario: Desistir de cancelar un pedido
- **GIVEN** el pedido 15 en estado "Recibido"
- **WHEN** el personal pulsa "Cancelar pedido" y no lo confirma
- **THEN** el pedido 15 sigue en "Recibido"

#### Scenario: Sin opción de cancelar en preparación
- **GIVEN** el pedido 15 en estado "En preparación"
- **WHEN** el personal lo ve en la vista activa
- **THEN** el pedido 15 no muestra el botón "Cancelar pedido"

#### Scenario: Cancelación rechazada fuera de Recibido
- **GIVEN** un pedido en estado "En preparación" y otro en estado "Servido"
- **WHEN** se intenta cancelar cada uno de ellos
- **THEN** el sistema rechaza ambas cancelaciones, indica "Este pedido ya no se puede cancelar" y los pedidos conservan su estado

#### Scenario: Un pedido cancelado no vuelve a cambiar
- **GIVEN** un pedido en estado "Cancelado"
- **WHEN** se intenta pasarlo a "En preparación" o cancelarlo otra vez
- **THEN** el sistema lo rechaza y el momento de la cancelación no cambia

#### Scenario: La cancelación no borra el pedido
- **GIVEN** el pedido 15 con 2 "Café con leche" y total 3,00 €
- **WHEN** el personal lo cancela
- **THEN** el pedido 15 sigue registrado con sus platos, su total y su número de pedido, y el siguiente pedido del día recibe el número 16

### Requirement: Actualización en tiempo real del panel
El panel MUST reflejar sin recargar la página los pedidos nuevos y los cambios de estado, también los hechos desde otro dispositivo, y MUST pasar solo al día nuevo a medianoche según la hora de Madrid.

#### Scenario: Un pedido nuevo aparece solo
- **GIVEN** el panel de cocina abierto
- **WHEN** un visitante confirma un pedido de "Mesa 7"
- **THEN** el pedido aparece en la vista activa sin recargar la página

#### Scenario: Un cambio de estado aparece solo
- **GIVEN** el panel de cocina abierto en dos tablets con el pedido 15 en "Recibido"
- **WHEN** el personal pasa el pedido 15 a "En preparación" en una de ellas
- **THEN** la otra muestra el pedido 15 en "En preparación" sin recargar la página

#### Scenario: El panel pasa al día nuevo
- **GIVEN** el panel de cocina abierto antes de medianoche con pedidos de ese día
- **WHEN** pasa la medianoche de Madrid
- **THEN** el panel deja de mostrarlos sin recargar la página

### Requirement: Aviso de conexión perdida
Mientras el panel no pueda recibir actualizaciones, MUST mostrar de forma visible "Sin conexión: los pedidos nuevos no aparecerán". Al recuperar la conexión, MUST quitar el aviso y mostrar los pedidos actuales sin recargar la página.

#### Scenario: Conexión perdida
- **GIVEN** el panel de cocina abierto
- **WHEN** se pierde la conexión con el servidor
- **THEN** el panel muestra "Sin conexión: los pedidos nuevos no aparecerán"

#### Scenario: El panel se recupera tras perder la conexión
- **GIVEN** el panel sin conexión mientras se confirma un pedido nuevo
- **WHEN** vuelve la conexión
- **THEN** el aviso desaparece y el pedido nuevo aparece sin recargar la página

### Requirement: Sesión cerrada con el panel abierto
Si la sesión de establecimiento deja de ser válida con el panel abierto, el sistema MUST dejar de enviarle pedidos y el panel MUST pedir la contraseña de establecimiento.

#### Scenario: Sesión cerrada con el panel abierto
- **GIVEN** el panel de cocina abierto en una tablet
- **WHEN** la sesión de establecimiento de esa tablet deja de ser válida
- **THEN** el sistema deja de enviarle pedidos y el panel pide la contraseña sin mostrar ningún pedido

### Requirement: Aviso de pedido nuevo
Al llegar un pedido nuevo con el panel abierto, el panel MUST emitir un tono breve y resaltar el pedido. Los pedidos que ya existían al abrir el panel MUST NOT generar aviso. Si el navegador bloquea el sonido, el panel MUST ofrecer el botón "Activar sonido", y el resaltado MUST funcionar igualmente.

#### Scenario: Aviso al llegar un pedido nuevo
- **GIVEN** el panel de cocina abierto con el sonido activo
- **WHEN** llega un pedido nuevo
- **THEN** el panel emite un tono y resalta ese pedido

#### Scenario: Sin aviso por los pedidos ya existentes
- **GIVEN** tres pedidos activos registrados
- **WHEN** el personal abre el panel de cocina
- **THEN** el panel no emite ningún tono ni resalta ningún pedido

#### Scenario: Sonido bloqueado por el navegador
- **GIVEN** el panel de cocina abierto con el sonido bloqueado por el navegador
- **WHEN** llega un pedido nuevo
- **THEN** el panel resalta el pedido y ofrece el botón "Activar sonido", que deja el sonido activo al pulsarlo

### Requirement: Histórico del día
Los pedidos del día en estado "Servido" o "Cancelado" MUST salir de la vista activa y MUST poder consultarse en la vista "Histórico del día", del más antiguo al más reciente, con su número de pedido, mesa, platos, cantidades, notas, estado y hora de confirmación, y la hora de cancelación si está cancelado. El histórico MUST NOT ofrecer ninguna acción sobre los pedidos.

#### Scenario: Pedido servido pasa al histórico
- **GIVEN** el pedido 15 en estado "En preparación"
- **WHEN** el personal lo marca como servido
- **THEN** el pedido 15 desaparece de la vista activa y aparece en "Histórico del día" con el estado "Servido"

#### Scenario: Pedido cancelado en el histórico
- **GIVEN** el pedido 15 cancelado a las 13:42
- **WHEN** el personal abre "Histórico del día"
- **THEN** el pedido 15 aparece con el estado "Cancelado" y la hora de cancelación 13:42, y no aparece en la vista activa

#### Scenario: Contenido del histórico del día
- **GIVEN** el pedido 12 servido, de "Mesa 3", confirmado a las 12:05 con 1 "Bocadillo de lomo" con la nota "sin cebolla", y el pedido 14 servido
- **WHEN** el personal abre "Histórico del día"
- **THEN** ve primero el pedido 12 con "Mesa 3", 12:05, 1 "Bocadillo de lomo" y la nota "sin cebolla", y después el pedido 14, sin ningún botón de acción

#### Scenario: El histórico solo contiene el día actual
- **GIVEN** un pedido servido ayer y otro servido hoy
- **WHEN** el personal abre "Histórico del día"
- **THEN** solo aparece el pedido servido hoy

### Requirement: Panel legible en tablet
El panel de cocina MUST poder usarse en una tablet de 768 px de ancho sin desplazamiento horizontal, con texto de al menos 18 px, contraste de al menos 7:1 y botones de al menos 48×48 px con texto o nombre accesible. El estado de cada pedido MUST mostrarse con texto, no solo con color.

#### Scenario: Panel usable en una tablet
- **WHEN** se mide el panel de cocina con pedidos activos y el histórico del día en una pantalla de 768 px de ancho
- **THEN** el texto tiene al menos 18 px y contraste de al menos 7:1, los botones miden al menos 48×48 px y tienen nombre accesible, cada estado se lee como texto y no hay desplazamiento horizontal
