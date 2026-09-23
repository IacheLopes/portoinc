// ============================================================
//  A tela inicial
//
//  GET /api/inicio -> o que precisa de você agora
//
//  Uma chamada só, e não seis. A tela inicial é a primeira coisa
//  que abre de manhã; se ela disparasse uma chamada por módulo, o
//  login de cinco pessoas ao mesmo tempo já seria o pico do dia
//  num servidor de um núcleo.
//
//  Quem decide o que cada número significa é `servicos/inicio.ts`.
//  Aqui só se conta.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { banco } from '../plugins/banco.js';
import { numero } from '../servicos/util.js';
import { diasAte } from '../servicos/fiscal.js';
import { precisaComprar } from '../servicos/estoque.js';
import { podeDecidir } from '../servicos/aprovacao.js';
import {
  montarInicio, CONTAGENS_ZERADAS, type ContagensDoInicio,
} from '../servicos/inicio.js';

/**
 * As situações em que uma solicitação ainda anda.
 *
 * Reprovada e cancelada saem: elas acabaram. Quem abre a tela quer
 * saber o que ainda depende de alguém.
 */
const ANDANDO = ['RASCUNHO', 'AGUARDANDO_APROVACAO', 'EM_REVISAO', 'APROVADA', 'EM_COTACAO'] as const;

/** Pedido emitido que ainda espera o material chegar. */
const ESPERANDO_ENTREGA = ['ENVIADO', 'CONFIRMADO', 'RECEBIDO_PARCIAL'] as const;

export async function rotasInicio(app: FastifyInstance) {
  app.get(
    '/api/inicio',
    // Sem permissão específica: toda pessoa logada tem uma tela
    // inicial. O que ela VÊ nela é filtrado cartão a cartão.
    { preHandler: app.exigirLogin },
    async (req) => {
      const eu = req.usuario!;
      const pode = (codigo: string) => eu.permissoes.includes(codigo);
      const hoje = new Date();

      const contagens: ContagensDoInicio = { ...CONTAGENS_ZERADAS };

      // Cada bloco só corre se a pessoa puder ver o resultado.
      // Contar o que ela não vai enxergar é trabalho jogado fora —
      // e o banco divide um núcleo com todo o resto.

      // ----- Aprovações esperando a MINHA assinatura -----
      //
      // Não dá para contar no banco: "espera você" depende das
      // regras de alçada, de quem já assinou e de quem é o autor.
      // A mesma função que monta a fila decide aqui, senão a tela
      // inicial e a fila diriam números diferentes.
      if (pode('solicitacoes.aprovar')) {
        const candidatas = await banco.solicitacao.findMany({
          where: {
            situacao: 'AGUARDANDO_APROVACAO',
            funcoesExigidas: { hasSome: eu.funcoes },
          },
          select: {
            solicitanteId: true,
            situacao: true,
            funcoesExigidas: true,
            aprovacoes: {
              select: {
                usuarioId: true,
                funcao: { select: { codigo: true } },
              },
            },
          },
          take: 500,
        });

        contagens.aprovacoesEsperando = candidatas.filter((s) => podeDecidir({
          situacao: s.situacao,
          funcoesDoUsuario: eu.funcoes,
          funcoesExigidas: s.funcoesExigidas,
          jaAssinou: s.aprovacoes
            .filter((a) => a.usuarioId === eu.id)
            .map((a) => a.funcao.codigo),
          ehOAutor: s.solicitanteId === eu.id,
        }).pode).length;
      }

      // ----- Minhas solicitações ainda andando -----
      if (pode('solicitacoes.criar')) {
        contagens.minhasSolicitacoesAndando = await banco.solicitacao.count({
          where: { solicitanteId: eu.id, situacao: { in: [...ANDANDO] } },
        });
      }

      // ----- Cotações abertas -----
      if (pode('cotacoes.gerenciar')) {
        contagens.cotacoesAbertas = await banco.bid.count({ where: { situacao: 'ABERTO' } });
      }

      // ----- Pedidos emitidos e não enviados -----
      if (pode('pedidos.gerenciar')) {
        contagens.pedidosRascunho = await banco.pedido.count({ where: { situacao: 'RASCUNHO' } });
      }

      // ----- Pedidos esperando entrega -----
      if (pode('recebimento.registrar')) {
        contagens.pedidosAguardandoEntrega = await banco.pedido.count({
          where: { situacao: { in: [...ESPERANDO_ENTREGA] } },
        });
      }

      // ----- Material no ponto de repor -----
      //
      // Só os materiais que TÊM ponto de pedido entram na consulta:
      // sem ele não há mínimo para comparar, e são a maioria do
      // catálogo. A decisão de "está no vermelho" é a mesma função
      // que a tela de estoque usa.
      if (pode('estoque.ver')) {
        const saldos = await banco.saldoEstoque.findMany({
          where: { material: { pontoPedido: { not: null } } },
          select: {
            quantidade: true,
            material: { select: { pontoPedido: true } },
          },
        });

        contagens.materiaisAbaixoDoMinimo = saldos.filter((s) => precisaComprar({
          materialId: '', codigo: '', descricao: '', unidadeMedida: '', custoMedio: null,
          quantidade: numero(s.quantidade) ?? 0,
          pontoPedido: numero(s.material.pontoPedido),
        })).length;
      }

      // ----- Contas vencidas e vencendo -----
      //
      // `diasAte` é a mesma conta do painel financeiro, e ela ignora
      // a hora — senão uma parcela de hoje de manhã apareceria como
      // vencida à tarde.
      if (pode('financeiro.ver')) {
        const abertas = await banco.contaPagar.findMany({
          where: { situacao: 'ABERTA' },
          select: { vencimento: true },
        });

        for (const c of abertas) {
          const dias = diasAte(c.vencimento, hoje);
          if (dias < 0) contagens.contasVencidas += 1;
          else if (dias <= 7) contagens.contasVencendoEm7Dias += 1;
        }
      }

      // ----- Equipamento que passou da devolução -----
      if (pode('locacao.ver')) {
        contagens.locacoesAtrasadas = await banco.contratoLocacao.count({
          where: { situacao: 'ATIVA', previsaoDevolucao: { lt: hoje } },
        });
      }

      return montarInicio(contagens, eu.permissoes);
    },
  );
}
