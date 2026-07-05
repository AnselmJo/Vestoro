import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages serves the app under /Vestoro/ — keep in sync with repo name.
  base: process.env.GITHUB_PAGES ? '/Vestoro/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'node',
  },
});
