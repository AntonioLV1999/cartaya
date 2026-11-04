# carta-publica Specification

## Purpose

Permite al cliente final consultar desde su móvil, sin identificarse ni instalar nada, la carta vigente de La Estación con precios y alérgenos de cada plato.

## Requirements

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

### Requirement: Cabecera y aviso de alergias
La carta MUST mostrar en su cabecera el nombre del establecimiento "La Estación" y, visible al principio sin necesidad de pulsar nada, el aviso "Si tiene alguna alergia o intolerancia alimentaria, consulte a nuestro personal".

#### Scenario: Nombre del establecimiento en la cabecera
- **WHEN** un visitante consulta la carta
- **THEN** la cabecera muestra "La Estación"

#### Scenario: Aviso de alergias visible
- **WHEN** un visitante consulta la carta
- **THEN** antes de la primera categoría se muestra el texto "Si tiene alguna alergia o intolerancia alimentaria, consulte a nuestro personal"

### Requirement: Organización por categorías
El sistema MUST mostrar las categorías activas en el orden fijado por el dueño y, dentro de cada categoría, sus platos activos en el orden manual fijado por el dueño. Una categoría activa sin platos activos MUST NOT mostrarse.

#### Scenario: Categorías en el orden del dueño
- **GIVEN** las categorías activas "Desayunos", "Bocadillos" y "Bebidas" con ese orden fijado por el dueño
- **WHEN** un visitante consulta la carta
- **THEN** las categorías aparecen en el orden "Desayunos", "Bocadillos", "Bebidas"

#### Scenario: Platos en el orden manual de su categoría
- **GIVEN** la categoría "Bocadillos" con los platos activos "Calamares", "Lomo" y "Tortilla" en ese orden manual
- **WHEN** un visitante consulta la carta
- **THEN** dentro de "Bocadillos" los platos aparecen en el orden "Calamares", "Lomo", "Tortilla"

#### Scenario: Categoría sin platos activos oculta
- **GIVEN** la categoría activa "Postres" cuyos platos están todos archivados
- **WHEN** un visitante consulta la carta
- **THEN** la categoría "Postres" no aparece en la carta

### Requirement: Solo platos activos
El sistema MUST mostrar todos los platos activos de cada categoría activa y MUST NOT mostrar jamás un plato archivado ni los platos de una categoría archivada.

#### Scenario: Se muestran todos los platos activos
- **GIVEN** la categoría "Raciones" con 12 platos activos
- **WHEN** un visitante consulta la carta
- **THEN** aparecen los 12 platos en la categoría "Raciones"

#### Scenario: Un plato archivado no aparece
- **GIVEN** el plato "Croquetas" archivado por el dueño
- **WHEN** un visitante consulta la carta
- **THEN** "Croquetas" no aparece en ninguna parte de la carta

#### Scenario: Los cambios del catálogo se reflejan al recargar
- **GIVEN** un visitante con la carta abierta
- **WHEN** el dueño archiva un plato y el visitante recarga la carta
- **THEN** el plato ya no aparece

### Requirement: Platos agotados
Un plato activo marcado como agotado MUST seguir mostrándose en la carta, en su posición, con su nombre, precio y alérgenos y con la etiqueta de texto "Agotado" visible. Una categoría activa cuyos platos activos están todos agotados MUST mostrarse.

#### Scenario: Plato agotado en la carta
- **GIVEN** el plato activo "Tortilla" marcado como agotado, segundo de "Raciones"
- **WHEN** un visitante consulta la carta
- **THEN** "Tortilla" aparece en segunda posición de "Raciones" con su precio, sus alérgenos y la etiqueta "Agotado"

#### Scenario: Categoría con todos sus platos agotados
- **GIVEN** la categoría "Postres" cuyos platos activos están todos agotados
- **WHEN** un visitante consulta la carta
- **THEN** la categoría "Postres" aparece con sus platos y la etiqueta "Agotado" en cada uno

### Requirement: Contenido de cada plato
El sistema MUST mostrar en cada plato su nombre, su precio en euros con IVA incluido en formato español (coma decimal y símbolo € detrás, p. ej. "3,50 €"), su descripción corta si la tiene y su foto si la tiene. Un plato sin foto MUST mostrarse correctamente, sin imagen rota.

