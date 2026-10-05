// ============================================================
//  Testes dos relatórios
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  diasEntre, compararOrcamento, resumirOrcamento,
  analisarCotacoes, resumirEconomia, analisarFornecedores,
  medirTempos, tempoTotal, consumoPorFamilia, materiaisMaisComprados,
  acharEstoqueParado,
  type LinhaDeOrcamento, type CotacaoParaAnalise,
  type FornecedorParaAnalise, type EntregaDoFornecedor,
  type PassagemDaSolicitacao, type ItemComprado,
  type MaterialNaPrateleira,
} from './relatorios.js';

function dia(iso: string): Date {
  return new Date(iso + 'T12:00:00');
}

describe('Dias entre datas', () => {
  it('conta ignorando a hora', () => {
    assert.equal(
      diasEntre(new Date('2026-09-01T23:00:00'), new Date('2026-09-05T01:00:00')),
      4,
    );
  });

  it('mesmo dia é zero', () => {
    assert.equal(diasEntre(dia('2026-09-01'), dia('2026-09-01')), 0);
  });
});

describe('Orçado x realizado', () => {
  function linha(extra: Partial<LinhaDeOrcamento> = {}): LinhaDeOrcamento {
    return {
      codigo: '03.01',
      descricao: 'Estrutura de concreto',
      unidade: 'M3',
      quantidadePrevista: 100,
      valorUnitarioPrevisto: 500,
      realizado: 0,
      ...extra,
    };
  }

  it('calcula previsto, saldo e consumo', () => {
    const [l] = compararOrcamento([linha({ realizado: 20000 })]);

    assert.equal(l.previsto, 50000);
    assert.equal(l.saldo, 30000);
    assert.equal(l.consumido, 40);
    assert.equal(l.situacao, 'FOLGADO');
  });

  it('avisa ANTES de estourar, em 80%', () => {
    assert.equal(compararOrcamento([linha({ realizado: 39000 })])[0].situacao, 'FOLGADO');
    assert.equal(compararOrcamento([linha({ realizado: 40000 })])[0].situacao, 'ATENCAO');
    assert.equal(compararOrcamento([linha({ realizado: 49999 })])[0].situacao, 'ATENCAO');
  });

  it('o alerta segue o percentual QUE APARECE na tela', () => {
    // 39.999 de 50.000 é 79,998%, que a tela mostra como 80,0%.
    // Chamar isso de "folgado" seria contradizer o próprio número.
    const [l] = compararOrcamento([linha({ realizado: 39999 })]);

    assert.equal(l.consumido, 80);
    assert.equal(l.situacao, 'ATENCAO');
  });

  it('marca quem passou do previsto', () => {
    const [l] = compararOrcamento([linha({ realizado: 55000 })]);

    assert.equal(l.situacao, 'ESTOUROU');
    assert.equal(l.saldo, -5000);
    assert.equal(l.consumido, 110);
  });

  it('linha sem previsão fica separada', () => {
    const [l] = compararOrcamento([
      linha({ quantidadePrevista: 0, valorUnitarioPrevisto: 0, realizado: 300 }),
    ]);

    assert.equal(l.situacao, 'SEM_PREVISAO');
    assert.equal(l.consumido, 0, 'dividir por zero não pode virar infinito');
  });

  it('o resumo soma tudo e conta os alertas', () => {
    const r = resumirOrcamento(
      compararOrcamento([
        linha({ realizado: 55000 }),
        linha({ realizado: 45000 }),
        linha({ realizado: 1000 }),
      ]),
    );

    assert.equal(r.previsto, 150000);
    assert.equal(r.realizado, 101000);
    assert.equal(r.saldo, 49000);
    assert.equal(r.linhasEstouradas, 1);
    assert.equal(r.linhasEmAtencao, 1);
  });
});

