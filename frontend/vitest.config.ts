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
    // Reaproveita o ambiente entre arquivos. Medido com 29
    // arquivos: 17 segundos assim, 84 isolando. Cada arquivo
    // abrindo o seu jsdom custa ~2,7s so de partida.
    //
    // O QUE ISSO CUSTA, e nao e so memoria: o cache de modulos
    // tambem e compartilhado. Quem carrega um modulo primeiro fixa,
    // para todos os arquivos, a versao que ficou no cache — com os
    // forjados DAQUELE arquivo dentro dela.
    //
    // Na pratica: dois arquivos de teste nao podem carregar a mesma
    // arvore de modulos e os dois forjarem pedacos dela. Igualar os
    // nomes forjados nao resolve, porque o que vale e a identidade
    // de cada `vi.fn()`. Um dos dois troca o componente de dentro
    // por um papel — ver o cabecalho de paginas/solicitacoes/
    // Lista.test.tsx, que foi onde isso apareceu: nove testes de
    // OUTRO arquivo falhando, intermitentes, conforme a ordem.
    //
    // Sintoma para reconhecer: "0 chamadas" num `vi.fn()` que a
    // tela visivelmente chamou, ou "Nao foi possivel falar com o
    // servidor" num teste que forjou tudo.
    isolate: false,
    minWorkers: 1,
    maxWorkers: 1,
  },
});
