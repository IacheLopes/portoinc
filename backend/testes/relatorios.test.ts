// ============================================================
//  Testes da Etapa 11 - Relatórios
//
//  Aqui o que se testa é a LIGAÇÃO: o número que aparece na tela
//  saiu mesmo do que aconteceu no sistema. As contas em si já
//  têm testes próprios em src/servicos/relatorios.test.ts.
//
//  Por isso cada teste faz o caminho inteiro de uma compra de
//  verdade — solicitar, aprovar, cotar, pedir, receber — e só
//  então confere o relatório.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let comprador = '';
let solicitante = '';
let gestor = '';
let almoxarife = '';
let semPermissao = '';

let obraId = '';
let outraObraId = '';
let familiaId = '';
let materialA = '';
let materialB = '';
let fornecedorRapido = '';
let fornecedorCaro = '';

function prazo(dias = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

interface Roteiro {
  obra?: string;
  /** Quantidade de cada item. */
  quantidade?: number;
  /** Quanto o solicitante achou que ia custar, por unidade. */
  estimado?: number;
  /** Preço do fornecedor que vai vencer. */
  preco?: number;
  /** Preço do segundo convidado. Nulo: ele não responde. */
  precoDoOutro?: number | null;
  /** Dias prometidos na cotação. */
  prazoEntrega?: number;
  /** Como a carga foi conferida. Nulo: ainda não chegou. */
  comoChegou?: 'CONFORME' | 'COM_RESSALVA' | 'DEVOLVIDO' | null;
  /** Aponta os itens nesta linha do orçamento. */
  linhaOrcamentoId?: string | null;
}

/**
 * Faz uma compra inteira e devolve o que foi criado.
 *
 * Passa por todas as telas na ordem real: é isso que garante que
 * o relatório está lendo dados que o sistema mesmo produziu, e
 * não um cenário montado à mão no banco.
 */
async function comprar(r: Roteiro = {}) {
  const {
    obra = obraId,
    quantidade = 10,
    // 90, e nao 100: dois itens de 10 unidades dariam R$ 2.000, que é
    // exatamente a fronteira entre a primeira e a segunda faixa de
    // alçada. Teste de relatório não deve depender de onde a fronteira
    // está — R$ 1.800 fica longe dela.
    estimado = 90,
    preco = 90,
    precoDoOutro = 120,
    prazoEntrega = 7,
    comoChegou = 'CONFORME',
    linhaOrcamentoId = null,
  } = r;

  const criada = await chamar('/api/solicitacoes', {
    metodo: 'POST', token: solicitante,
    corpo: {
      obraId: obra,
      itens: [
        {
          materialId: materialA, quantidade, valorEstimado: estimado,
          especificacaoTecnica: 'Padrão.',
          ...(linhaOrcamentoId ? { linhaOrcamentoId } : {}),
        },
        {
          materialId: materialB, quantidade, valorEstimado: estimado,
          especificacaoTecnica: 'Padrão.',
          ...(linhaOrcamentoId ? { linhaOrcamentoId } : {}),
        },
      ],
    },
  });

  const solicitacaoId = criada.corpo.solicitacao.id as string;

  await chamar('/api/solicitacoes/' + solicitacaoId + '/enviar', {
    metodo: 'POST', token: solicitante,
  });
  await chamar('/api/aprovacoes/' + solicitacaoId + '/decidir', {
    metodo: 'POST', token: gestor, corpo: { decisao: 'APROVADA' },
  });

  const detalhe = await chamar('/api/solicitacoes/' + solicitacaoId, { token: solicitante });
  const itens = detalhe.corpo.solicitacao.itens.map((i: { id: string }) => i.id);

  const bid = await chamar('/api/cotacoes', {
    metodo: 'POST', token: comprador,
    corpo: { titulo: 'Pacote de teste', prazoResposta: prazo(), itens },
  });
  const bidId = bid.corpo.cotacao.id as string;

  await chamar('/api/cotacoes/' + bidId + '/fornecedores', {
    metodo: 'POST', token: comprador,
    corpo: { fornecedores: [fornecedorRapido, fornecedorCaro] },
  });

  const aberto = await chamar('/api/cotacoes/' + bidId + '/abrir', {
    metodo: 'POST', token: comprador,
  });
  const cotacao = aberto.corpo.cotacao;

  const vencedor = cotacao.convidados.find(
    (c: { fornecedor: { id: string } }) => c.fornecedor.id === fornecedorRapido,
  );
  const outro = cotacao.convidados.find(
    (c: { fornecedor: { id: string } }) => c.fornecedor.id === fornecedorCaro,
  );

  await chamar('/api/portal/' + vencedor.token, {
    metodo: 'POST',
    corpo: {
      itens: cotacao.itens.map((i: { id: string }) => ({
        bidItemId: i.id, disponivel: true,
        valorUnitario: preco, prazoEntregaDias: prazoEntrega,
      })),
    },
  });

  if (precoDoOutro !== null) {
    await chamar('/api/portal/' + outro.token, {
      metodo: 'POST',
      corpo: {
        itens: cotacao.itens.map((i: { id: string }) => ({
          bidItemId: i.id, disponivel: true,
          valorUnitario: precoDoOutro, prazoEntregaDias: prazoEntrega + 3,
        })),
      },
    });
  }

  await chamar('/api/cotacoes/' + bidId + '/encerrar', { metodo: 'POST', token: comprador });

  await chamar('/api/cotacoes/' + bidId + '/escolhas', {
    metodo: 'POST', token: comprador,
    corpo: {
      escolhas: cotacao.itens.map((i: { id: string }) => ({
        bidItemId: i.id, bidFornecedorId: vencedor.id,
      })),
    },
  });

  const gerados = await chamar('/api/cotacoes/' + bidId + '/gerar-pedidos', {
    metodo: 'POST', token: comprador,
  });
  const pedido = gerados.corpo.pedidos[0];

  if (comoChegou !== null) {
    const paraConferir = await chamar('/api/recebimentos/pedido/' + pedido.numero, {
      token: almoxarife,
    });

    const devolvido = comoChegou === 'DEVOLVIDO';

    await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId: pedido.id,
        almoxarifadoId: paraConferir.corpo.almoxarifados[0].id,
        itens: paraConferir.corpo.itens.map((i: { pedidoItemId: string; saldo: number }) => ({
          pedidoItemId: i.pedidoItemId,
          quantidadeRecebida: devolvido ? i.saldo - 1 : i.saldo,
          quantidadeDevolvida: devolvido ? 1 : 0,
          situacao: comoChegou,
          motivo: comoChegou === 'CONFORME' ? undefined : 'Motivo registrado no teste.',
        })),
      },
    });
  }

  return { solicitacaoId, bidId, pedidoId: pedido.id as string, numero: pedido.numero as string };
}

