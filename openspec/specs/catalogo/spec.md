# catalogo Specification

## Purpose

Permite al dueño mantener al día desde su móvil el catálogo de la cafetería (categorías, platos, orden, fotos y alérgenos) que alimenta la carta pública, conservando archivado lo que retira.

## Requirements

### Requirement: Administración protegida
La pantalla de administración del catálogo y todas sus operaciones MUST requerir una sesión de establecimiento válida. Sin ella, el sistema MUST rechazar cualquier operación de modificación del catálogo sin aplicar cambios.

#### Scenario: Acceso sin sesión
- **WHEN** un visitante sin sesión de establecimiento abre la pantalla de administración
- **THEN** el sistema le muestra la pantalla de inicio de sesión en lugar del catálogo

#### Scenario: Modificación sin sesión rechazada
- **WHEN** se intenta crear, editar, reordenar, marcar como agotado, archivar o recuperar un plato o una categoría sin sesión de establecimiento
- **THEN** el sistema rechaza la operación y el catálogo no cambia

### Requirement: Crear y editar categorías
El dueño MUST poder crear una categoría indicando su nombre, y cambiar después su nombre. El nombre MUST ser obligatorio y MUST NOT coincidir con el de otra categoría activa (sin distinguir mayúsculas). Una categoría nueva se añade al final del orden.

#### Scenario: Crear una categoría
- **WHEN** el dueño crea la categoría "Raciones"
- **THEN** "Raciones" aparece al final de la lista de categorías activas

#### Scenario: Nombre de categoría vacío
- **WHEN** el dueño intenta crear una categoría sin nombre
- **THEN** el sistema no la crea y le indica que el nombre es obligatorio

#### Scenario: Nombre de categoría repetido
- **GIVEN** la categoría activa "Bebidas"
- **WHEN** el dueño intenta crear la categoría "bebidas"
- **THEN** el sistema no la crea y le indica que ya existe una categoría con ese nombre

#### Scenario: Renombrar una categoría
- **WHEN** el dueño cambia el nombre de "Bocatas" a "Bocadillos"
- **THEN** la categoría se muestra como "Bocadillos" en la administración y en la carta

### Requirement: Ordenar categorías
El dueño MUST poder cambiar el orden de las categorías activas moviendo cada una hacia arriba o hacia abajo. La carta MUST reflejar ese orden.

#### Scenario: Subir una categoría
- **GIVEN** las categorías activas "Desayunos", "Bebidas", "Bocadillos" en ese orden
- **WHEN** el dueño sube "Bocadillos" una posición
- **THEN** el orden pasa a ser "Desayunos", "Bocadillos", "Bebidas"

### Requirement: Archivar categorías
El dueño MUST poder archivar ("eliminar") una categoría activa que no tenga platos activos. El sistema MUST NOT archivar una categoría que tenga platos activos e indicará al dueño que primero archive o mueva esos platos. Una categoría archivada se conserva en el sistema, MUST NOT mostrarse en la carta ni en la lista de categorías activas, y se pide confirmación antes de archivar.

#### Scenario: Archivar una categoría vacía
- **GIVEN** la categoría activa "Especiales de verano" sin platos activos
- **WHEN** el dueño la elimina y confirma
- **THEN** la categoría deja de aparecer en la administración y en la carta, y sigue guardada en el sistema como archivada

#### Scenario: Archivar una categoría con platos activos
- **GIVEN** la categoría "Postres" con 3 platos activos
- **WHEN** el dueño intenta eliminarla
- **THEN** el sistema no la archiva y le indica que primero archive o mueva sus 3 platos

### Requirement: Crear y editar platos
El dueño MUST poder crear un plato en una categoría activa y editar después su nombre, precio, descripción corta, categoría, foto y alérgenos. El nombre y el precio son obligatorios; el precio, en euros con IVA incluido, MUST ser mayor que 0 y tener como mucho dos decimales; la descripción corta MUST tener como mucho 140 caracteres. Un plato nuevo se añade al final de su categoría.

