import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Keep env loading available for future expansion; no Gemini-related vars are used.
  loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      // During local development, proxy API calls to the Express backend
      // running on port 3001 so that the frontend can call /api/image/generate
      // without CORS issues.
      proxy: {
        '/api': 'http://localhost:3001',
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
