// ============================================================
//  Testes da Etapa 8 - Estoque
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let comprador = '';
let solicitante = '';
let gestor = '';
let almoxarife = '';
let engenheiro = '';
let fundador = '';

let obraId = '';
let materialA = '';
let materialB = '';
let fornecedor1 = '';
let almoxarifadoObra = '';
let almoxarifadoCentral = '';
let familiaId = '';

/**
 * Aprova até a solicitação sair da fila.
 *
 * A faixa de R$ 2.000 a R$ 15.000 exige TODAS as assinaturas, e é
 * justamente nessa faixa que caem as compras de estoque de verdade.
 */
async function aprovarTudo(solicitacaoId: string) {
  for (let rodada = 0; rodada < 4; rodada++) {
    for (const token of [gestor, engenheiro, fundador]) {
      const fila = await chamar('/api/aprovacoes', { token });
      const minha = (fila.corpo.fila ?? []).find(
        (s: { id: string }) => s.id === solicitacaoId,
      );
      if (!minha) continue;

      await chamar('/api/aprovacoes/' + solicitacaoId + '/decidir', {
        metodo: 'POST', token, corpo: { decisao: 'APROVADA' },
      });
    }

    const d = await chamar('/api/solicitacoes/' + solicitacaoId, { token: solicitante });
    if (d.corpo.solicitacao.situacao === 'APROVADA') return;
  }

  throw new Error('a solicitação ' + solicitacaoId + ' não chegou a APROVADA');
}

function prazo(dias = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

/** Caminho inteiro até um pedido de compra pronto para receber. */
async function pedidoPronto(quantidades = { a: 100, b: 40 }, preco = 25) {
  const criada = await chamar('/api/solicitacoes', {
    metodo: 'POST',
    token: solicitante,
    corpo: {
      obraId,
      dataDesejada: '2026-12-31',
      itens: [
        { materialId: materialA, quantidade: quantidades.a, valorEstimado: preco, especificacaoTecnica: 'Padrão.' },
        { materialId: materialB, quantidade: quantidades.b, valorEstimado: preco, especificacaoTecnica: 'Padrão.' },
      ],
    },
  });

  const id = criada.corpo.solicitacao.id;
  await chamar('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST', token: solicitante });
  await aprovarTudo(id);

  const detalhe = await chamar('/api/solicitacoes/' + id, { token: solicitante });
  const itens = detalhe.corpo.solicitacao.itens.map((i: { id: string }) => i.id);

  const bid = await chamar('/api/cotacoes', {
    metodo: 'POST', token: comprador,
    corpo: { titulo: 'Pacote do estoque', prazoResposta: prazo(), itens },
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
        valorUnitario: preco,
        prazoEntregaDias: 5,
      })),
      valorFrete: 0,
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

  return gerados.corpo.pedidos[0].numero as string;
}

/** Recebe tudo de um pedido e devolve a resposta. */
async function receberTudo(numeroPedido: string) {
  const aberto = await chamar('/api/recebimentos/pedido/' + numeroPedido, { token: almoxarife });

  return chamar('/api/recebimentos', {
    metodo: 'POST', token: almoxarife,
    corpo: {
      pedidoId: aberto.corpo.pedido.id,
      almoxarifadoId: almoxarifadoObra,
      itens: aberto.corpo.itens.map((i: { pedidoItemId: string; saldo: number }) => ({
        pedidoItemId: i.pedidoItemId,
        quantidadeRecebida: i.saldo,
        situacao: 'CONFORME',
      })),
    },
  });
}

/**
 * Cria um material só para o bloco de teste que chamar, já com
 * saldo no almoxarifado da obra.
 *
 * Os blocos de teste rodam em paralelo. Sem material próprio, um
 * bloco mexeria no saldo que o outro está conferindo — e a falha
 * apareceria em quem não tem culpa.
 */