describe('Economia nas cotações', () => {
  function cotacao(extra: Partial<CotacaoParaAnalise> = {}): CotacaoParaAnalise {
    return {
      numeroFormatado: 'BID-00001',
      titulo: 'Material elétrico',
      encerradaEm: dia('2026-09-10'),
      fornecedoresConvidados: 4,
      fornecedoresResponderam: 3,
      estimado: 10000,
      fechado: 8500,
      maiorProposta: 11000,
      ...extra,
    };
  }

  it('mede a economia sobre o estimado', () => {
    const [c] = analisarCotacoes([cotacao()]);

    assert.equal(c.economia, 1500);
    assert.equal(c.economiaPercentual, 15);
  });

  it('mede o ganho da disputa entre fornecedores', () => {
    const [c] = analisarCotacoes([cotacao()]);

    // A pior proposta era 11.000; fechamos por 8.500.
    assert.equal(c.ganhoNaDisputa, 2500);
  });

  it('a taxa de resposta sai dos convidados', () => {
    assert.equal(analisarCotacoes([cotacao()])[0].taxaDeResposta, 75);
  });

  it('fechar acima do estimado dá economia negativa', () => {
    const [c] = analisarCotacoes([cotacao({ fechado: 12000 })]);

    assert.equal(c.economia, -2000);
    assert.ok(c.economiaPercentual < 0);
  });

  it('cotação sem estimativa não quebra a conta', () => {
    const [c] = analisarCotacoes([cotacao({ estimado: 0, fechado: 500 })]);

    assert.equal(c.economiaPercentual, 0);
  });

  it('o resumo junta todas as cotações', () => {
    const r = resumirEconomia(
      analisarCotacoes([
        cotacao({ estimado: 10000, fechado: 8000 }),
        cotacao({ estimado: 20000, fechado: 19000 }),
      ]),
    );

    assert.equal(r.cotacoes, 2);
    assert.equal(r.estimado, 30000);
    assert.equal(r.economia, 3000);
    assert.equal(r.economiaPercentual, 10);
  });
});

