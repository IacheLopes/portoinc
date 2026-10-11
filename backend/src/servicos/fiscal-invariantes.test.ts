// ============================================================
//  AS REGRAS DO DINHEIRO QUE NUNCA PODEM QUEBRAR
//
//  Testes de INVARIANTE: em vez de conferir um caso, varrem
//  centenas de combinações e exigem que uma regra valha em todas.
//
//  Nasceram da varredura do financeiro em 10/10/2026, pedida por
//  ele com estas palavras: "financeiro deve ser blindado, erro aí
//  pode custar caro para a AV2". A varredura achou três buracos por
//  onde dinheiro sumia, e o conserto de cada um está em outro
//  arquivo. ESTE aqui existe para eles não voltarem.
//
//  A diferença importa: consertar é uma pessoa. Não voltar é o
//  sistema recusando sozinho, inclusive depois que quem consertou
//  já não estiver por perto.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  gerarParcelas,
  conferirCondicaoDePagamento,
  conferirParcelasGeradas,
  aindaDevido,
} from './fiscal.js';
import { montarCaixa } from './caixa.js';
import { resumirCarteira, calcularIndicadores, montarFluxo } from './indicadores-financeiros.js';

const BASE = new Date('2026-10-10T12:00:00Z');
const dia = (n: number) => new Date(BASE.getTime() + n * 86400000);
const centavos = (n: number) => Math.round(n * 100) / 100;

//  Valores de obra de verdade, das bordas ao absurdo.
const VALORES = [0.01, 1, 100, 634.8, 1234.56, 5600, 9999.99, 15498, 25667.6, 1234567.89];
const ENTRADAS = [null, 0, 10, 30, 33.33, 50, 99, 100];
const PARCELAS = [null, 0, 1, 2, 3, 7, 12, 60];
const INTERVALOS = [null, 1, 15, 30, 45, 365];

describe('As parcelas de uma nota', () => {
  it('A SOMA É SEMPRE O VALOR DA NOTA, em toda condição completa', () => {
    //  O buraco que isto fecha: uma nota de R$ 10.000 com "30% de
    //  entrada" e nada mais gerava R$ 3.000 de conta a pagar. Os
    //  R$ 7.000 que a Porto Inc. devia não existiam em lugar
    //  nenhum — nem no painel, nem na previsão de caixa.
    let conferidas = 0;

    for (const valor of VALORES) {
      for (const percentualEntrada of ENTRADAS) {
        for (const quantidadeParcelas of PARCELAS) {
          for (const intervaloDias of INTERVALOS) {
            const condicao = { percentualEntrada, quantidadeParcelas, intervaloDias };

            //  Condição incompleta não chega a gerar parcela: é
            //  barrada nas três portas. Aqui só as completas.
            if (conferirCondicaoDePagamento(condicao) !== null) continue;

            const parcelas = gerarParcelas(valor, condicao, BASE);
            if (parcelas.length === 0) continue;

            conferidas += 1;
            const soma = centavos(parcelas.reduce((s, p) => s + p.valor, 0));

            assert.equal(
              soma, centavos(valor),
              'soma ' + soma + ' != nota ' + valor +
              ' | entrada ' + percentualEntrada + ' | ' + quantidadeParcelas +
              'x | a cada ' + intervaloDias,
            );
          }
        }
      }
    }

    assert.ok(conferidas > 500, 'o teste precisa cobrir muita combinação, cobriu ' + conferidas);
  });

  it('NENHUMA PARCELA SAI NEGATIVA OU ZERADA', () => {
    //  R$ 10,00 em 60x gerava uma parcela de R$ -0,18: a última
    //  absorvia o arredondamento e virava dívida negativa, que
    //  envenena todo relatório que a soma.
    for (const valor of VALORES) {
      for (const quantidadeParcelas of [1, 2, 3, 7, 12, 60]) {
        for (const percentualEntrada of [null, 50, 99]) {
          const condicao = { percentualEntrada, quantidadeParcelas, intervaloDias: 30 };
          if (conferirCondicaoDePagamento(condicao) !== null) continue;

          //  PARCELA QUE DARIA MENOS DE UM CENTAVO é caso
          //  degenerado: não existe divisão certa. Quem cuida
          //  disso é a rede de segurança, provada logo abaixo.
          //
          //  Repare que a conta é sobre o RESTO depois da entrada:
          //  R$ 1,00 com 99% adiantado deixa R$ 0,01 para dividir,
          //  e aí nem duas partes cabem.
          const resto = valor * (100 - (percentualEntrada ?? 0)) / 100;
          if (resto / quantidadeParcelas < 0.01) continue;

          for (const p of gerarParcelas(valor, condicao, BASE)) {
            assert.ok(
              p.valor > 0,
              'parcela ' + p.parcela + ' = ' + p.valor +
              ' | R$ ' + valor + ' em ' + quantidadeParcelas + 'x com entrada ' + percentualEntrada,
            );
          }
        }
      }
    }
  });

  it('nenhum vencimento cai antes da emissão da nota', () => {
    for (const valor of [1000, 25667.6]) {
      for (const quantidadeParcelas of [1, 3, 12]) {
        for (const percentualEntrada of [null, 30]) {
          const parcelas = gerarParcelas(
            valor, { percentualEntrada, quantidadeParcelas, intervaloDias: 30 }, BASE,
          );

          for (const p of parcelas) {
            assert.ok(p.vencimento.getTime() >= BASE.getTime(), 'parcela ' + p.parcela);
          }
        }
      }
    }
  });

  it('os vencimentos sobem, e o "X de Y" bate com a contagem', () => {
    for (const quantidadeParcelas of [1, 2, 3, 7, 12]) {
      for (const percentualEntrada of [null, 30]) {
        const parcelas = gerarParcelas(
          9999.99, { percentualEntrada, quantidadeParcelas, intervaloDias: 30 }, BASE,
        );

        for (const p of parcelas) assert.equal(p.totalParcelas, parcelas.length);

        for (let i = 1; i < parcelas.length; i += 1) {
          assert.ok(
            parcelas[i].vencimento.getTime() >= parcelas[i - 1].vencimento.getTime(),
            'parcela ' + parcelas[i].parcela + ' vence antes da anterior',
          );
        }
      }
    }
  });

  it('a conta de sempre não mudou: R$ 1.000 em 30% + 3x', () => {
    //  Prova de que a correção do arredondamento preservou o
    //  comportamento conhecido, em vez de trocar por outro.
    const p = gerarParcelas(1000, { percentualEntrada: 30, quantidadeParcelas: 3, intervaloDias: 30 }, BASE);

    assert.deepEqual(p.map((x) => x.valor), [300, 233.33, 233.33, 233.34]);
  });
});

