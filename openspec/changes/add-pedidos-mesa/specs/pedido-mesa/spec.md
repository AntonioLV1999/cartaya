# Spec Delta

## Purpose

Permite al visitante pedir desde la carta abierta con el QR de su mesa, sin registrarse ni aportar datos personales, y seguir en su móvil el número y el estado de cada pedido, que pertenece siempre a la mesa y nunca a una persona.

## ADDED Requirements

### Requirement: Pedir solo desde la carta de una mesa
La carta abierta en la dirección de mesa de una mesa activa MUST mostrar el nombre de la mesa y permitir pedir. La carta abierta sin mesa, o con un código de mesa inexistente o de una mesa archivada, MUST mostrarse solo para consultar, sin ninguna opción de pedir, con el texto "Para pedir, escanee el código QR de su mesa o avise a nuestro personal".

#### Scenario: Carta de una mesa activa
- **GIVEN** la mesa activa "Mesa 7"
- **WHEN** un visitante abre la dirección de mesa de "Mesa 7"
- **THEN** la carta muestra "Mesa 7" y cada plato disponible tiene el botón "Añadir"

#### Scenario: Carta sin mesa solo para consultar
- **WHEN** un visitante abre la dirección de la carta sin mesa
- **THEN** la carta no muestra ningún botón "Añadir" y muestra "Para pedir, escanee el código QR de su mesa o avise a nuestro personal"

#### Scenario: Código de mesa no válido
- **WHEN** un visitante abre una dirección de mesa con un código que no corresponde a ninguna mesa
- **THEN** la carta se muestra sin ningún botón "Añadir" y con el texto "Para pedir, escanee el código QR de su mesa o avise a nuestro personal"

#### Scenario: QR de una mesa archivada
- **GIVEN** la mesa archivada "Terraza 3"
- **WHEN** un visitante abre la dirección de mesa de "Terraza 3"
- **THEN** la carta se muestra sin ningún botón "Añadir" y con el texto "Para pedir, escanee el código QR de su mesa o avise a nuestro personal"

### Requirement: Añadir platos al pedido en curso
Desde la carta de una mesa, el visitante MUST poder añadir al pedido en curso cualquier plato activo no agotado. Un plato agotado MUST NOT poder añadirse. Añadir de nuevo un plato que ya está en el pedido en curso MUST sumar una unidad a su cantidad. Mientras el pedido en curso tenga platos, la carta MUST mostrar siempre visible el número de unidades y el total, con acceso al resumen.

#### Scenario: Añadir un plato
- **GIVEN** la carta de la mesa "Mesa 7" con el pedido en curso vacío
- **WHEN** el visitante pulsa "Añadir" en "Café con leche" a 1,50 €
- **THEN** el pedido en curso contiene 1 "Café con leche" y la carta muestra visible "1 plato · 1,50 €" con acceso al resumen

#### Scenario: Añadir otra vez el mismo plato
- **GIVEN** el pedido en curso con 1 "Café con leche"
- **WHEN** el visitante vuelve a pulsar "Añadir" en "Café con leche"
- **THEN** el pedido en curso contiene una sola línea de "Café con leche" con cantidad 2

#### Scenario: Un plato agotado no se puede añadir
- **GIVEN** el plato activo "Tortilla" marcado como agotado
- **WHEN** un visitante consulta la carta de una mesa
- **THEN** "Tortilla" se muestra con la etiqueta "Agotado" y sin botón "Añadir"

### Requirement: Cantidades del pedido en curso
El visitante MUST poder aumentar y disminuir la cantidad de cada plato del pedido en curso. La cantidad de un plato MUST estar entre 1 y 20; disminuirla por debajo de 1 MUST quitar el plato del pedido en curso. Un pedido MUST tener como mucho 30 platos distintos. El sistema MUST rechazar un pedido que no cumpla estos límites.

#### Scenario: Aumentar y disminuir la cantidad
- **GIVEN** el pedido en curso con 2 "Café con leche"
- **WHEN** el visitante pulsa aumentar y después dos veces disminuir
- **THEN** el pedido en curso contiene 1 "Café con leche"

#### Scenario: Quitar un plato bajando su cantidad
- **GIVEN** el pedido en curso con 1 "Café con leche" y 1 "Tostada con tomate"
- **WHEN** el visitante disminuye la cantidad de "Café con leche"
- **THEN** "Café con leche" desaparece del pedido en curso y queda solo "Tostada con tomate"

