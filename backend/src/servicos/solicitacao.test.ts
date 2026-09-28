// ============================================================
//  Testes das regras da solicitação de compra
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  podeIrPara, podeEditar, formatarNumero, conferirParaEnvio,
  calcularTotalEstimado, acharFaixa, explicarAprovacao, resumoDaAlcada,
  conferirAlcadaDoFechamento,
  type FaixaAlcada,
} from './solicitacao.js';

describe('Caminhos entre situações', () => {
  it('rascunho pode ser enviado ou cancelado', () => {
    assert.equal(podeIrPara('RASCUNHO', 'AGUARDANDO_APROVACAO'), true);
    assert.equal(podeIrPara('RASCUNHO', 'CANCELADA'), true);
  });

  it('rascunho NÃO pode pular direto para aprovada', () => {
    assert.equal(podeIrPara('RASCUNHO', 'APROVADA'), false);
  });

  it('aprovada e reprovada são pontos finais', () => {
    for (const destino of ['RASCUNHO', 'AGUARDANDO_APROVACAO', 'CANCELADA'] as const) {
      assert.equal(podeIrPara('APROVADA', destino), false);
      assert.equal(podeIrPara('REPROVADA', destino), false);
    }
  });

  it('em revisão volta para aprovação', () => {
    assert.equal(podeIrPara('EM_REVISAO', 'AGUARDANDO_APROVACAO'), true);
  });

  it('cancelada não volta atrás', () => {
    assert.equal(podeIrPara('CANCELADA', 'RASCUNHO'), false);
  });
});

describe('Permissão de edição', () => {
  it('só rascunho e em revisão aceitam mudança', () => {
    assert.equal(podeEditar('RASCUNHO'), true);
    assert.equal(podeEditar('EM_REVISAO'), true);
    assert.equal(podeEditar('AGUARDANDO_APROVACAO'), false);
    assert.equal(podeEditar('APROVADA'), false);
    assert.equal(podeEditar('CANCELADA'), false);
  });
});

describe('Número da solicitação', () => {
  it('preenche com zeros à esquerda', () => {
    assert.equal(formatarNumero(1), 'SOL-00001');
    assert.equal(formatarNumero(42), 'SOL-00042');
    assert.equal(formatarNumero(12345), 'SOL-12345');
  });

  it('não corta número grande', () => {
    assert.equal(formatarNumero(123456), 'SOL-123456');
  });
});

describe('Conferência antes do envio', () => {
  const item = (extra: Partial<Parameters<typeof conferirParaEnvio>[0][0]> = {}) => ({
    quantidade: 10,
    primeiraCompra: false,
    especificacaoTecnica: null,
    descricao: 'Cimento Portland',
    ...extra,
  });

  it('bloqueia solicitação sem itens', () => {
    const problemas = conferirParaEnvio([]);
    assert.equal(problemas.length, 1);
    assert.ok(problemas[0].includes('pelo menos um item'));
  });

  it('libera item normal', () => {
    assert.deepEqual(conferirParaEnvio([item()]), []);
  });

  it('bloqueia quantidade zero ou negativa', () => {
    assert.equal(conferirParaEnvio([item({ quantidade: 0 })]).length, 1);
    assert.equal(conferirParaEnvio([item({ quantidade: -5 })]).length, 1);
  });

  it('exige especificação quando é a primeira compra', () => {
    const problemas = conferirParaEnvio([item({ primeiraCompra: true })]);

    assert.equal(problemas.length, 1);
    assert.ok(problemas[0].includes('nunca foi comprado'));
    assert.ok(problemas[0].includes('especificação técnica'));
  });

  it('libera primeira compra quando a especificação foi preenchida', () => {
    const problemas = conferirParaEnvio([
      item({ primeiraCompra: true, especificacaoTecnica: 'CP-II-Z-32, saco de 50kg' }),
    ]);

    assert.deepEqual(problemas, []);
  });

  it('não aceita especificação só com espaços', () => {
    const problemas = conferirParaEnvio([
      item({ primeiraCompra: true, especificacaoTecnica: '   ' }),
    ]);

    assert.equal(problemas.length, 1);
  });

  it('acumula problemas de vários itens', () => {
    const problemas = conferirParaEnvio([
      item({ quantidade: 0, descricao: 'Areia' }),
      item({ primeiraCompra: true, descricao: 'Brita' }),
      item({ descricao: 'Cimento' }),
    ]);

    assert.equal(problemas.length, 2);
    assert.ok(problemas[0].includes('Areia'));
    assert.ok(problemas[1].includes('Brita'));
  });
});

