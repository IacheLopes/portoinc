// ============================================================
//  Testes das regras da solicitação de compra
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  podeIrPara, podeEditar, formatarNumero, conferirParaEnvio,
  calcularTotalEstimado, acharFaixa, explicarAprovacao, resumoDaAlcada,
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
