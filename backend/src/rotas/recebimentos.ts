// ============================================================
//  Recebimento no almoxarifado
//
//  O almoxarife procura o pedido pelo número (digitado, lido do
//  PDF ou bipado), confere item a item e registra o que entrou.
//
//  Observação de permissão: aqui o almoxarife enxerga o pedido
//  sem ter acesso à tela de gestão de pedidos. Ele vê o que
//  precisa conferir, não a negociação inteira.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { numero, erroDeValidacao, textoOpcional } from '../servicos/util.js';
import { formatarNumeroBid } from '../servicos/cotacao.js';
import { formatarNumeroPedido } from '../servicos/equalizacao.js';
import {
  formatarNumeroRecebimento, lerNumeroPedido, calcularSaldos, conferirRecebimento,
  situacaoDoPedido, saldosDepoisDe, resumirConferencia,
  type ItemDoPedido,
} from '../servicos/recebimento.js';
import { movimentar, comRepeticao } from '../servicos/movimentar-estoque.js';

const INCLUIR_PEDIDO = {
  fornecedor: true,
  comprador: { select: { nome: true } },
  bid: { select: { numero: true, titulo: true } },
  itens: {
    orderBy: { ordem: 'asc' },
    include: {
      bidItem: {
        include: {
          material: {
            select: { codigoInterno: true, descricao: true, gtin: true, normaTecnica: true },
          },
          solicitacaoItem: {
            select: {
              solicitacao: {
                select: { numero: true, obra: { select: { id: true, codigo: true, nome: true } } },
              },
            },
          },
        },
      },
      recebimentos: { select: { quantidadeRecebida: true } },
    },
  },
} as const;

type PedidoCompleto = Awaited<
  ReturnType<typeof banco.pedido.findFirst<{ include: typeof INCLUIR_PEDIDO }>>
>;

/** Transforma o pedido do banco nas linhas de conferência. */
function itensParaConferencia(pedido: NonNullable<PedidoCompleto>): ItemDoPedido[] {
  return pedido.itens.map((item) => ({
    pedidoItemId: item.id,
    codigo: item.bidItem.material.codigoInterno,
    gtin: item.bidItem.material.gtin,
    descricao: item.bidItem.material.descricao,
    unidadeMedida: item.unidadeMedida,
    quantidadePedida: numero(item.quantidade) ?? 0,
    quantidadeJaRecebida: item.recebimentos.reduce(
      (soma, r) => soma + (numero(r.quantidadeRecebida) ?? 0),
      0,
    ),
  }));
}

/** O corpo que a tela de conferência devolve. */
function montarRespostaDoPedido(pedido: NonNullable<PedidoCompleto>) {
  const saldos = calcularSaldos(itensParaConferencia(pedido));
  const primeiro = pedido.itens[0]?.bidItem.solicitacaoItem.solicitacao.obra;

  return {
    pedido: {
      id: pedido.id,
      numeroFormatado: formatarNumeroPedido(pedido.numero),
      situacao: pedido.situacao,
      fornecedor: pedido.fornecedor.nomeFantasia ?? pedido.fornecedor.razaoSocial,
      fornecedorCnpj: pedido.fornecedor.cnpj,
      comprador: pedido.comprador.nome,
      origem: formatarNumeroBid(pedido.bid.numero) + ' · ' + pedido.bid.titulo,
      criadoEm: pedido.criadoEm,
      enviadoEm: pedido.enviadoEm,
      obra: primeiro ? primeiro.codigo + ' — ' + primeiro.nome : null,
      obraId: primeiro?.id ?? null,
    },
    itens: saldos.map((s, indice) => ({
      ...s,
      ordem: indice + 1,
      normaTecnica: pedido.itens[indice]?.bidItem.material.normaTecnica ?? null,
      marca: pedido.itens[indice]?.marca ?? null,
      valorUnitario: numero(pedido.itens[indice]?.valorUnitario) ?? 0,
    })),
    tudoRecebido: saldos.every((s) => s.concluido),
  };
}

