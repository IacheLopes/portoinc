// ============================================================
//  Testes dos indicadores do financeiro
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resumirCarteira, calcularIndicadores, montarFluxo, ranquearPor, fatiarCarteira,
  type ParcelaParaIndicador,
} from './indicadores-financeiros.js';

const HOJE = new Date('2026-09-22T12:00:00');

function dia(iso: string): Date {
  return new Date(iso + 'T12:00:00');
}

function parcela(extra: Partial<ParcelaParaIndicador> = {}): ParcelaParaIndicador {
  return {
    valor: 100,
    vencimento: dia('2026-10-22'),
    situacao: 'ABERTA',
    pagoEm: null,
    valorPago: null,
    emitidaEm: dia('2026-09-22'),
    fornecedor: 'Marquilip',
    obra: 'OB-001 — Residencial Porto Belo',
    ...extra,
  };
}

describe('Resumo da carteira', () => {
  const carteira = [
    parcela({ valor: 500, vencimento: dia('2026-09-10') }), // vencida
    parcela({ valor: 300, vencimento: dia('2026-09-25') }), // vence em 3 dias
    parcela({ valor: 200, vencimento: dia('2026-12-01') }), // longe
    parcela({ valor: 150, situacao: 'PAGA', pagoEm: dia('2026-09-05'), valorPago: 150 }),
    parcela({ valor: 999, situacao: 'CANCELADA' }),
  ];

  it('separa vencidas, próximos 7 dias e total em aberto', () => {
    const r = resumirCarteira(carteira, HOJE);

    assert.equal(r.vencidas.quantidade, 1);
    assert.equal(r.vencidas.valor, 500);
    assert.equal(r.proximos7Dias.quantidade, 1);
    assert.equal(r.proximos7Dias.valor, 300);
    assert.equal(r.emAberto.quantidade, 3);
    assert.equal(r.emAberto.valor, 1000);
  });

  it('o pago no mês usa o valor realmente pago', () => {
    const r = resumirCarteira(
      [parcela({ valor: 200, situacao: 'PAGA', pagoEm: dia('2026-09-05'), valorPago: 180 })],
      HOJE,
    );

    assert.equal(r.pagoNoMes.valor, 180, 'pagou com desconto: vale o que saiu do caixa');
  });

  it('pagamento de outro mês não entra no mês atual', () => {
    const r = resumirCarteira(
      [parcela({ situacao: 'PAGA', pagoEm: dia('2026-08-15'), valorPago: 100 })],
      HOJE,
    );

    assert.equal(r.pagoNoMes.quantidade, 0);
  });

  it('cancelada não conta em lugar nenhum', () => {
    const r = resumirCarteira([parcela({ valor: 999, situacao: 'CANCELADA' })], HOJE);

    assert.equal(r.emAberto.quantidade, 0);
    assert.equal(r.emAberto.valor, 0);
  });
});

describe('Indicadores de gestão', () => {
  it('prazo médio é da emissão até o vencimento', () => {
    const r = calcularIndicadores(
      [
        parcela({ emitidaEm: dia('2026-09-01'), vencimento: dia('2026-10-01') }), // 30
        parcela({ emitidaEm: dia('2026-09-01'), vencimento: dia('2026-11-30') }), // 90
      ],
      HOJE,
    );

    assert.equal(r.prazoMedioPagamento, 60);
  });

  it('pontualidade conta quem pagou até o vencimento', () => {
    const r = calcularIndicadores(
      [
        parcela({ situacao: 'PAGA', vencimento: dia('2026-09-10'), pagoEm: dia('2026-09-09') }),
        parcela({ situacao: 'PAGA', vencimento: dia('2026-09-10'), pagoEm: dia('2026-09-10') }),
        parcela({ situacao: 'PAGA', vencimento: dia('2026-09-10'), pagoEm: dia('2026-09-15') }),
        parcela({ situacao: 'PAGA', vencimento: dia('2026-09-10'), pagoEm: dia('2026-09-20') }),
      ],
      HOJE,
    );

    assert.equal(r.pontualidade, 50, 'pagar NO dia do vencimento conta como em dia');
  });

  it('sem pagamento nenhum, a pontualidade não pune', () => {
    assert.equal(calcularIndicadores([parcela()], HOJE).pontualidade, 100);
  });

  it('acha a maior parcela em aberto', () => {
    const r = calcularIndicadores(
      [parcela({ valor: 100 }), parcela({ valor: 750 }), parcela({ valor: 300 })],
      HOJE,
    );

    assert.equal(r.maiorParcelaAberta, 750);
    assert.equal(r.totalComprometido, 1150);
    assert.equal(r.ticketMedio, 383.33);
  });

  it('diz quantos dias faltam para o próximo vencimento', () => {
    const r = calcularIndicadores(
      [parcela({ vencimento: dia('2026-10-30') }), parcela({ vencimento: dia('2026-09-25') })],
      HOJE,
    );

    assert.equal(r.diasParaProximoVencimento, 3);
  });

  it('sem nada em aberto, não há próximo vencimento', () => {
    const r = calcularIndicadores(
      [parcela({ situacao: 'PAGA', pagoEm: dia('2026-09-01') })],
      HOJE,
    );

    assert.equal(r.diasParaProximoVencimento, null);
    assert.equal(r.maiorParcelaAberta, 0);
  });
});