async function materialComSaldo(
  codigo: string,
  quantidade: number,
  preco = 30,
  pontoPedido: number | null = null,
) {
  const m = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId, codigoInterno: codigo,
      descricao: 'Material ' + codigo, unidadeMedida: 'SC',
      pontoPedido,
    },
  });

  const materialId = m.corpo.material.id as string;

  await chamar('/api/estoque/movimentos', {
    metodo: 'POST', token: almoxarife,
    corpo: {
      almoxarifadoId: almoxarifadoObra,
      materialId,
      tipo: 'ENTRADA',
      quantidade,
      valorUnitario: preco,
      observacao: 'Saldo inicial do teste.',
    },
  });

  return materialId;
}

/** Saldo de um material no almoxarifado da obra. */
async function saldo(materialId: string, almoxarifadoId = almoxarifadoObra) {
  const r = await chamar('/api/estoque?almoxarifadoId=' + almoxarifadoId, { token: almoxarife });
  const linha = r.corpo.linhas.find((l: { materialId: string }) => l.materialId === materialId);
  return linha ?? null;
}

before(async () => {
  await limparDados();

  await criarUsuarioTeste('admin8@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('comprador8@teste.com.br', ['COMPRADOR']);
  await criarUsuarioTeste('solicitante8@teste.com.br', ['SOLICITANTE']);
  await criarUsuarioTeste('gestor8@teste.com.br', ['GESTOR_OBRA']);
  await criarUsuarioTeste('almox8@teste.com.br', ['ALMOXARIFE']);
  await criarUsuarioTeste('engenheiro8@teste.com.br', ['ENGENHEIRO']);
  await criarUsuarioTeste('fundador8@teste.com.br', ['FUNDADOR']);

  admin = await entrarComo('admin8@teste.com.br');
  comprador = await entrarComo('comprador8@teste.com.br');
  solicitante = await entrarComo('solicitante8@teste.com.br');
  gestor = await entrarComo('gestor8@teste.com.br');
  almoxarife = await entrarComo('almox8@teste.com.br');
  engenheiro = await entrarComo('engenheiro8@teste.com.br');
  fundador = await entrarComo('fundador8@teste.com.br');

  const familia = await chamar('/api/familias', {
    metodo: 'POST', token: admin, corpo: { codigo: 'EST', nome: 'Estoque' },
  });
  familiaId = familia.corpo.familia.id;

  const a = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId, codigoInterno: 'ES-A',
      descricao: 'Cimento CP-II saco 50kg', unidadeMedida: 'SC',
      pontoPedido: 30,
    },
  });
  materialA = a.corpo.material.id;

  const b = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId, codigoInterno: 'ES-B',
      descricao: 'Areia media m3', unidadeMedida: 'M3',
    },
  });
  materialB = b.corpo.material.id;

  const f1 = await chamar('/api/fornecedores', {
    metodo: 'POST', token: admin,
    corpo: {
      razaoSocial: 'Fornecedor do Estoque Ltda', cnpj: '05570714000159',
      whatsapp: '5511911111111', familias: [familiaId],
    },
  });
  fornecedor1 = f1.corpo.fornecedor.id;

  const obra = await chamar('/api/obras', {
    metodo: 'POST', token: admin, corpo: { codigo: 'OB-ES', nome: 'Obra do estoque' },
  });
  obraId = obra.corpo.obra.id;

  // Uma segunda obra para exercitar a transferência. No banco de
  // teste não existe o almoxarifado central do seed, e transferir
  // entre duas obras é tão real quanto.
  const obra2 = await chamar('/api/obras', {
    metodo: 'POST', token: admin, corpo: { codigo: 'OB-ES2', nome: 'Obra vizinha' },
  });

  const almoxarifados = await chamar('/api/almoxarifados', { token: admin });
  const lista = almoxarifados.corpo.almoxarifados ?? [];

  almoxarifadoObra = lista.find(
    (x: { obra: { codigo: string } | null }) => x.obra?.codigo === 'OB-ES',
  )?.id ?? '';

  almoxarifadoCentral = lista.find(
    (x: { obra: { codigo: string } | null }) => x.obra?.codigo === 'OB-ES2',
  )?.id ?? '';

  if (!almoxarifadoObra || !almoxarifadoCentral) {
    throw new Error('os almoxarifados das obras de teste não foram criados');
  }

  void obra2;
});

after(encerrar);

