// ============================================================
//  Guarda de senhas
//
//  A senha NUNCA é salva no banco. O que salvamos é um "resumo"
//  (hash) do qual é impossível voltar à senha original.
//
//  Usamos Argon2id, o algoritmo recomendado hoje. Ele é lento e
//  gasta memória de propósito: isso torna inviável para um
//  invasor testar milhões de senhas por segundo.
// ============================================================

import { hash, verify, Algorithm } from '@node-rs/argon2';

// Parâmetros recomendados pela OWASP (2024).
// memoryCost está em KiB: 19456 KiB = 19 MB por verificação.
const OPCOES = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Transforma a senha digitada no resumo que vai para o banco. */
export function gerarHash(senha: string): Promise<string> {
  return hash(senha, OPCOES);
}

/**
 * Confere se a senha digitada corresponde ao resumo salvo.
 * Nunca lança erro: um hash corrompido vira simplesmente "não confere".
 */
export async function conferirSenha(senha: string, hashSalvo: string): Promise<boolean> {
  try {
    return await verify(hashSalvo, senha, OPCOES);
  } catch {
    return false;
  }
}

/**
 * Regras mínimas de senha.
 * Preferimos exigir COMPRIMENTO a exigir símbolos: senha longa e
 * fácil de lembrar protege mais do que senha curta cheia de "@".
 */
export function validarForcaSenha(senha: string): string[] {
  const problemas: string[] = [];

  if (senha.length < 8) {
    problemas.push('A senha precisa ter pelo menos 8 caracteres.');
  }
  if (!/[a-zA-Z]/.test(senha)) {
    problemas.push('A senha precisa ter pelo menos uma letra.');
  }
  if (!/\d/.test(senha)) {
    problemas.push('A senha precisa ter pelo menos um número.');
  }

  return problemas;
}
