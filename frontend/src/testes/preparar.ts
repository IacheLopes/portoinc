// ============================================================
//  Preparação dos testes de tela
//
//  Roda uma vez antes de cada arquivo de teste.
// ============================================================
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Desmonta o que ficou na tela entre um teste e outro. Sem isso o
// segundo teste encontra DOIS botões "Salvar" — o dele e o que
// sobrou do anterior — e falha por um motivo que não é o dele.
afterEach(() => {
  cleanup();
});
