// ============================================================
//  Equalização, última chamada e pedido de compra
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { numero, erroDeValidacao, textoOpcional } from '../servicos/util.js';
import {
  formatarNumeroBid, podeIrPara, descreverPagamento,
  type SituacaoBid,
} from '../servicos/cotacao.js';
import {
  montarComparativo, mensagemUltimaChamada, conferirEscolhas, formatarNumeroPedido,
} from '../servicos/equalizacao.js';
import { gerarPdfPedido } from '../servicos/pdf-pedido.js';
import { integracoes } from '../integracoes/index.js';

const INCLUIR_BID = {
  itens: {
    orderBy: { ordem: 'asc' },
    include: {
      material: { select: { codigoInterno: true, descricao: true, normaTecnica: true } },
      solicitacaoItem: {
        select: {
          especificacaoTecnica: true,
          solicitacao: { select: { numero: true, obra: { select: { codigo: true, nome: true } } } },
        },
      },
      cotacoes: { include: { bidFornecedor: { include: { fornecedor: true } } } },
    },
  },
  convidados: { include: { fornecedor: true } },
} as const;

export async function rotasEqualizacao(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Mapa comparativo
  // --------------------------------------------------------
  app.get(
    '/api/cotacoes/:id/equalizacao',
    { preHandler: app.exigirPermissao('cotacoes.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const bid = await banco.bid.findUnique({ where: { id }, include: INCLUIR_BID });
      if (!bid) return res.status(404).send({ erro: 'Pacote não encontrado.' });

      const responderam = bid.convidados.filter((c) => c.respondidoEm);

      const custos: Record<string, { frete: number; outros: number }> = {};
      for (const c of bid.convidados) {
        custos[c.id] = {
          frete: numero(c.valorFrete) ?? 0,
          outros: numero(c.outrosCustos) ?? 0,
        };
      }

      const comparativo = montarComparativo(
        bid.itens.map((item) => ({
          bidItemId: item.id,
          codigo: item.material.codigoInterno,
          descricao: item.material.descricao,
          unidadeMedida: item.unidadeMedida,
          quantidade: numero(item.quantidade) ?? 0,
          respostas: item.cotacoes.map((c) => ({
            bidFornecedorId: c.bidFornecedorId,
            fornecedorNome:
              c.bidFornecedor.fornecedor.nomeFantasia ??
              c.bidFornecedor.fornecedor.razaoSocial,
            disponivel: c.disponivel,
            valorUnitario: numero(c.valorUnitario),
            marca: c.marca,
            modelo: c.modelo,
            prazoEntregaDias: c.prazoEntregaDias,
            observacao: c.observacao,
          })),
        })),
        custos,
      );

      // Escolhas já feitas pelo comprador.
      const escolhas: Record<string, string> = {};
      for (const item of bid.itens) {
        if (!item.cotacaoVencedoraId) continue;
        const cotacao = item.cotacoes.find((c) => c.id === item.cotacaoVencedoraId);
        if (cotacao) escolhas[item.id] = cotacao.bidFornecedorId;
      }

      return {
        cotacao: {
          id: bid.id,
          numeroFormatado: formatarNumeroBid(bid.numero),
          titulo: bid.titulo,
          situacao: bid.situacao,
          rodada: bid.rodada,
          prazoResposta: bid.prazoResposta,
          totalConvidados: bid.convidados.length,
          totalResponderam: responderam.length,
        },
        condicoes: bid.convidados
          .filter((c) => c.respondidoEm)
          .map((c) => ({
            bidFornecedorId: c.id,
            fornecedor: c.fornecedor.nomeFantasia ?? c.fornecedor.razaoSocial,
            frete: numero(c.valorFrete) ?? 0,
            outrosCustos: numero(c.outrosCustos) ?? 0,
            pagamento: descreverPagamento(
              numero(c.percentualEntrada),
              c.quantidadeParcelas,
              c.intervaloParcelasDias,
            ),
            observacao: c.observacaoFornecedor,
          })),
        comparativo,
        escolhas,
      };
    },
  );

  // --------------------------------------------------------
  //  Registrar a escolha item a item
  // --------------------------------------------------------
  app.post(
    '/api/cotacoes/:id/escolhas',
    { preHandler: app.exigirPermissao('cotacoes.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const dados = z
        .object({
          escolhas: z.array(
            z.object({
              bidItemId: z.string().uuid(),
              /// Nulo desfaz a escolha daquele item.
              bidFornecedorId: z.string().uuid().nullable(),
            }),
          ),
        })
        .safeParse(req.body);

      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const bid = await banco.bid.findUnique({
        where: { id },
        include: { itens: { include: { cotacoes: true } } },
      });

      if (!bid) return res.status(404).send({ erro: 'Pacote não encontrado.' });

      if (bid.situacao === 'CONCLUIDO') {
        return res.status(409).send({
          erro: 'Este pacote já virou pedido de compra. Não é possível trocar o vencedor.',
        });
      }

      for (const escolha of dados.data.escolhas) {
        const item = bid.itens.find((i) => i.id === escolha.bidItemId);
        if (!item) {
          return res.status(400).send({ erro: 'Um dos itens não pertence a este pacote.' });
        }

        if (escolha.bidFornecedorId === null) {
          await banco.bidItem.update({
            where: { id: item.id },
            data: { cotacaoVencedoraId: null },
          });
          continue;
        }

        const cotacao = item.cotacoes.find(
          (c) => c.bidFornecedorId === escolha.bidFornecedorId && c.disponivel,
        );

        if (!cotacao) {
          return res.status(400).send({
            erro: 'Este fornecedor não cotou o item escolhido, ou marcou que não tem.',
          });
        }

        await banco.bidItem.update({
          where: { id: item.id },
          data: { cotacaoVencedoraId: cotacao.id },
        });
      }

      return { ok: true, registradas: dados.data.escolhas.length };
    },
  );

  // --------------------------------------------------------
  //  Última chamada
  // --------------------------------------------------------
  app.post(
    '/api/cotacoes/:id/ultima-chamada',
    { preHandler: app.exigirPermissao('cotacoes.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const dados = z
        .object({
          novoPrazo: z.string().datetime().or(z.string().date()),
          observacao: textoOpcional(500),
        })
        .safeParse(req.body);

      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const bid = await banco.bid.findUnique({ where: { id }, include: INCLUIR_BID });
      if (!bid) return res.status(404).send({ erro: 'Pacote não encontrado.' });

      if (!podeIrPara(bid.situacao as SituacaoBid, 'ABERTO')) {
        return res.status(409).send({
          erro: 'A última chamada só vale para um pacote encerrado.',
          situacaoAtual: bid.situacao,
        });
      }

      const prazo = new Date(dados.data.novoPrazo);

      if (prazo <= new Date()) {
        return res.status(400).send({ erro: 'O novo prazo precisa ser no futuro.' });
      }

      // Recalcula quem está atrás em quais itens.
      const custos: Record<string, { frete: number; outros: number }> = {};
      for (const c of bid.convidados) {
        custos[c.id] = {
          frete: numero(c.valorFrete) ?? 0,
          outros: numero(c.outrosCustos) ?? 0,
        };
      }

      const comparativo = montarComparativo(
        bid.itens.map((item) => ({
          bidItemId: item.id,
          codigo: item.material.codigoInterno,
          descricao: item.material.descricao,
          unidadeMedida: item.unidadeMedida,
          quantidade: numero(item.quantidade) ?? 0,
          respostas: item.cotacoes.map((c) => ({
            bidFornecedorId: c.bidFornecedorId,
            fornecedorNome:
              c.bidFornecedor.fornecedor.nomeFantasia ?? c.bidFornecedor.fornecedor.razaoSocial,
            disponivel: c.disponivel,
            valorUnitario: numero(c.valorUnitario),
            marca: c.marca,
            modelo: c.modelo,
            prazoEntregaDias: c.prazoEntregaDias,
            observacao: c.observacao,
          })),
        })),
        custos,
      );

      await banco.$transaction([
        banco.bid.update({
          where: { id },
          data: {
            situacao: 'ABERTO',
            rodada: bid.rodada + 1,
            prazoResposta: prazo,
            encerradoEm: null,
          },
        }),
        banco.bidFornecedor.updateMany({
          where: { bidId: id },
          data: { expiraEm: prazo },
        }),
      ]);

      // Avisa cada fornecedor. NUNCA revelando o preço do concorrente.
      const avisos: Array<{
        fornecedor: string;
        itensAtras: number;
        enviado: boolean;
        adaptador: string;
      }> = [];

      for (const resumo of comparativo.fornecedores) {
        const convite = bid.convidados.find((c) => c.id === resumo.bidFornecedorId);
        if (!convite?.respondidoEm) continue;

        const itensAtras = resumo.itensAtras
          .map((itemId) => {
            const linha = comparativo.linhas.find((l) => l.bidItemId === itemId);
            return linha
              ? { codigo: linha.codigo, descricao: linha.descricao }
              : null;
          })
          .filter((x): x is { codigo: string; descricao: string } => x !== null);

        const texto =
          mensagemUltimaChamada(formatarNumeroBid(bid.numero), itensAtras, prazo) +
          (dados.data.observacao ? '\n' + dados.data.observacao : '') +
          '\nLink: /portal/' + convite.token;

        if (!convite.fornecedor.whatsapp) {
          avisos.push({
            fornecedor: convite.fornecedor.razaoSocial,
            itensAtras: itensAtras.length,
            enviado: false,
            adaptador: 'sem-whatsapp',
          });
          continue;
        }

        const resultado = await integracoes.whatsapp.enviar({
          para: convite.fornecedor.whatsapp,
          texto,
        });

        avisos.push({
          fornecedor: convite.fornecedor.razaoSocial,
          itensAtras: itensAtras.length,
          enviado: resultado.sucesso,
          adaptador: resultado.adaptador,
        });
      }

      return {
        ok: true,
        rodada: bid.rodada + 1,
        novoPrazo: prazo,
        avisos,
        mensagem:
          'Última chamada aberta (rodada ' + (bid.rodada + 1) + '). ' +
          avisos.length + ' fornecedor(es) avisado(s), sem revelar preço de concorrente.',
      };
    },
  );

  // --------------------------------------------------------
  //  Gerar os pedidos de compra
  // --------------------------------------------------------
  app.post(
    '/api/cotacoes/:id/gerar-pedidos',
    { preHandler: app.exigirPermissao('pedidos.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const bid = await banco.bid.findUnique({ where: { id }, include: INCLUIR_BID });
      if (!bid) return res.status(404).send({ erro: 'Pacote não encontrado.' });

      if (bid.situacao === 'CONCLUIDO') {
        return res.status(409).send({ erro: 'Os pedidos deste pacote já foram gerados.' });
      }

      if (bid.situacao === 'ABERTO') {
        return res.status(409).send({
          erro: 'Encerre a cotação antes de gerar os pedidos.',
          situacaoAtual: bid.situacao,
        });
      }

      const problemas = conferirEscolhas(
        bid.itens.map((i) => ({
          bidItemId: i.id,
          descricao: i.material.descricao,
          escolhido: Boolean(i.cotacaoVencedoraId),
          temCotacao: i.cotacoes.some((c) => c.disponivel && c.valorUnitario !== null),
        })),
      );

      if (problemas.length > 0) {
        return res.status(400).send({
          erro: 'Ainda não é possível gerar os pedidos.',
          detalhes: problemas,
        });
      }

      // Agrupa os itens vencidos por fornecedor.
      const porFornecedor = new Map<string, typeof bid.itens>();

      for (const item of bid.itens) {
        const vencedora = item.cotacoes.find((c) => c.id === item.cotacaoVencedoraId);
        if (!vencedora) continue;

        const atual = porFornecedor.get(vencedora.bidFornecedorId) ?? [];
        atual.push(item);
        porFornecedor.set(vencedora.bidFornecedorId, atual);
      }

      const criados: Array<{ numero: string; fornecedor: string; total: number; id: string }> = [];

      for (const [bidFornecedorId, itens] of porFornecedor) {
        const convite = bid.convidados.find((c) => c.id === bidFornecedorId);
        if (!convite) continue;

        const pedido = await banco.pedido.create({
          data: {
            bidId: id,
            fornecedorId: convite.fornecedorId,
            compradorId: req.usuario!.id,
            valorFrete: convite.valorFrete,
            outrosCustos: convite.outrosCustos,
            percentualEntrada: convite.percentualEntrada,
            quantidadeParcelas: convite.quantidadeParcelas,
            intervaloParcelasDias: convite.intervaloParcelasDias,
            observacoes: convite.observacaoFornecedor,
            itens: {
              create: itens.map((item, indice) => {
                const v = item.cotacoes.find((c) => c.id === item.cotacaoVencedoraId)!;
                return {
                  bidItemId: item.id,
                  quantidade: item.quantidade,
                  unidadeMedida: item.unidadeMedida,
                  valorUnitario: v.valorUnitario ?? 0,
                  marca: v.marca,
                  modelo: v.modelo,
                  prazoEntregaDias: v.prazoEntregaDias,
                  ordem: indice + 1,
                };
              }),
            },
          },
          include: { itens: true, fornecedor: true },
        });

        const total =
          pedido.itens.reduce(
            (s, i) => s + (numero(i.quantidade) ?? 0) * (numero(i.valorUnitario) ?? 0),
            0,
          ) +
          (numero(pedido.valorFrete) ?? 0) +
          (numero(pedido.outrosCustos) ?? 0);

        criados.push({
          id: pedido.id,
          numero: formatarNumeroPedido(pedido.numero),
          fornecedor: pedido.fornecedor.nomeFantasia ?? pedido.fornecedor.razaoSocial,
          total,
        });
      }

      await banco.bid.update({ where: { id }, data: { situacao: 'CONCLUIDO' } });

      return {
        ok: true,
        pedidos: criados,
        mensagem:
          criados.length === 1
            ? '1 pedido de compra gerado.'
            : criados.length + ' pedidos de compra gerados, um por fornecedor vencedor.',
      };
    },
  );

  // --------------------------------------------------------
  //  Listar pedidos
  // --------------------------------------------------------
  app.get(
    '/api/pedidos',
    { preHandler: app.exigirPermissao('pedidos.gerenciar', 'financeiro.ver') },
    async (req) => {
      const { situacao } = req.query as { situacao?: string };

      const pedidos = await banco.pedido.findMany({
        where: situacao ? { situacao: situacao as never } : {},
        include: {
          fornecedor: true,
          comprador: { select: { nome: true } },
          bid: { select: { numero: true, titulo: true } },
          itens: true,
        },
        orderBy: { numero: 'desc' },
        take: 200,
      });

      return {
        pedidos: pedidos.map((p) => ({
          id: p.id,
          numeroFormatado: formatarNumeroPedido(p.numero),
          situacao: p.situacao,
          fornecedor: p.fornecedor.nomeFantasia ?? p.fornecedor.razaoSocial,
          comprador: p.comprador.nome,
          origem: formatarNumeroBid(p.bid.numero) + ' · ' + p.bid.titulo,
          quantidadeItens: p.itens.length,
          total:
            p.itens.reduce(
              (s, i) => s + (numero(i.quantidade) ?? 0) * (numero(i.valorUnitario) ?? 0),
              0,
            ) +
            (numero(p.valorFrete) ?? 0) +
            (numero(p.outrosCustos) ?? 0),
          pagamento: descreverPagamento(
            numero(p.percentualEntrada),
            p.quantidadeParcelas,
            p.intervaloParcelasDias,
          ),
          criadoEm: p.criadoEm,
          enviadoEm: p.enviadoEm,
        })),
      };
    },
  );

  // --------------------------------------------------------
  //  PDF do pedido
  // --------------------------------------------------------
  app.get(
    '/api/pedidos/:id/pdf',
    { preHandler: app.exigirPermissao('pedidos.gerenciar', 'financeiro.ver') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const pedido = await banco.pedido.findUnique({
        where: { id },
        include: {
          fornecedor: true,
          comprador: { select: { nome: true } },
          bid: { select: { numero: true, titulo: true } },
          itens: {
            orderBy: { ordem: 'asc' },
            include: {
              bidItem: {
                include: {
                  material: { select: { codigoInterno: true, descricao: true, normaTecnica: true } },
                  solicitacaoItem: {
                    select: {
                      solicitacao: {
                        select: { numero: true, obra: { select: { codigo: true, nome: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!pedido) return res.status(404).send({ erro: 'Pedido não encontrado.' });

      const pdf = await gerarPdfPedido({
        numero: pedido.numero,
        situacao: pedido.situacao,
        criadoEm: pedido.criadoEm,
        comprador: pedido.comprador.nome,
        origem: formatarNumeroBid(pedido.bid.numero) + ' — ' + pedido.bid.titulo,
        fornecedor: {
          razaoSocial: pedido.fornecedor.razaoSocial,
          nomeFantasia: pedido.fornecedor.nomeFantasia,
          cnpj: pedido.fornecedor.cnpj,
          email: pedido.fornecedor.email,
          telefone: pedido.fornecedor.whatsapp ?? pedido.fornecedor.telefone,
        },
        frete: numero(pedido.valorFrete) ?? 0,
        outrosCustos: numero(pedido.outrosCustos) ?? 0,
        pagamento: descreverPagamento(
          numero(pedido.percentualEntrada),
          pedido.quantidadeParcelas,
          pedido.intervaloParcelasDias,
        ),
        observacoes: pedido.observacoes,
        itens: pedido.itens.map((i) => ({
          ordem: i.ordem,
          codigo: i.bidItem.material.codigoInterno,
          descricao: i.bidItem.material.descricao,
          normaTecnica: i.bidItem.material.normaTecnica,
          unidadeMedida: i.unidadeMedida,
          quantidade: numero(i.quantidade) ?? 0,
          valorUnitario: numero(i.valorUnitario) ?? 0,
          marca: i.marca,
          modelo: i.modelo,
          prazoEntregaDias: i.prazoEntregaDias,
          obra: i.bidItem.solicitacaoItem.solicitacao.obra,
        })),
      });

      return res
        .header('Content-Type', 'application/pdf')
        .header(
          'Content-Disposition',
          'attachment; filename="' + formatarNumeroPedido(pedido.numero) + '.pdf"',
        )
        .send(pdf);
    },
  );
}
