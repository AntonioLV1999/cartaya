// Comprueba que cada escenario de las specs (líneas «#### Scenario: …») tiene al menos un test
// con su mismo nombre en la suite (node:test, Vitest o Playwright). Uso: npm run test:escenarios
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

function ficheros(dir, filtro, lista = []) {
  if (!existsSync(dir)) return lista;
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (nombre === 'node_modules' || nombre === 'archive' || nombre === 'dist') continue;
    if (statSync(ruta).isDirectory()) ficheros(ruta, filtro, lista);
    else if (filtro(ruta)) lista.push(ruta);
  }
  return lista;
}

// Specs vivas y deltas de los cambios en curso.
const specs = [...ficheros('openspec/specs', (f) => f.endsWith('spec.md')), ...ficheros('openspec/changes', (f) => f.endsWith('spec.md'))];
const escenarios = new Map();
for (const spec of specs) {
  for (const m of readFileSync(spec, 'utf8').matchAll(/^#### Scenario: (.+?)\s*$/gm)) {
    if (!escenarios.has(m[1])) escenarios.set(m[1], spec);
  }
}

// Tests de node:test/Vitest/Playwright (`test('…')`) y escenarios de rendimiento de Lighthouse CI (`escenario('…')`).
const tests = [...ficheros('.', (f) => /\.(test|spec)\.jsx?$/.test(f) && !f.includes('node_modules')), join('scripts', 'perf.js')];
const nombresDeTest = new Set();
for (const f of tests) {
  for (const m of readFileSync(f, 'utf8').matchAll(/\b(?:test|escenario)\(\s*(['"`])((?:(?!\1).)+)\1/g)) nombresDeTest.add(m[2]);
}

const sinTest = [...escenarios].filter(([nombre]) => !nombresDeTest.has(nombre));
console.log(`${escenarios.size} escenarios en ${specs.length} specs; ${nombresDeTest.size} tests en ${tests.length} ficheros.`);
if (sinTest.length) {
  console.error('\nEscenarios sin un test con su mismo nombre:');
  for (const [nombre, spec] of sinTest) console.error(`  ✖ ${nombre}  (${spec})`);
  process.exit(1);
}
console.log('✔ Cada escenario tiene un test con su mismo nombre.');
