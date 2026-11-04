# Spec Delta

## MODIFIED Requirements

### Requirement: Confirmación sin datos personales
Confirmar un pedido MUST NOT requerir registro, inicio de sesión, email, teléfono, nombre ni ningún otro dato personal. El pedido registrado MUST asociarse a la mesa y MUST NOT guardar dirección IP, datos del navegador ni ningún dato que identifique a quien lo envía.

#### Scenario: Confirmar sin identificarse
- **GIVEN** el resumen del pedido en curso de "Mesa 7"
- **WHEN** el visitante pulsa "Confirmar pedido"
- **THEN** el pedido se envía sin que se le pida ningún dato y el resumen no contiene ningún campo de datos personales

#### Scenario: El pedido no guarda datos del visitante
- **WHEN** se revisa un pedido registrado
- **THEN** solo contiene la mesa, la hora, el número de pedido, los platos con nombre, precio, cantidad y nota, el total, el estado y, si se ha cancelado, el momento de la cancelación, sin dirección IP ni datos del navegador

### Requirement: Confirmación del pedido en el móvil
Tras registrar el pedido, el móvil del visitante MUST mostrar la confirmación con el número de pedido en grande, el nombre de la mesa, los platos con cantidad y nota, el total y el estado del pedido, y MUST vaciar el pedido en curso. El estado mostrado MUST ser "Recibido", "En preparación", "Servido" o "Cancelado" y MUST actualizarse sin recargar cuando cambie en el sistema.

#### Scenario: Confirmación con número y estado
- **GIVEN** el resumen de "Mesa 7" con 2 "Café con leche"
- **WHEN** el visitante confirma y el sistema le asigna el número de pedido 15
- **THEN** el móvil muestra "Pedido 15", "Mesa 7", 2 "Café con leche", el total y el estado "Recibido", y el pedido en curso queda vacío

#### Scenario: El estado se actualiza sin recargar
- **GIVEN** un visitante viendo la confirmación de su pedido en estado "Recibido"
- **WHEN** el estado de ese pedido cambia en el sistema
- **THEN** la confirmación muestra el estado nuevo sin que el visitante recargue

#### Scenario: Pedido cancelado en el móvil
- **GIVEN** un visitante viendo la confirmación de su pedido en estado "Recibido"
- **WHEN** el personal cancela ese pedido
- **THEN** la confirmación muestra el estado "Cancelado" sin que el visitante recargue
