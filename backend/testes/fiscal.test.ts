// ============================================================
//  Testes da Etapa 9 - Fiscal e contas a pagar
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let comprador = '';
let solicitante = '';
let gestor = '';
let engenheiro = '';
let fundador = '';
let almoxarife = '';

let obraId = '';
let materialA = '';
let fornecedorId = '';

const CNPJ = '05570714000159';

function prazo(dias = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

async function aprovarTudo(solicitacaoId: string) {
  for (let rodada = 0; rodada < 4; rodada++) {
    for (const token of [gestor, engenheiro, fundador]) {
      const fila = await chamar('/api/aprovacoes', { token });
      if (!(fila.corpo.fila ?? []).some((s: { id: string }) => s.id === solicitacaoId)) continue;

      await chamar('/api/aprovacoes/' + solicitacaoId + '/decidir', {
        metodo: 'POST', token, corpo: { decisao: 'APROVADA' },
      });
    }

    const d = await chamar('/api/solicitacoes/' + solicitacaoId, { token: solicitante });
    if (d.corpo.solicitacao.situacao === 'APROVADA') return;
  }

  throw new Error('a solicitação não chegou a APROVADA');
}

/**
 * Monta um pedido de compra com condição de pagamento conhecida:
 * 30% de entrada + 2x a cada 30 dias.
 */
async function pedidoPronto(quantidade = 40, preco = 25) {
  const criada = await chamar('/api/solicitacoes', {
    metodo: 'POST', token: solicitante,
    corpo: {
      obraId,
      itens: [
        { materialId: materialA, quantidade, valorEstimado: preco, especificacaoTecnica: 'Padrão.' },
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
    corpo: { titulo: 'Pacote fiscal', prazoResposta: prazo(), itens },
  });
  const bidId = bid.corpo.cotacao.id;

  await chamar('/api/cotacoes/' + bidId + '/fornecedores', {
    metodo: 'POST', token: comprador, corpo: { fornecedores: [fornecedorId] },
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
        bidItemId: item.id, disponivel: true, valorUnitario: preco, prazoEntregaDias: 5,
      })),
      valorFrete: 0,
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
        bidItemId: item.id, bidFornecedorId: convite.id,
      })),
    },
  });

  const gerados = await chamar('/api/cotacoes/' + bidId + '/gerar-pedidos', {
    metodo: 'POST', token: comprador,
  });

  return {
    id: gerados.corpo.pedidos[0].id as string,
    numero: gerados.corpo.pedidos[0].numero as string,
    total: gerados.corpo.pedidos[0].total as number,
  };
}

/** Lança uma nota com o valor que vier. */
async function lancarNota(
  pedidoId: string | null,
  valorTotal: number,
  extra: Record<string, unknown> = {},
) {
  return chamar('/api/notas-fiscais', {
    metodo: 'POST', token: comprador,
    corpo: {
      numero: String(Math.floor(Math.random() * 900000) + 100000),
      serie: '1',
      fornecedorId,
      pedidoId,
      emitidaEm: new Date().toISOString(),
      valorTotal,
      itens: [],
      ...extra,
    },
  });
}

before(async () => {
  await limparDados();

  await criarUsuarioTeste('admin9@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('comprador9@teste.com.br', ['COMPRADOR']);
  await criarUsuarioTeste('solicitante9@teste.com.br', ['SOLICITANTE']);
  await criarUsuarioTeste('gestor9@teste.com.br', ['GESTOR_OBRA']);
  await criarUsuarioTeste('engenheiro9@teste.com.br', ['ENGENHEIRO']);
  await criarUsuarioTeste('fundador9@teste.com.br', ['FUNDADOR']);
  await criarUsuarioTeste('almox9@teste.com.br', ['ALMOXARIFE']);

  admin = await entrarComo('admin9@teste.com.br');
  comprador = await entrarComo('comprador9@teste.com.br');
  solicitante = await entrarComo('solicitante9@teste.com.br');
  gestor = await entrarComo('gestor9@teste.com.br');
  engenheiro = await entrarComo('engenheiro9@teste.com.br');
  fundador = await entrarComo('fundador9@teste.com.br');
  almoxarife = await entrarComo('almox9@teste.com.br');

  const familia = await chamar('/api/familias', {
    metodo: 'POST', token: admin, corpo: { codigo: 'FIS', nome: 'Fiscal' },
  });

  const m = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId: familia.corpo.familia.id, codigoInterno: 'FI-A',
      descricao: 'Cimento CP-II saco 50kg', unidadeMedida: 'SC',
    },
  });
  materialA = m.corpo.material.id;

  const f = await chamar('/api/fornecedores', {
    metodo: 'POST', token: admin,
    corpo: {
      razaoSocial: 'Fornecedor Fiscal Ltda', cnpj: CNPJ,
      whatsapp: '5511911111111', familias: [familia.corpo.familia.id],
    },
  });
  fornecedorId = f.corpo.fornecedor.id;

  const obra = await chamar('/api/obras', {
    metodo: 'POST', token: admin, corpo: { codigo: 'OB-FI', nome: 'Obra do fiscal' },
  });
  obraId = obra.corpo.obra.id;
});