before(async () => {
  await limparDados();

  await criarUsuarioTeste('admin11@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('comprador11@teste.com.br', ['COMPRADOR']);
  await criarUsuarioTeste('solicitante11@teste.com.br', ['SOLICITANTE']);
  await criarUsuarioTeste('gestor11@teste.com.br', ['GESTOR_OBRA']);
  await criarUsuarioTeste('almox11@teste.com.br', ['ALMOXARIFE']);

  admin = await entrarComo('admin11@teste.com.br');
  comprador = await entrarComo('comprador11@teste.com.br');
  solicitante = await entrarComo('solicitante11@teste.com.br');
  gestor = await entrarComo('gestor11@teste.com.br');
  almoxarife = await entrarComo('almox11@teste.com.br');

  // O almoxarife não tem "relatorios.ver": serve de porteiro.
  semPermissao = almoxarife;

  const familia = await chamar('/api/familias', {
    metodo: 'POST', token: admin, corpo: { codigo: 'REL', nome: 'Família do relatório' },
  });
  familiaId = familia.corpo.familia.id;

  const a = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId, codigoInterno: 'REL-A',
      descricao: 'Cimento do relatório saco 50kg', unidadeMedida: 'SC',
    },
  });
  materialA = a.corpo.material.id;

  const b = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId, codigoInterno: 'REL-B',
      descricao: 'Areia do relatório m3', unidadeMedida: 'M3',
    },
  });
  materialB = b.corpo.material.id;

  const f1 = await chamar('/api/fornecedores', {
    metodo: 'POST', token: admin,
    corpo: {
      razaoSocial: 'Fornecedor Rápido Ltda', cnpj: '05570714000159',
      nomeFantasia: 'Rápido', whatsapp: '5511911111111', familias: [familiaId],
    },
  });
  fornecedorRapido = f1.corpo.fornecedor.id;

  const f2 = await chamar('/api/fornecedores', {
    metodo: 'POST', token: admin,
    corpo: {
      razaoSocial: 'Fornecedor Caro Ltda', cnpj: '19131243000197',
      nomeFantasia: 'Caro', whatsapp: '5511922222222', familias: [familiaId],
    },
  });
  fornecedorCaro = f2.corpo.fornecedor.id;

  const obra = await chamar('/api/obras', {
    metodo: 'POST', token: admin, corpo: { codigo: 'OB-REL', nome: 'Obra do relatório' },
  });
  obraId = obra.corpo.obra.id;

  const outra = await chamar('/api/obras', {
    metodo: 'POST', token: admin, corpo: { codigo: 'OB-REL2', nome: 'Outra obra' },
  });
  outraObraId = outra.corpo.obra.id;
});

