// ============================================================
//  Aprovação de solicitações
//
//  GET  /api/aprovacoes            -> fila do que espera VOCÊ
//  POST /api/aprovacoes/:id/decidir -> aprovar, reprovar ou devolver
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { erroDeValidacao, textoOpcional, numero } from '../servicos/util.js';
import { formatarNumero, calcularTotalEstimado } from '../servicos/solicitacao.js';
import {
  calcularEstado, podeDecidir, proximaSituacao, descreverDecisao,
  type Decisao, type AssinaturaRegistrada,
} from '../servicos/aprovacao.js';

const esquemaDecisao = z.object({
  decisao: z.enum(['APROVADA', 'REPROVADA', 'DEVOLVIDA']),
  observacao: textoOpcional(1000),
  /// Quando a pessoa acumula duas funções exigidas, ela escolhe
  /// com qual está assinando agora.
  funcaoCodigo: z.string().optional(),
});

const INCLUIR_APROVACOES = {
  include: {
    usuario: { select: { id: true, nome: true } },
    funcao: { select: { id: true, codigo: true, nome: true } },
  },
  orderBy: { criadaEm: 'asc' },
} as const;

/** Lê as assinaturas no formato que as regras esperam. */
function comoAssinaturas(
  aprovacoes: Array<{ funcao: { codigo: string }; decisao: string }>,
): AssinaturaRegistrada[] {
  return aprovacoes.map((a) => ({
    funcaoCodigo: a.funcao.codigo,
    decisao: a.decisao as Decisao,
  }));
}

