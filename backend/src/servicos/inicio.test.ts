// ============================================================
//  Testes da tela inicial
//
//  O erro caro aqui é silencioso: mostrar para alguém um número
//  que ela não pode resolver, ou pintar de vermelho um zero. Os
//  dois ensinam a pessoa a ignorar a tela.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  montarInicio, permissoesDoInicio, CONTAGENS_ZERADAS,
  type ContagensDoInicio,
} from './inicio.js';

function contagens(extra: Partial<ContagensDoInicio> = {}): ContagensDoInicio {
  return { ...CONTAGENS_ZERADAS, ...extra };
}

const TUDO = permissoesDoInicio();

function chaves(cartoes: Array<{ chave: string }>): string[] {
  return cartoes.map((c) => c.chave);
}

describe('permissão decide o que existe', () => {
  it('sem a permissão, o cartão nem aparece', () => {
    const r = montarInicio(contagens({ contasVencidas: 3 }), ['estoque.ver']);

    assert.equal(
      [...r.urgentes, ...r.acompanhar].some((c) => c.chave === 'contasVencidas'),
      false,
      'contar uma vencida para quem não abre o financeiro é dar notícia que a pessoa não pode resolver',
    );
  });

  it('quem só recebe material vê o dele, e nada do financeiro', () => {
    const r = montarInicio(contagens({ contasVencidas: 9 }), ['recebimento.registrar']);

    assert.deepEqual(chaves(r.acompanhar), ['pedidosAguardandoEntrega']);
    assert.deepEqual(r.urgentes, []);
  });

  it('quem pode tudo vê todos os cartões', () => {
    const r = montarInicio(contagens(), TUDO);
    assert.equal(r.urgentes.length + r.acompanhar.length, 9);
  });
});

describe('urgente é o que tem peso E tem número', () => {
  it('zero nunca sobe para urgente, mesmo em cartão de erro', () => {
    const r = montarInicio(contagens({ contasVencidas: 0 }), TUDO);

    assert.deepEqual(r.urgentes, [], 'zero em vermelho ensina a ignorar vermelho');
    assert.ok(chaves(r.acompanhar).includes('contasVencidas'));
  });

  it('prazo perdido é erro', () => {
    const r = montarInicio(contagens({ contasVencidas: 2, locacoesAtrasadas: 1 }), TUDO);

    assert.deepEqual(chaves(r.urgentes), ['contasVencidas', 'locacoesAtrasadas']);
    assert.deepEqual(r.urgentes.map((c) => c.tom), ['erro', 'erro']);
  });

  it('o que vence se ninguém agir é atenção', () => {
    const r = montarInicio(contagens({ aprovacoesEsperando: 4 }), TUDO);

    assert.equal(r.urgentes.length, 1);
    assert.equal(r.urgentes[0].tom, 'atencao');
  });

  it('cartão de acompanhamento não vira urgente nem com número alto', () => {
    // 50 cotações abertas é vida normal de comprador, não emergência.
    const r = montarInicio(contagens({ cotacoesAbertas: 50 }), TUDO);

    assert.deepEqual(r.urgentes, []);
    assert.ok(chaves(r.acompanhar).includes('cotacoesAbertas'));
  });
});

describe('o que está escrito no cartão', () => {
  it('no singular não sai "1 parcela(s)"', () => {
    const r = montarInicio(contagens({ contasVencidas: 1 }), TUDO);
    assert.equal(r.urgentes[0].detalhe, '1 parcela passou do vencimento');
  });

  it('no plural concorda', () => {
    const r = montarInicio(contagens({ contasVencidas: 5 }), TUDO);
    assert.equal(r.urgentes[0].detalhe, '5 parcelas passaram do vencimento');
  });

  it('no zero diz que está em dia, em vez de "0"', () => {
    const r = montarInicio(contagens(), TUDO);
    const conta = r.acompanhar.find((c) => c.chave === 'contasVencidas');

    assert.equal(conta?.detalhe, 'Nenhuma parcela passou do vencimento');
  });

  it('todo cartão leva a algum lugar', () => {
    const r = montarInicio(contagens(), TUDO);

    for (const c of [...r.urgentes, ...r.acompanhar]) {
      assert.match(c.para, /^\//, c.chave + ' precisa de um destino: cartão que não leva a lugar nenhum é enfeite');
    }
  });
});

describe('a ordem segue o dia', () => {
  it('o que já atrasou vem antes do que vai vencer', () => {
    const r = montarInicio(
      contagens({ contasVencidas: 1, aprovacoesEsperando: 1, contasVencendoEm7Dias: 1 }),
      TUDO,
    );

    assert.deepEqual(
      chaves(r.urgentes),
      ['contasVencidas', 'aprovacoesEsperando', 'contasVencendoEm7Dias'],
    );
  });
});