after(encerrar);

describe('Lançar a nota', () => {
  it('nota que bate com o pedido fica conferida', async () => {
    const pedido = await pedidoPronto(40, 25);
    const r = await lancarNota(pedido.id, pedido.total);

    assert.equal(r.status, 201);
    assert.equal(r.corpo.nota.situacao, 'CONFERIDA');
    assert.deepEqual(r.corpo.nota.divergencias, []);
    assert.match(r.corpo.mensagem, /bate com o pedido/);
  });

  it('nota acima do pedido vira pendência', async () => {
    const pedido = await pedidoPronto(40, 25);
    const r = await lancarNota(pedido.id, pedido.total + 500);

    assert.equal(r.status, 201);
    assert.equal(r.corpo.nota.situacao, 'COM_DIVERGENCIA');
    assert.ok(r.corpo.nota.divergencias[0].includes('acima do que falta'));
  });

  it('nota menor é tratada como entrega parcial', async () => {
    const pedido = await pedidoPronto(40, 25);
    const r = await lancarNota(pedido.id, 100);

    assert.ok(r.corpo.nota.divergencias[0].includes('entrega parcial'));
  });

  it('a segunda nota do pedido considera a primeira', async () => {
    const pedido = await pedidoPronto(40, 25);

    await lancarNota(pedido.id, 400);
    const r = await lancarNota(pedido.id, pedido.total - 400);

    assert.equal(r.corpo.nota.situacao, 'CONFERIDA');
  });

  it('nota sem pedido é sinalizada', async () => {
    const r = await lancarNota(null, 500);

    assert.equal(r.corpo.nota.situacao, 'COM_DIVERGENCIA');
    assert.ok(r.corpo.nota.divergencias[0].includes('sem pedido'));
  });

  it('o mesmo fornecedor não lança a mesma nota duas vezes', async () => {
    const pedido = await pedidoPronto(40, 25);
    const corpo = {
      numero: '777777', serie: '1', fornecedorId, pedidoId: pedido.id,
      emitidaEm: new Date().toISOString(), valorTotal: pedido.total, itens: [],
    };

    const primeira = await chamar('/api/notas-fiscais', {
      metodo: 'POST', token: comprador, corpo,
    });
    const segunda = await chamar('/api/notas-fiscais', {
      metodo: 'POST', token: comprador, corpo,
    });

    assert.equal(primeira.status, 201);
    assert.equal(segunda.status, 409);
    assert.match(segunda.corpo.erro, /já tem a nota/);
  });

  it('chave de acesso errada é acusada', async () => {
    const pedido = await pedidoPronto(40, 25);
    const r = await lancarNota(pedido.id, pedido.total, {
      chaveAcesso: '35250912345678000199550010000001241000001240',
    });

    assert.ok(r.corpo.nota.divergencias.some((d: string) => d.includes('44 dígitos')));
  });
});

