// ============================================================
//  Testes dos relatórios
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  diasEntre, compararOrcamento, resumirOrcamento,
  analisarCotacoes, resumirEconomia, analisarFornecedores,
  medirTempos, tempoTotal, consumoPorFamilia, materiaisMaisComprados,
  type LinhaDeOrcamento, type CotacaoParaAnalise,
  type FornecedorParaAnalise, type PassagemDaSolicitacao, type ItemComprado,
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
          { prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false },
          { prazoPrometido: 7, prazoReal: 7, comRessalva: false, devolvido: false },
          { prazoPrometido: 7, prazoReal: 12, comRessalva: false, devolvido: false },
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
          { prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false },
          { prazoPrometido: 7, prazoReal: 5, comRessalva: true, devolvido: false },
          { prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: true },
          { prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false },
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
          { prazoPrometido: null, prazoReal: 30, comRessalva: false, devolvido: false },
          { prazoPrometido: 7, prazoReal: 5, comRessalva: false, devolvido: false },
        ],
      }),
    ]);

    assert.equal(f.pontualidade, 100, 'só a entrega com prazo combinado conta');
  });

  it('a leitura aponta o problema mais grave primeiro', () => {
    const ruim = analisarFornecedores([
      fornecedor({
        entregas: [
          { prazoPrometido: 7, prazoReal: 30, comRessalva: true, devolvido: true },
          { prazoPrometido: 7, prazoReal: 30, comRessalva: true, devolvido: false },
          { prazoPrometido: 7, prazoReal: 30, comRessalva: true, devolvido: false },
        ],
      }),
    ])[0];

    assert.match(ruim.leitura, /chega com problema/);

    const atrasado = analisarFornecedores([
      fornecedor({
        entregas: [
          { prazoPrometido: 7, prazoReal: 30, comRessalva: false, devolvido: false },
          { prazoPrometido: 7, prazoReal: 30, comRessalva: false, devolvido: false },
          { prazoPrometido: 7, prazoReal: 30, comRessalva: false, devolvido: false },
        ],
      }),
    ])[0];

    assert.match(atrasado.leitura, /Atrasa/);
  });

  it('elogia quem cumpre tudo', () => {
    const boa = { prazoPrometido: 7, prazoReal: 6, comRessalva: false, devolvido: false };
    const [f] = analisarFornecedores([fornecedor({ entregas: [boa, boa, boa] })]);

    assert.match(f.leitura, /Cumpre prazo e entrega certo/);
  });

  it('não dá veredito com uma ou duas entregas', () => {
    const ruim = { prazoPrometido: 7, prazoReal: 40, comRessalva: true, devolvido: true };
    const boa = { prazoPrometido: 7, prazoReal: 6, comRessalva: false, devolvido: false };

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
