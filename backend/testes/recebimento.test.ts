// ============================================================
//  Testes da Etapa 7 - Recebimento no almoxarifado
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let comprador = '';
let solicitante = '';
let gestor = '';
let almoxarife = '';
let obraId = '';
let materialA = '';
let materialB = '';
let materialServico = '';
let fornecedor1 = '';

function prazo(dias = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

/**
 * Faz o caminho inteiro até existir um pedido de compra:
 * solicitação -> aprovação -> cotação -> resposta -> escolha.
 *
 * Devolve o número do pedido, que é por onde o almoxarife entra.
 */
async function pedidoPronto(quantidades: { a: number; b: number } = { a: 10, b: 5 }, materiais = [materialA, materialB]) {
  const criada = await chamar('/api/solicitacoes', {
    metodo: 'POST',
    token: solicitante,
    corpo: {
      obraId,
      dataDesejada: '2026-12-31',
      itens: [
        { materialId: materiais[0], quantidade: quantidades.a, valorEstimado: 10, especificacaoTecnica: 'Padrão.' },
        { materialId: materiais[1], quantidade: quantidades.b, valorEstimado: 10, especificacaoTecnica: 'Padrão.' },
      ],
    },
  });

  const solicitacaoId = criada.corpo.solicitacao.id;
  await chamar('/api/solicitacoes/' + solicitacaoId + '/enviar', { metodo: 'POST', token: solicitante });
  await chamar('/api/aprovacoes/' + solicitacaoId + '/decidir', {
    metodo: 'POST', token: gestor, corpo: { decisao: 'APROVADA' },
  });

  const detalhe = await chamar('/api/solicitacoes/' + solicitacaoId, { token: solicitante });
  const itens = detalhe.corpo.solicitacao.itens.map((i: { id: string }) => i.id);

  const bid = await chamar('/api/cotacoes', {
    metodo: 'POST', token: comprador,
    corpo: { titulo: 'Pacote do recebimento', prazoResposta: prazo(), itens },
  });
  const bidId = bid.corpo.cotacao.id;

  await chamar('/api/cotacoes/' + bidId + '/fornecedores', {
    metodo: 'POST', token: comprador, corpo: { fornecedores: [fornecedor1] },
  });

  const aberto = await chamar('/api/cotacoes/' + bidId + '/abrir', {
    metodo: 'POST', token: comprador,
  });

  const cot = aberto.corpo.cotacao;
  const convite = cot.convidados[0];

  await chamar('/api/portal/' + convite.token, {
    metodo: 'POST',
    corpo: {
      itens: cot.itens.map((item: { id: string }) => ({
        bidItemId: item.id,
        disponivel: true,
        // 12 contra os 10 estimados: 20% acima, o limite da
        // tolerância da alçada. Como os dois lados usam a mesma
        // quantidade, a proporção não muda quando o teste pede
        // quantidade maior, e a compra nunca sai da faixa que foi
        // assinada.
        //
        // Era 25. Com quantidade grande isso fechava R$ 2.750 em
        // cima de R$ 1.100 aprovados — de outra faixa de alçada —, e
        // o pedido saía assim mesmo. Este teste é de recebimento;
        // quem prova a regra da alçada é o de equalização.
        valorUnitario: 12,
        prazoEntregaDias: 5,
      })),
      valorFrete: 100,
      percentualEntrada: 30,
      quantidadeParcelas: 2,
      intervaloParcelasDias: 30,
    },
  });

  await chamar('/api/cotacoes/' + bidId + '/encerrar', { metodo: 'POST', token: comprador });

  await chamar('/api/cotacoes/' + bidId + '/escolhas', {
    metodo: 'POST', token: comprador,
    corpo: {
      escolhas: cot.itens.map((item: { id: string }) => ({
        bidItemId: item.id,
        bidFornecedorId: convite.id,
      })),
    },
  });

  const gerados = await chamar('/api/cotacoes/' + bidId + '/gerar-pedidos', {
    metodo: 'POST', token: comprador,
  });

  return {
    pedidoId: gerados.corpo.pedidos[0].id as string,
    numero: gerados.corpo.pedidos[0].numero as string,
    solicitacaoId: solicitacaoId as string,
  };
}

/** Abre o pedido na tela do almoxarife. */
async function abrirParaConferir(numero: string) {
  const r = await chamar('/api/recebimentos/pedido/' + numero, { token: almoxarife });
  return r;
}

before(async () => {
  await limparDados();

  await criarUsuarioTeste('admin7@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('comprador7@teste.com.br', ['COMPRADOR']);
  await criarUsuarioTeste('solicitante7@teste.com.br', ['SOLICITANTE']);
  await criarUsuarioTeste('gestor7@teste.com.br', ['GESTOR_OBRA']);
  await criarUsuarioTeste('almox7@teste.com.br', ['ALMOXARIFE']);

  admin = await entrarComo('admin7@teste.com.br');
  comprador = await entrarComo('comprador7@teste.com.br');
  solicitante = await entrarComo('solicitante7@teste.com.br');
  gestor = await entrarComo('gestor7@teste.com.br');
  almoxarife = await entrarComo('almox7@teste.com.br');

  const familia = await chamar('/api/familias', {
    metodo: 'POST', token: admin, corpo: { codigo: 'REC', nome: 'Recebimento' },
  });

  const a = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId: familia.corpo.familia.id, codigoInterno: 'RC-A',
      descricao: 'Cimento CP-II saco 50kg', unidadeMedida: 'SC',
      gtin: '7891234567895',
    },
  });
  materialA = a.corpo.material.id;

  const b = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId: familia.corpo.familia.id, codigoInterno: 'RC-B',
      descricao: 'Areia media m3', unidadeMedida: 'M3',
    },
  });
  materialB = b.corpo.material.id;

  // Um SERVIÇO. O BPMN da Porto Inc. diz que ele não entra no
  // estoque: não há o que guardar numa prateleira.
  const servico = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId: familia.corpo.familia.id, codigoInterno: 'RC-S',
      descricao: 'Instalacao eletrica ponto', unidadeMedida: 'UN',
      tipo: 'SERVICO',
    },
  });
  materialServico = servico.corpo.material.id;

  const f1 = await chamar('/api/fornecedores', {
    metodo: 'POST', token: admin,
    corpo: {
      razaoSocial: 'Fornecedor do Recebimento Ltda', cnpj: '05570714000159',
      whatsapp: '5511911111111', familias: [familia.corpo.familia.id],
    },
  });
  fornecedor1 = f1.corpo.fornecedor.id;

  const obra = await chamar('/api/obras', {
    metodo: 'POST', token: admin, corpo: { codigo: 'OB-RC', nome: 'Obra do recebimento' },
  });
  obraId = obra.corpo.obra.id;
});

