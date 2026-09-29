// ============================================================
//  Rotas para inspecionar e testar as integrações
//
//  Servem para você enxergar o que o sistema "enviaria" sem
//  que nada saia de verdade enquanto os adaptadores forem mock.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { integracoes, resumoIntegracoes } from '../integracoes/index.js';
import { AdaptadorWhatsAppMock } from '../integracoes/whatsapp/adaptador.mock.js';
import { enviarPeloWhatsApp } from '../servicos/whatsapp.js';

const esquemaTesteWhatsApp = z.object({
  para: z.string().regex(/^\d{10,15}$/, 'Informe só números, com DDI e DDD. Ex: 5511999998888'),
  texto: z.string().min(1).max(1000),
});

export async function rotasIntegracoes(app: FastifyInstance) {
  app.get(
    '/api/integracoes',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => ({ integracoes: resumoIntegracoes() }),
  );

  // Envia uma mensagem pelo adaptador ativo.
  app.post(
    '/api/integracoes/whatsapp/testar',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (requisicao, resposta) => {
      const dados = esquemaTesteWhatsApp.safeParse(requisicao.body);

      if (!dados.success) {
        return resposta.status(400).send({
          erro: 'Dados inválidos',
          detalhes: dados.error.issues.map((i) => ({
            campo: i.path.join('.'),
            mensagem: i.message,
          })),
        });
      }

      // Pela porta única, como todo o resto.
      //
      // Esta rota nasceu quando só existia o adaptador simulado, e
      // chamava o adaptador direto — o que, com o WhatsApp ligado
      // de verdade, mandaria mensagem para qualquer número sem
      // consultar a lista de autorizados. A tela de Avisos já usa
      // o caminho certo; esta ficou para trás.
      const resultado = await enviarPeloWhatsApp({
        para: dados.data.para,
        texto: dados.data.texto,
        contexto: 'teste',
        usuarioId: requisicao.usuario?.id ?? null,
      });

      return resposta.status(resultado.sucesso ? 200 : 502).send(resultado);
    },
  );

  // Lista o que o simulador registrou.
  app.get(
    '/api/integracoes/whatsapp/historico',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (_requisicao, resposta) => {
      const adaptador = integracoes.whatsapp;

      if (!(adaptador instanceof AdaptadorWhatsAppMock)) {
        return resposta.status(409).send({
          erro: 'O histórico só existe no adaptador simulado.',
          adaptadorAtivo: adaptador.nome,
        });
      }

      return { historico: adaptador.listarHistorico() };
    },
  );

  // Consulta um código de barras.
  app.get(
    '/api/integracoes/gtin/:codigo',
    { preHandler: app.exigirPermissao('materiais.ver') },
    async (requisicao, resposta) => {
      const { codigo } = requisicao.params as { codigo: string };
      const produto = await integracoes.gtin.consultar(codigo);

      if (!produto) {
        return resposta.status(404).send({
          erro: 'Código de barras não encontrado ou inválido.',
          sugestao: 'Cadastre o produto e vincule-o a uma família.',
        });
      }

      return produto;
    },
  );
}