#### Scenario: Cantidad máxima por plato
- **GIVEN** el pedido en curso con 20 "Café con leche"
- **WHEN** el visitante intenta aumentar su cantidad
- **THEN** la cantidad sigue en 20 y se le indica que el máximo es 20 unidades por plato

#### Scenario: Máximo de platos distintos
- **GIVEN** el pedido en curso con 30 platos distintos
- **WHEN** el visitante intenta añadir un plato distinto
- **THEN** el plato no se añade y se le indica que el máximo es 30 platos distintos por pedido

#### Scenario: Pedido fuera de límites rechazado
- **WHEN** se envía a confirmar un pedido con un plato en cantidad 21, en cantidad 0 o con 31 platos distintos
- **THEN** el sistema no registra el pedido

### Requirement: Nota por plato
El visitante MUST poder escribir una nota libre opcional en cada plato del pedido en curso, de como mucho 140 caracteres. Una nota vacía o solo con espacios MUST tratarse como sin nota. El sistema MUST rechazar un pedido con alguna nota de más de 140 caracteres.

#### Scenario: Añadir una nota a un plato
- **GIVEN** el pedido en curso con 1 "Bocadillo de lomo"
- **WHEN** el visitante escribe la nota "sin cebolla" en "Bocadillo de lomo"
- **THEN** el resumen muestra "Bocadillo de lomo" con la nota "sin cebolla"

#### Scenario: Nota demasiado larga
- **WHEN** el visitante intenta escribir una nota de 141 caracteres
- **THEN** la nota no admite más de 140 caracteres y se le indica el máximo de 140 caracteres

#### Scenario: Pedido con nota demasiado larga rechazado
- **WHEN** se envía a confirmar un pedido con una nota de 141 caracteres
- **THEN** el sistema no registra el pedido e indica el máximo de 140 caracteres

### Requirement: Pedido en curso solo en el móvil
El pedido en curso MUST guardarse solo en el navegador del visitante, ligado a la mesa, y MUST conservarse al recargar la carta de esa misma mesa. El sistema MUST NOT recibir nada del pedido en curso hasta que el visitante lo confirme.

#### Scenario: El pedido en curso sobrevive a recargar
- **GIVEN** el pedido en curso de la mesa "Mesa 7" con 2 "Café con leche" con la nota "uno descafeinado"
- **WHEN** el visitante recarga la carta de "Mesa 7"
- **THEN** el pedido en curso sigue con 2 "Café con leche" y la nota "uno descafeinado"

#### Scenario: Nada se envía antes de confirmar
- **WHEN** el visitante añade platos, cambia cantidades y escribe notas sin confirmar
- **THEN** el servidor no recibe ninguna petición con el pedido en curso

### Requirement: Resumen antes de confirmar
Antes de enviar el pedido, el sistema MUST mostrar al visitante un resumen con el nombre de la mesa y, por cada plato, su nombre, cantidad, nota, alérgenos e importe, y el total en euros con IVA incluido en formato español. El pedido MUST enviarse solo cuando el visitante pulse "Confirmar pedido" en el resumen. Un pedido en curso vacío MUST NOT poder confirmarse.

#### Scenario: Resumen con el total
- **GIVEN** el pedido en curso de "Mesa 7" con 2 "Café con leche" a 1,50 € y 1 "Tostada con tomate" a 2,80 € con la nota "sin aceite"
- **WHEN** el visitante abre el resumen
- **THEN** ve "Mesa 7", "Café con leche" ×2 por "3,00 €", "Tostada con tomate" ×1 por "2,80 €" con la nota "sin aceite", los alérgenos de cada plato y el total "5,80 €"

#### Scenario: Volver a la carta sin enviar
- **GIVEN** el visitante en el resumen de su pedido en curso
- **WHEN** vuelve a la carta sin pulsar "Confirmar pedido"
- **THEN** el pedido no se envía y el pedido en curso se conserva

#### Scenario: Pedido vacío no se confirma
- **GIVEN** el pedido en curso vacío
- **WHEN** el visitante intenta confirmar
- **THEN** no se envía ningún pedido

### Requirement: Confirmación sin datos personales
Confirmar un pedido MUST NOT requerir registro, inicio de sesión, email, teléfono, nombre ni ningún otro dato personal. El pedido registrado MUST asociarse a la mesa y MUST NOT guardar dirección IP, datos del navegador ni ningún dato que identifique a quien lo envía.

#### Scenario: Confirmar sin identificarse
- **GIVEN** el resumen del pedido en curso de "Mesa 7"
- **WHEN** el visitante pulsa "Confirmar pedido"
- **THEN** el pedido se envía sin que se le pida ningún dato y el resumen no contiene ningún campo de datos personales