after(encerrar);

describe('Achar o pedido', () => {
  it('encontra pelo número completo', async () => {
    const { numero } = await pedidoPronto();
    const r = await abrirParaConferir(numero);

    assert.equal(r.status, 200);
    assert.equal(r.corpo.pedido.numeroFormatado, numero);
    assert.equal(r.corpo.itens.length, 2);
  });

  it('encontra digitando só o número', async () => {
    const { numero } = await pedidoPronto();
    const so = numero.replace('PC-', '').replace(/^0+/, '');

    const r = await abrirParaConferir(so);

    assert.equal(r.status, 200);
    assert.equal(r.corpo.pedido.numeroFormatado, numero);
  });

  it('mostra o saldo de cada item', async () => {
    const { numero } = await pedidoPronto({ a: 30, b: 8 });
    const r = await abrirParaConferir(numero);

    const saldos = r.corpo.itens.map((i: { saldo: number }) => i.saldo);
    assert.deepEqual(saldos.sort((x: number, y: number) => x - y), [8, 30]);
  });

  it('traz os almoxarifados possíveis', async () => {
    const { numero } = await pedidoPronto();
    const r = await abrirParaConferir(numero);

    assert.ok(r.corpo.almoxarifados.length >= 1);
  });

  it('avisa quando o número não existe', async () => {
    const r = await abrirParaConferir('PC-99999');

    assert.equal(r.status, 404);
    assert.ok(r.corpo.erro.includes('PC-99999'));
  });

  it('avisa quando o texto não é um número de pedido', async () => {
    const r = await abrirParaConferir('abacaxi');

    assert.equal(r.status, 400);
    assert.ok(r.corpo.erro.includes('PC-00001'));
  });
});

