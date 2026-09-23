// ============================================================
//  Regras de entrada e saída do sistema
//
//  Como funciona a sessão, em linguagem simples:
//
//  - O "crachá" (token de acesso) vale 15 minutos. Ele vai em toda
//    requisição e diz quem você é.
//  - A "chave do armário" (token de renovação) vale 7 dias e fica
//    num cookie que o JavaScript da página não consegue ler.
//  - Quando o crachá vence, a chave gera um novo sem pedir a senha.
//
//  Por que dois tokens: se o crachá vazar, o estrago dura 15 min.
//  A chave, que dura mais, fica num cookie protegido e pode ser
//  cancelada no banco a qualquer momento.
// ============================================================

import { createHash, randomBytes } from 'node:crypto';
import { banco } from '../plugins/banco.js';
import { conferirSenha } from './senha.js';

export const DURACAO_ACESSO = '15m';
export const DURACAO_RENOVACAO_DIAS = 7;

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  precisaTrocarSenha: boolean;
  funcoes: string[];
  permissoes: string[];
}

/** Guardamos só o resumo do token de renovação, nunca ele mesmo. */
function resumir(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Busca o usuário já com funções e permissões prontas. */
export async function carregarUsuario(usuarioId: string): Promise<UsuarioAutenticado | null> {
  const usuario = await banco.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      funcoes: {
        include: {
          funcao: { include: { permissoes: { include: { permissao: true } } } },
        },
      },
    },
  });

  if (!usuario || !usuario.ativo) return null;

  const funcoes = usuario.funcoes.map((uf) => uf.funcao.codigo);

  // Um usuário com várias funções soma as permissões de todas elas.
  const permissoes = [
    ...new Set(
      usuario.funcoes.flatMap((uf) => uf.funcao.permissoes.map((fp) => fp.permissao.codigo)),
    ),
  ].sort();

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    precisaTrocarSenha: usuario.precisaTrocarSenha,
    funcoes,
    permissoes,
  };
}

export type ResultadoEntrada =
  | { ok: true; usuario: UsuarioAutenticado; tokenRenovacao: string }
  | { ok: false; motivo: 'credenciais' | 'inativo' };

export async function entrar(
  email: string,
  senha: string,
  dispositivo?: string,
): Promise<ResultadoEntrada> {
  const usuario = await banco.usuario.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  // Mesmo sem encontrar o e-mail, gastamos o tempo da verificação.
  // Assim o invasor não descobre quais e-mails existem medindo a
  // demora da resposta.
  const hashParaConferir =
    usuario?.senhaHash ??
    '$argon2id$v=19$m=19456,t=2,p=1$c2FsZ2Fkb2ludXRpbA$0000000000000000000000000000000000000000000';

  const senhaConfere = await conferirSenha(senha, hashParaConferir);

  if (!usuario || !senhaConfere) return { ok: false, motivo: 'credenciais' };
  if (!usuario.ativo) return { ok: false, motivo: 'inativo' };

  const tokenRenovacao = randomBytes(48).toString('base64url');
  const expiraEm = new Date(Date.now() + DURACAO_RENOVACAO_DIAS * 24 * 60 * 60 * 1000);

  await banco.$transaction([
    banco.sessao.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: resumir(tokenRenovacao),
        dispositivo: dispositivo?.slice(0, 200),
        expiraEm,
      },
    }),
    banco.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcesso: new Date() },
    }),
  ]);

  const dados = await carregarUsuario(usuario.id);
  if (!dados) return { ok: false, motivo: 'inativo' };

  return { ok: true, usuario: dados, tokenRenovacao };
}

export type ResultadoRenovacao =
  | { ok: true; usuario: UsuarioAutenticado; tokenRenovacao: string }
  | { ok: false };

/**
 * Troca a chave antiga por uma nova (rotação).
 * Se alguém roubar a chave e usá-la, o dono legítimo é desconectado
 * na tentativa seguinte — o que denuncia o roubo.
 */
export async function renovar(tokenAntigo: string): Promise<ResultadoRenovacao> {
  const sessao = await banco.sessao.findUnique({
    where: { tokenHash: resumir(tokenAntigo) },
  });

  if (!sessao || sessao.revogadaEm || sessao.expiraEm < new Date()) {
    return { ok: false };
  }

  const usuario = await carregarUsuario(sessao.usuarioId);
  if (!usuario) return { ok: false };

  const tokenNovo = randomBytes(48).toString('base64url');

  await banco.$transaction([
    banco.sessao.update({
      where: { id: sessao.id },
      data: { revogadaEm: new Date() },
    }),
    banco.sessao.create({
      data: {
        usuarioId: sessao.usuarioId,
        tokenHash: resumir(tokenNovo),
        dispositivo: sessao.dispositivo,
        expiraEm: new Date(Date.now() + DURACAO_RENOVACAO_DIAS * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  return { ok: true, usuario, tokenRenovacao: tokenNovo };
}

/** Encerra a sessão atual. */
export async function sair(token: string): Promise<void> {
  await banco.sessao.updateMany({
    where: { tokenHash: resumir(token), revogadaEm: null },
    data: { revogadaEm: new Date() },
  });
}

/** Encerra TODAS as sessões do usuário. Usado ao trocar a senha. */
export async function encerrarTodasSessoes(usuarioId: string): Promise<void> {
  await banco.sessao.updateMany({
    where: { usuarioId, revogadaEm: null },
    data: { revogadaEm: new Date() },
  });
}

/** Remove sessões vencidas para a tabela não crescer sem limite. */
export async function limparSessoesVencidas(): Promise<number> {
  const resultado = await banco.sessao.deleteMany({
    where: { expiraEm: { lt: new Date() } },
  });
  return resultado.count;
}
