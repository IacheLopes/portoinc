// ============================================================
//  Histórico de demonstração
//
//  Os relatórios da Etapa 11 só dizem alguma coisa quando existe
//  história: compras de meses diferentes, fornecedores que
//  atrasaram, entregas com ressalva, cotação que economizou.
//
//  Este script cria essa história PASSANDO PELA API, um pedido
//  de cada vez, exatamente como uma pessoa faria na tela. É mais
//  lento do que escrever direto no banco, mas é o único jeito
//  honesto: assim o estoque se move, a alçada é respeitada e o
//  número do pedido sai do mesmo contador de sempre.
//
//  Depois de criar, as datas são recuadas no banco — só o
//  carimbo de tempo, nada mais. É o que permite ver "quanto
//  tempo leva do pedido até a entrega" sem esperar meses.
//
//  Cria também alguns contratos de locação, incluindo um
//  equipamento parado além do prazo — é o caso que a tela de
//  Locação existe para mostrar —, e três solicitações paradas
//  na fila de aprovação, uma em cada faixa de alçada.
//
//  Rode com:  npm run seed:historico
//
//  ATENÇÃO: é dado de demonstração. Não rode em produção.
// ============================================================

import { PrismaClient } from '@prisma/client';

const banco = new PrismaClient();
const BASE = process.env.API_URL ?? 'http://localhost:3000';
const SENHA = 'admin123';

interface Resposta {
  status: number;
  corpo: any;
}

const tokens = new Map<string, string>();

async function entrar(email: string): Promise<string> {
  const guardado = tokens.get(email);
  if (guardado) return guardado;

  const r = await fetch(BASE + '/api/autenticacao/entrar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, senha: SENHA }),
  });

  if (!r.ok) throw new Error('Não consegui entrar como ' + email + ' (' + r.status + ')');

  const { token } = (await r.json()) as { token: string };
  tokens.set(email, token);
  return token;
}

async function chamar(
  caminho: string,
  opcoes: { metodo?: string; email?: string; corpo?: unknown } = {},
): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { 'content-type': 'application/json' };
  if (opcoes.email) cabecalhos.authorization = 'Bearer ' + (await entrar(opcoes.email));

  const r = await fetch(BASE + caminho, {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });

  const texto = await r.text();
  let corpo: any = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = texto;
  }

  if (!r.ok) {
    throw new Error(
      (opcoes.metodo ?? 'GET') + ' ' + caminho + ' respondeu ' + r.status + ': ' +
        JSON.stringify(corpo).slice(0, 300),
    );
  }

  return { status: r.status, corpo };
}

// ------------------------------------------------------------
//  Pessoas do roteiro
// ------------------------------------------------------------

// Quem pede não pode assinar o próprio pedido, então o
// solicitante e os aprovadores são pessoas diferentes.
const SOLICITANTE = 'neilma@portoinc.com.br';
const COMPRADOR = 'andre@portoinc.com.br';
const ALMOXARIFE = 'gilson@portoinc.com.br';

/**
 * Assina até a solicitação ficar aprovada.
 *
 * Quantas assinaturas são necessárias depende do valor: a alçada
 * decide. Em vez de adivinhar a faixa, oferecemos a solicitação a
 * cada aprovador e paramos quando ela sai da fila.
 */
const APROVADORES = [
  'bras@portoinc.com.br',          // gestor da obra
  'engenheiro@portoinc.com.br',    // engenheiro
  'washington@portoinc.com.br',    // fundador
];

async function aprovar(solicitacaoId: string) {
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
        corpo: { decisao: 'APROVADA', observacao: 'Aprovado conforme planejamento da obra.' },
      });
    } catch {
      // Esta função não é exigida nesta faixa. Tenta a próxima.
    }
  }

  const fim = await banco.solicitacao.findUnique({
    where: { id: solicitacaoId },
    select: { situacao: true },
  });

  if (fim?.situacao !== 'APROVADA') {
    throw new Error('A solicitação parou em ' + fim?.situacao + ' e não virou compra.');
  }
}

function emDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

function sortear<T>(lista: T[], semente: number): T {
  return lista[semente % lista.length];
}

// ------------------------------------------------------------
//  O roteiro: cada entrada vira uma compra completa
// ------------------------------------------------------------

