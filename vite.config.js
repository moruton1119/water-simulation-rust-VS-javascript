import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['../pkg/fluid_wasm.js'],
  },
  assetsInclude: ['**/*.wasm'],
});
