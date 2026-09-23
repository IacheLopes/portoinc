// ============================================================
//  Testes da equalização
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  montarComparativo, mensagemUltimaChamada, conferirEscolhas, formatarNumeroPedido,
  type ItemParaComparar,
} from './equalizacao.js';

const SEM_CUSTO = { A: { frete: 0, outros: 0 }, B: { frete: 0, outros: 0 } };

function item(
  id: string,
  quantidade: number,
  precos: Array<{ f: string; valor: number | null; disponivel?: boolean; prazo?: number }>,
): ItemParaComparar {
  return {
    bidItemId: id,
    codigo: 'COD-' + id,
    descricao: 'Item ' + id,
    unidadeMedida: 'UN',
    quantidade,
    respostas: precos.map((p) => ({
      bidFornecedorId: p.f,
      fornecedorNome: 'Fornecedor ' + p.f,
      disponivel: p.disponivel ?? true,
      valorUnitario: p.valor,
      marca: null,
      modelo: null,
      prazoEntregaDias: p.prazo ?? null,
      observacao: null,
    })),
  };
}

describe('Mapa comparativo', () => {
  it('marca o menor preço de cada item', () => {
    const c = montarComparativo(
      [
        item('1', 10, [{ f: 'A', valor: 100 }, { f: 'B', valor: 90 }]),
        item('2', 5, [{ f: 'A', valor: 20 }, { f: 'B', valor: 30 }]),
      ],
      SEM_CUSTO,
    );

    assert.equal(c.linhas[0].melhorFornecedorId, 'B');
    assert.equal(c.linhas[0].melhorTotal, 900);
    assert.equal(c.linhas[1].melhorFornecedorId, 'A');
    assert.equal(c.linhas[1].melhorTotal, 100);
  });

  it('calcula quanto cada um está acima do melhor', () => {
    const c = montarComparativo(
      [item('1', 1, [{ f: 'A', valor: 100 }, { f: 'B', valor: 120 }])],
      SEM_CUSTO,
    );

    const a = c.linhas[0].respostas.find((r) => r.bidFornecedorId === 'A');
    const b = c.linhas[0].respostas.find((r) => r.bidFornecedorId === 'B');

    assert.equal(a?.acimaEmPorcento, 0);
    assert.equal(b?.acimaEmPorcento, 20);
  });

  it('no empate, vence quem entrega mais rápido', () => {
    const c = montarComparativo(
      [
        item('1', 1, [
          { f: 'A', valor: 100, prazo: 15 },
          { f: 'B', valor: 100, prazo: 5 },
        ]),
      ],
      SEM_CUSTO,
    );

    assert.equal(c.linhas[0].melhorFornecedorId, 'B');
  });

  it('ignora quem marcou que não tem o item', () => {
    const c = montarComparativo(
      [
        item('1', 10, [
          { f: 'A', valor: 100 },
          { f: 'B', valor: null, disponivel: false },
        ]),
      ],
      SEM_CUSTO,
    );

    assert.equal(c.linhas[0].melhorFornecedorId, 'A');
    assert.equal(c.fornecedores.find((f) => f.bidFornecedorId === 'B')?.itensIndisponiveis, 1);
  });

  it('conta item sem nenhuma cotação', () => {
    const c = montarComparativo(
      [item('1', 1, [{ f: 'A', valor: null, disponivel: false }])],
      SEM_CUSTO,
    );

    assert.equal(c.linhas[0].melhorFornecedorId, null);
    assert.equal(c.itensSemCotacao, 1);
  });
});

describe('Resumo por fornecedor', () => {
  const itens = [
    item('1', 10, [{ f: 'A', valor: 100 }, { f: 'B', valor: 90 }]),
    item('2', 5, [{ f: 'A', valor: 20 }, { f: 'B', valor: 30 }]),
  ];

  it('soma o total de fechar tudo com cada um', () => {
    const c = montarComparativo(itens, SEM_CUSTO);

    const a = c.fornecedores.find((f) => f.bidFornecedorId === 'A');
    const b = c.fornecedores.find((f) => f.bidFornecedorId === 'B');

    assert.equal(a?.totalSeFecharTudo, 10 * 100 + 5 * 20);
    assert.equal(b?.totalSeFecharTudo, 10 * 90 + 5 * 30);
  });

  it('inclui frete no total de cada fornecedor', () => {
    const c = montarComparativo(itens, {
      A: { frete: 200, outros: 50 },
      B: { frete: 0, outros: 0 },
    });

    const a = c.fornecedores.find((f) => f.bidFornecedorId === 'A');
    assert.equal(a?.totalSeFecharTudo, 10 * 100 + 5 * 20 + 250);
  });

  it('não calcula total de quem não cotou tudo', () => {
    const c = montarComparativo(
      [
        item('1', 10, [{ f: 'A', valor: 100 }, { f: 'B', valor: 90 }]),
        item('2', 5, [{ f: 'A', valor: 20 }]),
      ],
      SEM_CUSTO,
    );

    const b = c.fornecedores.find((f) => f.bidFornecedorId === 'B');

    assert.equal(b?.cotouTudo, false);
    assert.equal(b?.totalSeFecharTudo, null);
  });

  it('lista em quais itens cada um está atrás', () => {
    const c = montarComparativo(itens, SEM_CUSTO);

    const a = c.fornecedores.find((f) => f.bidFornecedorId === 'A');
    const b = c.fornecedores.find((f) => f.bidFornecedorId === 'B');

    // A perde no item 1, B perde no item 2.
    assert.deepEqual(a?.itensAtras, ['1']);
    assert.deepEqual(b?.itensAtras, ['2']);
  });
});