after(encerrar);

// ============================================================
//  Quem pode ver
// ============================================================

describe('Permissão', () => {
  it('sem "relatorios.ver" o acesso é negado', async () => {
    for (const rota of ['orcamento', 'economia', 'fornecedores', 'tempos', 'consumo']) {
      const r = await chamar('/api/relatorios/' + rota, { token: semPermissao });
      assert.equal(r.status, 403, 'a rota /' + rota + ' deveria recusar');
    }
  });

  it('sem entrar no sistema também é negado', async () => {
    const r = await chamar('/api/relatorios/orcamento');
    assert.equal(r.status, 401);
  });

  it('o comprador vê todos os relatórios', async () => {
    for (const rota of ['orcamento', 'economia', 'fornecedores', 'tempos', 'consumo']) {
      const r = await chamar('/api/relatorios/' + rota, { token: comprador });
      assert.equal(r.status, 200, 'a rota /' + rota + ' deveria abrir');
    }
  });
});

// ============================================================
//  1. Orçado × realizado
// ============================================================

describe('Orçado x realizado', () => {
  it('a compra apontada cai na linha certa do orçamento', async () => {
    const linha = await chamar('/api/obras/' + obraId + '/linhas', {
      metodo: 'POST', token: admin,
      corpo: {
        codigo: '01.01', descricao: 'Fundação', unidade: 'VB',
        quantidadePrevista: 1, valorUnitarioPrevisto: 10000,
      },
    });
    const linhaId = linha.corpo.linha.id as string;

    // 2 itens x 10 unidades x R$ 90 = R$ 1.800
    await comprar({ linhaOrcamentoId: linhaId, quantidade: 10, preco: 90 });

    const r = await chamar('/api/relatorios/orcamento?obraId=' + obraId, { token: admin });
    const achada = r.corpo.linhas.find((l: { codigo: string }) => l.codigo === '01.01');

    assert.equal(r.status, 200);
    assert.equal(achada.previsto, 10000);
    assert.equal(achada.realizado, 1800);
    assert.equal(achada.saldo, 8200);
    assert.equal(achada.situacao, 'FOLGADO');
  });

  it('compra sem apontamento aparece separada, e o total continua fechando', async () => {
    await comprar({ obra: outraObraId, quantidade: 5, preco: 40 });

    const r = await chamar('/api/relatorios/orcamento?obraId=' + outraObraId, { token: admin });
    const sobra = r.corpo.linhas.find((l: { codigo: string }) => l.codigo === '(sem linha)');

    // 2 itens x 5 x R$ 40 = R$ 400
    assert.equal(r.corpo.foraDoOrcamento, 400);
    assert.ok(sobra, 'a linha "(sem linha)" precisa existir');
    assert.equal(sobra.realizado, 400);
    assert.equal(sobra.situacao, 'SEM_PREVISAO');
    assert.equal(
      r.corpo.resumo.realizado, 400,
      'esconder a compra sem apontamento faria o total mentir',
    );
  });

  it('cada obra enxerga só o que é dela', async () => {
    const daObra = await chamar('/api/relatorios/orcamento?obraId=' + obraId, { token: admin });
    const daOutra = await chamar('/api/relatorios/orcamento?obraId=' + outraObraId, { token: admin });

    assert.notEqual(daObra.corpo.resumo.realizado, daOutra.corpo.resumo.realizado);
    assert.equal(daObra.corpo.obra.codigo, 'OB-REL');
    assert.equal(daOutra.corpo.obra.codigo, 'OB-REL2');
  });

  it('sem escolher obra, abre a primeira da lista', async () => {
    const r = await chamar('/api/relatorios/orcamento', { token: admin });

    assert.equal(r.status, 200);
    assert.ok(r.corpo.obraId, 'precisa escolher uma obra sozinho');
    assert.ok(r.corpo.obras.length >= 2);
  });
});

