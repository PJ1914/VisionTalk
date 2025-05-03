import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'https://xbtdzww3-8000.inc1.devtunnels.ms/',
    },
  },
});