// ============================================================
//  Rotas de administração de usuários e funções
//
//  Todas exigem permissão. O Administrador é quem cadastra as
//  pessoas e diz quais funções cada uma acumula.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { gerarHash, validarForcaSenha } from '../servicos/senha.js';
import { encerrarTodasSessoes } from '../servicos/autenticacao.js';

/**
 * A função que não se dá pela tela.
 *
 * DESENVOLVEDOR não pertence ao fluxo de compras da Porto Inc.:
 * ela existe só para enxergar as telas de diagnóstico, que mostram
 * memória da API e quais integrações ainda são simuladas. Para
 * quem usa o sistema, essas telas só denunciam o que é maquete.
 *
 * Ela sai da listagem de `/api/funcoes` E é recusada na criação e
 * na edição de usuário. Esconder não bastava: a atribuição é por
 * id, e um administrador que descobrisse o id se daria a função.
 *
 * Quem entra nela é a migração 0021, na conta de desenvolvimento.
 */
const SO_DO_DESENVOLVEDOR = 'DESENVOLVEDOR';

/**
 * Alguma das funções pedidas é a do desenvolvedor?
 *
 * Devolve a recusa pronta, ou `null` quando está tudo certo.
 */
async function recusarFuncaoDeDesenvolvedor(
  ids: string[] | undefined,
): Promise<string | null> {
  if (!ids || ids.length === 0) return null;

  const proibida = await banco.funcao.findFirst({
    where: { codigo: SO_DO_DESENVOLVEDOR, id: { in: ids } },
    select: { id: true },
  });

  if (!proibida) return null;

  return 'Esta função não é atribuída pela tela: ela pertence a quem mantém o sistema.';
}

const esquemaNovoUsuario = z.object({
  nome: z.string().min(3, 'O nome precisa ter pelo menos 3 caracteres.'),
  email: z.string().email('Informe um e-mail válido.'),
  telefone: z.string().max(20).optional(),
  senha: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
  funcoes: z.array(z.string().uuid()).min(1, 'Selecione pelo menos uma função.'),
});

const esquemaEdicao = z.object({
  nome: z.string().min(3).optional(),
  telefone: z.string().max(20).nullable().optional(),
  ativo: z.boolean().optional(),
  funcoes: z.array(z.string().uuid()).min(1).optional(),
});

function erroDeValidacao(erro: z.ZodError) {
  return {
    erro: 'Dados inválidos',
    detalhes: erro.issues.map((i) => ({
      campo: i.path.join('.'),
      mensagem: i.message,
    })),
  };
}

/** Formato enviado à tela. Nunca inclui o hash da senha. */
const SELECAO = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  ativo: true,
  precisaTrocarSenha: true,
  ultimoAcesso: true,
  criadoEm: true,
  funcoes: { select: { funcao: { select: { id: true, codigo: true, nome: true } } } },
} as const;

