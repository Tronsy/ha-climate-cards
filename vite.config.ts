/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/climate-sensor-card.ts',
      formats: ['es'],
      fileName: () => 'climate-sensor-card.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2021',
    sourcemap: false,
  },
  server: {
    port: 5173,
    open: false,
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