describe('Total estimado', () => {
  it('multiplica quantidade por valor', () => {
    const total = calcularTotalEstimado([
      { quantidade: 120, valorEstimado: 34 },
      { quantidade: 10, valorEstimado: 130 },
    ]);

    assert.equal(total, 120 * 34 + 10 * 130);
  });

  it('item sem estimativa conta como zero', () => {
    const total = calcularTotalEstimado([
      { quantidade: 120, valorEstimado: 34 },
      { quantidade: 999, valorEstimado: null },
    ]);

    assert.equal(total, 4080);
  });

  it('lista vazia dá zero', () => {
    assert.equal(calcularTotalEstimado([]), 0);
  });
});

describe('Escolha da faixa de alçada', () => {
  const FAIXAS: FaixaAlcada[] = [
    {
      id: '1', descricao: 'Rotina', valorMinimo: 0, valorMaximo: 2000,
      exigeTodas: false, funcoes: [{ codigo: 'GESTOR_OBRA', nome: 'Gestor de obra' }],
    },
    {
      id: '2', descricao: 'Médio', valorMinimo: 2000, valorMaximo: 15000,
      exigeTodas: true,
      funcoes: [
        { codigo: 'GESTOR_OBRA', nome: 'Gestor de obra' },
        { codigo: 'ENGENHEIRO', nome: 'Engenheiro' },
      ],
    },
    {
      id: '3', descricao: 'Elevado', valorMinimo: 15000, valorMaximo: null,
      exigeTodas: false, funcoes: [{ codigo: 'FUNDADOR', nome: 'Fundador' }],
    },
  ];

  it('acha a faixa certa para cada valor', () => {
    assert.equal(acharFaixa(800, FAIXAS)?.id, '1');
    assert.equal(acharFaixa(7500, FAIXAS)?.id, '2');
    assert.equal(acharFaixa(42000, FAIXAS)?.id, '3');
  });

  it('o teto NÃO entra na faixa; o piso entra', () => {
    // Mudado em 25/09/2026. Antes o teto entrava, e por isso o valor
    // exato caía em duas faixas — quem configurava tinha de escrever
    // "2.000" numa e "2.000,01" na outra.
    //
    // Agora o teto de uma é o piso da seguinte, como em faixa de
    // imposto de renda. Ninguém digita centavo.
    assert.equal(acharFaixa(0, FAIXAS)?.id, '1');
    assert.equal(acharFaixa(1999.99, FAIXAS)?.id, '1');
    assert.equal(acharFaixa(2000, FAIXAS)?.id, '2', 'o teto pertence à faixa de cima');
    assert.equal(acharFaixa(14999.99, FAIXAS)?.id, '2');
    assert.equal(acharFaixa(15000, FAIXAS)?.id, '3');
  });

  it('não acha faixa quando nenhuma cobre o valor', () => {
    const apenasAltas: FaixaAlcada[] = [{ ...FAIXAS[2] }];
    assert.equal(acharFaixa(100, apenasAltas), null);
  });

  it('havendo sobreposição, vale a de maior mínimo', () => {
    const sobrepostas: FaixaAlcada[] = [
      { ...FAIXAS[0], valorMaximo: 5000 },
      { ...FAIXAS[1], valorMinimo: 3000 },
    ];

    assert.equal(acharFaixa(4000, sobrepostas)?.id, '2');
  });

  /** Uma faixa em que dá para escolher QUEM assina — precisa de 2+. */
  const ESCOLHA: FaixaAlcada[] = [
    {
      id: '9', descricao: 'Qualquer diretor', valorMinimo: 0, valorMaximo: null,
      exigeTodas: false,
      funcoes: [
        { codigo: 'ENGENHEIRO', nome: 'Engenheiro' },
        { codigo: 'FUNDADOR', nome: 'Fundador' },
      ],
    },
  ];

  it('explica em português quem precisa assinar', () => {
    assert.equal(
      explicarAprovacao(acharFaixa(800, FAIXAS)),
      'Precisa de 1 assinatura: Gestor de obra.',
    );
    assert.equal(
      explicarAprovacao(acharFaixa(7500, FAIXAS)),
      'Precisa de 2 assinaturas: Gestor de obra e Engenheiro.',
    );
    assert.equal(
      explicarAprovacao(acharFaixa(800, ESCOLHA)),
      'Basta 1 assinatura: Engenheiro ou Fundador.',
    );
    assert.ok(explicarAprovacao(null).includes('Nenhuma faixa'));
  });

  it('não grita: a frase não tem palavra em maiúsculas', () => {
    // "TODAS" era o único CAPS LOCK da interface. Se voltar, esta
    // prova cai — inclusive se voltar em outra faixa qualquer.
    for (const valor of [800, 7500, 60000]) {
      const frase = explicarAprovacao(acharFaixa(valor, FAIXAS));
      assert.equal(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}\b/.test(frase), false, frase);
    }
  });

  it('usa "e" para todas e "ou" para uma só', () => {
    // A conjunção É a regra. Trocar uma pela outra inverte o
    // significado sem mudar mais nada na frase.
    const todas = explicarAprovacao(acharFaixa(7500, FAIXAS));
    assert.ok(todas.includes(' e '), todas);
    assert.equal(todas.includes(' ou '), false, todas);

    const qualquer = explicarAprovacao(acharFaixa(800, ESCOLHA));
    assert.ok(qualquer.includes(' ou '), qualquer);
  });

  it('com uma função só, não fala em quantidade de opções', () => {
    const umaFuncao: FaixaAlcada[] = [
      { ...FAIXAS[0], exigeTodas: true, funcoes: [{ codigo: 'GESTOR_OBRA', nome: 'Gestor de obra' }] },
    ];

    assert.equal(
      explicarAprovacao(acharFaixa(100, umaFuncao)),
      'Precisa de 1 assinatura: Gestor de obra.',
    );
  });

  it('resumoDaAlcada entrega a lista que a tela precisa', () => {
    const r = resumoDaAlcada(acharFaixa(7500, FAIXAS));

    assert.equal(r.exigeTodas, true);
    assert.equal(r.funcoes.length, 2);
    // Código E nome: o código casa com quem já assinou, o nome
    // aparece na tela. Faltando um dos dois, a lista não fecha.
    assert.ok(r.funcoes.every((f) => f.codigo && f.nome));
    assert.ok(r.faixa);
  });

  it('resumoDaAlcada sem faixa não quebra a tela', () => {
    const r = resumoDaAlcada(null);

    assert.deepEqual(r.funcoes, []);
    assert.equal(r.faixa, null);
    assert.equal(r.exigeTodas, false);
    assert.ok(r.explicacao.includes('Nenhuma faixa'));
  });
});

