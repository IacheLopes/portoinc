// ============================================================
//  A janela de números — os MESMOS casos do teste do backend.
//
//  A regra vive nos dois lados. Estes testes são a trava contra
//  eles divergirem em silêncio.
// ============================================================

import { describe, it, expect } from 'vitest';
import { janelaDePaginas } from './paginacao';

describe('A janela de números', () => {
  it('com poucas páginas, mostra todas', () => {
    expect(janelaDePaginas(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('no meio de muitas, abre buraco dos dois lados', () => {
    expect(janelaDePaginas(7, 250)).toEqual([1, null, 6, 7, 8, null, 250]);
  });

  it('a última SEMPRE aparece como número', () => {
    // Ver "250" conta o tamanho do conjunto. Uma seta de "ir ao
    // fim" não contaria nada.
    const j = janelaDePaginas(2, 250);
    expect(j[j.length - 1]).toBe(250);
  });

  it('no começo não abre buraco à esquerda', () => {
    expect(janelaDePaginas(1, 250)).toEqual([1, 2, null, 250]);
  });

  it('no fim não abre buraco à direita', () => {
    expect(janelaDePaginas(250, 250)).toEqual([1, null, 249, 250]);
  });

  it('página única não vira barra vazia', () => {
    expect(janelaDePaginas(1, 1)).toEqual([1]);
  });
});