describe('Desempenho do fornecedor', () => {
  /**
   * Um dia fixo, para os testes não mudarem de resultado conforme a
   * hora em que rodam.
   */
  const HOJE = new Date('2026-10-05T12:00:00.000Z');

  /** Dias antes de HOJE. */
  function diasAtras(dias: number): Date {
    return new Date(HOJE.getTime() - dias * 86400000);
  }

  /**
   * Uma entrega.
   *
   * O `quando` é obrigatório na interface — sem ele o relatório
   * volta a não ter noção de tempo —, mas a maioria destes testes
   * não fala de data. Então o padrão é "hoje", e quem precisa de
   * data diz qual.
   */
  function entrega(
    e: Omit<EntregaDoFornecedor, 'quando'> & { quando?: Date },
  ): EntregaDoFornecedor {
    return { quando: HOJE, ...e };
  }

  function fornecedor(extra: Partial<FornecedorParaAnalise> = {}): FornecedorParaAnalise {
    return {
      nome: 'Marquilip',
      convites: 4,
      respostas: 4,
      pedidos: 3,
      valorComprado: 30000,
      entregas: [],
      ...extra,
    };
  }

  it('mede pontualidade pelo prazo prometido', () => {
    const [f] = analisarFornecedores([
      fornecedor({
        entregas: [
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false }),
          entrega({ prazoPrometido: 7, prazoReal: 7, comRessalva: false, devolvido: false }),
          entrega({ prazoPrometido: 7, prazoReal: 12, comRessalva: false, devolvido: false }),
        ],
      }),
    ]);

    assert.equal(f.noPrazo, 2, 'entregar NO dia prometido conta como no prazo');
    assert.equal(f.pontualidade, 66.7);
    assert.equal(f.atrasoMedio, 5);
  });

  it('mede qualidade por ressalva e devolução', () => {
    const [f] = analisarFornecedores([
      fornecedor({
        entregas: [
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false }),
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: true, devolvido: false }),
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: true }),
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false }),
        ],
      }),
    ]);

    assert.equal(f.ressalvas, 1);
    assert.equal(f.devolucoes, 1);
    assert.equal(f.qualidade, 50);
  });

  it('entrega sem prazo prometido não entra na pontualidade', () => {
    const [f] = analisarFornecedores([
      fornecedor({
        entregas: [
          entrega({ prazoPrometido: null, prazoReal: 30, comRessalva: false, devolvido: false }),
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false }),
        ],
      }),
    ]);

    assert.equal(f.pontualidade, 100, 'só a entrega com prazo combinado conta');
  });

  // ----------------------------------------------------------
  //  A noção de tempo
  //
  //  Este era o único dos seis relatórios sem data nenhuma: dizia
  //  "64% no prazo" e quem lia não tinha como saber se aquilo era
  //  de agosto ou de três anos atrás.
  //
  //  A decisão da casa foi MANTER a memória longa — histórico que
  //  apaga não protege de fornecedor ruim nem deixa ver quem
  //  melhorou. O que entrou foi o contexto: quando foi a última, e
  //  um aviso na frase quando a opinião ficou velha.
  // ----------------------------------------------------------
  it('diz quando foi a primeira e a última entrega', () => {
    const [f] = analisarFornecedores([
      fornecedor({
        entregas: [
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(400) }),
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(10) }),
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(200) }),
        ],
      }),
    ], HOJE);

    assert.deepEqual(f.ultimaEntrega, diasAtras(10), 'a última é a mais recente, não a última da lista');
    assert.deepEqual(f.primeiraEntrega, diasAtras(400));
  });

  it('sem entrega nenhuma, as duas datas são nulas', () => {
    const [f] = analisarFornecedores([fornecedor({ entregas: [] })], HOJE);

    assert.equal(f.ultimaEntrega, null);
    assert.equal(f.primeiraEntrega, null);
  });

  it('a frase avisa quando a opinião ficou velha', () => {
    const entregasBoas = [
      entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(500) }),
      entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(520) }),
      entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(540) }),
    ];

    const [sumido] = analisarFornecedores([fornecedor({ entregas: entregasBoas })], HOJE);

    // O elogio continua — o histórico dele é bom mesmo. O que a
    // frase acrescenta é que ele parou de aparecer.
    assert.match(sumido.leitura, /Cumpre prazo e entrega certo/);
    assert.match(sumido.leitura, /não entrega há/);
  });

  it('quem entregou mês passado não leva o aviso', () => {
    const [ativo] = analisarFornecedores([
      fornecedor({
        entregas: [
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(30) }),
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(60) }),
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(90) }),
        ],
      }),
    ], HOJE);

    assert.equal(ativo.leitura, 'Cumpre prazo e entrega certo.');
  });

  it('onze meses ainda não é velho; treze é', () => {
    // A fronteira é 12 meses — o mesmo período que os outros três
    // relatórios usam por padrão, e não um número novo inventado
    // para esta frase.
    const comUltimaEm = (dias: number) => analisarFornecedores([
      fornecedor({
        entregas: [
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(dias) }),
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(dias + 20) }),
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(dias + 40) }),
        ],
      }),
    ], HOJE)[0].leitura;

    assert.doesNotMatch(comUltimaEm(330), /não entrega há/, '11 meses: ainda é relação viva');
    assert.match(comUltimaEm(400), /não entrega há/, '13 meses: a opinião está velha');
  });

  it('acima de dois anos a frase fala em anos, não em meses', () => {
    const [f] = analisarFornecedores([
      fornecedor({
        entregas: [
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(900) }),
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(920) }),
          entrega({ prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false, quando: diasAtras(940) }),
        ],
      }),
    ], HOJE);

    // "não entrega há 30 meses" é uma conta que o leitor precisa
    // fazer; "há mais de 2 anos" ele entende de imediato.
    assert.match(f.leitura, /há mais de 2 anos/);
  });

  it('a leitura aponta o problema mais grave primeiro', () => {
    const ruim = analisarFornecedores([
      fornecedor({
        entregas: [
          entrega({ prazoPrometido: 7, prazoReal: 30, comRessalva: true, devolvido: true }),
          entrega({ prazoPrometido: 7, prazoReal: 30, comRessalva: true, devolvido: false }),
          entrega({ prazoPrometido: 7, prazoReal: 30, comRessalva: true, devolvido: false }),
        ],
      }),
    ])[0];

    assert.match(ruim.leitura, /chega com problema/);

    const atrasado = analisarFornecedores([
      fornecedor({
        entregas: [
          entrega({ prazoPrometido: 7, prazoReal: 30, comRessalva: false, devolvido: false }),
          entrega({ prazoPrometido: 7, prazoReal: 30, comRessalva: false, devolvido: false }),
          entrega({ prazoPrometido: 7, prazoReal: 30, comRessalva: false, devolvido: false }),
        ],
      }),
    ])[0];

    assert.match(atrasado.leitura, /Atrasa/);
  });

  it('elogia quem cumpre tudo', () => {
    const boa = entrega({ prazoPrometido: 7, prazoReal: 6, comRessalva: false, devolvido: false });
    const [f] = analisarFornecedores([fornecedor({ entregas: [boa, boa, boa] })]);

    assert.match(f.leitura, /Cumpre prazo e entrega certo/);
  });

  it('não dá veredito com uma ou duas entregas', () => {
    const ruim = entrega({ prazoPrometido: 7, prazoReal: 40, comRessalva: true, devolvido: true });
    const boa = entrega({ prazoPrometido: 7, prazoReal: 6, comRessalva: false, devolvido: false });

    // Uma ressalva isolada não é "com frequência"...
    const uma = analisarFornecedores([fornecedor({ entregas: [ruim] })])[0];
    assert.match(uma.leitura, /Só 1 entrega até agora/);

    // ...e um acerto isolado não é um elogio merecido.
    const duas = analisarFornecedores([fornecedor({ entregas: [boa, boa] })])[0];
    assert.match(duas.leitura, /Só 2 entregas até agora/);

    // Os números continuam aparecendo: o que muda é a conclusão.
    assert.equal(uma.qualidade, 0);
    assert.equal(duas.pontualidade, 100);
  });

  it('quem nunca entregou não é julgado', () => {
    const [f] = analisarFornecedores([fornecedor({ entregas: [], convites: 2 })]);

    assert.match(f.leitura, /ainda não entregou/);
    assert.equal(f.pontualidade, 100, 'sem entrega, não há como punir');
  });

  it('vem ordenado por quanto a empresa comprou', () => {
    const lista = analisarFornecedores([
      fornecedor({ nome: 'Pequeno', valorComprado: 100 }),
      fornecedor({ nome: 'Grande', valorComprado: 90000 }),
    ]);

    assert.deepEqual(lista.map((f) => f.nome), ['Grande', 'Pequeno']);
  });
});