// ============================================================
//  2. Economia nas cotações
// ============================================================

describe('Economia nas cotações', () => {
  it('mede a economia e o ganho contra a proposta mais cara', async () => {
    await limparCompras();

    // Estimado 2 x 9 x R$ 100 = 1.800
    // Fechado  2 x 9 x R$  80 = 1.440  -> economia 360
    // Pior     2 x 9 x R$ 130 = 2.340  -> ganho    900
    //
    // Nove, e não dez: dez daria R$ 2.000, a fronteira entre a
    // primeira e a segunda faixa de alçada.
    await comprar({ quantidade: 9, estimado: 100, preco: 80, precoDoOutro: 130 });

    const r = await chamar('/api/relatorios/economia', { token: admin });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.resumo.cotacoes, 1);
    assert.equal(r.corpo.resumo.estimado, 1800);
    assert.equal(r.corpo.resumo.fechado, 1440);
    assert.equal(r.corpo.resumo.economia, 360);
    assert.equal(r.corpo.resumo.ganhoNaDisputa, 900);
  });

  it('quem foi convidado e não respondeu derruba a taxa de resposta', async () => {
    await limparCompras();
    await comprar({ precoDoOutro: null });

    const r = await chamar('/api/relatorios/economia', { token: admin });

    assert.equal(r.corpo.cotacoes[0].fornecedoresConvidados, 2);
    assert.equal(r.corpo.cotacoes[0].fornecedoresResponderam, 1);
    assert.equal(r.corpo.cotacoes[0].taxaDeResposta, 50);
  });

  it('fechar acima do estimado vira economia negativa', async () => {
    await limparCompras();
    await comprar({ estimado: 50, preco: 90, precoDoOutro: 95 });

    const r = await chamar('/api/relatorios/economia', { token: admin });

    assert.ok(r.corpo.resumo.economia < 0, 'pagar mais que o estimado não é economia');
  });
});

// ============================================================
//  3. Desempenho do fornecedor
// ============================================================

