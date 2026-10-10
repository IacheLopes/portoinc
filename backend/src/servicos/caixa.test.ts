// ============================================================
//  Testes do caixa
//
//  A conta que não existia: quanto entrou, quanto saiu, quanto
//  sobrou — somando as duas origens de saída.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  montarCaixa, acrescentarLancamentosAoFluxo, formatarNumeroLancamento,
  agruparPorCategoria, calendarioDoCaixa,
  type LancamentoParaCaixa, type ContaParaCaixa, type ContaFutura,
} from './caixa.js';
import { montarFluxo, type ParcelaDoFluxo } from './indicadores-financeiros.js';

const HOJE = new Date('2026-10-08T12:00:00');

function dia(iso: string): Date {
  return new Date(iso + 'T12:00:00');
}

function lancamento(extra: Partial<LancamentoParaCaixa> = {}): LancamentoParaCaixa {
  return {
    tipo: 'RECEITA',
    valor: 1000,
    previstoPara: dia('2026-10-08'),
    realizadoEm: null,
    situacao: 'PREVISTO',
    ...extra,
  };
}

function conta(extra: Partial<ContaParaCaixa> = {}): ContaParaCaixa {
  return { valor: 100, valorPago: null, situacao: 'ABERTA', ...extra };
}

describe('O número do lançamento', () => {
  it('tem prefixo próprio, para não ser confundido com conta a pagar', () => {
    assert.equal(formatarNumeroLancamento(1), 'LC-00001');
    assert.equal(formatarNumeroLancamento(347), 'LC-00347');
  });

  it('não corta quando passa de cinco dígitos', () => {
    assert.equal(formatarNumeroLancamento(123456), 'LC-123456');
  });
});

describe('O saldo', () => {
  it('é a receita que caiu menos tudo que saiu, das duas origens', () => {
    const caixa = montarCaixa(
      [
        lancamento({ valor: 50000, situacao: 'REALIZADO', realizadoEm: dia('2026-10-01') }),
        lancamento({ tipo: 'DESPESA', valor: 800, situacao: 'REALIZADO', realizadoEm: dia('2026-10-02') }),
      ],
      [conta({ valor: 1200, valorPago: 1200, situacao: 'PAGA' })],
    );

    assert.equal(caixa.entrou, 50000);
    assert.equal(caixa.saiu, 2000, 'compra paga (1200) + despesa avulsa feita (800)');
    assert.equal(caixa.saldo, 48000);
  });

  it('separa de onde veio cada metade da saída', () => {
    const caixa = montarCaixa(
      [
        lancamento({ tipo: 'DESPESA', valor: 800, situacao: 'REALIZADO', realizadoEm: dia('2026-10-02') }),
        lancamento({ tipo: 'DESPESA', valor: 300 }),
      ],
      [
        conta({ valor: 1200, valorPago: 1200, situacao: 'PAGA' }),
        conta({ valor: 500 }),
      ],
    );

    assert.equal(caixa.detalhe.comprasPagas, 1200);
    assert.equal(caixa.detalhe.despesasFeitas, 800);
    assert.equal(caixa.detalhe.comprasEmAberto, 500);
    assert.equal(caixa.detalhe.despesasPrevistas, 300);
  });

  it('usa o valor que SAIU na parcela paga, não o combinado', () => {
    // A Porto Inc. negocia desconto na hora de pagar. O caixa tem
    // de refletir o dinheiro real, senão o saldo fica mais pobre
    // do que a conta do banco.
    const caixa = montarCaixa([], [conta({ valor: 1000, valorPago: 900, situacao: 'PAGA' })]);

    assert.equal(caixa.saiu, 900);
  });

  it('não conta lançamento cancelado de lado nenhum', () => {
    const caixa = montarCaixa(
      [
        lancamento({ valor: 99999, situacao: 'CANCELADO', realizadoEm: dia('2026-10-01') }),
        lancamento({ tipo: 'DESPESA', valor: 77777, situacao: 'CANCELADO' }),
      ],
      [conta({ valor: 55555, situacao: 'CANCELADA' })],
    );

    assert.equal(caixa.entrou, 0);
    assert.equal(caixa.saiu, 0);
    assert.equal(caixa.aReceber, 0);
    assert.equal(caixa.aPagar, 0);
    assert.equal(caixa.saldo, 0);
    assert.equal(caixa.previsto, 0);
  });

  it('fica negativo quando sai mais do que entra, sem disfarçar', () => {
    const caixa = montarCaixa(
      [lancamento({ valor: 1000, situacao: 'REALIZADO', realizadoEm: dia('2026-10-01') })],
      [conta({ valor: 4000, valorPago: 4000, situacao: 'PAGA' })],
    );

    assert.equal(caixa.saldo, -3000);
  });

  it('projeta o fim do mês somando o que falta receber e pagar', () => {
    const caixa = montarCaixa(
      [
        lancamento({ valor: 10000, situacao: 'REALIZADO', realizadoEm: dia('2026-10-01') }),
        lancamento({ valor: 5000 }),
        lancamento({ tipo: 'DESPESA', valor: 1000 }),
      ],
      [conta({ valor: 2000 })],
    );

    assert.equal(caixa.saldo, 10000);
    assert.equal(caixa.aReceber, 5000);
    assert.equal(caixa.aPagar, 3000, 'compra em aberto (2000) + despesa prevista (1000)');
    assert.equal(caixa.previsto, 12000);
  });

  it('não arrasta centavo de ponto flutuante', () => {
    const caixa = montarCaixa(
      [
        lancamento({ valor: 0.1, situacao: 'REALIZADO', realizadoEm: dia('2026-10-01') }),
        lancamento({ valor: 0.2, situacao: 'REALIZADO', realizadoEm: dia('2026-10-01') }),
      ],
      [],
    );

    assert.equal(caixa.entrou, 0.3);
  });
});