interface Roteiro {
  /** Há quantos dias essa compra começou. */
  diasAtras: number;
  obra: string;
  titulo: string;
  /** Códigos do catálogo que entram na compra. */
  materiais: string[];
  quantidade: number;
  /** Fornecedores convidados, por nome fantasia. */
  convidados: string[];
  /** Quantos deles respondem. */
  respondem: number;
  /** Dias entre o pedido e a entrega, por fornecedor vencedor. */
  diasDeEntrega: number;
  /** Prazo que o vencedor prometeu. */
  prazoPrometido: number;
  /** 'CONFORME' | 'COM_RESSALVA' | 'DEVOLVIDO' | 'NAO_ENTREGUE' */
  comoChegou: string;
}

const ROTEIRO: Roteiro[] = [
  {
    diasAtras: 300, obra: 'OB-001', titulo: 'Cimento e areia — fundação',
    materiais: ['00119', '00210'], quantidade: 120,
    convidados: ['Marquilip', 'Constrular'], respondem: 2,
    diasDeEntrega: 6, prazoPrometido: 7, comoChegou: 'CONFORME',
  },
  {
    diasAtras: 270, obra: 'OB-001', titulo: 'Aço para pilares',
    materiais: ['00046', '00068'], quantidade: 400,
    convidados: ['Marquilip'], respondem: 1,
    diasDeEntrega: 12, prazoPrometido: 8, comoChegou: 'CONFORME',
  },
  {
    diasAtras: 240, obra: 'OB-002', titulo: 'Material elétrico — 1º pavimento',
    materiais: ['00087', '00089'], quantidade: 60,
    convidados: ['Eletrosul'], respondem: 1,
    diasDeEntrega: 9, prazoPrometido: 10, comoChegou: 'CONFORME',
  },
  {
    diasAtras: 210, obra: 'OB-001', titulo: 'Brita para contrapiso',
    materiais: ['00211'], quantidade: 80,
    convidados: ['Marquilip', 'Constrular'], respondem: 2,
    diasDeEntrega: 5, prazoPrometido: 5, comoChegou: 'COM_RESSALVA',
  },
  {
    diasAtras: 180, obra: 'OB-002', titulo: 'Hidráulica — prumadas',
    materiais: ['00028', '00201'], quantidade: 90,
    convidados: ['Hidromax'], respondem: 1,
    diasDeEntrega: 15, prazoPrometido: 7, comoChegou: 'CONFORME',
  },
  {
    diasAtras: 150, obra: 'OB-003', titulo: 'EPI para a equipe',
    materiais: ['00131', '00134'], quantidade: 50,
    convidados: ['Segurança Total'], respondem: 1,
    diasDeEntrega: 4, prazoPrometido: 5, comoChegou: 'CONFORME',
  },
  {
    diasAtras: 120, obra: 'OB-001', titulo: 'Argamassa — revestimento',
    materiais: ['00206', '00207'], quantidade: 300,
    convidados: ['Constrular', 'Marquilip'], respondem: 2,
    diasDeEntrega: 7, prazoPrometido: 7, comoChegou: 'CONFORME',
  },
  {
    diasAtras: 95, obra: 'OB-002', titulo: 'Cimento — laje do 3º',
    materiais: ['00119'], quantidade: 250,
    convidados: ['Marquilip', 'Constrular'], respondem: 2,
    diasDeEntrega: 20, prazoPrometido: 10, comoChegou: 'COM_RESSALVA',
  },
  {
    diasAtras: 75, obra: 'OB-003', titulo: 'Elétrica do galpão',
    materiais: ['00088'], quantidade: 120,
    convidados: ['Eletrosul'], respondem: 1,
    diasDeEntrega: 8, prazoPrometido: 10, comoChegou: 'CONFORME',
  },
  {
    diasAtras: 55, obra: 'OB-001', titulo: 'Reposição de areia',
    materiais: ['00210'], quantidade: 60,
    convidados: ['Marquilip', 'Constrular'], respondem: 1,
    diasDeEntrega: 6, prazoPrometido: 6, comoChegou: 'CONFORME',
  },
  {
    diasAtras: 40, obra: 'OB-002', titulo: 'Louças e metais',
    materiais: ['00204'], quantidade: 40,
    convidados: ['Hidromax'], respondem: 1,
    diasDeEntrega: 11, prazoPrometido: 7, comoChegou: 'DEVOLVIDO',
  },
  {
    diasAtras: 25, obra: 'OB-003', titulo: 'EPI — reposição trimestral',
    materiais: ['00131'], quantidade: 30,
    convidados: ['Segurança Total'], respondem: 1,
    diasDeEntrega: 3, prazoPrometido: 5, comoChegou: 'CONFORME',
  },
  {
    diasAtras: 14, obra: 'OB-001', titulo: 'Cimento — última etapa',
    materiais: ['00119'], quantidade: 180,
    convidados: ['Marquilip', 'Constrular'], respondem: 2,
    diasDeEntrega: 0, prazoPrometido: 7, comoChegou: 'NAO_ENTREGUE',
  },
];

