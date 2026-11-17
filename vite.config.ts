import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true, port: 5173, strictPort: true },
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
});