describe('O fluxo com entrada', () => {
  const parcelas: ParcelaDoFluxo[] = [
    { valor: 1200, vencimento: dia('2026-10-20'), situacao: 'ABERTA', pagoEm: null, valorPago: null },
  ];

  function fluxo(lancamentos: LancamentoParaCaixa[]) {
    return acrescentarLancamentosAoFluxo(montarFluxo(parcelas, HOJE), lancamentos, HOJE);
  }

  function mes(linhas: ReturnType<typeof fluxo>, chave: string) {
    const achado = linhas.find((m) => m.chave === chave);
    assert.ok(achado, 'o mês ' + chave + ' deveria estar na janela');
    return achado;
  }

  it('põe a receita recebida no mês em que o dinheiro caiu', () => {
    const linhas = fluxo([
      lancamento({ valor: 50000, situacao: 'REALIZADO', realizadoEm: dia('2026-09-15'), previstoPara: dia('2026-08-01') }),
    ]);

    assert.equal(mes(linhas, '2026-09').entrada, 50000, 'conta em setembro, quando caiu');
    assert.equal(mes(linhas, '2026-08').entrada, 0, 'não em agosto, quando era prevista');
  });

  it('põe a receita prevista no mês prometido, em barra separada', () => {
    const linhas = fluxo([lancamento({ valor: 30000, previstoPara: dia('2026-12-05') })]);

    assert.equal(mes(linhas, '2026-12').aReceber, 30000);
    assert.equal(mes(linhas, '2026-12').entrada, 0);
  });

  it('soma a despesa avulsa nas mesmas barras da parcela', () => {
    // Do ponto de vista do caixa, combustível pago em outubro e
    // parcela paga em outubro são a mesma coisa: dinheiro que saiu.
    const linhas = fluxo([
      lancamento({ tipo: 'DESPESA', valor: 800, situacao: 'REALIZADO', realizadoEm: dia('2026-10-02') }),
      lancamento({ tipo: 'DESPESA', valor: 400, previstoPara: dia('2026-10-25') }),
      lancamento({ tipo: 'DESPESA', valor: 150, previstoPara: dia('2026-09-30') }),
    ]);

    assert.equal(mes(linhas, '2026-10').pago, 800);
    assert.equal(mes(linhas, '2026-10').aVencer, 1200 + 400, 'a parcela e a despesa futura juntas');
    assert.equal(mes(linhas, '2026-09').vencido, 150, 'despesa prevista e já passada');
  });

  it('mantém o total como escala só da SAÍDA', () => {
    // Somando a entrada no total, um mês de muita receita teria a
    // barra alta sem que nada tivesse saído.
    const linhas = fluxo([
      lancamento({ valor: 900000, situacao: 'REALIZADO', realizadoEm: dia('2026-10-03') }),
    ]);

    const outubro = mes(linhas, '2026-10');
    assert.equal(outubro.entrada, 900000);
    assert.equal(outubro.total, 1200, 'só a parcela em aberto');
  });

  it('ignora o lançamento fora da janela de doze meses', () => {
    const linhas = fluxo([
      lancamento({ valor: 1, situacao: 'REALIZADO', realizadoEm: dia('2020-01-10') }),
    ]);

    assert.equal(linhas.reduce((s, m) => s + m.entrada, 0), 0);
  });

  it('não conta cancelado', () => {
    const linhas = fluxo([
      lancamento({ valor: 1000, situacao: 'CANCELADO', realizadoEm: dia('2026-10-01') }),
    ]);

    assert.equal(mes(linhas, '2026-10').entrada, 0);
  });

  it('devolve os mesmos doze meses que o fluxo recebeu', () => {
    const base = montarFluxo(parcelas, HOJE);
    const linhas = acrescentarLancamentosAoFluxo(base, [], HOJE);

    assert.equal(linhas.length, base.length);
    assert.deepEqual(linhas.map((m) => m.chave), base.map((m) => m.chave));
  });
});

