// ============================================================
//  Primeiro administrador de uma instalação nova
//
//  Sem isto, um banco recém-criado não deixa NINGUÉM entrar: as
//  funções e permissões vêm nas migrations, mas usuário nenhum
//  vem. Os dois seeds que existem criam contas com senha
//  conhecida e se recusam a rodar em produção — e é bom que se
//  recusem. Este comando é o que fica no lugar deles.
//
//  Como usar:
//
//    npm run criar-admin -- --nome "Maria Souza" --email maria@empresa.com.br
//
//  A senha pode ser passada com --senha. Se não for, o comando
//  sorteia uma e mostra na tela UMA VEZ. Nos dois casos a conta
//  nasce obrigada a trocar a senha no primeiro acesso: quem
//  instalou o sistema não fica sabendo a senha de quem o usa.
// ============================================================

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { gerarHash, validarForcaSenha } from '../src/servicos/senha.js';

const banco = new PrismaClient();

const FUNCAO_ADMINISTRADOR = 'ADMINISTRADOR';

/**
 * Lê `--chave valor` da linha de comando.
 *
 * Nada de biblioteca para isto: são três opções, e uma dependência
 * a mais num comando que roda em produção é uma dependência a mais
 * para manter.
 */
function opcao(nome: string): string | undefined {
  const i = process.argv.indexOf('--' + nome);
  if (i === -1) return undefined;

  // Junta tudo até a próxima opção. Assim `--nome Maria Souza`
  // funciona igual a `--nome "Maria Souza"`: as aspas se perdem
  // quando o comando passa por camadas (npm, docker exec), e um
  // nome virar só o primeiro pedaço é erro silencioso.
  const pedacos: string[] = [];
  for (let j = i + 1; j < process.argv.length; j += 1) {
    if (process.argv[j].startsWith('--')) break;
    pedacos.push(process.argv[j]);
  }

  return pedacos.length > 0 ? pedacos.join(' ') : undefined;
}

function temOpcao(nome: string): boolean {
  return process.argv.includes('--' + nome);
}

/**
 * Sorteia uma senha legível: sem I, l, O e 0, que ninguém consegue
 * ditar por telefone sem errar.
 */
function sortearSenha(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const numeros = '23456789';
  const alfabeto = letras + numeros;

  const bytes = randomBytes(16);
  let senha = '';
  for (const b of bytes) senha += alfabeto[b % alfabeto.length];

  // Garante uma letra e um número, que são as regras do sistema.
  return senha.slice(0, 14) + letras[randomBytes(1)[0] % letras.length]
    + numeros[randomBytes(1)[0] % numeros.length];
}

function parar(mensagem: string): never {
  console.error('');
  console.error('  ' + mensagem);
  console.error('');
  process.exit(1);
}

async function principal() {
  const nome = opcao('nome');
  const email = opcao('email')?.trim().toLowerCase();
  const senhaEscolhida = opcao('senha');
  const forcar = temOpcao('forcar');

  if (!nome || !email) {
    parar(
      'Faltou o nome ou o e-mail.\n\n' +
        '  Exemplo:\n' +
        '    npm run criar-admin -- --nome "Maria Souza" --email maria@empresa.com.br',
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    parar('"' + email + '" não parece um e-mail.');
  }

  // A função precisa existir. Se não existir, as migrations não
  // rodaram — e criar o usuário agora só esconderia esse problema.
  const funcao = await banco.funcao.findUnique({
    where: { codigo: FUNCAO_ADMINISTRADOR },
  });

  if (!funcao) {
    parar(
      'A função ADMINISTRADOR não existe no banco.\n' +
        '  As migrations ainda não rodaram. Rode antes:\n' +
        '    npm run prisma:migrate',
    );
  }

  const jaExiste = await banco.usuario.findUnique({ where: { email } });
  if (jaExiste) {
    parar('Já existe um usuário com o e-mail ' + email + '.');
  }

  // Este comando é para instalação NOVA. Num sistema em uso, quem
  // cria usuário é a tela de administração, onde fica registrado
  // quem criou quem.
  const quantosAdmins = await banco.usuario.count({
    where: { funcoes: { some: { funcaoId: funcao.id } } },
  });

  if (quantosAdmins > 0 && !forcar) {
    parar(
      'Este sistema já tem ' + quantosAdmins + ' administrador(es).\n' +
        '  Crie o próximo pela tela de Administração, que registra quem criou.\n' +
        '  Se for mesmo necessário por aqui, repita com --forcar.',
    );
  }

  const senha = senhaEscolhida ?? sortearSenha();
  const problemas = validarForcaSenha(senha);

  if (problemas.length > 0) {
    parar('A senha não serve:\n    - ' + problemas.join('\n    - '));
  }

  await banco.usuario.create({
    data: {
      nome,
      email,
      senhaHash: await gerarHash(senha),
      ativo: true,
      // Sempre. Nem quem instalou o sistema fica sabendo a senha
      // com que a pessoa vai trabalhar.
      precisaTrocarSenha: true,
      funcoes: { create: [{ funcaoId: funcao.id }] },
    },
  });

  console.log('');
  console.log('  Administrador criado.');
  console.log('');
  console.log('    Nome:   ' + nome);
  console.log('    E-mail: ' + email);

  if (!senhaEscolhida) {
    console.log('    Senha:  ' + senha);
    console.log('');
    console.log('  Anote agora: esta senha não aparece de novo.');
  }

  console.log('');
  console.log('  No primeiro acesso o sistema pede para trocar a senha.');
  console.log('');
}

principal()
  .catch((erro) => {
    console.error('');
    console.error('  Não foi possível criar o administrador:', erro);
    console.error('');
    process.exit(1);
  })
  .finally(() => banco.$disconnect());
