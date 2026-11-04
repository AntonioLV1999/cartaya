# Propuesta: carta digital de La Estación

## Por qué

Las cartas plastificadas de La Estación están siempre desactualizadas: cambiar un precio o retirar un plato obliga a reimprimir. Queremos una carta digital que Andrés mantenga al día desde su móvil y que el cliente consulte al escanear el QR de su mesa, sin instalar nada ni identificarse. Es la base sobre la que se construirá el pedido desde la mesa (siguiente cambio).

## Qué cambia

- **Carta pública**: una página web, accesible sin identificación, encabezada con el nombre del establecimiento, que muestra las categorías en el orden fijado por el dueño y, dentro de cada una, todos sus platos activos en orden manual. Cada plato muestra nombre, precio en euros con IVA incluido, descripción corta, foto opcional y sus alérgenos.
- **Alérgenos siempre visibles**: cada plato declara cuáles de los 14 alérgenos de declaración obligatoria (Reglamento (UE) n.º 1169/2011, anexo II) contiene, o declara explícitamente "sin alérgenos". Un plato sin esa declaración no se puede guardar. La carta muestra siempre el aviso "Si tiene alguna alergia o intolerancia alimentaria, consulte a nuestro personal".
- **Platos agotados**: el dueño puede marcar un plato activo como agotado y volver a marcarlo disponible. Un plato agotado sigue en la carta, en su sitio, con la etiqueta "Agotado" visible; no se archiva ni se duplica.
- **Gestión del catálogo**: pantalla de administración para móvil donde el dueño crea, edita, reordena, marca como agotados y archiva categorías y platos, y sube una foto por plato con límite de tamaño.
- **Archivado en lugar de borrado**: un plato o categoría "eliminado" por el dueño pasa a archivado; no aparece en la carta, pero se conserva en la base de datos para que los pedidos históricos puedan referenciarlo.
- **Recuperar archivados**: la administración muestra los platos y categorías archivados y permite recuperarlos, para deshacer un archivado por error.
- **Sesión de establecimiento**: acceso a la administración con la contraseña única del establecimiento (no hay usuarios). Es el primer cambio que la necesita, así que se introduce aquí.
- **Entrada por QR**: las URL de mesa (`/mesa/<identificador>`) muestran la carta. En este cambio el identificador de mesa no se valida ni se muestra; el pedido lo aprovechará.

## Capacidades

### Capacidades nuevas
- `carta-publica`: consulta pública de la carta por parte del cliente final (estructura, contenido de cada plato, alérgenos, platos agotados, accesibilidad y rendimiento).
- `catalogo`: administración del catálogo por el dueño (categorías, platos, orden, agotado, archivado y recuperación, fotos y declaración de alérgenos).
- `sesion-establecimiento`: inicio y cierre de la sesión de establecimiento con contraseña y protección de las pantallas y operaciones de administración.

### Capacidades modificadas
_Ninguna (no hay specs vivas todavía)._

## Fuera de alcance

- Pedido desde la mesa (siguiente cambio), panel de cocina.
- Precios por franjas horarias, múltiples idiomas.
- Cualquier cuenta, registro o dato personal del cliente final (principio 3).
- Varios precios o tamaños dentro de un mismo plato, y suplementos o extras.
- Declaración de trazas ("puede contener").
- Horario, teléfono, dirección o logotipo del local en la carta.
- Gestión de mesas, validación del identificador de mesa y generación de los códigos QR.

## Decisiones de negocio

Origen: **Andrés** = requisito expresado por el cliente; **Equipo** = decisión tomada por el equipo para desbloquear el cambio, pendiente de validar con Andrés antes de archivar.

