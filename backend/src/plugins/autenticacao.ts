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
