// ============================================================
//  Equalização, última chamada e pedido de compra
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { numero, erroDeValidacao, textoOpcional } from '../servicos/util.js';
import {
  formatarNumeroBid, podeIrPara, descreverPagamento, prazoMedioDePagamento,
  type SituacaoBid,
} from '../servicos/cotacao.js';
import {
  montarComparativo, mensagemUltimaChamada, conferirEscolhas, formatarNumeroPedido,
} from '../servicos/equalizacao.js';
import { gerarPdfPedido } from '../servicos/pdf-pedido.js';
// Aliás porque três serviços exportam `formatarNumero`, cada um com
// o prefixo do seu documento.
import { formatarNumero as numeroDaSolicitacao } from '../servicos/solicitacao.js';
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

/**
 * Tudo que um pedido de compra carrega.
 *
 * Estava escrito duas vezes — uma na rota da lista, outra na do
 * PDF — e a tela de detalhe ia ser a terceira. Num lugar só: o que
 * aparece na tela e o que sai no papel não podem divergir, porque
 * é o mesmo documento e o fornecedor recebe uma cópia dele.
 */
const INCLUIR_PEDIDO = {
  fornecedor: true,
  comprador: { select: { nome: true } },
  bid: { select: { id: true, numero: true, titulo: true } },
  itens: {
    orderBy: { ordem: 'asc' },
    include: {
      bidItem: {
        include: {
          material: { select: { codigoInterno: true, descricao: true, normaTecnica: true } },
          solicitacaoItem: {
            select: {
              solicitacao: {
                select: { id: true, numero: true, obra: { select: { codigo: true, nome: true } } },
              },
            },
          },
        },
      },
    },
  },
} as const;

function carregarPedido(id: string) {
  return banco.pedido.findUnique({ where: { id }, include: INCLUIR_PEDIDO });
}

type PedidoCompleto = NonNullable<Awaited<ReturnType<typeof carregarPedido>>>;