export async function rotasAprovacoes(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Fila: o que espera a MINHA assinatura
  // --------------------------------------------------------
  app.get(
    '/api/aprovacoes',
    { preHandler: app.exigirPermissao('solicitacoes.aprovar') },
    async (req) => {
      const minhasFuncoes = req.usuario!.funcoes;

      // ----------------------------------------------------
      //  Quem dá suporte precisa ENXERGAR o que não assina
      //
      //  Aprovar é autoridade: depende de estar numa faixa de
      //  alçada. Mas o administrador é o porta-voz do suporte —
      //  quando alguém relata "minha solicitação sumiu", ele tem
      //  de conseguir OLHAR a fila e conferir.
      //
      //  São coisas diferentes e o sistema passa a tratá-las
      //  assim: `solicitacoes.ver_todas` abre a fila inteira; a
      //  assinatura continua valendo só para quem está na faixa,
      //  e cada linha diz de quem ela é.
      // ----------------------------------------------------
      const enxergaTudo = req.usuario!.permissoes.includes('solicitacoes.supervisionar');

      const candidatas = await banco.solicitacao.findMany({
        where: {
          situacao: 'AGUARDANDO_APROVACAO',
          // O Postgres consegue filtrar direto pelo array.
          ...(enxergaTudo ? {} : { funcoesExigidas: { hasSome: minhasFuncoes } }),
        },
        include: {
          obra: { select: { id: true, codigo: true, nome: true } },
          solicitante: { select: { id: true, nome: true } },
          itens: { select: { quantidade: true, valorEstimado: true } },
          aprovacoes: INCLUIR_APROVACOES,
        },
        orderBy: [{ dataDesejada: 'asc' }, { enviadaEm: 'asc' }],
        take: 200,
      });

      const fila = candidatas
        .map((s) => {
          const estado = calcularEstado(
            s.funcoesExigidas,
            s.exigeTodas,
            comoAssinaturas(s.aprovacoes),
          );

          const jaAssinou = s.aprovacoes
            .filter((a) => a.usuarioId === req.usuario!.id)
            .map((a) => a.funcao.codigo);

          const permissao = podeDecidir({
            situacao: s.situacao,
            funcoesDoUsuario: minhasFuncoes,
            funcoesExigidas: s.funcoesExigidas,
            jaAssinou,
            ehOAutor: s.solicitanteId === req.usuario!.id,
          });

          return {
            id: s.id,
            numeroFormatado: formatarNumero(s.numero),
            obra: s.obra,
            solicitante: s.solicitante,
            justificativa: s.justificativa,
            dataDesejada: s.dataDesejada,
            enviadaEm: s.enviadaEm,
            quantidadeItens: s.itens.length,
            totalEstimado: calcularTotalEstimado(
              s.itens.map((i) => ({
                quantidade: numero(i.quantidade) ?? 0,
                valorEstimado: numero(i.valorEstimado),
              })),
            ),
            exigeTodas: s.exigeTodas,
            funcoesExigidas: s.funcoesExigidas,
            estado,
            souOAutor: s.solicitanteId === req.usuario!.id,
            esperaMinhaAssinatura: permissao.pode,
            motivoBloqueio: permissao.pode ? null : permissao.motivo,
          };
        })
        // Quem já assinou, ou é autor, some da fila: ela mostra
        // apenas o que realmente depende de você agora.
        //
        // Menos para quem enxerga tudo: ali a fila é a fila do
        // SISTEMA, e cada linha carrega `esperaMinhaAssinatura` e
        // `motivoBloqueio` para a tela dizer de quem é.
        .filter((s) => enxergaTudo || s.esperaMinhaAssinatura);

      // ----------------------------------------------------
      //  Por que a fila está vazia
      //
      //  "Nada esperando por você" é verdade para o gestor que
      //  está em dia. Para o ADMINISTRADOR é enganoso: ele nunca
      //  vai ver nada aqui, porque o papel dele não assina faixa
      //  nenhuma — e a tela dava a entender que o sistema estava
      //  vazio. Foi assim que o dono do sistema tropeçou nisto em
      //  24/09/2026, e é o tipo de coisa que estraga uma
      //  demonstração.
      //
      //  Estes dois números deixam a tela dizer QUAL é o caso.
      // ----------------------------------------------------
      // `minhasFuncoes` guarda o CÓDIGO da função (GESTOR_OBRA), e não
      // o nome ("Gestor de obra"). A comparação é por código; o nome
      // serve só para a tela escrever a frase.
      const faixas = await banco.regraAlcada.findMany({
        where: { ativa: true },
        select: {
          funcoes: { select: { funcao: { select: { codigo: true, nome: true } } } },
        },
      });

      const papeisQueAssinam = [
        ...new Set(faixas.flatMap((f) => f.funcoes.map((x) => x.funcao.nome))),
      ];

      const esperandoOutros = await banco.solicitacao.count({
        where: { situacao: 'AGUARDANDO_APROVACAO' },
      });

      return {
        fila,
        minhasFuncoes,
        /** Esta fila é a do sistema inteiro, e não só a sua? */
        enxergaTudo,
        /** Dentro da fila, quantas dependem de você agora. */
        minhasDeVerdade: fila.filter((s) => s.esperaMinhaAssinatura).length,
        /** Você é signatário de alguma faixa de alçada? */
        assinaAlgumaFaixa: minhasFuncoes.some(
          (codigo) => faixas.some((r) => r.funcoes.some((x) => x.funcao.codigo === codigo)),
        ),
        /** Quantas esperam aprovação no sistema inteiro, suas ou não. */
        esperandoOutros,
        /** Quem assina, para a tela poder dizer a quem pertence a fila. */
        papeisQueAssinam,
      };
    },
  );

  // --------------------------------------------------------
  //  Decidir
  // --------------------------------------------------------
  app.post(
    '/api/aprovacoes/:id/decidir',
    { preHandler: app.exigirPermissao('solicitacoes.aprovar') },
    async (req, res) => {
      const { id } = req.params as { id: string };
      const dados = esquemaDecisao.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const solicitacao = await banco.solicitacao.findUnique({
        where: { id },
        include: { aprovacoes: INCLUIR_APROVACOES },
      });

      if (!solicitacao) return res.status(404).send({ erro: 'Solicitação não encontrada.' });

      const jaAssinou = solicitacao.aprovacoes
        .filter((a) => a.usuarioId === req.usuario!.id)
        .map((a) => a.funcao.codigo);

      const permissao = podeDecidir({
        situacao: solicitacao.situacao,
        funcoesDoUsuario: req.usuario!.funcoes,
        funcoesExigidas: solicitacao.funcoesExigidas,
        jaAssinou,
        ehOAutor: solicitacao.solicitanteId === req.usuario!.id,
      });

      if (!permissao.pode) {
        return res.status(403).send({ erro: permissao.motivo });
      }

      // Devolver sem dizer o motivo deixaria o solicitante sem
      // saber o que corrigir.
      if (dados.data.decisao === 'DEVOLVIDA' && !dados.data.observacao) {
        return res.status(400).send({
          erro: 'Explique o que precisa ser corrigido.',
          detalhes: ['A observação é obrigatória ao devolver uma solicitação.'],
        });
      }

      // Com qual função a pessoa está assinando agora.
      const escolhida = dados.data.funcaoCodigo ?? permissao.funcoesDisponiveis[0];

      if (!permissao.funcoesDisponiveis.includes(escolhida)) {
        return res.status(400).send({
          erro: 'Você não pode assinar com a função ' + escolhida + '.',
          funcoesDisponiveis: permissao.funcoesDisponiveis,
        });
      }

      const funcao = await banco.funcao.findUnique({ where: { codigo: escolhida } });
      if (!funcao) return res.status(400).send({ erro: 'Função não encontrada.' });

      // Registra a assinatura.
      await banco.aprovacao.create({
        data: {
          solicitacaoId: id,
          usuarioId: req.usuario!.id,
          funcaoId: funcao.id,
          decisao: dados.data.decisao,
          observacao: dados.data.observacao,
        },
      });

      const depois = await banco.aprovacao.findMany({
        where: { solicitacaoId: id },
        ...INCLUIR_APROVACOES,
      });

      const estado = calcularEstado(
        solicitacao.funcoesExigidas,
        solicitacao.exigeTodas,
        comoAssinaturas(depois),
      );

      const situacao = proximaSituacao(dados.data.decisao as Decisao, estado);
      const decidiu = situacao === 'APROVADA' || situacao === 'REPROVADA';

      await banco.solicitacao.update({
        where: { id },
        data: { situacao, decididaEm: decidiu ? new Date() : null },
      });

      // Devolver limpa as assinaturas: a solicitação vai mudar, e
      // ninguém pode ficar preso a uma aprovação dada sobre outro
      // conteúdo.
      if (dados.data.decisao === 'DEVOLVIDA') {
        await banco.aprovacao.deleteMany({
          where: { solicitacaoId: id, decisao: 'APROVADA' },
        });
      }

      await banco.solicitacaoEvento.create({
        data: {
          solicitacaoId: id,
          usuarioId: req.usuario!.id,
          tipo: dados.data.decisao,
          descricao: descreverDecisao(
            dados.data.decisao as Decisao,
            funcao.nome,
            dados.data.observacao,
            estado,
          ),
        },
      });

      return {
        ok: true,
        situacao,
        estado,
        mensagem:
          situacao === 'APROVADA'
            ? 'Solicitação aprovada e liberada para cotação.'
            : situacao === 'REPROVADA'
              ? 'Solicitação reprovada.'
              : situacao === 'EM_REVISAO'
                ? 'Devolvida ao solicitante para correção.'
                : 'Sua assinatura foi registrada. ' + estado.resumo,
      };
    },
  );
}
