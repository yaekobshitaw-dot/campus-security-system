import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), tailwindcss()],
    appType: 'spa',
    server: {
      port: 5173,
      strictPort: true,
      host: '0.0.0.0',
      watch: {
        ignored: ['**/dist/**'],
      },
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:5002',
          changeOrigin: true,
          secure: false
        }
      }
    },
    // Vitest test settings: use jsdom environment so Leaflet and DOM-dependent imports have a window
    test: {
      environment: 'jsdom',
          globals: true,
          setupFiles: './src/setupTests.js'
        }
  };
});