/** O pedido como o PDF e a tela precisam dele. */
function montarPedido(p: PedidoCompleto) {
  const itens = p.itens.map((i) => ({
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
  }));

  const frete = numero(p.valorFrete) ?? 0;
  const outrosCustos = numero(p.outrosCustos) ?? 0;
  const subtotal = itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);

  // A corrente que o pedido fecha: quem pediu, qual cotação
  // escolheu, e este pedido. É o que responde "por que compramos
  // isto, deste fornecedor, por este preço" — sem abrir três telas.
  const solicitacoes = [
    ...new Map(
      p.itens.map((i) => {
        const s = i.bidItem.solicitacaoItem.solicitacao;
        return [s.id, { id: s.id, numeroFormatado: numeroDaSolicitacao(s.numero) }];
      }),
    ).values(),
  ];

  return {
    id: p.id,
    numero: p.numero,
    numeroFormatado: formatarNumeroPedido(p.numero),
    situacao: p.situacao,
    criadoEm: p.criadoEm,
    enviadoEm: p.enviadoEm,
    confirmadoEm: p.confirmadoEm,
    comprador: p.comprador.nome,
    origem: formatarNumeroBid(p.bid.numero) + ' — ' + p.bid.titulo,
    cotacao: { id: p.bid.id, numeroFormatado: formatarNumeroBid(p.bid.numero), titulo: p.bid.titulo },
    solicitacoes,
    fornecedor: {
      id: p.fornecedor.id,
      razaoSocial: p.fornecedor.razaoSocial,
      nomeFantasia: p.fornecedor.nomeFantasia,
      cnpj: p.fornecedor.cnpj,
      email: p.fornecedor.email,
      telefone: p.fornecedor.whatsapp ?? p.fornecedor.telefone,
      cidade: p.fornecedor.cidade,
      uf: p.fornecedor.uf,
    },
    frete,
    outrosCustos,
    subtotal,
    total: subtotal + frete + outrosCustos,
    percentualEntrada: numero(p.percentualEntrada),
    quantidadeParcelas: p.quantidadeParcelas,
    intervaloParcelasDias: p.intervaloParcelasDias,
    pagamento: descreverPagamento(
      numero(p.percentualEntrada),
      p.quantidadeParcelas,
      p.intervaloParcelasDias,
    ),
    observacoes: p.observacoes,
    itens,
  };
}

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

      // QUANTO PAGAMOS DA ÚLTIMA VEZ.
      //
      // A pergunta número um de quem compra, e o sistema tinha a
      // resposta guardada sem mostrar para ninguém. Na validação de
      // 28/09/2026 uma compra fechou 56% abaixo do que o solicitante
      // estimou — ele teria acertado o chute se soubesse o preço da
      // última vez.
      //
      // Aqui, na equalização, é onde o número vale mais: o comprador
      // vê "R$ 51,00 · 155% acima da última compra" antes de
      // escolher, e não depois, num relatório.
      const materiaisDoPacote = [...new Set(bid.itens.map((i) => i.materialId))];

      const comprasAnteriores = await banco.pedidoItem.findMany({
        where: {
          bidItem: { materialId: { in: materiaisDoPacote }, bidId: { not: id } },
          pedido: { situacao: { not: 'CANCELADO' } },
        },
        orderBy: { pedido: { criadoEm: 'desc' } },
        select: {
          valorUnitario: true,
          bidItem: { select: { materialId: true } },
          pedido: { select: { criadoEm: true } },
        },
      });

      // A mais recente de cada material. A lista já vem ordenada,
      // então a primeira que aparecer é a que vale.
      const ultimaCompra: Record<string, { valorUnitario: number; quando: Date }> = {};
      for (const c of comprasAnteriores) {
        const material = c.bidItem.materialId;
        if (ultimaCompra[material]) continue;

        ultimaCompra[material] = {
          valorUnitario: numero(c.valorUnitario) ?? 0,
          quando: c.pedido.criadoEm,
        };
      }

      const historico = bid.itens.map((item) => ({
        bidItemId: item.id,
        ultimaCompra: ultimaCompra[item.materialId] ?? null,
      }));

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
            // O prazo vale dinheiro: quem paga depois usa o caixa
            // da construtora de graça até lá. A conversão em reais
            // fica na tela, onde o comprador informa quanto custa o
            // dinheiro da empresa.
            prazoMedioPagamento: prazoMedioDePagamento(
              numero(c.percentualEntrada),
              c.quantidadeParcelas,
              c.intervaloParcelasDias,
            ),
            observacao: c.observacaoFornecedor,
          })),
        comparativo,
        historico,
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
  //  Um pedido inteiro
  //
  //  O PDF ja montava esse documento; a tela nao tinha de onde ler
  //  e por isso nunca existiu — para ver o que havia dentro de um
  //  pedido so baixando o arquivo. Agora os dois leem do MESMO
  //  lugar, senao o que sai no papel e o que aparece na tela
  //  envelhecem cada um para o seu lado.
  // --------------------------------------------------------
  app.get(
    '/api/pedidos/:id',
    { preHandler: app.exigirPermissao('pedidos.gerenciar', 'financeiro.ver') },
    async (req, res) => {
      const { id } = req.params as { id: string };
      const pedido = await carregarPedido(id);

      if (!pedido) return res.status(404).send({ erro: 'Pedido não encontrado.' });

      return { pedido: montarPedido(pedido) };
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
        include: INCLUIR_PEDIDO,
        orderBy: { numero: 'desc' },
        take: 200,
      });

      // A lista é o mesmo documento, resumido. O total somava
      // itens + frete + outros aqui e de novo no PDF; agora a conta
      // mora num lugar só.
      return {
        pedidos: pedidos.map((p) => {
          const d = montarPedido(p);

          return {
            id: d.id,
            numeroFormatado: d.numeroFormatado,
            situacao: d.situacao,
            fornecedor: d.fornecedor.nomeFantasia ?? d.fornecedor.razaoSocial,
            comprador: d.comprador,
            origem: d.cotacao.numeroFormatado + ' · ' + d.cotacao.titulo,
            quantidadeItens: d.itens.length,
            total: d.total,
            pagamento: d.pagamento,
            criadoEm: d.criadoEm,
            enviadoEm: d.enviadoEm,
          };
        }),
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

      const carregado = await carregarPedido(id);

      if (!carregado) return res.status(404).send({ erro: 'Pedido não encontrado.' });

      // O MESMO documento que a tela mostra. Era montado aqui de
      // novo, campo por campo, e nada garantia que os dois
      // continuassem iguais.
      const pedido = montarPedido(carregado);
      const pdf = await gerarPdfPedido(pedido);

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
