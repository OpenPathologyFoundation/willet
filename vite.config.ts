import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [tailwindcss(), svelte()],
  server: {
    port: 5175,
    proxy: {
      // MCP server endpoints — route to the linguistic services server (:8001)
      // These bypass MSW entirely, hitting the real MCP server for LLM interpretation
      // and vocabulary correction. Falls back gracefully if the server is not running.
      '/api/interpret': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/interpret', '/interpret'),
      },
      // All other API calls — route to auth-system (:8080) in integrated mode.
      // In standalone mode, MSW intercepts these before the proxy fires.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        orchestrated: resolve(__dirname, 'orchestrated.html'),
      },
    },
  },
  resolve: {
    alias: {
      '$lib': resolve(__dirname, 'src/lib'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
