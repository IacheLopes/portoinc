// ============================================================
//  Testes da Etapa 6 - Equalização e pedido de compra
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let comprador = '';
let solicitante = '';
let gestor = '';
let obraId = '';
let materialA = '';
let materialB = '';
let fornecedor1 = '';
let fornecedor2 = '';

/** Solicitação aprovada, devolvendo os ids dos itens. */
async function itensAprovados(materiais: Array<{ id: string; qtd: number }>) {
  const criada = await chamar('/api/solicitacoes', {
    metodo: 'POST',
    token: solicitante,
    corpo: {
      obraId,
      itens: materiais.map((m) => ({
        materialId: m.id,
        quantidade: m.qtd,
        valorEstimado: 10,
        especificacaoTecnica: 'Padrão.',
      })),
    },
  });

  const id = criada.corpo.solicitacao.id;
  await chamar('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST', token: solicitante });
  await chamar('/api/aprovacoes/' + id + '/decidir', {
    metodo: 'POST', token: gestor, corpo: { decisao: 'APROVADA' },
  });

  const d = await chamar('/api/solicitacoes/' + id, { token: solicitante });
  return d.corpo.solicitacao.itens.map((i: { id: string }) => i.id);
}

function prazo(dias = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

/**
 * Monta um pacote completo com dois fornecedores respondendo,
 * cada um com o preço informado por item.
 */
async function pacoteComRespostas(
  precos: Array<{ f1: number | null; f2: number | null }>,
  custos = { f1: 0, f2: 0 },
) {
  const itens = await itensAprovados([
    { id: materialA, qtd: 10 },
    { id: materialB, qtd: 5 },
  ]);

  const bid = await chamar('/api/cotacoes', {
    metodo: 'POST', token: comprador,
    corpo: { titulo: 'Pacote de teste', prazoResposta: prazo(), itens },
  });

  const id = bid.corpo.cotacao.id;

  await chamar('/api/cotacoes/' + id + '/fornecedores', {
    metodo: 'POST', token: comprador,
    corpo: { fornecedores: [fornecedor1, fornecedor2] },
  });

  const aberto = await chamar('/api/cotacoes/' + id + '/abrir', {
    metodo: 'POST', token: comprador,
  });

  const cot = aberto.corpo.cotacao;
  const itensBid = cot.itens;

  const porFornecedor = [
    { convite: cot.convidados[0], preco: 'f1' as const, frete: custos.f1 },
    { convite: cot.convidados[1], preco: 'f2' as const, frete: custos.f2 },
  ];

  for (const { convite, preco, frete } of porFornecedor) {
    await chamar('/api/portal/' + convite.token, {
      metodo: 'POST',
      corpo: {
        itens: itensBid.map((item: { id: string }, indice: number) => {
          const valor = precos[indice]?.[preco] ?? null;
          return {
            bidItemId: item.id,
            disponivel: valor !== null,
            valorUnitario: valor,
            prazoEntregaDias: 10,
          };
        }),
        valorFrete: frete,
        percentualEntrada: 30,
        quantidadeParcelas: 2,
        intervaloParcelasDias: 30,
      },
    });
  }

  return { id, itensBid, convidados: cot.convidados };
}

before(async () => {
  await limparDados();

  await criarUsuarioTeste('admin6@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('comprador6@teste.com.br', ['COMPRADOR']);
  await criarUsuarioTeste('solicitante6@teste.com.br', ['SOLICITANTE']);
  await criarUsuarioTeste('gestor6@teste.com.br', ['GESTOR_OBRA']);

  admin = await entrarComo('admin6@teste.com.br');
  comprador = await entrarComo('comprador6@teste.com.br');
  solicitante = await entrarComo('solicitante6@teste.com.br');
  gestor = await entrarComo('gestor6@teste.com.br');

  const familia = await chamar('/api/familias', {
    metodo: 'POST', token: admin, corpo: { codigo: 'EQU', nome: 'Equalização' },
  });

  const a = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId: familia.corpo.familia.id, codigoInterno: 'EQ-A',
      descricao: 'Material A', unidadeMedida: 'UN',
    },
  });
  materialA = a.corpo.material.id;

  const b = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId: familia.corpo.familia.id, codigoInterno: 'EQ-B',
      descricao: 'Material B', unidadeMedida: 'UN',
    },
  });
  materialB = b.corpo.material.id;

  const f1 = await chamar('/api/fornecedores', {
    metodo: 'POST', token: admin,
    corpo: {
      razaoSocial: 'Fornecedor Um Ltda', cnpj: '05570714000159',
      whatsapp: '5511911111111', familias: [familia.corpo.familia.id],
    },
  });
  fornecedor1 = f1.corpo.fornecedor.id;

  const f2 = await chamar('/api/fornecedores', {
    metodo: 'POST', token: admin,
    corpo: {
      razaoSocial: 'Fornecedor Dois Ltda', cnpj: '33000167000101',
      whatsapp: '5511922222222', familias: [familia.corpo.familia.id],
    },
  });
  fornecedor2 = f2.corpo.fornecedor.id;

  const obra = await chamar('/api/obras', {
    metodo: 'POST', token: admin, corpo: { codigo: 'OB-EQ', nome: 'Obra da equalização' },
  });
  obraId = obra.corpo.obra.id;
});

