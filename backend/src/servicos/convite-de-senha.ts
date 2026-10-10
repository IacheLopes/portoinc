// ============================================================
//  O convite para criar a própria senha
//
//  Antes, o administrador digitava uma senha provisória e tinha
//  de entregá-la à pessoa. Durante esse trajeto DUAS pessoas
//  sabiam a senha de uma conta — e a primeira delas não era a
//  dona.
//
//  O convite inverte: o sistema sorteia um link de uso único, o
//  administrador copia e manda pelo canal que quiser, e quem
//  abre cria a própria senha. O administrador nunca chega a
//  saber qual é.
//
//  É o mesmo desenho do portal do fornecedor, que já funciona
//  assim desde a Etapa 5 — inclusive sem domínio e sem e-mail
//  saindo do sistema, porque quem leva o link é uma pessoa.
//
//  O QUE GUARDAMOS, E O QUE NÃO
//
//  O token vai no link e NÃO fica no banco: guardamos o SHA-256
//  dele. Quem levar o banco leva resumos, não links que abrem
//  contas. É a mesma regra da tabela `sessoes`.
// ============================================================

import { createHash, randomBytes } from 'node:crypto';
import { banco } from '../plugins/banco.js';
import { gerarHash, validarForcaSenha } from './senha.js';

/**
 * Quanto tempo o convite vale.
 *
 * Sete dias cobrem a semana de quem entra na segunda e só mexe
 * no sistema na sexta, sem deixar link vivo por tempo demais.
 */
export const DIAS_DE_VALIDADE = 7;

/** O resumo que vai para o banco. */
function resumir(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface ConviteCriado {
  /** O segredo que vai no link. Só existe aqui e na resposta. */
  token: string;
  expiraEm: Date;
}

/**
 * Gera um convite novo para a pessoa.
 *
 * Os convites anteriores dela que ainda não foram usados morrem
 * junto: se o administrador gerou um segundo link, é porque o
 * primeiro se perdeu — e link perdido que continua funcionando é
 * uma porta aberta que ninguém está olhando.
 */
export async function gerarConvite(
  usuarioId: string,
  criadoPor: string | null,
): Promise<ConviteCriado> {
  const token = randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + DIAS_DE_VALIDADE * 24 * 60 * 60 * 1000);

  await banco.$transaction([
    banco.conviteDeSenha.deleteMany({ where: { usuarioId, usadoEm: null } }),
    banco.conviteDeSenha.create({
      data: { usuarioId, tokenHash: resumir(token), expiraEm, criadoPor },
    }),
  ]);

  return { token, expiraEm };
}

export type MotivoRecusa = 'inexistente' | 'usado' | 'vencido' | 'inativo';

export interface ConviteAberto {
  nome: string;
  email: string;
}

/**
 * Confere o convite sem gastá-lo. É o que a tela chama ao abrir.
 *
 * A recusa vem com MOTIVO porque "este link já foi usado" e "este
 * link venceu" pedem reações diferentes de quem recebeu: a
 * primeira provavelmente significa que a pessoa já tem senha.
 */
export async function abrirConvite(
  token: string,
): Promise<{ ok: true; convite: ConviteAberto } | { ok: false; motivo: MotivoRecusa }> {
  const achado = await banco.conviteDeSenha.findUnique({
    where: { tokenHash: resumir(token) },
    include: { usuario: { select: { nome: true, email: true, ativo: true } } },
  });

  if (!achado) return { ok: false, motivo: 'inexistente' };
  if (achado.usadoEm) return { ok: false, motivo: 'usado' };
  if (achado.expiraEm.getTime() < Date.now()) return { ok: false, motivo: 'vencido' };
  if (!achado.usuario.ativo) return { ok: false, motivo: 'inativo' };

  return {
    ok: true,
    convite: { nome: achado.usuario.nome, email: achado.usuario.email },
  };
}

/**
 * Gasta o convite e grava a senha.
 *
 * As três escritas vão na MESMA transação de propósito. Se a
 * senha fosse gravada fora dela e a marcação do convite falhasse,
 * o link continuaria valendo depois de usado — que é exatamente
 * o que ele não pode fazer.
 */
export async function usarConvite(
  token: string,
  senha: string,
): Promise<
  | { ok: true; email: string }
  | { ok: false; motivo: MotivoRecusa }
  | { ok: false; motivo: 'fraca'; problemas: string[] }
> {
  const tokenHash = resumir(token);

  const achado = await banco.conviteDeSenha.findUnique({
    where: { tokenHash },
    include: { usuario: { select: { id: true, email: true, ativo: true } } },
  });

  if (!achado) return { ok: false, motivo: 'inexistente' };
  if (achado.usadoEm) return { ok: false, motivo: 'usado' };
  if (achado.expiraEm.getTime() < Date.now()) return { ok: false, motivo: 'vencido' };
  if (!achado.usuario.ativo) return { ok: false, motivo: 'inativo' };

  const problemas = validarForcaSenha(senha);
  if (problemas.length > 0) return { ok: false, motivo: 'fraca', problemas };

  const senhaHash = await gerarHash(senha);

  await banco.$transaction([
    banco.usuario.update({
      where: { id: achado.usuario.id },
      data: { senhaHash, precisaTrocarSenha: false },
    }),
    banco.conviteDeSenha.update({
      where: { tokenHash },
      data: { usadoEm: new Date() },
    }),
    // Entrar com a senha nova derruba o que estava aberto antes.
    // Se o link vazou e alguém o usou, a sessão dele morre aqui.
    banco.sessao.deleteMany({ where: { usuarioId: achado.usuario.id } }),
  ]);

  return { ok: true, email: achado.usuario.email };
}

/** A frase que a tela mostra para cada recusa. */
export const RECUSA_EM_PORTUGUES: Record<MotivoRecusa, string> = {
  inexistente: 'Este link não existe. Confira se ele veio inteiro, sem cortar no fim.',
  usado: 'Este link já foi usado. Se a senha é sua, entre normalmente; se não lembra dela, peça um link novo ao administrador.',
  vencido: 'Este link venceu. Peça um novo ao administrador.',
  inativo: 'Esta conta está desativada. Fale com o administrador.',
};