describe('Marcar o pedido como enviado', () => {
  it('o comprador marca e o pedido sai do rascunho', async () => {
    const { pedidoId } = await pedidoPronto();

    const r = await chamar('/api/pedidos/' + pedidoId + '/enviar', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.situacao, 'ENVIADO');
  });

  it('não marca duas vezes', async () => {
    const { pedidoId } = await pedidoPronto();

    await chamar('/api/pedidos/' + pedidoId + '/enviar', { metodo: 'POST', token: comprador });
    const r = await chamar('/api/pedidos/' + pedidoId + '/enviar', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 409);
  });

  it('o almoxarife não marca pedido como enviado', async () => {
    const { pedidoId } = await pedidoPronto();

    const r = await chamar('/api/pedidos/' + pedidoId + '/enviar', {
      metodo: 'POST', token: almoxarife,
    });

    assert.equal(r.status, 403);
  });
});

describe('Registrar a entrega', () => {
  it('recebe tudo e o pedido fica RECEBIDO', async () => {
    const { pedidoId, numero } = await pedidoPronto();
    const aberto = await abrirParaConferir(numero);

    const r = await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId,
        almoxarifadoId: aberto.corpo.almoxarifados[0].id,
        notaFiscal: '12345',
        itens: aberto.corpo.itens.map((i: { pedidoItemId: string; saldo: number }) => ({
          pedidoItemId: i.pedidoItemId,
          quantidadeRecebida: i.saldo,
          quantidadeDevolvida: 0,
          situacao: 'CONFORME',
        })),
      },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.situacaoDoPedido, 'RECEBIDO');
    assert.match(r.corpo.recebimento.numeroFormatado, /^REC-\d{5}$/);
    assert.match(r.corpo.mensagem, /recebido por inteiro/);
  });

  it('entrega parcial deixa saldo e o pedido fica RECEBIDO_PARCIAL', async () => {
    const { pedidoId, numero } = await pedidoPronto({ a: 100, b: 10 });
    const aberto = await abrirParaConferir(numero);
    const primeiro = aberto.corpo.itens[0];

    const r = await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId,
        almoxarifadoId: aberto.corpo.almoxarifados[0].id,
        itens: [
          { pedidoItemId: primeiro.pedidoItemId, quantidadeRecebida: 40, situacao: 'CONFORME' },
        ],
      },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.situacaoDoPedido, 'RECEBIDO_PARCIAL');

    // O saldo daquele item caiu; o outro continua inteiro.
    const denovo = await abrirParaConferir(numero);
    const item = denovo.corpo.itens.find(
      (i: { pedidoItemId: string }) => i.pedidoItemId === primeiro.pedidoItemId,
    );

    assert.equal(item.quantidadeJaRecebida, 40);
    assert.equal(item.saldo, primeiro.saldo - 40);
  });

  it('não recebe mais do que o saldo', async () => {
    const { pedidoId, numero } = await pedidoPronto({ a: 10, b: 5 });
    const aberto = await abrirParaConferir(numero);
    const primeiro = aberto.corpo.itens[0];

    const r = await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId,
        almoxarifadoId: aberto.corpo.almoxarifados[0].id,
        itens: [
          {
            pedidoItemId: primeiro.pedidoItemId,
            quantidadeRecebida: primeiro.saldo + 1,
            situacao: 'CONFORME',
          },
        ],
      },
    });

    assert.equal(r.status, 400);
    assert.ok(r.corpo.detalhes[0].includes('saldo é de'));
  });

  it('ressalva sem motivo é recusada', async () => {
    const { pedidoId, numero } = await pedidoPronto();
    const aberto = await abrirParaConferir(numero);
    const primeiro = aberto.corpo.itens[0];

    const r = await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId,
        almoxarifadoId: aberto.corpo.almoxarifados[0].id,
        itens: [
          {
            pedidoItemId: primeiro.pedidoItemId,
            quantidadeRecebida: 1,
            situacao: 'COM_RESSALVA',
          },
        ],
      },
    });

    assert.equal(r.status, 400);
    assert.ok(r.corpo.detalhes[0].includes('motivo da ressalva'));
  });

  it('o que foi devolvido continua em aberto', async () => {
    const { pedidoId, numero } = await pedidoPronto({ a: 10, b: 5 });
    const aberto = await abrirParaConferir(numero);
    const primeiro = aberto.corpo.itens[0];

    await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId,
        almoxarifadoId: aberto.corpo.almoxarifados[0].id,
        itens: [
          {
            pedidoItemId: primeiro.pedidoItemId,
            quantidadeRecebida: primeiro.saldo - 3,
            quantidadeDevolvida: 3,
            situacao: 'COM_RESSALVA',
            motivo: 'Três sacos rasgados, voltaram no caminhão.',
          },
        ],
      },
    });

    const denovo = await abrirParaConferir(numero);
    const item = denovo.corpo.itens.find(
      (i: { pedidoItemId: string }) => i.pedidoItemId === primeiro.pedidoItemId,
    );

    // O fornecedor continua devendo os três devolvidos.
    assert.equal(item.saldo, 3);
  });

  it('não recebe duas vezes o pedido inteiro', async () => {
    const { pedidoId, numero } = await pedidoPronto();
    const aberto = await abrirParaConferir(numero);

    const corpo = {
      pedidoId,
      almoxarifadoId: aberto.corpo.almoxarifados[0].id,
      itens: aberto.corpo.itens.map((i: { pedidoItemId: string; saldo: number }) => ({
        pedidoItemId: i.pedidoItemId,
        quantidadeRecebida: i.saldo,
        situacao: 'CONFORME',
      })),
    };

    await chamar('/api/recebimentos', { metodo: 'POST', token: almoxarife, corpo });
    const r = await chamar('/api/recebimentos', { metodo: 'POST', token: almoxarife, corpo });

    assert.equal(r.status, 409);
    assert.ok(r.corpo.erro.includes('já foi recebido'));
  });

  it('recusa conferência sem nenhum item', async () => {
    const { pedidoId, numero } = await pedidoPronto();
    const aberto = await abrirParaConferir(numero);

    const r = await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId,
        almoxarifadoId: aberto.corpo.almoxarifados[0].id,
        itens: aberto.corpo.itens.map((i: { pedidoItemId: string }) => ({
          pedidoItemId: i.pedidoItemId,
          quantidadeRecebida: 0,
          situacao: 'CONFORME',
        })),
      },
    });

    assert.equal(r.status, 400);
    assert.ok(r.corpo.detalhes[0].includes('pelo menos um item'));
  });
});