describe('Desempenho do fornecedor', () => {
  it('conta convite, resposta, pedido e entrega de quem venceu', async () => {
    await limparCompras();
    await comprar({ prazoEntrega: 7, comoChegou: 'CONFORME' });

    const r = await chamar('/api/relatorios/fornecedores', { token: admin });
    const rapido = r.corpo.fornecedores.find((f: { nome: string }) => f.nome === 'Rápido');
    const caro = r.corpo.fornecedores.find((f: { nome: string }) => f.nome === 'Caro');

    assert.equal(rapido.convites, 1);
    assert.equal(rapido.respostas, 1);
    assert.equal(rapido.pedidos, 1);
    // UMA entrega: um caminhão, com dois itens dentro.
    //
    // Esta linha dizia 2, com o comentário "dois itens conferidos".
    // Fixava o defeito como se fosse a regra — e é por isso que
    // nenhum teste pegou quando o relatório deu veredito sobre um
    // fornecedor de uma compra só.
    assert.equal(rapido.entregas, 1, 'um caminhão, ainda que com dois itens');
    assert.equal(rapido.qualidade, 100);

    // O perdedor foi convidado e respondeu, mas não vendeu nada.
    assert.equal(caro.convites, 1);
    assert.equal(caro.pedidos, 0);
    assert.equal(caro.valorComprado, 0);
  });

  it('ressalva derruba a qualidade sem derrubar a pontualidade', async () => {
    await limparCompras();
    await comprar({ comoChegou: 'COM_RESSALVA' });

    const r = await chamar('/api/relatorios/fornecedores', { token: admin });
    const rapido = r.corpo.fornecedores.find((f: { nome: string }) => f.nome === 'Rápido');

    // Uma entrega com ressalva, e não duas: os dois itens vieram
    // no mesmo caminhão. A entrega inteira é que veio com problema.
    assert.equal(rapido.ressalvas, 1);
    assert.equal(rapido.qualidade, 0);
    assert.equal(rapido.pontualidade, 100, 'chegou no prazo, só veio com problema');
  });

  it('dois caminhões do mesmo pedido são DUAS entregas, não três', async () => {
    // O defeito que o dono achou lendo o PDF, em 28/09/2026.
    //
    // O relatório contava LINHAS DE ITEM conferidas. Um caminhão
    // com dois itens e outro com o saldo de um deles davam 3 — e 3
    // é o limiar a partir do qual o sistema se permite opinar. A
    // trava que existe para ele não julgar com pouco dado foi
    // furada por um número que não era de entrega, e o relatório
    // escreveu "Cumpre prazo e entrega certo" sobre UMA compra.
    await limparCompras();
    const { pedidoId, numero } = await comprar({ comoChegou: null, quantidade: 10 });

    const paraConferir = await chamar('/api/recebimentos/pedido/' + numero, { token: almoxarife });
    const almoxarifadoId = paraConferir.corpo.almoxarifados[0].id;
    const itens = paraConferir.corpo.itens as Array<{ pedidoItemId: string; saldo: number }>;

    // Primeiro caminhão: os dois itens, um deles pela metade.
    await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId, almoxarifadoId,
        itens: [
          { pedidoItemId: itens[0].pedidoItemId, quantidadeRecebida: itens[0].saldo - 4, situacao: 'CONFORME' },
          { pedidoItemId: itens[1].pedidoItemId, quantidadeRecebida: itens[1].saldo, situacao: 'CONFORME' },
        ],
      },
    });

    // Segundo caminhão: o saldo do primeiro item.
    await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId, almoxarifadoId,
        itens: [
          { pedidoItemId: itens[0].pedidoItemId, quantidadeRecebida: 4, situacao: 'CONFORME' },
        ],
      },
    });

    const r = await chamar('/api/relatorios/fornecedores', { token: admin });
    const rapido = r.corpo.fornecedores.find((f: { nome: string }) => f.nome === 'Rápido');

    assert.equal(rapido.entregas, 2, 'dois caminhões — três linhas de item não são três entregas');
    assert.match(
      rapido.leitura,
      /pouco para concluir/,
      'com duas entregas o sistema NÃO pode dar veredito',
    );
  });

  it('uma entrega só vira ruim se algum item dela vier ruim', async () => {
    // Ao juntar os itens de um caminhão, a entrega herda o pior
    // deles: um item com ressalva no meio de cinco perfeitos não
    // faz uma entrega perfeita.
    await limparCompras();
    const { pedidoId, numero } = await comprar({ comoChegou: null, quantidade: 10 });

    const paraConferir = await chamar('/api/recebimentos/pedido/' + numero, { token: almoxarife });
    const itens = paraConferir.corpo.itens as Array<{ pedidoItemId: string; saldo: number }>;

    await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId,
        almoxarifadoId: paraConferir.corpo.almoxarifados[0].id,
        itens: [
          { pedidoItemId: itens[0].pedidoItemId, quantidadeRecebida: itens[0].saldo, situacao: 'CONFORME' },
          {
            pedidoItemId: itens[1].pedidoItemId,
            quantidadeRecebida: itens[1].saldo,
            situacao: 'COM_RESSALVA',
            motivo: 'Saco rasgado no canto.',
          },
        ],
      },
    });

    const r = await chamar('/api/relatorios/fornecedores', { token: admin });
    const rapido = r.corpo.fornecedores.find((f: { nome: string }) => f.nome === 'Rápido');

    assert.equal(rapido.entregas, 1);
    assert.equal(rapido.ressalvas, 1, 'a entrega inteira conta como problemática');
    assert.equal(rapido.qualidade, 0);
  });

  it('o frete é dinheiro que foi para o fornecedor', async () => {
    // O relatório dizia R$ 2.900 quando o Marquilip recebeu
    // R$ 3.000. Somava só os itens.
    await limparCompras();
    await comprar({ quantidade: 10, preco: 90 });

    const r = await chamar('/api/relatorios/fornecedores', { token: admin });
    const rapido = r.corpo.fornecedores.find((f: { nome: string }) => f.nome === 'Rápido');

    // 2 itens × 10 × R$ 90 = R$ 1.800, e o portal do teste não
    // informa frete: sem frete, o número não pode mudar.
    assert.equal(rapido.valorComprado, 1800);
  });

  it('com poucas entregas a leitura não dá veredito', async () => {
    await limparCompras();
    await comprar({ comoChegou: 'DEVOLVIDO' });

    const r = await chamar('/api/relatorios/fornecedores', { token: admin });
    const rapido = r.corpo.fornecedores.find((f: { nome: string }) => f.nome === 'Rápido');

    // Um caminhão com devolução nos dois itens é UMA entrega
    // devolvida. Dizia 2 porque contava linha de item.
    assert.equal(rapido.devolucoes, 1);
    assert.match(rapido.leitura, /Só 1 entrega até agora/);
  });

  it('pedido ainda não entregue não conta como entrega', async () => {
    await limparCompras();
    await comprar({ comoChegou: null });

    const r = await chamar('/api/relatorios/fornecedores', { token: admin });
    const rapido = r.corpo.fornecedores.find((f: { nome: string }) => f.nome === 'Rápido');

    assert.equal(rapido.pedidos, 1);
    assert.equal(rapido.entregas, 0);
    assert.match(rapido.leitura, /ainda não entregou/);
  });
});

