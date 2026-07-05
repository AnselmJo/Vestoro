import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages serves the app under /Vestoro/ — keep in sync with repo name.
  base: process.env.GITHUB_PAGES ? '/Vestoro/' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    // ECharts lazy-loads to ~1 MB minified; raise the warning limit so the
    // build doesn't flag a chunk that is intentionally deferred.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep ECharts (+ its zrender dependency) in one cacheable chunk.
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
            return 'echarts';
          }
          // Dexie is loaded at startup but benefits from a separate chunk for
          // cache stability across app updates.
          if (id.includes('node_modules/dexie')) {
            return 'dexie';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
