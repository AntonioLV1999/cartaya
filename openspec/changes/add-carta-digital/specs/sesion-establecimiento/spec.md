# Spec Delta: sesion-establecimiento

## Purpose

Protege las funciones de administración de CartaYa con una única contraseña de establecimiento, sin cuentas de usuario, para que solo el personal de La Estación pueda modificar el sistema.

## ADDED Requirements

### Requirement: Inicio de sesión con contraseña de establecimiento
El sistema MUST permitir iniciar la sesión de establecimiento introduciendo únicamente la contraseña de establecimiento, sin nombre de usuario. Con la contraseña correcta, el sistema MUST abrir la sesión y llevar a la administración; con una incorrecta, MUST NOT abrirla y MUST mostrar un mensaje que no revele información sobre la contraseña.

#### Scenario: Contraseña correcta
- **WHEN** el dueño introduce la contraseña de establecimiento correcta
- **THEN** el sistema abre la sesión de establecimiento y muestra la administración del catálogo

#### Scenario: Contraseña incorrecta
- **WHEN** alguien introduce una contraseña incorrecta
- **THEN** el sistema no abre la sesión y muestra "Contraseña incorrecta"

### Requirement: Límite de intentos fallidos
Tras 5 intentos fallidos consecutivos desde la misma dirección en 15 minutos, el sistema MUST rechazar nuevos intentos desde esa dirección durante 15 minutos, aunque la contraseña sea correcta, indicando cuándo puede volver a intentarse.

#### Scenario: Bloqueo tras 5 intentos fallidos
- **GIVEN** 5 intentos fallidos consecutivos desde la misma dirección en los últimos 15 minutos
- **WHEN** desde esa dirección se introduce la contraseña correcta
- **THEN** el sistema no abre la sesión e indica que se vuelva a intentar pasados 15 minutos

### Requirement: Duración y cierre de la sesión
La sesión de establecimiento MUST mantenerse abierta en el mismo navegador durante 30 días sin uso o hasta que se cierre. El dueño MUST poder cerrar la sesión desde la administración; tras cerrarla, la administración MUST volver a pedir la contraseña.

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

### Requirement: La contraseña nunca se guarda en claro
El sistema MUST NOT almacenar ni registrar la contraseña de establecimiento en claro; solo MUST conservar una huella derivada que permita comprobarla.

#### Scenario: Sin contraseña en claro
- **GIVEN** el sistema configurado con la contraseña de establecimiento
- **WHEN** se revisan la base de datos, la configuración y los registros del servidor tras varios inicios de sesión
- **THEN** la contraseña no aparece en claro en ninguno de ellos