describe('Fluxo de caixa por mês', () => {
  it('monta a janela de meses pedida', () => {
    const f = montarFluxo([], HOJE, 3, 8);

    assert.equal(f.length, 12);
    assert.equal(f[0].chave, '2026-06');
    assert.equal(f[3].chave, '2026-09', 'o mês de hoje fica na posição 4');
    assert.equal(f[11].chave, '2027-05');
    assert.equal(f[3].rotulo, 'set/26');
  });

  it('a parcela em aberto cai no mês do vencimento', () => {
    const f = montarFluxo([parcela({ valor: 400, vencimento: dia('2026-11-10') })], HOJE);
    const novembro = f.find((m) => m.chave === '2026-11');

    assert.equal(novembro?.aVencer, 400);
    assert.equal(novembro?.total, 400);
  });

  it('a vencida aparece separada da que só vai vencer', () => {
    const f = montarFluxo([parcela({ valor: 250, vencimento: dia('2026-09-01') })], HOJE);
    const setembro = f.find((m) => m.chave === '2026-09');

    assert.equal(setembro?.vencido, 250);
    assert.equal(setembro?.aVencer, 0);
  });

  it('a paga cai no mês em que o dinheiro SAIU', () => {
    const f = montarFluxo(
      [
        parcela({
          valor: 600,
          vencimento: dia('2026-09-30'),
          situacao: 'PAGA',
          pagoEm: dia('2026-08-20'),
          valorPago: 600,
        }),
      ],
      HOJE,
    );

    assert.equal(f.find((m) => m.chave === '2026-08')?.pago, 600);
    assert.equal(f.find((m) => m.chave === '2026-09')?.total, 0);
  });

  it('parcela fora da janela não quebra nada', () => {
    const f = montarFluxo([parcela({ vencimento: dia('2030-01-01') })], HOJE);

    assert.equal(f.reduce((s, m) => s + m.total, 0), 0);
  });

  // ----------------------------------------------------------
  //  O filtro de período
  // ----------------------------------------------------------

  it('a referência fica no MEIO da janela, não encostada à esquerda', () => {
    const f = montarFluxo([], HOJE);

    assert.equal(f.length, 12);
    assert.equal(f[5].chave, '2026-09', 'o mês de hoje é a 6ª de 12 colunas');
    assert.equal(f[0].chave, '2026-04');
    assert.equal(f[11].chave, '2027-03');
  });

  it('a referência move a janela sem mexer em hoje', () => {
    const f = montarFluxo([], HOJE, 3, 8, dia('2025-03-15'));

    assert.equal(f[0].chave, '2024-12');
    assert.equal(f[3].chave, '2025-03', 'a referência fica na posição 4');
    assert.equal(f[11].chave, '2025-11');
  });

  it('sem referência, a janela continua sendo a de hoje', () => {
    const comPadrao = montarFluxo([], HOJE, 3, 8);
    const explicita = montarFluxo([], HOJE, 3, 8, HOJE);

    assert.deepEqual(
      comPadrao.map((m) => m.chave),
      explicita.map((m) => m.chave),
    );
  });

  // Este é o teste que justifica separar os dois parâmetros.
  //
  // Olhando dezembro de 2025, uma parcela vencida em 2026 continua
  // VENCIDA — porque quem decide isso é hoje, não o mês que está
  // sendo olhado. Se os dois fossem o mesmo parâmetro, o passado
  // mostraria tudo como "a vencer" e o gráfico mentiria.
  it('mudar o período NÃO faz o vencido voltar a ser a vencer', () => {
    const atrasada = parcela({ valor: 300, vencimento: dia('2026-09-01') });

    const naJanelaDeHoje = montarFluxo([atrasada], HOJE, 3, 8);
    const olhandoOutroAno = montarFluxo([atrasada], HOJE, 3, 8, dia('2026-11-15'));

    assert.equal(naJanelaDeHoje.find((m) => m.chave === '2026-09')?.vencido, 300);
    assert.equal(olhandoOutroAno.find((m) => m.chave === '2026-09')?.vencido, 300);
    assert.equal(olhandoOutroAno.find((m) => m.chave === '2026-09')?.aVencer, 0);
  });
});