#### Scenario: El pedido no guarda datos del visitante
- **WHEN** se revisa un pedido registrado
- **THEN** solo contiene la mesa, la hora, el número de pedido, los platos con nombre, precio, cantidad y nota, el total y el estado, sin dirección IP ni datos del navegador

### Requirement: Pedido registrado para cocina
Al confirmarse, el sistema MUST registrar el pedido como pedido de la mesa en estado "Recibido", con su número de pedido, la hora, y por cada plato el nombre y el precio vigentes en ese momento, la cantidad y la nota, y el total. El pedido registrado MUST NOT cambiar si después se edita o archiva un plato o se renombra o archiva la mesa.

#### Scenario: Pedido registrado en estado Recibido
- **GIVEN** el resumen de "Mesa 7" con 2 "Café con leche" a 1,50 €
- **WHEN** el visitante confirma el pedido
- **THEN** queda registrado un pedido de "Mesa 7" en estado "Recibido" con 2 "Café con leche" a 1,50 € y total 3,00 €, disponible para cocina

#### Scenario: El pedido conserva el precio confirmado
- **GIVEN** un pedido registrado con "Café con leche" a 1,50 €
- **WHEN** el dueño cambia el precio de "Café con leche" a 1,60 €
- **THEN** el pedido registrado sigue mostrando "Café con leche" a 1,50 € y su total no cambia

### Requirement: Número de pedido del día
Cada pedido registrado MUST recibir un número de pedido correlativo dentro del día, empezando en 1 cada día según la hora de Madrid, único en ese día para todo el local.

#### Scenario: Números correlativos del día
- **GIVEN** que hoy ya se han registrado 14 pedidos en el local
- **WHEN** se confirma un pedido nuevo
- **THEN** recibe el número de pedido 15

#### Scenario: El número vuelve a empezar cada día
- **GIVEN** que ayer se registraron 80 pedidos y hoy ninguno
- **WHEN** se confirma el primer pedido de hoy pasada la medianoche de Madrid
- **THEN** recibe el número de pedido 1

### Requirement: Confirmación del pedido en el móvil
Tras registrar el pedido, el móvil del visitante MUST mostrar la confirmación con el número de pedido en grande, el nombre de la mesa, los platos con cantidad y nota, el total y el estado del pedido, y MUST vaciar el pedido en curso. El estado mostrado MUST actualizarse sin recargar cuando cambie en el sistema.

#### Scenario: Confirmación con número y estado
- **GIVEN** el resumen de "Mesa 7" con 2 "Café con leche"
- **WHEN** el visitante confirma y el sistema le asigna el número de pedido 15
- **THEN** el móvil muestra "Pedido 15", "Mesa 7", 2 "Café con leche", el total y el estado "Recibido", y el pedido en curso queda vacío

#### Scenario: El estado se actualiza sin recargar
- **GIVEN** un visitante viendo la confirmación de su pedido en estado "Recibido"
- **WHEN** el estado de ese pedido cambia en el sistema
- **THEN** la confirmación muestra el estado nuevo sin que el visitante recargue

### Requirement: Mis pedidos de la mesa
El móvil del visitante MUST recordar los pedidos que ha confirmado ese día desde esa mesa y permitir volver a ver la confirmación de cada uno, con su estado actual, tras recargar o volver a abrir la carta de la mesa. La confirmación de un pedido MUST NOT poder consultarse sin el enlace de esa confirmación, que MUST NOT poder deducirse de la mesa ni del número de pedido.

#### Scenario: Volver a ver un pedido confirmado
- **GIVEN** un visitante que confirmó el pedido 15 desde "Mesa 7" hoy
- **WHEN** vuelve a abrir la carta de "Mesa 7" en el mismo móvil
- **THEN** puede abrir "Pedido 15" y ver su confirmación con el estado actual

#### Scenario: Un pedido no se consulta por su número
- **WHEN** alguien intenta consultar un pedido indicando solo la mesa o el número de pedido
- **THEN** el sistema no muestra el pedido

### Requirement: Varios pedidos por mesa
Una mesa activa MUST poder confirmar varios pedidos a lo largo del servicio, desde uno o varios móviles. Cada confirmación MUST registrarse como un pedido independiente, con su propio número de pedido, sin modificar los pedidos anteriores de la mesa.

#### Scenario: Pedir el postre después
- **GIVEN** la mesa "Mesa 7" con el pedido 15 ya registrado
- **WHEN** desde "Mesa 7" se confirma después un pedido con 2 "Flan"
- **THEN** se registra un pedido nuevo de "Mesa 7" con su propio número y solo los 2 "Flan", y el pedido 15 no cambia