#### Scenario: Crear un plato
- **WHEN** el dueño crea en "Bocadillos" el plato "Lomo con queso" a 4,50 € declarando gluten y leche
- **THEN** el plato queda activo al final de "Bocadillos" y aparece en la carta

#### Scenario: Precio no válido
- **WHEN** el dueño intenta guardar un plato con precio 0 €, negativo o con más de dos decimales
- **THEN** el sistema no lo guarda y le indica que el precio no es válido

#### Scenario: Descripción demasiado larga
- **WHEN** el dueño intenta guardar un plato con una descripción de 141 caracteres
- **THEN** el sistema no lo guarda y le indica el máximo de 140 caracteres

#### Scenario: Cambiar el precio de un plato
- **GIVEN** el plato "Café con leche" a 1,50 €
- **WHEN** el dueño cambia su precio a 1,60 €
- **THEN** la carta muestra "Café con leche" a "1,60 €"

#### Scenario: Mover un plato a otra categoría
- **WHEN** el dueño cambia la categoría del plato "Tortilla" de "Raciones" a "Bocadillos"
- **THEN** "Tortilla" aparece al final de "Bocadillos" y ya no en "Raciones"

### Requirement: Declaración obligatoria de alérgenos
Al guardar un plato, el dueño MUST declarar o bien uno o varios de los 14 alérgenos de declaración obligatoria, o bien marcar explícitamente "Sin alérgenos". El sistema MUST NOT guardar un plato sin ninguna de las dos declaraciones, ni un plato que marque a la vez "Sin alérgenos" y algún alérgeno.

#### Scenario: Plato sin declaración de alérgenos
- **WHEN** el dueño intenta guardar un plato sin marcar ningún alérgeno ni "Sin alérgenos"
- **THEN** el sistema no lo guarda y le indica que debe declarar los alérgenos o marcar "Sin alérgenos"

#### Scenario: Declaración contradictoria
- **WHEN** el dueño intenta guardar un plato marcando "Sin alérgenos" y también "Leche"
- **THEN** el sistema no lo guarda y le indica que la declaración es contradictoria

#### Scenario: Plato declarado sin alérgenos
- **WHEN** el dueño guarda el plato "Agua mineral" marcando "Sin alérgenos"
- **THEN** el plato se guarda y la carta muestra "Sin alérgenos" en él

#### Scenario: Lista de alérgenos disponible
- **WHEN** el dueño abre el formulario de un plato
- **THEN** puede elegir entre exactamente los 14 alérgenos de declaración obligatoria, cada uno con su nombre escrito

### Requirement: Ordenar platos
El dueño MUST poder cambiar el orden de los platos activos dentro de su categoría moviendo cada uno hacia arriba o hacia abajo. La carta MUST reflejar ese orden.

#### Scenario: Bajar un plato
- **GIVEN** en "Bebidas" los platos "Café", "Té", "Zumo" en ese orden
- **WHEN** el dueño baja "Café" una posición
- **THEN** el orden pasa a ser "Té", "Café", "Zumo"

### Requirement: Archivar platos
El dueño MUST poder archivar ("eliminar") un plato activo tras confirmarlo. Un plato archivado MUST NOT volver a mostrarse en la carta ni en la lista de platos activos, y MUST conservarse en el sistema con sus datos (nombre, precio, alérgenos) para que los pedidos históricos puedan referenciarlo.

#### Scenario: Archivar un plato
- **GIVEN** el plato activo "Croquetas"
- **WHEN** el dueño lo elimina y confirma
- **THEN** "Croquetas" desaparece de la administración y de la carta y sigue guardado en el sistema como archivado con sus datos

#### Scenario: Cancelar el archivado
- **WHEN** el dueño pulsa eliminar en el plato "Croquetas" y cancela la confirmación
- **THEN** "Croquetas" sigue activo

### Requirement: Marcar platos agotados
El dueño MUST poder marcar un plato activo como agotado y volver a marcarlo como disponible. Marcarlo MUST NOT archivarlo, cambiar su posición ni duplicarlo.

