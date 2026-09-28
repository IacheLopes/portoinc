// ============================================================
//  Solicitações de compra
//
//  Duas regras de visibilidade convivem aqui:
//   - quem tem "solicitacoes.ver_todas" enxerga tudo
//   - quem não tem enxerga APENAS o que abriu
//     (pedido literal da reunião: "cada usuário deve ver o que
//      ele solicitou")
// ============================================================

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { numero, erroDeValidacao, textoOpcional } from '../servicos/util.js';
import {
  podeEditar, podeIrPara, conferirParaEnvio, calcularTotalEstimado,
  acharFaixa, explicarAprovacao, resumoDaAlcada, formatarNumero,
  SITUACOES,
  type Situacao, type FaixaAlcada,
} from '../servicos/solicitacao.js';
import { gerarPdfSolicitacao } from '../servicos/pdf-solicitacao.js';
import { calcularEstado, type Decisao } from '../servicos/aprovacao.js';

const esquemaItem = z.object({
  materialId: z.string().uuid('Escolha um item do catálogo.'),
  quantidade: z.coerce.number().positive('A quantidade precisa ser maior que zero.'),
  linhaOrcamentoId: z.string().uuid().nullable().optional(),
  descricaoComplementar: textoOpcional(500),
  especificacaoTecnica: textoOpcional(2000),
  valorEstimado: z.coerce.number().min(0).nullable().optional(),
});

const esquemaSolicitacao = z.object({
  obraId: z.string().uuid('Escolha a obra.'),
  justificativa: textoOpcional(1000),
  observacoes: textoOpcional(1000),
  dataDesejada: z.string().date().optional(),
  itens: z.array(esquemaItem).default([]),
});

/**
 * Completa a linha de orçamento de quem não escolheu nenhuma.
 *
 * A tela de Nova solicitação já sugere a linha a partir do
 * `codigoLinhaPadrao` do material, mas a API aceitava o item sem
 * linha em silêncio — e compra sem linha apontada desaparece do
 * relatório de orçado × realizado. Aqui a API faz a mesma
 * sugestão, para que os dois caminhos gravem a mesma coisa.
 *
 * Continua sendo apenas sugestão: quem escolheu manda, e material
 * sem linha padrão segue sem apontamento (o relatório mostra
 * esses casos numa linha separada, em vez de escondê-los).
 */
async function completarLinhas(
  obraId: string,
  itens: Array<{ materialId: string; linhaOrcamentoId?: string | null }>,
  materiaisPorId: Map<string, { codigoLinhaPadrao: string | null }>,
): Promise<Map<string, string | null>> {
  const resolvido = new Map<string, string | null>();

  const faltando = itens.filter((i) => !i.linhaOrcamentoId);
  if (faltando.length === 0) return resolvido;

  const codigos = [
    ...new Set(
      faltando
        .map((i) => materiaisPorId.get(i.materialId)?.codigoLinhaPadrao)
        .filter((c): c is string => !!c),
    ),
  ];
  if (codigos.length === 0) return resolvido;

  const linhas = await banco.linhaOrcamento.findMany({
    where: { obraId, codigo: { in: codigos } },
    select: { id: true, codigo: true },
  });
  const porCodigo = new Map(linhas.map((l) => [l.codigo, l.id]));

  for (const item of faltando) {
    const padrao = materiaisPorId.get(item.materialId)?.codigoLinhaPadrao;
    if (padrao && porCodigo.has(padrao)) {
      resolvido.set(item.materialId, porCodigo.get(padrao)!);
    }
  }

  return resolvido;
}

const INCLUIR = {
  obra: { select: { id: true, codigo: true, nome: true, cliente: true } },
  solicitante: { select: { id: true, nome: true, email: true } },
  validadaPor: { select: { nome: true } },
  itens: {
    orderBy: { ordem: 'asc' },
    include: {
      material: {
        select: {
          id: true, codigoInterno: true, descricao: true, unidadeMedida: true,
          normaTecnica: true, tipo: true,
          familia: { select: { id: true, codigo: true, nome: true } },
        },
      },
      linhaOrcamento: { select: { id: true, codigo: true, descricao: true } },
    },
  },
  eventos: {
    orderBy: { criadoEm: 'desc' },
    include: { usuario: { select: { id: true, nome: true } } },
  },
  aprovacoes: {
    orderBy: { criadaEm: 'asc' },
    include: {
      usuario: { select: { id: true, nome: true } },
      funcao: { select: { id: true, codigo: true, nome: true } },
    },
  },
} as const;