// ------------------------------------------------------------
//  De onde vem, para onde vai
// ------------------------------------------------------------
describe('As categorias', () => {
  function gasto(
    categoria: string | null,
    valor: number,
    situacao: LancamentoParaCaixa['situacao'] = 'REALIZADO',
  ) {
    return lancamento({
      tipo: 'DESPESA',
      valor,
      categoria,
      situacao,
      realizadoEm: situacao === 'REALIZADO' ? dia('2026-10-01') : null,
    });
  }

  it('soma por categoria, da maior para a menor', () => {
    const fatias = agruparPorCategoria(
      [gasto('Frota', 3000), gasto('Taxas', 500), gasto('Frota', 1000)],
      'DESPESA',
    );

    assert.deepEqual(
      fatias.map((f) => [f.nome, f.valor]),
      [['Frota', 4000], ['Taxas', 500]],
    );
  });

  it('o percentual fecha em cima do total', () => {
    const fatias = agruparPorCategoria([gasto('Frota', 750), gasto('Taxas', 250)], 'DESPESA');

    assert.equal(fatias[0].percentual, 75);
    assert.equal(fatias[1].percentual, 25);
  });

  it('SÓ conta o que já aconteceu', () => {
    // Misturar o previsto faria a rosca dizer "a empresa gasta 90%
    // com aluguel" por causa de um aluguel que ainda nem foi pago.
    const fatias = agruparPorCategoria(
      [gasto('Frota', 100), gasto('Aluguel', 9000, 'PREVISTO')],
      'DESPESA',
    );

    assert.deepEqual(fatias.map((f) => f.nome), ['Frota']);
  });

  it('não mistura entrada com saída', () => {
    const entradas = agruparPorCategoria(
      [
        gasto('Frota', 3000),
        lancamento({
          valor: 50000,
          categoria: 'Medição',
          situacao: 'REALIZADO',
          realizadoEm: dia('2026-10-01'),
        }),
      ],
      'RECEITA',
    );

    assert.deepEqual(entradas.map((f) => f.nome), ['Medição']);
  });

  it('o que não tem categoria vira "Sem categoria", e não some', () => {
    const fatias = agruparPorCategoria([gasto(null, 100), gasto('  ', 50)], 'DESPESA');

    assert.deepEqual(fatias.map((f) => [f.nome, f.valor]), [['Sem categoria', 150]]);
  });

  it('a cauda vira uma fatia só, e o total continua fechando', () => {
    const muitas = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((c, i) => gasto(c, 100 - i));
    const fatias = agruparPorCategoria(muitas, 'DESPESA');

    assert.equal(fatias.length, 7, 'seis categorias mais a cauda');
    assert.equal(fatias[6].nome, 'Outras 2');
    assert.equal(fatias[6].valor, 94 + 93);
    assert.equal(
      fatias.reduce((s, f) => s + f.valor, 0),
      muitas.reduce((s, g) => s + g.valor, 0),
    );
  });

  it('sem nada realizado, devolve lista vazia em vez de zero', () => {
    assert.deepEqual(agruparPorCategoria([], 'DESPESA'), []);
  });
});