// ============================================================
//  4. Tempo do processo
// ============================================================

describe('Tempo do processo', () => {
  it('conta as etapas por onde a solicitação já passou', async () => {
    await limparCompras();
    await comprar();

    const r = await chamar('/api/relatorios/tempos', { token: admin });
    const porNome = new Map(
      r.corpo.etapas.map((e: { etapa: string; amostra: number }) => [e.etapa, e.amostra]),
    );

    assert.equal(r.status, 200);
    assert.equal(r.corpo.etapas.length, 5);
    assert.equal(porNome.get('Montar o pedido'), 1);
    assert.equal(porNome.get('Aprovação'), 1);
    assert.equal(porNome.get('Entrega'), 1);
  });

  it('solicitação que ainda não chegou fica fora da média de entrega', async () => {
    await limparCompras();
    await comprar({ comoChegou: null });

    const r = await chamar('/api/relatorios/tempos', { token: admin });
    const entrega = r.corpo.etapas.find((e: { etapa: string }) => e.etapa === 'Entrega');

    assert.equal(entrega.amostra, 0, 'contar o que não chegou daria uma média boa e falsa');
    assert.equal(r.corpo.total.amostra, 0);
  });

  it('tudo no mesmo dia não inventa gargalo', async () => {
    await limparCompras();
    await comprar();

    const r = await chamar('/api/relatorios/tempos', { token: admin });

    assert.equal(r.corpo.total.dias, 0);
    assert.equal(r.corpo.total.maisDemorada, null);
  });

  it('o filtro de obra separa as solicitações', async () => {
    await limparCompras();
    await comprar({ obra: obraId });
    await comprar({ obra: outraObraId });

    const todas = await chamar('/api/relatorios/tempos', { token: admin });
    const so = await chamar('/api/relatorios/tempos?obraId=' + outraObraId, { token: admin });

    assert.equal(todas.corpo.solicitacoes, 2);
    assert.equal(so.corpo.solicitacoes, 1);
  });
});

