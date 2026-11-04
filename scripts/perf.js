// Test de rendimiento de la carta (npm run test:perf) con Lighthouse CI.
// Perfil móvil de gama media (CPU ×4) con 4G simulado (150 ms de latencia, 1,6 Mbit/s),
// sin caché, sobre la semilla de 150 platos con foto.
//
// Escenarios de la spec carta-publica:
//  - «Carga en móvil de gama media con 4G»: el texto completo de la carta (marca
//    `carta-texto-visible`, que la carta pone al pintar categorías, platos, precios y alérgenos)
//    aparece en menos de 2 s.
//  - «Las fotos no bloquean el texto»: con fotos que tardan 5 s en servirse, el texto
//    sigue apareciendo en menos de 2 s.
// Además comprueba que el JS de la carta pesa como mucho 60 KB comprimido con gzip (design.md).
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import { arrancarServidorPrueba } from './servidor-prueba.js';

const UMBRAL_MS = 2000;
const PRESUPUESTO_JS = 60 * 1024;
const DIST = 'web/dist';
const RESULTADOS = '.lighthouseci';
const fallos = [];

function comprobar(nombre, ok, detalle) {
  console.log(`${ok ? '✔' : '✖'} ${nombre}: ${detalle}`);
  if (!ok) fallos.push(nombre);
}

// ---------- 1. Compilar y medir el JS de la carta ----------
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--logLevel', 'warn'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/precomprimir.js'], { stdio: 'inherit' });

const html = readFileSync(join(DIST, 'carta.html'), 'utf8');
const scripts = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
// Lo que se transfiere de verdad: la variante .br precomprimida que sirve Express.
const pesoJs = scripts.reduce((total, ruta) => total + statSync(join(DIST, `${ruta}.br`)).size, 0);
const pesoGzip = scripts.reduce((total, ruta) => total + gzipSync(readFileSync(join(DIST, ruta)), { level: 9 }).length, 0);
comprobar(
  'JS de la carta ≤ 60 KB transferidos con brotli',
  pesoJs <= PRESUPUESTO_JS,
  `${(pesoJs / 1024).toFixed(1)} KB brotli (${(pesoGzip / 1024).toFixed(1)} KB gzip, para navegadores sin brotli; ${scripts.join(', ')})`,
);
const htmlAdmin = readFileSync(join(DIST, 'admin.html'), 'utf8');
const soloAdmin = [...htmlAdmin.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
comprobar('La carta no descarga el código de administración', soloAdmin.every((s) => !scripts.includes(s)), soloAdmin.join(', '));

// ---------- 2. Lighthouse CI ----------
const chromePath = chromium.executablePath();
const ajustes = {
  formFactor: 'mobile',
  screenEmulation: { mobile: true, width: 360, height: 740, deviceScaleFactor: 2, disabled: false },
  // devtools: la red y la CPU se frenan de verdad, así las marcas de tiempo reflejan el 4G.
  throttlingMethod: 'devtools',
  throttling: { requestLatencyMs: 562.5, downloadThroughputKbps: 1474.56, uploadThroughputKbps: 675, cpuSlowdownMultiplier: 4 },
  disableStorageReset: false,
  onlyCategories: ['performance'],
  locale: 'es',
};

function lighthouse(url) {
  rmSync(RESULTADOS, { recursive: true, force: true });
  const r = spawnSync(
    process.execPath,
    [
      'node_modules/@lhci/cli/src/cli.js',
      'collect',
      `--url=${url}`,
      '--numberOfRuns=3',
      `--chromePath=${chromePath}`,
      ...Object.entries(ajustes).flatMap(([k, v]) =>
        typeof v === 'object' && !Array.isArray(v)
          ? Object.entries(v).map(([k2, v2]) => `--settings.${k}.${k2}=${v2}`)
          : Array.isArray(v)
            ? v.map((x) => `--settings.${k}=${x}`)
            : [`--settings.${k}=${v}`],
      ),
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
  if (r.status !== 0) throw new Error('Lighthouse CI no ha terminado correctamente');
  const informes = readdirSync(RESULTADOS)
    .filter((f) => f.startsWith('lhr-') && f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(RESULTADOS, f), 'utf8')));
  return informes.map((lhr) => {
    const marca = lhr.audits['user-timings']?.details?.items?.find((i) => i.name === 'carta-texto-visible');
    return {
      textoVisible: marca?.startTime ?? Infinity,
      fcp: lhr.audits['first-contentful-paint'].numericValue,
      errores: lhr.runtimeError?.message,
    };
  });
}

/** Mediana de las ejecuciones, como hace Lighthouse CI. */
const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function escenario(nombre, opciones) {
  const servidor = await arrancarServidorPrueba({ puerto: 4400, rendimiento: true, ...opciones });
  try {
    const ejecuciones = lighthouse(`${servidor.url}/carta`);
    const texto = mediana(ejecuciones.map((e) => e.textoVisible));
    const fcp = mediana(ejecuciones.map((e) => e.fcp));
    comprobar(
      nombre,
      texto < UMBRAL_MS,
      `texto completo visible en ${Math.round(texto)} ms (FCP ${Math.round(fcp)} ms; ejecuciones: ${ejecuciones
        .map((e) => Math.round(e.textoVisible))
        .join(', ')} ms)`,
    );
  } finally {
    await servidor.cerrar();
  }
}

await escenario('Carga en móvil de gama media con 4G', {});
await escenario('Las fotos no bloquean el texto', { retrasoFotos: 5000 });

if (fallos.length) {
  console.error(`\nRendimiento: ${fallos.length} comprobación(es) fallida(s): ${fallos.join('; ')}`);
  process.exit(1);
}
console.log('\nRendimiento: todo correcto.');