// ------------------------------------------------------------
//  Locação de equipamentos
//
//  Três situações, porque são as três que a tela precisa saber
//  mostrar: uma parada além do prazo (a que custa dinheiro),
//  uma chegando no fim e uma tranquila. Mais uma já devolvida,
//  para o histórico não ficar só com o que está em aberto.
// ------------------------------------------------------------

interface Aluguel {
  obra: string;
  equipamento: string;
  identificacao: string | null;
  quantidade: number;
  unidade: string;
  periodicidade: 'DIARIA' | 'SEMANAL' | 'MENSAL';
  valorPeriodo: number;
  /** Há quantos dias começou. */
  comecouHa: number;
  /** Em quantos dias vence, a contar de hoje. Negativo = já venceu. */
  venceEm: number;
  /** Há quantos dias voltou. Nulo: ainda está na obra. */
  voltouHa: number | null;
}

const ALUGUEIS: Aluguel[] = [
  {
    obra: 'OB-001', equipamento: 'Betoneira 400L', identificacao: 'BET-014',
    quantidade: 1, unidade: 'DIA', periodicidade: 'DIARIA', valorPeriodo: 65,
    comecouHa: 40, venceEm: -12, voltouHa: null,
  },
  {
    obra: 'OB-002', equipamento: 'Andaime tubular', identificacao: null,
    quantidade: 400, unidade: 'M', periodicidade: 'MENSAL', valorPeriodo: 12,
    comecouHa: 26, venceEm: 2, voltouHa: null,
  },
  {
    obra: 'OB-003', equipamento: 'Compactador de solo', identificacao: 'CMP-002',
    quantidade: 1, unidade: 'UN', periodicidade: 'SEMANAL', valorPeriodo: 380,
    comecouHa: 6, venceEm: 24, voltouHa: null,
  },
  {
    obra: 'OB-001', equipamento: 'Gerador 15 kVA', identificacao: 'GER-007',
    quantidade: 1, unidade: 'UN', periodicidade: 'DIARIA', valorPeriodo: 140,
    comecouHa: 95, venceEm: -60, voltouHa: 58,
  },
];

async function criarLocacoes(
  obraPorCodigo: Map<string, string>,
  fornecedorPorNome: Map<string, string>,
  jaExistem: number,
) {
  if (jaExistem > 0) {
    console.log('  [historico] Já existem ' + jaExistem + ' locações. Nada a criar.');
    return;
  }

  const locadora = fornecedorPorNome.get('LocaMaq');
  if (!locadora) {
    console.log('  [historico] Fornecedor LocaMaq não existe. Locações puladas.');
    return;
  }

  const comprador = await banco.usuario.findUnique({
    where: { email: COMPRADOR },
    select: { id: true },
  });
  if (!comprador) return;

  let feitas = 0;

  for (const a of ALUGUEIS) {
    const obraId = obraPorCodigo.get(a.obra);
    if (!obraId) continue;

    const dataDe = (dias: number) => {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      d.setHours(12, 0, 0, 0);
      return d;
    };

    await banco.contratoLocacao.create({
      data: {
        fornecedorId: locadora,
        obraId,
        descricao: a.equipamento,
        identificacao: a.identificacao,
        quantidade: a.quantidade,
        unidadeMedida: a.unidade,
        periodicidade: a.periodicidade,
        valorPeriodo: a.valorPeriodo,
        inicioEm: dataDe(-a.comecouHa),
        previsaoDevolucao: dataDe(a.venceEm),
        devolvidoEm: a.voltouHa === null ? null : dataDe(-a.voltouHa),
        situacao: a.voltouHa === null ? 'ATIVA' : 'DEVOLVIDA',
        motivo: a.voltouHa === null ? null : 'Retirado pelo fornecedor.',
        responsavelId: comprador.id,
        devolvidoPorId: a.voltouHa === null ? null : comprador.id,
        observacoes: 'Contrato de demonstração.',
      },
    });

    feitas += 1;
  }

  console.log('  [historico] ' + feitas + ' contrato(s) de locação.');
}