describe('Entrada automática pelo recebimento', () => {
  it('o que foi conferido vira saldo', async () => {
    const numeroPedido = await pedidoPronto({ a: 100, b: 40 }, 25);
    const r = await receberTudo(numeroPedido);

    assert.equal(r.status, 200);

    const linha = await saldo(materialA);
    assert.equal(linha.quantidade, 100);
    assert.equal(linha.custoMedio, 25);
  });

  it('o extrato mostra de onde veio a entrada', async () => {
    const r = await chamar(
      '/api/estoque/movimentos?almoxarifadoId=' + almoxarifadoObra + '&materialId=' + materialA,
      { token: almoxarife },
    );

    const entrada = r.corpo.movimentos.find((m: { tipo: string }) => m.tipo === 'ENTRADA');

    assert.ok(entrada);
    assert.match(entrada.numeroFormatado, /^MOV-\d{5}$/);
    assert.match(entrada.observacao, /recebimento do pedido PC-/);
  });

  it('a segunda entrega faz a média do custo', async () => {
    // Já existem 100 a R$ 25. Chegam 100 a R$ 35 -> média R$ 30.
    const numeroPedido = await pedidoPronto({ a: 100, b: 10 }, 35);
    await receberTudo(numeroPedido);

    const linha = await saldo(materialA);
    assert.equal(linha.quantidade, 200);
    assert.equal(linha.custoMedio, 30);
  });

  it('material devolvido não entra no estoque', async () => {
    const numeroPedido = await pedidoPronto({ a: 10, b: 10 }, 25);
    const aberto = await chamar('/api/recebimentos/pedido/' + numeroPedido, { token: almoxarife });
    const item = aberto.corpo.itens[0];

    const antes = await saldo(materialA);

    await chamar('/api/recebimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        pedidoId: aberto.corpo.pedido.id,
        almoxarifadoId: almoxarifadoObra,
        itens: [
          {
            pedidoItemId: item.pedidoItemId,
            quantidadeRecebida: 0,
            quantidadeDevolvida: item.saldo,
            situacao: 'DEVOLVIDO',
            motivo: 'Carga inteira fora da especificação.',
          },
        ],
      },
    });

    const depois = await saldo(materialA);
    assert.equal(depois.quantidade, antes.quantidade);
  });
});

describe('Retirada', () => {
  it('tira material e baixa o saldo', async () => {
    const id = await materialComSaldo('RT-1', 100);

    const r = await chamar('/api/estoque/movimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        almoxarifadoId: almoxarifadoObra,
        materialId: id,
        tipo: 'SAIDA',
        quantidade: 20,
        destino: 'Equipe da laje do 3º pavimento',
      },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.saldoDepois, 80);
    assert.match(r.corpo.mensagem, /Saíram 20 SC/);
  });

  it('a retirada não muda o custo do que ficou', async () => {
    const id = await materialComSaldo('RT-2', 100, 30);

    await chamar('/api/estoque/movimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        almoxarifadoId: almoxarifadoObra, materialId: id,
        tipo: 'SAIDA', quantidade: 40, destino: 'Frente de serviço',
      },
    });

    const linha = await saldo(id);

    assert.equal(linha.quantidade, 60);
    assert.equal(linha.custoMedio, 30);
  });

  it('não deixa tirar mais do que existe', async () => {
    const id = await materialComSaldo('RT-3', 10);

    const r = await chamar('/api/estoque/movimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        almoxarifadoId: almoxarifadoObra, materialId: id,
        tipo: 'SAIDA', quantidade: 11, destino: 'Equipe da laje',
      },
    });

    assert.equal(r.status, 400);
    assert.match(r.corpo.detalhes[0], /tem 10 e você pediu 11/);
  });

  it('retirada sem destino é recusada', async () => {
    const id = await materialComSaldo('RT-4', 10);

    const r = await chamar('/api/estoque/movimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        almoxarifadoId: almoxarifadoObra, materialId: id,
        tipo: 'SAIDA', quantidade: 1,
      },
    });

    assert.equal(r.status, 400);
    assert.match(r.corpo.detalhes[0], /para quem ou para qual frente/);
  });
});