describe('Histórico', () => {
  it('lista o que foi recebido, com a ressalva marcada', async () => {
    const { pedidoId, numero } = await pedidoPronto();
    const aberto = await abrirParaConferir(numero);
    const primeiro = aberto.corpo.itens[0];

    const criado = await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId,
        almoxarifadoId: aberto.corpo.almoxarifados[0].id,
        notaFiscal: '987',
        itens: [
          {
            pedidoItemId: primeiro.pedidoItemId,
            quantidadeRecebida: 1,
            situacao: 'COM_RESSALVA',
            motivo: 'Embalagem amassada.',
          },
        ],
      },
    });

    const lista = await chamar('/api/recebimentos', { token: almoxarife });
    const meu = lista.corpo.recebimentos.find(
      (r: { numeroFormatado: string }) =>
        r.numeroFormatado === criado.corpo.recebimento.numeroFormatado,
    );

    assert.ok(meu);
    assert.equal(meu.temRessalva, true);
    assert.equal(meu.notaFiscal, '987');

    const detalhe = await chamar('/api/recebimentos/' + criado.corpo.recebimento.id, {
      token: almoxarife,
    });

    assert.equal(detalhe.status, 200);
    assert.equal(detalhe.corpo.recebimento.itens[0].motivo, 'Embalagem amassada.');
  });
});

