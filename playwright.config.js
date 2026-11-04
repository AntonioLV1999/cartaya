import { defineConfig } from '@playwright/test';

const PUERTO = 4321;

export default defineConfig({
  testDir: 'web/e2e',
  // Los tests modifican el catálogo del servidor compartido: uno detrás de otro.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    // Móvil de 360 px de ancho, como el de los clientes y el del dueño.
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-ES',
  },
  webServer: {
    command: `npm run build && node scripts/servidor-prueba.js --puerto ${PUERTO}`,
    url: `http://localhost:${PUERTO}/api/carta`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
