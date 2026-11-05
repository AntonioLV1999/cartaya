# sesion-establecimiento Specification

## Purpose

Protege las funciones de administración de CartaYa con una única contraseña de establecimiento, sin cuentas de usuario, para que solo el personal de La Estación pueda modificar el sistema.

## Requirements

### Requirement: Inicio de sesión con contraseña de establecimiento
El sistema MUST permitir iniciar la sesión de establecimiento introduciendo únicamente la contraseña de establecimiento, sin nombre de usuario. Con la contraseña correcta, el sistema MUST abrir la sesión y llevar a la administración o, si se inició desde el panel de cocina, al panel de cocina; con una incorrecta, MUST NOT abrirla y MUST mostrar un mensaje que no revele información sobre la contraseña.

#### Scenario: Contraseña correcta
- **WHEN** el dueño introduce la contraseña de establecimiento correcta
- **THEN** el sistema abre la sesión de establecimiento y muestra la administración del catálogo

#### Scenario: Contraseña incorrecta
- **WHEN** alguien introduce una contraseña incorrecta
- **THEN** el sistema no abre la sesión y muestra "Contraseña incorrecta"

#### Scenario: Contraseña correcta desde el panel de cocina
- **GIVEN** el panel de cocina pidiendo la contraseña de establecimiento
- **WHEN** el personal introduce la contraseña correcta
- **THEN** el sistema abre la sesión de establecimiento y muestra el panel de cocina

### Requirement: Límite de intentos fallidos
Tras 5 intentos fallidos consecutivos desde la misma dirección en 15 minutos, el sistema MUST rechazar nuevos intentos desde esa dirección durante 15 minutos, aunque la contraseña sea correcta, indicando cuándo puede volver a intentarse.

#### Scenario: Bloqueo tras 5 intentos fallidos
- **GIVEN** 5 intentos fallidos consecutivos desde la misma dirección en los últimos 15 minutos
- **WHEN** desde esa dirección se introduce la contraseña correcta
- **THEN** el sistema no abre la sesión e indica que se vuelva a intentar pasados 15 minutos

### Requirement: Duración y cierre de la sesión
La sesión de establecimiento MUST mantenerse abierta en el mismo navegador durante 30 días sin uso o hasta que se cierre. El dueño MUST poder cerrar la sesión desde la administración y el personal desde el panel de cocina; tras cerrarla, la administración y el panel de cocina MUST volver a pedir la contraseña.

#### Scenario: La sesión se mantiene
- **GIVEN** el dueño inició la sesión de establecimiento en su móvil hace 3 días
- **WHEN** vuelve a abrir la administración en ese móvil
- **THEN** accede sin volver a introducir la contraseña

#### Scenario: Caducidad por inactividad
- **GIVEN** una sesión de establecimiento sin uso durante más de 30 días
- **WHEN** se abre la administración con ella
- **THEN** el sistema pide de nuevo la contraseña

#### Scenario: Cerrar la sesión
- **WHEN** el dueño pulsa "Cerrar sesión" y después abre la administración
- **THEN** el sistema pide de nuevo la contraseña

#### Scenario: Cerrar la sesión desde el panel de cocina
- **WHEN** el personal pulsa "Cerrar sesión" en el panel de cocina
- **THEN** el panel pide de nuevo la contraseña y no muestra ningún pedido

#### Scenario: El panel abierto mantiene la sesión
- **GIVEN** el panel de cocina abierto sin interrupción durante más de 30 días
- **WHEN** el personal sigue usándolo
- **THEN** el panel no pide la contraseña

### Requirement: La contraseña nunca se guarda en claro
El sistema MUST NOT almacenar ni registrar la contraseña de establecimiento en claro; solo MUST conservar una huella derivada que permita comprobarla.

#### Scenario: Sin contraseña en claro
- **GIVEN** el sistema configurado con la contraseña de establecimiento
- **WHEN** se revisan la base de datos, la configuración y los registros del servidor tras varios inicios de sesión
- **THEN** la contraseña no aparece en claro en ninguno de ellos