type SolicitacaoCompleta = Awaited<
  ReturnType<typeof banco.solicitacao.findFirstOrThrow<{ include: typeof INCLUIR }>>
>;

function formatar(s: SolicitacaoCompleta) {
  const itens = s.itens.map((i) => ({
    id: i.id,
    ordem: i.ordem,
    material: i.material,
    linhaOrcamento: i.linhaOrcamento,
    quantidade: numero(i.quantidade) ?? 0,
    unidadeMedida: i.unidadeMedida,
    descricaoComplementar: i.descricaoComplementar,
    especificacaoTecnica: i.especificacaoTecnica,
    primeiraCompra: i.primeiraCompra,
    valorEstimado: numero(i.valorEstimado),
    valorTotal: (numero(i.quantidade) ?? 0) * (numero(i.valorEstimado) ?? 0),
  }));

  return {
    id: s.id,
    numero: s.numero,
    numeroFormatado: formatarNumero(s.numero),
    situacao: s.situacao,
    obra: s.obra,
    solicitante: s.solicitante,
    justificativa: s.justificativa,
    observacoes: s.observacoes,
    dataDesejada: s.dataDesejada,
    criadaEm: s.criadaEm,
    enviadaEm: s.enviadaEm,
    decididaEm: s.decididaEm,
    validadaEm: s.validadaEm,
    validadaPor: s.validadaPor?.nome ?? null,
    itens,
    totalEstimado: calcularTotalEstimado(itens),
    podeEditar: podeEditar(s.situacao as Situacao),
    exigeTodas: s.exigeTodas,
    funcoesExigidas: s.funcoesExigidas,
    estadoAprovacao: calcularEstado(
      s.funcoesExigidas,
      s.exigeTodas,
      s.aprovacoes.map((a) => ({
        funcaoCodigo: a.funcao.codigo,
        decisao: a.decisao as Decisao,
      })),
    ),
    aprovacoes: s.aprovacoes.map((a) => ({
      id: a.id,
      decisao: a.decisao,
      observacao: a.observacao,
      usuario: a.usuario.nome,
      funcao: a.funcao.nome,
      // O nome é para LER; o código é para COMPARAR. Só ia o nome, e
      // a tela comparava esse nome com a lista de funções exigidas,
      // que é de códigos — nunca batia. Efeito: quem tem duas das
      // funções exigidas (a conta DEV tem todas) era convidado a
      // assinar de novo com a função que já tinha assinado, e só
      // descobria no clique, com o servidor recusando.
      funcaoCodigo: a.funcao.codigo,
      criadaEm: a.criadaEm,
    })),
    eventos: s.eventos.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      descricao: e.descricao,
      usuario: e.usuario?.nome ?? 'Sistema',
      criadoEm: e.criadoEm,
    })),
  };
}

/** Carrega as faixas de alçada já no formato das regras. */
async function carregarFaixas(): Promise<FaixaAlcada[]> {
  const regras = await banco.regraAlcada.findMany({
    where: { ativa: true },
    include: { funcoes: { include: { funcao: true } } },
  });

  return regras.map((r) => ({
    id: r.id,
    descricao: r.descricao,
    valorMinimo: Number(r.valorMinimo),
    valorMaximo: r.valorMaximo === null ? null : Number(r.valorMaximo),
    exigeTodas: r.exigeTodas,
    funcoes: r.funcoes.map((f) => ({ codigo: f.funcao.codigo, nome: f.funcao.nome })),
  }));
}

/** Filtro que aplica a regra "cada um vê o que solicitou". */
function filtroDeVisibilidade(req: FastifyRequest) {
  return req.usuario!.permissoes.includes('solicitacoes.ver_todas')
    ? {}
    : { solicitanteId: req.usuario!.id };
}

async function registrarEvento(
  solicitacaoId: string,
  usuarioId: string | null,
  tipo: string,
  descricao: string,
) {
  await banco.solicitacaoEvento.create({
    data: { solicitacaoId, usuarioId, tipo, descricao },
  });
}

