// ============================================================
//  Relatórios
//
//  Cinco perguntas que alguém faz de verdade na construtora:
//
//    1. /orcamento     A obra está estourando o orçamento?
//    2. /economia      A cotação valeu a pena?
//    3. /fornecedores  Em quem dá para confiar?
//    4. /tempos        Onde o processo trava?
//    5. /consumo       O que a empresa mais compra?
//
//  As contas ficam em servicos/relatorios.ts. Aqui só buscamos
//  os dados e passamos para lá — é o que permite testar as
//  regras sem subir banco nenhum.
// ============================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import { banco } from '../plugins/banco.js';
import { numero } from '../servicos/util.js';
import {
  diasEntre,
  compararOrcamento, resumirOrcamento,
  analisarCotacoes, resumirEconomia,
  analisarFornecedores,
  medirTempos, tempoTotal,
  consumoPorFamilia, materiaisMaisComprados,
  type LinhaDeOrcamento, type CotacaoParaAnalise,
  type FornecedorParaAnalise, type EntregaDoFornecedor,
  type PassagemDaSolicitacao, type ItemComprado,
} from '../servicos/relatorios.js';
import {
  gerarArquivoDaTabela, formatoValido,
  type TabelaParaArquivo, type FormatoArquivo,
} from '../servicos/tabela-arquivo.js';

/** Decimal do Prisma vira número; nulo vira zero. */
function val(d: unknown): number {
  return numero(d as never) ?? 0;
}

/** Pedido cancelado não conta em lugar nenhum. */
const PEDIDO_VALE = { situacao: { not: 'CANCELADO' as const } };

interface Filtro {
  obraId?: string;
  de?: string;
  ate?: string;
  formato?: string;
}

/**
 * Faixa de datas do relatório.
 *
 * Sem filtro, mostramos os últimos 12 meses: é o período que
 * responde "como estamos indo" sem trazer a história inteira da
 * empresa e deixar a tela lenta.
 */
function faixa(q: Filtro): { de: Date; ate: Date; deTexto: string; ateTexto: string } {
  const hoje = new Date();

  const padraoDe = new Date(hoje);
  padraoDe.setFullYear(padraoDe.getFullYear() - 1);

  const de = q.de ? new Date(q.de + 'T00:00:00') : padraoDe;
  const ate = q.ate ? new Date(q.ate + 'T23:59:59') : hoje;

  const iso = (d: Date) =>
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0');

  return { de, ate, deTexto: iso(de), ateTexto: iso(ate) };
}

/** A menor data não nula da lista, ou nulo se não houver nenhuma. */
function primeira(datas: Array<Date | null | undefined>): Date | null {
  const validas = datas.filter((d): d is Date => d instanceof Date);
  if (validas.length === 0) return null;

  return validas.reduce((a, b) => (b < a ? b : a));
}

/** A maior data não nula da lista. */
function ultima(datas: Array<Date | null | undefined>): Date | null {
  const validas = datas.filter((d): d is Date => d instanceof Date);
  if (validas.length === 0) return null;

  return validas.reduce((a, b) => (b > a ? b : a));
}

// ------------------------------------------------------------
//  Números prontos para leitura
//
//  Na tela, o número cru serve: o React formata. No arquivo não
//  tem quem formate depois, então "1800" tem de sair daqui já
//  como "R$ 1.800,00" — senão o PDF entrega um número seco que
//  ninguém sabe se é real, quantidade ou porcentagem.
// ------------------------------------------------------------

