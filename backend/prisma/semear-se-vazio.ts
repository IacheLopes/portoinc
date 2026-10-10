// ============================================================
//  Semear só quando o banco está vazio
//
//  A semente usa `upsert`, e o container de desenvolvimento a
//  rodava A CADA SUBIDA. Comodidade boa — clona e sobe —, com
//  um efeito que ninguém tinha visto até a simulação de entrega
//  de 09/10/2026:
//
//    · a empresa apaga as contas de teste e cadastra as dela;
//    · alguém reinicia a API;
//    · as 8 contas com senha conhecida voltam, junto com 20
//      materiais, 6 fornecedores e 3 obras que ela não cadastrou.
//
//  O estágio de produção do Dockerfile nunca semeou, e está
//  certo. Aqui o meio-termo: a comodidade continua para quem
//  sobe um banco novo, e some para quem já tem dado dentro.
//
//  "Vazio" é não haver NENHUM usuário. Funções e permissões não
//  contam: elas vêm das migrações, e existem mesmo num banco
//  recém-criado.
// ============================================================

import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

const banco = new PrismaClient();

async function principal() {
  const quantos = await banco.usuario.count();

  if (quantos > 0) {
    console.log(
      '  [semente] O banco já tem ' + quantos + ' usuário(s). Nada foi plantado.',
    );
    console.log('  [semente] Para plantar de novo: docker compose down -v && docker compose up -d');
    return;
  }

  console.log('  [semente] Banco vazio. Plantando os dados de desenvolvimento...');

  // CADA SEMENTE NO PRÓPRIO PROCESSO, como sempre foi.
  //
  // As duas se executam sozinhas ao serem importadas e cada uma
  // fecha a própria conexão com o banco no fim. Importar as duas
  // aqui faria a segunda começar enquanto a primeira ainda roda,
  // e a desconexão de uma derrubaria a outra no meio.
  await banco.$disconnect();
  execSync('npm run seed', { stdio: 'inherit' });
}

principal()
  .catch((erro) => {
    console.error('  [semente] Falhou:', erro);
    process.exit(1);
  })
  .finally(() => void banco.$disconnect());