describe('Ajuste de inventário', () => {
  it('a contagem física vira o novo saldo', async () => {
    const id = await materialComSaldo('AJ-1', 40);

    const r = await chamar('/api/estoque/movimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        almoxarifadoId: almoxarifadoObra, materialId: id,
        tipo: 'AJUSTE', quantidade: 37,
        observacao: 'Contagem do mês: três sacos endurecidos, descartados.',
      },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.saldoDepois, 37);
    assert.match(r.corpo.mensagem, /a menos/);
  });

  it('contagem maior que o saldo também vale', async () => {
    const id = await materialComSaldo('AJ-2', 40);

    const r = await chamar('/api/estoque/movimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        almoxarifadoId: almoxarifadoObra, materialId: id,
        tipo: 'AJUSTE', quantidade: 43,
        observacao: 'Acharam três sacos guardados em outra baia.',
      },
    });

    assert.equal(r.corpo.saldoDepois, 43);
    assert.match(r.corpo.mensagem, /a mais/);
  });

  it('ajuste sem explicação é recusado', async () => {
    const id = await materialComSaldo('AJ-3', 40);

    const r = await chamar('/api/estoque/movimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        almoxarifadoId: almoxarifadoObra, materialId: id,
        tipo: 'AJUSTE', quantidade: 39,
      },
    });

    assert.equal(r.status, 400);
    assert.match(r.corpo.detalhes[0], /Explique/);
  });

  it('contagem igual ao saldo não gera movimento', async () => {
    const id = await materialComSaldo('AJ-4', 40);

    const r = await chamar('/api/estoque/movimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        almoxarifadoId: almoxarifadoObra, materialId: id,
        tipo: 'AJUSTE', quantidade: 40, observacao: 'Contagem do mês.',
      },
    });

    assert.equal(r.status, 400);
    assert.match(r.corpo.detalhes[0], /bateu com o saldo/);
  });
});

describe('Transferência entre almoxarifados', () => {
  it('sai de um e entra no outro, com o mesmo custo', async () => {
    const id = await materialComSaldo('TR-1', 100, 42);

    const r = await chamar('/api/estoque/transferir', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        materialId: id,
        origemId: almoxarifadoObra,
        destinoId: almoxarifadoCentral,
        quantidade: 10,
      },
    });

    assert.equal(r.status, 200);

    const naObra = await saldo(id);
    const noCentral = await saldo(id, almoxarifadoCentral);

    assert.equal(naObra.quantidade, 90);
    assert.equal(noCentral.quantidade, 10);
    // Mudar de prateleira não deixa o material mais caro.
    assert.equal(noCentral.custoMedio, 42);
  });

  it('o extrato registra os dois lados', async () => {
    const id = await materialComSaldo('TR-2', 50);

    await chamar('/api/estoque/transferir', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        materialId: id, origemId: almoxarifadoObra,
        destinoId: almoxarifadoCentral, quantidade: 5,
      },
    });

    const r = await chamar('/api/estoque/movimentos?materialId=' + id, { token: almoxarife });
    const tipos = r.corpo.movimentos.map((m: { tipo: string }) => m.tipo);

    assert.ok(tipos.includes('TRANSFERENCIA_SAIDA'));
    assert.ok(tipos.includes('TRANSFERENCIA_ENTRADA'));
  });

  it('não transfere para o mesmo almoxarifado', async () => {
    const id = await materialComSaldo('TR-3', 10);

    const r = await chamar('/api/estoque/transferir', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        materialId: id, origemId: almoxarifadoObra,
        destinoId: almoxarifadoObra, quantidade: 1,
      },
    });

    assert.equal(r.status, 400);
    assert.match(r.corpo.erro, /dois almoxarifados diferentes/);
  });

  it('não transfere mais do que existe', async () => {
    const id = await materialComSaldo('TR-4', 10);

    const r = await chamar('/api/estoque/transferir', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        materialId: id, origemId: almoxarifadoObra,
        destinoId: almoxarifadoCentral, quantidade: 15,
      },
    });

    assert.equal(r.status, 400);
  });
});

