import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    //  QUEM PODE CHAMAR ESTA TELA PELO NOME.
    //
    //  O Vite recusa, com 403, requisicao cujo Host ele nao
    //  reconhece — protecao contra "DNS rebinding", em que um
    //  site de fora faz o navegador de alguem falar com um
    //  servidor da rede interna. A protecao esta certa.
    //
    //  `.nip.io` entra porque o link do convite de cotacao viaja
    //  pelo WhatsApp, e o WhatsApp NAO transforma endereco de IP
    //  em link clicavel: ele pinta so o "192.168.1.109" e deixa
    //  o caminho como texto. Com um NOME, a linha inteira vira
    //  link. O nip.io resolve `192-168-1-109.nip.io` para o
    //  proprio 192.168.1.109 — ou seja, continua sendo a rede
    //  local, nada e exposto para fora.
    //
    //  Quando a Porto Inc. tiver dominio proprio, ele entra aqui
    //  e o nip.io sai.
    //  `.trycloudflare.com` entra para o TESTE do link: um tunel
    //  da um endereco publico de verdade, com HTTPS, e e a unica
    //  forma de a miniatura do WhatsApp funcionar antes de a
    //  empresa ter dominio — quem monta a miniatura e o servidor
    //  do WhatsApp, e ele precisa ALCANCAR a pagina.
    //
    //  Sai junto com o tunel quando o teste acabar.
    allowedHosts: ['.nip.io', '.sslip.io', '.trycloudflare.com', 'localhost'],
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