describe('A condição de pagamento está completa?', () => {
  it('nada preenchido é à vista, e à vista é completo', () => {
    assert.equal(conferirCondicaoDePagamento({}), null);
    assert.equal(conferirCondicaoDePagamento({ percentualEntrada: 0, quantidadeParcelas: 0 }), null);
  });

  it('ENTRADA SEM PARCELAS É RECUSADA — era por onde sumia o resto', () => {
    const problema = conferirCondicaoDePagamento({ percentualEntrada: 30 });

    assert.ok(problema, 'tem de recusar');
    assert.match(problema!, /quantas vezes/);
  });

  it('PARCELAS SEM INTERVALO SÃO RECUSADAS — era por onde entravam 30 dias chutados', () => {
    const problema = conferirCondicaoDePagamento({ quantidadeParcelas: 3 });

    assert.ok(problema, 'tem de recusar');
    assert.match(problema!, /quantos em quantos dias/);
  });

  it('100% de entrada com parcelas continua recusado', () => {
    assert.ok(conferirCondicaoDePagamento({ percentualEntrada: 100, quantidadeParcelas: 2 }));
  });

  it('100% de entrada sozinho é à vista, e passa', () => {
    assert.equal(conferirCondicaoDePagamento({ percentualEntrada: 100 }), null);
  });

  it('condição completa passa', () => {
    assert.equal(
      conferirCondicaoDePagamento({ percentualEntrada: 30, quantidadeParcelas: 3, intervaloDias: 30 }),
      null,
    );
    assert.equal(conferirCondicaoDePagamento({ quantidadeParcelas: 1, intervaloDias: 28 }), null);
  });
});

describe('A rede de segurança antes de gravar a dívida', () => {
  it('recusa parcelas que não somam a nota', () => {
    const problema = conferirParcelasGeradas(
      [{ parcela: 1, totalParcelas: 1, valor: 3000, vencimento: BASE }],
      10000,
    );

    assert.ok(problema);
    assert.match(problema!, /somam/);
  });

  it('recusa parcela zerada ou negativa', () => {
    const problema = conferirParcelasGeradas(
      [
        { parcela: 1, totalParcelas: 2, valor: 10.18, vencimento: BASE },
        { parcela: 2, totalParcelas: 2, valor: -0.18, vencimento: BASE },
      ],
      10,
    );

    assert.ok(problema);
  });

  it('PEGA O CASO DEGENERADO: valor pequeno demais para tantas parcelas', () => {
    //  R$ 0,01 em duas partes não tem resposta certa — uma delas
    //  seria R$ 0,00, e conta a pagar zerada não é dívida.
    //  O gerador não precisa adivinhar; a rede recusa.
    const parcelas = gerarParcelas(0.01, { percentualEntrada: 50, quantidadeParcelas: 1, intervaloDias: 30 }, BASE);

    assert.ok(conferirParcelasGeradas(parcelas, 0.01), 'tem de recusar');
  });

  it('aprova o que fecha', () => {
    assert.equal(
      conferirParcelasGeradas(gerarParcelas(1000, { quantidadeParcelas: 3, intervaloDias: 30 }, BASE), 1000),
      null,
    );
  });
});