describe('Ponto de pedido', () => {
  it('avisa quando o saldo encosta no mínimo', async () => {
    const id = await materialComSaldo('PP-1', 5, 30, 30);

    const r = await chamar('/api/estoque?almoxarifadoId=' + almoxarifadoObra, {
      token: almoxarife,
    });

    const alvo = r.corpo.linhas.find((l: { materialId: string }) => l.materialId === id);

    assert.equal(alvo.quantidade, 5);
    assert.match(alvo.alerta, /Restam 5 SC/);
    assert.ok(r.corpo.resumo.abaixoDoMinimo >= 1);
  });

  it('material com saldo folgado não alerta', async () => {
    const id = await materialComSaldo('PP-2', 200, 30, 30);

    const r = await chamar('/api/estoque?almoxarifadoId=' + almoxarifadoObra, {
      token: almoxarife,
    });

    const alvo = r.corpo.linhas.find((l: { materialId: string }) => l.materialId === id);

    assert.equal(alvo.alerta, '');
  });

  it('sugere repor até o dobro do mínimo', async () => {
    const id = await materialComSaldo('PP-3', 5, 30, 30);

    const r = await chamar('/api/estoque/reposicao?almoxarifadoId=' + almoxarifadoObra, {
      token: almoxarife,
    });

    const item = r.corpo.itens.find((i: { materialId: string }) => i.materialId === id);

    assert.ok(item);
    // Mínimo 30, restam 5: comprar 55 deixa o estoque em 60.
    assert.equal(item.quantidade, 55);
    assert.equal(item.valorEstimado, 30);
  });

  it('material sem ponto de pedido não entra na reposição', async () => {
    const id = await materialComSaldo('PP-4', 1, 30, null);

    const r = await chamar('/api/estoque/reposicao?almoxarifadoId=' + almoxarifadoObra, {
      token: almoxarife,
    });

    assert.equal(
      r.corpo.itens.some((i: { materialId: string }) => i.materialId === id),
      false,
    );
  });

  it('a sugestão abre solicitação pela rota de sempre', async () => {
    const id = await materialComSaldo('PP-5', 2, 30, 30);

    const sugestao = await chamar('/api/estoque/reposicao?almoxarifadoId=' + almoxarifadoObra, {
      token: almoxarife,
    });

    const meu = sugestao.corpo.itens.find((i: { materialId: string }) => i.materialId === id);

    const r = await chamar('/api/solicitacoes', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        obraId,
        dataDesejada: '2026-12-31',
        justificativa: 'Reposição: material no ponto de pedido.',
        itens: [
          {
            materialId: meu.materialId,
            quantidade: meu.quantidade,
            valorEstimado: meu.valorEstimado,
            especificacaoTecnica: 'Reposição do mesmo material.',
          },
        ],
      },
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.solicitacao.itens[0].quantidade, meu.quantidade);
  });
});

describe('Quem pode o quê', () => {
  it('o engenheiro vê o estoque', async () => {
    const r = await chamar('/api/estoque?almoxarifadoId=' + almoxarifadoObra, {
      token: engenheiro,
    });

    assert.equal(r.status, 200);
  });

  it('mas não movimenta', async () => {
    const r = await chamar('/api/estoque/movimentos', {
      metodo: 'POST', token: engenheiro,
      corpo: {
        almoxarifadoId: almoxarifadoObra, materialId: materialB,
        tipo: 'SAIDA', quantidade: 1, destino: 'Teste',
      },
    });

    assert.equal(r.status, 403);
  });

  it('o comprador enxerga o estoque antes de comprar', async () => {
    const r = await chamar('/api/estoque?almoxarifadoId=' + almoxarifadoObra, {
      token: comprador,
    });

    assert.equal(r.status, 200);
  });

  it('cada movimento tem número próprio e o extrato não se repete', async () => {
    const id = await materialComSaldo('EX-1', 30);

    await chamar('/api/estoque/movimentos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        almoxarifadoId: almoxarifadoObra, materialId: id,
        tipo: 'SAIDA', quantidade: 5, destino: 'Obra',
      },
    });

    const r = await chamar('/api/estoque/movimentos?materialId=' + id, { token: almoxarife });
    const numeros = r.corpo.movimentos.map((m: { numeroFormatado: string }) => m.numeroFormatado);

    assert.equal(numeros.length, 2);
    assert.equal(new Set(numeros).size, 2);
  });
});
