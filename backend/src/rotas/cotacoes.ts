// ============================================================
//  Cotações (BID) — lado do comprador
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { numero, erroDeValidacao, textoObrigatorio, textoOpcional } from '../servicos/util.js';
import { formatarNumero } from '../servicos/solicitacao.js';
import { lerPaginacao, camposDaPagina } from '../servicos/paginacao.js';
import {
  podeEditarBid, podeIrPara, formatarNumeroBid, gerarToken, conferirAbertura,
  calcularTotais, descreverPagamento,
  type SituacaoBid,
} from '../servicos/cotacao.js';
import { dataBr } from '../servicos/data-br.js';

const esquemaBid = z.object({
  titulo: textoObrigatorio(3, 'O título'),
  prazoResposta: z.string().datetime().or(z.string().date()),
  observacoes: textoOpcional(1000),
});

const INCLUIR = {
  comprador: { select: { id: true, nome: true } },
  itens: {
    orderBy: { ordem: 'asc' },
    include: {
      material: {
        select: {
          id: true, codigoInterno: true, descricao: true, unidadeMedida: true,
          normaTecnica: true, marca: true,
          familia: { select: { id: true, codigo: true, nome: true } },
        },
      },
      solicitacaoItem: {
        select: {
          especificacaoTecnica: true,
          descricaoComplementar: true,
          solicitacao: {
            select: {
              id: true, numero: true,
              obra: { select: { codigo: true, nome: true } },
            },
          },
        },
      },
      cotacoes: true,
    },
  },
  convidados: {
    include: {
      fornecedor: {
        select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, whatsapp: true, email: true },
      },
      cotacoes: true,
    },
  },
} as const;

type BidCompleto = Awaited<
  ReturnType<typeof banco.bid.findFirstOrThrow<{ include: typeof INCLUIR }>>
>;

function formatar(b: BidCompleto, incluirPrecos = true) {
  const itens = b.itens.map((i) => ({
    id: i.id,
    ordem: i.ordem,
    material: i.material,
    quantidade: numero(i.quantidade) ?? 0,
    unidadeMedida: i.unidadeMedida,
    observacao: i.observacao,
    especificacaoTecnica: i.solicitacaoItem.especificacaoTecnica,
    descricaoComplementar: i.solicitacaoItem.descricaoComplementar,
    origem: {
      solicitacao: formatarNumero(i.solicitacaoItem.solicitacao.numero),
      obra: i.solicitacaoItem.solicitacao.obra,
    },
    respostas: i.cotacoes.length,
  }));

  const convidados = b.convidados.map((c) => {
    const cotados = c.cotacoes.map((x) => ({
      disponivel: x.disponivel,
      valorUnitario: numero(x.valorUnitario),
      quantidade:
        numero(b.itens.find((i) => i.id === x.bidItemId)?.quantidade ?? null) ?? 0,
    }));

    const totais = calcularTotais(
      cotados,
      numero(c.valorFrete) ?? 0,
      numero(c.outrosCustos) ?? 0,
      b.itens.length,
    );

    return {
      id: c.id,
      fornecedor: c.fornecedor,
      expiraEm: c.expiraEm,
      visualizadoEm: c.visualizadoEm,
      respondidoEm: c.respondidoEm,
      // O link só aparece para o comprador, nunca em listagem pública.
      token: incluirPrecos ? c.token : undefined,
      frete: numero(c.valorFrete),
      outrosCustos: numero(c.outrosCustos),
      pagamento: descreverPagamento(
        numero(c.percentualEntrada),
        c.quantidadeParcelas,
        c.intervaloParcelasDias,
      ),
      observacao: c.observacaoFornecedor,
      totais: incluirPrecos ? totais : undefined,
      respondeu: Boolean(c.respondidoEm),
    };
  });

  return {
    id: b.id,
    numero: b.numero,
    numeroFormatado: formatarNumeroBid(b.numero),
    titulo: b.titulo,
    situacao: b.situacao,
    comprador: b.comprador,
    prazoResposta: b.prazoResposta,
    observacoes: b.observacoes,
    criadoEm: b.criadoEm,
    abertoEm: b.abertoEm,
    encerradoEm: b.encerradoEm,
    itens,
    convidados,
    podeEditar: podeEditarBid(b.situacao as SituacaoBid),
    respostasRecebidas: convidados.filter((c) => c.respondeu).length,
  };
}

