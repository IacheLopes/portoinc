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
import { inicioDoDiaBr, inicioDoDiaBrMais } from '../servicos/fiscal.js';
import { TOLERANCIA } from '../servicos/estoque.js';
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

/**
 * Quantos saldos estão no ponto de repor — contados NO BANCO.
 *
 * Antes isto trazia todo saldo de material que tem ponto de pedido
 * e filtrava aqui com `precisaComprar`. O número saía certo; o que
 * não dava era carregar a tabela inteira a cada abertura da tela
 * inicial, que é a primeira coisa que abre de manhã.
 *
 * Em SQL cru porque a comparação é entre DUAS COLUNAS — o saldo e o
 * ponto de pedido do material —, e o Prisma não compara coluna com
 * coluna.
 *
 * E AQUI MORA O RISCO DESTA FUNÇÃO: a regra de `precisaComprar`
 * passa a existir em dois lugares, um em TypeScript e outro em SQL.
 * A folga do ponto flutuante é a mesma constante, passada como
 * parâmetro, para pelo menos o NÚMERO não divergir. O resto é
 * cobrado por teste: `estoque.test.ts` roda os dois caminhos sobre
 * os mesmos dados e exige o mesmo resultado.
 *
 * Conta SALDOS, não materiais — igualzinho ao que fazia antes. O
 * mesmo material em dois almoxarifados, ambos no vermelho, conta
 * duas vezes. Deixei como estava de propósito: mudar isso é mudar
 * o que o cartão significa, e não é o que esta etapa se propôs.
 */
async function contarNoPontoDeRepor(): Promise<number> {
  const [linha] = await banco.$queryRaw<Array<{ quantos: bigint }>>`
    SELECT COUNT(*) AS quantos
      FROM saldos_estoque s
      JOIN materiais m ON m.id = s.material_id
     WHERE m.ponto_pedido IS NOT NULL
       AND m.ponto_pedido > 0
       AND s.quantidade <= m.ponto_pedido + ${TOLERANCIA}::numeric
  `;

  return Number(linha?.quantos ?? 0);
}

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
      // Esta é a única contagem da tela que NÃO vai para o banco, e
      // é de propósito.
      //
      // "Espera você" depende das regras de alçada: qual faixa o
      // valor pegou, quais funções ela exige, quem já assinou e
      // quem é o autor. Essa regra está escrita UMA vez, em
      // `podeDecidir`, e a fila de Aprovações usa a mesma — senão a
      // tela inicial e a fila diriam números diferentes sobre a
      // mesma compra. Reescrevê-la em SQL criaria uma segunda
      // cópia, em outra linguagem, e no dia em que uma faixa
      // mudasse alguém atualizaria uma e esqueceria a outra.
      //
      // O QUE MUDOU AQUI: havia um `take: 500`.
      //
      // Acima de 500 na fila, o cartão contava 500 e mostrava o
      // resultado como se fossem todas — um número MENOR que o
      // certo, sem nada em tela avisando. Mesma doença das listas
      // que paravam em 200 e diziam que era tudo.
      //
      // Agora vem tudo, e vem menos: "não sou o autor" é regra de
      // segurança (ninguém aprova o próprio pedido), não de alçada,
      // então ela desce para o banco em vez de ser filtrada aqui.
      //
      // Sem teto, a fila inteira entra na memória para ser contada.
      // Cada linha são quatro campos pequenos; a conta só pesa com
      // dezenas de milhares de compras paradas esperando
      // assinatura, e aí o problema não é o sistema. SE um dia a
      // fila passar de algumas centenas com frequência, ou o Início
      // demorar a abrir, o caminho é guardar "quem falta assinar"
      // como coluna, atualizada a cada assinatura — resolve de vez,
      // e em troca toda decisão passa a ter o dever de mantê-la.
      if (pode('solicitacoes.aprovar')) {
        const candidatas = await banco.solicitacao.findMany({
          where: {
            situacao: 'AGUARDANDO_APROVACAO',
            funcoesExigidas: { hasSome: eu.funcoes },
            // Ninguém aprova o próprio pedido. `podeDecidir` já
            // recusa essas; filtrar aqui é só não carregá-las.
            solicitanteId: { not: eu.id },
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
        contagens.materiaisAbaixoDoMinimo = await contarNoPontoDeRepor();
      }

      // ----- Contas vencidas e vencendo -----
      //
      // `diasAte` é a mesma conta do painel financeiro, e ela ignora
      // a hora — senão uma parcela de hoje de manhã apareceria como
      // vencida à tarde.
      if (pode('financeiro.ver')) {
        // Antes isto trazia TODA conta em aberto para contar aqui.
        // Agora são dois `count`, e a fronteira das datas é a única
        // coisa que atravessa — calculada no calendário de São
        // Paulo, porque o banco responderia em UTC.
        //
        //   vencida   : vence antes da meia-noite de hoje
        //   vencendo  : de hoje até o fim do sétimo dia
        //
        // O fim do sétimo dia é o COMEÇO do oitavo: assim a conta
        // que vence às 23h do sétimo dia entra, e a do oitavo não.
        const comecoDeHoje = inicioDoDiaBr(hoje);
        const fimDaSemana = inicioDoDiaBrMais(8, hoje);

        const [vencidas, vencendo] = await Promise.all([
          banco.contaPagar.count({
            where: { situacao: 'ABERTA', vencimento: { lt: comecoDeHoje } },
          }),
          banco.contaPagar.count({
            where: {
              situacao: 'ABERTA',
              vencimento: { gte: comecoDeHoje, lt: fimDaSemana },
            },
          }),
        ]);

        contagens.contasVencidas = vencidas;
        contagens.contasVencendoEm7Dias = vencendo;
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