// ============================================================
//  A alçada conferida contra o preço real
// ============================================================

const FAIXAS_PARA_FECHAMENTO: FaixaAlcada[] = [
  {
    id: 'ate-2k', descricao: 'Até R$ 2.000', valorMinimo: 0, valorMaximo: 2000,
    exigeTodas: false, funcoes: [{ codigo: 'GESTOR_OBRA', nome: 'Gestor de obra' }],
  },
  {
    id: 'ate-15k', descricao: 'De R$ 2.000 a R$ 15.000', valorMinimo: 2000, valorMaximo: 15000,
    exigeTodas: true,
    funcoes: [
      { codigo: 'GESTOR_OBRA', nome: 'Gestor de obra' },
      { codigo: 'ENGENHEIRO', nome: 'Engenheiro' },
    ],
  },
  {
    id: 'acima-15k', descricao: 'Acima de R$ 15.000', valorMinimo: 15000, valorMaximo: null,
    exigeTodas: false, funcoes: [{ codigo: 'FUNDADOR', nome: 'Fundador' }],
  },
];

/** Atalho: o mínimo da faixa fotografada no envio. */
function faixaDoEnvio(id: string) {
  const f = FAIXAS_PARA_FECHAMENTO.find((x) => x.id === id)!;
  return { valorMinimo: f.valorMinimo };
}