export async function rotasSolicitacoes(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Listar
  // --------------------------------------------------------
  app.get(
    '/api/solicitacoes',
    { preHandler: app.exigirPermissao('solicitacoes.criar', 'solicitacoes.ver_todas') },
    async (req, res) => {
      const { situacao, obraId, busca, apenasMinhas } = req.query as {
        situacao?: string;
        obraId?: string;
        busca?: string;
        apenasMinhas?: string;
      };

      // SITUAÇÃO QUE NÃO EXISTE É ERRO, NÃO É "SEM FILTRO".
      //
      // Antes, valor desconhecido era simplesmente ignorado: a tela
      // devolvia a lista inteira com a caixa dizendo "Atendida", e
      // quem olhava concluía que o filtro não funcionava — sem
      // jeito de saber por quê. Recusar deixa o defeito visível no
      // primeiro teste, em vez de escondê-lo por uma semana.
      if (situacao && !SITUACOES.includes(situacao as Situacao)) {
        return res.status(400).send({
          erro: 'Situação desconhecida: ' + situacao + '.',
          detalhes: ['As situações válidas são: ' + SITUACOES.join(', ') + '.'],
        });
      }

      const solicitacoes = await banco.solicitacao.findMany({
        where: {
          ...filtroDeVisibilidade(req),
          ...(apenasMinhas === 'true' ? { solicitanteId: req.usuario!.id } : {}),
          ...(situacao ? { situacao: situacao as never } : {}),
          ...(obraId ? { obraId } : {}),
          ...(busca
            ? {
                OR: [
                  { justificativa: { contains: busca, mode: 'insensitive' as const } },
                  { itens: { some: { material: { descricao: { contains: busca, mode: 'insensitive' as const } } } } },
                ],
              }
            : {}),
        },
        include: INCLUIR,
        orderBy: { numero: 'desc' },
        take: 200,
      });

      return {
        solicitacoes: solicitacoes.map(formatar),
        vendoTodas: req.usuario!.permissoes.includes('solicitacoes.ver_todas'),
      };
    },
  );

  // --------------------------------------------------------
  //  Uma solicitação
  // --------------------------------------------------------
  app.get(
    '/api/solicitacoes/:id',
    { preHandler: app.exigirPermissao('solicitacoes.criar', 'solicitacoes.ver_todas') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const solicitacao = await banco.solicitacao.findFirst({
        where: { id, ...filtroDeVisibilidade(req) },
        include: INCLUIR,
      });

      if (!solicitacao) {
        // Mesma resposta para "não existe" e "não é sua": não
        // entregamos a informação de que ela existe.
        return res.status(404).send({ erro: 'Solicitação não encontrada.' });
      }

      const faixas = await carregarFaixas();
      const dados = formatar(solicitacao);
      const faixa = acharFaixa(dados.totalEstimado, faixas);

      return {
        solicitacao: dados,
        aprovacao: resumoDaAlcada(faixa),
      };
    },
  );

  // --------------------------------------------------------
  //  Criar
  // --------------------------------------------------------
  app.post(
    '/api/solicitacoes',
    { preHandler: app.exigirPermissao('solicitacoes.criar') },
    async (req, res) => {
      const dados = esquemaSolicitacao.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const obra = await banco.obra.findUnique({ where: { id: dados.data.obraId } });
      if (!obra) return res.status(400).send({ erro: 'Obra não encontrada.' });
      if (!obra.ativa) {
        return res.status(400).send({ erro: 'Esta obra está inativa e não aceita solicitações.' });
      }

      const materiais = await banco.material.findMany({
        where: { id: { in: dados.data.itens.map((i) => i.materialId) } },
      });

      if (materiais.length !== new Set(dados.data.itens.map((i) => i.materialId)).size) {
        return res.status(400).send({ erro: 'Um dos itens escolhidos não existe no catálogo.' });
      }

      const porId = new Map(materiais.map((m) => [m.id, m]));

      // Descobre quais itens nunca foram comprados antes.
      const jaPedidos = await banco.solicitacaoItem.findMany({
        where: {
          materialId: { in: materiais.map((m) => m.id) },
          solicitacao: { situacao: { not: 'CANCELADA' } },
        },
        select: { materialId: true },
        distinct: ['materialId'],
      });
      const conhecidos = new Set(jaPedidos.map((i) => i.materialId));
      const linhaSugerida = await completarLinhas(dados.data.obraId, dados.data.itens, porId);

      const solicitacao = await banco.solicitacao.create({
        data: {
          obraId: dados.data.obraId,
          solicitanteId: req.usuario!.id,
          justificativa: dados.data.justificativa,
          observacoes: dados.data.observacoes,
          dataDesejada: dados.data.dataDesejada ? new Date(dados.data.dataDesejada) : null,
          itens: {
            create: dados.data.itens.map((item, indice) => ({
              materialId: item.materialId,
              linhaOrcamentoId:
                item.linhaOrcamentoId ?? linhaSugerida.get(item.materialId) ?? null,
              quantidade: item.quantidade,
              // A unidade é copiada agora: se o cadastro mudar
              // depois, o histórico continua verdadeiro.
              unidadeMedida: porId.get(item.materialId)!.unidadeMedida,
              descricaoComplementar: item.descricaoComplementar,
              especificacaoTecnica: item.especificacaoTecnica,
              primeiraCompra: !conhecidos.has(item.materialId),
              valorEstimado: item.valorEstimado ?? null,
              ordem: indice + 1,
            })),
          },
        },
        include: INCLUIR,
      });

      await registrarEvento(
        solicitacao.id,
        req.usuario!.id,
        'CRIADA',
        'Solicitação aberta como rascunho.',
      );

      const completa = await banco.solicitacao.findUniqueOrThrow({
        where: { id: solicitacao.id },
        include: INCLUIR,
      });

      return res.status(201).send({ solicitacao: formatar(completa) });
    },
  );

  // --------------------------------------------------------
  //  Editar (só rascunho ou em revisão)
  // --------------------------------------------------------
  app.patch(
    '/api/solicitacoes/:id',
    { preHandler: app.exigirPermissao('solicitacoes.criar') },
    async (req, res) => {
      const { id } = req.params as { id: string };
      const dados = esquemaSolicitacao.partial().safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const atual = await banco.solicitacao.findFirst({
        where: { id, solicitanteId: req.usuario!.id },
      });

      if (!atual) return res.status(404).send({ erro: 'Solicitação não encontrada.' });

      if (!podeEditar(atual.situacao as Situacao)) {
        return res.status(409).send({
          erro: 'Esta solicitação não pode mais ser alterada.',
          motivo: 'Ela está como "' + atual.situacao + '". Só rascunho e em revisão aceitam mudança.',
        });
      }

      const atualizada = await banco.solicitacao.update({
        where: { id },
        data: {
          justificativa: dados.data.justificativa,
          observacoes: dados.data.observacoes,
          dataDesejada: dados.data.dataDesejada ? new Date(dados.data.dataDesejada) : undefined,
          ...(dados.data.obraId ? { obraId: dados.data.obraId } : {}),
        },
        include: INCLUIR,
      });

      return { solicitacao: formatar(atualizada) };
    },
  );

  // --------------------------------------------------------
  //  Trocar os itens de uma vez
  // --------------------------------------------------------
  app.post(
    '/api/solicitacoes/:id/itens',
    { preHandler: app.exigirPermissao('solicitacoes.criar') },
    async (req, res) => {
      const { id } = req.params as { id: string };
      const dados = z.object({ itens: z.array(esquemaItem) }).safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const atual = await banco.solicitacao.findFirst({
        where: { id, solicitanteId: req.usuario!.id },
      });

      if (!atual) return res.status(404).send({ erro: 'Solicitação não encontrada.' });

      if (!podeEditar(atual.situacao as Situacao)) {
        return res.status(409).send({ erro: 'Esta solicitação não pode mais ser alterada.' });
      }

      const materiais = await banco.material.findMany({
        where: { id: { in: dados.data.itens.map((i) => i.materialId) } },
      });
      const porId = new Map(materiais.map((m) => [m.id, m]));

      if (porId.size !== new Set(dados.data.itens.map((i) => i.materialId)).size) {
        return res.status(400).send({ erro: 'Um dos itens escolhidos não existe no catálogo.' });
      }

      const jaPedidos = await banco.solicitacaoItem.findMany({
        where: {
          materialId: { in: materiais.map((m) => m.id) },
          solicitacaoId: { not: id },
          solicitacao: { situacao: { not: 'CANCELADA' } },
        },
        select: { materialId: true },
        distinct: ['materialId'],
      });
      const conhecidos = new Set(jaPedidos.map((i) => i.materialId));
      const linhaSugerida = await completarLinhas(atual.obraId, dados.data.itens, porId);

      await banco.$transaction([
        banco.solicitacaoItem.deleteMany({ where: { solicitacaoId: id } }),
        banco.solicitacaoItem.createMany({
          data: dados.data.itens.map((item, indice) => ({
            solicitacaoId: id,
            materialId: item.materialId,
            linhaOrcamentoId:
              item.linhaOrcamentoId ?? linhaSugerida.get(item.materialId) ?? null,
            quantidade: item.quantidade,
            unidadeMedida: porId.get(item.materialId)!.unidadeMedida,
            descricaoComplementar: item.descricaoComplementar,
            especificacaoTecnica: item.especificacaoTecnica,
            primeiraCompra: !conhecidos.has(item.materialId),
            valorEstimado: item.valorEstimado ?? null,
            ordem: indice + 1,
          })),
        }),
      ]);

      const completa = await banco.solicitacao.findUniqueOrThrow({
        where: { id },
        include: INCLUIR,
      });

      return { solicitacao: formatar(completa) };
    },
  );

  // --------------------------------------------------------
  //  Enviar para aprovação
  // --------------------------------------------------------
  app.post(
    '/api/solicitacoes/:id/enviar',
    { preHandler: app.exigirPermissao('solicitacoes.criar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const atual = await banco.solicitacao.findFirst({
        where: { id, solicitanteId: req.usuario!.id },
        include: INCLUIR,
      });

      if (!atual) return res.status(404).send({ erro: 'Solicitação não encontrada.' });

      if (!podeIrPara(atual.situacao as Situacao, 'AGUARDANDO_APROVACAO')) {
        return res.status(409).send({
          erro: 'Esta solicitação não pode ser enviada agora.',
          situacaoAtual: atual.situacao,
        });
      }

      const impedimentos = conferirParaEnvio(
        atual.itens.map((i) => ({
          quantidade: Number(i.quantidade),
          primeiraCompra: i.primeiraCompra,
          especificacaoTecnica: i.especificacaoTecnica,
          descricao: i.material.descricao,
        })),
      );

      if (impedimentos.length > 0) {
        return res.status(400).send({
          erro: 'A solicitação ainda não pode ser enviada.',
          detalhes: impedimentos,
        });
      }

      const dados = formatar(atual);
      const faixa = acharFaixa(dados.totalEstimado, await carregarFaixas());

      if (!faixa) {
        return res.status(400).send({
          erro: 'Nenhuma faixa de alçada cobre R$ ' + dados.totalEstimado.toFixed(2) + '.',
          detalhes: [
            'Sem faixa não há quem aprove. Peça ao administrador para ajustar ' +
            'os limites em Cadastros > Limites de alçada.',
          ],
        });
      }

      // Se está voltando de uma revisão, as assinaturas antigas
      // não valem: elas foram dadas sobre outro conteúdo.
      await banco.aprovacao.deleteMany({ where: { solicitacaoId: id } });

      await banco.solicitacao.update({
        where: { id },
        data: {
          situacao: 'AGUARDANDO_APROVACAO',
          enviadaEm: new Date(),
          decididaEm: null,
          // Fotografia da alçada: se a empresa mudar as faixas
          // depois, o que já está em aprovação segue a regra antiga.
          regraAlcadaId: faixa.id,
          exigeTodas: faixa.exigeTodas,
          funcoesExigidas: faixa.funcoes.map((f) => f.codigo),
          valorNoEnvio: dados.totalEstimado,
        },
      });

      await registrarEvento(
        id,
        req.usuario!.id,
        'ENVIADA',
        'Enviada para aprovação. ' + explicarAprovacao(faixa),
      );

      const completa = await banco.solicitacao.findUniqueOrThrow({
        where: { id },
        include: INCLUIR,
      });

      return {
        solicitacao: formatar(completa),
        aprovacao: resumoDaAlcada(faixa),
      };
    },
  );

  // --------------------------------------------------------
  //  Cancelar
  // --------------------------------------------------------
  app.post(
    '/api/solicitacoes/:id/cancelar',
    { preHandler: app.exigirPermissao('solicitacoes.criar') },
    async (req, res) => {
      const { id } = req.params as { id: string };
      const corpo = z.object({ motivo: textoOpcional(500) }).safeParse(req.body ?? {});

      const atual = await banco.solicitacao.findFirst({
        where: { id, solicitanteId: req.usuario!.id },
      });

      if (!atual) return res.status(404).send({ erro: 'Solicitação não encontrada.' });

      if (!podeIrPara(atual.situacao as Situacao, 'CANCELADA')) {
        return res.status(409).send({
          erro: 'Esta solicitação não pode mais ser cancelada.',
          situacaoAtual: atual.situacao,
        });
      }

      await banco.solicitacao.update({ where: { id }, data: { situacao: 'CANCELADA' } });

      const motivo = corpo.success ? corpo.data.motivo : undefined;
      await registrarEvento(
        id,
        req.usuario!.id,
        'CANCELADA',
        motivo ? 'Cancelada: ' + motivo : 'Cancelada pelo solicitante.',
      );

      return { ok: true };
    },
  );

  // --------------------------------------------------------
  //  PDF
  // --------------------------------------------------------
  app.get(
    '/api/solicitacoes/:id/pdf',
    { preHandler: app.exigirPermissao('solicitacoes.criar', 'solicitacoes.ver_todas') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const solicitacao = await banco.solicitacao.findFirst({
        where: { id, ...filtroDeVisibilidade(req) },
        include: INCLUIR,
      });

      if (!solicitacao) return res.status(404).send({ erro: 'Solicitação não encontrada.' });

      const dados = formatar(solicitacao);

      const pdf = await gerarPdfSolicitacao({
        numero: dados.numero,
        situacao: dados.situacao as Situacao,
        criadaEm: dados.criadaEm,
        enviadaEm: dados.enviadaEm,
        dataDesejada: dados.dataDesejada,
        justificativa: dados.justificativa,
        observacoes: dados.observacoes,
        solicitante: dados.solicitante,
        obra: dados.obra,
        totalEstimado: dados.totalEstimado,
        itens: dados.itens.map((i) => ({
          ordem: i.ordem,
          codigoInterno: i.material.codigoInterno,
          descricao: i.material.descricao,
          unidadeMedida: i.unidadeMedida,
          quantidade: i.quantidade,
          descricaoComplementar: i.descricaoComplementar,
          especificacaoTecnica: i.especificacaoTecnica,
          primeiraCompra: i.primeiraCompra,
          normaTecnica: i.material.normaTecnica,
          linhaOrcamento: i.linhaOrcamento
            ? i.linhaOrcamento.codigo + ' ' + i.linhaOrcamento.descricao
            : null,
          valorEstimado: i.valorEstimado,
        })),
      });

      return res
        .header('Content-Type', 'application/pdf')
        .header(
          'Content-Disposition',
          'attachment; filename="' + dados.numeroFormatado + '.pdf"',
        )
        .send(pdf);
    },
  );

  // --------------------------------------------------------
  //  Validar: "é isto que eu pedi"
  //
  //  O passo 10 do BPMN da Porto Inc. O almoxarife confere se
  //  chegou a quantidade certa; quem pediu é que sabe se chegou a
  //  COISA certa — a marca, a bitola, a resistência. São duas
  //  conferências diferentes, e o documento pede as duas.
  //
  //  Não trava nada: o material já está no estoque e a nota já
  //  virou conta a pagar. Serve de registro — e é o registro que
  //  responde, três meses depois, "mas alguém conferiu isso?".
  // --------------------------------------------------------
  app.post(
    '/api/solicitacoes/:id/validar',
    { preHandler: app.exigirPermissao('solicitacoes.criar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const dados = z
        .object({ observacao: textoOpcional(500) })
        .safeParse(req.body ?? {});

      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const atual = await banco.solicitacao.findUnique({
        where: { id },
        select: { id: true, situacao: true, solicitanteId: true, validadaEm: true },
      });

      if (!atual) return res.status(404).send({ erro: 'Solicitação não encontrada.' });

      if (atual.situacao !== 'ATENDIDA') {
        return res.status(409).send({
          erro: 'Só dá para validar depois que o material chega por inteiro.',
          situacaoAtual: atual.situacao,
        });
      }

      if (atual.validadaEm) {
        return res.status(409).send({ erro: 'Esta solicitação já foi validada.' });
      }

      // Quem pediu é que valida. Quem supervisiona também pode —
      // solicitante de férias não pode travar o registro.
      const ehDono = atual.solicitanteId === req.usuario!.id;
      const supervisiona = req.usuario!.permissoes.includes('solicitacoes.supervisionar');

      if (!ehDono && !supervisiona) {
        return res.status(403).send({
          erro: 'Só quem abriu a solicitação pode dizer se é o que pediu.',
        });
      }

      await banco.solicitacao.update({
        where: { id },
        data: { validadaEm: new Date(), validadaPorId: req.usuario!.id },
      });

      await registrarEvento(
        id,
        req.usuario!.id,
        'VALIDADA',
        'Conferiu e confirmou que é o material que pediu.' +
          (dados.data.observacao ? ' ' + dados.data.observacao : ''),
      );

      const completa = await banco.solicitacao.findUniqueOrThrow({
        where: { id },
        include: INCLUIR,
      });

      return { ok: true, solicitacao: formatar(completa) };
    },
  );
}
