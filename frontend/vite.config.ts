import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      // No Windows com Docker o aviso de arquivo alterado nao chega
      // sozinho: precisamos verificar de tempos em tempos.
      usePolling: true,
      interval: 800,
    },
    // Encaminha /api para o container da API: evita problema de CORS
    // e faz o endereco no navegador ficar igual ao de producao.
    proxy: {
      '/api': {
        target: 'http://api:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // O build precisa caber em 1 GB: dividimos em pedacos menores.
    chunkSizeWarningLimit: 600,
  },
});
