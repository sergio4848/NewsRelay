import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist/renderer',
    rollupOptions: { input: { app: 'index.html', output: 'output.html' } },
  },
});
