// ============================================================
//  SITUAÇÕES PARA PERGUNTAR AO ASSISTENTE
//
//  Pedido dele em 15/10/2026: "adicione dados ao sistema, mais
//  aprovações, cotações, financeiro, etc. Uns 3 pra cada".
//
//  Diferente do `seed-historico`, que fabrica meses de compras
//  para os relatórios terem curva, e do `seed-demonstracao`, que
//  cria uma de cada só para a tela não abrir vazia. Este monta
//  SITUAÇÕES DISTINTAS — três de cada coisa, cada uma num estado
//  diferente — para alguém poder perguntar ao assistente e
//  conferir se a resposta bate.
//
//  TUDO PASSA PELA API, um passo de cada vez, como uma pessoa
//  faria na tela. É mais lento do que escrever no banco, mas é o
//  único jeito honesto: assim a alçada decide quem assina, o
//  estoque se move, as parcelas nascem da condição combinada na
//  cotação e os números saem do mesmo contador de sempre.
//
//  Rode com:  npm run seed:situacoes
//
//  ATENÇÃO: é dado de demonstração. Não rode em produção.
// ============================================================

import { PrismaClient } from '@prisma/client';

const banco = new PrismaClient();
const BASE = process.env.API_URL ?? 'http://localhost:3000';
const SENHA = 'admin123';

//  DUAS CONTAS, E O MOTIVO E O LIMITE DE LOGIN.
//
//  A rota de entrada aceita 10 tentativas por 5 minutos, para
//  barrar quem tenta adivinhar senha por forca bruta. O limite
//  esta certo — quem incomodava era este script, que entrava como
//  CINCO pessoas a cada rodada e estourava a janela na segunda
//  tentativa.
//
//  Duas bastam, e sao duas por uma regra do sistema: o AUTOR NAO
//  APROVA A PROPRIA SOLICITACAO. Entao a Neilma pede (ela tambem e
//  compradora, e monta a cotacao), e a conta DEV — que acumula os
//  sete papeis — assina, recebe e lanca a nota.
const SOLICITANTE = 'neilma@portoinc.com.br';
const COMPRADOR = 'neilma@portoinc.com.br';
const ALMOXARIFE = 'porto@dev.com';

const APROVADORES = ['porto@dev.com'];

const tokens = new Map<string, string>();

async function entrar(email: string): Promise<string> {
  const guardado = tokens.get(email);
  if (guardado) return guardado;

  let r = await fetch(BASE + '/api/autenticacao/entrar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, senha: SENHA }),
  });

  //  ESPERA A JANELA EM VEZ DE MORRER.
  //
  //  Se outra coisa gastou as tentativas antes, a rodada inteira
  //  se perdia por causa do primeiro login. Esperar uma vez custa
  //  cinco minutos; perder a rodada custa tudo de novo.
  if (r.status === 429) {
    console.log('  [situacoes] limite de login atingido. Esperando a janela abrir...');
    await new Promise((ok) => setTimeout(ok, 5 * 60 * 1000 + 10_000));

    r = await fetch(BASE + '/api/autenticacao/entrar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, senha: SENHA }),
    });
  }

  if (!r.ok) throw new Error('Não consegui entrar como ' + email + ' (' + r.status + ')');

  const corpo = (await r.json()) as { token: string };
  tokens.set(email, corpo.token);
  return corpo.token;
}

async function chamar(
  caminho: string,
  opcoes: { metodo?: string; email?: string; corpo?: unknown } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const cabecalhos: Record<string, string> = { 'content-type': 'application/json' };
  if (opcoes.email) cabecalhos.authorization = 'Bearer ' + (await entrar(opcoes.email));

  const r = await fetch(BASE + caminho, {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  });

  const texto = await r.text();
  const corpo = texto ? JSON.parse(texto) : {};

  if (!r.ok) {
    throw new Error(
      'Falhou ' + (opcoes.metodo ?? 'GET') + ' ' + caminho + ' (' + r.status + '): ' +
      (corpo.erro ?? texto.slice(0, 300)),
    );
  }

  return corpo;
}

const emDias = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
};

const diaEmDias = (dias: number) => emDias(dias).slice(0, 10);

// ============================================================
//  Peças de montagem
// ============================================================

interface Catalogo {
  obraId: string;
  almoxarifadoId: string;
  materiais: { id: string; descricao: string; unidade: string }[];
  fornecedores: { id: string; nome: string }[];
}

