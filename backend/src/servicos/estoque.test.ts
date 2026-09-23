// ============================================================
//  Testes do estoque
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatarNumeroMovimento, soma, aplicarMovimento, conferirMovimento,
  precisaComprar, quantidadeSugerida, explicarAlerta, valorDoEstoque,
  type LinhaDeSaldo,
} from './estoque.js';

function linha(extra: Partial<LinhaDeSaldo> = {}): LinhaDeSaldo {
  return {
    materialId: '1',
    codigo: '00131',
    descricao: 'Cimento CP-II saco 50kg',
    unidadeMedida: 'SC',
    quantidade: 100,
    custoMedio: 30,
    pontoPedido: 20,
    ...extra,
  };
}

describe('Numeração e tipos', () => {
  it('formata o número do movimento', () => {
    assert.equal(formatarNumeroMovimento(1), 'MOV-00001');
    assert.equal(formatarNumeroMovimento(9999), 'MOV-09999');
  });

  it('sabe quais tipos somam no saldo', () => {
    assert.equal(soma('ENTRADA'), true);
    assert.equal(soma('TRANSFERENCIA_ENTRADA'), true);
    assert.equal(soma('SAIDA'), false);
    assert.equal(soma('TRANSFERENCIA_SAIDA'), false);
  });
});

describe('Saldo e custo médio', () => {
  it('primeira entrada define o custo', () => {
    const r = aplicarMovimento({ quantidade: 0, custoMedio: null }, 'ENTRADA', 100, 30);

    assert.equal(r.quantidade, 100);
    assert.equal(r.custoMedio, 30);
  });

  it('segunda entrada faz a média ponderada', () => {
    // 100 a R$ 30 + 100 a R$ 40 = 200 valendo R$ 35 cada.
    const r = aplicarMovimento({ quantidade: 100, custoMedio: 30 }, 'ENTRADA', 100, 40);

    assert.equal(r.quantidade, 200);
    assert.equal(r.custoMedio, 35);
  });

  it('a média respeita o peso de cada lote', () => {
    // 100 a R$ 30 + 300 a R$ 50 = 400 valendo R$ 45.
    const r = aplicarMovimento({ quantidade: 100, custoMedio: 30 }, 'ENTRADA', 300, 50);

    assert.equal(r.quantidade, 400);
    assert.equal(r.custoMedio, 45);
  });

  it('saída não mexe no custo do que ficou', () => {
    const r = aplicarMovimento({ quantidade: 200, custoMedio: 35 }, 'SAIDA', 50);

    assert.equal(r.quantidade, 150);
    assert.equal(r.custoMedio, 35);
  });

  it('estoque zerado perde a referência de custo', () => {
    const r = aplicarMovimento({ quantidade: 50, custoMedio: 35 }, 'SAIDA', 50);

    assert.equal(r.quantidade, 0);
    assert.equal(r.custoMedio, null);
  });

  it('entrada sem preço informado mantém o custo anterior', () => {
    const r = aplicarMovimento({ quantidade: 100, custoMedio: 30 }, 'TRANSFERENCIA_ENTRADA', 20);

    assert.equal(r.quantidade, 120);
    assert.equal(r.custoMedio, 30);
  });

  it('ajuste para menos usa quantidade negativa', () => {
    const r = aplicarMovimento({ quantidade: 40, custoMedio: 30 }, 'AJUSTE', -3);

    assert.equal(r.quantidade, 37);
    assert.equal(r.custoMedio, 30);
  });

  it('ajuste para mais soma', () => {
    const r = aplicarMovimento({ quantidade: 40, custoMedio: 30 }, 'AJUSTE', 2);

    assert.equal(r.quantidade, 42);
  });
});