// ============================================================
//  5. Consumo
// ============================================================

describe('Consumo por família e material', () => {
  it('agrupa por família e soma o que foi comprado', async () => {
    await limparCompras();
    await comprar({ quantidade: 10, preco: 90 });

    const r = await chamar('/api/relatorios/consumo', { token: admin });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.total, 1800);
    assert.equal(r.corpo.familias.length, 1);
    assert.equal(r.corpo.familias[0].nome, 'Família do relatório');
    assert.equal(r.corpo.familias[0].itens, 2, 'dois materiais diferentes');
    assert.equal(r.corpo.familias[0].participacao, 100);
  });

  it('o mesmo material comprado duas vezes vira uma linha só', async () => {
    await limparCompras();
    await comprar({ quantidade: 10, preco: 90 });
    await comprar({ quantidade: 5, preco: 90 });

    const r = await chamar('/api/relatorios/consumo', { token: admin });
    const cimento = r.corpo.materiais.find((m: { codigo: string }) => m.codigo === 'REL-A');

    assert.equal(r.corpo.materiais.length, 2);
    assert.equal(cimento.quantidade, 15);
    assert.equal(cimento.valor, 1350);
    assert.equal(cimento.precoMedio, 90);
  });

  it('pedido cancelado sai da conta', async () => {
    await limparCompras();
    const { pedidoId } = await comprar({ quantidade: 10, preco: 90, comoChegou: null });

    const antes = await chamar('/api/relatorios/consumo', { token: admin });
    assert.equal(antes.corpo.total, 1800);

    // Ainda não existe tela de cancelar pedido (fica para a
    // Etapa 12). O que este teste precisa provar é o relatório:
    // pedido cancelado não pode contar como compra.
    const { banco } = await import('../src/plugins/banco.js');
    await banco.pedido.update({ where: { id: pedidoId }, data: { situacao: 'CANCELADO' } });

    const depois = await chamar('/api/relatorios/consumo', { token: admin });
    assert.equal(depois.corpo.total, 0, 'compra cancelada não é compra');
  });
});

// ============================================================
//  Exportação para planilha
// ============================================================

