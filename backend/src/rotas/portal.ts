// ============================================================
//  Portal do fornecedor — ROTAS PÚBLICAS
//
//  ATENÇÃO: estas rotas NÃO exigem login. Quem tem o link entra.
//
//  Por isso, três regras que valem para tudo aqui:
//
//  1. O fornecedor só enxerga o PRÓPRIO convite. Nunca o preço,
//     o nome ou a existência dos concorrentes.
//  2. O link vence junto com o prazo da cotação.
//  3. Limite de tentativas apertado: sem isso, alguém poderia
//     varrer links no chute.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { numero, erroDeValidacao, textoOpcional } from '../servicos/util.js';
import {
  conferirLink, calcularTotais, formatarNumeroBid, descreverPagamento,
  MENSAGEM_RECUSA, STATUS_RECUSA,
  type SituacaoBid,
} from '../servicos/cotacao.js';

const esquemaResposta = z.object({
  itens: z.array(
    z.object({
      bidItemId: z.string().uuid(),
      disponivel: z.boolean().default(true),
      valorUnitario: z.coerce.number().min(0).nullable().optional(),
      marca: textoOpcional(120),
      modelo: textoOpcional(120),
      prazoEntregaDias: z.coerce.number().int().min(0).max(365).nullable().optional(),
      observacao: textoOpcional(500),
    }),
  ),
  valorFrete: z.coerce.number().min(0).nullable().optional(),
  outrosCustos: z.coerce.number().min(0).nullable().optional(),
  percentualEntrada: z.coerce.number().min(0).max(100).nullable().optional(),
  quantidadeParcelas: z.coerce.number().int().min(1).max(60).nullable().optional(),
  intervaloParcelasDias: z.coerce.number().int().min(1).max(365).nullable().optional(),
  observacaoFornecedor: textoOpcional(1000),
})
  // 100% DE ENTRADA E PARCELAS NÃO EXISTEM JUNTOS.
  //
  // Um fornecedor respondeu "100% de entrada + 5x a cada 30 dias" e
  // o sistema guardou. Não é preciosismo: é a conta do prazo médio
  // de pagamento, que compara propostas. Com 100% de entrada ela dá
  // "à vista", e as cinco parcelas somem sem ninguém ser avisado.
  .refine(
    (d) => !(d.percentualEntrada === 100 && (d.quantidadeParcelas ?? 0) > 1),
    {
      path: ['quantidadeParcelas'],
      message: 'Com 100% de entrada não há parcelas. Reduza a entrada ou deixe as parcelas em branco.',
    },
  );

/** Carrega o convite pelo token, com tudo que o portal precisa. */
async function carregarConvite(token: string) {
  return banco.bidFornecedor.findUnique({
    where: { token },
    include: {
      fornecedor: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true } },
      bid: {
        include: {
          itens: {
            orderBy: { ordem: 'asc' },
            include: {
              material: {
                select: {
                  codigoInterno: true, descricao: true, unidadeMedida: true,
                  normaTecnica: true, marca: true,
                },
              },
              solicitacaoItem: {
                select: { especificacaoTecnica: true, descricaoComplementar: true },
              },
            },
          },
        },
      },
      cotacoes: true,
    },
  });
}

