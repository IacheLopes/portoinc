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

  it('MAS QUEM PERDE O DESEMPATE NÃO ESTÁ ATRÁS', () => {
    //  O defeito que isto cobre, medido no BID-00005 em 10/10/2026:
    //  Ferragens e Eletro Minas cotaram exatamente o mesmo preço nos
    //  três itens. O desempate deu a Eletro Minas, e a Ferragens
    //  apareceu "atrás em 3" — igual à Cimenteira, que estava 87%
    //  mais cara.
    //
    //  Eram duas perguntas diferentes com uma resposta só:
    //    "quem leva o item?"      -> um só, pelo prazo
    //    "quem está mais caro?"   -> ninguém, estão iguais
    const c = montarComparativo(
      [
        item('1', 1, [
          { f: 'A', valor: 100, prazo: 15 },
          { f: 'B', valor: 100, prazo: 5 },
          { f: 'C', valor: 180 },
        ]),
      ],
      SEM_CUSTO,
    );

    const resumo = (id: string) => c.fornecedores.find((f) => f.bidFornecedorId === id);

    //  B leva o item, por entregar antes.
    assert.equal(c.linhas[0].melhorFornecedorId, 'B');

    //  Mas A está no mesmo preço, e isso é o que conta aqui.
    assert.deepEqual(resumo('A')?.itensAtras, [], 'A empatou no melhor preço');
    assert.deepEqual(resumo('B')?.itensAtras, []);
    assert.equal(resumo('A')?.itensVencidos, 1);
    assert.equal(resumo('B')?.itensVencidos, 1);

    //  E C, que está mais caro de verdade, continua atrás.
    assert.equal(resumo('C')?.itensAtras.length, 1);
    assert.equal(resumo('C')?.itensVencidos, 0);
  });

  it('a célula do empatado é destacada como melhor preço', () => {
    //  Na tela, as duas células de R$ 100,00 mostravam coisas
    //  diferentes: uma dizia "melhor preço", a outra "+0%". O
    //  comprador batia o olho e achava que uma era pior.
    const c = montarComparativo(
      [item('1', 1, [{ f: 'A', valor: 100 }, { f: 'B', valor: 100 }])],
      SEM_CUSTO,
    );

    const resposta = (id: string) =>
      c.linhas[0].respostas.find((r) => r.bidFornecedorId === id);

    assert.equal(resposta('A')?.ehMelhor, true);
    assert.equal(resposta('B')?.ehMelhor, true);
  });

  it('quem não tem o item não entra como empatado', () => {
    //  `ehMelhor` passou a olhar o VALOR. Item sem preço tem valor
    //  nulo, e nulo não pode casar com "melhor preço" por descuido.
    const c = montarComparativo(
      [item('1', 1, [{ f: 'A', valor: 100 }, { f: 'B', valor: null, disponivel: false }])],
      SEM_CUSTO,
    );

    const b = c.linhas[0].respostas.find((r) => r.bidFornecedorId === 'B');

    assert.equal(b?.ehMelhor, false);
    assert.equal(c.fornecedores.find((f) => f.bidFornecedorId === 'B')?.itensVencidos, 0);
  });

  it('A ÚLTIMA CHAMADA NÃO MENTE PARA QUEM EMPATOU', () => {
    //  É aqui que o defeito saía da tela e ia para fora da empresa:
    //  `itensAtras` alimenta a mensagem, e ela diria ao empatado
    //  "recebemos propostas melhores nestes itens" — pedindo que
    //  baixasse um preço que já era o mais barato.
    const c = montarComparativo(
      [
        item('1', 1, [
          { f: 'A', valor: 100, prazo: 15 },
          { f: 'B', valor: 100, prazo: 5 },
        ]),
      ],
      SEM_CUSTO,
    );

    const atras = c.fornecedores.find((f) => f.bidFornecedorId === 'A')?.itensAtras ?? [];

    const texto = mensagemUltimaChamada({
      titulo: 'Pacote de teste',
      itensAtras: atras.map(() => ({
        codigo: 'X', descricao: 'Item', quantidade: 1, unidadeMedida: 'UN',
      })),
      novoPrazo: new Date('2026-10-20T12:00:00Z'),
      link: 'http://localhost:5173/p/abc',
      fornecedor: 'Ferragens',
    });

    assert.ok(
      texto.includes('melhor preço em todos os itens'),
      'quem empatou tem de receber o texto de quem está na frente:\n' + texto,
    );
    assert.ok(!texto.includes('propostas melhores'), texto);
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

  const base = {
    titulo: 'Elétrica — Residencial Aurora',
    novoPrazo: prazo,
    link: 'http://localhost:5173/p/abc123',
    fornecedor: 'Eletro Minas',
  };

  const cimento = {
    codigo: '00119',
    descricao: 'Cimento Portland',
    quantidade: 50,
    unidadeMedida: 'SC',
  };
  const areia = {
    codigo: '00210',
    descricao: 'Areia média',
    quantidade: 12,
    unidadeMedida: 'M3',
  };

  it('lista os itens em que o fornecedor está atrás', () => {
    const texto = mensagemUltimaChamada({ ...base, itensAtras: [cimento, areia] });

    assert.ok(texto.includes('ÚLTIMA CHAMADA'));
    assert.ok(texto.includes('Cimento Portland'));
    assert.ok(texto.includes('Areia média'));
  });

  it('A QUANTIDADE SEPARA DUAS LINHAS DO MESMO MATERIAL', () => {
    //  O defeito que isto cobre, medido no BID-00005 em
    //  10/10/2026: o pacote junta solicitações de obras
    //  diferentes, então o mesmo cabo virou três itens — 20, 100 e
    //  400 rolos. A lista levava só código e descrição, e o
    //  fornecedor receberia três linhas idênticas, sem saber qual
    //  rever. Para ele, isso parece sistema quebrado.
    const cabo = {
      codigo: 'EL-0001',
      descricao: 'Cabo flexível 2,5mm 750V rolo 100m',
      unidadeMedida: 'RL',
    };

    const texto = mensagemUltimaChamada({
      ...base,
      itensAtras: [
        { ...cabo, quantidade: 20 },
        { ...cabo, quantidade: 100 },
        { ...cabo, quantidade: 400 },
      ],
    });

    const linhas = texto.split('\n').filter((l) => l.startsWith('- '));

    assert.equal(linhas.length, 3);
    assert.equal(new Set(linhas).size, 3, 'as três linhas não podem ser iguais:\n' + texto);
    assert.ok(texto.includes('(20 RL)'));
    assert.ok(texto.includes('(100 RL)'));
    assert.ok(texto.includes('(400 RL)'));
  });

  it('ABRE COM SAUDAÇÃO, e pelo nome de quem recebe', () => {
    //  Igual ao convite. Abrir com "Porto Inc. — BID-00005 ·
    //  ÚLTIMA CHAMADA" é abrir com um código — e o fornecedor
    //  nunca viu esse código, porque o convite não o manda.
    const atras = mensagemUltimaChamada({ ...base, itensAtras: [cimento] });
    const frente = mensagemUltimaChamada({ ...base, itensAtras: [] });

    assert.ok(atras.startsWith('Olá, Eletro Minas!'), atras.slice(0, 40));
    assert.ok(frente.startsWith('Olá, Eletro Minas!'), frente.slice(0, 40));
    assert.ok(!atras.includes('BID-'), 'o código do pacote não diz nada a quem recebe');
  });

  it('sem o nome do fornecedor, ainda cumprimenta', () => {
    const texto = mensagemUltimaChamada({
      ...base,
      fornecedor: undefined,
      itensAtras: [cimento],
    });

    assert.ok(texto.startsWith('Olá!'));
  });

  it('O LINK FICA NO TEXTO, nos dois textos', () => {
    //  Mesmo motivo do convite: o cartão de prévia não aparece
    //  para todo mundo, e sem o link no texto essa pessoa fica sem
    //  forma nenhuma de responder.
    for (const itens of [[cimento], []]) {
      const texto = mensagemUltimaChamada({ ...base, itensAtras: itens });

      assert.ok(texto.includes(base.link), 'o link não pode sair do texto');
      assert.ok(texto.includes('cartão acima'), 'e o texto aponta para o cartão');
    }
  });

  it('o recado do comprador entra quando existe', () => {
    const com = mensagemUltimaChamada({
      ...base,
      itensAtras: [cimento],
      recado: 'Precisamos fechar até sexta.',
    });
    const sem = mensagemUltimaChamada({ ...base, itensAtras: [cimento], recado: '   ' });

    assert.ok(com.includes('Precisamos fechar até sexta.'));
    //  Recado em branco não pode virar linha vazia no meio da
    //  mensagem: no WhatsApp isso aparece como um buraco.
    assert.ok(!sem.includes('\n\n\n'), sem);
  });

  it('NUNCA revela preço de concorrente', () => {
    const texto = mensagemUltimaChamada({ ...base, itensAtras: [cimento, areia] });

    //  A mensagem não pode conter cifrão, "R$", nem qualquer nome
    //  de concorrente.
    assert.ok(!texto.includes('R$'), 'a mensagem não pode ter valores');
    assert.ok(!texto.toLowerCase().includes('concorrente'));
    assert.ok(!texto.toLowerCase().includes('mais barato'));

    //  Preço formatado ("16,00") também não. A conferência ignora
    //  o que está entre parênteses, que é a QUANTIDADE — e
    //  quantidade pode ter decimal: 2,5 m³ de areia.
    const semQuantidades = texto.replace(/\([^)]*\)/g, '');
    assert.ok(
      !/\d+,\d{2}/.test(semQuantidades),
      'a mensagem não pode ter preço formatado: ' + semQuantidades,
    );
  });

  it('resume quando há muitos itens', () => {
    const muitos = Array.from({ length: 15 }, (_, i) => ({
      codigo: 'C' + i,
      descricao: 'Item ' + i,
      quantidade: i + 1,
      unidadeMedida: 'UN',
    }));

    const texto = mensagemUltimaChamada({ ...base, itensAtras: muitos });

    assert.ok(texto.includes('e mais 5 itens'), texto);
  });

  it('avisa de forma diferente quem está na frente em tudo', () => {
    const texto = mensagemUltimaChamada({ ...base, itensAtras: [] });

    assert.ok(texto.includes('melhor preço em todos'));
    assert.ok(!texto.includes('ÚLTIMA CHAMADA'));
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

    // UM item sem cotacao: o verbo vai para o singular. Escrito
    // assim, o teste prova a concordancia em vez de so passar.
    assert.ok(
      p.some((x) => x.includes('1 item não recebeu nenhuma cotação')),
      p.join(' | '),
    );
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
