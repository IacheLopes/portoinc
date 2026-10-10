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
import { plural, textoOpcional } from '../servicos/util.js';

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

// ============================================================
//  AS FUNÇÕES, E O QUE CADA UMA PODE
//
//  "As funções devem ser criáveis dentro do sistema" está na
//  primeira página do fluxo de compras da Porto Inc., dado como
//  regra confirmada. Até 09/10/2026 existia só a metade de cima:
//  uma pessoa acumulava funções, mas as funções eram as nove da
//  migração e ponto.
//
//  Quem cria é quem tem `funcoes.gerenciar` — hoje, só o
//  Administrador.
// ============================================================

/**
 * O que NÃO se dá a ninguém pela tela.
 *
 * `sistema.status` abre o diagnóstico — memória da API, estado do
 * banco, quais integrações ainda são simuladas. O guia de
 * navegação promete, com todas as letras, que essa tela "não
 * aparece para mais ninguém, nem para o administrador". Oferecer
 * a permissão numa lista de caixas desfaria a promessa com um
 * clique, e sem ninguém perceber.
 */
const FORA_DE_ALCANCE = ['sistema.status'] as const;

/**
 * As chaves da casa.
 *
 * Se nenhuma função ativa tiver estas duas, ninguém mais cria
 * usuário nem mexe em função — e o sistema se tranca por fora,
 * sem caminho de volta pela tela.
 */
const CHAVES_DA_CASA = ['usuarios.gerenciar', 'funcoes.gerenciar'] as const;

const esquemaNovaFuncao = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'O código precisa ter pelo menos 2 letras.')
    .max(30)
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Use letras, números e _ , começando por letra.'),
  nome: z.string().trim().min(3, 'O nome precisa ter pelo menos 3 caracteres.').max(60),
  descricao: textoOpcional(200),
  permissoes: z.array(z.string().uuid()).min(1, 'Escolha pelo menos uma permissão.'),
});

const esquemaFuncaoEditada = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'O código precisa ter pelo menos 2 letras.')
    .max(30)
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Use letras, números e _ , começando por letra.')
    .optional(),
  nome: z.string().trim().min(3, 'O nome precisa ter pelo menos 3 caracteres.').max(60).optional(),
  descricao: textoOpcional(200),
  permissoes: z
    .array(z.string().uuid())
    .min(1, 'A função precisa de pelo menos uma permissão.')
    .optional(),
});

/** Alguém tentou dar uma permissão que a tela não oferece? */
async function recusarPermissaoForaDeAlcance(ids: string[] | undefined): Promise<string | null> {
  if (!ids || ids.length === 0) return null;

  const proibida = await banco.permissao.findFirst({
    where: { id: { in: ids }, codigo: { in: [...FORA_DE_ALCANCE] } },
    select: { nome: true },
  });

  if (!proibida) return null;

  return '"' + proibida.nome + '" não é dada pela tela: ela pertence a quem mantém o sistema.';
}

/**
 * Esta mudança deixaria o sistema sem dono?
 *
 * O administrador pode, com um clique, tirar `usuarios.gerenciar`
 * da própria função. A partir daí ninguém cria conta, ninguém
 * ajusta função, e a saída é mexer no banco por fora.
 *
 * A conta: simula a mudança e pergunta quem ainda teria a chave.
 */
async function deixariaSemChave(
  funcaoId: string,
  novasPermissoes: string[] | undefined,
): Promise<string | null> {
  if (!novasPermissoes) return null;

  const chaves = await banco.permissao.findMany({
    where: { codigo: { in: [...CHAVES_DA_CASA] } },
    select: { id: true, codigo: true, nome: true },
  });

  const vaiTer = new Set(
    chaves.filter((c) => novasPermissoes.includes(c.id)).map((c) => c.codigo),
  );

  for (const chave of chaves) {
    if (vaiTer.has(chave.codigo)) continue;

    // ALGUMA PESSOA ATIVA AINDA TERIA ESTA CHAVE?
    //
    // A primeira versão perguntava "alguma outra FUNÇÃO tem?", e
    // isso não bastava: uma função com a permissão e sem ninguém
    // dentro é uma chave trancada numa gaveta. O que importa é
    // haver gente capaz de usá-la amanhã de manhã.
    const alguem = await banco.usuarioFuncao.findFirst({
      where: {
        funcaoId: { not: funcaoId },
        usuario: { ativo: true },
        funcao: { permissoes: { some: { permissaoId: chave.id } } },
      },
      select: { usuarioId: true },
    });

    if (!alguem) {
      return 'Tirar "' + chave.nome + '" daqui deixaria o sistema sem NINGUÉM capaz disso. '
        + 'Dê esta permissão a outra função — e a alguém — antes.';
    }
  }

  return null;
}