describe('Tempo do processo', () => {
  function passagem(extra: Partial<PassagemDaSolicitacao> = {}): PassagemDaSolicitacao {
    return {
      numeroFormatado: 'SOL-00001',
      obra: 'OB-001',
      criadaEm: dia('2026-09-01'),
      enviadaEm: dia('2026-09-02'),
      aprovadaEm: dia('2026-09-04'),
      cotadaEm: dia('2026-09-11'),
      pedidoEm: dia('2026-09-12'),
      recebidoEm: dia('2026-09-22'),
      ...extra,
    };
  }

  it('mede cada trecho do caminho', () => {
    const etapas = medirTempos([passagem()]);

    assert.equal(etapas.length, 5);
    assert.equal(etapas[0].dias, 1); // montar
    assert.equal(etapas[1].dias, 2); // aprovação
    assert.equal(etapas[2].dias, 7); // cotação
    assert.equal(etapas[3].dias, 1); // decisão
    assert.equal(etapas[4].dias, 10); // entrega
  });

  it('quem ainda não passou pela etapa não entra na média', () => {
    const etapas = medirTempos([
      passagem(),
      passagem({ cotadaEm: null, pedidoEm: null, recebidoEm: null }),
    ]);

    assert.equal(etapas[1].amostra, 2, 'as duas foram aprovadas');
    assert.equal(etapas[4].amostra, 1, 'só uma foi recebida');
  });

  it('mede o caminho inteiro e aponta o gargalo', () => {
    const t = tempoTotal([passagem()]);

    assert.equal(t.dias, 21);
    assert.equal(t.amostra, 1);
    assert.equal(t.maisDemorada, 'Entrega');
  });

  it('sem nada recebido, o total é zero e não quebra', () => {
    const t = tempoTotal([passagem({ recebidoEm: null })]);

    assert.equal(t.dias, 0);
    assert.equal(t.amostra, 0);
  });

  it('não inventa gargalo quando nada demorou', () => {
    // Tudo aconteceu no mesmo dia: não há etapa travando nada.
    const mesmoDia = dia('2026-09-01');
    const t = tempoTotal([
      passagem({
        criadaEm: mesmoDia, enviadaEm: mesmoDia, aprovadaEm: mesmoDia,
        cotadaEm: mesmoDia, pedidoEm: mesmoDia, recebidoEm: mesmoDia,
      }),
    ]);

    assert.equal(t.dias, 0);
    assert.equal(t.maisDemorada, null, 'apontar uma etapa mandaria alguém arrumar o que não quebrou');
  });

  it('data fora de ordem é descartada em vez de virar negativo', () => {
    const etapas = medirTempos([
      passagem({ criadaEm: dia('2026-09-10'), enviadaEm: dia('2026-09-01') }),
    ]);

    assert.equal(etapas[0].amostra, 0);
  });
});

