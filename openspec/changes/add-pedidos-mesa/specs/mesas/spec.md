# Spec Delta

## Purpose

Permite al dueño dar de alta y mantener las mesas de La Estación, cada una con un código y un QR únicos que identifican la mesa en la carta, para que los pedidos se asocien siempre a una mesa y nunca a una persona.

## ADDED Requirements

### Requirement: Gestión de mesas protegida
La gestión de mesas y la consulta de sus QR MUST requerir una sesión de establecimiento válida. Sin ella, el sistema MUST rechazar cualquier operación sobre las mesas sin aplicar cambios y MUST NOT revelar los códigos de las mesas.

#### Scenario: Gestión de mesas sin sesión rechazada
- **WHEN** se intenta listar, crear, renombrar o archivar una mesa, o ver su QR, sin sesión de establecimiento
- **THEN** el sistema rechaza la operación, no muestra ningún código de mesa y las mesas no cambian

### Requirement: Crear mesas
El dueño MUST poder crear una mesa indicando su nombre. El nombre MUST ser obligatorio, tener como mucho 30 caracteres y MUST NOT coincidir con el de otra mesa activa (sin distinguir mayúsculas). Al crearla, el sistema MUST asignarle un código de mesa único y no adivinable, distinto del de cualquier otra mesa, activa o archivada.

#### Scenario: Crear una mesa
- **WHEN** el dueño crea la mesa "Mesa 7"
- **THEN** "Mesa 7" aparece en la lista de mesas activas con su código de mesa

#### Scenario: Nombre de mesa vacío
- **WHEN** el dueño intenta crear una mesa sin nombre
- **THEN** el sistema no la crea y le indica que el nombre es obligatorio

#### Scenario: Nombre de mesa demasiado largo
- **WHEN** el dueño intenta crear una mesa con un nombre de 31 caracteres
- **THEN** el sistema no la crea y le indica el máximo de 30 caracteres

#### Scenario: Nombre de mesa repetido
- **GIVEN** la mesa activa "Terraza 2"
- **WHEN** el dueño intenta crear la mesa "terraza 2"
- **THEN** el sistema no la crea y le indica que ya existe una mesa con ese nombre

#### Scenario: Códigos de mesa distintos y no adivinables
- **WHEN** el dueño crea las mesas "Mesa 1" y "Mesa 2"
- **THEN** cada una tiene un código de mesa distinto que no contiene su nombre ni su número de orden

### Requirement: Renombrar mesas
El dueño MUST poder cambiar el nombre de una mesa activa con las mismas reglas que al crearla. Renombrar una mesa MUST NOT cambiar su código de mesa, de modo que su QR impreso siga siendo válido.

#### Scenario: Renombrar una mesa conserva su QR
- **GIVEN** la mesa "Mesa 7" con su QR impreso
- **WHEN** el dueño la renombra como "Ventana 7"
- **THEN** la mesa se muestra como "Ventana 7" y su QR impreso sigue abriendo la carta de esa mesa

### Requirement: Ver e imprimir el QR de las mesas
La administración MUST mostrar el QR de cada mesa activa junto a su nombre y permitir imprimirlo, de uno en uno o todos a la vez, en una hoja por mesa con el nombre de la mesa y el texto "Escanee para ver la carta y pedir". El QR MUST abrir la dirección de mesa `/mesa/<código>` de esa mesa en la dirección pública del local.

#### Scenario: QR de una mesa
- **GIVEN** la mesa activa "Mesa 7"
- **WHEN** el dueño abre su QR en la administración
- **THEN** ve el nombre "Mesa 7" y un QR que, al escanearlo, abre la dirección de mesa de "Mesa 7"

#### Scenario: Imprimir todos los QR
- **GIVEN** las mesas activas "Mesa 1", "Mesa 2" y "Terraza 1"
- **WHEN** el dueño pide imprimir todos los QR
- **THEN** obtiene una hoja por mesa, cada una con su QR, su nombre y el texto "Escanee para ver la carta y pedir"

### Requirement: Archivar mesas
El dueño MUST poder archivar ("eliminar") una mesa activa tras confirmarlo. Una mesa archivada MUST NOT mostrarse en la lista de mesas activas, MUST conservarse en el sistema para que sus pedidos históricos la referencien y su código MUST NOT volver a asignarse. Su QR MUST dejar de permitir pedidos.

#### Scenario: Archivar una mesa
- **GIVEN** la mesa activa "Terraza 3"
- **WHEN** el dueño la elimina y confirma
- **THEN** "Terraza 3" deja de aparecer en la lista de mesas activas y sigue guardada en el sistema como archivada con sus pedidos

#### Scenario: Cancelar el archivado de una mesa
- **WHEN** el dueño pulsa eliminar en la mesa "Terraza 3" y cancela la confirmación
- **THEN** "Terraza 3" sigue activa

#### Scenario: Crear una mesa con el nombre de una archivada
- **GIVEN** la mesa archivada "Terraza 3"
- **WHEN** el dueño crea la mesa "Terraza 3"
- **THEN** se crea una mesa activa nueva con un código de mesa distinto del de la archivada

### Requirement: Gestión de mesas desde el móvil
La gestión de mesas MUST poder usarse por completo desde un móvil de 360 px de ancho, con botones de al menos 48×48 px y textos y mensajes de error en español de España.

#### Scenario: Gestión de mesas desde el móvil
- **WHEN** el dueño usa la gestión de mesas en una pantalla de 360 px de ancho
- **THEN** puede crear, renombrar y archivar mesas y ver sus QR sin desplazamiento horizontal, con botones de al menos 48×48 px