#### Scenario: Marcar un plato como agotado
- **GIVEN** el plato activo "Tortilla" disponible
- **WHEN** el dueño lo marca como agotado
- **THEN** "Tortilla" sigue en la lista de platos activos en su posición y la carta lo muestra con la etiqueta "Agotado"

#### Scenario: Volver a marcar un plato disponible
- **GIVEN** el plato "Tortilla" marcado como agotado
- **WHEN** el dueño lo marca como disponible
- **THEN** la carta muestra "Tortilla" sin la etiqueta "Agotado"

### Requirement: Recuperar archivados
La administración MUST mostrar los platos y categorías archivados y permitir recuperarlos. Un plato recuperado vuelve activo, disponible, al final de su categoría; si su categoría está archivada, el dueño MUST elegir una categoría activa al recuperarlo. Una categoría recuperada vuelve activa al final del orden y sin platos activos. El sistema MUST NOT recuperar una categoría cuyo nombre coincida con el de otra categoría activa (sin distinguir mayúsculas).

#### Scenario: Ver los archivados
- **GIVEN** el plato archivado "Croquetas" y la categoría archivada "Especiales de verano"
- **WHEN** el dueño abre la lista de archivados
- **THEN** ve "Croquetas" y "Especiales de verano"

#### Scenario: Recuperar un plato
- **GIVEN** el plato archivado "Croquetas" de la categoría activa "Raciones"
- **WHEN** el dueño lo recupera
- **THEN** "Croquetas" aparece disponible al final de "Raciones" y en la carta

#### Scenario: Recuperar un plato de una categoría archivada
- **GIVEN** el plato archivado "Horchata" de la categoría archivada "Especiales de verano"
- **WHEN** el dueño lo recupera eligiendo la categoría "Bebidas"
- **THEN** "Horchata" aparece al final de "Bebidas"; sin elegir categoría, el sistema no lo recupera y le pide que elija una

#### Scenario: Recuperar una categoría
- **GIVEN** la categoría archivada "Especiales de verano"
- **WHEN** el dueño la recupera
- **THEN** aparece al final de las categorías activas, sin platos activos, y no se muestra en la carta hasta que tenga alguno

#### Scenario: Recuperar una categoría con nombre repetido
- **GIVEN** la categoría activa "Bebidas" y una categoría archivada "bebidas"
- **WHEN** el dueño intenta recuperar la archivada
- **THEN** el sistema no la recupera y le indica que ya existe una categoría con ese nombre

### Requirement: Foto del plato
El dueño MUST poder añadir, sustituir o quitar una foto por plato, en formato JPEG, PNG o WebP y de como mucho 5 MB tal como la elige en su móvil. El sistema MUST rechazar cualquier otro formato o tamaño mayor indicando el motivo, y MUST reducir la foto antes de servirla en la carta.

#### Scenario: Subir una foto válida
- **WHEN** el dueño añade al plato "Tostada con tomate" una foto JPEG de 3 MB
- **THEN** la carta muestra la foto en ese plato

#### Scenario: Foto demasiado grande
- **WHEN** el dueño intenta añadir una foto de 8 MB
- **THEN** el sistema no la acepta y le indica que el máximo es 5 MB

#### Scenario: Formato no admitido
- **WHEN** el dueño intenta añadir un fichero PDF como foto
- **THEN** el sistema no lo acepta y le indica que solo admite JPEG, PNG o WebP

#### Scenario: Quitar la foto
- **GIVEN** el plato "Tostada con tomate" con foto
- **WHEN** el dueño quita la foto
- **THEN** la carta muestra el plato sin foto y sin imagen rota

### Requirement: Administración desde el móvil
La pantalla de administración MUST poder usarse por completo desde un móvil de 360 px de ancho, con botones de al menos 48×48 px y textos y mensajes de error en español de España.

#### Scenario: Gestión completa desde el móvil
- **WHEN** el dueño usa la administración en una pantalla de 360 px de ancho
- **THEN** puede crear, editar, ordenar y archivar categorías y platos, marcar platos como agotados, recuperar archivados y subir fotos sin desplazamiento horizontal, con botones de al menos 48×48 px