describe('Conferência do movimento', () => {
  it('aceita uma retirada normal', () => {
    const p = conferirMovimento(
      { tipo: 'SAIDA', quantidade: 10, destino: 'Equipe da laje' },
      100,
      'Cimento',
    );

    assert.deepEqual(p, []);
  });

  it('não deixa tirar mais do que existe', () => {
    const p = conferirMovimento(
      { tipo: 'SAIDA', quantidade: 120, destino: 'Equipe da laje' },
      100,
      'Cimento',
    );

    assert.equal(p.length, 1);
    assert.match(p[0], /tem 100 e você pediu 120/);
  });

  it('retirada exige destino', () => {
    const p = conferirMovimento({ tipo: 'SAIDA', quantidade: 10 }, 100, 'Cimento');

    assert.equal(p.length, 1);
    assert.match(p[0], /para quem ou para qual frente/);
  });

  it('recusa quantidade zero ou negativa', () => {
    assert.match(
      conferirMovimento({ tipo: 'SAIDA', quantidade: 0, destino: 'Obra' }, 100, 'Cimento')[0],
      /maior que zero/,
    );
    assert.match(
      conferirMovimento({ tipo: 'ENTRADA', quantidade: -5 }, 100, 'Cimento')[0],
      /maior que zero/,
    );
  });

  it('entrada não é limitada pelo saldo', () => {
    const p = conferirMovimento({ tipo: 'ENTRADA', quantidade: 500 }, 10, 'Cimento');

    assert.deepEqual(p, []);
  });

  it('ajuste exige explicação', () => {
    const p = conferirMovimento({ tipo: 'AJUSTE', quantidade: -3 }, 40, 'Cimento');

    assert.equal(p.length, 1);
    assert.match(p[0], /Explique o que a contagem encontrou/);
  });

  it('ajuste que não muda nada é recusado', () => {
    const p = conferirMovimento(
      { tipo: 'AJUSTE', quantidade: 0, observacao: 'Contagem do mês' },
      40,
      'Cimento',
    );

    assert.match(p[0], /bateu com o saldo/);
  });

  it('ajuste não pode deixar o saldo negativo', () => {
    const p = conferirMovimento(
      { tipo: 'AJUSTE', quantidade: -50, observacao: 'Contagem do mês' },
      40,
      'Cimento',
    );

    assert.match(p[0], /saldo negativo/);
  });

  it('ajuste com motivo passa', () => {
    const p = conferirMovimento(
      { tipo: 'AJUSTE', quantidade: -3, observacao: 'Três sacos endurecidos, descartados.' },
      40,
      'Cimento',
    );

    assert.deepEqual(p, []);
  });
});

describe('Ponto de pedido', () => {
  it('avisa quando o saldo encosta no mínimo', () => {
    assert.equal(precisaComprar(linha({ quantidade: 20, pontoPedido: 20 })), true);
    assert.equal(precisaComprar(linha({ quantidade: 19, pontoPedido: 20 })), true);
    assert.equal(precisaComprar(linha({ quantidade: 21, pontoPedido: 20 })), false);
  });

  it('material sem ponto de pedido nunca alerta', () => {
    assert.equal(precisaComprar(linha({ quantidade: 0, pontoPedido: null })), false);
    assert.equal(precisaComprar(linha({ quantidade: 0, pontoPedido: 0 })), false);
  });

  it('sugere repor até o dobro do mínimo', () => {
    // Mínimo 20, restam 5: comprar 35 deixa o estoque em 40.
    assert.equal(quantidadeSugerida(linha({ quantidade: 5, pontoPedido: 20 })), 35);
  });

  it('nunca sugere menos que o próprio mínimo', () => {
    assert.equal(quantidadeSugerida(linha({ quantidade: 30, pontoPedido: 20 })), 20);
  });

  it('explica o alerta em uma frase', () => {
    assert.match(explicarAlerta(linha({ quantidade: 5, pontoPedido: 20 })), /Restam 5 SC/);
    assert.match(explicarAlerta(linha({ quantidade: 0, pontoPedido: 20 })), /Acabou/);
    assert.equal(explicarAlerta(linha({ quantidade: 100, pontoPedido: 20 })), '');
  });
});

describe('Valor do estoque', () => {
  it('soma quantidade vezes custo médio', () => {
    const total = valorDoEstoque([
      linha({ quantidade: 100, custoMedio: 30 }),
      linha({ materialId: '2', quantidade: 10, custoMedio: 5.5 }),
    ]);

    assert.equal(total, 3055);
  });

  it('item sem custo não quebra a conta', () => {
    assert.equal(valorDoEstoque([linha({ quantidade: 10, custoMedio: null })]), 0);
  });
});