describe('Comparação justa entre misturar e fechar com um só', () => {
  const itens = [
    item('1', 10, [{ f: 'A', valor: 100 }, { f: 'B', valor: 90 }]),
    item('2', 5, [{ f: 'A', valor: 20 }, { f: 'B', valor: 30 }]),
  ];

  it('a melhor combinação soma o frete de CADA vencedor', () => {
    const c = montarComparativo(itens, {
      A: { frete: 150, outros: 0 },
      B: { frete: 200, outros: 0 },
    });

    // Itens: 900 (B) + 100 (A) = 1000. Fretes: 150 + 200 = 350.
    assert.equal(c.somaDosItens, 1000);
    assert.equal(c.freteDaCombinacao, 350);
    assert.equal(c.melhorCombinacao, 1350);
    assert.equal(c.fornecedoresVencedores, 2);
  });

  it('quando um fornecedor vence tudo, cobra o frete dele só uma vez', () => {
    const c = montarComparativo(
      [
        item('1', 10, [{ f: 'A', valor: 50 }, { f: 'B', valor: 90 }]),
        item('2', 5, [{ f: 'A', valor: 10 }, { f: 'B', valor: 30 }]),
      ],
      { A: { frete: 120, outros: 0 }, B: { frete: 0, outros: 0 } },
    );

    assert.equal(c.fornecedoresVencedores, 1);
    assert.equal(c.melhorCombinacao, 500 + 50 + 120);
    // Nesse caso misturar não traz ganho nenhum sobre fechar com A.
    assert.equal(c.economiaAoMisturar, 0);
  });

  it('mostra a economia real de misturar', () => {
    const c = montarComparativo(itens, SEM_CUSTO);

    // Fechando tudo com B: 900 + 150 = 1050. Misturando: 1000.
    assert.equal(c.melhorFornecedorUnico?.total, 1050);
    assert.equal(c.melhorCombinacao, 1000);
    assert.equal(c.economiaAoMisturar, 50);
  });

  it('nunca mostra economia negativa', () => {
    const c = montarComparativo(itens, {
      A: { frete: 5000, outros: 0 },
      B: { frete: 0, outros: 0 },
    });

    assert.ok(c.economiaAoMisturar >= 0);
  });
});

describe('Mensagem da última chamada', () => {
  const prazo = new Date('2026-10-15T12:00:00Z');

  it('lista os itens em que o fornecedor está atrás', () => {
    const texto = mensagemUltimaChamada(
      'BID-00007',
      [
        { codigo: '00119', descricao: 'Cimento Portland' },
        { codigo: '00210', descricao: 'Areia média' },
      ],
      prazo,
    );

    assert.ok(texto.includes('BID-00007'));
    assert.ok(texto.includes('ÚLTIMA CHAMADA'));
    assert.ok(texto.includes('Cimento Portland'));
    assert.ok(texto.includes('Areia média'));
  });

  it('NUNCA revela preço de concorrente', () => {
    const texto = mensagemUltimaChamada(
      'BID-00007',
      [{ codigo: '00119', descricao: 'Cimento Portland' }],
      prazo,
    );

    // A mensagem não pode conter cifrão, "R$", percentual nem
    // qualquer nome de concorrente.
    assert.ok(!texto.includes('R$'), 'a mensagem não pode ter valores');
    assert.ok(!/\d+,\d{2}/.test(texto), 'a mensagem não pode ter preço formatado');
    assert.ok(!texto.toLowerCase().includes('concorrente'));
    assert.ok(!texto.toLowerCase().includes('mais barato'));
  });

  it('avisa de forma diferente quem está na frente em tudo', () => {
    const texto = mensagemUltimaChamada('BID-00007', [], prazo);

    assert.ok(texto.includes('melhor preço em todos'));
    assert.ok(!texto.includes('ÚLTIMA CHAMADA'));
  });

  it('resume quando há muitos itens', () => {
    const muitos = Array.from({ length: 15 }, (_, i) => ({
      codigo: 'C' + i,
      descricao: 'Item ' + i,
    }));

    const texto = mensagemUltimaChamada('BID-1', muitos, prazo);

    assert.ok(texto.includes('e mais 5 item(ns)'));
  });
});

describe('Conferência antes de gerar os pedidos', () => {
  it('libera quando tudo tem vencedor', () => {
    const p = conferirEscolhas([
      { bidItemId: '1', descricao: 'Cimento', escolhido: true, temCotacao: true },
      { bidItemId: '2', descricao: 'Areia', escolhido: true, temCotacao: true },
    ]);

    assert.deepEqual(p, []);
  });

  it('bloqueia item cotado mas sem escolha', () => {
    const p = conferirEscolhas([
      { bidItemId: '1', descricao: 'Cimento', escolhido: false, temCotacao: true },
    ]);

    assert.ok(p.some((x) => x.includes('sem fornecedor escolhido')));
  });

  it('avisa sobre item que ninguém cotou', () => {
    const p = conferirEscolhas([
      { bidItemId: '1', descricao: 'Cimento', escolhido: true, temCotacao: true },
      { bidItemId: '2', descricao: 'Item raro', escolhido: false, temCotacao: false },
    ]);

    assert.ok(p.some((x) => x.includes('não receberam nenhuma cotação')));
  });

  it('bloqueia pacote vazio', () => {
    assert.equal(conferirEscolhas([]).length, 1);
  });
});

describe('Número do pedido', () => {
  it('preenche com zeros', () => {
    assert.equal(formatarNumeroPedido(1), 'PC-00001');
    assert.equal(formatarNumeroPedido(4321), 'PC-04321');
  });
});
