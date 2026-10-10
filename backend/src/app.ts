// ============================================================
//  Montagem da aplicação
//
//  Separado do servidor.ts de propósito: assim os testes
//  conseguem criar a aplicação e chamar as rotas SEM abrir uma
//  porta de rede. Testes ficam rápidos e não brigam por porta.
// ============================================================

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { ambiente } from './config/ambiente.js';
import { ligarMensagensEmPortugues } from './servicos/erros-em-portugues.js';
import { pluginAutenticacao } from './plugins/autenticacao.js';
import { rotasSaude } from './rotas/saude.js';
import { rotasInicio } from './rotas/inicio.js';
import { rotasIntegracoes } from './rotas/integracoes.js';
import { rotasAutenticacao } from './rotas/autenticacao.js';
import { rotasUsuarios } from './rotas/usuarios.js';
import { rotasObras } from './rotas/obras.js';
import { rotasCatalogo } from './rotas/catalogo.js';
import { rotasFornecedores } from './rotas/fornecedores.js';
import { rotasAlcadas } from './rotas/alcadas.js';
import { rotasSolicitacoes } from './rotas/solicitacoes.js';
import { rotasAprovacoes } from './rotas/aprovacoes.js';
import { rotasCotacoes } from './rotas/cotacoes.js';
import { rotasPortal } from './rotas/portal.js';
import { rotasConvite } from './rotas/convite.js';
import { conferirPartida } from './servicos/diario-whatsapp.js';
import { integracoes } from './integracoes/index.js';
import { rotasEqualizacao } from './rotas/equalizacao.js';
import { rotasRecebimentos } from './rotas/recebimentos.js';
import { rotasEstoque } from './rotas/estoque.js';
import { rotasFiscal } from './rotas/fiscal.js';
import { rotasLancamentos } from './rotas/lancamentos.js';
import { rotasWhatsApp } from './rotas/whatsapp.js';
import { rotasEmail } from './rotas/email.js';
import { rotasRelatorios } from './rotas/relatorios.js';
import { rotasLocacao } from './rotas/locacao.js';

const ehTeste = ambiente.NODE_ENV === 'test';

/**
 * O erro de "pediu demais em pouco tempo".
 *
 * Duas coisas precisam estar aqui:
 *
 *  - `statusCode: 429`, senão a resposta sai como **500**, e o
 *    sistema diz "erro interno do servidor" quando na verdade era
 *    só excesso de requisição. Erro de servidor acorda gente de
 *    madrugada à toa; o 429 diz a verdade: espere e tente de novo.
 *  - o campo `erro`, que é onde a tela procura a mensagem. Sem
 *    ele a pessoa lê "O servidor respondeu com erro 429" em vez da
 *    frase em português.
 *
 * Não aparecia nos testes porque o limitador fica desligado neles.
 */
export function excessoDeRequisicoes(): { statusCode: number; erro: string } {
  return {
    statusCode: 429,
    erro: 'Muitas requisições em pouco tempo. Aguarde um instante.',
  };
}