describe('Alçada conferida contra o preço real', () => {
  it('estourar a faixa manda de volta para assinar', () => {
    // O buraco que existia: quem assinou R$ 1.900 estava autorizando
    // qualquer valor, porque ninguém mais olhava depois.
    const r = conferirAlcadaDoFechamento({
      valorNoEnvio: 1900,
      valorReal: 8000,
      faixaDoEnvio: faixaDoEnvio('ate-2k'),
      faixas: FAIXAS_PARA_FECHAMENTO,
    });

    assert.equal(r.precisaReaprovar, true);
    assert.equal(r.faixaAgora?.id, 'ate-15k');
    assert.match(r.motivo!, /Gestor de obra e Engenheiro/);
    assert.match(r.motivo!, /mudou de faixa/);
  });

  it('fechar MAIS BARATO segue em frente', () => {
    // O caso real de 28/09/2026: estimado R$ 6.880 (duas
    // assinaturas), fechado R$ 2.900. Quem assinou tinha poder de
    // sobra — travar aqui seria burocracia pura.
    const r = conferirAlcadaDoFechamento({
      valorNoEnvio: 6880,
      valorReal: 2900,
      faixaDoEnvio: faixaDoEnvio('ate-15k'),
      faixas: FAIXAS_PARA_FECHAMENTO,
    });

    assert.equal(r.precisaReaprovar, false);
    assert.equal(r.motivo, null);
    assert.equal(r.variacao, -57.8);
  });

  it('subir dentro da tolerância segue em frente', () => {
    // R$ 1.000 → R$ 1.200 é 20% cravado, e 20% é o limite.
    const r = conferirAlcadaDoFechamento({
      valorNoEnvio: 1000,
      valorReal: 1200,
      faixaDoEnvio: faixaDoEnvio('ate-2k'),
      faixas: FAIXAS_PARA_FECHAMENTO,
    });

    assert.equal(r.precisaReaprovar, false);
    assert.equal(r.variacao, 20);
  });

  it('subir muito SEM mudar de faixa também segue', () => {
    // Dobrou de preço, mas continua sendo compra que o gestor
    // sozinho podia autorizar. Não há assinatura faltando.
    const r = conferirAlcadaDoFechamento({
      valorNoEnvio: 500,
      valorReal: 1800,
      faixaDoEnvio: faixaDoEnvio('ate-2k'),
      faixas: FAIXAS_PARA_FECHAMENTO,
    });

    assert.equal(r.precisaReaprovar, false);
    assert.equal(r.variacao, 260);
  });

  it('pular duas faixas de uma vez manda de volta', () => {
    const r = conferirAlcadaDoFechamento({
      valorNoEnvio: 1500,
      valorReal: 30000,
      faixaDoEnvio: faixaDoEnvio('ate-2k'),
      faixas: FAIXAS_PARA_FECHAMENTO,
    });

    assert.equal(r.precisaReaprovar, true);
    assert.equal(r.faixaAgora?.id, 'acima-15k');
    assert.match(r.motivo!, /Fundador/);
  });

  it('a tolerância é ajustável', () => {
    const entrada = {
      valorNoEnvio: 1900,
      valorReal: 2100,
      faixaDoEnvio: faixaDoEnvio('ate-2k'),
      faixas: FAIXAS_PARA_FECHAMENTO,
    };

    // 10,5% acima: passa com tolerância de 20, trava com 10.
    assert.equal(conferirAlcadaDoFechamento({ ...entrada }).precisaReaprovar, false);
    assert.equal(
      conferirAlcadaDoFechamento({ ...entrada, tolerancia: 10 }).precisaReaprovar,
      true,
    );
  });

  it('solicitação antiga, sem estimativa guardada, não trava nada', () => {
    // Anterior à fotografia da alçada. Sem o número do envio não há
    // de que desviar, e inventar um travaria compra por engano.
    const r = conferirAlcadaDoFechamento({
      valorNoEnvio: null,
      valorReal: 50000,
      faixaDoEnvio: null,
      faixas: FAIXAS_PARA_FECHAMENTO,
    });

    assert.equal(r.precisaReaprovar, false);
  });

  it('faixa do envio apagada do cadastro não trava a compra', () => {
    // Administrador mexeu nas faixas no meio do caminho. Sem o
    // mínimo antigo não dá para dizer que subiu — e travar por
    // dúvida seria pior que deixar passar com o registro.
    const r = conferirAlcadaDoFechamento({
      valorNoEnvio: 1000,
      valorReal: 9000,
      faixaDoEnvio: null,
      faixas: FAIXAS_PARA_FECHAMENTO,
    });

    assert.equal(r.precisaReaprovar, false);
  });
});