describe('Consumo por família e material', () => {
  function item(extra: Partial<ItemComprado> = {}): ItemComprado {
    return {
      codigo: '00131',
      descricao: 'Cimento CP-II',
      familia: 'CIM — Cimento e argamassas',
      unidadeMedida: 'SC',
      quantidade: 100,
      valor: 3000,
      ...extra,
    };
  }

  it('agrupa por família com participação', () => {
    const linhas = consumoPorFamilia([
      item({ valor: 7500 }),
      item({ codigo: '00046', familia: 'ACO — Aço', valor: 2500 }),
    ]);

    assert.equal(linhas[0].nome, 'CIM — Cimento e argamassas');
    assert.equal(linhas[0].participacao, 75);
    assert.equal(linhas[1].participacao, 25);
  });

  it('conta quantos materiais diferentes tem cada família', () => {
    const linhas = consumoPorFamilia([
      item({ codigo: 'A' }),
      item({ codigo: 'B' }),
      item({ codigo: 'A' }),
    ]);

    assert.equal(linhas[0].itens, 2);
  });

  it('soma o mesmo material comprado várias vezes', () => {
    const lista = materiaisMaisComprados([
      item({ quantidade: 100, valor: 3000 }),
      item({ quantidade: 50, valor: 1600 }),
    ]);

    assert.equal(lista.length, 1);
    assert.equal(lista[0].quantidade, 150);
    assert.equal(lista[0].valor, 4600);
  });

  it('calcula o preço médio pago', () => {
    const lista = materiaisMaisComprados([
      item({ quantidade: 100, valor: 3000 }),
      item({ quantidade: 100, valor: 3400 }),
    ]);

    assert.equal(lista[0].precoMedio, 32);
  });

  it('respeita o limite e ordena pelo maior valor', () => {
    const muitos = Array.from({ length: 20 }, (_, i) =>
      item({ codigo: 'M' + i, valor: i * 100 }),
    );

    const lista = materiaisMaisComprados(muitos, 5);

    assert.equal(lista.length, 5);
    assert.equal(lista[0].codigo, 'M19');
  });

  it('lista vazia devolve lista vazia', () => {
    assert.deepEqual(consumoPorFamilia([]), []);
    assert.deepEqual(materiaisMaisComprados([]), []);
  });
});

// ============================================================
//  Estoque parado
// ============================================================

const HOJE = new Date('2026-09-28T12:00:00Z');

function naPrateleira(r: Partial<MaterialNaPrateleira> = {}): MaterialNaPrateleira {
  return {
    codigo: 'MAT-001',
    descricao: 'Cimento CP-II 50kg',
    familia: 'Cimentos',
    unidadeMedida: 'SC',
    almoxarifado: 'Central',
    quantidade: 100,
    custoMedio: 30,
    ultimaSaida: null,
    primeiraEntrada: new Date('2026-01-01T12:00:00Z'),
    ...r,
  };
}

