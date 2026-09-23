// ============================================================
//  Rotas de entrada e saída
//
//  POST /api/autenticacao/entrar    -> login
//  POST /api/autenticacao/renovar   -> renova o crachá vencido
//  POST /api/autenticacao/sair      -> logout
//  GET  /api/autenticacao/eu        -> quem sou eu e o que posso fazer
//  POST /api/autenticacao/senha     -> trocar a própria senha
// ============================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ambiente } from '../config/ambiente.js';
import { banco } from '../plugins/banco.js';
import { COOKIE_RENOVACAO } from '../plugins/autenticacao.js';
import {
  entrar,
  renovar,
  sair,
  encerrarTodasSessoes,
  DURACAO_ACESSO,
  DURACAO_RENOVACAO_DIAS,
  type UsuarioAutenticado,
} from '../servicos/autenticacao.js';
import { gerarHash, conferirSenha, validarForcaSenha } from '../servicos/senha.js';

const esquemaEntrada = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  senha: z.string().min(1, 'Informe a senha.'),
});

const esquemaTrocaSenha = z.object({
  senhaAtual: z.string().min(1, 'Informe a senha atual.'),
  senhaNova: z.string().min(8, 'A nova senha precisa ter pelo menos 8 caracteres.'),
});

/** Guarda a chave de renovação num cookie que o JavaScript não lê. */
function gravarCookie(res: FastifyReply, token: string) {
  res.setCookie(COOKIE_RENOVACAO, token, {
    httpOnly: true, // JavaScript da página não enxerga: barra roubo por script
    sameSite: 'lax', // barra uso do cookie a partir de outro site
    secure: ambiente.NODE_ENV === 'production', // só por HTTPS em produção
    path: '/api/autenticacao',
    maxAge: DURACAO_RENOVACAO_DIAS * 24 * 60 * 60,
  });
}

function apagarCookie(res: FastifyReply) {
  res.clearCookie(COOKIE_RENOVACAO, { path: '/api/autenticacao' });
}

function responderSessao(
  app: FastifyInstance,
  res: FastifyReply,
  usuario: UsuarioAutenticado,
  tokenRenovacao: string,
) {
  const acesso = app.jwt.sign({ sub: usuario.id }, { expiresIn: DURACAO_ACESSO });
  gravarCookie(res, tokenRenovacao);
  return res.send({ token: acesso, usuario });
}

export async function rotasAutenticacao(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Entrar
  // --------------------------------------------------------
  app.post(
    '/api/autenticacao/entrar',
    {
      // Limite mais apertado que o geral: barra tentativa de
      // adivinhar senha por força bruta.
      config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
    },
    async (req, res) => {
      const dados = esquemaEntrada.safeParse(req.body);

      if (!dados.success) {
        return res.status(400).send({
          erro: 'Dados inválidos',
          detalhes: dados.error.issues.map((i) => ({
            campo: i.path.join('.'),
            mensagem: i.message,
          })),
        });
      }

      const resultado = await entrar(
        dados.data.email,
        dados.data.senha,
        req.headers['user-agent'],
      );

      if (!resultado.ok) {
        // Mesma mensagem para e-mail errado e senha errada: não
        // entregamos ao invasor a informação de quais e-mails existem.
        const mensagem =
          resultado.motivo === 'inativo'
            ? 'Este usuário está desativado. Fale com o administrador.'
            : 'E-mail ou senha incorretos.';

        return res.status(401).send({ erro: mensagem });
      }

      return responderSessao(app, res, resultado.usuario, resultado.tokenRenovacao);
    },
  );

  // --------------------------------------------------------
  //  Renovar o crachá
  // --------------------------------------------------------
  app.post('/api/autenticacao/renovar', async (req, res) => {
    const token = req.cookies[COOKIE_RENOVACAO];

    if (!token) {
      return res.status(401).send({ erro: 'Sessão não encontrada. Entre novamente.' });
    }

    const resultado = await renovar(token);

    if (!resultado.ok) {
      apagarCookie(res);
      return res.status(401).send({ erro: 'Sessão expirada. Entre novamente.' });
    }

    return responderSessao(app, res, resultado.usuario, resultado.tokenRenovacao);
  });

  // --------------------------------------------------------
  //  Sair
  // --------------------------------------------------------
  app.post('/api/autenticacao/sair', async (req, res) => {
    const token = req.cookies[COOKIE_RENOVACAO];
    if (token) await sair(token);

    apagarCookie(res);
    return res.send({ ok: true });
  });

  // --------------------------------------------------------
  //  Quem sou eu
  // --------------------------------------------------------
  app.get(
    '/api/autenticacao/eu',
    { preHandler: app.exigirLogin },
    async (req) => ({ usuario: req.usuario }),
  );

  // --------------------------------------------------------
  //  Trocar a própria senha
  // --------------------------------------------------------
  app.post(
    '/api/autenticacao/senha',
    { preHandler: app.exigirLogin },
    async (req, res) => {
      const dados = esquemaTrocaSenha.safeParse(req.body);

      if (!dados.success) {
        return res.status(400).send({
          erro: 'Dados inválidos',
          detalhes: dados.error.issues.map((i) => ({
            campo: i.path.join('.'),
            mensagem: i.message,
          })),
        });
      }

      const problemas = validarForcaSenha(dados.data.senhaNova);
      if (problemas.length > 0) {
        return res.status(400).send({ erro: 'Senha fraca', detalhes: problemas });
      }

      const registro = await banco.usuario.findUnique({
        where: { id: req.usuario!.id },
      });

      if (!registro || !(await conferirSenha(dados.data.senhaAtual, registro.senhaHash))) {
        return res.status(400).send({ erro: 'A senha atual está incorreta.' });
      }

      await banco.usuario.update({
        where: { id: registro.id },
        data: {
          senhaHash: await gerarHash(dados.data.senhaNova),
          precisaTrocarSenha: false,
        },
      });

      // Trocar a senha derruba as outras sessões: se alguém tinha
      // entrado com a senha antiga, perde o acesso agora.
      await encerrarTodasSessoes(registro.id);
      apagarCookie(res);

      return res.send({
        ok: true,
        mensagem: 'Senha alterada. Entre novamente com a nova senha.',
      });
    },
  );
}