describe('Ler o XML da nota', () => {
  const CHAVE = '35250905570714000159550010000001241000001246';

  function xml(chave: string, valor = '1000.00') {
    return `<?xml version="1.0"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe><infNFe Id="NFe${chave}">
    <ide><nNF>9001</nNF><serie>1</serie><dhEmi>2026-09-15T09:00:00-03:00</dhEmi></ide>
    <emit><CNPJ>${CNPJ}</CNPJ><xNome>Fornecedor Fiscal Ltda</xNome></emit>
    <det nItem="1"><prod>
      <cProd>FI-A</cProd><cEAN>SEM GTIN</cEAN>
      <xProd>Cimento CP-II saco 50kg</xProd>
      <uCom>SC</uCom><qCom>40.0000</qCom><vUnCom>25.0000</vUnCom><vProd>1000.00</vProd>
    </prod></det>
    <total><ICMSTot><vProd>1000.00</vProd><vFrete>0.00</vFrete><vNF>${valor}</vNF></ICMSTot></total>
  </infNFe></NFe>
</nfeProc>`;
  }

  it('lê a nota e reconhece o fornecedor pelo CNPJ', async () => {
    await pedidoPronto(40, 25);

    const r = await chamar('/api/notas-fiscais/ler-xml', {
      metodo: 'POST', token: comprador, corpo: { xml: xml(CHAVE) },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.nota.numero, '9001');
    assert.equal(r.corpo.nota.valorTotal, 1000);
    assert.equal(r.corpo.nota.itens.length, 1);
    assert.equal(r.corpo.fornecedor.nome, 'Fornecedor Fiscal Ltda');
    assert.ok(r.corpo.pedidosDoFornecedor.length >= 1);
  });

  it('avisa quando a chave não confere', async () => {
    const r = await chamar('/api/notas-fiscais/ler-xml', {
      metodo: 'POST', token: comprador,
      corpo: { xml: xml('35250905570714000159550010000001241000001240') },
    });

    assert.equal(r.corpo.chaveValida, false);
  });

  it('recusa arquivo que não é nota', async () => {
    const r = await chamar('/api/notas-fiscais/ler-xml', {
      metodo: 'POST', token: comprador,
      corpo: { xml: '<html><body>isso nao e uma nota fiscal</body></html>' },
    });

    assert.equal(r.status, 400);
    assert.match(r.corpo.erro, /não parece ser o XML/);
  });

  it('o XML não grava nada sozinho', async () => {
    const antes = await chamar('/api/notas-fiscais', { token: comprador });

    await chamar('/api/notas-fiscais/ler-xml', {
      metodo: 'POST', token: comprador, corpo: { xml: xml(CHAVE) },
    });

    const depois = await chamar('/api/notas-fiscais', { token: comprador });

    assert.equal(depois.corpo.notas.length, antes.corpo.notas.length);
  });
});

describe('Parcelas a pagar', () => {
  it('gera conforme a condição da cotação', async () => {
    const pedido = await pedidoPronto(40, 25);
    const nota = await lancarNota(pedido.id, pedido.total);

    const r = await chamar('/api/notas-fiscais/' + nota.corpo.nota.id + '/gerar-titulos', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 200);
    // 30% de entrada + 2x = 3 parcelas.
    assert.equal(r.corpo.titulos.length, 3);
    assert.match(r.corpo.condicao, /30% de entrada \+ 2x a cada 30 dias/);

    const soma = r.corpo.titulos.reduce(
      (s: number, t: { valor: number }) => s + t.valor,
      0,
    );
    assert.equal(Math.round(soma * 100) / 100, pedido.total);
  });

  it('não gera duas vezes', async () => {
    const pedido = await pedidoPronto(40, 25);
    const nota = await lancarNota(pedido.id, pedido.total);

    await chamar('/api/notas-fiscais/' + nota.corpo.nota.id + '/gerar-titulos', {
      metodo: 'POST', token: comprador,
    });
    const r = await chamar('/api/notas-fiscais/' + nota.corpo.nota.id + '/gerar-titulos', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 409);
    assert.match(r.corpo.erro, /já foram geradas/);
  });

  it('nota sem pedido vira parcela única à vista', async () => {
    const nota = await lancarNota(null, 300);

    const r = await chamar('/api/notas-fiscais/' + nota.corpo.nota.id + '/gerar-titulos', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.corpo.titulos.length, 1);
    assert.equal(r.corpo.titulos[0].valor, 300);
  });
});

describe('Pagamento', () => {
  async function tituloAberto() {
    const pedido = await pedidoPronto(40, 25);
    const nota = await lancarNota(pedido.id, pedido.total);

    await chamar('/api/notas-fiscais/' + nota.corpo.nota.id + '/gerar-titulos', {
      metodo: 'POST', token: comprador,
    });

    const detalhe = await chamar('/api/notas-fiscais/' + nota.corpo.nota.id, {
      token: comprador,
    });

    return detalhe.corpo.nota.titulos[0];
  }

  it('baixa a parcela', async () => {
    const titulo = await tituloAberto();

    const r = await chamar('/api/contas-pagar/' + titulo.id + '/pagar', {
      metodo: 'POST', token: comprador,
      corpo: { formaPagamento: 'Transferência' },
    });

    assert.equal(r.status, 200);
    assert.match(r.corpo.mensagem, /baixada/);
  });

  it('não paga duas vezes', async () => {
    const titulo = await tituloAberto();

    await chamar('/api/contas-pagar/' + titulo.id + '/pagar', {
      metodo: 'POST', token: comprador, corpo: {},
    });
    const r = await chamar('/api/contas-pagar/' + titulo.id + '/pagar', {
      metodo: 'POST', token: comprador, corpo: {},
    });

    assert.equal(r.status, 409);
    assert.match(r.corpo.erro, /já está paga/);
  });

  it('a lista mostra em que pé está cada parcela', async () => {
    await tituloAberto();

    const r = await chamar('/api/contas-pagar', { token: comprador });

    assert.equal(r.status, 200);
    assert.ok(r.corpo.titulos.length > 0);

    for (const t of r.corpo.titulos) {
      assert.match(t.numeroFormatado, /^CP-\d{5}$/);
      assert.ok(['PAGA', 'VENCIDA', 'VENCE_HOJE', 'A_VENCER', 'CANCELADA'].includes(t.estado));
      assert.ok(typeof t.quando === 'string' && t.quando.length > 0);
    }
  });

  it('a entrada vence no dia da nota', async () => {
    const titulo = await tituloAberto();

    assert.equal(titulo.parcela, 1);
    assert.equal(new Date(titulo.vencimento).toDateString(), new Date().toDateString());
  });
});

describe('Cancelamento', () => {
  it('cancela a nota e as parcelas em aberto', async () => {
    const pedido = await pedidoPronto(40, 25);
    const nota = await lancarNota(pedido.id, pedido.total);

    await chamar('/api/notas-fiscais/' + nota.corpo.nota.id + '/gerar-titulos', {
      metodo: 'POST', token: comprador,
    });

    const r = await chamar('/api/notas-fiscais/' + nota.corpo.nota.id + '/cancelar', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 200);

    const depois = await chamar('/api/notas-fiscais/' + nota.corpo.nota.id, { token: comprador });
    assert.equal(depois.corpo.nota.situacao, 'CANCELADA');
  });

  it('não cancela nota com parcela paga', async () => {
    const pedido = await pedidoPronto(40, 25);
    const nota = await lancarNota(pedido.id, pedido.total);

    await chamar('/api/notas-fiscais/' + nota.corpo.nota.id + '/gerar-titulos', {
      metodo: 'POST', token: comprador,
    });

    const detalhe = await chamar('/api/notas-fiscais/' + nota.corpo.nota.id, { token: comprador });

    await chamar('/api/contas-pagar/' + detalhe.corpo.nota.titulos[0].id + '/pagar', {
      metodo: 'POST', token: comprador, corpo: {},
    });

    const r = await chamar('/api/notas-fiscais/' + nota.corpo.nota.id + '/cancelar', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 409);
    assert.match(r.corpo.erro, /parcela já paga/);
  });
});

describe('Resumo e exportação', () => {
  it('o resumo conta o que está em aberto', async () => {
    const pedido = await pedidoPronto(40, 25);
    const nota = await lancarNota(pedido.id, pedido.total);

    await chamar('/api/notas-fiscais/' + nota.corpo.nota.id + '/gerar-titulos', {
      metodo: 'POST', token: comprador,
    });

    const r = await chamar('/api/financeiro/resumo', { token: comprador });

    assert.equal(r.status, 200);
    assert.ok(r.corpo.emAberto.quantidade > 0);
    assert.ok(r.corpo.emAberto.valor > 0);
    assert.ok(typeof r.corpo.notasComPendencia === 'number');
  });

  it('baixa as contas em PDF', async () => {
    const r = await chamar('/api/contas-pagar/exportar?formato=pdf', { token: comprador });

    assert.equal(r.status, 200);
    assert.equal(r.tipo, 'application/pdf');
    assert.match(r.anexo, /contas-a-pagar\.pdf/);
    assert.equal(r.bruto.subarray(0, 4).toString('latin1'), '%PDF', 'não é um PDF de verdade');
  });

  it('baixa as contas em Word', async () => {
    const r = await chamar('/api/contas-pagar/exportar?formato=docx', { token: comprador });

    assert.equal(r.status, 200);
    assert.match(r.tipo, /wordprocessingml/);
    assert.match(r.anexo, /contas-a-pagar\.docx/);
    // .docx é um ZIP: começa com "PK".
    assert.equal(r.bruto.subarray(0, 2).toString('latin1'), 'PK');
  });

  it('sem escolher formato, vem PDF', async () => {
    const r = await chamar('/api/contas-pagar/exportar', { token: comprador });

    assert.equal(r.status, 200);
    assert.equal(r.tipo, 'application/pdf');
  });

  it('formato que não existe é recusado', async () => {
    const r = await chamar('/api/contas-pagar/exportar?formato=csv', { token: comprador });

    assert.equal(r.status, 400, 'melhor um erro claro do que um arquivo que não abre');
    assert.match(r.corpo.erro, /pdf/);
  });
});

describe('Quem pode o quê', () => {
  it('o almoxarife não entra no financeiro', async () => {
    const r = await chamar('/api/contas-pagar', { token: almoxarife });

    assert.equal(r.status, 403);
  });

  it('o fundador vê, mas não lança nota', async () => {
    const ve = await chamar('/api/contas-pagar', { token: fundador });
    const lanca = await chamar('/api/notas-fiscais', {
      metodo: 'POST', token: fundador,
      corpo: {
        numero: '123', fornecedorId, emitidaEm: new Date().toISOString(),
        valorTotal: 100, itens: [],
      },
    });

    assert.equal(ve.status, 200);
    assert.equal(lanca.status, 403);
  });

  it('o solicitante não vê contas a pagar', async () => {
    const r = await chamar('/api/contas-pagar', { token: solicitante });

    assert.equal(r.status, 403);
  });
});

describe('Painel financeiro', () => {
  it('devolve tudo que a tela precisa numa chamada só', async () => {
    const pedido = await pedidoPronto(40, 25);
    const nota = await lancarNota(pedido.id, pedido.total);

    await chamar('/api/notas-fiscais/' + nota.corpo.nota.id + '/gerar-titulos', {
      metodo: 'POST', token: comprador,
    });

    const r = await chamar('/api/financeiro/painel', { token: comprador });

    assert.equal(r.status, 200);

    // Os quatro números do topo.
    assert.ok(r.corpo.resumo.emAberto.valor > 0);

    // Os indicadores de gestão.
    assert.ok(typeof r.corpo.indicadores.prazoMedioPagamento === 'number');
    assert.ok(r.corpo.indicadores.pontualidade >= 0 && r.corpo.indicadores.pontualidade <= 100);
    assert.ok(r.corpo.indicadores.maiorParcelaAberta > 0);

    // Os gráficos.
    assert.equal(r.corpo.fluxo.length, 12, 'doze meses de fluxo');
    assert.ok(r.corpo.carteira.length > 0);
    assert.ok(r.corpo.porFornecedor.length > 0);
    assert.ok(r.corpo.totalDeParcelas > 0);
  });

  it('o fluxo tem o mês de hoje no meio da janela', async () => {
    const r = await chamar('/api/financeiro/painel', { token: comprador });

    const hoje = new Date();
    const chaveHoje =
      hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');

    // Índice 5: a 6ª de 12 colunas.
    //
    // Esta prova sempre se chamou "no meio da janela" e conferia o
    // índice 3 — a 4ª de 12, encostada à esquerda. O nome estava
    // certo e o código não: escolhendo agosto no filtro, agosto
    // aparecia no primeiro terço do gráfico. Corrigido em 24/09/2026,
    // quando o filtro de período tornou isso visível.
    assert.equal(r.corpo.fluxo[5].chave, chaveHoje);
  });

  it('cada fatia da carteira traz o tom da cor', async () => {
    const r = await chamar('/api/financeiro/painel', { token: comprador });

    for (const f of r.corpo.carteira) {
      assert.ok(['erro', 'atencao', 'info', 'sucesso'].includes(f.tom));
      assert.ok(f.percentual >= 0 && f.percentual <= 100);
    }
  });

  it('o ranking soma aberto e pago por fornecedor', async () => {
    const r = await chamar('/api/financeiro/painel', { token: comprador });

    for (const linha of r.corpo.porFornecedor) {
      assert.equal(
        Math.round((linha.aberto + linha.pago) * 100) / 100,
        linha.total,
      );
    }
  });

  it('o almoxarife não vê o painel', async () => {
    const r = await chamar('/api/financeiro/painel', { token: almoxarife });

    assert.equal(r.status, 403);
  });
});