// ------------------------------------------------------------
//  Solicitações esperando aprovação
//
//  Sem elas, a tela de Aprovações abre vazia — e é justamente a
//  tela que mostra a alçada funcionando. Os três valores caem em
//  faixas diferentes de propósito:
//
//    até R$ 2.000      o gestor da obra assina sozinho
//    R$ 2.000 a 15.000 exige gestor E engenheiro, os dois
//    acima de 15.000   sobe para o fundador
// ------------------------------------------------------------

interface Pendente {
  obra: string;
  material: string;
  quantidade: number;
  /** Preço unitário estimado, que decide a faixa da alçada. */
  estimado: number;
  justificativa: string;
}

const PENDENTES: Pendente[] = [
  {
    obra: 'OB-001', material: '00131', quantidade: 20, estimado: 53,
    justificativa: 'Reposição de EPI para a equipe nova da alvenaria.',
  },
  {
    obra: 'OB-002', material: '00119', quantidade: 300, estimado: 22,
    justificativa: 'Concretagem da laje do 4º pavimento, prevista para o mês que vem.',
  },
  {
    obra: 'OB-003', material: '00046', quantidade: 900, estimado: 25,
    justificativa: 'Estrutura do galpão. Volume alto; precisa da aprovação da diretoria.',
  },
];

async function criarPendentes(
  obraPorCodigo: Map<string, string>,
  materialPorCodigo: Map<string, { id: string; codigoInterno: string; descricao: string }>,
  jaExistem: number,
) {
  if (jaExistem > 0) {
    console.log('  [historico] Já existem ' + jaExistem + ' solicitações na fila. Nada a criar.');
    return;
  }

  let feitas = 0;

  for (const pedido of PENDENTES) {
    const obraId = obraPorCodigo.get(pedido.obra);
    const material = materialPorCodigo.get(pedido.material);
    if (!obraId || !material) continue;

    const criada = await chamar('/api/solicitacoes', {
      metodo: 'POST', email: SOLICITANTE,
      corpo: {
        obraId,
        justificativa: pedido.justificativa,
        itens: [{
          materialId: material.id,
          quantidade: pedido.quantidade,
          valorEstimado: pedido.estimado,
          especificacaoTecnica: 'Conforme norma aplicável.',
        }],
      },
    });

    // Envia e PARA por aqui: é este o estado que queremos mostrar.
    await chamar('/api/solicitacoes/' + criada.corpo.solicitacao.id + '/enviar', {
      metodo: 'POST', email: SOLICITANTE,
    });

    feitas += 1;
  }

  console.log('  [historico] ' + feitas + ' solicitação(ões) esperando aprovação.');
}