describe('Rankings', () => {
  const parcelas = [
    parcela({ fornecedor: 'Marquilip', valor: 1000 }),
    parcela({ fornecedor: 'Marquilip', valor: 500, situacao: 'PAGA', pagoEm: HOJE, valorPago: 500 }),
    parcela({ fornecedor: 'Constrular', valor: 300 }),
    parcela({ fornecedor: 'Cancelado', valor: 9999, situacao: 'CANCELADA' }),
  ];

  it('soma aberto e pago por fornecedor', () => {
    const r = ranquearPor(parcelas, 'fornecedor');

    assert.equal(r[0].nome, 'Marquilip');
    assert.equal(r[0].aberto, 1000);
    assert.equal(r[0].pago, 500);
    assert.equal(r[0].total, 1500);
  });

  it('vem ordenado do maior para o menor', () => {
    const r = ranquearPor(parcelas, 'fornecedor');

    assert.deepEqual(r.map((x) => x.nome), ['Marquilip', 'Constrular']);
  });

  it('cancelada fica de fora do ranking', () => {
    const r = ranquearPor(parcelas, 'fornecedor');

    assert.equal(r.some((x) => x.nome === 'Cancelado'), false);
  });

  it('parcela sem obra tem um lugar próprio', () => {
    const r = ranquearPor([parcela({ obra: null, valor: 200 })], 'obra');

    assert.equal(r[0].nome, 'Sem obra vinculada');
  });

  it('respeita o limite pedido', () => {
    const muitos = Array.from({ length: 12 }, (_, i) =>
      parcela({ fornecedor: 'F' + i, valor: i + 1 }),
    );

    assert.equal(ranquearPor(muitos, 'fornecedor', 5).length, 5);
  });
});

describe('Fatias da carteira', () => {
  it('divide em vencidas, 7 dias, depois e pagas', () => {
    const f = fatiarCarteira(
      [
        parcela({ valor: 250, vencimento: dia('2026-09-01') }),
        parcela({ valor: 250, vencimento: dia('2026-09-25') }),
        parcela({ valor: 250, vencimento: dia('2026-12-01') }),
        parcela({ valor: 250, situacao: 'PAGA', pagoEm: HOJE, valorPago: 250 }),
      ],
      HOJE,
    );

    assert.equal(f.length, 4);
    assert.deepEqual(f.map((x) => x.percentual), [25, 25, 25, 25]);
    assert.equal(f[0].tom, 'erro');
  });

  it('fatia vazia não aparece', () => {
    const f = fatiarCarteira([parcela({ valor: 100, vencimento: dia('2026-12-01') })], HOJE);

    assert.equal(f.length, 1);
    assert.equal(f[0].rotulo, 'A vencer depois');
    assert.equal(f[0].percentual, 100);
  });

  it('carteira vazia devolve lista vazia', () => {
    assert.deepEqual(fatiarCarteira([], HOJE), []);
  });
});