export async function rotasCotacoes(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Itens aprovados que ainda não entraram em nenhum pacote
  // --------------------------------------------------------
  app.get(
    '/api/cotacoes/itens-disponiveis',
    { preHandler: app.exigirPermissao('cotacoes.gerenciar') },
    async (req) => {
      const { familiaId, obraId } = req.query as { familiaId?: string; obraId?: string };

      const itens = await banco.solicitacaoItem.findMany({
        where: {
          // Só itens de solicitações já aprovadas.
          solicitacao: {
            situacao: { in: ['APROVADA', 'EM_COTACAO'] },
            ...(obraId ? { obraId } : {}),
          },
          // E que ainda não estão num pacote.
          itemBid: null,
          ...(familiaId ? { material: { familiaId } } : {}),
        },
        include: {
          material: {
            select: {
              id: true, codigoInterno: true, descricao: true, unidadeMedida: true,
              normaTecnica: true,
              familia: { select: { id: true, codigo: true, nome: true } },
            },
          },
          solicitacao: {
            select: {
              id: true, numero: true, dataDesejada: true,
              obra: { select: { id: true, codigo: true, nome: true } },
              solicitante: { select: { nome: true } },
            },
          },
        },
        orderBy: [{ solicitacao: { dataDesejada: 'asc' } }, { ordem: 'asc' }],
        take: 300,
      });

      return {
        itens: itens.map((i) => ({
          id: i.id,
          material: i.material,
          quantidade: numero(i.quantidade) ?? 0,
          unidadeMedida: i.unidadeMedida,
          especificacaoTecnica: i.especificacaoTecnica,
          descricaoComplementar: i.descricaoComplementar,
          primeiraCompra: i.primeiraCompra,
          valorEstimado: numero(i.valorEstimado),
          solicitacao: {
            id: i.solicitacao.id,
            numeroFormatado: formatarNumero(i.solicitacao.numero),
            obra: i.solicitacao.obra,
            solicitante: i.solicitacao.solicitante.nome,
            dataDesejada: i.solicitacao.dataDesejada,
          },
        })),
      };
    },
  );

  // --------------------------------------------------------
  //  Listar pacotes
  // --------------------------------------------------------
  app.get(
    '/api/cotacoes',
    { preHandler: app.exigirPermissao('cotacoes.gerenciar', 'cotacoes.ver') },
    async (req) => {
      const { situacao } = req.query as { situacao?: string };

      const filtro = situacao ? { situacao: situacao as never } : {};
      const pedido = lerPaginacao(req.query as { pagina?: string; porPagina?: string });

      const [total, bids, abertos, respostas] = await Promise.all([
        banco.bid.count({ where: filtro }),
        banco.bid.findMany({
          where: filtro,
          include: INCLUIR,
          orderBy: { numero: 'desc' },
          skip: pedido.pular,
          take: pedido.porPagina,
        }),
        // Pacotes com o prazo correndo, em TODO o sistema.
        banco.bid.count({ where: { situacao: 'ABERTO' } }),
        // Fornecedores que já responderam nesses pacotes.
        banco.bidFornecedor.count({
          where: { bid: { situacao: 'ABERTO' }, respondidoEm: { not: null } },
        }),
      ]);

      return {
        cotacoes: bids.map((b) => formatar(b)),
        // Os dois números do alto da tela.
        //
        // Saíam de filtrar e somar o array da página: com vinte por
        // página, "Pacotes abertos" passaria a contar só os abertos
        // que por acaso caíssem na página aberta.
        //
        // Eles não seguem o filtro da lista de propósito: são o
        // estado do trabalho em andamento, e continuam valendo
        // enquanto a pessoa olha as canceladas do ano passado.
        resumo: { abertos, respostas },
        ...camposDaPagina(total, pedido),
      };
    },
  );

  // --------------------------------------------------------
  //  Um pacote
  // --------------------------------------------------------
  app.get(
    '/api/cotacoes/:id',
    { preHandler: app.exigirPermissao('cotacoes.gerenciar', 'cotacoes.ver') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const bid = await banco.bid.findUnique({ where: { id }, include: INCLUIR });
      if (!bid) return res.status(404).send({ erro: 'Pacote de cotação não encontrado.' });

      return { cotacao: formatar(bid) };
    },
  );

  // --------------------------------------------------------
  //  Criar pacote
  // --------------------------------------------------------
  app.post(
    '/api/cotacoes',
    { preHandler: app.exigirPermissao('cotacoes.gerenciar') },
    async (req, res) => {
      // `.min(1)`, e nao `.default([])`.
      //
      // A tela ja desabilita o botao sem item escolhido, mas a regra
      // tem de morar aqui: em 27/09/2026 uma chamada direta a API
      // criou o BID-00002 com ZERO itens, e ele virou lixo permanente
      // — pacote vazio nao tem familia, logo nao sugere fornecedor,
      // logo nao abre, e nao existe rota para apagar cotacao.
      const dados = esquemaBid
        .extend({
          itens: z
            .array(z.string().uuid())
            .min(1, 'Escolha pelo menos um item para cotar.'),
        })
        .safeParse(req.body);

      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const prazo = new Date(dados.data.prazoResposta);

      if (Number.isNaN(prazo.getTime())) {
        return res.status(400).send({ erro: 'Prazo de resposta inválido.' });
      }

      // Confere se os itens estão aprovados e livres.
      const encontrados = await banco.solicitacaoItem.findMany({
        where: { id: { in: dados.data.itens } },
        include: { solicitacao: true, itemBid: true },
      });

      // O banco devolve as linhas na ordem que ele quiser, não na
      // ordem da lista que veio da tela. Sem reordenar aqui, o
      // pacote sairia embaralhado — e o fornecedor receberia os
      // itens fora da sequência em que o comprador os escolheu.
      const posicao = new Map(dados.data.itens.map((id, i) => [id, i]));
      const itens = [...encontrados].sort(
        (a, b) => (posicao.get(a.id) ?? 0) - (posicao.get(b.id) ?? 0),
      );

      const invalidos = itens.filter(
        (i) => !['APROVADA', 'EM_COTACAO'].includes(i.solicitacao.situacao) || i.itemBid,
      );

      if (invalidos.length > 0) {
        return res.status(400).send({
          erro: 'Alguns itens não podem entrar no pacote.',
          detalhes: invalidos.map(
            (i) => 'Item de ' + formatarNumero(i.solicitacao.numero) +
              (i.itemBid ? ' já está em outro pacote.' : ' não está aprovado.'),
          ),
        });
      }

      const bid = await banco.bid.create({
        data: {
          titulo: dados.data.titulo,
          compradorId: req.usuario!.id,
          prazoResposta: prazo,
          observacoes: dados.data.observacoes,
          itens: {
            create: itens.map((i, indice) => ({
              solicitacaoItemId: i.id,
              materialId: i.materialId,
              quantidade: i.quantidade,
              unidadeMedida: i.unidadeMedida,
              ordem: indice + 1,
            })),
          },
        },
        include: INCLUIR,
      });

      return res.status(201).send({ cotacao: formatar(bid) });
    },
  );

  // --------------------------------------------------------
  //  Fornecedores sugeridos pelas famílias dos itens
  // --------------------------------------------------------
  app.get(
    '/api/cotacoes/:id/fornecedores-sugeridos',
    { preHandler: app.exigirPermissao('cotacoes.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const bid = await banco.bid.findUnique({
        where: { id },
        include: { itens: { include: { material: true } }, convidados: true },
      });

      if (!bid) return res.status(404).send({ erro: 'Pacote não encontrado.' });

      const familias = [...new Set(bid.itens.map((i) => i.material.familiaId))];
      const jaConvidados = bid.convidados.map((c) => c.fornecedorId);

      // É AQUI que a família mostra o valor dela: o sistema sabe
      // quem convidar sem ninguém escolher fornecedor a fornecedor.
      const fornecedores = await banco.fornecedor.findMany({
        where: {
          ativo: true,
          familias: { some: { familiaId: { in: familias } } },
        },
        include: {
          familias: { include: { familia: { select: { id: true, codigo: true, nome: true } } } },
        },
        orderBy: { razaoSocial: 'asc' },
      });

      return {
        familiasDoPacote: familias.length,
        fornecedores: fornecedores.map((f) => ({
          id: f.id,
          razaoSocial: f.razaoSocial,
          nomeFantasia: f.nomeFantasia,
          cnpj: f.cnpj,
          whatsapp: f.whatsapp,
          email: f.email,
          familias: f.familias.map((x) => x.familia),
          // Quantas das famílias do pacote ele atende.
          cobertura: f.familias.filter((x) => familias.includes(x.familiaId)).length,
          jaConvidado: jaConvidados.includes(f.id),
        })),
      };
    },
  );

  // --------------------------------------------------------
  //  Convidar fornecedores
  // --------------------------------------------------------
  app.post(
    '/api/cotacoes/:id/fornecedores',
    { preHandler: app.exigirPermissao('cotacoes.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };
      const dados = z
        .object({ fornecedores: z.array(z.string().uuid()).min(1) })
        .safeParse(req.body);

      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const bid = await banco.bid.findUnique({ where: { id }, include: { convidados: true } });
      if (!bid) return res.status(404).send({ erro: 'Pacote não encontrado.' });

      if (!podeEditarBid(bid.situacao as SituacaoBid)) {
        return res.status(409).send({
          erro: 'Este pacote já foi aberto. Não é possível trocar os convidados.',
        });
      }

      const jaConvidados = bid.convidados.map((c) => c.fornecedorId);
      const novos = dados.data.fornecedores.filter((f) => !jaConvidados.includes(f));

      if (novos.length > 0) {
        await banco.bidFornecedor.createMany({
          data: novos.map((fornecedorId) => ({
            bidId: id,
            fornecedorId,
            token: gerarToken(),
            expiraEm: bid.prazoResposta,
          })),
        });
      }

      const atualizado = await banco.bid.findUniqueOrThrow({ where: { id }, include: INCLUIR });
      return { cotacao: formatar(atualizado), convidados: novos.length };
    },
  );

  app.delete(
    '/api/cotacoes/:id/fornecedores/:conviteId',
    { preHandler: app.exigirPermissao('cotacoes.gerenciar') },
    async (req, res) => {
      const { id, conviteId } = req.params as { id: string; conviteId: string };

      const bid = await banco.bid.findUnique({ where: { id } });
      if (!bid) return res.status(404).send({ erro: 'Pacote não encontrado.' });

      if (!podeEditarBid(bid.situacao as SituacaoBid)) {
        return res.status(409).send({ erro: 'Este pacote já foi aberto.' });
      }

      await banco.bidFornecedor.deleteMany({ where: { id: conviteId, bidId: id } });
      return { ok: true };
    },
  );

  // --------------------------------------------------------
  //  Abrir o pacote: dispara os convites
  // --------------------------------------------------------
  app.post(
    '/api/cotacoes/:id/abrir',
    { preHandler: app.exigirPermissao('cotacoes.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const bid = await banco.bid.findUnique({
        where: { id },
        include: {
          itens: true,
          convidados: { include: { fornecedor: true } },
        },
      });

      if (!bid) return res.status(404).send({ erro: 'Pacote não encontrado.' });

      if (!podeIrPara(bid.situacao as SituacaoBid, 'ABERTO')) {
        return res.status(409).send({
          erro: 'Este pacote não pode ser aberto agora.',
          situacaoAtual: bid.situacao,
        });
      }

      const problemas = conferirAbertura({
        quantidadeItens: bid.itens.length,
        quantidadeConvidados: bid.convidados.length,
        prazoResposta: bid.prazoResposta,
      });

      if (problemas.length > 0) {
        return res.status(400).send({
          erro: 'O pacote ainda não pode ser aberto.',
          detalhes: problemas,
        });
      }

      await banco.bid.update({
        where: { id },
        data: { situacao: 'ABERTO', abertoEm: new Date() },
      });

      // As solicitações de origem passam a mostrar "em cotação".
      const origem = await banco.bidItem.findMany({
        where: { bidId: id },
        select: { solicitacaoItem: { select: { solicitacaoId: true } } },
      });

      const solicitacoes = [...new Set(origem.map((o) => o.solicitacaoItem.solicitacaoId))];

      await banco.solicitacao.updateMany({
        where: { id: { in: solicitacoes }, situacao: 'APROVADA' },
        data: { situacao: 'EM_COTACAO' },
      });

      for (const solicitacaoId of solicitacoes) {
        await banco.solicitacaoEvento.create({
          data: {
            solicitacaoId,
            usuarioId: req.usuario!.id,
            tipo: 'EM_COTACAO',
            descricao:
              'Itens incluídos no pacote de cotação ' + formatarNumeroBid(bid.numero) + '.',
          },
        });
      }

      // ABRIR NÃO ENVIA. UM BOTÃO, UM TRABALHO.
      //
      // Este bloco mandava o convite sozinho, como efeito colateral
      // de abrir o pacote. Duas coisas erradas nisso:
      //
      //  1. Ninguém espera que "abrir" mande mensagem para fora da
      //     empresa. Foi assim que o envio passou anos pulando a
      //     trava da lista de autorizados sem ninguém notar — o
      //     furo achado em 29/09/2026.
      //  2. Quem abre ainda não conferiu quem vai receber. Convidar
      //     virou ato próprio, com o destinatário na tela antes.
      //
      // Os botões "Convidar pelo WhatsApp" e "Convidar por e-mail"
      // só aparecem depois que o pacote está aberto — o caminho já
      // existia na tela, estava era sendo atropelado.
      //
      // O link do portal NÃO nasce aqui: ele nasce quando o
      // fornecedor entra no pacote. Nada aqui mexe nele.

      const atualizado = await banco.bid.findUniqueOrThrow({ where: { id }, include: INCLUIR });

      return {
        cotacao: formatar(atualizado),
        mensagem:
          'Pacote aberto. Agora convide os fornecedores pelo WhatsApp ou por e-mail.',
      };
    },
  );

  // --------------------------------------------------------
  //  Encerrar
  // --------------------------------------------------------
  app.post(
    '/api/cotacoes/:id/encerrar',
    { preHandler: app.exigirPermissao('cotacoes.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const bid = await banco.bid.findUnique({ where: { id } });
      if (!bid) return res.status(404).send({ erro: 'Pacote não encontrado.' });

      if (!podeIrPara(bid.situacao as SituacaoBid, 'ENCERRADO')) {
        return res.status(409).send({
          erro: 'Este pacote não pode ser encerrado agora.',
          situacaoAtual: bid.situacao,
        });
      }

      await banco.bid.update({
        where: { id },
        data: { situacao: 'ENCERRADO', encerradoEm: new Date() },
      });

      return { ok: true, mensagem: 'Cotação encerrada. Siga para a equalização.' };
    },
  );
}
