// ============================================================
//  Testes das telas
//
//  Fica separado do `vite.config.ts` de propósito: assim o build
//  de produção não passa a depender do Vitest estar instalado.
// ============================================================
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // O jsdom monta um navegador de mentira em memória: tem botão,
    // tem clique, tem foco, tem leitor de tela. O que ele NÃO tem é
    // aparência — nada aqui mede alinhamento, cor ou espaçamento.
    // Isso continua sendo a régua (scripts/auditoria-ui.mjs) e o olho
    // de quem olha. Um teste não substitui o outro.
    environment: 'jsdom',
    setupFiles: ['./src/testes/preparar.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // O container tem 1 GB e 1 núcleo. Uma thread só: sem isso o
    // Vitest abre uma por núcleo e o teste morre por falta de memória.
    pool: 'threads',
    minWorkers: 1,
    maxWorkers: 1,
  },
});