describe('Quem pode o quê', () => {
  it('o almoxarife enxerga o pedido pela tela de recebimento', async () => {
    const { numero } = await pedidoPronto();

    const r = await abrirParaConferir(numero);

    assert.equal(r.status, 200);
    assert.ok(r.corpo.pedido.fornecedor);
  });

  it('mas NÃO entra na tela de gestão de pedidos', async () => {
    const r = await chamar('/api/pedidos', { token: almoxarife });

    assert.equal(r.status, 403);
  });

  it('o solicitante não registra recebimento', async () => {
    const r = await chamar('/api/recebimentos/pedidos-abertos', { token: solicitante });

    assert.equal(r.status, 403);
  });

  it('a lista de pedidos abertos mostra o que falta chegar', async () => {
    const r = await chamar('/api/recebimentos/pedidos-abertos', { token: almoxarife });

    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.corpo.pedidos));
    assert.ok(r.corpo.pedidos.every((p: { itensPendentes: number }) => p.itensPendentes >= 0));
  });
});

// ============================================================
//  A solicitação fecha quando o material chega
// ============================================================

describe('A solicitação fecha quando o material chega', () => {
  it('recebendo tudo, a solicitação vira ATENDIDA', async () => {
    // O PASSO QUE FALTAVA no BPMN. Antes disto a SOL ficava "em
    // cotação" para sempre: o material chegava, entrava no estoque,
    // virava nota e virava conta paga, e a tela de quem pediu
    // continuava dizendo que estava em cotação.
    const { pedidoId, numero, solicitacaoId } = await pedidoPronto();
    const aberto = await abrirParaConferir(numero);

    const antes = await chamar('/api/solicitacoes/' + solicitacaoId, { token: solicitante });
    assert.equal(antes.corpo.solicitacao.situacao, 'EM_COTACAO');

    const r = await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId,
        almoxarifadoId: aberto.corpo.almoxarifados[0].id,
        itens: aberto.corpo.itens.map((i: { pedidoItemId: string; saldo: number }) => ({
          pedidoItemId: i.pedidoItemId,
          quantidadeRecebida: i.saldo,
          situacao: 'CONFORME',
        })),
      },
    });

    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.solicitacoesAtendidas, [solicitacaoId]);

    const depois = await chamar('/api/solicitacoes/' + solicitacaoId, { token: solicitante });
    assert.equal(depois.corpo.solicitacao.situacao, 'ATENDIDA');

    // E quem pediu descobre POR QUE, no histórico dele.
    const evento = depois.corpo.solicitacao.eventos.find(
      (e: { tipo: string }) => e.tipo === 'ATENDIDA',
    );
    assert.ok(evento, 'o histórico precisa contar que chegou');
    assert.match(evento.descricao, /chegou e foi conferido/);
  });

  it('entrega parcial NÃO fecha, mas avisa no histórico', async () => {
    // Saber que metade chegou também é informação — e é ela que
    // evita a ligação "e o resto?".
    const { pedidoId, numero, solicitacaoId } = await pedidoPronto();
    const aberto = await abrirParaConferir(numero);
    const primeiro = aberto.corpo.itens[0];

    const r = await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId,
        almoxarifadoId: aberto.corpo.almoxarifados[0].id,
        itens: [
          { pedidoItemId: primeiro.pedidoItemId, quantidadeRecebida: 1, situacao: 'CONFORME' },
        ],
      },
    });

    assert.deepEqual(r.corpo.solicitacoesAtendidas, [], 'ainda falta item');

    const depois = await chamar('/api/solicitacoes/' + solicitacaoId, { token: solicitante });
    assert.equal(depois.corpo.solicitacao.situacao, 'EM_COTACAO');

    const evento = depois.corpo.solicitacao.eventos.find(
      (e: { tipo: string }) => e.tipo === 'RECEBIMENTO',
    );
    assert.ok(evento);
    assert.match(evento.descricao, /Ainda falta item/);
  });
});

// ============================================================
//  Serviço não entra no estoque
// ============================================================

