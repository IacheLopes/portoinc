// ============================================================
//  Testes do recebimento
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatarNumeroRecebimento, lerNumeroPedido, calcularSaldos, acharItemPorCodigo,
  conferirRecebimento, situacaoDoPedido, saldosDepoisDe, resumirConferencia,
  type ItemDoPedido, type LinhaConferida,
} from './recebimento.js';

function item(
  id: string,
  pedida: number,
  jaRecebida = 0,
  extra: Partial<ItemDoPedido> = {},
): ItemDoPedido {
  return {
    pedidoItemId: id,
    codigo: '000' + id,
    gtin: '789' + id.padStart(10, '0'),
    descricao: 'Item ' + id,
    unidadeMedida: 'UN',
    quantidadePedida: pedida,
    quantidadeJaRecebida: jaRecebida,
    ...extra,
  };
}

function linha(id: string, recebida: number, extra: Partial<LinhaConferida> = {}): LinhaConferida {
  return {
    pedidoItemId: id,
    quantidadeRecebida: recebida,
    quantidadeDevolvida: 0,
    situacao: 'CONFORME',
    ...extra,
  };
}

describe('Numeração', () => {
  it('formata com cinco dígitos', () => {
    assert.equal(formatarNumeroRecebimento(1), 'REC-00001');
    assert.equal(formatarNumeroRecebimento(42), 'REC-00042');
    assert.equal(formatarNumeroRecebimento(12345), 'REC-12345');
  });

  it('entende o número do pedido em qualquer formato', () => {
    assert.equal(lerNumeroPedido('PC-00001'), 1);
    assert.equal(lerNumeroPedido('pc1'), 1);
    assert.equal(lerNumeroPedido('  42 '), 42);
    assert.equal(lerNumeroPedido('00042'), 42);
    assert.equal(lerNumeroPedido('PC 7'), 7);
  });

  it('recusa o que não é número de pedido', () => {
    assert.equal(lerNumeroPedido(''), null);
    assert.equal(lerNumeroPedido('abc'), null);
    assert.equal(lerNumeroPedido('PC-'), null);
    assert.equal(lerNumeroPedido('0'), null);
    assert.equal(lerNumeroPedido('12a'), null);
  });
});

describe('Saldos', () => {
  it('saldo é o que falta entregar', () => {
    const [a, b] = calcularSaldos([item('1', 100, 40), item('2', 10)]);

    assert.equal(a.saldo, 60);
    assert.equal(a.concluido, false);
    assert.equal(b.saldo, 10);
  });

  it('item completo fica marcado como concluído', () => {
    const [a] = calcularSaldos([item('1', 50, 50)]);

    assert.equal(a.saldo, 0);
    assert.equal(a.concluido, true);
  });

  it('nunca devolve saldo negativo', () => {
    const [a] = calcularSaldos([item('1', 10, 15)]);

    assert.equal(a.saldo, 0);
    assert.equal(a.concluido, true);
  });
});

describe('Achar item pelo código', () => {
  const saldos = calcularSaldos([
    item('1', 10, 0, { codigo: '00131', gtin: '7891234567890' }),
    item('2', 20, 0, { codigo: '00046', gtin: null }),
  ]);

  it('acha pelo código de barras', () => {
    assert.equal(acharItemPorCodigo(saldos, '7891234567890')?.pedidoItemId, '1');
  });

  it('acha pelo código interno', () => {
    assert.equal(acharItemPorCodigo(saldos, '00046')?.pedidoItemId, '2');
  });

  it('ignora zeros à esquerda', () => {
    assert.equal(acharItemPorCodigo(saldos, '46')?.pedidoItemId, '2');
  });

  it('devolve nulo quando não existe', () => {
    assert.equal(acharItemPorCodigo(saldos, '99999'), null);
    assert.equal(acharItemPorCodigo(saldos, ''), null);
  });
});