describe('Quanto ainda se deve', () => {
  it('parcela sem pagamento deve tudo', () => {
    assert.equal(aindaDevido({ valor: 634.8 }), 634.8);
    assert.equal(aindaDevido({ valor: 634.8, valorPago: null }), 634.8);
  });

  it('PAGAMENTO PARCIAL DEIXA O SALDO DEVENDO — o defeito que mais custava', () => {
    //  Medido no sistema em 10/10/2026: numa parcela de R$ 634,80
    //  paguei R$ 1,00 e os R$ 633,80 sumiram do painel, da carteira
    //  e da previsão de caixa, sem aviso nenhum.
    assert.equal(aindaDevido({ valor: 634.8, valorPago: 1 }), 633.8);
  });

  it('pagou mais que o devido não vira dívida negativa', () => {
    assert.equal(aindaDevido({ valor: 100, valorPago: 150 }), 0);
  });
});

describe('O caixa fecha', () => {
  it('O QUE FALTA MAIS O QUE SAIU É SEMPRE A DÍVIDA ORIGINAL', () => {
    //  A regra de ouro. Se ela quebrar, há dinheiro que o sistema
    //  esqueceu de cobrar ou de contar.
    for (const valor of [100, 634.8, 9999.99]) {
      //  Centavos de verdade: R$ 4.999,995 não existe em dinheiro,
      //  e testar com ele mede o arredondamento, não a regra.
      for (const pago of [null, 0.01, 1, centavos(valor / 2), valor]) {
        const emAberto = montarCaixa([], [{ valor, valorPago: pago, situacao: 'ABERTA', vencimento: dia(5) } as never]);
        const soma = centavos(emAberto.aPagar + emAberto.saiu);

        assert.equal(soma, centavos(valor), 'R$ ' + valor + ' com R$ ' + pago + ' pago');
      }
    }
  });

  it('a baixa parcial conta como dinheiro que SAIU', () => {
    //  Sem isto, consertar o "em aberto" abriria outro buraco: o
    //  dinheiro que saiu não apareceria em lugar nenhum.
    const c = montarCaixa([], [{ valor: 1000, valorPago: 300, situacao: 'ABERTA', vencimento: dia(5) } as never]);

    assert.equal(c.detalhe.comprasPagas, 300);
    assert.equal(c.detalhe.comprasEmAberto, 700);
  });

  it('saldo e previsto continuam batendo com as partes', () => {
    const c = montarCaixa(
      [
        { tipo: 'RECEITA', valor: 5000, previstoPara: dia(1), realizadoEm: dia(-1), situacao: 'REALIZADO', categoria: null, aberturaDeCaixa: false } as never,
        { tipo: 'DESPESA', valor: 900, previstoPara: dia(3), realizadoEm: null, situacao: 'PREVISTO', categoria: null, aberturaDeCaixa: false } as never,
        { tipo: 'DESPESA', valor: 400, previstoPara: dia(3), realizadoEm: null, situacao: 'CANCELADO', categoria: null, aberturaDeCaixa: false } as never,
      ],
      [{ valor: 1000, valorPago: 250, situacao: 'ABERTA', vencimento: dia(9) } as never],
    );

    assert.equal(c.saldo, centavos(c.entrou - c.saiu));
    assert.equal(c.previsto, centavos(c.saldo + c.aReceber - c.aPagar));
    assert.equal(c.aPagar, centavos(c.detalhe.comprasEmAberto + c.detalhe.despesasPrevistas));
  });
});

describe('A carteira e o fluxo enxergam o saldo', () => {
  const comParcial = [
    { valor: 1000, valorPago: 400, situacao: 'ABERTA', vencimento: dia(10), pagoEm: dia(-1), emitidaEm: dia(-30) } as never,
  ];

  it('"em aberto" mostra o que falta, não o valor cheio', () => {
    assert.equal(resumirCarteira(comParcial, BASE).emAberto.valor, 600);
  });

  it('o total comprometido também', () => {
    assert.equal(calcularIndicadores(comParcial, BASE).totalComprometido, 600);
  });

  it('e a projeção de caixa do mês também', () => {
    const mes = montarFluxo(comParcial, BASE).find((m) => m.chave === '2026-10');

    assert.ok(mes);
    assert.equal(mes!.aVencer, 600);
  });

  it('nenhum número do financeiro vira NaN com a carteira vazia', () => {
    const tudo = JSON.stringify({
      carteira: resumirCarteira([], BASE),
      indicadores: calcularIndicadores([], BASE),
      fluxo: montarFluxo([], BASE),
      caixa: montarCaixa([], []),
    });

    assert.ok(!tudo.includes('NaN'), tudo);
    assert.ok(!tudo.includes('Infinity'), tudo);
  });
});
