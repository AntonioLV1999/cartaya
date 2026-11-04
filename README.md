# CartaYa

Carta digital de **La Estación**. El cliente la consulta desde el QR de su mesa sin registrarse ni instalar nada, y el dueño la mantiene al día desde su móvil.

- Carta pública: `/` y `/carta` (solo consulta) y `/mesa/<código>` (carta de una mesa, desde la que se pide). El código de cada mesa es aleatorio y va en su QR.
- Administración del catálogo y de las mesas (con sus QR para imprimir): `/admin`, protegida con la contraseña de establecimiento.

Los requisitos están en `openspec/` (specs y cambios de OpenSpec), que es la fuente de verdad del comportamiento.

## Requisitos

- Node.js 22 o posterior (con npm).
- Nada más: la base de datos es SQLite en un único fichero y no hace falta Docker.

## Puesta en marcha desde cero

```bash
npm install
npm run hash-password        # pide la contraseña de establecimiento y muestra su huella
```

`npm run hash-password` pide la contraseña dos veces sin mostrarla (mínimo 8 caracteres) y escribe una línea como esta:

```
CARTAYA_PASSWORD_HASH='scrypt$16384$8$1$…$…'
```

Esa huella es lo **único** que se guarda: la contraseña nunca se almacena ni se registra en claro. Configure la variable de entorno antes de arrancar el servidor. Use **comillas simples**, porque la huella contiene `$`:

```bash
# Linux / macOS (bash)
export CARTAYA_PASSWORD_HASH='scrypt$16384$8$1$…$…'

# Windows (PowerShell)
$env:CARTAYA_PASSWORD_HASH = 'scrypt$16384$8$1$…$…'
```

Opcionalmente, cargue el catálogo de ejemplo (solo en una base de datos vacía):

```bash
npm run seed
```

### Desarrollo

```bash
npm run dev
```

Arranca Express en el puerto 3000 (API y fotos) y Vite en http://localhost:5173 (frontend con recarga en caliente y proxy de `/api` hacia Express). Abra http://localhost:5173/carta y http://localhost:5173/admin.

### Producción

```bash
npm run build
NODE_ENV=production npm start
```

El servidor escucha en el puerto 3000 (variable `PORT`) y sirve la carta, la administración, la API y las fotos. El esquema de la base de datos se crea solo al arrancar. Con `NODE_ENV=production` la cookie de sesión lleva `Secure`, así que debe servirse por HTTPS.

## Configuración

| Variable | Para qué | Por defecto |
|---|---|---|
| `CARTAYA_PASSWORD_HASH` | Huella de la contraseña de establecimiento (`npm run hash-password`). Sin ella no se puede entrar en la administración. | — |
| `CARTAYA_DATA_DIR` | Carpeta de datos: base de datos `cartaya.db` y fotos en `fotos/`. | `./data` |
| `PORT` | Puerto del servidor. | `3000` |
| `NODE_ENV` | `production` activa la cookie `Secure`. | — |
| `CARTAYA_URL_PUBLICA` | Dirección pública del local (p. ej. `https://laestacion.cartaya.es`). Es la que llevan los QR impresos de las mesas: configúrela **antes** de imprimirlos. Sin ella se usa la dirección con la que se abre la administración (válido en desarrollo). | — |
| `CARTAYA_TRUST_PROXY` | Si hay un proxy inverso delante (p. ej. `1` o `loopback`), para que el límite de intentos use la IP real del cliente. | desactivado |

### Cambiar la contraseña

Genere una huella nueva con `npm run hash-password`, cambie `CARTAYA_PASSWORD_HASH` y reinicie el servidor. **Todas las sesiones abiertas se cierran**, en todos los móviles. Hágalo si sospecha que alguien no autorizado conoce la contraseña.

### Sesión y bloqueo

La sesión dura 30 días sin uso en el mismo navegador y se renueva con cada uso. Tras 5 contraseñas incorrectas desde la misma dirección en 15 minutos, se bloquean los intentos desde esa dirección durante 15 minutos.

## Copia de seguridad

**Todo lo que importa está en la carpeta de datos** (`CARTAYA_DATA_DIR`, por defecto `./data`):

- `cartaya.db` (y, mientras el servidor está en marcha, `cartaya.db-wal` y `cartaya.db-shm`): el catálogo y las sesiones.
- `fotos/`: las fotos de los platos. No están dentro de la base de datos, así que hay que copiarlas también.

La forma más sencilla y segura:

1. Detenga el servidor.
2. Copie la carpeta de datos completa (por ejemplo, comprimida con la fecha: `cartaya-2026-11-04.zip`) a otro disco o a la nube.
3. Vuelva a arrancar el servidor.

Para restaurar, detenga el servidor, sustituya la carpeta de datos por la copia y arránquelo de nuevo.

Si no puede detener el servidor, copie primero la base de datos con SQLite (`sqlite3 data/cartaya.db ".backup copia.db"`) y después la carpeta `fotos/`.

## Tests

```bash
npm test            # API y BD (node:test + supertest), componentes (Vitest) y cruce escenarios ↔ tests
npm run test:e2e    # extremo a extremo en un móvil de 360 px (Playwright + axe-core)
npm run test:perf   # tiempo de carga con Lighthouse CI (móvil de gama media, 4G, 150 platos con foto)
```

Antes de la primera ejecución de `test:e2e` o `test:perf`, instale el navegador de pruebas: `npx playwright install chromium`.

Cada escenario de las specs (`#### Scenario: …`) tiene un test con su mismo nombre. `npm run test:escenarios` lo comprueba y falla si falta alguno.

## Dependencias

Además del stack fijado (Express, better-sqlite3, React, Vite), en producción solo se usan:

| Dependencia | Para qué |
|---|---|
| `compression` | Comprime la API y los estáticos: clave para cargar la carta en menos de 2 s con 4G. |
| `qrcode-generator` | Genera en el servidor el QR de cada mesa. JavaScript puro, sin dependencias, licencia MIT. Codificar QR a mano (Reed-Solomon, máscaras, versiones) es delicado, y un QR mal generado es una pegatina inservible. |

Las de desarrollo (supertest, Vitest, Testing Library, Playwright, axe-core, Lighthouse CI) solo sirven para los tests.

## Estructura

```
server/   Express, API, acceso a SQLite (schema.sql), sesión, fotos; alergenos.js y precio.js se comparten con web/
web/      React + Vite: carta.html (carta pública) y admin.html (administración), dos entradas separadas
scripts/  hash-password, seed, servidor de pruebas, test de rendimiento y cruce de escenarios
openspec/ Specs y cambios (fuente de verdad del comportamiento)
```