/**
 * Monta uma solicitação e manda para aprovação.
 *
 * O valor é o que decide quem assina — por isso ele entra como
 * parâmetro: é assim que se fabrica uma compra de rotina e uma
 * que precisa do fundador.
 */
async function pedir(
  cat: Catalogo,
  titulo: string,
  quantos: number,
  valorUnitario: number,
): Promise<{ id: string; itens: string[] }> {
  const criada = await chamar('/api/solicitacoes', {
    metodo: 'POST',
    email: SOLICITANTE,
    corpo: {
      obraId: cat.obraId,
      dataDesejada: diaEmDias(12),
      justificativa: titulo,
      itens: cat.materiais.slice(0, 2).map((m) => ({
        materialId: m.id,
        quantidade: quantos,
        valorEstimado: valorUnitario,
        especificacaoTecnica: 'Conforme norma técnica do material.',
      })),
    },
  });

  const id = criada.solicitacao.id as string;

  await chamar('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST', email: SOLICITANTE });

  const detalhe = await chamar('/api/solicitacoes/' + id, { email: SOLICITANTE });

  return {
    id,
    itens: detalhe.solicitacao.itens.map((i: { id: string }) => i.id),
  };
}

/**
 * Assina até sair da fila.
 *
 * Quantas assinaturas depende da faixa de alçada. Em vez de
 * adivinhar, oferecemos a cada aprovador e paramos quando a
 * solicitação deixa de estar aguardando.
 */
async function assinar(solicitacaoId: string, decisao: 'APROVADA' | 'REPROVADA') {
  for (const quem of APROVADORES) {
    const atual = await banco.solicitacao.findUnique({
      where: { id: solicitacaoId },
      select: { situacao: true },
    });

    if (atual?.situacao !== 'AGUARDANDO_APROVACAO') break;

    try {
      await chamar('/api/aprovacoes/' + solicitacaoId + '/decidir', {
        metodo: 'POST',
        email: quem,
        corpo: {
          decisao,
          observacao:
            decisao === 'APROVADA'
              ? 'Aprovado conforme planejamento da obra.'
              : 'Fora do orçamento previsto para o mês.',
        },
      });
    } catch {
      //  Aprovador fora da faixa recebe 403. Não é erro: é a
      //  alçada funcionando. Seguimos para o próximo.
    }
  }
}

/** Abre um pacote de cotação com os fornecedores indicados. */
async function cotar(
  cat: Catalogo,
  titulo: string,
  itens: string[],
  quantosFornecedores: number,
  prazoDias: number,
) {
  const bid = await chamar('/api/cotacoes', {
    metodo: 'POST',
    email: COMPRADOR,
    corpo: { titulo, prazoResposta: emDias(prazoDias), itens },
  });

  const id = bid.cotacao.id as string;
  const convidados = cat.fornecedores.slice(0, quantosFornecedores).map((f) => f.id);

  await chamar('/api/cotacoes/' + id + '/fornecedores', {
    metodo: 'POST',
    email: COMPRADOR,
    corpo: { fornecedores: convidados },
  });

  await chamar('/api/cotacoes/' + id + '/abrir', { metodo: 'POST', email: COMPRADOR });

  const convites = await banco.bidFornecedor.findMany({
    where: { bidId: id },
    include: { fornecedor: { select: { nomeFantasia: true } } },
    orderBy: { criadoEm: 'asc' },
  });

  return { id, convites };
}

/** O fornecedor responde pelo portal, como faria pelo link. */
async function responderPeloPortal(token: string, precoBase: number) {
  const portal = await chamar('/api/portal/' + token);

  //  O portal devolve os itens DENTRO de `cotacao`, e o `id` de
  //  cada linha JÁ É o `bidItemId` — é por ele que a resposta
  //  volta amarrada ao item do pacote.
  await chamar('/api/portal/' + token, {
    metodo: 'POST',
    corpo: {
      itens: portal.cotacao.itens.map((i: { id: string }, n: number) => ({
        bidItemId: i.id,
        disponivel: true,
        //  Preços diferentes entre fornecedores, senão a
        //  equalização não teria o que comparar.
        valorUnitario: precoBase + n * 2,
        prazoEntregaDias: 5,
      })),
      valorFrete: 120,
      quantidadeParcelas: 2,
      intervaloParcelasDias: 30,
    },
  });
}

/** Só abre o link, sem responder. É um estado que a tela mostra. */
async function apenasVisualizar(token: string) {
  await chamar('/api/portal/' + token);
}