async function principal() {
  if (process.env.NODE_ENV === 'production') {
    console.log('  [historico] Ambiente de produção: nada foi criado.');
    return;
  }

  console.log('  [historico] Conferindo se a API está de pé em ' + BASE + ' ...');
  await chamar('/health');

  // Rodar duas vezes não pode dobrar a história: os relatórios
  // passariam a contar a mesma compra duas vezes.
  const jaTemCompras = await banco.bid.count();
  const jaTemLocacoes = await banco.contratoLocacao.count();
  const jaTemPendentes = await banco.solicitacao.count({
    where: { situacao: 'AGUARDANDO_APROVACAO' },
  });

  const obras = await banco.obra.findMany({ select: { id: true, codigo: true } });
  const obraPorCodigo = new Map(obras.map((o) => [o.codigo, o.id]));

  const materiais = await banco.material.findMany({
    select: { id: true, codigoInterno: true, descricao: true },
  });
  const materialPorCodigo = new Map(materiais.map((m) => [m.codigoInterno, m]));

  const fornecedores = await banco.fornecedor.findMany({
    select: { id: true, nomeFantasia: true },
  });
  const fornecedorPorNome = new Map(fornecedores.map((f) => [f.nomeFantasia ?? '', f.id]));

  let feitas = 0;

  if (jaTemCompras > 0) {
    console.log(
      '  [historico] Já existem ' + jaTemCompras + ' cotações. As compras não serão recriadas.',
    );
  }

  for (const [indice, passo] of jaTemCompras > 0 ? [] : ROTEIRO.entries()) {
    const obraId = obraPorCodigo.get(passo.obra);
    if (!obraId) {
      console.log('  [historico] Obra ' + passo.obra + ' não existe. Pulando.');
      continue;
    }

    const itensDoCatalogo = passo.materiais
      .map((c) => materialPorCodigo.get(c))
      .filter((m): m is NonNullable<typeof m> => !!m);

    if (itensDoCatalogo.length === 0) {
      console.log('  [historico] Nenhum material de ' + passo.titulo + ' existe. Pulando.');
      continue;
    }

    // ---- 1. Solicitação -------------------------------------
    const criada = await chamar('/api/solicitacoes', {
      metodo: 'POST', email: SOLICITANTE,
      corpo: {
        obraId,
        justificativa: passo.titulo + '. Programação da obra.',
        itens: itensDoCatalogo.map((m) => ({
          materialId: m.id,
          quantidade: passo.quantidade,
          valorEstimado: 20 + (indice % 5) * 8,
          especificacaoTecnica: 'Conforme norma aplicável.',
        })),
      },
    });

    const solicitacaoId = criada.corpo.solicitacao.id as string;

    await chamar('/api/solicitacoes/' + solicitacaoId + '/enviar', {
      metodo: 'POST', email: SOLICITANTE,
    });

    // ---- 2. Aprovação ---------------------------------------
    await aprovar(solicitacaoId);

    // ---- 3. Cotação -----------------------------------------
    const detalhe = await chamar('/api/solicitacoes/' + solicitacaoId, { email: SOLICITANTE });
    const idsDosItens = detalhe.corpo.solicitacao.itens.map((i: { id: string }) => i.id);

    const bid = await chamar('/api/cotacoes', {
      metodo: 'POST', email: COMPRADOR,
      corpo: { titulo: passo.titulo, prazoResposta: emDias(7), itens: idsDosItens },
    });
    const bidId = bid.corpo.cotacao.id as string;

    const convidados = passo.convidados
      .map((n) => fornecedorPorNome.get(n))
      .filter((id): id is string => !!id);

    await chamar('/api/cotacoes/' + bidId + '/fornecedores', {
      metodo: 'POST', email: COMPRADOR, corpo: { fornecedores: convidados },
    });

    const aberto = await chamar('/api/cotacoes/' + bidId + '/abrir', {
      metodo: 'POST', email: COMPRADOR,
    });
    const cotacao = aberto.corpo.cotacao;

    // ---- 4. Respostas dos fornecedores ----------------------
    // O primeiro convidado dá o melhor preço; os outros pioram um
    // pouco, para que a coluna "ganho na disputa" tenha sentido.
    const respondem = cotacao.convidados.slice(0, passo.respondem);

    for (const [posicao, convite] of respondem.entries()) {
      const base = 18 + (indice % 6) * 7;

      await chamar('/api/portal/' + convite.token, {
        metodo: 'POST',
        corpo: {
          itens: cotacao.itens.map((item: { id: string }, j: number) => ({
            bidItemId: item.id,
            disponivel: true,
            valorUnitario: base + posicao * 4 + j,
            prazoEntregaDias: passo.prazoPrometido + posicao,
            marca: sortear(['Votoran', 'Gerdau', 'Tigre', 'Genérica'], indice + j),
          })),
          valorFrete: 80 + (indice % 4) * 40,
          percentualEntrada: 30,
          quantidadeParcelas: 2,
          intervaloParcelasDias: 30,
          observacaoFornecedor: 'Proposta válida por 10 dias.',
        },
      });
    }

    await chamar('/api/cotacoes/' + bidId + '/encerrar', { metodo: 'POST', email: COMPRADOR });

    // ---- 5. Escolha e pedido --------------------------------
    const vencedor = respondem[0];

    await chamar('/api/cotacoes/' + bidId + '/escolhas', {
      metodo: 'POST', email: COMPRADOR,
      corpo: {
        escolhas: cotacao.itens.map((item: { id: string }) => ({
          bidItemId: item.id,
          bidFornecedorId: vencedor.id,
        })),
      },
    });

    const gerados = await chamar('/api/cotacoes/' + bidId + '/gerar-pedidos', {
      metodo: 'POST', email: COMPRADOR,
    });

    const pedido = gerados.corpo.pedidos[0];

    // ---- 6. Recebimento -------------------------------------
    if (passo.comoChegou !== 'NAO_ENTREGUE') {
      const paraConferir = await chamar('/api/recebimentos/pedido/' + pedido.numero, {
        email: ALMOXARIFE,
      });

      const almoxarifado =
        paraConferir.corpo.almoxarifados.find((a: { obra?: { codigo: string } }) =>
          a.obra?.codigo === passo.obra,
        ) ?? paraConferir.corpo.almoxarifados[0];

      const devolvido = passo.comoChegou === 'DEVOLVIDO';

      await chamar('/api/recebimentos', {
        metodo: 'POST', email: ALMOXARIFE,
        corpo: {
          pedidoId: pedido.id,
          almoxarifadoId: almoxarifado.id,
          notaFiscal: String(100000 + indice),
          serieNotaFiscal: '1',
          transportadora: sortear(['Rodoporto', 'TransBrasil', 'Entrega própria'], indice),
          itens: paraConferir.corpo.itens.map(
            (i: { pedidoItemId: string; saldo: number }) => ({
              pedidoItemId: i.pedidoItemId,
              quantidadeRecebida: devolvido ? Math.floor(i.saldo * 0.8) : i.saldo,
              quantidadeDevolvida: devolvido ? i.saldo - Math.floor(i.saldo * 0.8) : 0,
              situacao: passo.comoChegou === 'CONFORME' ? 'CONFORME' : passo.comoChegou,
              motivo:
                passo.comoChegou === 'COM_RESSALVA'
                  ? 'Embalagem danificada no transporte; material aceito.'
                  : devolvido
                    ? 'Parte da carga fora da especificação. Devolvida ao entregador.'
                    : undefined,
            }),
          ),
        },
      });
    }

    // ---- 7. Recuar as datas ---------------------------------
    await recuarDatas(solicitacaoId, bidId, pedido.id, passo);

    feitas += 1;
    console.log(
      '  [historico] ' + feitas + '/' + ROTEIRO.length + '  ' + passo.obra +
        '  ' + passo.titulo,
    );
  }

  await criarLocacoes(obraPorCodigo, fornecedorPorNome, jaTemLocacoes);
  await criarPendentes(obraPorCodigo, materialPorCodigo, jaTemPendentes);

  console.log('  [historico] Pronto. ' + feitas + ' compra(s) criada(s) nesta rodada.');
}