#### Scenario: Plato con todos sus datos
- **GIVEN** el plato "Tostada con tomate" con precio 2,80 €, descripción "Pan de pueblo con tomate rallado y AOVE" y foto
- **WHEN** un visitante consulta la carta
- **THEN** el plato muestra el nombre "Tostada con tomate", el precio "2,80 €", la descripción y la foto

#### Scenario: Plato sin foto
- **GIVEN** el plato "Café con leche" sin foto
- **WHEN** un visitante consulta la carta
- **THEN** el plato se muestra con nombre, precio y alérgenos y sin ninguna imagen rota

#### Scenario: Formato del precio
- **GIVEN** un plato con precio de 12 euros exactos
- **WHEN** un visitante consulta la carta
- **THEN** el precio se muestra como "12,00 €"

### Requirement: Alérgenos siempre visibles
El sistema MUST mostrar en cada plato, de forma visible sin necesidad de pulsar ni desplegar nada, los alérgenos que contiene de entre los 14 de declaración obligatoria (gluten, crustáceos, huevos, pescado, cacahuetes, soja, leche, frutos de cáscara, apio, mostaza, sésamo, dióxido de azufre y sulfitos, altramuces y moluscos), cada uno con su nombre escrito. Un plato declarado sin alérgenos MUST mostrar el texto "Sin alérgenos".

#### Scenario: Plato con alérgenos
- **GIVEN** el plato "Bocadillo de calamares" que declara gluten, moluscos y huevos
- **WHEN** un visitante consulta la carta
- **THEN** el plato muestra visibles, con su nombre escrito, "Gluten", "Huevos" y "Moluscos" sin que el visitante tenga que pulsar nada

#### Scenario: Plato sin alérgenos
- **GIVEN** el plato "Zumo de naranja" declarado sin alérgenos
- **WHEN** un visitante consulta la carta
- **THEN** el plato muestra el texto "Sin alérgenos"

#### Scenario: Ningún plato sin información de alérgenos
- **WHEN** un visitante consulta la carta
- **THEN** cada plato mostrado incluye o bien al menos un alérgeno o bien el texto "Sin alérgenos"

### Requirement: Legibilidad y accesibilidad
La carta MUST estar diseñada para móvil y ser legible a contraluz por personas mayores: texto base de al menos 18 px, contraste de texto de al menos 7:1 (WCAG AAA) y elementos interactivos de al menos 48×48 px. La carta MUST seguir siendo usable con el texto ampliado al 200 % sin desplazamiento horizontal.

#### Scenario: Tamaño de texto y contraste
- **WHEN** se mide la carta en una pantalla de 360 px de ancho
- **THEN** el texto de nombre, precio, descripción y alérgenos tiene al menos 18 px y un contraste de al menos 7:1 con su fondo

#### Scenario: Texto ampliado
- **WHEN** un visitante amplía el texto al 200 % en una pantalla de 360 px de ancho
- **THEN** todo el contenido sigue visible sin desplazamiento horizontal

#### Scenario: Navegación entre categorías
- **WHEN** un visitante pulsa el nombre de una categoría en el índice de la carta
- **THEN** la carta se desplaza a esa categoría, y el botón pulsado mide al menos 48×48 px

### Requirement: Tiempo de carga
La carta MUST mostrar su contenido completo de texto (categorías, platos, precios y alérgenos) en menos de 2 segundos en un móvil de gama media con red 4G, con un catálogo de hasta 150 platos activos. Las fotos MUST NOT retrasar la aparición del texto.

#### Scenario: Carga en móvil de gama media con 4G
- **GIVEN** un catálogo con 150 platos activos con foto
- **WHEN** se carga la carta sin caché simulando un móvil de gama media con red 4G
- **THEN** categorías, platos, precios y alérgenos son visibles en menos de 2 segundos

#### Scenario: Las fotos no bloquean el texto
- **GIVEN** un catálogo cuyas fotos tardan en servirse
- **WHEN** un visitante carga la carta
- **THEN** el texto de la carta aparece sin esperar a las fotos
