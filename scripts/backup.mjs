// ============================================================
//  Cópia de segurança do banco
//
//    npm run backup
//
//  Grava em `backups/portoink-<data>-<hora>.dump`, no formato
//  próprio do Postgres (-Fc): ele comprime sozinho e o
//  `pg_restore` consegue restaurar tabela por tabela se um dia
//  for preciso.
//
//  Roda de dentro do container do banco, então NÃO exige ter o
//  Postgres instalado na máquina: só o Docker.
//
//  A senha vem do .env e nunca aparece na linha de comando —
//  linha de comando fica no histórico do terminal.
// ============================================================

import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, openSync, closeSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PASTA = join(RAIZ, 'backups');

/** Lê o .env sem depender de biblioteca nenhuma. */
function lerEnv() {
  const arquivo = join(RAIZ, '.env');

  if (!existsSync(arquivo)) {
    console.error('\n  Não achei o arquivo .env em ' + RAIZ + '\n');
    process.exit(1);
  }

  const valores = {};
  for (const linha of readFileSync(arquivo, 'utf8').split('\n')) {
    const corte = linha.indexOf('=');
    if (corte === -1 || linha.trimStart().startsWith('#')) continue;
    valores[linha.slice(0, corte).trim()] = linha.slice(corte + 1).trim();
  }

  return valores;
}

/** 2026-09-23-1042 — ordena sozinho quando a pasta é listada. */
function carimbo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return [
    d.getFullYear(), p(d.getMonth() + 1), p(d.getDate()),
  ].join('-') + '-' + p(d.getHours()) + p(d.getMinutes());
}

const env = lerEnv();
const usuario = env.POSTGRES_USER;
const senha = env.POSTGRES_PASSWORD;
const banco = process.argv.includes('--banco')
  ? process.argv[process.argv.indexOf('--banco') + 1]
  : env.POSTGRES_DB;

if (!usuario || !senha || !banco) {
  console.error('\n  Faltam POSTGRES_USER, POSTGRES_PASSWORD ou POSTGRES_DB no .env\n');
  process.exit(1);
}

mkdirSync(PASTA, { recursive: true });
const destino = join(PASTA, 'portoink-' + carimbo() + '.dump');

console.log('\n  Copiando o banco "' + banco + '"...');

// O pg_dump escreve DIRETO no arquivo, por descritor: assim um
// banco grande não precisa caber na memória do Node no caminho.
const saida = openSync(destino, 'w');

const r = spawnSync(
  'docker',
  [
    'compose', 'exec', '-T',
    // A senha entra por variável de ambiente: assim ela não fica
    // no histórico do terminal nem na lista de processos.
    '-e', 'PGPASSWORD=' + senha,
    'db', 'pg_dump', '-U', usuario, '-d', banco, '-Fc',
  ],
  { cwd: RAIZ, stdio: ['ignore', saida, 'pipe'] },
);

closeSync(saida);

if (r.status !== 0) {
  console.error('\n  A cópia falhou:\n' + (r.stderr?.toString() ?? '') + '\n');
  process.exit(1);
}

const tamanho = statSync(destino).size;

// Um dump vazio tem cabeçalho e mais nada. Melhor gritar agora do
// que descobrir no dia em que precisar restaurar.
if (tamanho < 1024) {
  console.error('\n  O arquivo saiu com ' + tamanho + ' bytes — pequeno demais para ser um banco.\n');
  process.exit(1);
}

console.log('  Pronto: ' + destino);
console.log('  Tamanho: ' + (tamanho / 1024 / 1024).toFixed(2) + ' MB\n');
console.log('  Para restaurar:');
console.log('    npm run restaurar -- --arquivo "' + destino + '" --confirmo\n');