/**
 * Recua os carimbos de tempo para que a compra pareça ter
 * acontecido meses atrás.
 *
 * Mexe SÓ em data. Valor, quantidade e situação continuam sendo
 * o que a API gravou, então os relatórios continuam contando a
 * verdade sobre o que aconteceu — só que espalhada no tempo.
 */
async function recuarDatas(
  solicitacaoId: string,
  bidId: string,
  pedidoId: string,
  passo: Roteiro,
) {
  const base = new Date();
  base.setDate(base.getDate() - passo.diasAtras);

  const em = (dias: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + dias);
    return d;
  };

  const criada = em(0);
  const enviada = em(1);
  const aprovada = em(1 + (passo.diasAtras % 3));
  const encerrada = em(5 + (passo.diasAtras % 4));
  const pedidoEm = em(7 + (passo.diasAtras % 3));
  const entregue = em(7 + (passo.diasAtras % 3) + passo.diasDeEntrega);

  await banco.solicitacao.update({
    where: { id: solicitacaoId },
    data: { criadaEm: criada, enviadaEm: enviada, decididaEm: aprovada },
  });

  await banco.solicitacaoEvento.updateMany({
    where: { solicitacaoId },
    data: { criadoEm: enviada },
  });

  await banco.aprovacao.updateMany({
    where: { solicitacaoId },
    data: { criadaEm: aprovada },
  });

  await banco.bid.update({
    where: { id: bidId },
    data: { criadoEm: aprovada, abertoEm: aprovada, encerradoEm: encerrada },
  });

  await banco.bidFornecedor.updateMany({
    where: { bidId },
    data: { criadoEm: aprovada, respondidoEm: em(4 + (passo.diasAtras % 3)) },
  });

  await banco.pedido.update({
    where: { id: pedidoId },
    data: { criadoEm: pedidoEm, enviadoEm: pedidoEm, confirmadoEm: pedidoEm },
  });

  const recebimentos = await banco.recebimento.findMany({
    where: { pedidoId },
    select: { id: true },
  });

  if (recebimentos.length > 0) {
    await banco.recebimento.updateMany({
      where: { pedidoId },
      data: { recebidoEm: entregue },
    });

    await banco.movimentoEstoque.updateMany({
      where: { recebimentoItem: { recebimentoId: { in: recebimentos.map((r) => r.id) } } },
      data: { criadoEm: entregue },
    });
  }
}

principal()
  .catch((e) => {
    console.error('  [historico] Falhou: ' + (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => banco.$disconnect());