export async function rotasUsuarios(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Listar usuários
  // --------------------------------------------------------
  app.get(
    '/api/usuarios',
    { preHandler: app.exigirPermissao('usuarios.ver') },
    async (req) => {
      const { busca } = req.query as { busca?: string };

      const usuarios = await banco.usuario.findMany({
        where: busca
          ? {
              OR: [
                { nome: { contains: busca, mode: 'insensitive' } },
                { email: { contains: busca, mode: 'insensitive' } },
              ],
            }
          : undefined,
        select: SELECAO,
        orderBy: { nome: 'asc' },
        take: 200,
      });

      return {
        usuarios: usuarios.map((u) => ({
          ...u,
          funcoes: u.funcoes.map((f) => f.funcao),
        })),
      };
    },
  );

  // --------------------------------------------------------
  //  Criar usuário
  // --------------------------------------------------------
  app.post(
    '/api/usuarios',
    { preHandler: app.exigirPermissao('usuarios.gerenciar') },
    async (req, res) => {
      const dados = esquemaNovoUsuario.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const problemas = validarForcaSenha(dados.data.senha);
      if (problemas.length > 0) {
        return res.status(400).send({ erro: 'Senha fraca', detalhes: problemas });
      }

      const email = dados.data.email.toLowerCase().trim();

      if (await banco.usuario.findUnique({ where: { email } })) {
        return res.status(409).send({ erro: 'Já existe um usuário com este e-mail.' });
      }

      const recusa = await recusarFuncaoDeDesenvolvedor(dados.data.funcoes);
      if (recusa) return res.status(403).send({ erro: recusa });

      const usuario = await banco.usuario.create({
        data: {
          nome: dados.data.nome.trim(),
          email,
          telefone: dados.data.telefone,
          senhaHash: await gerarHash(dados.data.senha),
          // A pessoa cria a própria senha no primeiro acesso.
          precisaTrocarSenha: true,
          funcoes: { create: dados.data.funcoes.map((funcaoId) => ({ funcaoId })) },
        },
        select: SELECAO,
      });

      return res.status(201).send({
        usuario: { ...usuario, funcoes: usuario.funcoes.map((f) => f.funcao) },
      });
    },
  );

  // --------------------------------------------------------
  //  Editar usuário
  // --------------------------------------------------------
  app.patch(
    '/api/usuarios/:id',
    { preHandler: app.exigirPermissao('usuarios.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };
      const dados = esquemaEdicao.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const existente = await banco.usuario.findUnique({ where: { id } });
      if (!existente) return res.status(404).send({ erro: 'Usuário não encontrado.' });

      // Trava de segurança: ninguém pode se desativar sozinho e
      // ficar sem administrador no sistema.
      if (dados.data.ativo === false && id === req.usuario!.id) {
        return res.status(400).send({ erro: 'Você não pode desativar a si mesmo.' });
      }

      const recusa = await recusarFuncaoDeDesenvolvedor(dados.data.funcoes);
      if (recusa) return res.status(403).send({ erro: recusa });

      const usuario = await banco.usuario.update({
        where: { id },
        data: {
          nome: dados.data.nome?.trim(),
          telefone: dados.data.telefone,
          ativo: dados.data.ativo,
          ...(dados.data.funcoes
            ? {
                funcoes: {
                  deleteMany: {},
                  create: dados.data.funcoes.map((funcaoId) => ({ funcaoId })),
                },
              }
            : {}),
        },
        select: SELECAO,
      });

      // Desativar ou mudar funções derruba as sessões abertas.
      if (dados.data.ativo === false || dados.data.funcoes) {
        await encerrarTodasSessoes(id);
      }

      return { usuario: { ...usuario, funcoes: usuario.funcoes.map((f) => f.funcao) } };
    },
  );

  // --------------------------------------------------------
  //  Redefinir a senha de alguém
  // --------------------------------------------------------
  app.post(
    '/api/usuarios/:id/senha',
    { preHandler: app.exigirPermissao('usuarios.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };
      const corpo = z.object({ senha: z.string().min(8) }).safeParse(req.body);
      if (!corpo.success) return res.status(400).send(erroDeValidacao(corpo.error));

      const problemas = validarForcaSenha(corpo.data.senha);
      if (problemas.length > 0) {
        return res.status(400).send({ erro: 'Senha fraca', detalhes: problemas });
      }

      if (!(await banco.usuario.findUnique({ where: { id } }))) {
        return res.status(404).send({ erro: 'Usuário não encontrado.' });
      }

      await banco.usuario.update({
        where: { id },
        data: {
          senhaHash: await gerarHash(corpo.data.senha),
          precisaTrocarSenha: true,
        },
      });

      await encerrarTodasSessoes(id);

      return {
        ok: true,
        mensagem: 'Senha redefinida. A pessoa deverá criar uma nova no próximo acesso.',
      };
    },
  );

  // --------------------------------------------------------
  //  Funções e permissões disponíveis
  // --------------------------------------------------------
  app.get(
    '/api/funcoes',
    { preHandler: app.exigirPermissao('usuarios.ver', 'funcoes.gerenciar') },
    async () => {
      // A função DESENVOLVEDOR não entra na lista.
      //
      // Ela não pertence ao fluxo de compras: existe só para
      // enxergar as telas de diagnóstico, que mostram memória da
      // API e quais integrações ainda são simuladas. Isso é
      // assunto de quem mantém o sistema, não de quem trabalha
      // nele.
      //
      // Escondida da lista, ninguém a atribui pela tela de
      // Usuários — nem o administrador, que de outro modo se daria
      // a função e veria o que não deveria. Quem entra nela é a
      // migração 0021, para a conta de desenvolvimento.
      const funcoes = await banco.funcao.findMany({
        where: { codigo: { not: SO_DO_DESENVOLVEDOR } },
        include: {
          permissoes: { include: { permissao: true } },
          _count: { select: { usuarios: true } },
        },
        orderBy: { nome: 'asc' },
      });

      return {
        funcoes: funcoes.map((f) => ({
          id: f.id,
          codigo: f.codigo,
          nome: f.nome,
          descricao: f.descricao,
          sistema: f.sistema,
          usuarios: f._count.usuarios,
          permissoes: f.permissoes.map((p) => ({
            codigo: p.permissao.codigo,
            nome: p.permissao.nome,
            grupo: p.permissao.grupo,
          })),
        })),
      };
    },
  );
}