// ============================================================
//  O roteiro
// ============================================================

async function principal() {
  if (process.env.NODE_ENV === 'production') {
    console.log('  [situacoes] Produção: nada foi criado.');
    return;
  }

  await chamar('/health');

  const obra = await banco.obra.findFirst({
    where: { situacao: 'EM_ANDAMENTO' },
    orderBy: { codigo: 'asc' },
  });
  if (!obra) throw new Error('Nenhuma obra em andamento.');

  const almoxarifado = await banco.almoxarifado.findFirst({ orderBy: { codigo: 'asc' } });
  if (!almoxarifado) throw new Error('Nenhum almoxarifado cadastrado.');

  //  Uma família com material E fornecedor, senão a cotação nasce
  //  sem ninguém para convidar.
  const familias = await banco.familiaMaterial.findMany({
    where: { materiais: { some: { tipo: 'MATERIAL' } }, fornecedores: { some: {} } },
    include: { _count: { select: { fornecedores: true, materiais: true } } },
  });

  const familia = familias
    .filter((f) => f._count.materiais >= 2)
    .sort((a, b) => b._count.fornecedores - a._count.fornecedores)[0];

  if (!familia) throw new Error('Nenhuma família tem material e fornecedor ao mesmo tempo.');

  const materiais = await banco.material.findMany({
    where: { familiaId: familia.id, tipo: 'MATERIAL' },
    orderBy: { codigoInterno: 'asc' },
    take: 2,
  });

  const fornecedores = await banco.fornecedor.findMany({
    where: { familias: { some: { familiaId: familia.id } } },
    orderBy: { nomeFantasia: 'asc' },
    take: 3,
  });

  const cat: Catalogo = {
    obraId: obra.id,
    almoxarifadoId: almoxarifado.id,
    materiais: materiais.map((m) => ({
      id: m.id,
      descricao: m.descricao,
      unidade: m.unidadeMedida,
    })),
    fornecedores: fornecedores.map((f) => ({
      id: f.id,
      nome: f.nomeFantasia ?? f.razaoSocial,
    })),
  };

  console.log('\n  Alimentando com ' + familia.nome + ', ' + cat.fornecedores.length + ' fornecedores.\n');

  // ----------------------------------------------------------
  //  TRÊS SOLICITAÇÕES, cada uma num estado
  // ----------------------------------------------------------

  //  1. Compra de rotina: assinada e já virou cotação.
  //  ABAIXO DE R$ 2.000 DE PROPOSITO.
  //
  //  A faixa de R$ 2.000 a R$ 15.000 exige DUAS assinaturas de
  //  funcoes diferentes — gestor de obra E engenheiro —, e uma
  //  conta so nao satisfaz as duas, mesmo acumulando os papeis.
  //  As compras que precisam ficar APROVADAS entram na faixa de
  //  rotina, que pede uma assinatura.
  const rotina = await pedir(cat, 'Reposição semanal da obra', 25, 34);
  await assinar(rotina.id, 'APROVADA');

  //  2. Compra grande: PARA na fila, esperando o fundador.
  await pedir(cat, 'Compra do mês inteiro, volume alto', 900, 58);

  //  3. Reprovada: existe, mas não está pendente de ninguém.
  const recusada = await pedir(cat, 'Pedido extra fora do cronograma', 300, 44);
  await assinar(recusada.id, 'REPROVADA');

  console.log('  3 solicitações: uma aprovada, uma esperando assinatura, uma reprovada.');

  // ----------------------------------------------------------
  //  TRÊS COTAÇÕES, cada uma num estado
  // ----------------------------------------------------------

  //  1. ABERTA, com os três estados de convidado ao mesmo tempo:
  //     um respondeu, um abriu e não respondeu, um nem abriu.
  const aberta = await cotar(cat, 'Cimento e argamassa — reposição', rotina.itens, 3, 2);
  await responderPeloPortal(aberta.convites[0].token, 36);
  await apenasVisualizar(aberta.convites[1].token);

  //  2. ENCERRADA: todos responderam, ninguém escolheu ainda.
  const paraEncerrar = await pedir(cat, 'Material para a laje do terceiro andar', 25, 34);
  await assinar(paraEncerrar.id, 'APROVADA');

  const encerrada = await cotar(cat, 'Material da laje — 3º andar', paraEncerrar.itens, 3, 7);
  for (const [n, c] of encerrada.convites.entries()) {
    await responderPeloPortal(c.token, 33 + n);
  }
  await chamar('/api/cotacoes/' + encerrada.id + '/encerrar', { metodo: 'POST', email: COMPRADOR });

  //  3. CONCLUÍDA: equalizada e com pedidos gerados.
  const paraConcluir = await pedir(cat, 'Material do contrapiso', 25, 34);
  await assinar(paraConcluir.id, 'APROVADA');

  const concluida = await cotar(cat, 'Contrapiso — material', paraConcluir.itens, 3, 7);
  for (const [n, c] of concluida.convites.entries()) {
    //  O PRIMEIRO E O SEGUNDO EMPATAM no preço de um item. É o
    //  caso que já produziu defeito no financeiro, e que vale
    //  continuar existindo no banco para alguém conferir.
    await responderPeloPortal(c.token, n === 2 ? 40 : 35);
  }

  await chamar('/api/cotacoes/' + concluida.id + '/encerrar', { metodo: 'POST', email: COMPRADOR });

  const comparativo = await chamar('/api/cotacoes/' + concluida.id + '/equalizacao', {
    email: COMPRADOR,
  });

  await chamar('/api/cotacoes/' + concluida.id + '/escolhas', {
    metodo: 'POST',
    email: COMPRADOR,
    corpo: {
      escolhas: comparativo.comparativo.linhas.map(
        (l: { bidItemId: string; melhorFornecedorId: string | null }) => ({
          bidItemId: l.bidItemId,
          bidFornecedorId: l.melhorFornecedorId,
        }),
      ),
    },
  });

  const gerados = await chamar('/api/cotacoes/' + concluida.id + '/gerar-pedidos', {
    metodo: 'POST',
    email: COMPRADOR,
  });

  console.log('  3 cotações: uma aberta, uma encerrada, uma concluída com pedidos.');

  // ----------------------------------------------------------
  //  TRÊS PEDIDOS, cada um num estágio de entrega
  // ----------------------------------------------------------
  const pedidos = await banco.pedido.findMany({
    where: { bidId: concluida.id },
    include: { itens: true, fornecedor: { select: { nomeFantasia: true } } },
    orderBy: { numero: 'asc' },
  });

  if (pedidos.length === 0) throw new Error('A equalização não gerou pedido nenhum.');

  //  1. ENVIADO ao fornecedor, nada chegou.
  await chamar('/api/pedidos/' + pedidos[0].id + '/enviar', { metodo: 'POST', email: COMPRADOR });

  //  2. RECEBIDO PELA METADE — o caso que a tela de recebimento
  //     existe para mostrar.
  if (pedidos[1]) {
    await chamar('/api/pedidos/' + pedidos[1].id + '/enviar', { metodo: 'POST', email: COMPRADOR });

    await chamar('/api/recebimentos', {
      metodo: 'POST',
      email: ALMOXARIFE,
      corpo: {
        pedidoId: pedidos[1].id,
        almoxarifadoId: cat.almoxarifadoId,
        notaFiscal: String(100000 + (Date.now() % 800000)),
        serieNotaFiscal: '1',
        transportadora: 'Transportes Vale',
        itens: pedidos[1].itens.map((i) => ({
          pedidoItemId: i.id,
          quantidadeRecebida: Math.floor(Number(i.quantidade) / 2),
          situacao: 'CONFORME',
        })),
      },
    });
  }

  console.log('  ' + pedidos.length + ' pedidos: um enviado, um recebido pela metade.');

  // ----------------------------------------------------------
  //  TRÊS TÍTULOS NO FINANCEIRO: pago, a vencer e VENCIDO
  // ----------------------------------------------------------
  const paraNota = pedidos[1] ?? pedidos[0];

  const totalDoPedido = paraNota.itens.reduce(
    (soma, i) => soma + Number(i.quantidade) * Number(i.valorUnitario ?? 0),
    0,
  );

  //  NÚMERO DIFERENTE A CADA RODADA.
  //
  //  O sistema recusa a mesma nota do mesmo fornecedor duas vezes,
  //  e com razão — nota repetida vira dívida dobrada. Mas isso faz
  //  um alimentador que roda de novo parar no meio. O carimbo do
  //  relógio resolve sem enfraquecer a regra.
  const numeroDaNota = String(100000 + (Date.now() % 800000));

  const nota = await chamar('/api/notas-fiscais', {
    metodo: 'POST',
    email: COMPRADOR,
    corpo: {
      //  `fornecedorId` é obrigatório: a nota é DELE, e o pedido
      //  é só a origem. Sem ele a rota recusa com "dados
      //  inválidos" — e a mensagem não diz qual campo.
      fornecedorId: paraNota.fornecedorId,
      pedidoId: paraNota.id,
      numero: numeroDaNota,
      serie: '1',
      emitidaEm: diaEmDias(-20),
      valorTotal: Number(totalDoPedido.toFixed(2)),
      observacoes: 'Entrada de material da obra.',
      itens: paraNota.itens.map((i) => ({
        descricao: 'Item do pedido',
        quantidade: Number(i.quantidade),
        valorUnitario: Number(i.valorUnitario ?? 0),
        valorTotal: Number((Number(i.quantidade) * Number(i.valorUnitario ?? 0)).toFixed(2)),
      })),
    },
  });

  //  SEM CORPO, de propósito: as parcelas nascem da condição que
  //  o fornecedor combinou NA COTAÇÃO, já congelada no pedido.
  //  Ninguém digita prazo de pagamento duas vezes — é uma regra do
  //  sistema, e passar parâmetro aqui seria furá-la.
  const titulos = await chamar('/api/notas-fiscais/' + nota.nota.id + '/gerar-titulos', {
    metodo: 'POST',
    email: COMPRADOR,
  });

  //  A ROTA NAO DEVOLVE O `id` DAS PARCELAS — devolve o numero
  //  formatado, o valor e o vencimento, que e o que a tela mostra.
  //  Para pagar a primeira, buscamos no banco.
  console.log('  ' + (titulos.mensagem ?? ''));

  const parcelas = await banco.contaPagar.findMany({
    where: { notaFiscalId: nota.nota.id },
    orderBy: { parcela: 'asc' },
  });

  //  A PRIMEIRA É PAGA. A segunda já venceu e continua aberta. A
  //  terceira vence na semana que vem. Três estados, um de cada.
  if (parcelas[0]) {
    await chamar('/api/contas-pagar/' + parcelas[0].id + '/pagar', {
      metodo: 'POST',
      email: COMPRADOR,
      corpo: {
        pagoEm: diaEmDias(-9),
        valorPago: Number(parcelas[0].valor),
        formaPagamento: 'Transferência',
        quitacao: 'TOTAL',
      },
    });
  }

  const pagas = parcelas.filter((_, n) => n === 0).length;
  console.log(
    '  ' + parcelas.length + ' parcela(s) no financeiro: ' + pagas + ' paga, ' +
    (parcelas.length - pagas) + ' em aberto (a condição vem da cotação).',
  );

  // ----------------------------------------------------------
  //  TRÊS LOCAÇÕES: no prazo, VENCIDA e devolvida
  // ----------------------------------------------------------
  const equipamentos = [
    { nome: 'Betoneira 400L', dias: 20, valor: 65 },
    { nome: 'Andaime tubular', dias: -5, valor: 12 },
    { nome: 'Compactador de solo', dias: 10, valor: 90 },
  ];

  let locadas = 0;

  for (const [n, e] of equipamentos.entries()) {
    try {
      const locacao = await chamar('/api/locacao', {
        metodo: 'POST',
        email: COMPRADOR,
        corpo: {
          obraId: cat.obraId,
          fornecedorId: cat.fornecedores[n % cat.fornecedores.length].id,
          descricao: e.nome,
          quantidade: 1,
          unidadeMedida: 'UN',
          periodicidade: 'DIARIA',
          valorPeriodo: e.valor,
          inicioEm: diaEmDias(-30),
          previsaoDevolucao: diaEmDias(e.dias),
        },
      });

      //  A terceira volta para o fornecedor: o contrato fechado é
      //  um estado que a tela também mostra.
      if (n === 2) {
        await chamar('/api/locacao/' + locacao.contrato.id + '/devolver', {
          metodo: 'POST',
          email: COMPRADOR,
          corpo: { devolvidoEm: diaEmDias(-1) },
        });
      }

      locadas += 1;
    } catch (erro) {
      console.log('  [locação] ' + e.nome + ': ' + (erro as Error).message);
    }
  }

  console.log('  ' + locadas + ' locações: uma no prazo, uma vencida, uma devolvida.');
  console.log('\n  Pronto. Nenhuma mensagem foi enviada.\n');
  console.log('  Pedidos gerados nesta rodada: ' + (gerados.pedidos?.length ?? pedidos.length));
}

principal()
  .catch((e) => {
    console.error('  [situacoes] Falhou: ' + (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => banco.$disconnect());
