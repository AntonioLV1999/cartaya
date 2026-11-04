# Spec Delta

## MODIFIED Requirements

### Requirement: Acceso público a la carta
El sistema MUST mostrar la carta a cualquier visitante sin pedir identificación, contraseña ni ningún dato personal, tanto en la dirección de la carta como en cualquier dirección de mesa (`/mesa/<código>`, donde el código es el código de mesa de su QR), sea el código válido o no. El sistema MUST NOT ofrecer registro ni cuenta para el cliente final.

#### Scenario: Consulta de la carta sin identificación
- **WHEN** un visitante sin sesión abre la dirección de la carta
- **THEN** el sistema muestra la carta completa sin pedir contraseña ni datos personales

#### Scenario: Entrada desde el QR de una mesa
- **GIVEN** la mesa activa "Mesa 7"
- **WHEN** un visitante abre la dirección de mesa `/mesa/<código>` de "Mesa 7"
- **THEN** el sistema muestra la misma carta que en la dirección de la carta

#### Scenario: Dirección de mesa con código desconocido
- **WHEN** un visitante abre una dirección de mesa cuyo código no corresponde a ninguna mesa
- **THEN** el sistema muestra la misma carta que en la dirección de la carta

#### Scenario: Sin registro del cliente final
- **WHEN** un visitante consulta la carta
- **THEN** la página no contiene ningún formulario de registro, inicio de sesión de cliente ni petición de datos personales