after(encerrar);

describe('Mapa comparativo', () => {
  it('mostra os dois fornecedores lado a lado', async () => {
    const { id } = await pacoteComRespostas([
      { f1: 100, f2: 90 },
      { f1: 20, f2: 30 },
    ]);

    const r = await chamar('/api/cotacoes/' + id + '/equalizacao', { token: comprador });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.comparativo.linhas.length, 2);
    assert.equal(r.corpo.comparativo.fornecedores.length, 2);
    assert.equal(r.corpo.comparativo.linhas[0].respostas.length, 2);
  });

  it('aponta o vencedor de cada item', async () => {
    const { id } = await pacoteComRespostas([
      { f1: 100, f2: 90 },
      { f1: 20, f2: 30 },
    ]);

    const r = await chamar('/api/cotacoes/' + id + '/equalizacao', { token: comprador });
    const [linha1, linha2] = r.corpo.comparativo.linhas;

    // 10 × 90 = 900 é o melhor do item 1
    assert.equal(linha1.melhorTotal, 900);
    // 5 × 20 = 100 é o melhor do item 2
    assert.equal(linha2.melhorTotal, 100);
    // Vencedores diferentes: dá para misturar.
    assert.notEqual(linha1.melhorFornecedorId, linha2.melhorFornecedorId);
  });

  it('calcula a economia real de misturar, já com os fretes', async () => {
    const { id } = await pacoteComRespostas(
      [{ f1: 100, f2: 90 }, { f1: 20, f2: 30 }],
      { f1: 50, f2: 50 },
    );

    const r = await chamar('/api/cotacoes/' + id + '/equalizacao', { token: comprador });
    const c = r.corpo.comparativo;

    assert.equal(c.somaDosItens, 1000);
    // Dois vencedores = dois fretes.
    assert.equal(c.fornecedoresVencedores, 2);
    assert.equal(c.freteDaCombinacao, 100);
    assert.equal(c.melhorCombinacao, 1100);
    // Fechar tudo com o Dois: 900 + 150 + 50 = 1100. Empate.
    assert.equal(c.economiaAoMisturar, 0);
  });

  it('traz as condições comerciais de cada fornecedor', async () => {
    const { id } = await pacoteComRespostas([{ f1: 10, f2: 20 }, { f1: 10, f2: 20 }]);

    const r = await chamar('/api/cotacoes/' + id + '/equalizacao', { token: comprador });

    assert.equal(r.corpo.condicoes.length, 2);
    assert.ok(r.corpo.condicoes[0].pagamento.includes('30%'));
  });

  it('marca item que ninguém cotou', async () => {
    const { id } = await pacoteComRespostas([
      { f1: 100, f2: 90 },
      { f1: null, f2: null },
    ]);

    const r = await chamar('/api/cotacoes/' + id + '/equalizacao', { token: comprador });

    assert.equal(r.corpo.comparativo.itensSemCotacao, 1);
  });

  it('só o comprador acessa', async () => {
    const { id } = await pacoteComRespostas([{ f1: 1, f2: 2 }, { f1: 1, f2: 2 }]);
    const r = await chamar('/api/cotacoes/' + id + '/equalizacao', { token: solicitante });

    assert.equal(r.status, 403);
  });
});

