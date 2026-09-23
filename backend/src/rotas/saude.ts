// ============================================================
//  Rotas de saude e status
//
//  /health        -> resposta minima, usada pelo Docker
//  /api/status    -> panorama para a tela inicial do sistema
// ============================================================

import type { FastifyInstance } from 'fastify';
import { banco, bancoResponde } from '../plugins/banco.js';
import { resumoIntegracoes } from '../integracoes/index.js';
import { ambiente } from '../config/ambiente.js';

const iniciadoEm = Date.now();

export async function rotasSaude(app: FastifyInstance) {
  // Checagem leve: o Docker chama isso a cada 15s, entao nao toca no banco.
  app.get('/health', async () => ({ ok: true }));

  app.get(
    '/api/status',
    { preHandler: app.exigirPermissao('sistema.status') },
    async () => {
    const bancoOk = await bancoResponde();

    let totalFuncoes = 0;
    let totalUsuarios = 0;
    if (bancoOk) {
      [totalFuncoes, totalUsuarios] = await Promise.all([
        banco.funcao.count(),
        banco.usuario.count(),
      ]);
    }

    const memoria = process.memoryUsage();

    return {
      sistema: 'Porto Inc. - Compras e Almoxarifado',
      versao: '0.15.1',
      ambiente: ambiente.NODE_ENV,
      ligadoHaSegundos: Math.floor((Date.now() - iniciadoEm) / 1000),
      banco: {
        conectado: bancoOk,
        funcoesCadastradas: totalFuncoes,
        usuariosCadastrados: totalUsuarios,
      },
      memoria: {
        usadaMb: Math.round(memoria.rss / 1024 / 1024),
        limiteMb: 1024,
      },
      integracoes: resumoIntegracoes(),
    };
    },
  );
}