// ------------------------------------------------------------
//  O que vem pela frente
// ------------------------------------------------------------
describe('O calendário do caixa', () => {
  // 08/10/2026 é uma quinta. A semana da obra começa na segunda,
  // então a primeira faixa vai de 05/10 a 11/10.
  const QUINTA = new Date('2026-10-08T12:00:00');

  function conta(
    valor: number,
    vencimento: string,
    situacao: ContaFutura['situacao'] = 'ABERTA',
  ): ContaFutura {
    return { valor, valorPago: null, situacao, vencimento: dia(vencimento) };
  }

  it('abre a janela na segunda-feira da semana de hoje', () => {
    const semanas = calendarioDoCaixa(0, [], [], QUINTA, 3);

    assert.equal(semanas.length, 3);
    assert.equal(semanas[0].chave, '2026-10-05');
    assert.equal(semanas[0].rotulo, '5 a 11/out');
    assert.equal(semanas[1].chave, '2026-10-12');
  });

  it('escreve os dois meses quando a semana vira o mês', () => {
    const semanas = calendarioDoCaixa(0, [], [], new Date('2026-09-30T12:00:00'), 1);

    assert.equal(semanas[0].rotulo, '28/set a 4/out');
  });

  it('põe cada previsto na semana em que ele cai', () => {
    const semanas = calendarioDoCaixa(
      0,
      [
        lancamento({ valor: 96500, previstoPara: dia('2026-10-26') }),
        lancamento({ tipo: 'DESPESA', valor: 1500, previstoPara: dia('2026-10-15') }),
      ],
      [],
      QUINTA,
      6,
    );

    assert.equal(semanas[1].sai, 1500, '15/10 cai na segunda faixa');
    assert.equal(semanas[3].entra, 96500, '26/10 cai na quarta');
  });

  it('o saldo caminha, semana a semana', () => {
    const semanas = calendarioDoCaixa(
      10000,
      [
        lancamento({ tipo: 'DESPESA', valor: 4000, previstoPara: dia('2026-10-06') }),
        lancamento({ valor: 30000, previstoPara: dia('2026-10-14') }),
      ],
      [],
      QUINTA,
      3,
    );

    assert.equal(semanas[0].saldoProjetado, 6000);
    assert.equal(semanas[1].saldoProjetado, 36000);
    assert.equal(semanas[2].saldoProjetado, 36000, 'semana sem movimento mantém o saldo');
  });

  it('mostra o furo: o saldo fica negativo no meio e volta', () => {
    // É a razão de o gráfico existir. O cartão "se tudo acontecer"
    // diria +4.000 e esconderia que falta dinheiro no dia 6.
    const semanas = calendarioDoCaixa(
      1000,
      [
        lancamento({ tipo: 'DESPESA', valor: 5000, previstoPara: dia('2026-10-06') }),
        lancamento({ valor: 8000, previstoPara: dia('2026-10-20') }),
      ],
      [],
      QUINTA,
      3,
    );

    assert.equal(semanas[0].saldoProjetado, -4000, 'o furo aparece');
    assert.equal(semanas[2].saldoProjetado, 4000, 'e se fecha depois');
  });

  it('O QUE JÁ VENCEU cai na primeira semana', () => {
    // Deixar de fora faria o caixa parecer mais folgado do que é: a
    // parcela atrasada continua tendo de ser paga.
    const semanas = calendarioDoCaixa(0, [], [conta(2000, '2026-09-10')], QUINTA, 3);

    assert.equal(semanas[0].sai, 2000);
  });

  it('soma as parcelas de compra junto com as despesas avulsas', () => {
    const semanas = calendarioDoCaixa(
      0,
      [lancamento({ tipo: 'DESPESA', valor: 300, previstoPara: dia('2026-10-07') })],
      [conta(700, '2026-10-09')],
      QUINTA,
      2,
    );

    assert.equal(semanas[0].sai, 1000, 'as duas origens de saída na mesma barra');
  });

  it('ignora o que já foi pago e o que foi cancelado', () => {
    const semanas = calendarioDoCaixa(
      0,
      [
        lancamento({
          tipo: 'DESPESA',
          valor: 900,
          previstoPara: dia('2026-10-07'),
          situacao: 'REALIZADO',
          realizadoEm: dia('2026-10-07'),
        }),
        lancamento({
          tipo: 'DESPESA',
          valor: 800,
          previstoPara: dia('2026-10-07'),
          situacao: 'CANCELADO',
        }),
      ],
      [conta(700, '2026-10-09', 'PAGA'), conta(600, '2026-10-09', 'CANCELADA')],
      QUINTA,
      2,
    );

    assert.equal(semanas[0].sai, 0);
  });

  it('o que cai depois da janela fica de fora', () => {
    // É por isso que o último saldo daqui NÃO bate com o cartão "se
    // tudo acontecer", que soma tudo. A tela diz quantas semanas
    // está mostrando.
    const semanas = calendarioDoCaixa(
      0,
      [lancamento({ valor: 50000, previstoPara: dia('2027-03-01') })],
      [],
      QUINTA,
      3,
    );

    assert.equal(semanas.reduce((s, x) => s + x.entra, 0), 0);
  });
});

