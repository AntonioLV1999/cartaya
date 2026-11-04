import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const web = (f) => fileURLToPath(new URL(`./web/${f}`, import.meta.url));

// En desarrollo, mismas URL que en producción: /, /carta y /mesa/:id → carta; /admin → administración.
const rutasDePagina = {
  name: 'cartaya-rutas',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const ruta = req.url.split('?')[0];
      if (ruta === '/' || ruta === '/carta' || /^\/mesa\/[^/]+\/?$/.test(ruta)) req.url = '/carta.html';
      else if (ruta === '/admin') req.url = '/admin.html';
      next();
    });
  },
};

export default defineConfig({
  root: 'web',
  plugins: [rutasDePagina],
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { carta: web('carta.html'), admin: web('admin.html') },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/fotos': 'http://localhost:3000',
    },
  },
  test: {
    root: '.',
    include: ['web/**/*.test.{js,jsx}'],
    environment: 'jsdom',
  },
});