describe('Escolha do vencedor', () => {
  it('registra a escolha item a item', async () => {
    const { id, itensBid, convidados } = await pacoteComRespostas([
      { f1: 100, f2: 90 },
      { f1: 20, f2: 30 },
    ]);

    const r = await chamar('/api/cotacoes/' + id + '/escolhas', {
      metodo: 'POST',
      token: comprador,
      corpo: {
        escolhas: [
          { bidItemId: itensBid[0].id, bidFornecedorId: convidados[1].id },
          { bidItemId: itensBid[1].id, bidFornecedorId: convidados[0].id },
        ],
      },
    });

    assert.equal(r.status, 200);

    const eq = await chamar('/api/cotacoes/' + id + '/equalizacao', { token: comprador });
    assert.equal(eq.corpo.escolhas[itensBid[0].id], convidados[1].id);
    assert.equal(eq.corpo.escolhas[itensBid[1].id], convidados[0].id);
  });

  it('desfaz uma escolha', async () => {
    const { id, itensBid, convidados } = await pacoteComRespostas([
      { f1: 10, f2: 20 }, { f1: 10, f2: 20 },
    ]);

    await chamar('/api/cotacoes/' + id + '/escolhas', {
      metodo: 'POST', token: comprador,
      corpo: { escolhas: [{ bidItemId: itensBid[0].id, bidFornecedorId: convidados[0].id }] },
    });

    await chamar('/api/cotacoes/' + id + '/escolhas', {
      metodo: 'POST', token: comprador,
      corpo: { escolhas: [{ bidItemId: itensBid[0].id, bidFornecedorId: null }] },
    });

    const eq = await chamar('/api/cotacoes/' + id + '/equalizacao', { token: comprador });
    assert.equal(eq.corpo.escolhas[itensBid[0].id], undefined);
  });

  it('recusa fornecedor que não cotou o item', async () => {
    const { id, itensBid, convidados } = await pacoteComRespostas([
      { f1: 100, f2: null },
      { f1: 20, f2: 30 },
    ]);

    // O convidado[1] marcou "não tenho" no primeiro item.
    const r = await chamar('/api/cotacoes/' + id + '/escolhas', {
      metodo: 'POST', token: comprador,
      corpo: { escolhas: [{ bidItemId: itensBid[0].id, bidFornecedorId: convidados[1].id }] },
    });

    assert.equal(r.status, 400);
    assert.ok(r.corpo.erro.includes('não cotou'));
  });
});

