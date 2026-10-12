import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_API_URL || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development, forward API calls to the backend so no CORS setup is needed.
    proxy: {
      '/api': apiTarget,
    },
  },
});
