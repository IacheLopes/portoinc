// ============================================================
//  Restauração do banco a partir de uma cópia
//
//    npm run restaurar -- --arquivo backups/portoink-....dump --confirmo
//
//  ISTO APAGA O BANCO ATUAL e põe o da cópia no lugar. Por isso
//  exige `--confirmo` escrito à mão: ninguém restaura um banco
//  por engano ao apertar a seta para cima no terminal.
//
//  Use `--banco outro_nome` para restaurar em um banco separado,
//  sem tocar no que está em uso. É assim que se CONFERE uma cópia
//  sem correr risco nenhum, e é como este script foi testado.
// ============================================================

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join, dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

function opcao(nome) {
  const i = process.argv.indexOf('--' + nome);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  return !v || v.startsWith('--') ? undefined : v;
}

function parar(mensagem) {
  console.error('\n  ' + mensagem + '\n');
  process.exit(1);
}

function lerEnv() {
  const arquivo = join(RAIZ, '.env');
  if (!existsSync(arquivo)) parar('Não achei o arquivo .env em ' + RAIZ);

  const valores = {};
  for (const linha of readFileSync(arquivo, 'utf8').split('\n')) {
    const corte = linha.indexOf('=');
    if (corte === -1 || linha.trimStart().startsWith('#')) continue;
    valores[linha.slice(0, corte).trim()] = linha.slice(corte + 1).trim();
  }
  return valores;
}

/** Roda algo dentro do container do banco. */
function noBanco(senha, argumentos, entrada) {
  return spawnSync(
    'docker',
    ['compose', 'exec', '-T', '-e', 'PGPASSWORD=' + senha, 'db', ...argumentos],
    { cwd: RAIZ, input: entrada, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 512 },
  );
}

const env = lerEnv();
const usuario = env.POSTGRES_USER;
const senha = env.POSTGRES_PASSWORD;
const banco = opcao('banco') ?? env.POSTGRES_DB;
const arquivo = opcao('arquivo');

if (!arquivo) {
  parar(
    'Falta dizer qual cópia restaurar.\n\n' +
      '  Exemplo:\n' +
      '    npm run restaurar -- --arquivo backups/portoink-2026-09-23-1042.dump --confirmo',
  );
}

// Caminho relativo vale a partir de ONDE A PESSOA ESTÁ. Quem roda
// de dentro de scripts/ digita "../backups/...", e isso tem de
// funcionar. A raiz do projeto fica como segunda tentativa.
const tentativas = isAbsolute(arquivo)
  ? [arquivo]
  : [resolve(process.cwd(), arquivo), join(RAIZ, arquivo)];

const caminho = tentativas.find((c) => existsSync(c));

if (!caminho) {
  parar('Não achei o arquivo. Procurei em:\n    ' + tentativas.join('\n    '));
}

if (!process.argv.includes('--confirmo')) {
  parar(
    'Isto APAGA o banco "' + banco + '" e põe no lugar o conteúdo de\n' +
      '  ' + basename(caminho) + ' (' + (statSync(caminho).size / 1024 / 1024).toFixed(2) + ' MB).\n\n' +
      '  Se é isso mesmo, repita o comando com --confirmo no fim.\n' +
      '  Para conferir a cópia sem risco, restaure em outro banco:\n' +
      '    npm run restaurar -- --arquivo ... --banco portoink_conferencia --confirmo',
  );
}

console.log('\n  Restaurando "' + banco + '" a partir de ' + basename(caminho) + '...');

// Derruba as conexões abertas: o Postgres se recusa a apagar um
// banco que alguém está usando, e a API fica conectada nele.
noBanco(senha, [
  'psql', '-U', usuario, '-d', 'postgres', '-c',
  'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ' +
    "'" + banco + "' AND pid <> pg_backend_pid();",
]);

const recriar = noBanco(senha, [
  'psql', '-U', usuario, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
  '-c', 'DROP DATABASE IF EXISTS "' + banco + '";',
  '-c', 'CREATE DATABASE "' + banco + '";',
]);

if (recriar.status !== 0) {
  parar('Não consegui recriar o banco:\n' + recriar.stderr?.toString());
}

const restaurar = noBanco(
  senha,
  ['pg_restore', '-U', usuario, '-d', banco, '--no-owner', '--no-privileges'],
  readFileSync(caminho),
);

if (restaurar.status !== 0) {
  parar('A restauração falhou:\n' + restaurar.stderr?.toString());
}

// Conferência: um banco restaurado sem tabela nenhuma passaria
// silencioso se ninguém olhasse.
const contar = noBanco(senha, [
  'psql', '-U', usuario, '-d', banco, '-tAc',
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';",
]);

const tabelas = Number(contar.stdout?.toString().trim());

if (!tabelas) {
  parar('O banco foi recriado mas ficou sem tabela nenhuma. A cópia não presta.');
}

console.log('  Pronto: ' + tabelas + ' tabelas no banco "' + banco + '".');
console.log('');
console.log('  Reinicie a API para ela reabrir as conexões:');
console.log('    docker compose restart api');
console.log('');