#### Scenario: Dos móviles en la misma mesa
- **GIVEN** dos visitantes de "Mesa 7", cada uno con su propio pedido en curso
- **WHEN** ambos confirman
- **THEN** se registran dos pedidos independientes de "Mesa 7", cada uno con sus platos y su número

### Requirement: Platos no disponibles retirados antes de enviar
Al confirmar, si algún plato del pedido ya no es un plato activo, está agotado o su categoría está archivada, el sistema MUST NOT registrar el pedido. El sistema MUST retirar esos platos del pedido en curso, indicar al visitante el nombre de cada plato retirado y mostrarle el resumen corregido para que vuelva a confirmar. Si no queda ningún plato, MUST indicarlo y no hay nada que confirmar.

#### Scenario: Plato archivado mientras se decide
- **GIVEN** el pedido en curso con 1 "Croquetas" y 2 "Café con leche"
- **WHEN** el dueño archiva "Croquetas" y después el visitante pulsa "Confirmar pedido"
- **THEN** no se registra ningún pedido, se indica "Croquetas ya no está disponible y se ha retirado de su pedido" y se muestra el resumen con solo 2 "Café con leche" y el total recalculado

#### Scenario: Plato agotado mientras se decide
- **GIVEN** el pedido en curso con 1 "Tortilla" y 1 "Café con leche"
- **WHEN** el dueño marca "Tortilla" como agotado y después el visitante pulsa "Confirmar pedido"
- **THEN** no se registra ningún pedido, se indica que "Tortilla" se ha retirado de su pedido y se muestra el resumen con solo "Café con leche"

#### Scenario: Confirmar tras la retirada
- **GIVEN** el resumen corregido tras retirar "Croquetas"
- **WHEN** el visitante pulsa "Confirmar pedido"
- **THEN** se registra el pedido sin "Croquetas"

#### Scenario: Todos los platos retirados
- **GIVEN** el pedido en curso con solo 1 "Croquetas"
- **WHEN** el dueño archiva "Croquetas" y después el visitante pulsa "Confirmar pedido"
- **THEN** no se registra ningún pedido, se indica que "Croquetas" se ha retirado y que el pedido está vacío

### Requirement: Precio cambiado antes de confirmar
Al confirmar, si el precio de algún plato del pedido ha cambiado desde que el visitante vio el resumen, el sistema MUST NOT registrar el pedido. MUST actualizar el precio en el pedido en curso, indicar al visitante qué plato ha cambiado de precio y mostrarle el resumen con el total nuevo para que vuelva a confirmar.

#### Scenario: Precio cambiado mientras se decide
- **GIVEN** el resumen con 2 "Café con leche" a 1,50 € y total 3,00 €
- **WHEN** el dueño cambia el precio de "Café con leche" a 1,60 € y después el visitante pulsa "Confirmar pedido"
- **THEN** no se registra ningún pedido, se indica que "Café con leche" ha cambiado de precio y se muestra el resumen con "Café con leche" a 1,60 € y total "3,20 €"

### Requirement: Mesa archivada mientras se pide
Si la mesa se archiva antes de que el visitante confirme, el sistema MUST NOT registrar el pedido y MUST indicar "Esta mesa ya no admite pedidos. Avise a nuestro personal".

#### Scenario: Confirmar en una mesa archivada
- **GIVEN** un visitante de "Terraza 3" con un pedido en curso
- **WHEN** el dueño archiva "Terraza 3" y después el visitante pulsa "Confirmar pedido"
- **THEN** no se registra ningún pedido y se muestra "Esta mesa ya no admite pedidos. Avise a nuestro personal"

### Requirement: Pedido legible y accesible
El pedido en curso, el resumen y la confirmación MUST cumplir las mismas condiciones de legibilidad que la carta: texto de al menos 18 px, contraste de al menos 7:1, botones (añadir, aumentar, disminuir, confirmar) de al menos 48×48 px con texto o nombre accesible, y uso sin desplazamiento horizontal con el texto ampliado al 200 % en 360 px de ancho.

#### Scenario: Pedido usable en el móvil
- **WHEN** se mide el pedido en curso, el resumen y la confirmación en una pantalla de 360 px de ancho, también con el texto ampliado al 200 %
- **THEN** el texto tiene al menos 18 px y contraste de al menos 7:1, los botones miden al menos 48×48 px y tienen nombre accesible, y no hay desplazamiento horizontal