describe('Serviço não entra no estoque', () => {
  it('conferir um serviço NÃO cria saldo de prateleira', async () => {
    // "material entra no estoque (serviço não entra)", diz o BPMN.
    // O recebimento dava entrada em tudo, e uma instalação elétrica
    // contratada virava saldo — aparecendo depois no relatório de
    // estoque parado como dinheiro encostado num item que não
    // existe fisicamente.
    const { banco } = await import('../src/plugins/banco.js');

    const { pedidoId, numero } = await pedidoPronto(
      { a: 4, b: 3 },
      [materialServico, materialB],
    );
    const aberto = await abrirParaConferir(numero);

    await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId,
        almoxarifadoId: aberto.corpo.almoxarifados[0].id,
        itens: aberto.corpo.itens.map((i: { pedidoItemId: string; saldo: number }) => ({
          pedidoItemId: i.pedidoItemId,
          quantidadeRecebida: i.saldo,
          situacao: 'CONFORME',
        })),
      },
    });

    const doServico = await banco.saldoEstoque.findFirst({
      where: { materialId: materialServico },
    });
    assert.equal(doServico, null, 'serviço não tem prateleira');

    const movimento = await banco.movimentoEstoque.findFirst({
      where: { materialId: materialServico },
    });
    assert.equal(movimento, null, 'nem extrato de estoque');

    // O material do mesmo pedido entrou normalmente: o filtro é
    // por tipo de item, não "pedido com serviço não entra".
    const doMaterial = await banco.saldoEstoque.findFirst({
      where: { materialId: materialB },
    });
    assert.ok(doMaterial, 'o material do mesmo pedido tem de entrar');
  });
});

// ============================================================
//  "É o que eu pedi" — o passo 10 do BPMN
// ============================================================

describe('Validação do solicitante', () => {
  /** Recebe o pedido inteiro e devolve a solicitação já ATENDIDA. */
  async function solicitacaoAtendidaNoBanco() {
    const { pedidoId, numero, solicitacaoId } = await pedidoPronto();
    const aberto = await abrirParaConferir(numero);

    await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId,
        almoxarifadoId: aberto.corpo.almoxarifados[0].id,
        itens: aberto.corpo.itens.map((i: { pedidoItemId: string; saldo: number }) => ({
          pedidoItemId: i.pedidoItemId,
          quantidadeRecebida: i.saldo,
          situacao: 'CONFORME',
        })),
      },
    });

    return solicitacaoId;
  }

  it('quem pediu confirma que é o material certo', async () => {
    // O almoxarife confere a QUANTIDADE; quem pediu é que sabe se
    // veio a COISA certa — marca, bitola, resistência.
    const id = await solicitacaoAtendidaNoBanco();

    const r = await chamar('/api/solicitacoes/' + id + '/validar', {
      metodo: 'POST', token: solicitante,
      corpo: { observacao: 'Marca conferida na embalagem.' },
    });

    assert.equal(r.status, 200);
    assert.ok(r.corpo.solicitacao.validadaEm);
    assert.ok(r.corpo.solicitacao.validadaPor);

    const evento = r.corpo.solicitacao.eventos.find(
      (e: { tipo: string }) => e.tipo === 'VALIDADA',
    );
    assert.ok(evento, 'é o registro que responde "alguém conferiu isso?" meses depois');
    assert.match(evento.descricao, /Marca conferida/);
  });

  it('não valida duas vezes', async () => {
    const id = await solicitacaoAtendidaNoBanco();

    await chamar('/api/solicitacoes/' + id + '/validar', {
      metodo: 'POST', token: solicitante,
    });

    const segunda = await chamar('/api/solicitacoes/' + id + '/validar', {
      metodo: 'POST', token: solicitante,
    });

    assert.equal(segunda.status, 409);
  });

  it('não valida antes de o material chegar', async () => {
    const { solicitacaoId } = await pedidoPronto();

    const r = await chamar('/api/solicitacoes/' + solicitacaoId + '/validar', {
      metodo: 'POST', token: solicitante,
    });

    assert.equal(r.status, 409);
    assert.match(r.corpo.erro, /depois que o material chega/);
  });

  it('quem não pediu não valida pelos outros', async () => {
    // O almoxarife já disse o que sabia — a quantidade. Deixá-lo
    // assinar pelo solicitante transformaria as duas conferências
    // numa só, que é exatamente o que o BPMN separa.
    const id = await solicitacaoAtendidaNoBanco();

    const r = await chamar('/api/solicitacoes/' + id + '/validar', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 403);
  });
});
