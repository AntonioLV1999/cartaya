// Desarrollo: arranca Express (API, puerto 3000) y Vite (frontend con proxy /api, puerto 5173).
import { spawn } from 'node:child_process';

const procesos = [
  spawn(process.execPath, ['--watch-path=server', 'server/index.js'], { stdio: 'inherit', env: process.env }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit', env: process.env }),
];

function parar() {
  for (const p of procesos) p.kill();
  process.exit();
}
process.on('SIGINT', parar);
process.on('SIGTERM', parar);
for (const p of procesos) p.on('exit', (codigo) => codigo && parar());