| Fecha | Origen | Decisión |
|-------|--------|----------|
| 2026-11-03 | Andrés | La carta sustituye a las cartas plastificadas y es pública: no requiere identificación. |
| 2026-11-03 | Andrés | Las categorías las define el dueño, en el orden que él decida; los platos tienen orden manual dentro de cada categoría. |
| 2026-11-03 | Andrés | La carta muestra todos los platos activos. "Eliminar" un plato significa archivarlo: no aparece en la carta, pero se conserva. |
| 2026-11-03 | Andrés | Cada plato muestra nombre, precio (euros, IVA incluido), descripción corta, foto opcional y alérgenos. |
| 2026-11-03 | Andrés | Los alérgenos (los 14 de declaración obligatoria en la UE) se muestran siempre; un plato sin alérgenos lo declara explícitamente. La ausencia de información no está permitida. |
| 2026-11-03 | Andrés | La carta debe cargar en menos de 2 segundos en un móvil de gama media con 4G. |
| 2026-11-03 | Andrés | La administración del catálogo está protegida por la sesión de establecimiento y se diseña para el móvil. |
| 2026-11-03 | Equipo | **Agotado**: un plato activo puede marcarse como agotado. Sigue mostrándose en la carta con la etiqueta "Agotado" (así se cumple que la carta muestra todos los platos activos) y se desmarca cuando vuelve a haber. Un plato fuera de temporada se archiva y se recupera después. |
| 2026-11-03 | Equipo | **Un precio por plato**: no hay tamaños ni variantes dentro de un plato. "Media ración de croquetas" y "Ración de croquetas" son dos platos distintos. Es lo más simple y cubre la carta actual. |
| 2026-11-03 | Equipo | **Precio histórico** (lo aplicará el cambio del pedido): un pedido guarda una copia del nombre y el precio del plato en el momento de pedir. Por eso editar un plato no altera pedidos pasados y el catálogo no necesita versiones. |
| 2026-11-03 | Equipo | **Trazas**: no se declaran en este cambio; solo los 14 alérgenos obligatorios. El aviso fijo de consultar al personal cubre los casos de contaminación cruzada. |
| 2026-11-03 | Equipo | **Aviso de alergias**: la carta muestra siempre, visible al principio, el texto "Si tiene alguna alergia o intolerancia alimentaria, consulte a nuestro personal". |
| 2026-11-03 | Equipo | **Archivar categorías**: solo se puede archivar una categoría sin platos activos; hay que archivar o mover antes sus platos. Evita archivar platos por accidente. |
| 2026-11-03 | Equipo | **Categorías vacías**: una categoría sin platos activos no se muestra en la carta. Una categoría cuyos platos están todos agotados sí se muestra. |
| 2026-11-03 | Equipo | **Recuperar**: los platos y categorías archivados se pueden recuperar desde la administración. Un plato recuperado vuelve al final de su categoría; si su categoría está archivada, el dueño elige una categoría activa al recuperarlo. Una categoría recuperada vuelve al final y vacía (sus platos se recuperan uno a uno). |
| 2026-11-03 | Equipo | **Precio**: debe ser mayor que 0 € con como mucho dos decimales. Lo gratuito (agua del grifo) no se pone en la carta. |
| 2026-11-03 | Equipo | **Descripción corta**: como mucho 140 caracteres (dos líneas en un móvil). |
| 2026-11-03 | Equipo | **Foto**: JPEG, PNG o WebP de hasta 5 MB tal como sale del móvil; antes de subirla se reduce en el propio móvil. Una foto por plato. |
| 2026-11-03 | Equipo | **Sesión**: una única contraseña de establecimiento, compartida por quien la conozca (dueño o camareros). La sesión dura 30 días sin uso en el mismo navegador; tras 5 intentos fallidos se bloquea 15 minutos. Si se sospecha que alguien no autorizado la conoce, se cambia la contraseña y se cierran todas las sesiones. |
| 2026-11-03 | Equipo | **Orden**: categorías y platos se reordenan con botones grandes de subir/bajar, más fáciles en el móvil que arrastrar y soltar. |
| 2026-11-03 | Equipo | **Datos del local**: la carta muestra solo el nombre "La Estación" en la cabecera. Horario, teléfono y logotipo quedan fuera de alcance. |
| 2026-11-03 | Equipo | **Mesa en la URL**: en este cambio el identificador de mesa no se valida ni se muestra; cualquier `/mesa/<identificador>` muestra la carta. El cambio del pedido definirá qué pasa con una mesa inexistente. |
| 2026-11-04 | Equipo | **Plato recuperado disponible**: un plato recuperado vuelve sin la marca de agotado, aunque la tuviera al archivarlo. |
| 2026-11-04 | Equipo | **Categoría recuperada con nombre repetido**: si ya existe una categoría activa con el mismo nombre (sin distinguir mayúsculas), no se recupera; el dueño renombra antes una de las dos. |

## Impacto

- Proyecto nuevo: se crean el servidor Express (API y estáticos), la base de datos SQLite con las tablas de categorías, platos, alérgenos y sesiones, y el frontend React con la carta pública y la administración.
- Fotos guardadas como ficheros en disco, servidas por Express.
- Configuración: la contraseña del establecimiento se proporciona como hash por variable de entorno; cambiarla invalida todas las sesiones abiertas.
- Dependencias nuevas fuera del stack fijado: solo `compression` en producción y herramientas de test en desarrollo, todas justificadas en design.md.