export async function rotasPortal(app: FastifyInstance) {
  // Limite bem mais apertado que o do resto do sistema: estas
  // rotas são abertas, então são o alvo mais provável.
  const limite = { rateLimit: { max: 30, timeWindow: '5 minutes' } };

  // --------------------------------------------------------
  //  Abrir o convite
  // --------------------------------------------------------
  app.get('/api/portal/:token', { config: limite }, async (req, res) => {
    const { token } = req.params as { token: string };
    const convite = await carregarConvite(token);

    const conferencia = conferirLink({
      existe: Boolean(convite),
      expiraEm: convite?.expiraEm,
      situacaoBid: convite?.bid.situacao as SituacaoBid | undefined,
      respondidoEm: convite?.respondidoEm,
      // O fluxo prevê "rever cotação": enquanto o prazo corre,
      // o fornecedor pode corrigir o que enviou.
      permiteRevisao: true,
    });

    if (!conferencia.ok || !convite) {
      const motivo = conferencia.ok ? 'nao-encontrado' : conferencia.motivo;
      return res.status(STATUS_RECUSA[motivo]).send({
        erro: MENSAGEM_RECUSA[motivo],
        motivo,
      });
    }

    // Registra a primeira abertura: o comprador vê quem já olhou.
    if (!convite.visualizadoEm) {
      await banco.bidFornecedor.update({
        where: { id: convite.id },
        data: { visualizadoEm: new Date() },
      });
    }

    const porItem = new Map(convite.cotacoes.map((c) => [c.bidItemId, c]));

    return {
      cotacao: {
        numeroFormatado: formatarNumeroBid(convite.bid.numero),
        titulo: convite.bid.titulo,
        observacoes: convite.bid.observacoes,
        prazoResposta: convite.bid.prazoResposta,
        // Quem está convidado a responder. Nada sobre os outros.
        fornecedor: convite.fornecedor,
        jaRespondeu: Boolean(convite.respondidoEm),
        respondidoEm: convite.respondidoEm,
        itens: convite.bid.itens.map((i) => {
          const minha = porItem.get(i.id);

          return {
            id: i.id,
            codigo: i.material.codigoInterno,
            descricao: i.material.descricao,
            marcaReferencia: i.material.marca,
            normaTecnica: i.material.normaTecnica,
            especificacao: i.solicitacaoItem.especificacaoTecnica,
            detalhes: i.solicitacaoItem.descricaoComplementar,
            quantidade: numero(i.quantidade) ?? 0,
            unidadeMedida: i.unidadeMedida,
            // A resposta anterior DESTE fornecedor, para ele revisar.
            minhaResposta: minha
              ? {
                  disponivel: minha.disponivel,
                  valorUnitario: numero(minha.valorUnitario),
                  marca: minha.marca,
                  modelo: minha.modelo,
                  prazoEntregaDias: minha.prazoEntregaDias,
                  observacao: minha.observacao,
                }
              : null,
          };
        }),
        minhasCondicoes: {
          valorFrete: numero(convite.valorFrete),
          outrosCustos: numero(convite.outrosCustos),
          percentualEntrada: numero(convite.percentualEntrada),
          quantidadeParcelas: convite.quantidadeParcelas,
          intervaloParcelasDias: convite.intervaloParcelasDias,
          observacaoFornecedor: convite.observacaoFornecedor,
        },
      },
    };
  });

  // --------------------------------------------------------
  //  Enviar a resposta
  // --------------------------------------------------------
  app.post('/api/portal/:token', { config: limite }, async (req, res) => {
    const { token } = req.params as { token: string };
    const dados = esquemaResposta.safeParse(req.body);

    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    const convite = await carregarConvite(token);

    const conferencia = conferirLink({
      existe: Boolean(convite),
      expiraEm: convite?.expiraEm,
      situacaoBid: convite?.bid.situacao as SituacaoBid | undefined,
      respondidoEm: convite?.respondidoEm,
      permiteRevisao: true,
    });

    if (!conferencia.ok || !convite) {
      const motivo = conferencia.ok ? 'nao-encontrado' : conferencia.motivo;
      return res.status(STATUS_RECUSA[motivo]).send({ erro: MENSAGEM_RECUSA[motivo] });
    }

    // Os itens precisam pertencer a ESTE pacote. Sem esta conferência,
    // alguém poderia tentar cotar item de outra cotação.
    const idsDoPacote = new Set(convite.bid.itens.map((i) => i.id));
    const forasteiros = dados.data.itens.filter((i) => !idsDoPacote.has(i.bidItemId));

    if (forasteiros.length > 0) {
      return res.status(400).send({ erro: 'Um dos itens não pertence a esta cotação.' });
    }

    // Item disponível precisa ter preço.
    const semPreco = dados.data.itens.filter(
      (i) => i.disponivel && (i.valorUnitario === null || i.valorUnitario === undefined),
    );

    if (semPreco.length > 0) {
      return res.status(400).send({
        erro: 'Informe o preço dos itens disponíveis.',
        detalhes: [
          semPreco.length + ' item(ns) marcado(s) como disponível estão sem valor unitário. ' +
          'Se você não trabalha com o item, marque "Não tenho este item".',
        ],
      });
    }

    await banco.$transaction([
      banco.cotacaoItem.deleteMany({ where: { bidFornecedorId: convite.id } }),
      banco.cotacaoItem.createMany({
        data: dados.data.itens.map((i) => ({
          bidFornecedorId: convite.id,
          bidItemId: i.bidItemId,
          disponivel: i.disponivel,
          valorUnitario: i.disponivel ? (i.valorUnitario ?? 0) : null,
          marca: i.marca,
          modelo: i.modelo,
          prazoEntregaDias: i.prazoEntregaDias ?? null,
          observacao: i.observacao,
        })),
      }),
      banco.bidFornecedor.update({
        where: { id: convite.id },
        data: {
          respondidoEm: new Date(),
          valorFrete: dados.data.valorFrete ?? null,
          outrosCustos: dados.data.outrosCustos ?? null,
          percentualEntrada: dados.data.percentualEntrada ?? null,
          quantidadeParcelas: dados.data.quantidadeParcelas ?? null,
          intervaloParcelasDias: dados.data.intervaloParcelasDias ?? null,
          observacaoFornecedor: dados.data.observacaoFornecedor,
        },
      }),
    ]);

    const totais = calcularTotais(
      dados.data.itens.map((i) => ({
        disponivel: i.disponivel,
        valorUnitario: i.valorUnitario ?? null,
        quantidade:
          numero(convite.bid.itens.find((x) => x.id === i.bidItemId)?.quantidade ?? null) ?? 0,
      })),
      dados.data.valorFrete ?? 0,
      dados.data.outrosCustos ?? 0,
      convite.bid.itens.length,
    );

    return {
      ok: true,
      mensagem: 'Cotação enviada. Obrigado!',
      // O fornecedor vê o próprio total — e nada mais.
      resumo: {
        itensCotados: totais.itensCotados,
        itensIndisponiveis: totais.itensIndisponiveis,
        subtotal: totais.subtotal,
        frete: totais.frete,
        outros: totais.outros,
        total: totais.total,
        pagamento: descreverPagamento(
          dados.data.percentualEntrada ?? null,
          dados.data.quantidadeParcelas ?? null,
          dados.data.intervaloParcelasDias ?? null,
        ),
      },
      podeRevisar: true,
      prazoResposta: convite.bid.prazoResposta,
    };
  });
}
