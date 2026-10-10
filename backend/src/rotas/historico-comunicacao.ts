// ============================================================
//  O histórico de comunicação — uma aba só, dois canais
//
//  Pedido dele em 10/10/2026: uma aba dentro de Comunicação com
//  o que foi enviado, filtro por período e paginação, "como uma
//  forma de prova que a mensagem foi enviada".
//
//  A permissão é a mesma de quem administra as integrações. Não
//  é tela de trabalho: é onde se vai conferir quando alguém diz
//  que não recebeu.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { buscarHistorico, type Canal, type SituacaoEnvio } from '../servicos/historico-comunicacao.js';

const CANAIS = new Set(['whatsapp', 'email', 'todos']);
const SITUACOES = new Set(['ENVIADA', 'FALHOU', 'BLOQUEADA', 'todas']);

export async function rotasHistoricoComunicacao(app: FastifyInstance) {
  app.get(
    '/api/comunicacao/historico',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req) => {
      const q = req.query as Record<string, string | undefined>;

      //  Filtro inválido não derruba a tela: vira "sem filtro".
      //  Quem chega com um link torto quer ver a lista, não um 400.
      const canal = CANAIS.has(q.canal ?? '') ? (q.canal as Canal | 'todos') : 'todos';
      const situacao = SITUACOES.has(q.situacao ?? '')
        ? (q.situacao as SituacaoEnvio | 'todas')
        : 'todas';

      return buscarHistorico({
        canal,
        situacao,
        dias: Number(q.dias) || undefined,
        termo: q.termo,
        pagina: Number(q.pagina) || 1,
        porPagina: Number(q.porPagina) || undefined,
      });
    },
  );
}
