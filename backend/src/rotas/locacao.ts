// ============================================================
//  Locação de equipamentos
//
//  A contratação passa pelo fluxo normal — solicitação, aprovação,
//  cotação e pedido —, porque o item de locação já existe no
//  catálogo como serviço da família LOC. Estas rotas cuidam do que
//  vem DEPOIS: onde o equipamento está, quanto já custou e quando
//  precisa voltar.
//
//  Também dá para lançar um contrato avulso, sem pedido: locação
//  de emergência acontece, e o sistema não pode obrigar a pessoa a
//  mentir para registrar o que já está no canteiro.
// ============================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { lerPaginacao, camposDaPagina } from '../servicos/paginacao.js';
import { numero, erroDeValidacao, textoOpcional, textoObrigatorio } from '../servicos/util.js';
import { dataBr } from '../servicos/data-br.js';
import {
  custoAcumulado, custoPrevisto, custoDoAtraso, diasDeAtraso, diasDeUso,
  periodosCobrados, alertaDe, lerContrato, resumirLocacoes,
  conferirContrato, conferirDevolucao, conferirCancelamento,
  formatarNumero, ROTULO_ALERTA, ROTULO_PERIODO,
  type ContratoParaConta, type Periodo, type SituacaoLocacao, type Alerta,
} from '../servicos/locacao.js';
import {
  gerarArquivoDaTabela, formatoValido, type FormatoArquivo,
} from '../servicos/tabela-arquivo.js';

const PERIODOS = ['DIARIA', 'SEMANAL', 'MENSAL'] as const;

const esquemaContrato = z.object({
  fornecedorId: z.string().uuid('Escolha o fornecedor.'),
  obraId: z.string().uuid('Escolha a obra.'),
  materialId: z.string().uuid().nullable().optional(),
  pedidoItemId: z.string().uuid().nullable().optional(),
  descricao: textoObrigatorio(3, 'A descrição do equipamento'),
  identificacao: textoOpcional(120),
  quantidade: z.coerce.number().positive('A quantidade precisa ser maior que zero.'),
  unidadeMedida: textoObrigatorio(1, 'A unidade'),
  periodicidade: z.enum(PERIODOS),
  valorPeriodo: z.coerce.number().positive('O valor do período precisa ser maior que zero.'),
  inicioEm: z.string().date('Informe a data de início.'),
  previsaoDevolucao: z.string().date('Informe a data prevista de devolução.'),
  observacoes: textoOpcional(1000),
});

const esquemaDevolucao = z.object({
  devolvidoEm: z.string().date().optional(),
  motivo: textoOpcional(500),
});

/** Data que veio como "2026-09-22", no fuso de quem digitou. */
function data(iso: string): Date {
  return new Date(iso + 'T12:00:00');
}