export async function criarApp(): Promise<FastifyInstance> {
  // O Zod fala ingles de programador por padrao, e essas frases
  // chegavam a tela do usuario. Ligado antes de qualquer rota.
  ligarMensagensEmPortugues();

  const app = Fastify({
    logger: ehTeste
      ? false
      : {
          level: ambiente.NODE_ENV === 'development' ? 'info' : 'warn',
          transport:
            ambiente.NODE_ENV === 'development'
              ? {
                  target: 'pino-pretty',
                  options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
                }
              : undefined,
        },
    // Protege contra requisições gigantes que estourariam a memória.
    bodyLimit: 5 * 1024 * 1024,
  });

  /**
   * Aceita POST sem corpo.
   *
   * Várias ações do sistema não precisam enviar nada ("abrir",
   * "encerrar", "enviar"). Sem isto, o Fastify recusa a chamada
   * com um erro técnico confuso sempre que o cliente manda o
   * cabeçalho de JSON e o corpo vazio.
   */
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_requisicao, corpo, pronto) => {
      const texto = String(corpo ?? '').trim();

      if (texto === '') return pronto(null, {});

      try {
        pronto(null, JSON.parse(texto));
      } catch {
        pronto(new Error('O corpo da requisição não é um JSON válido.'), undefined);
      }
    },
  );

  // Cabeçalhos de segurança no navegador.
  // ----------------------------------------------------------
  //  HSTS só quando há HTTPS de verdade
  //
  //  O `helmet` manda por padrão:
  //
  //    strict-transport-security: max-age=15552000; includeSubDomains
  //
  //  Que quer dizer: "nunca mais use HTTP neste endereço, por 180
  //  dias". Servido por HTTPS isso é proteção. Servido por HTTP —
  //  que é como o sistema roda em desenvolvimento, e como o dono
  //  abre no celular pelo IP da rede — é um tiro no pé: o navegador
  //  passa a forçar `https://192.168.1.109:5173`, que não existe, e
  //  a página simplesmente para de abrir.
  //
  //  Foi exatamente o que aconteceu em 24/09/2026: funcionou na
  //  primeira visita (a página carregou antes de a API responder) e
  //  nunca mais. No computador seguia funcionando, porque Chrome e
  //  Edge IGNORAM HSTS para endereço IP; o Safari do iPhone não.
  //
  //  Em produção, atrás de HTTPS, ele volta a valer.
  // ----------------------------------------------------------
  await app.register(helmet, {
    contentSecurityPolicy: false,
    hsts: ambiente.NODE_ENV === 'production',
  });

  // Limite de requisições: barra força bruta e sobrecarga.
  // Nos testes ele é desligado, senão o próprio teste seria bloqueado
  // ao fazer dezenas de logins seguidos.
  if (!ehTeste) {
    await app.register(rateLimit, {
      max: 200,
      timeWindow: '1 minute',
      errorResponseBuilder: () => excessoDeRequisicoes(),
    });
  }

  await app.register(cors, {
    origin: ambiente.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Porteiro: precisa vir antes das rotas que exigem login.
  await app.register(pluginAutenticacao);

  await app.register(rotasSaude);
  await app.register(rotasInicio);
  await app.register(rotasAutenticacao);
  await app.register(rotasUsuarios);
  await app.register(rotasConvite);
  await app.register(rotasObras);
  await app.register(rotasCatalogo);
  await app.register(rotasFornecedores);
  await app.register(rotasAlcadas);
  await app.register(rotasSolicitacoes);
  await app.register(rotasAprovacoes);
  await app.register(rotasCotacoes);
  await app.register(rotasEqualizacao);
  await app.register(rotasRecebimentos);
  await app.register(rotasEstoque);
  await app.register(rotasFiscal);
  await app.register(rotasLancamentos);
  await app.register(rotasWhatsApp);
  await app.register(rotasEmail);
  await app.register(rotasRelatorios);
  await app.register(rotasLocacao);
  await app.register(rotasPortal);
  await app.register(rotasIntegracoes);

  app.setNotFoundHandler((requisicao, resposta) => {
    resposta.status(404).send({
      erro: 'Rota não encontrada',
      caminho: requisicao.url,
    });
  });

  // Tratamento central de erros: nunca vazar detalhe interno.
  app.setErrorHandler((erro: Error & { statusCode?: number }, _requisicao, resposta) => {
    if (!ehTeste) app.log.error(erro);
    const status = erro.statusCode ?? 500;
    resposta.status(status).send({
      erro: status >= 500 ? 'Erro interno do servidor' : erro.message,
    });
  });

  //  O DIÁRIO DO WHATSAPP OLHA PARA TRÁS NA PARTIDA.
  //
  //  Quando a API é reiniciada, a conexão do WhatsApp cai sem que
  //  ninguém consiga anotar — o processo morre antes. Aqui o
  //  sistema confere se a última linha do diário ficou dizendo
  //  "no ar" e, se ficou, registra o que de fato houve.
  //
  //  Não espera: partida de API não atrasa por causa de diário.
  if (!ehTeste) {
    void conferirPartida(integracoes.whatsapp.situacao().estado);
  }

  return app;
}