describe('Baixar o relatório', () => {
  it('todo relatório sai em PDF', async () => {
    await limparCompras();
    await comprar({ quantidade: 10, preco: 90 });

    for (const rota of ['orcamento', 'economia', 'fornecedores', 'tempos', 'consumo']) {
      const r = await chamar('/api/relatorios/' + rota + '?formato=pdf', { token: admin });

      assert.equal(r.status, 200, 'o PDF de /' + rota + ' deveria sair');
      assert.equal(r.tipo, 'application/pdf', 'tipo errado em /' + rota);
      assert.equal(
        r.bruto.subarray(0, 4).toString('latin1'), '%PDF',
        'o arquivo de /' + rota + ' não é um PDF de verdade',
      );
      assert.match(r.anexo, /attachment; filename=".+\.pdf"/);
    }
  });

  it('todo relatório sai em Word', async () => {
    for (const rota of ['orcamento', 'economia', 'fornecedores', 'tempos', 'consumo']) {
      const r = await chamar('/api/relatorios/' + rota + '?formato=docx', { token: admin });

      assert.equal(r.status, 200, 'o Word de /' + rota + ' deveria sair');
      assert.match(r.tipo, /wordprocessingml/, 'tipo errado em /' + rota);
      // .docx é um ZIP: começa com "PK".
      assert.equal(r.bruto.subarray(0, 2).toString('latin1'), 'PK', 'em /' + rota);
      assert.match(r.anexo, /attachment; filename=".+\.docx"/);
    }
  });

  it('o arquivo respeita o filtro de obra', async () => {
    await limparCompras();
    await comprar({ obra: obraId, quantidade: 10, preco: 90 });

    const comCompra = await chamar(
      '/api/relatorios/consumo?formato=pdf&obraId=' + obraId, { token: admin },
    );
    const semCompra = await chamar(
      '/api/relatorios/consumo?formato=pdf&obraId=' + outraObraId, { token: admin },
    );

    assert.equal(comCompra.status, 200);
    assert.equal(semCompra.status, 200);
    assert.ok(
      comCompra.tamanho > semCompra.tamanho,
      'a obra sem compra nenhuma tem de gerar um arquivo menor',
    );
  });

  it('formato que não existe é recusado', async () => {
    // Recusar é melhor que devolver um arquivo qualquer: quem
    // pediu "xlsx" e recebe um PDF renomeado só descobre o erro
    // quando o arquivo não abre.
    for (const ruim of ['csv', 'xlsx', 'txt', 'exe']) {
      const r = await chamar('/api/relatorios/consumo?formato=' + ruim, { token: admin });

      assert.equal(r.status, 400, 'o formato "' + ruim + '" deveria ser recusado');
      assert.match(r.corpo.erro, /pdf/);
    }
  });

  it('sem formato, continua devolvendo os dados para a tela', async () => {
    const r = await chamar('/api/relatorios/consumo', { token: admin });

    assert.equal(r.status, 200);
    assert.match(r.tipo, /application\/json/);
    assert.ok(Array.isArray(r.corpo.materiais));
  });
});

/**
 * Apaga as compras entre um teste e outro.
 *
 * Cada bloco monta o seu próprio cenário: sem isto, o que o
 * teste anterior comprou entraria na soma do seguinte e a
 * ordem de execução passaria a importar.
 */
async function limparCompras() {
  const { banco } = await import('../src/plugins/banco.js');

  // A ordem é a do fim para o começo do fluxo. O item do pacote
  // aponta para a cotação vencedora e a cotação aponta de volta
  // para o item: essa volta precisa ser desfeita antes, senão o
  // banco recusa a exclusão.
  await banco.movimentoEstoque.deleteMany({});
  await banco.saldoEstoque.deleteMany({});
  await banco.recebimentoItem.deleteMany({});
  await banco.recebimento.deleteMany({});
  await banco.pedidoItem.deleteMany({});
  await banco.pedido.deleteMany({});

  await banco.bidItem.updateMany({ data: { cotacaoVencedoraId: null } });
  await banco.bid.deleteMany({});

  await banco.aprovacao.deleteMany({});
  await banco.solicitacaoEvento.deleteMany({});
  await banco.solicitacaoItem.deleteMany({});
  await banco.solicitacao.deleteMany({});
}