const esquemaLinha = z.object({
  pedidoItemId: z.string().uuid(),
  quantidadeRecebida: z.number().min(0),
  quantidadeDevolvida: z.number().min(0).default(0),
  situacao: z.enum(['CONFORME', 'COM_RESSALVA', 'DEVOLVIDO']).default('CONFORME'),
  motivo: textoOpcional(500),
});

const esquemaRecebimento = z.object({
  pedidoId: z.string().uuid(),
  almoxarifadoId: z.string().uuid(),
  notaFiscal: textoOpcional(60),
  serieNotaFiscal: textoOpcional(10),
  transportadora: textoOpcional(120),
  observacoes: textoOpcional(1000),
  itens: z.array(esquemaLinha).min(1),
});

export async function rotasRecebimentos(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Pedidos esperando entrega
  // --------------------------------------------------------
  app.get(
    '/api/recebimentos/pedidos-abertos',
    { preHandler: app.exigirPermissao('recebimento.registrar') },
    async () => {
      const pedidos = await banco.pedido.findMany({
        where: { situacao: { in: ['RASCUNHO', 'ENVIADO', 'CONFIRMADO', 'RECEBIDO_PARCIAL'] } },
        include: INCLUIR_PEDIDO,
        orderBy: { numero: 'asc' },
        take: 100,
      });

      return {
        pedidos: pedidos.map((p) => {
          const saldos = calcularSaldos(itensParaConferencia(p));
          const obra = p.itens[0]?.bidItem.solicitacaoItem.solicitacao.obra;

          return {
            id: p.id,
            numeroFormatado: formatarNumeroPedido(p.numero),
            situacao: p.situacao,
            fornecedor: p.fornecedor.nomeFantasia ?? p.fornecedor.razaoSocial,
            obra: obra ? obra.codigo + ' — ' + obra.nome : null,
            itensPendentes: saldos.filter((s) => !s.concluido).length,
            totalItens: saldos.length,
            criadoEm: p.criadoEm,
          };
        }),
      };
    },
  );

  // --------------------------------------------------------
  //  Buscar um pedido para conferir
  // --------------------------------------------------------
  app.get(
    '/api/recebimentos/pedido/:numero',
    { preHandler: app.exigirPermissao('recebimento.registrar') },
    async (req, res) => {
      const { numero: texto } = req.params as { numero: string };

      const n = lerNumeroPedido(texto);
      if (n === null) {
        return res.status(400).send({
          erro: 'Não entendi esse número. Use o formato PC-00001, como está no pedido.',
        });
      }

      const pedido = await banco.pedido.findUnique({
        where: { numero: n },
        include: INCLUIR_PEDIDO,
      });

      if (!pedido) {
        return res.status(404).send({
          erro: 'Não existe pedido com o número ' + formatarNumeroPedido(n) + '.',
        });
      }

      if (pedido.situacao === 'CANCELADO') {
        return res.status(409).send({
          erro: 'Este pedido foi cancelado. Não receba o material sem falar com o comprador.',
        });
      }

      // Almoxarifados onde o material pode entrar: o da obra da
      // solicitação, mais os centrais.
      const obraId = pedido.itens[0]?.bidItem.solicitacaoItem.solicitacao.obra.id ?? null;

      const almoxarifados = await banco.almoxarifado.findMany({
        where: { ativo: true, OR: [{ obraId }, { central: true }] },
        orderBy: [{ central: 'asc' }, { nome: 'asc' }],
        select: { id: true, codigo: true, nome: true, central: true },
      });

      return { ...montarRespostaDoPedido(pedido), almoxarifados };
    },
  );

  // --------------------------------------------------------
  //  Registrar a conferência
  // --------------------------------------------------------
  app.post(
    '/api/recebimentos',
    { preHandler: app.exigirPermissao('recebimento.registrar') },
    async (req, res) => {
      const dados = esquemaRecebimento.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const pedido = await banco.pedido.findUnique({
        where: { id: dados.data.pedidoId },
        include: INCLUIR_PEDIDO,
      });

      if (!pedido) return res.status(404).send({ erro: 'Pedido não encontrado.' });

      if (pedido.situacao === 'CANCELADO') {
        return res.status(409).send({ erro: 'Este pedido foi cancelado.' });
      }

      if (pedido.situacao === 'RECEBIDO') {
        return res.status(409).send({ erro: 'Este pedido já foi recebido por inteiro.' });
      }

      const almoxarifado = await banco.almoxarifado.findFirst({
        where: { id: dados.data.almoxarifadoId, ativo: true },
      });

      if (!almoxarifado) {
        return res.status(400).send({ erro: 'Escolha um almoxarifado válido para a entrada.' });
      }

      const saldos = calcularSaldos(itensParaConferencia(pedido));
      const problemas = conferirRecebimento(dados.data.itens, saldos);

      if (problemas.length > 0) {
        return res.status(400).send({
          erro: 'Confira os itens antes de registrar.',
          detalhes: problemas,
        });
      }

      // Só grava as linhas em que algo chegou de fato.
      const linhasComMovimento = dados.data.itens.filter(
        (i) => i.quantidadeRecebida > 0 || i.quantidadeDevolvida > 0,
      );

      // Preço de cada item, para o custo médio do estoque.
      const precoPorItem = new Map(
        pedido.itens.map((i) => [i.id, numero(i.valorUnitario) ?? 0]),
      );
      const materialPorItem = new Map(
        pedido.itens.map((i) => [i.id, i.bidItem.materialId]),
      );

      // Gravar a conferência e dar entrada no estoque é uma coisa
      // só: se o estoque falhasse depois, o material estaria
      // "recebido" sem existir na prateleira do sistema.
      const recebimento = await comRepeticao(() =>
        banco.$transaction(
          async (tx) => {
          const criado = await tx.recebimento.create({
            data: {
              pedidoId: pedido.id,
              almoxarifeId: req.usuario!.id,
              almoxarifadoId: almoxarifado.id,
              notaFiscal: dados.data.notaFiscal,
              serieNotaFiscal: dados.data.serieNotaFiscal,
              transportadora: dados.data.transportadora,
              observacoes: dados.data.observacoes,
              itens: {
                create: linhasComMovimento.map((linha) => ({
                  pedidoItemId: linha.pedidoItemId,
                  quantidadeRecebida: linha.quantidadeRecebida,
                  quantidadeDevolvida: linha.quantidadeDevolvida,
                  situacao: linha.situacao,
                  motivo: linha.motivo,
                })),
              },
            },
            include: { itens: true },
          });

          for (const item of criado.itens) {
            const quantidade = numero(item.quantidadeRecebida) ?? 0;
            // O que foi devolvido não entra: nunca esteve no
            // almoxarifado de verdade.
            if (quantidade <= 0) continue;

            const materialId = materialPorItem.get(item.pedidoItemId);
            if (!materialId) continue;

            await movimentar(tx, {
              almoxarifadoId: almoxarifado.id,
              materialId,
              usuarioId: req.usuario!.id,
              tipo: 'ENTRADA',
              quantidade,
              valorUnitario: precoPorItem.get(item.pedidoItemId) ?? null,
              recebimentoItemId: item.id,
              observacao: 'Entrada pelo recebimento do pedido ' +
                formatarNumeroPedido(pedido.numero) + '.',
            });
          }

            return criado;
          },
          { isolationLevel: 'Serializable' },
        ),
      );

      const depois = saldosDepoisDe(saldos, linhasComMovimento);
      const novaSituacao = situacaoDoPedido(depois);

      await banco.pedido.update({
        where: { id: pedido.id },
        data: { situacao: novaSituacao },
      });

      return {
        ok: true,
        recebimento: {
          id: recebimento.id,
          numeroFormatado: formatarNumeroRecebimento(recebimento.numero),
        },
        situacaoDoPedido: novaSituacao,
        mensagem: resumirConferencia(linhasComMovimento, depois),
      };
    },
  );

  // --------------------------------------------------------
  //  Histórico
  // --------------------------------------------------------
  app.get(
    '/api/recebimentos',
    { preHandler: app.exigirPermissao('recebimento.registrar', 'pedidos.gerenciar') },
    async () => {
      const recebimentos = await banco.recebimento.findMany({
        include: {
          almoxarife: { select: { nome: true } },
          almoxarifado: { select: { codigo: true, nome: true } },
          pedido: {
            select: {
              numero: true,
              situacao: true,
              fornecedor: { select: { razaoSocial: true, nomeFantasia: true } },
            },
          },
          itens: true,
        },
        orderBy: { numero: 'desc' },
        take: 200,
      });

      return {
        recebimentos: recebimentos.map((r) => ({
          id: r.id,
          numeroFormatado: formatarNumeroRecebimento(r.numero),
          pedido: formatarNumeroPedido(r.pedido.numero),
          situacaoPedido: r.pedido.situacao,
          fornecedor: r.pedido.fornecedor.nomeFantasia ?? r.pedido.fornecedor.razaoSocial,
          almoxarife: r.almoxarife.nome,
          almoxarifado: r.almoxarifado.nome,
          notaFiscal: r.notaFiscal,
          quantidadeItens: r.itens.length,
          temRessalva: r.itens.some((i) => i.situacao !== 'CONFORME'),
          recebidoEm: r.recebidoEm,
        })),
      };
    },
  );

  // --------------------------------------------------------
  //  Detalhe de um recebimento
  // --------------------------------------------------------
  app.get(
    '/api/recebimentos/:id',
    { preHandler: app.exigirPermissao('recebimento.registrar', 'pedidos.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const r = await banco.recebimento.findUnique({
        where: { id },
        include: {
          almoxarife: { select: { nome: true } },
          almoxarifado: { select: { codigo: true, nome: true } },
          pedido: {
            select: {
              numero: true,
              situacao: true,
              fornecedor: { select: { razaoSocial: true, nomeFantasia: true } },
            },
          },
          itens: {
            include: {
              pedidoItem: {
                include: {
                  bidItem: {
                    include: {
                      material: { select: { codigoInterno: true, descricao: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!r) return res.status(404).send({ erro: 'Recebimento não encontrado.' });

      return {
        recebimento: {
          id: r.id,
          numeroFormatado: formatarNumeroRecebimento(r.numero),
          pedido: formatarNumeroPedido(r.pedido.numero),
          situacaoPedido: r.pedido.situacao,
          fornecedor: r.pedido.fornecedor.nomeFantasia ?? r.pedido.fornecedor.razaoSocial,
          almoxarife: r.almoxarife.nome,
          almoxarifado: r.almoxarifado.codigo + ' — ' + r.almoxarifado.nome,
          notaFiscal: r.notaFiscal,
          serieNotaFiscal: r.serieNotaFiscal,
          transportadora: r.transportadora,
          observacoes: r.observacoes,
          recebidoEm: r.recebidoEm,
          itens: r.itens.map((i) => ({
            codigo: i.pedidoItem.bidItem.material.codigoInterno,
            descricao: i.pedidoItem.bidItem.material.descricao,
            unidadeMedida: i.pedidoItem.unidadeMedida,
            quantidadeRecebida: numero(i.quantidadeRecebida) ?? 0,
            quantidadeDevolvida: numero(i.quantidadeDevolvida) ?? 0,
            situacao: i.situacao,
            motivo: i.motivo,
          })),
        },
      };
    },
  );

  // --------------------------------------------------------
  //  Marcar o pedido como enviado ao fornecedor
  //
  //  Enquanto o WhatsApp não está ligado (Etapa 10), o comprador
  //  manda o PDF por fora e marca aqui. Sem isso o pedido ficaria
  //  eternamente em "Rascunho" e ninguém saberia o que esperar.
  // --------------------------------------------------------
  app.post(
    '/api/pedidos/:id/enviar',
    { preHandler: app.exigirPermissao('pedidos.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const pedido = await banco.pedido.findUnique({ where: { id } });
      if (!pedido) return res.status(404).send({ erro: 'Pedido não encontrado.' });

      if (pedido.situacao !== 'RASCUNHO') {
        return res.status(409).send({
          erro: 'Este pedido já saiu do rascunho.',
          situacaoAtual: pedido.situacao,
        });
      }

      const atualizado = await banco.pedido.update({
        where: { id },
        data: { situacao: 'ENVIADO', enviadoEm: new Date() },
      });

      return {
        ok: true,
        situacao: atualizado.situacao,
        mensagem:
          formatarNumeroPedido(atualizado.numero) +
          ' marcado como enviado. O almoxarifado já pode receber por esse número.',
      };
    },
  );
}
