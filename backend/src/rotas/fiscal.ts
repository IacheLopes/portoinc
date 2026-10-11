// ============================================================
//  Nota fiscal e contas a pagar
//
//  Funciona inteiro sem a SEFAZ: a nota é digitada ou lida do
//  XML que o fornecedor manda. Quando a SEFAZ for ligada, ela
//  vira só mais uma origem de dados para a mesma tela.
// ============================================================

import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { lerPaginacao, camposDaPagina } from '../servicos/paginacao.js';
import { numero, erroDeValidacao, textoOpcional, textoObrigatorio } from '../servicos/util.js';
import { formatarNumeroPedido } from '../servicos/equalizacao.js';
import { acrescentarLancamentosAoFluxo } from '../servicos/caixa.js';
import type { LancamentoParaCaixa } from '../servicos/caixa.js';
import {
  chaveValida, limparChave, formatarChave, conferirNotaContraPedido,
  gerarParcelas, descreverCondicao, situacaoVencimento, descreverVencimento,
  formatarNumeroConta, lerXmlNotaFiscal, diasAte,
  conferirCondicaoDePagamento, conferirParcelasGeradas, aindaDevido,
} from '../servicos/fiscal.js';
import {
  resumirCarteira, calcularIndicadores, montarFluxo, ranquearPor, fatiarCarteira,
  type ParcelaParaIndicador,
} from '../servicos/indicadores-financeiros.js';
import { gerarArquivoDaTabela, formatoValido } from '../servicos/tabela-arquivo.js';
import { gerarPdfNotaFiscal } from '../servicos/pdf-nota-fiscal.js';
import { dataBr, inicioDoDiaBr } from '../servicos/data-br.js';
import { formatarCnpj, reaisBr as reais } from '../servicos/util.js';

/** Centavos, sem sobra de ponto flutuante. */
const arredondarReais = (v: number) => Math.round(v * 100) / 100;
import {
  guardarArquivo, lerArquivo, apagarArquivo, tipoAceito, tamanhoLegivel,
  ErroDeArquivo, TAMANHO_MAXIMO,
} from '../servicos/arquivos.js';

const INCLUIR_NOTA = {
  fornecedor: true,
  lancadaPor: { select: { nome: true } },
  pedido: {
    select: {
      id: true, numero: true, situacao: true,
      valorFrete: true, outrosCustos: true,
      percentualEntrada: true, quantidadeParcelas: true, intervaloParcelasDias: true,
      itens: { select: { quantidade: true, valorUnitario: true } },
    },
  },
  itens: { orderBy: { ordem: 'asc' } },
  titulos: { orderBy: { parcela: 'asc' } },
} as const;

const esquemaItem = z.object({
  codigo: textoOpcional(60),
  descricao: textoObrigatorio(1, 'A descrição do item'),
  gtin: textoOpcional(20),
  unidade: textoOpcional(10),
  quantidade: z.number().positive(),
  valorUnitario: z.number().min(0),
  valorTotal: z.number().min(0),
});

const esquemaNota = z.object({
  numero: textoObrigatorio(1, 'O número da nota'),
  serie: textoOpcional(10),
  chaveAcesso: textoOpcional(60),
  fornecedorId: z.string().uuid(),
  pedidoId: z.string().uuid().optional().nullable(),
  emitidaEm: z.string().min(4),
  valorTotal: z.number().positive(),
  valorProdutos: z.number().min(0).optional().nullable(),
  valorFrete: z.number().min(0).optional().nullable(),
  observacoes: textoOpcional(1000),
  doXml: z.boolean().optional(),
  itens: z.array(esquemaItem).default([]),
});

type Decimalzinho = Prisma.Decimal | null;

/** Soma dos itens + frete + outros custos do pedido. */
function totalDoPedido(pedido: {
  itens: Array<{ quantidade: Prisma.Decimal; valorUnitario: Prisma.Decimal }>;
  valorFrete: Decimalzinho;
  outrosCustos: Decimalzinho;
}): number {
  const itens = pedido.itens.reduce(
    (s, i) => s + (numero(i.quantidade) ?? 0) * (numero(i.valorUnitario) ?? 0),
    0,
  );

  return itens + (numero(pedido.valorFrete) ?? 0) + (numero(pedido.outrosCustos) ?? 0);
}

/**
 * Os lancamentos a mao, do tamanho que o fluxo precisa.
 *
 * Fica aqui, e nao dentro de cada rota, porque as DUAS que montam
 * o fluxo — o painel e a do periodo — precisam da mesma coisa, e
 * duas copias divergiriam no dia em que o campo mudasse.
 *
 * Carrega todos: o fluxo olha doze meses, e filtrar por data no
 * banco exigiria repetir aqui a janela que `montarFluxo` calcula.
 * Sao poucas linhas — a construtora lanca receita e despesa avulsa
 * na casa de dezenas por mes, nao de milhares.
 */
async function lancamentosDoFluxo(): Promise<LancamentoParaCaixa[]> {
  const linhas = await banco.lancamentoFinanceiro.findMany({
    where: { situacao: { not: 'CANCELADO' } },
    select: {
      tipo: true,
      valor: true,
      previstoPara: true,
      realizadoEm: true,
      situacao: true,
    },
  });

  return linhas.map((l) => ({
    tipo: l.tipo,
    valor: numero(l.valor) ?? 0,
    previstoPara: l.previstoPara,
    realizadoEm: l.realizadoEm,
    situacao: l.situacao,
  }));
}