describe('Estoque parado', () => {
  it('acusa o que não sai há mais tempo que o corte', () => {
    const { linhas, resumo } = acharEstoqueParado(
      [naPrateleira({ ultimaSaida: new Date('2026-05-01T12:00:00Z') })],
      90,
      HOJE,
    );

    assert.equal(linhas.length, 1);
    assert.equal(linhas[0].diasParado, 150);
    assert.equal(linhas[0].motivo, 'PAROU');
    // 100 sacos × R$ 30 de custo médio.
    assert.equal(linhas[0].valorParado, 3000);
    assert.equal(resumo.valorParado, 3000);
  });

  it('deixa em paz o que saiu faz pouco', () => {
    const { linhas, resumo } = acharEstoqueParado(
      [naPrateleira({ ultimaSaida: new Date('2026-09-01T12:00:00Z') })],
      90,
      HOJE,
    );

    assert.equal(linhas.length, 0);
    assert.equal(resumo.valorParado, 0);
    assert.match(resumo.leitura, /girando/);
  });

  it('conta da ENTRADA quando o material nunca saiu', () => {
    // O caso que mais dói: comprou e nunca usou. Contar da última
    // saída não funcionaria — não existe saída nenhuma.
    const { linhas, resumo } = acharEstoqueParado([naPrateleira()], 90, HOJE);

    assert.equal(linhas.length, 1);
    assert.equal(linhas[0].motivo, 'NUNCA_SAIU');
    assert.equal(linhas[0].diasParado, 270);
    assert.equal(resumo.nuncaSairam, 1);
    assert.match(resumo.leitura, /nunca saiu/);
  });

  it('material que entrou ontem e nunca saiu ainda NÃO é parado', () => {
    // O corte vale para os dois casos. Sem isto, toda compra
    // recente entraria no relatório no dia seguinte.
    const { linhas } = acharEstoqueParado(
      [naPrateleira({ primeiraEntrada: new Date('2026-09-27T12:00:00Z') })],
      90,
      HOJE,
    );

    assert.equal(linhas.length, 0);
  });

  it('prateleira vazia não é dinheiro parado', () => {
    const { linhas } = acharEstoqueParado([naPrateleira({ quantidade: 0 })], 90, HOJE);

    assert.equal(linhas.length, 0);
  });

  it('sem data nenhuma, prefere calar a acusar', () => {
    const { linhas } = acharEstoqueParado(
      [naPrateleira({ ultimaSaida: null, primeiraEntrada: null })],
      90,
      HOJE,
    );

    assert.equal(linhas.length, 0);
  });

  it('sem custo médio, conta o material mas não inventa valor', () => {
    const { linhas, resumo } = acharEstoqueParado(
      [naPrateleira({ custoMedio: null })],
      90,
      HOJE,
    );

    assert.equal(linhas.length, 1);
    assert.equal(linhas[0].valorParado, 0);
    assert.equal(resumo.itens, 1);
  });

  it('ordena pelo dinheiro, não pelo tempo', () => {
    // Quem lê quer saber onde está o dinheiro. Um parafuso parado
    // há dois anos importa menos que uma carga de aço parada há
    // quatro meses.
    const { linhas, resumo } = acharEstoqueParado(
      [
        naPrateleira({
          codigo: 'MAT-PARAFUSO', quantidade: 10, custoMedio: 1,
          primeiraEntrada: new Date('2024-09-01T12:00:00Z'),
        }),
        naPrateleira({
          codigo: 'MAT-ACO', quantidade: 100, custoMedio: 500,
          ultimaSaida: new Date('2026-05-01T12:00:00Z'),
        }),
      ],
      90,
      HOJE,
    );

    assert.equal(linhas[0].codigo, 'MAT-ACO');
    assert.equal(linhas[1].codigo, 'MAT-PARAFUSO');
    assert.equal(resumo.valorParado, 50010);
    assert.equal(resumo.maisAntigo, 757);
  });

  it('o corte é escolha de quem lê', () => {
    const saiuEm = new Date('2026-08-01T12:00:00Z');

    assert.equal(acharEstoqueParado([naPrateleira({ ultimaSaida: saiuEm })], 30, HOJE).linhas.length, 1);
    assert.equal(acharEstoqueParado([naPrateleira({ ultimaSaida: saiuEm })], 90, HOJE).linhas.length, 0);
  });

  it('estoque limpo devolve resumo zerado', () => {
    const { linhas, resumo } = acharEstoqueParado([], 90, HOJE);

    assert.deepEqual(linhas, []);
    assert.equal(resumo.itens, 0);
    assert.equal(resumo.valorParado, 0);
    assert.equal(resumo.maisAntigo, 0);
  });
});