describe('Conferência', () => {
  const saldos = calcularSaldos([item('1', 100, 40), item('2', 10)]);

  it('aceita uma conferência simples', () => {
    assert.deepEqual(conferirRecebimento([linha('1', 60), linha('2', 10)], saldos), []);
  });

  it('aceita entrega parcial', () => {
    assert.deepEqual(conferirRecebimento([linha('1', 20)], saldos), []);
  });

  it('recusa quando nada foi informado', () => {
    const p = conferirRecebimento([linha('1', 0), linha('2', 0)], saldos);

    assert.equal(p.length, 1);
    assert.match(p[0], /pelo menos um item/);
  });

  it('recusa quantidade acima do saldo', () => {
    const p = conferirRecebimento([linha('1', 61)], saldos);

    assert.equal(p.length, 1);
    assert.match(p[0], /saldo é de 60/);
  });

  it('a soma de recebido e devolvido também respeita o saldo', () => {
    const p = conferirRecebimento(
      [linha('1', 55, { quantidadeDevolvida: 10, situacao: 'COM_RESSALVA', motivo: 'sacos rasgados' })],
      saldos,
    );

    assert.equal(p.length, 1);
    assert.match(p[0], /saldo é de 60/);
  });

  it('recusa quantidade negativa', () => {
    const p = conferirRecebimento([linha('1', -5)], saldos);

    assert.match(p[0], /negativa/);
  });

  it('recusa item que não é do pedido', () => {
    const p = conferirRecebimento([linha('999', 5)], saldos);

    assert.match(p[0], /não pertence a este pedido/);
  });

  it('ressalva exige motivo', () => {
    const p = conferirRecebimento([linha('1', 10, { situacao: 'COM_RESSALVA' })], saldos);

    assert.equal(p.length, 1);
    assert.match(p[0], /motivo da ressalva/);
  });

  it('devolução exige motivo', () => {
    const p = conferirRecebimento(
      [linha('1', 0, { quantidadeDevolvida: 10, situacao: 'DEVOLVIDO' })],
      saldos,
    );

    assert.equal(p.length, 1);
    assert.match(p[0], /motivo da devolução/);
  });

  it('devolução sem quantidade devolvida não faz sentido', () => {
    const p = conferirRecebimento(
      [linha('1', 10, { situacao: 'DEVOLVIDO', motivo: 'fora da norma' })],
      saldos,
    );

    assert.equal(p.length, 1);
    assert.match(p[0], /sem quantidade devolvida/);
  });

  it('conforme com devolução obriga a marcar ressalva', () => {
    const p = conferirRecebimento([linha('1', 10, { quantidadeDevolvida: 2 })], saldos);

    assert.equal(p.length, 1);
    assert.match(p[0], /com ressalva/);
  });

  it('não deixa receber duas vezes o mesmo item', () => {
    const completos = calcularSaldos([item('1', 10, 10)]);
    const p = conferirRecebimento([linha('1', 1)], completos);

    assert.equal(p.length, 1);
    assert.match(p[0], /já foi recebido por inteiro/);
  });

  it('ressalva com motivo passa', () => {
    const p = conferirRecebimento(
      [linha('1', 58, { quantidadeDevolvida: 2, situacao: 'COM_RESSALVA', motivo: 'dois sacos rasgados' })],
      saldos,
    );

    assert.deepEqual(p, []);
  });
});

describe('Situação do pedido depois da entrega', () => {
  const saldos = calcularSaldos([item('1', 100, 40), item('2', 10)]);

  it('sobrou saldo, fica parcial', () => {
    const depois = saldosDepoisDe(saldos, [linha('1', 10)]);

    assert.deepEqual(depois, [50, 10]);
    assert.equal(situacaoDoPedido(depois), 'RECEBIDO_PARCIAL');
  });

  it('nada sobrou, fica recebido', () => {
    const depois = saldosDepoisDe(saldos, [linha('1', 60), linha('2', 10)]);

    assert.deepEqual(depois, [0, 0]);
    assert.equal(situacaoDoPedido(depois), 'RECEBIDO');
  });

  it('material devolvido NÃO baixa o saldo', () => {
    // Chegaram 10, três estavam quebrados e voltaram no caminhão.
    // O fornecedor continua devendo esses três.
    const so = calcularSaldos([item('1', 10)]);
    const depois = saldosDepoisDe(so, [
      linha('1', 7, { quantidadeDevolvida: 3, situacao: 'COM_RESSALVA', motivo: 'quebrados' }),
    ]);

    assert.deepEqual(depois, [3]);
    assert.equal(situacaoDoPedido(depois), 'RECEBIDO_PARCIAL');
  });
});

describe('Resumo para o almoxarife', () => {
  const saldos = calcularSaldos([item('1', 10), item('2', 5)]);

  it('conta o que foi conferido e o que falta', () => {
    const linhas = [
      linha('1', 10),
      linha('2', 3, { quantidadeDevolvida: 2, situacao: 'COM_RESSALVA', motivo: 'molhados' }),
    ];
    const texto = resumirConferencia(linhas, saldosDepoisDe(saldos, linhas));

    assert.match(texto, /1 item conforme/);
    assert.match(texto, /1 com ressalva/);
    assert.match(texto, /falta chegar 1 item/);
  });

  it('avisa quando o pedido fechou', () => {
    const linhas = [linha('1', 10), linha('2', 5)];
    const texto = resumirConferencia(linhas, saldosDepoisDe(saldos, linhas));

    assert.match(texto, /recebido por inteiro/);
  });

  it('não conta linha vazia', () => {
    const linhas = [linha('1', 10), linha('2', 0)];
    const texto = resumirConferencia(linhas, saldosDepoisDe(saldos, linhas));

    assert.match(texto, /1 item conforme/);
    assert.doesNotMatch(texto, /2 itens/);
  });
});