export async function rotasFiscal(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Ler o XML da nota (não grava nada)
  //
  //  Devolve os dados prontos para a tela preencher o formulário.
  //  Quem grava é a rota de lançamento, igual ao lançamento
  //  digitado — um caminho só para nascer nota.
  // --------------------------------------------------------
  app.post(
    '/api/notas-fiscais/ler-xml',
    { preHandler: app.exigirPermissao('financeiro.gerenciar') },
    async (req, res) => {
      const dados = z.object({ xml: z.string().min(20) }).safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const lida = lerXmlNotaFiscal(dados.data.xml);

      if (!lida) {
        return res.status(400).send({
          erro: 'Este arquivo não parece ser o XML de uma nota fiscal.',
        });
      }

      // Acha o fornecedor pelo CNPJ que veio na nota.
      const cnpj = (lida.cnpjEmitente ?? '').replace(/\D/g, '');
      const fornecedor = cnpj
        ? await banco.fornecedor.findFirst({ where: { cnpj } })
        : null;

      // Pedidos daquele fornecedor que ainda esperam nota.
      const pedidos = fornecedor
        ? await banco.pedido.findMany({
            where: {
              fornecedorId: fornecedor.id,
              // Rascunho entra: a nota pode chegar antes de alguém
              // clicar em 'marcar como enviado'. Só o cancelado fica fora.
              situacao: { not: 'CANCELADO' },
            },
            select: { id: true, numero: true },
            orderBy: { numero: 'desc' },
            take: 20,
          })
        : [];

      return {
        nota: lida,
        chaveValida: lida.chaveAcesso ? chaveValida(lida.chaveAcesso) : null,
        fornecedor: fornecedor
          ? { id: fornecedor.id, nome: fornecedor.nomeFantasia ?? fornecedor.razaoSocial }
          : null,
        pedidosDoFornecedor: pedidos.map((p) => ({
          id: p.id,
          numeroFormatado: formatarNumeroPedido(p.numero),
        })),
        aviso: fornecedor
          ? null
          : 'O CNPJ da nota não está cadastrado como fornecedor. Cadastre antes de lançar.',
      };
    },
  );

  // --------------------------------------------------------
  //  Lançar a nota
  // --------------------------------------------------------
  app.post(
    '/api/notas-fiscais',
    { preHandler: app.exigirPermissao('financeiro.gerenciar') },
    async (req, res) => {
      const dados = esquemaNota.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const d = dados.data;

      const fornecedor = await banco.fornecedor.findUnique({ where: { id: d.fornecedorId } });
      if (!fornecedor) return res.status(404).send({ erro: 'Fornecedor não encontrado.' });

      // Nota CANCELADA nao segura mais o numero.
      //
      // Cancelar serve para duas coisas que o sistema nao consegue
      // distinguir: a nota morreu na SEFAZ, ou alguem digitou o
      // valor errado aqui. No segundo caso — o mais comum de longe —
      // a nota continua existindo no mundo e precisa voltar.
      //
      // Sem este filtro, um erro de digitacao matava o numero da
      // nota para sempre: nao dava para relancar, nem editar, nem
      // apagar. O dono caiu nisso em 27/09/2026, lancando R$ 3.200
      // em vez de R$ 3.000 e cancelando para corrigir.
      const repetida = await banco.notaFiscal.findFirst({
        where: {
          fornecedorId: d.fornecedorId,
          numero: d.numero,
          serie: d.serie ?? '1',
          situacao: { not: 'CANCELADA' },
        },
      });

      if (repetida) {
        return res.status(409).send({
          erro: 'Este fornecedor já tem a nota ' + d.numero + ' série ' + (d.serie ?? '1') + ' lançada.',
        });
      }

      //  A DATA SE PROTEGE NO SERVIDOR.
      //
      //  Era `new Date(d.emitidaEm)`. Com "2026-10-10" isso vira
      //  meia-noite em UTC, que no Brasil é 21h do dia 9 — e a data
      //  base dos vencimentos vai junto: toda parcela nasceria um
      //  dia antes do combinado.
      //
      //  Hoje a tela disfarça, mandando "T12:00:00". Mas a proteção
      //  mora no navegador, e o SEFAZ não passa por navegador
      //  nenhum: o XML alimenta esta rota direto. No dia em que ele
      //  entrar, o defeito acorda.
      const emitidaEm = inicioDoDiaBr(d.emitidaEm);
      if (Number.isNaN(emitidaEm.getTime())) {
        return res.status(400).send({ erro: 'Data de emissão inválida.' });
      }

      const pedido = d.pedidoId
        ? await banco.pedido.findUnique({
            where: { id: d.pedidoId },
            include: {
              itens: { select: { quantidade: true, valorUnitario: true } },
              notasFiscais: { select: { valorTotal: true, situacao: true } },
            },
          })
        : null;

      if (d.pedidoId && !pedido) {
        return res.status(404).send({ erro: 'Pedido não encontrado.' });
      }

      const jaLancado = (pedido?.notasFiscais ?? [])
        .filter((n) => n.situacao !== 'CANCELADA')
        .reduce((s, n) => s + (numero(n.valorTotal) ?? 0), 0);

      const divergencias = conferirNotaContraPedido(
        {
          numero: d.numero,
          serie: d.serie ?? '1',
          chaveAcesso: d.chaveAcesso ? limparChave(d.chaveAcesso) : null,
          cnpjFornecedor: fornecedor.cnpj,
          valorTotal: d.valorTotal,
          emitidaEm,
        },
        pedido
          ? {
              numeroFormatado: formatarNumeroPedido(pedido.numero),
              cnpjFornecedor: fornecedor.cnpj,
              valorTotal: totalDoPedido(pedido),
              jaLancado,
            }
          : null,
      );

      const nota = await banco.notaFiscal.create({
        data: {
          numero: d.numero,
          serie: d.serie ?? '1',
          chaveAcesso: d.chaveAcesso ? limparChave(d.chaveAcesso) : null,
          fornecedorId: d.fornecedorId,
          pedidoId: d.pedidoId ?? null,
          lancadaPorId: req.usuario!.id,
          emitidaEm,
          valorTotal: d.valorTotal,
          valorProdutos: d.valorProdutos ?? null,
          valorFrete: d.valorFrete ?? null,
          situacao: divergencias.length > 0 ? 'COM_DIVERGENCIA' : 'CONFERIDA',
          divergencias,
          observacoes: d.observacoes,
          doXml: d.doXml ?? false,
          itens: {
            create: d.itens.map((i, indice) => ({
              ordem: indice + 1,
              codigo: i.codigo,
              descricao: i.descricao,
              gtin: i.gtin,
              unidade: i.unidade,
              quantidade: i.quantidade,
              valorUnitario: i.valorUnitario,
              valorTotal: i.valorTotal,
            })),
          },
        },
        include: INCLUIR_NOTA,
      });

      // Liga a nota às entregas que citaram esse número.
      if (d.pedidoId) {
        await banco.recebimento.updateMany({
          where: { pedidoId: d.pedidoId, notaFiscal: d.numero, notaFiscalId: null },
          data: { notaFiscalId: nota.id },
        });
      }

      return res.status(201).send({
        nota: formatarNota(nota),
        mensagem:
          divergencias.length === 0
            ? 'Nota conferida: bate com o pedido. Já pode gerar as parcelas.'
            : 'Nota lançada com ' +
              divergencias.length +
              (divergencias.length === 1 ? ' pendência.' : ' pendências.'),
      });
    },
  );

  // --------------------------------------------------------
  //  Corrigir uma nota
  //
  //  So ENQUANTO ela nao virou dinheiro.
  //
  //  Depois de gerar as parcelas, a nota tem conta a pagar
  //  pendurada nela. Mudar o valor por baixo de uma parcela em
  //  aberto faria a conta divergir da nota em silencio, e se a
  //  parcela ja foi paga seria reescrever um pagamento que
  //  aconteceu. Nesse caso o caminho continua sendo cancelar e
  //  relancar — e aí fica registrado que houve troca.
  //
  //  Sem isto, corrigir um valor digitado errado exigia cancelar a
  //  nota; e a nota cancelada segurava o numero, entao nem
  //  relancar dava. Beco sem saida, achado em 27/09/2026.
  // --------------------------------------------------------
  app.patch(
    '/api/notas-fiscais/:id',
    { preHandler: app.exigirPermissao('financeiro.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };
      const dados = esquemaNota.partial().safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const atual = await banco.notaFiscal.findUnique({
        where: { id },
        include: { titulos: true },
      });

      if (!atual) return res.status(404).send({ erro: 'Nota não encontrada.' });

      if (atual.situacao === 'CANCELADA') {
        return res.status(409).send({
          erro: 'Esta nota está cancelada.',
          motivo: 'Lance uma nota nova com o número dela.',
        });
      }

      if (atual.titulos.length > 0) {
        return res.status(409).send({
          erro: 'Esta nota já virou conta a pagar.',
          motivo:
            'Corrigir o valor agora deixaria a parcela diferente da nota. '
            + 'Cancele a nota e lance de novo — assim fica registrado que houve troca.',
        });
      }

      const d = dados.data;
      const numeroNovo = d.numero ?? atual.numero;
      const serieNova = d.serie ?? atual.serie;
      const fornecedorId = d.fornecedorId ?? atual.fornecedorId;

      // Trocou de número? Ele não pode já estar em uso por outra.
      if (numeroNovo !== atual.numero || serieNova !== atual.serie) {
        const repetida = await banco.notaFiscal.findFirst({
          where: {
            fornecedorId,
            numero: numeroNovo,
            serie: serieNova,
            situacao: { not: 'CANCELADA' },
            id: { not: id },
          },
        });

        if (repetida) {
          return res.status(409).send({
            erro: 'Este fornecedor já tem a nota ' + numeroNovo + ' série ' + serieNova + ' lançada.',
          });
        }
      }

      const emitidaEm = d.emitidaEm ? inicioDoDiaBr(d.emitidaEm) : atual.emitidaEm;
      if (Number.isNaN(emitidaEm.getTime())) {
        return res.status(400).send({ erro: 'Data de emissão inválida.' });
      }

      const valorTotal = d.valorTotal ?? (numero(atual.valorTotal) ?? 0);
      const pedidoId = d.pedidoId === undefined ? atual.pedidoId : d.pedidoId;

      const fornecedor = await banco.fornecedor.findUnique({ where: { id: fornecedorId } });
      if (!fornecedor) return res.status(404).send({ erro: 'Fornecedor não encontrado.' });

      const pedido = pedidoId
        ? await banco.pedido.findUnique({
            where: { id: pedidoId },
            include: {
              itens: { select: { quantidade: true, valorUnitario: true } },
              notasFiscais: { select: { id: true, valorTotal: true, situacao: true } },
            },
          })
        : null;

      if (pedidoId && !pedido) {
        return res.status(404).send({ erro: 'Pedido não encontrado.' });
      }

      // A propria nota nao conta como "ja lancado" contra ela mesma.
      const jaLancado = (pedido?.notasFiscais ?? [])
        .filter((n) => n.situacao !== 'CANCELADA' && n.id !== id)
        .reduce((s, n) => s + (numero(n.valorTotal) ?? 0), 0);

      // A MESMA conferencia do lancamento. Se ela nao rodasse de
      // novo, a nota corrigida ficaria com a divergencia antiga
      // grudada — e o dono corrigiu justamente para tirá-la.
      const divergencias = conferirNotaContraPedido(
        {
          numero: numeroNovo,
          serie: serieNova,
          chaveAcesso: d.chaveAcesso ? limparChave(d.chaveAcesso) : atual.chaveAcesso,
          cnpjFornecedor: fornecedor.cnpj,
          valorTotal,
          emitidaEm,
        },
        pedido
          ? {
              numeroFormatado: formatarNumeroPedido(pedido.numero),
              cnpjFornecedor: fornecedor.cnpj,
              valorTotal: totalDoPedido(pedido),
              jaLancado,
            }
          : null,
      );

      const nota = await banco.notaFiscal.update({
        where: { id },
        data: {
          numero: numeroNovo,
          serie: serieNova,
          chaveAcesso: d.chaveAcesso ? limparChave(d.chaveAcesso) : undefined,
          fornecedorId,
          pedidoId,
          emitidaEm,
          valorTotal,
          valorProdutos: d.valorProdutos ?? undefined,
          valorFrete: d.valorFrete ?? undefined,
          observacoes: d.observacoes ?? undefined,
          situacao: divergencias.length > 0 ? 'COM_DIVERGENCIA' : 'CONFERIDA',
          divergencias,
        },
        include: INCLUIR_NOTA,
      });

      return {
        nota: formatarNota(nota),
        mensagem:
          divergencias.length === 0
            ? 'Nota corrigida: agora bate com o pedido. Já pode gerar as parcelas.'
            : 'Nota corrigida, ainda com ' +
              divergencias.length +
              (divergencias.length === 1 ? ' pendência.' : ' pendências.'),
      };
    },
  );

  // --------------------------------------------------------
  //  Listar notas
  // --------------------------------------------------------
  app.get(
    '/api/notas-fiscais',
    { preHandler: app.exigirPermissao('financeiro.ver') },
    async (req) => {
      const { situacao } = req.query as { situacao?: string };

      // Sem filtro = as que estao DE PE.
      //
      // Nota cancelada nao e apagada — e trilha, e o registro de
      // que existiu vale numa auditoria. Mas sai da frente por
      // padrao: no dia a dia ninguem quer ver nota morta.
      //
      // Esta regra morava na tela, que escondia as canceladas
      // depois de receber a lista. Com pagina isso quebra: uma
      // pagina de vinte notas em que doze estao canceladas mostra
      // oito linhas enquanto o contador diz vinte. Quem filtra e
      // quem conta tem de ser o mesmo, e quem conta e o banco.
      const filtro = situacao
        ? { situacao: situacao as never }
        : { situacao: { not: 'CANCELADA' as never } };

      const pedido = lerPaginacao(req.query as { pagina?: string; porPagina?: string });

      const [total, notas, canceladas] = await Promise.all([
        banco.notaFiscal.count({ where: filtro }),
        banco.notaFiscal.findMany({
          where: filtro,
          include: INCLUIR_NOTA,
          orderBy: { criadoEm: 'desc' },
          skip: pedido.pular,
          take: pedido.porPagina,
        }),
        // Quantas canceladas existem, independente do filtro: e o
        // que faz a tela saber se vale oferecer "ver canceladas".
        banco.notaFiscal.count({ where: { situacao: 'CANCELADA' } }),
      ]);

      return {
        notas: notas.map((n) => formatarNota(n)),
        canceladas,
        ...camposDaPagina(total, pedido),
      };
    },
  );

  app.get(
    '/api/notas-fiscais/:id',
    { preHandler: app.exigirPermissao('financeiro.ver') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const nota = await banco.notaFiscal.findUnique({ where: { id }, include: INCLUIR_NOTA });
      if (!nota) return res.status(404).send({ erro: 'Nota não encontrada.' });

      return { nota: formatarNota(nota, true) };
    },
  );

  // --------------------------------------------------------
  //  Gerar as parcelas a pagar
  // --------------------------------------------------------
  app.post(
    '/api/notas-fiscais/:id/gerar-titulos',
    { preHandler: app.exigirPermissao('financeiro.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const nota = await banco.notaFiscal.findUnique({ where: { id }, include: INCLUIR_NOTA });
      if (!nota) return res.status(404).send({ erro: 'Nota não encontrada.' });

      if (nota.situacao === 'CANCELADA') {
        return res.status(409).send({ erro: 'Esta nota está cancelada.' });
      }

      if (nota.titulos.length > 0) {
        return res.status(409).send({
          erro: 'As parcelas desta nota já foram geradas.',
        });
      }

      // As condições vêm da cotação vencedora, congeladas no pedido.
      const condicao = {
        percentualEntrada: numero(nota.pedido?.percentualEntrada),
        quantidadeParcelas: nota.pedido?.quantidadeParcelas ?? null,
        intervaloDias: nota.pedido?.intervaloParcelasDias ?? null,
      };

      //  A CONDIÇÃO PRECISA ESTAR COMPLETA antes de virar dívida.
      //
      //  Terceira e última porta. O portal e a geração do pedido já
      //  deveriam ter barrado — esta pega o que vier por um caminho
      //  que ainda não existe.
      const problema = conferirCondicaoDePagamento(condicao);
      if (problema) {
        return res.status(409).send({
          erro: 'A condição de pagamento deste pedido está incompleta: ' + problema,
          detalhes: [
            'O pedido ' + (nota.pedido ? formatarNumeroPedido(nota.pedido.numero) : '') +
            ' guarda a condição que o fornecedor informou na cotação. ' +
            'Para corrigir, abra uma última chamada e peça que ele complete.',
          ],
        });
      }

      const valorDaNota = numero(nota.valorTotal) ?? 0;
      const parcelas = gerarParcelas(valorDaNota, condicao, nota.emitidaEm);

      //  E AS PARCELAS PRECISAM FECHAR COM A NOTA.
      //
      //  Dinheiro que some em silêncio é pior do que sistema que
      //  trava reclamando. Antes daqui, uma nota de R$ 10.000 com
      //  "30% de entrada" gerava R$ 3.000 de conta a pagar e os
      //  R$ 7.000 restantes não existiam para ninguém.
      const contaErrada = conferirParcelasGeradas(parcelas, valorDaNota);
      if (contaErrada) {
        return res.status(409).send({ erro: contaErrada });
      }

      await banco.contaPagar.createMany({
        data: parcelas.map((p) => ({
          notaFiscalId: nota.id,
          fornecedorId: nota.fornecedorId,
          parcela: p.parcela,
          totalParcelas: p.totalParcelas,
          valor: p.valor,
          vencimento: p.vencimento,
        })),
      });

      const criadas = await banco.contaPagar.findMany({
        where: { notaFiscalId: nota.id },
        orderBy: { parcela: 'asc' },
      });

      return {
        ok: true,
        condicao: descreverCondicao(condicao),
        titulos: criadas.map((t) => ({
          numeroFormatado: formatarNumeroConta(t.numero),
          parcela: t.parcela + '/' + t.totalParcelas,
          valor: numero(t.valor) ?? 0,
          vencimento: t.vencimento,
        })),
        mensagem:
          parcelas.length === 1
            ? '1 título gerado, à vista.'
            : parcelas.length + ' parcelas geradas: ' + descreverCondicao(condicao) + '.',
      };
    },
  );

  // --------------------------------------------------------
  //  Cancelar nota
  // --------------------------------------------------------
  app.post(
    '/api/notas-fiscais/:id/cancelar',
    { preHandler: app.exigirPermissao('financeiro.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const nota = await banco.notaFiscal.findUnique({
        where: { id },
        include: { titulos: true },
      });

      if (!nota) return res.status(404).send({ erro: 'Nota não encontrada.' });

      if (nota.titulos.some((t) => t.situacao === 'PAGA')) {
        return res.status(409).send({
          erro: 'Esta nota tem parcela já paga. Cancelar apagaria um pagamento real.',
        });
      }

      await banco.$transaction([
        banco.contaPagar.updateMany({
          where: { notaFiscalId: id },
          data: { situacao: 'CANCELADA' },
        }),
        banco.notaFiscal.update({ where: { id }, data: { situacao: 'CANCELADA' } }),
      ]);

      return { ok: true, mensagem: 'Nota cancelada e parcelas em aberto canceladas junto.' };
    },
  );

  // --------------------------------------------------------
  //  Contas a pagar
  // --------------------------------------------------------
  app.get(
    '/api/contas-pagar',
    { preHandler: app.exigirPermissao('financeiro.ver') },
    async (req) => {
      const { situacao, quando } = req.query as { situacao?: string; quando?: string };

      const hoje = new Date();
      const filtroData =
        quando === 'vencidas'
          ? { vencimento: { lt: hoje }, situacao: 'ABERTA' as const }
          : quando === 'semana'
            ? {
                vencimento: { gte: hoje, lte: somarDias(hoje, 7) },
                situacao: 'ABERTA' as const,
              }
            : {};

      const filtro = {
        ...(situacao ? { situacao: situacao as never } : {}),
        ...filtroData,
      };

      const pedido = lerPaginacao(req.query as { pagina?: string; porPagina?: string });

      const [total, titulos] = await Promise.all([
        banco.contaPagar.count({ where: filtro }),
        banco.contaPagar.findMany({
          where: filtro,
          include: {
            fornecedor: { select: { razaoSocial: true, nomeFantasia: true } },
            pagoPor: { select: { nome: true } },
            notaFiscal: {
              select: {
                id: true, numero: true, serie: true,
                pedido: { select: { numero: true } },
              },
            },
          },
          orderBy: [{ vencimento: 'asc' }, { parcela: 'asc' }],
          skip: pedido.pular,
          take: pedido.porPagina,
        }),
      ]);

      return {
        titulos: titulos.map((t) => formatarTitulo(t, hoje)),
        ...camposDaPagina(total, pedido),
      };
    },
  );

  // --------------------------------------------------------
  //  Registrar pagamento
  // --------------------------------------------------------
  app.post(
    '/api/contas-pagar/:id/pagar',
    { preHandler: app.exigirPermissao('financeiro.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const dados = z
        .object({
          pagoEm: z.string().optional().nullable(),
          valorPago: z.number().positive().optional().nullable(),
          /**
           * PAGOU MENOS: foi desconto, ou foi só uma parte?
           *
           * São coisas diferentes e o sistema não sabia distinguir.
           * Ver o bloco grande logo abaixo.
           */
          quitacao: z.enum(['TOTAL', 'PARCIAL']).optional(),
          formaPagamento: textoOpcional(60),
          observacoes: textoOpcional(500),
        })
        .safeParse(req.body ?? {});

      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const titulo = await banco.contaPagar.findUnique({ where: { id } });
      if (!titulo) return res.status(404).send({ erro: 'Título não encontrado.' });

      if (titulo.situacao === 'PAGA') {
        return res.status(409).send({ erro: 'Esta parcela já está paga.' });
      }

      if (titulo.situacao === 'CANCELADA') {
        return res.status(409).send({ erro: 'Esta parcela está cancelada.' });
      }

      const quando = dados.data.pagoEm ? new Date(dados.data.pagoEm) : new Date();
      if (Number.isNaN(quando.getTime())) {
        return res.status(400).send({ erro: 'Data de pagamento inválida.' });
      }

      // ----------------------------------------------------------
      //  PAGAR MENOS TEM DOIS SIGNIFICADOS, E O SISTEMA SÓ SABIA UM
      //
      //  Até 10/10/2026 qualquer valor fechava a parcela. Provado na
      //  varredura: numa parcela de R$ 634,80 paguei R$ 1,00, e os
      //  R$ 633,80 restantes sumiram do painel, da carteira e da
      //  previsão de caixa — sem aviso, sem registro.
      //
      //  O código assumia que pagar menos era sempre DESCONTO. E
      //  desconto existe mesmo: a Porto Inc. negocia abatimento na
      //  hora de pagar. Só que PAGAMENTO PARCIAL também existe, e é
      //  igualmente comum numa construtora — e nele o resto continua
      //  devido.
      //
      //  Agora quem dá a baixa DIZ qual dos dois aconteceu. Travar o
      //  valor diferente seria pior: o financeiro acabaria digitando
      //  um número falso para o sistema aceitar o que de fato houve.
      // ----------------------------------------------------------
      const valorCheio = numero(titulo.valor) ?? 0;
      const jaPago = numero(titulo.valorPago) ?? 0;
      const devido = aindaDevido({ valor: valorCheio, valorPago: jaPago });
      const agora = dados.data.valorPago ?? devido;

      const diferente = Math.abs(agora - devido) > 0.005;

      if (diferente && !dados.data.quitacao) {
        return res.status(400).send({
          erro: 'O valor pago é diferente do que falta nesta parcela.',
          detalhes: [
            'Falta ' + reais(devido) + ' e você informou ' + reais(agora) + '.',
            'Diga o que aconteceu: "TOTAL" quita a parcela e registra a diferença ' +
            'como desconto ou juros; "PARCIAL" guarda o que foi pago e mantém o ' +
            'restante em aberto.',
          ],
          falta: devido,
          informado: agora,
        });
      }

      //  Pagamento parcial só faz sentido pagando MENOS. Pagou mais
      //  (juros, multa), a parcela quita e a diferença fica anotada.
      const parcial = dados.data.quitacao === 'PARCIAL' && agora < devido;

      // ----------------------------------------------------------
      //  DOIS CLIQUES NO MESMO SEGUNDO
      //
      //  As conferências acima leem a linha e decidem. Entre a
      //  decisão e a gravação existe uma fresta, e duas pessoas
      //  dando baixa na mesma parcela ao mesmo tempo passam as
      //  duas por ela.
      //
      //  O estrago é de dinheiro, e silencioso: as duas leem
      //  `valorPago = 100`, as duas gravam `100 + 50`, e o
      //  resultado é 150 em vez de 200. Cinquenta reais saíram do
      //  caixa e não ficaram registrados em lugar nenhum.
      //
      //  A correção é gravar SÓ SE A LINHA AINDA ESTIVER COMO FOI
      //  LIDA. O `where` carrega o estado que a decisão usou —
      //  situação e valor pago —, e o Postgres resolve o UPDATE
      //  inteiro de uma vez: a segunda tentativa casa com zero
      //  linhas e é recusada.
      //
      //  Aqui não cabe trava de banco como nas notas fiscais: o
      //  estado válido não é um valor fixo, é "o mesmo de um
      //  instante atrás".
      // ----------------------------------------------------------
      const gravou = await banco.contaPagar.updateMany({
        where: {
          id,
          situacao: 'ABERTA',
          valorPago: titulo.valorPago,
        },
        data: {
          situacao: parcial ? 'ABERTA' : 'PAGA',
          //  Em baixa parcial a parcela continua aberta, e `pagoEm`
          //  guarda QUANDO SAIU a última parte. Quem lê a carteira
          //  olha a situação, não esta data.
          pagoEm: quando,
          valorPago: arredondarReais(jaPago + agora),
          formaPagamento: dados.data.formaPagamento,
          pagoPorId: req.usuario!.id,
          observacoes: dados.data.observacoes,
        },
      });

      if (gravou.count === 0) {
        return res.status(409).send({
          erro: 'Esta parcela mudou enquanto você preenchia.',
          detalhes: [
            'Alguém deu baixa nela agora há pouco. Recarregue a tela e confira ' +
            'antes de pagar de novo — pagar duas vezes é mais caro que recomeçar.',
          ],
        });
      }

      const atualizado = (await banco.contaPagar.findUniqueOrThrow({ where: { id } }));

      const saldo = aindaDevido({
        valor: valorCheio,
        valorPago: numero(atualizado.valorPago) ?? 0,
      });

      return {
        ok: true,
        parcial,
        saldo,
        mensagem: parcial
          ? formatarNumeroConta(atualizado.numero) + ': pagos ' + reais(agora) +
            '. Ainda em aberto ' + reais(saldo) + '.'
          : formatarNumeroConta(atualizado.numero) + ' baixada: ' + reais(agora) + '.',
      };
    },
  );

  // --------------------------------------------------------
  //  Resumo para os cartões
  // --------------------------------------------------------
  app.get(
    '/api/financeiro/resumo',
    { preHandler: app.exigirPermissao('financeiro.ver') },
    async () => {
      const hoje = new Date();

      const inicioDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      //  `valorPago` entra na conta: parcela com baixa PARCIAL
      //  continua aberta, e o que ainda se deve é o SALDO. Sem isto
      //  o painel cobraria de novo um dinheiro que já saiu.
      const abertas = await banco.contaPagar.findMany({
        where: { situacao: 'ABERTA' },
        select: { valor: true, valorPago: true, vencimento: true },
      });

      const pagasNoMes = await banco.contaPagar.findMany({
        where: { situacao: 'PAGA', pagoEm: { gte: inicioDoMes } },
        select: { valorPago: true, valor: true },
      });

      //  AS BAIXAS PARCIAIS DO MÊS também são dinheiro que saiu.
      //  Antes elas não apareciam em lugar nenhum: a parcela segue
      //  aberta, então ficava de fora de "pago no mês" — e o valor
      //  tinha saído do caixa.
      //
      //  Limite conhecido: `pagoEm` guarda a data da ÚLTIMA parte
      //  paga. Duas parciais em meses diferentes somam no mês da
      //  segunda. Resolver isso de vez pede uma tabela de
      //  pagamentos, que é mudança de modelo — e some em silêncio é
      //  pior do que somar no mês vizinho.
      const parciaisNoMes = await banco.contaPagar.findMany({
        where: {
          situacao: 'ABERTA',
          valorPago: { not: null },
          pagoEm: { gte: inicioDoMes },
        },
        select: { valorPago: true },
      });

      const vencidas = abertas.filter((t) => diasAte(t.vencimento, hoje) < 0);
      const seteDias = abertas.filter((t) => {
        const d = diasAte(t.vencimento, hoje);
        return d >= 0 && d <= 7;
      });

      const notasPendentes = await banco.notaFiscal.count({
        where: { situacao: 'COM_DIVERGENCIA' },
      });

      const semTitulo = await banco.notaFiscal.count({
        where: { situacao: { not: 'CANCELADA' }, titulos: { none: {} } },
      });

      const saldoDe = (t: { valor: unknown; valorPago?: unknown }) =>
        aindaDevido({
          valor: numero(t.valor as never) ?? 0,
          valorPago: numero((t.valorPago ?? null) as never),
        });

      return {
        emAberto: {
          quantidade: abertas.length,
          valor: soma(abertas.map(saldoDe)),
        },
        vencidas: {
          quantidade: vencidas.length,
          valor: soma(vencidas.map(saldoDe)),
        },
        proximos7Dias: {
          quantidade: seteDias.length,
          valor: soma(seteDias.map(saldoDe)),
        },
        pagoNoMes: {
          quantidade: pagasNoMes.length + parciaisNoMes.length,
          valor: soma([
            ...pagasNoMes.map((t) => numero(t.valorPago) ?? numero(t.valor) ?? 0),
            ...parciaisNoMes.map((t) => numero(t.valorPago) ?? 0),
          ]),
        },
        notasComPendencia: notasPendentes,
        notasSemParcelas: semTitulo,
      };
    },
  );

  // --------------------------------------------------------
  //  Painel: indicadores e gráficos
  //
  //  Uma chamada só. A tela precisa de tudo ao mesmo tempo, e
  //  quatro requisições separadas fariam os números aparecerem
  //  em momentos diferentes — dando a impressão de que não
  //  conversam entre si.
  // --------------------------------------------------------
  app.get(
    '/api/financeiro/painel',
    { preHandler: app.exigirPermissao('financeiro.ver') },
    async () => {
      const hoje = new Date();

      const titulos = await banco.contaPagar.findMany({
        include: {
          fornecedor: { select: { razaoSocial: true, nomeFantasia: true } },
          notaFiscal: {
            select: {
              emitidaEm: true,
              pedido: {
                select: {
                  itens: {
                    take: 1,
                    select: {
                      bidItem: {
                        select: {
                          solicitacaoItem: {
                            select: {
                              solicitacao: {
                                select: { obra: { select: { codigo: true, nome: true } } },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const parcelas: ParcelaParaIndicador[] = titulos.map((t) => {
        const obra =
          t.notaFiscal.pedido?.itens[0]?.bidItem.solicitacaoItem.solicitacao.obra ?? null;

        return {
          valor: numero(t.valor) ?? 0,
          vencimento: t.vencimento,
          situacao: t.situacao,
          pagoEm: t.pagoEm,
          valorPago: numero(t.valorPago),
          emitidaEm: t.notaFiscal.emitidaEm,
          fornecedor: t.fornecedor.nomeFantasia ?? t.fornecedor.razaoSocial,
          obra: obra ? obra.codigo + ' — ' + obra.nome : null,
        };
      });

      const [notasComPendencia, notasSemParcelas, notasNoMes, lancamentos] = await Promise.all([
        banco.notaFiscal.count({ where: { situacao: 'COM_DIVERGENCIA' } }),
        banco.notaFiscal.count({
          where: { situacao: { not: 'CANCELADA' }, titulos: { none: {} } },
        }),
        banco.notaFiscal.count({
          where: {
            situacao: { not: 'CANCELADA' },
            criadoEm: { gte: new Date(hoje.getFullYear(), hoje.getMonth(), 1) },
          },
        }),
        lancamentosDoFluxo(),
      ]);

      return {
        resumo: resumirCarteira(parcelas, hoje),
        indicadores: calcularIndicadores(parcelas, hoje),
        // O fluxo mostrava tres barras, e as tres eram saida: quem
        // olhava via a construtora so gastando. Agora a entrada vem
        // junto, das receitas lancadas a mao.
        fluxo: acrescentarLancamentosAoFluxo(montarFluxo(parcelas, hoje), lancamentos, hoje),
        porFornecedor: ranquearPor(parcelas, 'fornecedor'),
        porObra: ranquearPor(parcelas, 'obra'),
        carteira: fatiarCarteira(parcelas, hoje),
        notas: {
          comPendencia: notasComPendencia,
          semParcelas: notasSemParcelas,
          lancadasNoMes: notasNoMes,
        },
        totalDeParcelas: parcelas.length,
      };
    },
  );

  // --------------------------------------------------------
  //  Só o fluxo de caixa, numa janela de 12 meses escolhida
  //
  //  Rota própria, e não um parâmetro no painel, porque mudar o
  //  período move SÓ o gráfico. A consulta do painel carrega
  //  fornecedor, nota, pedido e obra para os rankings; refazer
  //  tudo aquilo a cada toque na seta seria caro à toa.
  //
  //  `referencia` é o centro da janela, no formato AAAA-MM. Sem
  //  ela, o mês de hoje — que é o que o painel já devolve.
  // --------------------------------------------------------
  app.get(
    '/api/financeiro/fluxo',
    { preHandler: app.exigirPermissao('financeiro.ver') },
    async (req, res) => {
      const { referencia } = req.query as { referencia?: string };

      const hoje = new Date();
      let alvo = hoje;

      if (referencia !== undefined) {
        const casa = /^(\d{4})-(\d{2})$/.exec(referencia);
        if (!casa) {
          return res.status(400).send({ erro: 'Período inválido. Use AAAA-MM.' });
        }
        const ano = Number(casa[1]);
        const mes = Number(casa[2]);
        if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) {
          return res.status(400).send({ erro: 'Período fora do intervalo aceito.' });
        }
        alvo = new Date(ano, mes - 1, 1);

        // O mês que vem ainda não aconteceu. A tela já desliga a seta
        // e fecha o calendário, mas quem garante é o servidor: tela é
        // conforto, regra é aqui.
        if (alvo > new Date(hoje.getFullYear(), hoje.getMonth(), 1)) {
          return res.status(400).send({ erro: 'O período não pode ser futuro.' });
        }
      }

      const [titulos, lancamentos] = await Promise.all([
        banco.contaPagar.findMany({
          select: {
            valor: true,
            vencimento: true,
            situacao: true,
            pagoEm: true,
            valorPago: true,
          },
        }),
        lancamentosDoFluxo(),
      ]);

      const parcelas = titulos.map((t) => ({
        valor: numero(t.valor) ?? 0,
        vencimento: t.vencimento,
        situacao: t.situacao,
        pagoEm: t.pagoEm,
        valorPago: numero(t.valorPago),
      }));

      return {
        fluxo: acrescentarLancamentosAoFluxo(
          montarFluxo(parcelas, hoje, 5, 6, alvo),
          lancamentos,
          hoje,
        ),
        referencia:
          alvo.getFullYear() + '-' + String(alvo.getMonth() + 1).padStart(2, '0'),
      };
    },
  );

  // --------------------------------------------------------
  //  Baixar as contas a pagar
  //
  //  Sai em PDF ou em Word, à escolha de quem baixa — a mesma
  //  regra de todo download do sistema.
  // --------------------------------------------------------
  app.get(
    '/api/contas-pagar/exportar',
    { preHandler: app.exigirPermissao('financeiro.ver') },
    async (req, res) => {
      const { formato } = req.query as { formato?: string };
      // Sem escolha, PDF: é o que abre em qualquer máquina.
      const escolhido = formato ?? 'pdf';

      if (!formatoValido(escolhido)) {
        return res.status(400).send({ erro: 'Formato não suportado. Escolha "pdf" ou "docx".' });
      }

      const titulos = await banco.contaPagar.findMany({
        include: {
          fornecedor: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true } },
          notaFiscal: {
            select: { numero: true, serie: true, pedido: { select: { numero: true } } },
          },
        },
        orderBy: [{ vencimento: 'asc' }, { parcela: 'asc' }],
      });

      //  O ARQUIVO CONTA A MESMA COISA QUE A TELA.
      //
      //  Aqui havia duas contas diferentes das do painel, e as duas
      //  inflavam a dívida:
      //
      //    `situacao !== 'PAGA'`  ->  parcela CANCELADA entrava no
      //                               "em aberto". Cancelada não é
      //                               dívida; é dívida desfeita.
      //
      //    soma de `t.valor`      ->  parcela com baixa parcial
      //                               aparecia pelo valor cheio,
      //                               cobrando de novo o que já saiu.
      //
      //  Este PDF é o número que vai para reunião. Divergir da tela
      //  por conta própria é o jeito mais rápido de alguém decidir
      //  errado e descobrir depois.
      const emAberto = titulos.filter((t) => t.situacao === 'ABERTA');
      const naoCanceladas = titulos.filter((t) => t.situacao !== 'CANCELADA');

      const saldoDoTitulo = (t: (typeof titulos)[number]) =>
        aindaDevido({ valor: numero(t.valor) ?? 0, valorPago: numero(t.valorPago) });

      const somaSaldo = (lista: typeof titulos) =>
        lista.reduce((s, t) => s + saldoDoTitulo(t), 0);

      const somaCheia = (lista: typeof titulos) =>
        lista.reduce((s, t) => s + (numero(t.valor) ?? 0), 0);

      const somaPaga = (lista: typeof titulos) =>
        lista.reduce((s, t) => s + (numero(t.valorPago) ?? 0), 0);

      const arquivo = await gerarArquivoDaTabela({
        arquivo: 'contas-a-pagar',
        titulo: 'Contas a pagar',
        subtitulo: 'Parcelas geradas a partir das notas fiscais lançadas',
        resumo: [
          { rotulo: 'Parcelas', valor: String(titulos.length) },
          { rotulo: 'Em aberto', valor: emAberto.length + ' · ' + reais(somaSaldo(emAberto)) },
          { rotulo: 'Já pago', valor: reais(somaPaga(naoCanceladas)) },
          { rotulo: 'Total lançado', valor: reais(somaCheia(naoCanceladas)) },
        ],
        tabelas: [{
          colunas: [
            { titulo: 'Título', campo: 'titulo', peso: 1 },
            { titulo: 'Fornecedor', campo: 'fornecedor', peso: 2.4 },
            { titulo: 'CNPJ', campo: 'cnpj', peso: 1.3 },
            { titulo: 'Nota', campo: 'nota', peso: 1 },
            { titulo: 'Pedido', campo: 'pedido', peso: 1 },
            { titulo: 'Parcela', campo: 'parcela', peso: 0.7, numero: true },
            { titulo: 'Valor', campo: 'valor', peso: 1.2, numero: true },
            { titulo: 'Vencimento', campo: 'vencimento', peso: 1, numero: true },
            { titulo: 'Situação', campo: 'situacao', peso: 1 },
            { titulo: 'Pagamento', campo: 'pagamento', peso: 1.3 },
          ],
          linhas: titulos.map((t) => ({
            titulo: formatarNumeroConta(t.numero),
            fornecedor: t.fornecedor.nomeFantasia ?? t.fornecedor.razaoSocial,
            cnpj: formatarCnpj(t.fornecedor.cnpj),
            nota: t.notaFiscal.numero + '/' + t.notaFiscal.serie,
            pedido: t.notaFiscal.pedido ? formatarNumeroPedido(t.notaFiscal.pedido.numero) : '—',
            parcela: t.parcela + '/' + t.totalParcelas,
            valor: reais(numero(t.valor) ?? 0),
            vencimento: dataBr(t.vencimento),
            //  Parcela aberta COM pagamento é baixa parcial, e o
            //  arquivo diz isso com todas as letras — senão ela
            //  aparece como "Aberta" com uma data de pagamento ao
            //  lado, que não se explica para quem lê.
            situacao:
              t.situacao === 'ABERTA' && (numero(t.valorPago) ?? 0) > 0
                ? 'Paga em parte'
                : SITUACAO_DA_CONTA[t.situacao] ?? t.situacao,
            pagamento: t.pagoEm
              ? dataBr(t.pagoEm) + ' · ' + reais(numero(t.valorPago) ?? 0) +
                (t.situacao === 'ABERTA' ? ' · falta ' + reais(saldoDoTitulo(t)) : '')
              : '—',
          })),
        }],
      }, escolhido);

      return res
        .header('Content-Type', arquivo.tipo)
        .header('Content-Disposition', 'attachment; filename="' + arquivo.nome + '"')
        .send(arquivo.conteudo);
    },
  );

  // --------------------------------------------------------
  //  Pedidos que ainda esperam nota
  // --------------------------------------------------------
  app.get(
    '/api/notas-fiscais/pedidos-abertos',
    { preHandler: app.exigirPermissao('financeiro.gerenciar') },
    async () => {
      const pedidos = await banco.pedido.findMany({
        where: { situacao: { not: 'CANCELADO' } },
        include: {
          fornecedor: true,
          itens: { select: { quantidade: true, valorUnitario: true } },
          notasFiscais: { select: { valorTotal: true, situacao: true } },
        },
        orderBy: { numero: 'desc' },
        take: 100,
      });

      return {
        pedidos: pedidos.map((p) => {
          const total = totalDoPedido(p);
          const lancado = p.notasFiscais
            .filter((n) => n.situacao !== 'CANCELADA')
            .reduce((s, n) => s + (numero(n.valorTotal) ?? 0), 0);

          return {
            id: p.id,
            numeroFormatado: formatarNumeroPedido(p.numero),
            fornecedorId: p.fornecedorId,
            fornecedor: p.fornecedor.nomeFantasia ?? p.fornecedor.razaoSocial,
            cnpj: p.fornecedor.cnpj,
            situacao: p.situacao,
            valorTotal: total,
            jaLancado: lancado,
            falta: Math.max(0, total - lancado),
            pagamento: descreverCondicao({
              percentualEntrada: numero(p.percentualEntrada),
              quantidadeParcelas: p.quantidadeParcelas,
              intervaloDias: p.intervaloParcelasDias,
            }),
          };
        }),
      };
    },
  );

  // --------------------------------------------------------
  //  Arquivamento da nota
  //
  //  O fluxo de compras pede a nota "arquivada em PDF". São dois
  //  caminhos, e o sistema tem os dois:
  //
  //  - o fornecedor mandou o PDF ou o XML  -> guardamos o arquivo dele
  //  - a nota foi digitada à mão           -> geramos o espelho
  // --------------------------------------------------------

  /** O espelho, gerado na hora a partir do que está lançado. */
  app.get(
    '/api/notas-fiscais/:id/pdf',
    { preHandler: app.exigirPermissao('financeiro.ver') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const nota = await banco.notaFiscal.findUnique({ where: { id }, include: INCLUIR_NOTA });
      if (!nota) return res.status(404).send({ erro: 'Nota não encontrada.' });

      const pdf = await gerarPdfNotaFiscal({
        numero: nota.numero,
        serie: nota.serie,
        chaveAcesso: nota.chaveAcesso,
        emitidaEm: nota.emitidaEm,
        situacao: nota.situacao,
        doXml: nota.doXml,
        valorTotal: numero(nota.valorTotal) ?? 0,
        valorProdutos: numero(nota.valorProdutos),
        valorFrete: numero(nota.valorFrete),
        divergencias: nota.divergencias,
        observacoes: nota.observacoes,
        lancadaPor: nota.lancadaPor.nome,
        fornecedor: {
          razaoSocial: nota.fornecedor.razaoSocial,
          nomeFantasia: nota.fornecedor.nomeFantasia,
          cnpj: nota.fornecedor.cnpj,
        },
        pedido: nota.pedido
          ? { numeroFormatado: formatarNumeroPedido(nota.pedido.numero) }
          : null,
        itens: nota.itens.map((i) => ({
          ordem: i.ordem,
          codigo: i.codigo,
          descricao: i.descricao,
          unidade: i.unidade,
          quantidade: numero(i.quantidade) ?? 0,
          valorUnitario: numero(i.valorUnitario) ?? 0,
          valorTotal: numero(i.valorTotal) ?? 0,
        })),
      });

      return res
        .header('Content-Type', 'application/pdf')
        .header(
          'Content-Disposition',
          'attachment; filename="NF-' + nota.numero + '-' + nota.serie + '.pdf"',
        )
        .send(pdf);
    },
  );

  /** O que já está arquivado nesta nota. */
  app.get(
    '/api/notas-fiscais/:id/arquivos',
    { preHandler: app.exigirPermissao('financeiro.ver') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const nota = await banco.notaFiscal.findUnique({ where: { id }, select: { id: true } });
      if (!nota) return res.status(404).send({ erro: 'Nota não encontrada.' });

      const arquivos = await banco.arquivo.findMany({
        where: { notaFiscalId: id },
        include: { enviadoPor: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
      });

      return {
        arquivos: arquivos.map((a) => ({
          id: a.id,
          nomeOriginal: a.nomeOriginal,
          tipo: a.tipo,
          tipoMime: a.tipoMime,
          tamanho: a.tamanho,
          tamanhoLegivel: tamanhoLegivel(a.tamanho),
          enviadoPor: a.enviadoPor.nome,
          criadoEm: a.criadoEm,
        })),
      };
    },
  );

  /**
   * Arquiva o PDF ou o XML que o fornecedor mandou.
   *
   * O conteúdo chega em base64 dentro do JSON. É o mesmo caminho
   * por onde o XML já entrava: evita uma biblioteca de upload só
   * para dois tipos de arquivo pequenos.
   */
  app.post(
    '/api/notas-fiscais/:id/arquivos',
    { preHandler: app.exigirPermissao('financeiro.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const dados = z
        .object({
          nomeArquivo: textoObrigatorio(3, 'O nome do arquivo'),
          tipoMime: textoObrigatorio(3, 'O tipo do arquivo'),
          conteudoBase64: z.string().min(16, 'O arquivo está vazio.'),
        })
        .safeParse(req.body);

      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const nota = await banco.notaFiscal.findUnique({ where: { id }, select: { id: true } });
      if (!nota) return res.status(404).send({ erro: 'Nota não encontrada.' });

      if (!tipoAceito(dados.data.tipoMime)) {
        return res.status(400).send({
          erro: 'Só aceitamos PDF e XML da nota fiscal.',
        });
      }

      const conteudo = Buffer.from(dados.data.conteudoBase64, 'base64');

      if (conteudo.length > TAMANHO_MAXIMO) {
        return res.status(413).send({
          erro: 'O arquivo passa de ' + TAMANHO_MAXIMO / 1024 / 1024 + ' MB.',
        });
      }

      try {
        const guardado = await guardarArquivo({
          conteudo,
          nomeOriginal: dados.data.nomeArquivo,
          tipoMime: dados.data.tipoMime,
          tipo: dados.data.tipoMime === 'application/pdf' ? 'PDF_NFE' : 'XML_NFE',
          notaFiscalId: id,
          usuarioId: req.usuario!.id,
        });

        return res.status(201).send({
          arquivo: {
            id: guardado.id,
            nomeOriginal: guardado.nomeOriginal,
            tipo: guardado.tipo,
            tamanho: guardado.tamanho,
            tamanhoLegivel: tamanhoLegivel(guardado.tamanho),
          },
          mensagem: 'Arquivo guardado junto da nota.',
        });
      } catch (erro) {
        if (erro instanceof ErroDeArquivo) {
          return res.status(400).send({ erro: erro.message });
        }
        throw erro;
      }
    },
  );

  /** Baixa um arquivo guardado. */
  app.get(
    '/api/arquivos/:id',
    { preHandler: app.exigirPermissao('financeiro.ver') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      try {
        const achado = await lerArquivo(id);
        if (!achado) return res.status(404).send({ erro: 'Arquivo não encontrado.' });

        return res
          .header('Content-Type', achado.ficha.tipoMime)
          .header(
            'Content-Disposition',
            'attachment; filename="' + achado.ficha.nomeOriginal.replace(/"/g, '') + '"',
          )
          .send(achado.conteudo);
      } catch (erro) {
        if (erro instanceof ErroDeArquivo) {
          return res.status(410).send({ erro: erro.message });
        }
        throw erro;
      }
    },
  );

  app.delete(
    '/api/arquivos/:id',
    { preHandler: app.exigirPermissao('financeiro.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const apagou = await apagarArquivo(id);
      if (!apagou) return res.status(404).send({ erro: 'Arquivo não encontrado.' });

      return { ok: true, mensagem: 'Arquivo removido do arquivamento.' };
    },
  );
}

// ------------------------------------------------------------
//  Formatação para a tela
// ------------------------------------------------------------

type NotaCompleta = Awaited<
  ReturnType<typeof banco.notaFiscal.findFirstOrThrow<{ include: typeof INCLUIR_NOTA }>>
>;

function formatarNota(n: NotaCompleta, comItens = false) {
  const total = numero(n.valorTotal) ?? 0;

  return {
    id: n.id,
    numero: n.numero,
    serie: n.serie,
    chaveAcesso: n.chaveAcesso,
    chaveFormatada: n.chaveAcesso ? formatarChave(n.chaveAcesso) : null,
    fornecedor: n.fornecedor.nomeFantasia ?? n.fornecedor.razaoSocial,
    fornecedorId: n.fornecedorId,
    pedido: n.pedido ? formatarNumeroPedido(n.pedido.numero) : null,
    pedidoId: n.pedidoId,
    emitidaEm: n.emitidaEm,
    valorTotal: total,
    valorProdutos: numero(n.valorProdutos),
    valorFrete: numero(n.valorFrete),
    situacao: n.situacao,
    divergencias: n.divergencias,
    observacoes: n.observacoes,
    doXml: n.doXml,
    lancadaPor: n.lancadaPor.nome,
    criadoEm: n.criadoEm,
    temTitulos: n.titulos.length > 0,
    quantidadeTitulos: n.titulos.length,
    condicao: n.pedido
      ? descreverCondicao({
          percentualEntrada: numero(n.pedido.percentualEntrada),
          quantidadeParcelas: n.pedido.quantidadeParcelas,
          intervaloDias: n.pedido.intervaloParcelasDias,
        })
      : 'À vista',
    ...(comItens
      ? {
          itens: n.itens.map((i) => ({
            ordem: i.ordem,
            codigo: i.codigo,
            descricao: i.descricao,
            gtin: i.gtin,
            unidade: i.unidade,
            quantidade: numero(i.quantidade) ?? 0,
            valorUnitario: numero(i.valorUnitario) ?? 0,
            valorTotal: numero(i.valorTotal) ?? 0,
          })),
          titulos: n.titulos.map((t) => ({
            id: t.id,
            numeroFormatado: formatarNumeroConta(t.numero),
            parcela: t.parcela,
            totalParcelas: t.totalParcelas,
            valor: numero(t.valor) ?? 0,
            vencimento: t.vencimento,
            situacao: t.situacao,
            pagoEm: t.pagoEm,
          })),
        }
      : {}),
  };
}

function formatarTitulo(
  t: {
    id: string;
    numero: number;
    parcela: number;
    totalParcelas: number;
    valor: Prisma.Decimal;
    vencimento: Date;
    situacao: 'ABERTA' | 'PAGA' | 'CANCELADA';
    pagoEm: Date | null;
    valorPago: Decimalzinho;
    formaPagamento: string | null;
    fornecedor: { razaoSocial: string; nomeFantasia: string | null };
    pagoPor: { nome: string } | null;
    notaFiscal: {
      id: string;
      numero: string;
      serie: string;
      pedido: { numero: number } | null;
    };
  },
  hoje: Date,
) {
  return {
    id: t.id,
    numeroFormatado: formatarNumeroConta(t.numero),
    parcela: t.parcela,
    totalParcelas: t.totalParcelas,
    valor: numero(t.valor) ?? 0,
    vencimento: t.vencimento,
    situacao: t.situacao,
    estado: situacaoVencimento(t.vencimento, t.situacao, hoje),
    quando: descreverVencimento(t.vencimento, hoje),
    fornecedor: t.fornecedor.nomeFantasia ?? t.fornecedor.razaoSocial,
    notaFiscalId: t.notaFiscal.id,
    nota: t.notaFiscal.numero + '/' + t.notaFiscal.serie,
    pedido: t.notaFiscal.pedido ? formatarNumeroPedido(t.notaFiscal.pedido.numero) : null,
    pagoEm: t.pagoEm,
    valorPago: numero(t.valorPago),
    formaPagamento: t.formaPagamento,
    pagoPor: t.pagoPor?.nome ?? null,
  };
}

function soma(valores: number[]): number {
  return Math.round(valores.reduce((s, v) => s + v, 0) * 100) / 100;
}

function somarDias(data: Date, dias: number): Date {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

// O `dataBr` local, sem fuso, virou o compartilhado de data-br.ts.

/**
 * O que o banco guarda não é o que a pessoa lê.
 *
 * A coluna "Situação" do documento saía "PAGA", "ABERTA" — o valor do
 * enum, em caixa alta, no meio de uma tabela em caixa normal. A tela
 * já traduz; o arquivo baixado é que não traduzia.
 */
const SITUACAO_DA_CONTA: Record<string, string> = {
  ABERTA: 'Aberta',
  PAGA: 'Paga',
  CANCELADA: 'Cancelada',
};

// A conta de dinheiro em texto mora em `servicos/util.ts`, e esta
// copia local ficou para tras. Ela tinha um defeito que a oficial
// nao tem: sem `maximumFractionDigits`, uma soma com sobra de ponto
// flutuante sairia impressa como "R$ 1.234,567".
