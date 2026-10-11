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
import { numero, erroDeValidacao, textoOpcional, plural } from '../servicos/util.js';
import {
  conferirLink, calcularTotais, formatarNumeroBid, descreverPagamento,
  MENSAGEM_RECUSA, STATUS_RECUSA,
  type SituacaoBid,
} from '../servicos/cotacao.js';
import { conferirCondicaoDePagamento } from '../servicos/fiscal.js';

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
  // A CONDIÇÃO DE PAGAMENTO NÃO SAI PELA METADE.
  //
  // PRIMEIRA das três portas, e a única em que a pessoa que sabe a
  // resposta ainda está presente. Daqui a três meses, quando a nota
  // chegar, ninguém mais consegue perguntar ao vendedor de quantos
  // em quantos dias ele queria receber.
  //
  // A regra mora em `conferirCondicaoDePagamento`, e é a MESMA usada
  // ao gerar o pedido e ao gerar as parcelas. Se cada lugar tivesse
  // a sua, elas divergiriam — foi o que aconteceu com a palavra "à
  // vista", que o financeiro escrevia e a cotação não.
  //
  // O que isto barra, medido na varredura de 10/10/2026:
  //   "100% de entrada + 5x"       já era barrado (caso real)
  //   "entrada de 30%" e nada mais  perdia os outros 70% da nota
  //   "3 parcelas" sem o intervalo  virava 30 dias chutados
  .superRefine((d, ctx) => {
    const problema = conferirCondicaoDePagamento({
      percentualEntrada: d.percentualEntrada,
      quantidadeParcelas: d.quantidadeParcelas,
      intervaloDias: d.intervaloParcelasDias,
    });

    if (problema) {
      ctx.addIssue({ code: 'custom', path: ['quantidadeParcelas'], message: problema });
    }
  });

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

type Convite = NonNullable<Awaited<ReturnType<typeof carregarConvite>>>;

/**
 * O QUE ELE ENVIOU, montado do que está guardado.
 *
 * Serve de comprovante na tela travada. Sem isto, quem abre o
 * link de novo lê "você já enviou" e continua sem saber O QUE
 * enviou — que é justamente a dúvida que faz o fornecedor ligar
 * para o comprador.
 *
 * É o mesmo cálculo que a resposta do POST devolve, só que a
 * partir do banco em vez do corpo da requisição.
 */
function resumoDoQueEnviou(convite: Convite) {
  const quantidadePor = new Map(
    convite.bid.itens.map((i) => [i.id, numero(i.quantidade) ?? 0]),
  );

  const totais = calcularTotais(
    convite.cotacoes.map((c) => ({
      disponivel: c.disponivel,
      valorUnitario: numero(c.valorUnitario),
      quantidade: quantidadePor.get(c.bidItemId) ?? 0,
    })),
    numero(convite.valorFrete) ?? 0,
    numero(convite.outrosCustos) ?? 0,
    convite.bid.itens.length,
  );

  return {
    respondidoEm: convite.respondidoEm,
    itensCotados: totais.itensCotados,
    itensIndisponiveis: totais.itensIndisponiveis,
    subtotal: totais.subtotal,
    frete: totais.frete,
    outros: totais.outros,
    total: totais.total,
    pagamento: descreverPagamento(
      numero(convite.percentualEntrada),
      convite.quantidadeParcelas,
      convite.intervaloParcelasDias,
    ),
  };
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
      rodadaRespondida: convite?.rodadaRespondida,
      rodadaAtual: convite?.bid.rodada,
    });

    if (!conferencia.ok || !convite) {
      const motivo = conferencia.ok ? 'nao-encontrado' : conferencia.motivo;

      return res.status(STATUS_RECUSA[motivo]).send({
        erro: MENSAGEM_RECUSA[motivo],
        motivo,
        //  O COMPROVANTE VAI JUNTO COM A RECUSA.
        //
        //  Só nesta: "já enviou" é a única recusa em que existe
        //  algo dele para mostrar — e é a mais comum, porque o
        //  fornecedor reabre o link justamente para conferir se
        //  deu certo. Nas outras não há o que provar.
        resumo: convite && motivo === 'ja-respondido'
          ? resumoDoQueEnviou(convite)
          : undefined,
        cotacao: convite && motivo === 'ja-respondido'
          ? {
              numeroFormatado: formatarNumeroBid(convite.bid.numero),
              titulo: convite.bid.titulo,
              fornecedor: convite.fornecedor,
            }
          : undefined,
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
      rodadaRespondida: convite?.rodadaRespondida,
      rodadaAtual: convite?.bid.rodada,
    });

    if (!conferencia.ok || !convite) {
      const motivo = conferencia.ok ? 'nao-encontrado' : conferencia.motivo;
      return res.status(STATUS_RECUSA[motivo]).send({ erro: MENSAGEM_RECUSA[motivo], motivo });
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
          plural(
            semPreco.length,
            'item marcado como disponível está',
            'itens marcados como disponíveis estão',
          ) + ' sem valor unitário. ' +
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
          //  A RODADA EM QUE ELE RESPONDEU é o que trava o link.
          //  Ver o porquê inteiro em `conferirLink`.
          rodadaRespondida: convite.bid.rodada,
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
      //  NÃO PODE MAIS REVISAR, e a tela precisa saber antes de
      //  prometer. Era `true`, e a tela de sucesso dizia "você
      //  pode revisar reabrindo este mesmo link" — promessa que a
      //  trava desmentiria no clique seguinte.
      podeRevisar: false,
      prazoResposta: convite.bid.prazoResposta,
    };
  });
}
