// ============================================================
//  Toda sigla tem de ter nome
//
//  A lista de unidades mostrava só "SC", "FD", "GL", "VB". Quem é da
//  construção lê de olhos fechados; quem está aprendendo o sistema
//  fica adivinhando — e errar a unidade de um material estraga a
//  conta de todo pedido que vier depois dele.
//
//  O risco agora é outro: alguém acrescentar uma sigla nova em
//  UNIDADES e esquecer o nome. A lista volta a mostrar "PLT" pelado
//  no meio de "SC — Saco", e ninguém percebe porque nada quebra.
//
//  É esse esquecimento que este teste pega.
// ============================================================

import { describe, it, expect } from 'vitest';
import { UNIDADES, NOME_DA_UNIDADE, opcoesDeUnidade } from './cadastros';

describe('Unidades de medida', () => {
  it('toda sigla do catálogo tem nome por extenso', () => {
    const semNome = UNIDADES.filter((u) => !NOME_DA_UNIDADE[u]);

    expect(semNome, 'siglas sem nome em NOME_DA_UNIDADE').toEqual([]);
  });

  it('a lista suspensa mostra sigla e nome', () => {
    const opcoes = opcoesDeUnidade();
    const saco = opcoes.find((o) => o.valor === 'SC');

    expect(saco?.rotulo).toBe('SC — Saco');
  });

  it('o que o sistema guarda continua sendo a sigla', () => {
    // O nome é só para escolher. Na tabela, no pedido e na nota a
    // coluna é estreita e quem manda é a sigla.
    for (const opcao of opcoesDeUnidade()) {
      expect(UNIDADES).toContain(opcao.valor);
    }
  });

  it('a Locação traz a própria lista, com SEMANA', () => {
    const opcoes = opcoesDeUnidade(['DIA', 'SEMANA', 'MES']);

    expect(opcoes.map((o) => o.rotulo)).toEqual([
      'DIA — Dia',
      'SEMANA — Semana',
      'MES — Mês',
    ]);
  });

  it('sigla desconhecida aparece sozinha, sem quebrar a tela', () => {
    expect(opcoesDeUnidade(['XYZ'])[0]).toEqual({ valor: 'XYZ', rotulo: 'XYZ' });
  });
});