/** A função como a tela a lê. */
function formatarFuncao(f: {
  id: string; codigo: string; nome: string; descricao: string | null; sistema: boolean;
  permissoes: Array<{ permissao: { codigo: string; nome: string; grupo: string } }>;
  _count: { usuarios: number };
}) {
  return {
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
  };
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

  // --------------------------------------------------------
  //  As permissões que existem
  //
  //  Para a tela montar a lista de caixas. Vêm agrupadas, porque
  //  27 caixas soltas numa coluna ninguém lê.
  // --------------------------------------------------------
  app.get(
    '/api/permissoes',
    { preHandler: app.exigirPermissao('funcoes.gerenciar') },
    async () => {
      const permissoes = await banco.permissao.findMany({
        where: { codigo: { notIn: [...FORA_DE_ALCANCE] } },
        orderBy: [{ grupo: 'asc' }, { nome: 'asc' }],
        select: { id: true, codigo: true, nome: true, grupo: true },
      });

      return { permissoes };
    },
  );

  // --------------------------------------------------------
  //  Criar função
  //
  //  Pedido confirmado na primeira página do fluxo de compras:
  //  "um usuário pode acumular mais de uma função, e as funções
  //  devem ser criáveis dentro do sistema".
  //
  //  A primeira metade existia desde a Etapa 1. A segunda não:
  //  havia rota para LISTAR funções e nenhuma para criar, e a
  //  permissão `funcoes.gerenciar` só servia para ler a lista.
  //  Achado na análise de coerência de 09/10/2026.
  //
  //  Criar função sem escolher o que ela pode seria um nome sem
  //  conteúdo — por isso as permissões vêm junto, e pelo menos
  //  uma é obrigatória.
  // --------------------------------------------------------
  app.post(
    '/api/funcoes',
    { preHandler: app.exigirPermissao('funcoes.gerenciar') },
    async (req, res) => {
      const dados = esquemaNovaFuncao.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const codigo = dados.data.codigo.toUpperCase().trim();

      if (await banco.funcao.findUnique({ where: { codigo } })) {
        return res.status(409).send({ erro: 'Já existe uma função com este código.' });
      }

      const recusa = await recusarPermissaoForaDeAlcance(dados.data.permissoes);
      if (recusa) return res.status(403).send({ erro: recusa });

      const funcao = await banco.funcao.create({
        data: {
          codigo,
          nome: dados.data.nome.trim(),
          descricao: dados.data.descricao,
          // Função criada pela empresa NÃO é de sistema: ela pode
          // ser renomeada e apagada enquanto ninguém a usa. As
          // nove do BPMN são, e por isso ficam.
          sistema: false,
          permissoes: { create: dados.data.permissoes.map((permissaoId) => ({ permissaoId })) },
        },
        include: { permissoes: { include: { permissao: true } }, _count: { select: { usuarios: true } } },
      });

      return res.status(201).send({ funcao: formatarFuncao(funcao) });
    },
  );

  // --------------------------------------------------------
  //  Ajustar função
  //
  //  Nas nove de fábrica, só as PERMISSÕES mudam: o código é
  //  citado em documento e em migração, e o nome é o que a
  //  empresa usa para falar da pessoa. Nas criadas aqui, tudo.
  // --------------------------------------------------------
  app.patch(
    '/api/funcoes/:id',
    { preHandler: app.exigirPermissao('funcoes.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };
      const dados = esquemaFuncaoEditada.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const atual = await banco.funcao.findUnique({ where: { id } });
      if (!atual) return res.status(404).send({ erro: 'Função não encontrada.' });

      if (atual.codigo === SO_DO_DESENVOLVEDOR) {
        return res.status(403).send({
          erro: 'Esta função pertence a quem mantém o sistema e não se ajusta pela tela.',
        });
      }

      if (atual.sistema && (dados.data.codigo || dados.data.nome)) {
        return res.status(409).send({
          erro: 'Esta função veio com o sistema: o nome e o código não mudam. '
            + 'As permissões dela, sim.',
        });
      }

      const recusa = await recusarPermissaoForaDeAlcance(dados.data.permissoes);
      if (recusa) return res.status(403).send({ erro: recusa });

      const travada = await deixariaSemChave(id, dados.data.permissoes);
      if (travada) return res.status(409).send({ erro: travada });

      const funcao = await banco.funcao.update({
        where: { id },
        data: {
          ...(dados.data.codigo ? { codigo: dados.data.codigo.toUpperCase().trim() } : {}),
          ...(dados.data.nome ? { nome: dados.data.nome.trim() } : {}),
          ...(dados.data.descricao !== undefined ? { descricao: dados.data.descricao } : {}),
          ...(dados.data.permissoes
            ? {
                permissoes: {
                  deleteMany: {},
                  create: dados.data.permissoes.map((permissaoId) => ({ permissaoId })),
                },
              }
            : {}),
        },
        include: { permissoes: { include: { permissao: true } }, _count: { select: { usuarios: true } } },
      });

      return { funcao: formatarFuncao(funcao) };
    },
  );

  // --------------------------------------------------------
  //  Apagar função
  //
  //  Só o que a empresa criou, e só enquanto ninguém usa. Função
  //  com gente dentro ou citada numa faixa de alçada não some:
  //  sumir levaria junto a resposta de "quem assinou isto?".
  // --------------------------------------------------------
  app.delete(
    '/api/funcoes/:id',
    { preHandler: app.exigirPermissao('funcoes.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const funcao = await banco.funcao.findUnique({
        where: { id },
        include: { _count: { select: { usuarios: true, alcadas: true, aprovacoes: true } } },
      });

      if (!funcao) return res.status(404).send({ erro: 'Função não encontrada.' });

      if (funcao.sistema) {
        return res.status(409).send({
          erro: 'Esta função veio com o sistema e não se apaga. '
            + 'Se ninguém a usa, deixe-a sem gente dentro.',
        });
      }

      const presa: string[] = [];
      if (funcao._count.usuarios > 0) {
        presa.push(plural(funcao._count.usuarios, 'pessoa está', 'pessoas estão') + ' com ela');
      }
      if (funcao._count.alcadas > 0) {
        presa.push(plural(funcao._count.alcadas, 'faixa de alçada cita', 'faixas de alçada citam') + ' ela');
      }
      if (funcao._count.aprovacoes > 0) {
        presa.push(plural(funcao._count.aprovacoes, 'assinatura foi dada', 'assinaturas foram dadas') + ' com ela');
      }

      if (presa.length > 0) {
        return res.status(409).send({
          erro: 'Esta função não pode ser apagada: ' + presa.join(', ') + '.',
        });
      }

      await banco.funcao.delete({ where: { id } });
      return { ok: true, mensagem: 'Função apagada.' };
    },
  );
}