describe('Última chamada', () => {
  it('só vale para pacote encerrado', async () => {
    const { id } = await pacoteComRespostas([{ f1: 10, f2: 20 }, { f1: 10, f2: 20 }]);

    // Ainda aberto.
    const r = await chamar('/api/cotacoes/' + id + '/ultima-chamada', {
      metodo: 'POST', token: comprador, corpo: { novoPrazo: prazo(3) },
    });

    assert.equal(r.status, 409);
  });

  it('reabre o pacote numa nova rodada', async () => {
    const { id } = await pacoteComRespostas([{ f1: 10, f2: 20 }, { f1: 10, f2: 20 }]);
    await chamar('/api/cotacoes/' + id + '/encerrar', { metodo: 'POST', token: comprador });

    const r = await chamar('/api/cotacoes/' + id + '/ultima-chamada', {
      metodo: 'POST', token: comprador, corpo: { novoPrazo: prazo(3) },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.rodada, 2);

    const eq = await chamar('/api/cotacoes/' + id + '/equalizacao', { token: comprador });
    assert.equal(eq.corpo.cotacao.situacao, 'ABERTO');
    assert.equal(eq.corpo.cotacao.rodada, 2);
  });

  it('o link do fornecedor volta a funcionar', async () => {
    const { id, convidados } = await pacoteComRespostas([
      { f1: 10, f2: 20 }, { f1: 10, f2: 20 },
    ]);

    await chamar('/api/cotacoes/' + id + '/encerrar', { metodo: 'POST', token: comprador });

    const fechado = await chamar('/api/portal/' + convidados[0].token);
    assert.equal(fechado.status, 409);

    await chamar('/api/cotacoes/' + id + '/ultima-chamada', {
      metodo: 'POST', token: comprador, corpo: { novoPrazo: prazo(3) },
    });

    const reaberto = await chamar('/api/portal/' + convidados[0].token);
    assert.equal(reaberto.status, 200);
  });

  it('avisa quantos itens cada um está atrás', async () => {
    const { id } = await pacoteComRespostas([
      { f1: 100, f2: 90 },
      { f1: 20, f2: 30 },
    ]);

    await chamar('/api/cotacoes/' + id + '/encerrar', { metodo: 'POST', token: comprador });

    const r = await chamar('/api/cotacoes/' + id + '/ultima-chamada', {
      metodo: 'POST', token: comprador, corpo: { novoPrazo: prazo(3) },
    });

    // Cada um vence um item e perde o outro.
    assert.equal(r.corpo.avisos.length, 2);
    for (const a of r.corpo.avisos) {
      assert.equal(a.itensAtras, 1);
    }
  });

  it('recusa prazo no passado', async () => {
    const { id } = await pacoteComRespostas([{ f1: 10, f2: 20 }, { f1: 10, f2: 20 }]);
    await chamar('/api/cotacoes/' + id + '/encerrar', { metodo: 'POST', token: comprador });

    const ontem = new Date(Date.now() - 86400000).toISOString();

    const r = await chamar('/api/cotacoes/' + id + '/ultima-chamada', {
      metodo: 'POST', token: comprador, corpo: { novoPrazo: ontem },
    });

    assert.equal(r.status, 400);
  });
});

describe('Gerar os pedidos de compra', () => {
  async function pacoteDecidido(precos: Array<{ f1: number | null; f2: number | null }>) {
    const dados = await pacoteComRespostas(precos);

    await chamar('/api/cotacoes/' + dados.id + '/encerrar', {
      metodo: 'POST', token: comprador,
    });

    const eq = await chamar('/api/cotacoes/' + dados.id + '/equalizacao', { token: comprador });

    const escolhas = eq.corpo.comparativo.linhas
      .filter((l: { melhorFornecedorId: string | null }) => l.melhorFornecedorId)
      .map((l: { bidItemId: string; melhorFornecedorId: string }) => ({
        bidItemId: l.bidItemId,
        bidFornecedorId: l.melhorFornecedorId,
      }));

    await chamar('/api/cotacoes/' + dados.id + '/escolhas', {
      metodo: 'POST', token: comprador, corpo: { escolhas },
    });

    return dados;
  }

  it('bloqueia com o pacote ainda aberto', async () => {
    const { id } = await pacoteComRespostas([{ f1: 10, f2: 20 }, { f1: 10, f2: 20 }]);

    const r = await chamar('/api/cotacoes/' + id + '/gerar-pedidos', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 409);
    assert.ok(r.corpo.erro.includes('Encerre a cotação'));
  });

  it('bloqueia com item sem vencedor', async () => {
    const { id } = await pacoteComRespostas([{ f1: 10, f2: 20 }, { f1: 10, f2: 20 }]);
    await chamar('/api/cotacoes/' + id + '/encerrar', { metodo: 'POST', token: comprador });

    const r = await chamar('/api/cotacoes/' + id + '/gerar-pedidos', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 400);
    assert.ok(r.corpo.detalhes[0].includes('sem fornecedor escolhido'));
  });

  it('gera UM pedido quando um fornecedor vence tudo', async () => {
    const { id } = await pacoteDecidido([{ f1: 10, f2: 20 }, { f1: 10, f2: 20 }]);

    const r = await chamar('/api/cotacoes/' + id + '/gerar-pedidos', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.pedidos.length, 1);
    assert.match(r.corpo.pedidos[0].numero, /^PC-\d{5}$/);
  });

  it('gera DOIS pedidos quando a escolha se divide', async () => {
    const { id } = await pacoteDecidido([
      { f1: 100, f2: 90 },
      { f1: 20, f2: 30 },
    ]);

    const r = await chamar('/api/cotacoes/' + id + '/gerar-pedidos', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.corpo.pedidos.length, 2);
    assert.ok(r.corpo.mensagem.includes('um por fornecedor'));
  });

  it('o pacote vira CONCLUIDO e não gera de novo', async () => {
    const { id } = await pacoteDecidido([{ f1: 10, f2: 20 }, { f1: 10, f2: 20 }]);

    await chamar('/api/cotacoes/' + id + '/gerar-pedidos', {
      metodo: 'POST', token: comprador,
    });

    const eq = await chamar('/api/cotacoes/' + id + '/equalizacao', { token: comprador });
    assert.equal(eq.corpo.cotacao.situacao, 'CONCLUIDO');

    const segunda = await chamar('/api/cotacoes/' + id + '/gerar-pedidos', {
      metodo: 'POST', token: comprador,
    });
    assert.equal(segunda.status, 409);
  });

  it('não deixa trocar o vencedor depois de gerado', async () => {
    const { id, itensBid, convidados } = await pacoteDecidido([
      { f1: 10, f2: 20 }, { f1: 10, f2: 20 },
    ]);

    await chamar('/api/cotacoes/' + id + '/gerar-pedidos', {
      metodo: 'POST', token: comprador,
    });

    const r = await chamar('/api/cotacoes/' + id + '/escolhas', {
      metodo: 'POST', token: comprador,
      corpo: { escolhas: [{ bidItemId: itensBid[0].id, bidFornecedorId: convidados[1].id }] },
    });

    assert.equal(r.status, 409);
  });

  it('o pedido carrega o preço que venceu', async () => {
    const { id } = await pacoteDecidido([{ f1: 10, f2: 20 }, { f1: 10, f2: 20 }]);

    const gerados = await chamar('/api/cotacoes/' + id + '/gerar-pedidos', {
      metodo: 'POST', token: comprador,
    });

    // 10 × 10 + 5 × 10 = 150, sem frete neste caso.
    assert.equal(gerados.corpo.pedidos[0].total, 150);
  });
});

describe('PDF do pedido', () => {
  it('gera o arquivo', async () => {
    const dados = await pacoteComRespostas([{ f1: 10, f2: 20 }, { f1: 10, f2: 20 }]);

    await chamar('/api/cotacoes/' + dados.id + '/encerrar', {
      metodo: 'POST', token: comprador,
    });

    const eq = await chamar('/api/cotacoes/' + dados.id + '/equalizacao', { token: comprador });

    await chamar('/api/cotacoes/' + dados.id + '/escolhas', {
      metodo: 'POST', token: comprador,
      corpo: {
        escolhas: eq.corpo.comparativo.linhas.map(
          (l: { bidItemId: string; melhorFornecedorId: string }) => ({
            bidItemId: l.bidItemId,
            bidFornecedorId: l.melhorFornecedorId,
          }),
        ),
      },
    });

    const gerados = await chamar('/api/cotacoes/' + dados.id + '/gerar-pedidos', {
      metodo: 'POST', token: comprador,
    });

    const r = await chamar('/api/pedidos/' + gerados.corpo.pedidos[0].id + '/pdf', {
      token: comprador,
    });

    assert.equal(r.status, 200);
    assert.ok(r.tipo.includes('application/pdf'));
    assert.ok(r.tamanho > 1000);
  });

  it('quem não gerencia pedidos não baixa', async () => {
    const lista = await chamar('/api/pedidos', { token: comprador });
    const primeiro = lista.corpo.pedidos[0];

    const r = await chamar('/api/pedidos/' + primeiro.id + '/pdf', { token: solicitante });
    assert.equal(r.status, 403);
  });
});

describe('Lista de pedidos', () => {
  it('mostra origem, total e pagamento', async () => {
    const r = await chamar('/api/pedidos', { token: comprador });

    assert.equal(r.status, 200);
    assert.ok(r.corpo.pedidos.length > 0);

    const p = r.corpo.pedidos[0];
    assert.match(p.numeroFormatado, /^PC-/);
    assert.ok(p.origem.includes('BID-'));
    assert.ok(p.total > 0);
    assert.ok(p.pagamento.includes('30%'));
  });
});

describe('Um pedido inteiro', () => {
  // A tela de detalhe nao existia: havia a lista e o PDF, e mais
  // nada. Para ver o que tinha dentro de um pedido era preciso
  // baixar o arquivo. O dono reparou em 27/09/2026.
  async function primeiroPedido() {
    const lista = await chamar('/api/pedidos', { token: comprador });
    return lista.corpo.pedidos[0];
  }

  it('traz os itens com preço fechado', async () => {
    const { id } = await primeiroPedido();
    const r = await chamar('/api/pedidos/' + id, { token: comprador });

    assert.equal(r.status, 200);
    assert.ok(r.corpo.pedido.itens.length > 0);

    const item = r.corpo.pedido.itens[0];
    assert.ok(item.codigo);
    assert.ok(item.descricao);
    assert.ok(item.quantidade > 0);
    assert.ok(item.valorUnitario > 0);
    assert.ok(item.obra.codigo, 'o item diz para qual obra vai');
  });

  it('a conta do total fecha: itens + frete + outros', async () => {
    const { id } = await primeiroPedido();
    const { corpo } = await chamar('/api/pedidos/' + id, { token: comprador });
    const p = corpo.pedido;

    const somaDosItens = p.itens.reduce(
      (s: number, i: { quantidade: number; valorUnitario: number }) =>
        s + i.quantidade * i.valorUnitario,
      0,
    );

    assert.ok(Math.abs(p.subtotal - somaDosItens) < 0.01);
    assert.ok(Math.abs(p.total - (p.subtotal + p.frete + p.outrosCustos)) < 0.01);
  });

  it('fecha a corrente: solicitação, cotação e fornecedor', async () => {
    // É a pergunta que só esta tela responde: por que compramos
    // ISTO, deste fornecedor, por este preço.
    const { id } = await primeiroPedido();
    const { corpo } = await chamar('/api/pedidos/' + id, { token: comprador });
    const p = corpo.pedido;

    assert.ok(p.solicitacoes.length > 0);
    assert.match(p.solicitacoes[0].numeroFormatado, /^SOL-\d{5}$/);
    assert.match(p.cotacao.numeroFormatado, /^BID-\d{5}$/);
    assert.ok(p.cotacao.id, 'com o id, para a tela poder linkar');
    assert.ok(p.fornecedor.cnpj);
    assert.ok(p.fornecedor.razaoSocial);
  });

  it('a lista e o detalhe contam a mesma coisa', async () => {
    // Os dois saem da MESMA funcao no servidor. Se alguem separar
    // de novo, o total da lista e o do detalhe passam a divergir —
    // e e o mesmo documento que o fornecedor recebe.
    const resumo = await primeiroPedido();
    const { corpo } = await chamar('/api/pedidos/' + resumo.id, { token: comprador });

    assert.equal(corpo.pedido.numeroFormatado, resumo.numeroFormatado);
    assert.equal(corpo.pedido.total, resumo.total);
    assert.equal(corpo.pedido.pagamento, resumo.pagamento);
    assert.equal(corpo.pedido.itens.length, resumo.quantidadeItens);
  });

  it('pedido que não existe devolve 404, e não erro técnico', async () => {
    const r = await chamar('/api/pedidos/00000000-0000-0000-0000-000000000000', {
      token: comprador,
    });

    assert.equal(r.status, 404);
  });

  it('quem não cuida de compra nem de dinheiro não abre', async () => {
    const { id } = await primeiroPedido();
    const r = await chamar('/api/pedidos/' + id, { token: solicitante });

    assert.equal(r.status, 403);
  });
});
