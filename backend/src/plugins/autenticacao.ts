// ============================================================
//  Porteiro do sistema
//
//  Duas funções são adicionadas ao Fastify:
//
//    exigirLogin      -> "você está identificado?"
//    exigirPermissao  -> "você pode fazer isso?"
//
//  IMPORTANTE: a permissão é conferida AQUI, no servidor.
//  Esconder o botão na tela é conforto visual, não segurança —
//  qualquer pessoa consegue chamar a API direto.
// ============================================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { ambiente } from '../config/ambiente.js';
import { carregarUsuario, type UsuarioAutenticado } from '../servicos/autenticacao.js';

export const COOKIE_RENOVACAO = 'portoink_sessao';

/**
 * O que uma conta de senha provisória ainda alcança.
 *
 * Só o necessário para ela criar a própria senha e sair:
 * saber quem é, trocar a senha, e encerrar a sessão. Qualquer
 * outra rota responde 403 enquanto a marca estiver ligada.
 */
const LIBERADAS = new Set([
  '/api/autenticacao/eu',
  '/api/autenticacao/senha',
  '/api/autenticacao/sair',
]);

declare module 'fastify' {
  interface FastifyInstance {
    exigirLogin: (req: FastifyRequest, res: FastifyReply) => Promise<void>;
    exigirPermissao: (
      ...codigos: string[]
    ) => (req: FastifyRequest, res: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    usuario?: UsuarioAutenticado;
  }
}

/**
 * Confere o crachá e devolve o usuário.
 * Se algo estiver errado, já responde o erro e devolve null —
 * o Fastify interrompe a requisição sozinho nesse caso.
 */
async function identificar(
  req: FastifyRequest,
  res: FastifyReply,
): Promise<UsuarioAutenticado | null> {
  let idUsuario: string;

  try {
    const conteudo = await req.jwtVerify<{ sub: string }>();
    idUsuario = conteudo.sub;
  } catch {
    await res.status(401).send({ erro: 'Você precisa entrar no sistema.' });
    return null;
  }

  // Recarregamos do banco a cada requisição de propósito: se o
  // administrador tirar uma permissão, vale na hora, sem esperar
  // o crachá vencer.
  const usuario = await carregarUsuario(idUsuario);

  if (!usuario) {
    await res.status(401).send({ erro: 'Sessão inválida. Entre novamente.' });
    return null;
  }

  req.usuario = usuario;

  // ----------------------------------------------------------
  //  SENHA PROVISÓRIA NÃO ABRE O SISTEMA
  //
  //  Quem cria uma conta escolhe uma senha de entrada, e a rota
  //  de redefinir sorteia outra. Nos dois casos a conta nasce
  //  marcada com `precisaTrocarSenha`, e a própria mensagem da
  //  tela promete: "a pessoa deverá criar uma nova no próximo
  //  acesso".
  //
  //  Até 09/10/2026 a marca era escrita, enviada no login e
  //  declarada no tipo do frontend — e NENHUMA TELA A LIA. As
  //  sete contas da simulação entraram direto no painel com a
  //  senha que o administrador digitou. Na prática, quem cria
  //  contas sabia a senha de todo mundo, para sempre.
  //
  //  A trava fica AQUI, e não só na tela, porque é a regra da
  //  casa (`02-plano-e-arquitetura.md`, §2.4): "permissão por
  //  função, verificada no servidor — nunca só escondendo botão
  //  na tela". Esconder a tela e deixar a API aberta seria um
  //  cadeado pintado na porta.
  //
  //  As quatro portas que continuam abertas são as que a pessoa
  //  precisa para SAIR desse estado, e nenhuma a mais.
  // ----------------------------------------------------------
  if (usuario.precisaTrocarSenha && !LIBERADAS.has(req.url.split('?')[0])) {
    await res.status(403).send({
      erro: 'Crie uma senha sua antes de usar o sistema.',
      precisaTrocarSenha: true,
    });
    return null;
  }

  return usuario;
}

async function plugin(app: FastifyInstance) {
  await app.register(cookie, { secret: ambiente.JWT_SECRET });
  await app.register(jwt, { secret: ambiente.JWT_SECRET });

  app.decorate('exigirLogin', async (req: FastifyRequest, res: FastifyReply) => {
    await identificar(req, res);
  });

  app.decorate(
    'exigirPermissao',
    (...codigos: string[]) =>
      async (req: FastifyRequest, res: FastifyReply) => {
        const usuario = await identificar(req, res);
        if (!usuario) return;

        const permitido = codigos.some((codigo) => usuario.permissoes.includes(codigo));

        if (!permitido) {
          await res.status(403).send({
            erro: 'Você não tem permissão para esta ação.',
            permissaoNecessaria: codigos,
          });
        }
      },
  );
}

export const pluginAutenticacao = fastifyPlugin(plugin, { name: 'autenticacao' });