function dinheiro(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function pct(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
}

function qtd(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function dia(v: Date | string | null): string {
  if (!v) return '—';

  const d = v instanceof Date ? v : new Date(v + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('pt-BR');
}

function periodo(de: string, ate: string): string {
  return dia(de) + ' a ' + dia(ate);
}

async function entregarArquivo(
  reply: FastifyReply,
  tabela: TabelaParaArquivo,
  formato: FormatoArquivo,
) {
  const arquivo = await gerarArquivoDaTabela(tabela, formato);

  return reply
    .header('content-type', arquivo.tipo)
    .header('content-disposition', 'attachment; filename="' + arquivo.nome + '"')
    .send(arquivo.conteudo);
}

/**
 * Lê o formato pedido.
 *
 * Sem `formato`, a rota devolve JSON e a tela monta a página.
 * Com um formato que não existe, recusa em vez de devolver um
 * arquivo qualquer: melhor um erro claro do que um download
 * que abre quebrado.
 */
function lerFormato(q: Filtro): FormatoArquivo | null | 'invalido' {
  if (!q.formato) return null;
  return formatoValido(q.formato) ? q.formato : 'invalido';
}

const SITUACAO_EM_TEXTO: Record<string, string> = {
  FOLGADO: 'Folgado',
  ATENCAO: 'Atenção',
  ESTOUROU: 'Estourou',
  SEM_PREVISAO: 'Sem previsão',
};

const RECUSA_DE_FORMATO = {
  erro: 'Formato não suportado. Escolha "pdf" ou "docx".',
};

export async function rotasRelatorios(app: FastifyInstance) {
  const protegido = { preHandler: app.exigirPermissao('relatorios.ver') };

  /** Lista de obras para o seletor, igual em todos os relatórios. */
  async function obrasDoSeletor() {
    return banco.obra.findMany({
      where: { ativa: true },
      orderBy: [{ codigo: 'asc' }],
      select: { id: true, codigo: true, nome: true },
    });
  }

  // ==========================================================
  //  1. Orçado × realizado
  // ==========================================================
  app.get('/api/relatorios/orcamento', protegido, async (req, reply) => {
    const q = req.query as Filtro;
    const obras = await obrasDoSeletor();
    const obraId = q.obraId ?? obras[0]?.id ?? null;

    if (!obraId) {
      return {
        obras, obraId: null, obra: null,
        linhas: [], resumo: resumirOrcamento([]), foraDoOrcamento: 0,
      };
    }

    const previstas = await banco.linhaOrcamento.findMany({
      where: { obraId },
      orderBy: [{ ordem: 'asc' }, { codigo: 'asc' }],
      select: {
        id: true, codigo: true, descricao: true, unidade: true,
        quantidadePrevista: true, valorUnitarioPrevisto: true,
      },
    });

    // Tudo que já foi comprado para esta obra, com a linha em que
    // foi apontado. Uma consulta só: pedir linha por linha faria
    // uma ida ao banco por item do orçamento.
    const comprados = await banco.pedidoItem.findMany({
      where: {
        pedido: PEDIDO_VALE,
        bidItem: { solicitacaoItem: { solicitacao: { obraId } } },
      },
      select: {
        quantidade: true,
        valorUnitario: true,
        bidItem: { select: { solicitacaoItem: { select: { linhaOrcamentoId: true } } } },
      },
    });

    const realizadoPorLinha = new Map<string, number>();
    let semApontamento = 0;

    for (const item of comprados) {
      const total = val(item.quantidade) * val(item.valorUnitario);
      const linhaId = item.bidItem.solicitacaoItem.linhaOrcamentoId;

      if (!linhaId) {
        semApontamento += total;
        continue;
      }

      realizadoPorLinha.set(linhaId, (realizadoPorLinha.get(linhaId) ?? 0) + total);
    }

    const entrada: LinhaDeOrcamento[] = previstas.map((l) => ({
      codigo: l.codigo,
      descricao: l.descricao,
      unidade: l.unidade,
      quantidadePrevista: val(l.quantidadePrevista),
      valorUnitarioPrevisto: val(l.valorUnitarioPrevisto),
      realizado: realizadoPorLinha.get(l.id) ?? 0,
    }));

    // Compra sem apontamento existe e precisa aparecer: escondê-la
    // faria o total do relatório ficar menor que o gasto real.
    if (semApontamento > 0) {
      entrada.push({
        codigo: '(sem linha)',
        descricao: 'Compras sem apontamento no orçamento',
        unidade: '—',
        quantidadePrevista: 0,
        valorUnitarioPrevisto: 0,
        realizado: semApontamento,
      });
    }

    const linhas = compararOrcamento(entrada);
    const resumo = resumirOrcamento(linhas);
    const obra = obras.find((o) => o.id === obraId) ?? null;

    const formato = lerFormato(q);
    if (formato === 'invalido') return reply.status(400).send(RECUSA_DE_FORMATO);

    if (formato) {
      return entregarArquivo(reply, {
        arquivo: 'orcado-x-realizado-' + (obra?.codigo ?? 'obra'),
        titulo: 'Orçado × realizado',
        subtitulo: 'Quanto de cada linha do orçamento já foi comprado',
        resumo: [
          { rotulo: 'Obra', valor: (obra?.codigo ?? '—') + ' · ' + (obra?.nome ?? '') },
          { rotulo: 'Previsto', valor: dinheiro(resumo.previsto) },
          { rotulo: 'Já comprado', valor: dinheiro(resumo.realizado) },
          { rotulo: 'Saldo', valor: dinheiro(resumo.saldo) },
          { rotulo: 'Consumido', valor: pct(resumo.consumido) },
          {
            rotulo: 'Linhas em alerta',
            valor: resumo.linhasEstouradas + ' estourada(s), ' +
              resumo.linhasEmAtencao + ' em atenção',
          },
        ],
        tabelas: [{
          colunas: [
            { titulo: 'Linha', campo: 'codigo', peso: 1.1 },
            { titulo: 'Descrição', campo: 'descricao', peso: 3 },
            { titulo: 'Un.', campo: 'unidade', peso: 0.5 },
            { titulo: 'Previsto', campo: 'previsto', peso: 1.2, numero: true },
            { titulo: 'Comprado', campo: 'realizado', peso: 1.2, numero: true },
            { titulo: 'Saldo', campo: 'saldo', peso: 1.2, numero: true },
            { titulo: 'Consumo', campo: 'consumido', peso: 0.8, numero: true },
            { titulo: 'Situação', campo: 'situacao', peso: 1 },
          ],
          linhas: linhas.map((l) => ({
            codigo: l.codigo,
            descricao: l.descricao,
            unidade: l.unidade,
            previsto: dinheiro(l.previsto),
            realizado: dinheiro(l.realizado),
            saldo: dinheiro(l.saldo),
            consumido: pct(l.consumido),
            situacao: SITUACAO_EM_TEXTO[l.situacao],
          })),
        }],
        nota: semApontamento > 0
          ? 'A linha "(sem linha)" reúne ' + dinheiro(semApontamento) +
            ' comprados para a obra sem apontamento em linha do orçamento. ' +
            'Ela aparece para o total continuar batendo com o que foi gasto.'
          : undefined,
      }, formato);
    }

    return { obras, obraId, obra, linhas, resumo, foraDoOrcamento: semApontamento };
  });

  // ==========================================================
  //  2. Economia nas cotações
  // ==========================================================
  app.get('/api/relatorios/economia', protegido, async (req, reply) => {
    const q = req.query as Filtro;
    const { de, ate, deTexto, ateTexto } = faixa(q);

    const bids = await banco.bid.findMany({
      where: {
        situacao: { in: ['ENCERRADO', 'CONCLUIDO'] },
        encerradoEm: { gte: de, lte: ate },
      },
      orderBy: [{ encerradoEm: 'desc' }],
      select: {
        numero: true, titulo: true, encerradoEm: true,
        convidados: { select: { respondidoEm: true } },
        itens: {
          select: {
            solicitacaoItem: { select: { quantidade: true, valorEstimado: true } },
            cotacoes: { select: { disponivel: true, valorUnitario: true } },
            pedidoItem: {
              select: {
                quantidade: true, valorUnitario: true,
                pedido: { select: { situacao: true } },
              },
            },
          },
        },
      },
    });

    const entrada: CotacaoParaAnalise[] = bids.map((b) => {
      let estimado = 0;
      let fechado = 0;
      let maiorProposta = 0;

      for (const item of b.itens) {
        estimado += val(item.solicitacaoItem.quantidade) * val(item.solicitacaoItem.valorEstimado);

        const pedido = item.pedidoItem;
        if (!pedido || pedido.pedido.situacao === 'CANCELADO') continue;

        const quantidade = val(pedido.quantidade);
        fechado += quantidade * val(pedido.valorUnitario);

        // A pior proposta da MESMA cesta. Só entram itens que
        // viraram pedido; senão compararíamos compras diferentes
        // e o "ganho" sairia inflado.
        const propostas = item.cotacoes
          .filter((c) => c.disponivel && c.valorUnitario !== null)
          .map((c) => val(c.valorUnitario));

        if (propostas.length > 0) maiorProposta += Math.max(...propostas) * quantidade;
      }

      return {
        numeroFormatado: 'BID-' + String(b.numero).padStart(5, '0'),
        titulo: b.titulo,
        encerradaEm: b.encerradoEm,
        fornecedoresConvidados: b.convidados.length,
        fornecedoresResponderam: b.convidados.filter((c) => c.respondidoEm !== null).length,
        estimado,
        fechado,
        maiorProposta,
      };
    });

    const cotacoes = analisarCotacoes(entrada);
    const resumo = resumirEconomia(cotacoes);

    const formato = lerFormato(q);
    if (formato === 'invalido') return reply.status(400).send(RECUSA_DE_FORMATO);

    if (formato) {
      return entregarArquivo(reply, {
        arquivo: 'economia-nas-cotacoes',
        titulo: 'Economia nas cotações',
        subtitulo: 'Quanto a disputa entre fornecedores economizou',
        resumo: [
          { rotulo: 'Período', valor: periodo(deTexto, ateTexto) },
          { rotulo: 'Cotações encerradas', valor: String(resumo.cotacoes) },
          { rotulo: 'Estimado', valor: dinheiro(resumo.estimado) },
          { rotulo: 'Fechado', valor: dinheiro(resumo.fechado) },
          {
            rotulo: 'Economia',
            valor: dinheiro(resumo.economia) + ' (' + pct(resumo.economiaPercentual) + ')',
          },
          { rotulo: 'Ganho na disputa', valor: dinheiro(resumo.ganhoNaDisputa) },
          { rotulo: 'Taxa média de resposta', valor: pct(resumo.taxaMediaDeResposta) },
        ],
        tabelas: [{
          colunas: [
            { titulo: 'Cotação', campo: 'numero', peso: 1 },
            { titulo: 'Título', campo: 'titulo', peso: 2.6 },
            { titulo: 'Encerrada', campo: 'encerrada', peso: 0.9 },
            { titulo: 'Respostas', campo: 'respostas', peso: 1.2 },
            { titulo: 'Estimado', campo: 'estimado', peso: 1.2, numero: true },
            { titulo: 'Fechado', campo: 'fechado', peso: 1.2, numero: true },
            { titulo: 'Economia', campo: 'economia', peso: 1.4, numero: true },
            { titulo: 'Ganho na disputa', campo: 'ganho', peso: 1.2, numero: true },
          ],
          linhas: cotacoes.map((c) => ({
            numero: c.numeroFormatado,
            titulo: c.titulo,
            encerrada: dia(c.encerradaEm),
            respostas: c.fornecedoresResponderam + ' de ' + c.fornecedoresConvidados +
              ' (' + pct(c.taxaDeResposta) + ')',
            estimado: dinheiro(c.estimado),
            fechado: dinheiro(c.fechado),
            economia: dinheiro(c.economia) + ' (' + pct(c.economiaPercentual) + ')',
            ganho: dinheiro(c.ganhoNaDisputa),
          })),
        }],
        nota: 'Economia compara com o valor ESTIMADO pelo solicitante. ' +
          'Ganho na disputa compara com a proposta mais cara recebida na mesma cotação. ' +
          'Economia negativa significa que a compra fechou acima do estimado.',
      }, formato);
    }

    return { de: deTexto, ate: ateTexto, cotacoes, resumo };
  });

  // ==========================================================
  //  3. Desempenho do fornecedor
  // ==========================================================
  app.get('/api/relatorios/fornecedores', protegido, async (req, reply) => {
    const q = req.query as Filtro;

    const fornecedores = await banco.fornecedor.findMany({
      orderBy: [{ razaoSocial: 'asc' }],
      select: {
        razaoSocial: true, nomeFantasia: true,
        convites: { select: { respondidoEm: true } },
        pedidos: {
          where: PEDIDO_VALE,
          select: {
            criadoEm: true, enviadoEm: true,
            itens: {
              select: {
                quantidade: true, valorUnitario: true, prazoEntregaDias: true,
                recebimentos: {
                  select: {
                    situacao: true,
                    recebimento: { select: { recebidoEm: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const entrada: FornecedorParaAnalise[] = fornecedores
      // Fornecedor nunca convidado só faria barulho na tabela.
      .filter((f) => f.convites.length > 0 || f.pedidos.length > 0)
      .map((f) => {
        let valorComprado = 0;
        const entregas: EntregaDoFornecedor[] = [];

        for (const pedido of f.pedidos) {
          // O relógio da entrega começa quando o pedido sai da
          // empresa. Se ainda é rascunho, vale a criação.
          const saida = pedido.enviadoEm ?? pedido.criadoEm;

          for (const item of pedido.itens) {
            valorComprado += val(item.quantidade) * val(item.valorUnitario);

            for (const conferido of item.recebimentos) {
              entregas.push({
                prazoPrometido: item.prazoEntregaDias,
                prazoReal: diasEntre(saida, conferido.recebimento.recebidoEm),
                comRessalva: conferido.situacao === 'COM_RESSALVA',
                devolvido: conferido.situacao === 'DEVOLVIDO',
              });
            }
          }
        }

        return {
          nome: f.nomeFantasia ?? f.razaoSocial,
          convites: f.convites.length,
          respostas: f.convites.filter((c) => c.respondidoEm !== null).length,
          pedidos: f.pedidos.length,
          valorComprado,
          entregas,
        };
      });

    const desempenho = analisarFornecedores(entrada);

    const formato = lerFormato(q);
    if (formato === 'invalido') return reply.status(400).send(RECUSA_DE_FORMATO);

    if (formato) {
      const total = desempenho.reduce((soma, f) => soma + f.valorComprado, 0);

      return entregarArquivo(reply, {
        arquivo: 'desempenho-dos-fornecedores',
        titulo: 'Desempenho dos fornecedores',
        subtitulo: 'Resposta, prazo e qualidade de quem a empresa compra',
        resumo: [
          { rotulo: 'Fornecedores com histórico', valor: String(desempenho.length) },
          { rotulo: 'Total comprado', valor: dinheiro(total) },
        ],
        tabelas: [{
          colunas: [
            { titulo: 'Fornecedor', campo: 'nome', peso: 1.6 },
            { titulo: 'Comprado', campo: 'comprado', peso: 1.6, numero: true },
            { titulo: 'Respostas', campo: 'respostas', peso: 1.2, numero: true },
            { titulo: 'Entregas', campo: 'entregas', peso: 0.8, numero: true },
            { titulo: 'Pontualidade', campo: 'pontualidade', peso: 1.3, numero: true },
            { titulo: 'Atraso médio', campo: 'atraso', peso: 1, numero: true },
            { titulo: 'Qualidade', campo: 'qualidade', peso: 0.9, numero: true },
            { titulo: 'Problemas', campo: 'problemas', peso: 1.4 },
            { titulo: 'Leitura', campo: 'leitura', peso: 2.4 },
          ],
          linhas: desempenho.map((f) => ({
            nome: f.nome,
            comprado: dinheiro(f.valorComprado) + ' · ' + f.pedidos + ' pedido(s)',
            respostas: f.respostas + ' de ' + f.convites + ' (' + pct(f.taxaDeResposta) + ')',
            entregas: String(f.entregas),
            pontualidade: f.entregas === 0
              ? '—'
              : pct(f.pontualidade) + ' (' + f.noPrazo + ' de ' + f.entregas + ')',
            atraso: f.atrasoMedio > 0 ? f.atrasoMedio + ' dia(s)' : '—',
            qualidade: f.entregas === 0 ? '—' : pct(f.qualidade),
            problemas: f.ressalvas + ' ressalva(s), ' + f.devolucoes + ' devolução(ões)',
            leitura: f.leitura,
          })),
        }],
        nota: 'Pontualidade compara com o prazo que o PRÓPRIO fornecedor prometeu na cotação. ' +
          'A leitura só vira veredito a partir de 3 entregas: com uma ou duas, ' +
          'qualquer conta dá 0% ou 100%.',
      }, formato);
    }

    return { fornecedores: desempenho };
  });

  // ==========================================================
  //  4. Tempo do processo
  // ==========================================================
  app.get('/api/relatorios/tempos', protegido, async (req, reply) => {
    const q = req.query as Filtro;
    const { de, ate, deTexto, ateTexto } = faixa(q);
    const obras = await obrasDoSeletor();

    const solicitacoes = await banco.solicitacao.findMany({
      where: {
        situacao: { notIn: ['RASCUNHO', 'CANCELADA'] },
        criadaEm: { gte: de, lte: ate },
        ...(q.obraId ? { obraId: q.obraId } : {}),
      },
      orderBy: [{ numero: 'asc' }],
      select: {
        numero: true, criadaEm: true, enviadaEm: true, decididaEm: true, situacao: true,
        obra: { select: { nome: true } },
        itens: {
          select: {
            itemBid: {
              select: {
                bid: { select: { encerradoEm: true } },
                pedidoItem: {
                  select: {
                    pedido: { select: { criadoEm: true, enviadoEm: true, situacao: true } },
                    recebimentos: { select: { recebimento: { select: { recebidoEm: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const passagens: PassagemDaSolicitacao[] = solicitacoes.map((s) => {
      const emBid = s.itens
        .map((i) => i.itemBid)
        .filter((b): b is NonNullable<typeof b> => b !== null);

      const pedidos = emBid
        .map((b) => b.pedidoItem)
        .filter((p): p is NonNullable<typeof p> => p !== null && p.pedido.situacao !== 'CANCELADO');

      const recebimentos = pedidos.flatMap((p) =>
        p.recebimentos.map((r) => r.recebimento.recebidoEm),
      );

      // Só marcamos como recebida quando TODO item já foi
      // conferido. Considerar a primeira entrega faria o relatório
      // dizer que a obra recebe mais rápido do que recebe.
      const tudoChegou =
        s.itens.length > 0 &&
        emBid.length === s.itens.length &&
        pedidos.length === s.itens.length &&
        pedidos.every((p) => p.recebimentos.length > 0);

      return {
        numeroFormatado: 'SOL-' + String(s.numero).padStart(5, '0'),
        obra: s.obra.nome,
        criadaEm: s.criadaEm,
        enviadaEm: s.enviadaEm,
        // Reprovada não teve "última assinatura": deixá-la de fora
        // mantém honesto o que a etapa diz medir.
        aprovadaEm: s.situacao === 'REPROVADA' ? null : s.decididaEm,
        cotadaEm: primeira(emBid.map((b) => b.bid.encerradoEm)),
        pedidoEm: primeira(pedidos.map((p) => p.pedido.enviadoEm ?? p.pedido.criadoEm)),
        recebidoEm: tudoChegou ? ultima(recebimentos) : null,
      };
    });

    const etapas = medirTempos(passagens);
    const total = tempoTotal(passagens);

    const formato = lerFormato(q);
    if (formato === 'invalido') return reply.status(400).send(RECUSA_DE_FORMATO);

    if (formato) {
      const obra = q.obraId ? obras.find((o) => o.id === q.obraId) : null;

      return entregarArquivo(reply, {
        arquivo: 'tempo-do-processo',
        titulo: 'Tempo do processo de compra',
        subtitulo: 'Quantos dias cada etapa leva, do pedido à entrega',
        resumo: [
          { rotulo: 'Período', valor: periodo(deTexto, ateTexto) },
          { rotulo: 'Obra', valor: obra ? obra.codigo + ' · ' + obra.nome : 'Todas as obras' },
          { rotulo: 'Solicitações no período', valor: String(passagens.length) },
          {
            rotulo: 'Do pedido à entrega',
            valor: total.amostra === 0
              ? 'sem solicitação concluída'
              : qtd(total.dias) + ' dia(s), em ' + total.amostra + ' concluída(s)',
          },
          { rotulo: 'Etapa mais demorada', valor: total.maisDemorada ?? 'nenhuma' },
        ],
        tabelas: [{
          colunas: [
            { titulo: 'Etapa', campo: 'etapa', peso: 1.4 },
            { titulo: 'O que mede', campo: 'descricao', peso: 3.4 },
            { titulo: 'Média de dias', campo: 'dias', peso: 1, numero: true },
            { titulo: 'Solicitações na conta', campo: 'amostra', peso: 1.1, numero: true },
          ],
          linhas: etapas.map((e) => ({
            etapa: e.etapa + (e.etapa === total.maisDemorada ? '  (gargalo)' : ''),
            descricao: e.descricao,
            dias: e.amostra === 0 ? 'sem dados' : qtd(e.dias),
            amostra: String(e.amostra),
          })),
        }],
        nota: 'Uma solicitação só entra na conta de uma etapa DEPOIS de passar por ela. ' +
          'Misturar o que ainda está em andamento puxaria as médias para baixo.',
      }, formato);
    }

    return {
      de: deTexto, ate: ateTexto,
      obras, obraId: q.obraId ?? null,
      etapas, total,
      solicitacoes: passagens.length,
    };
  });

  // ==========================================================
  //  5. Consumo por família e material
  // ==========================================================
  app.get('/api/relatorios/consumo', protegido, async (req, reply) => {
    const q = req.query as Filtro;
    const { de, ate, deTexto, ateTexto } = faixa(q);
    const obras = await obrasDoSeletor();

    const comprados = await banco.pedidoItem.findMany({
      where: {
        pedido: { ...PEDIDO_VALE, criadoEm: { gte: de, lte: ate } },
        ...(q.obraId
          ? { bidItem: { solicitacaoItem: { solicitacao: { obraId: q.obraId } } } }
          : {}),
      },
      select: {
        quantidade: true, valorUnitario: true, unidadeMedida: true,
        bidItem: {
          select: {
            material: {
              select: {
                codigoInterno: true, descricao: true,
                familia: { select: { nome: true } },
              },
            },
          },
        },
      },
    });

    const itens: ItemComprado[] = comprados.map((i) => ({
      codigo: i.bidItem.material.codigoInterno,
      descricao: i.bidItem.material.descricao,
      familia: i.bidItem.material.familia.nome,
      unidadeMedida: i.unidadeMedida,
      quantidade: val(i.quantidade),
      valor: val(i.quantidade) * val(i.valorUnitario),
    }));

    const familias = consumoPorFamilia(itens);
    const materiais = materiaisMaisComprados(itens);
    const total = Math.round(itens.reduce((s, i) => s + i.valor, 0) * 100) / 100;

    const formato = lerFormato(q);
    if (formato === 'invalido') return reply.status(400).send(RECUSA_DE_FORMATO);

    if (formato) {
      const obra = q.obraId ? obras.find((o) => o.id === q.obraId) : null;

      return entregarArquivo(reply, {
        arquivo: 'consumo-de-materiais',
        titulo: 'Consumo por família e material',
        subtitulo: 'O que a empresa mais compra e por quanto',
        resumo: [
          { rotulo: 'Período', valor: periodo(deTexto, ateTexto) },
          { rotulo: 'Obra', valor: obra ? obra.codigo + ' · ' + obra.nome : 'Todas as obras' },
          { rotulo: 'Total comprado', valor: dinheiro(total) },
          { rotulo: 'Itens de pedido', valor: String(itens.length) },
        ],
        tabelas: [
          {
            titulo: 'Para onde vai o dinheiro, por família',
            colunas: [
              { titulo: 'Família', campo: 'nome', peso: 3 },
              { titulo: 'Itens diferentes', campo: 'itens', peso: 1, numero: true },
              { titulo: 'Valor', campo: 'valor', peso: 1.3, numero: true },
              { titulo: 'Participação', campo: 'participacao', peso: 1, numero: true },
            ],
            linhas: familias.map((f) => ({
              nome: f.nome,
              itens: String(f.itens),
              valor: dinheiro(f.valor),
              participacao: pct(f.participacao),
            })),
          },
          {
            titulo: 'Os itens mais comprados',
            colunas: [
              { titulo: 'Código', campo: 'codigo', peso: 0.8 },
              { titulo: 'Descrição', campo: 'descricao', peso: 3 },
              { titulo: 'Família', campo: 'familia', peso: 1.6 },
              { titulo: 'Quantidade', campo: 'quantidade', peso: 1.1, numero: true },
              { titulo: 'Preço médio', campo: 'precoMedio', peso: 1.1, numero: true },
              { titulo: 'Valor', campo: 'valor', peso: 1.2, numero: true },
              { titulo: 'Participação', campo: 'participacao', peso: 1, numero: true },
            ],
            linhas: materiais.map((m) => ({
              codigo: m.codigo,
              descricao: m.descricao,
              familia: m.familia,
              quantidade: qtd(m.quantidade) + ' ' + m.unidadeMedida,
              precoMedio: dinheiro(m.precoMedio),
              valor: dinheiro(m.valor),
              participacao: pct(m.participacao),
            })),
          },
        ],
        nota: 'O preço médio é o que a empresa pagou no período. ' +
          'Serve para comparar com a próxima proposta que chegar.',
      }, formato);
    }

    return {
      de: deTexto, ate: ateTexto,
      obras, obraId: q.obraId ?? null,
      familias, materiais, total,
      linhas: itens.length,
    };
  });
}
