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

  //  AS TRAVAS SÃO ANUNCIADAS EM VOZ ALTA, toda partida.
  //
  //  Elas são silenciosas por natureza: ligada, a trava faz a
  //  mensagem ser registrada como "bloqueada" e nada chega — sem
  //  erro, sem alerta. Quem for procurar o defeito vai procurar no
  //  provedor, na rede, no número do fornecedor. Nunca aqui.
  //
  //  E o padrão delas é LIGADO, de propósito: variável faltando
  //  significa ambiente incompleto, e aí o seguro é não mandar
  //  nada para fora. O preço desse acerto é justamente este risco
  //  — subir para produção sem as linhas no `.env` e demorar uma
  //  manhã para entender por quê. Esta linha cobra esse preço no
  //  primeiro segundo.
  const travaWhats = ambiente.WHATSAPP_MODO_TESTE !== 'false';
  const travaEmail = ambiente.EMAIL_MODO_TESTE !== 'false';

  app.log.info('  Travas de teste:');
  app.log.info(
    '    - WhatsApp: ' +
      (travaWhats
        ? 'LIGADA — só sai para número autorizado'
        : 'desligada — sai para qualquer número'),
  );
  app.log.info(
    '    - E-mail:   ' +
      (travaEmail
        ? 'LIGADA — só sai para endereço autorizado'
        : 'desligada — sai para qualquer endereço'),
  );

  if (travaWhats || travaEmail) {
    app.log.warn(
      '  ATENÇÃO: com a trava ligada o fornecedor NÃO recebe. ' +
        'Em produção, ponha WHATSAPP_MODO_TESTE=false e EMAIL_MODO_TESTE=false no .env.',
    );
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
