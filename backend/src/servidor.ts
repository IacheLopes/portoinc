// ============================================================
//  Porto Inc. - Servidor da API
//
//  Sobe a aplicação montada em app.ts e abre a porta.
// ============================================================

import { ambiente } from './config/ambiente.js';
import { banco } from './plugins/banco.js';
import { criarApp } from './app.js';
import { resumoIntegracoes } from './integracoes/index.js';
import { limparSessoesVencidas } from './servicos/autenticacao.js';

const app = await criarApp();

async function iniciar() {
  await app.listen({ port: ambiente.PORT, host: '0.0.0.0' });

  app.log.info('----------------------------------------------');
  app.log.info('  Porto Inc. - API no ar na porta ' + ambiente.PORT);
  app.log.info('  Integrações ativas:');
  for (const i of resumoIntegracoes()) {
    app.log.info('    - ' + i.area + ': ' + i.adaptador + (i.simulado ? ' (simulado)' : ''));
  }
  app.log.info('----------------------------------------------');

  // Faxina de sessões vencidas, uma vez por hora.
  const faxina = setInterval(
    () => {
      limparSessoesVencidas()
        .then((qtd) => {
          if (qtd > 0) app.log.info('Sessões vencidas removidas: ' + qtd);
        })
        .catch((erro) => app.log.error(erro));
    },
    60 * 60 * 1000,
  );
  faxina.unref();
}

// Encerramento limpo: fecha o banco antes de sair.
for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, async () => {
    app.log.info('Encerrando...');
    await app.close();
    await banco.$disconnect();
    process.exit(0);
  });
}

iniciar().catch((erro) => {
  console.error('Falha ao iniciar a API:', erro);
  process.exit(1);
});
