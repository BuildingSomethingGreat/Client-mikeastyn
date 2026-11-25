import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  appType: 'mpa',
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        noir: resolve(__dirname, 'noir/index.html'),
        monolith: resolve(__dirname, 'monolith/index.html'),
      },
    },
  },
});