// ============================================================
//  O DINHEIRO QUE A EMPRESA JÁ TINHA
//
//  Ela não nasce dentro do sistema: chega com caixa no dia em
//  que sai da planilha. Esse dinheiro É uma entrada — soma no
//  saldo, no gráfico, no calendário — e NÃO é faturamento.
//
//  Medido com R$ 2.000.000 na simulação de entrega de
//  09/10/2026, onde o cartão anunciava receita que ninguém
//  faturou e a rosca marcava "Saldo inicial — 100%".
// ============================================================
describe('Abertura de caixa', () => {
  const entrada = (valor: number, abertura = false): LancamentoParaCaixa => ({
    tipo: 'RECEITA',
    valor,
    previstoPara: new Date('2026-10-01'),
    realizadoEm: new Date('2026-10-01'),
    situacao: 'REALIZADO',
    aberturaDeCaixa: abertura,
  });

  it('o saldo de abertura SOMA no saldo, como qualquer entrada', () => {
    const c = montarCaixa([entrada(2_000_000, true)], []);

    assert.equal(c.entrou, 2_000_000, 'é dinheiro que entrou');
    assert.equal(c.saldo, 2_000_000, 'e está no caixa');
  });

  it('mas NÃO conta como faturamento', () => {
    const c = montarCaixa([entrada(2_000_000, true)], []);

    assert.equal(c.aberturaDeCaixa, 2_000_000);
    assert.equal(c.faturou, 0, 'a empresa não faturou o que ela já tinha');
  });

  it('separa o que ela trouxe do que ela ganhou aqui', () => {
    const c = montarCaixa(
      [entrada(2_000_000, true), entrada(480_000), entrada(260_000)],
      [],
    );

    assert.equal(c.entrou, 2_740_000, 'tudo que caiu');
    assert.equal(c.aberturaDeCaixa, 2_000_000, 'o que ela já tinha');
    assert.equal(c.faturou, 740_000, 'o que ela faturou aqui');
    assert.equal(c.saldo, 2_740_000, 'o saldo não muda: é dinheiro igual');
  });

  it('empresa que nasceu aqui dentro tem abertura zero', () => {
    const c = montarCaixa([entrada(480_000)], []);

    assert.equal(c.aberturaDeCaixa, 0);
    assert.equal(c.faturou, c.entrou, 'sem abertura, faturado é tudo');
  });

  it('abertura prevista não entra em nada: dinheiro que não caiu não é caixa', () => {
    const c = montarCaixa(
      [{ ...entrada(2_000_000, true), situacao: 'PREVISTO', realizadoEm: null }],
      [],
    );

    assert.equal(c.entrou, 0);
    assert.equal(c.aberturaDeCaixa, 0);
    assert.equal(c.aReceber, 2_000_000);
  });

  it('abertura cancelada some das duas contas', () => {
    const c = montarCaixa(
      [{ ...entrada(2_000_000, true), situacao: 'CANCELADO' }],
      [],
    );

    assert.equal(c.entrou, 0);
    assert.equal(c.aberturaDeCaixa, 0);
    assert.equal(c.faturou, 0);
  });
});
