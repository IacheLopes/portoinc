// ============================================================
//  Subir a versão do sistema
//
//    npm run versao -- 0.18.0
//
//  Existe porque eu já quebrei o `package-lock.json` DUAS vezes
//  fazendo isso na mão: uma substituição cega de "0.16.0" por
//  "0.17.0" acertou também a versão do pdfkit, e depois a do
//  react-refresh. O lock passava a apontar para um pacote que não
//  existe naquela versão, e o `npm ci` do build de produção
//  quebraria — em outro dia, longe da causa.
//
//  Este script mexe SÓ nas duas entradas que são do projeto:
//  a raiz do lock e `packages[""]`. Dependência nenhuma é tocada,
//  porque ele lê o JSON em vez de procurar texto.
// ============================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

const nova = process.argv[2];

if (!nova || !/^\d+\.\d+\.\d+$/.test(nova)) {
  console.error('\n  Uso: npm run versao -- 0.18.0\n');
  process.exit(1);
}

/** package.json: uma linha só, e é a do projeto. */
function subirPacote(caminho) {
  const dados = JSON.parse(readFileSync(caminho, 'utf8'));
  const antes = dados.version;
  dados.version = nova;
  writeFileSync(caminho, JSON.stringify(dados, null, 2) + '\n');
  return antes;
}

/**
 * package-lock.json: SÓ a raiz e `packages[""]`.
 *
 * As outras entradas com "version" são dependências, e mexer nelas
 * é o erro que este script existe para impedir.
 */
function subirLock(caminho) {
  const dados = JSON.parse(readFileSync(caminho, 'utf8'));
  const antes = dados.version;

  dados.version = nova;
  if (dados.packages?.['']) dados.packages[''].version = nova;

  writeFileSync(caminho, JSON.stringify(dados, null, 2) + '\n');
  return antes;
}

/** A versão que aparece no rodapé do menu. */
function subirTela(caminho) {
  const s = readFileSync(caminho, 'utf8');
  const achado = s.match(/versão (\d+\.\d+\.\d+)/);
  if (!achado) throw new Error('nao achei a versao em ' + caminho);

  writeFileSync(caminho, s.replace(achado[0], 'versão ' + nova));
  return achado[1];
}

/** O carimbo no alto de cada documento. */
function subirDoc(caminho) {
  const s = readFileSync(caminho, 'utf8');
  const achado = s.match(/<!-- versao: (\d+\.\d+\.\d+) -->/);
  if (!achado) throw new Error('nao achei o carimbo em ' + caminho);

  writeFileSync(caminho, s.replace(achado[0], '<!-- versao: ' + nova + ' -->'));
  return achado[1];
}

const trabalho = [
  ['backend/package.json', subirPacote],
  ['backend/package-lock.json', subirLock],
  ['frontend/package.json', subirPacote],
  ['frontend/package-lock.json', subirLock],
  ['frontend/src/componentes/Layout.tsx', subirTela],
  ['docs/tutorial/TUTORIAL.md', subirDoc],
  ['docs/testes/GUIA-TESTE-MANUAL.md', subirDoc],
  ['docs/design/DESIGN.md', subirDoc],
  // Nasceu depois e nunca foi cadastrado aqui: ficou para tras em
  // todo bump de versao desde que existe. Visto em 24/09/2026.
  ['docs/navegacao/GUIA-NAVEGACAO.md', subirDoc],
  ['docs/navegacao/GUIA-ALIMENTAR.md', subirDoc],
];

console.log('');

for (const [arquivo, subir] of trabalho) {
  const caminho = join(RAIZ, arquivo);

  if (!existsSync(caminho)) {
    console.log('  (nao existe) ' + arquivo);
    continue;
  }

  const antes = subir(caminho);
  console.log('  ' + String(antes ?? '?').padStart(8) + ' -> ' + nova + '  ' + arquivo);
}

console.log('');
console.log('  Dependência nenhuma foi tocada: o lock foi lido como JSON.');
console.log('');