function hojeAoMeioDia(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

const INCLUIR = {
  fornecedor: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
  obra: { select: { id: true, codigo: true, nome: true } },
  material: { select: { id: true, codigoInterno: true, descricao: true } },
  responsavel: { select: { id: true, nome: true } },
  devolvidoPor: { select: { id: true, nome: true } },
  pedidoItem: {
    select: { id: true, pedido: { select: { id: true, numero: true } } },
  },
} as const;

type ContratoCompleto = Awaited<
  ReturnType<typeof banco.contratoLocacao.findFirstOrThrow<{ include: typeof INCLUIR }>>
>;

/** Transforma a linha do banco no formato que as contas esperam. */
function paraConta(c: ContratoCompleto): ContratoParaConta {
  return {
    quantidade: numero(c.quantidade) ?? 0,
    periodicidade: c.periodicidade as Periodo,
    valorPeriodo: numero(c.valorPeriodo) ?? 0,
    inicioEm: c.inicioEm,
    previsaoDevolucao: c.previsaoDevolucao,
    devolvidoEm: c.devolvidoEm,
    situacao: c.situacao as SituacaoLocacao,
  };
}

function formatar(c: ContratoCompleto, hoje: Date) {
  const conta = paraConta(c);
  const alerta = alertaDe(conta, hoje);

  return {
    id: c.id,
    numero: c.numero,
    numeroFormatado: formatarNumero(c.numero),
    situacao: c.situacao,
    alerta,
    alertaRotulo: ROTULO_ALERTA[alerta as Alerta],
    leitura: lerContrato(conta, hoje),

    fornecedor: c.fornecedor,
    obra: c.obra,
    material: c.material,
    pedido: c.pedidoItem?.pedido
      ? { id: c.pedidoItem.pedido.id, numero: c.pedidoItem.pedido.numero }
      : null,

    descricao: c.descricao,
    identificacao: c.identificacao,
    quantidade: numero(c.quantidade) ?? 0,
    unidadeMedida: c.unidadeMedida,

    periodicidade: c.periodicidade,
    periodicidadeRotulo: ROTULO_PERIODO[c.periodicidade as Periodo],
    valorPeriodo: numero(c.valorPeriodo) ?? 0,

    inicioEm: c.inicioEm,
    previsaoDevolucao: c.previsaoDevolucao,
    devolvidoEm: c.devolvidoEm,

    diasDeUso: diasDeUso(conta, hoje),
    periodosCobrados: periodosCobrados(conta, hoje),
    custoAcumulado: custoAcumulado(conta, hoje),
    custoPrevisto: custoPrevisto(conta),
    diasDeAtraso: diasDeAtraso(conta, hoje),
    custoDoAtraso: custoDoAtraso(conta, hoje),

    observacoes: c.observacoes,
    motivo: c.motivo,
    responsavel: c.responsavel,
    devolvidoPor: c.devolvidoPor,
    criadoEm: c.criadoEm,
  };
}

export async function rotasLocacao(app: FastifyInstance) {
  const verLocacao = { preHandler: app.exigirPermissao('locacao.ver') };
  const gerenciarLocacao = { preHandler: app.exigirPermissao('locacao.gerenciar') };

  // --------------------------------------------------------
  //  Painel: a lista com o resumo em cima
  // --------------------------------------------------------
  app.get('/api/locacao', verLocacao, async (req, reply) => {
    const q = req.query as {
      obraId?: string;
      situacao?: string;
      alerta?: string;
      formato?: string;
    };

    const hoje = hojeAoMeioDia();

    const contratos = await banco.contratoLocacao.findMany({
      where: {
        ...(q.obraId ? { obraId: q.obraId } : {}),
        ...(q.situacao ? { situacao: q.situacao as SituacaoLocacao } : {}),
      },
      include: INCLUIR,
      // O que está atrasado aparece primeiro: é o que custa dinheiro.
      orderBy: [{ situacao: 'asc' }, { previsaoDevolucao: 'asc' }],
    });

    const todos = contratos.map((c) => formatar(c, hoje));
    const lista = q.alerta ? todos.filter((c) => c.alerta === q.alerta) : todos;

    const resumo = resumirLocacoes(contratos.map(paraConta), hoje);

    const obras = await banco.obra.findMany({
      where: { ativa: true },
      orderBy: [{ codigo: 'asc' }],
      select: { id: true, codigo: true, nome: true },
    });

    // O arquivo leva a lista INTEIRA, não a página. Quem baixa o
    // relatório quer o relatório, e não a tela que estava abrindo.
    if (q.formato) {
      if (!formatoValido(q.formato)) {
        return reply.status(400).send({ erro: 'Formato não suportado. Escolha "pdf" ou "docx".' });
      }

      return entregarArquivo(reply, lista, resumo, obras, q, q.formato);
    }

    // Aqui a página é cortada na memória, e só aqui no sistema.
    //
    // As outras oito listas cortam no banco, com skip/take, que é o
    // certo. Esta não pode: "alerta" (atrasado, vence hoje, no
    // prazo) e o custo acumulado não existem como coluna — são
    // CONTA feita em cima da data de hoje, e o banco não sabe
    // fazê-la. Cortar antes seria filtrar o alerta dentro de uma
    // página só, e o resumo de cima — quanto está no pátio, quanto
    // está atrasado — contaria apenas os vinte da tela.
    //
    // O custo é carregar a tabela de contratos a cada abertura do
    // painel. É aceitável porque contrato de locação é coisa de
    // dezenas por ano, não de milhares: cada um é um equipamento
    // alugado de verdade. Se um dia passar de alguns milhares, o
    // caminho é guardar o alerta como coluna, atualizada por tarefa
    // diária — e aí esta rota passa a cortar no banco como as outras.
    const pedido = lerPaginacao(q as { pagina?: string; porPagina?: string });
    const daPagina = lista.slice(pedido.pular, pedido.pular + pedido.porPagina);

    // O que precisa de ação, de TODAS as páginas.
    //
    // A tela montava este bloco filtrando os contratos que tinha
    // em mão. Com página, ele passaria a avisar só do que estivesse
    // nas vinte linhas abertas — e um andaime esquecido na página 4
    // deixaria de aparecer justamente no lugar feito para não
    // deixar esquecer.
    //
    // Vinte é o teto do bloco: ele é um lembrete, não um relatório.
    // Quando passa disso, a conta do resto é mais útil que a
    // vigésima primeira linha.
    const urgentes = lista.filter(
      (c) => c.alerta === 'ATRASADA' || c.alerta === 'PERTO' || c.alerta === 'VENCE_HOJE',
    );

    return {
      contratos: daPagina,
      resumo,
      obras,
      aFazer: urgentes.slice(0, 20),
      aFazerTotal: urgentes.length,
      ...camposDaPagina(lista.length, pedido),
    };
  });

  // --------------------------------------------------------
  //  Um contrato
  // --------------------------------------------------------
  app.get('/api/locacao/:id', verLocacao, async (req, reply) => {
    const { id } = req.params as { id: string };

    const c = await banco.contratoLocacao.findUnique({ where: { id }, include: INCLUIR });
    if (!c) return reply.status(404).send({ erro: 'Locação não encontrada.' });

    return { contrato: formatar(c, hojeAoMeioDia()) };
  });

  // --------------------------------------------------------
  //  Itens de pedido que ainda viraram contrato
  //
  //  É a ponte com o fluxo de compra: o comprador escolhe o item
  //  de locação já comprado e o sistema preenche o resto.
  // --------------------------------------------------------
  app.get('/api/locacao/pedidos-disponiveis', gerenciarLocacao, async () => {
    const itens = await banco.pedidoItem.findMany({
      where: {
        locacao: null,
        pedido: { situacao: { not: 'CANCELADO' } },
        bidItem: { material: { familia: { codigo: 'LOC' } } },
      },
      select: {
        id: true,
        quantidade: true,
        unidadeMedida: true,
        valorUnitario: true,
        prazoEntregaDias: true,
        pedido: {
          select: {
            id: true, numero: true, criadoEm: true, enviadoEm: true,
            fornecedor: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
          },
        },
        bidItem: {
          select: {
            material: { select: { id: true, codigoInterno: true, descricao: true } },
            solicitacaoItem: {
              select: { solicitacao: { select: { obra: { select: { id: true, codigo: true, nome: true } } } } },
            },
          },
        },
      },
      orderBy: [{ pedido: { numero: 'desc' } }],
      take: 100,
    });

    return {
      itens: itens.map((i) => ({
        pedidoItemId: i.id,
        pedidoId: i.pedido.id,
        pedidoNumero: i.pedido.numero,
        fornecedor: i.pedido.fornecedor,
        obra: i.bidItem.solicitacaoItem.solicitacao.obra,
        material: i.bidItem.material,
        quantidade: numero(i.quantidade) ?? 0,
        unidadeMedida: i.unidadeMedida,
        valorUnitario: numero(i.valorUnitario) ?? 0,
        prazoEntregaDias: i.prazoEntregaDias,
        saiuEm: i.pedido.enviadoEm ?? i.pedido.criadoEm,
      })),
    };
  });

  // --------------------------------------------------------
  //  Contratar
  // --------------------------------------------------------
  app.post('/api/locacao', gerenciarLocacao, async (req, reply) => {
    const dados = esquemaContrato.safeParse(req.body);
    if (!dados.success) return reply.status(400).send(erroDeValidacao(dados.error));

    const inicioEm = data(dados.data.inicioEm);
    const previsaoDevolucao = data(dados.data.previsaoDevolucao);

    const conferido = conferirContrato({
      inicioEm,
      previsaoDevolucao,
      valorPeriodo: dados.data.valorPeriodo,
      quantidade: dados.data.quantidade,
    });

    if (!conferido.ok) return reply.status(400).send({ erro: conferido.erro });

    const obra = await banco.obra.findUnique({ where: { id: dados.data.obraId } });
    if (!obra) return reply.status(400).send({ erro: 'Obra não encontrada.' });

    const fornecedor = await banco.fornecedor.findUnique({
      where: { id: dados.data.fornecedorId },
    });
    if (!fornecedor) return reply.status(400).send({ erro: 'Fornecedor não encontrado.' });

    // Um item de pedido vira UM contrato. A trava está no banco,
    // mas o aviso aqui é mais claro que um erro de chave duplicada.
    if (dados.data.pedidoItemId) {
      const jaTem = await banco.contratoLocacao.findUnique({
        where: { pedidoItemId: dados.data.pedidoItemId },
        select: { numero: true },
      });

      if (jaTem) {
        return reply.status(409).send({
          erro: 'Este item de pedido já virou a locação ' + formatarNumero(jaTem.numero) + '.',
        });
      }
    }

    const criado = await banco.contratoLocacao.create({
      data: {
        fornecedorId: dados.data.fornecedorId,
        obraId: dados.data.obraId,
        materialId: dados.data.materialId ?? null,
        pedidoItemId: dados.data.pedidoItemId ?? null,
        descricao: dados.data.descricao,
        identificacao: dados.data.identificacao,
        quantidade: dados.data.quantidade,
        unidadeMedida: dados.data.unidadeMedida,
        periodicidade: dados.data.periodicidade,
        valorPeriodo: dados.data.valorPeriodo,
        inicioEm,
        previsaoDevolucao,
        observacoes: dados.data.observacoes,
        responsavelId: req.usuario!.id,
      },
      include: INCLUIR,
    });

    return reply.status(201).send({ contrato: formatar(criado, hojeAoMeioDia()) });
  });

  // --------------------------------------------------------
  //  Devolver
  // --------------------------------------------------------
  app.post('/api/locacao/:id/devolver', gerenciarLocacao, async (req, reply) => {
    const { id } = req.params as { id: string };
    const dados = esquemaDevolucao.safeParse(req.body ?? {});
    if (!dados.success) return reply.status(400).send(erroDeValidacao(dados.error));

    const atual = await banco.contratoLocacao.findUnique({ where: { id } });
    if (!atual) return reply.status(404).send({ erro: 'Locação não encontrada.' });

    const devolvidoEm = dados.data.devolvidoEm ? data(dados.data.devolvidoEm) : hojeAoMeioDia();

    const conferido = conferirDevolucao(
      { situacao: atual.situacao as SituacaoLocacao, inicioEm: atual.inicioEm },
      devolvidoEm,
    );

    if (!conferido.ok) return reply.status(409).send({ erro: conferido.erro });

    const salvo = await banco.contratoLocacao.update({
      where: { id },
      data: {
        situacao: 'DEVOLVIDA',
        devolvidoEm,
        motivo: dados.data.motivo,
        devolvidoPorId: req.usuario!.id,
      },
      include: INCLUIR,
    });

    const pronto = formatar(salvo, hojeAoMeioDia());

    return {
      contrato: pronto,
      mensagem: pronto.diasDeAtraso > 0
        ? 'Devolução registrada com ' + pronto.diasDeAtraso + ' dia(s) de atraso.'
        : 'Devolução registrada no prazo.',
    };
  });

  // --------------------------------------------------------
  //  Cancelar
  // --------------------------------------------------------
  app.post('/api/locacao/:id/cancelar', gerenciarLocacao, async (req, reply) => {
    const { id } = req.params as { id: string };
    const dados = z
      .object({ motivo: textoObrigatorio(3, 'O motivo') })
      .safeParse(req.body ?? {});

    if (!dados.success) return reply.status(400).send(erroDeValidacao(dados.error));

    const atual = await banco.contratoLocacao.findUnique({ where: { id } });
    if (!atual) return reply.status(404).send({ erro: 'Locação não encontrada.' });

    const conferido = conferirCancelamento({ situacao: atual.situacao as SituacaoLocacao });
    if (!conferido.ok) return reply.status(409).send({ erro: conferido.erro });

    const salvo = await banco.contratoLocacao.update({
      where: { id },
      data: { situacao: 'CANCELADA', motivo: dados.data.motivo },
      include: INCLUIR,
    });

    return { contrato: formatar(salvo, hojeAoMeioDia()) };
  });
}

// ------------------------------------------------------------
//  O arquivo, em PDF ou Word
// ------------------------------------------------------------

function reais(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

// O `dataBr` local, sem fuso, saiu: quem responde agora e data-br.ts.

async function entregarArquivo(
  reply: FastifyReply,
  lista: ReturnType<typeof formatar>[],
  resumo: ReturnType<typeof resumirLocacoes>,
  obras: Array<{ id: string; codigo: string; nome: string }>,
  filtro: { obraId?: string },
  formato: FormatoArquivo,
) {
  const obra = filtro.obraId ? obras.find((o) => o.id === filtro.obraId) : null;

  const arquivo = await gerarArquivoDaTabela({
    arquivo: 'locacao-de-equipamentos',
    titulo: 'Locação de equipamentos',
    subtitulo: 'O que está alugado, onde está e quanto já custou',
    resumo: [
      { rotulo: 'Obra', valor: obra ? obra.codigo + ' · ' + obra.nome : 'Todas as obras' },
      { rotulo: 'Locações ativas', valor: String(resumo.ativas) },
      { rotulo: 'Atrasadas', valor: String(resumo.atrasadas) },
      { rotulo: 'Vencendo', valor: String(resumo.vencendo) },
      { rotulo: 'Custo em andamento', valor: reais(resumo.custoEmAndamento) },
      { rotulo: 'Custo do atraso', valor: reais(resumo.desperdicio) },
    ],
    tabelas: [{
      colunas: [
        { titulo: 'Contrato', campo: 'numero', peso: 0.9 },
        { titulo: 'Equipamento', campo: 'equipamento', peso: 2.4 },
        { titulo: 'Obra', campo: 'obra', peso: 1.6 },
        { titulo: 'Fornecedor', campo: 'fornecedor', peso: 1.6 },
        { titulo: 'Período', campo: 'periodo', peso: 1.4 },
        { titulo: 'Devolução', campo: 'devolucao', peso: 1.2 },
        { titulo: 'Já custou', campo: 'custo', peso: 1.2, numero: true },
        { titulo: 'Atraso', campo: 'atraso', peso: 1.2, numero: true },
        { titulo: 'Situação', campo: 'situacao', peso: 1.1 },
      ],
      linhas: lista.map((c) => ({
        numero: c.numeroFormatado,
        equipamento: c.descricao + (c.identificacao ? ' (' + c.identificacao + ')' : ''),
        obra: c.obra.codigo + ' · ' + c.obra.nome,
        fornecedor: c.fornecedor.nomeFantasia ?? c.fornecedor.razaoSocial,
        periodo: reais(c.valorPeriodo) + ' ' + c.periodicidadeRotulo,
        devolucao: dataBr(c.previsaoDevolucao) +
          (c.devolvidoEm ? ' · voltou ' + dataBr(c.devolvidoEm) : ''),
        custo: reais(c.custoAcumulado),
        atraso: c.diasDeAtraso > 0
          ? c.diasDeAtraso + ' dia(s) · ' + reais(c.custoDoAtraso)
          : '—',
        situacao: c.alertaRotulo,
      })),
    }],
    nota: 'O custo sobe sozinho enquanto o equipamento não volta. ' +
      '"Custo do atraso" é quanto se pagou a mais por não ter devolvido na data combinada.',
  }, formato);

  return reply
    .header('content-type', arquivo.tipo)
    .header('content-disposition', 'attachment; filename="' + arquivo.nome + '"')
    .send(arquivo.conteudo);
}
