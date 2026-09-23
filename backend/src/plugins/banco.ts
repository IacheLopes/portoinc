// ============================================================
//  Conexao com o banco de dados
//
//  Uma unica instancia compartilhada. Abrir varias conexoes
//  desperdicaria memoria, que e escassa no nosso container.
// ============================================================

import { PrismaClient } from '@prisma/client';
import { ambiente } from '../config/ambiente.js';

export const banco = new PrismaClient({
  log: ambiente.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/** Testa se o banco responde. Usado na tela de status. */
export async function bancoResponde(): Promise<boolean> {
  try {
    await banco.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
