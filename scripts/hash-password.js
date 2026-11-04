// Genera la huella de la contraseña de establecimiento para CARTAYA_PASSWORD_HASH.
// Uso: npm run hash-password   (pide la contraseña sin mostrarla)
//      echo "contraseña" | npm run hash-password --silent
import { hashPassword } from '../server/password.js';

function leerContrasenaOculta(pregunta) {
  return new Promise((resolver, rechazar) => {
    const { stdin, stdout } = process;
    stdout.write(pregunta);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let texto = '';
    stdin.on('data', function alPulsar(tecla) {
      for (const c of tecla) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', alPulsar);
          stdout.write('\n');
          return resolver(texto);
        }
        if (c === '\u0003') {
          stdin.setRawMode(false);
          return rechazar(new Error('Cancelado'));
        }
        if (c === '\u007f' || c === '\b') texto = texto.slice(0, -1);
        else texto += c;
      }
    });
  });
}

async function leerDeEntrada() {
  let texto = '';
  for await (const trozo of process.stdin) texto += trozo;
  return texto.replace(/\r?\n$/, '');
}

const password = process.stdin.isTTY
  ? await leerContrasenaOculta('Contraseña de establecimiento: ')
  : await leerDeEntrada();

if (!password || password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.');
  process.exit(1);
}

if (process.stdin.isTTY) {
  const repetida = await leerContrasenaOculta('Repita la contraseña: ');
  if (repetida !== password) {
    console.error('Las contraseñas no coinciden.');
    process.exit(1);
  }
  console.log('\nCopie esta línea en la configuración del servidor (variable de entorno):\n');
  console.log(`CARTAYA_PASSWORD_HASH='${hashPassword(password)}'`);
} else {
  console.log(hashPassword(password));
}
