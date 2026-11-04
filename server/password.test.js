import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hashPassword, verificarPassword, huellaValida } from './password.js';

test('Contraseña: la correcta valida y una incorrecta no', () => {
  const huella = hashPassword('la-estacion-1987');
  assert.ok(huellaValida(huella));
  assert.equal(verificarPassword('la-estacion-1987', huella), true);
  assert.equal(verificarPassword('la-estacion-1988', huella), false);
  assert.equal(verificarPassword('', huella), false);
  assert.equal(verificarPassword(undefined, huella), false);
  assert.equal(verificarPassword('la-estacion-1987', 'basura'), false);
});

test('Contraseña: dos huellas de la misma contraseña son distintas (sal aleatoria)', () => {
  assert.notEqual(hashPassword('misma-clave'), hashPassword('misma-clave'));
});

test('Contraseña: npm run hash-password genera una huella válida', () => {
  const script = fileURLToPath(new URL('../scripts/hash-password.js', import.meta.url));
  const salida = execFileSync(process.execPath, [script], { input: 'cafe-con-leche-2026\n' }).toString().trim();
  assert.ok(huellaValida(salida), salida);
  assert.ok(!salida.includes('cafe-con-leche-2026'));
  assert.equal(verificarPassword('cafe-con-leche-2026', salida), true);
});
