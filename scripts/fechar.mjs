// ============================================================
//  Fechar uma etapa
//
//    npm run fechar
//
//  Roda TUDO o que uma etapa precisa para ser dada como pronta, e
//  devolve uma tabela só. Existe porque fechar etapa virava cinco
//  comandos disparados um a um, com uma espera entre cada — e a
//  espera somada era maior que o trabalho.
//
//  EM FILA, NÃO EM PARALELO.
//
//  A primeira versão rodava tudo junto. Medido: passou de 10
//  minutos sem terminar, contra ~4 em fila. A máquina tem poucos
//  núcleos e os containers estão limitados a 1 CPU cada; dois
//  navegadores headless mais duas chamadas ao Docker se atropelam
//  e todo mundo fica mais lento.
//
//  O ganho aqui nunca foi paralelismo: é disparar UM comando em vez
//  de cinco, e esperar uma vez em vez de cinco.
// ============================================================

import { spawn, execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(RAIZ, 'scripts');

const TUDO = process.argv.includes('--tudo');

/**
 * O backend mudou desde o último marco?
 *
 * As 325 provas de integração levam ~2,5 minutos e apagam o banco de
 * teste. Numa etapa de design elas rodam para confirmar que nada
 * mudou — e nada mudou mesmo, porque design não toca em backend.
 *
 * Com `--tudo` ele roda de qualquer jeito. E quando o git não
 * responde (pasta sem repositório, por exemplo), roda também: na
 * dúvida, conferir.
 */
function backendMudou() {
  if (TUDO) return true;

  try {
    const marco = execSync('git describe --tags --abbrev=0', { cwd: RAIZ })
      .toString()
      .trim();

    const desdeOMarco = execSync('git diff --name-only ' + marco + ' -- backend/', { cwd: RAIZ })
      .toString()
      .trim();

    const naoSalvo = execSync('git status --porcelain -- backend/', { cwd: RAIZ })
      .toString()
      .trim();

    return Boolean(desdeOMarco || naoSalvo);
  } catch {
    return true;
  }
}

/** Tira os códigos de cor da saída, senão nenhum padrão casa nela. */
function semCor(texto) {
  // eslint-disable-next-line no-control-regex
  return texto.replace(/\u001b\[[0-9;]*m/g, '');
}

function rodar(nome, comando, argumentos, pasta = RAIZ) {
  return new Promise((ok) => {
    const inicio = Date.now();
    // Comando numa string só: passar lista COM `shell: true` gera
    // aviso de depreciação, porque os argumentos não são escapados.
    const p = spawn([comando, ...argumentos].join(' '), { cwd: pasta, shell: true });

    let saida = '';
    p.stdout.on('data', (d) => { saida += d; });
    p.stderr.on('data', (d) => { saida += d; });

    p.on('close', (codigo) => {
      ok({
        nome,
        codigo,
        saida,
        segundos: Math.round((Date.now() - inicio) / 1000),
      });
    });
  });
}

/** Tira do monte de saída a linha que interessa. */
function resumir(bruto) {
  const r = { ...bruto, saida: semCor(bruto.saida) };

  if (r.nome.startsWith('Alinhamento')) {
    // A régua imprime o resumo no fim; vazio embaixo dele = nada achado.
    const depois = r.saida.split(/==== RESUMO[^=]*====/)[1] ?? '';
    const achados = depois.split('\n').map((l) => l.trim()).filter(Boolean);
    return achados.length === 0 ? 'sem achados' : achados.length + ' tipo(s) de achado';
  }

  if (r.nome === 'Provas de tela') {
    const m = r.saida.match(/Tests\s+(\d+) passed/);
    return m ? m[1] + ' provas' : 'nao entendi a saida';
  }

  if (r.nome === 'Provas do backend') {
    const passes = [...r.saida.matchAll(/^ℹ pass (\d+)$/gm)].map((m) => Number(m[1]));
    const falhas = [...r.saida.matchAll(/^ℹ fail (\d+)$/gm)].map((m) => Number(m[1]));
    const soma = passes.reduce((a, b) => a + b, 0);
    const ruins = falhas.reduce((a, b) => a + b, 0);
    return soma + ' provas' + (ruins > 0 ? ', ' + ruins + ' FALHANDO' : '');
  }

  if (r.nome === 'Conferidor de padrão') {
    return r.codigo === 0 ? 'aprovado' : 'REPROVADO';
  }

  if (r.nome === 'Tipos') {
    return r.codigo === 0 ? 'compila' : 'NAO COMPILA';
  }

  return r.codigo === 0 ? 'ok' : 'falhou';
}

const FILA = [
  ['Tipos', 'docker', ['compose', 'exec', '-T', 'web', 'npx', 'tsc', '-b', '--noEmit'], RAIZ],
  ['Conferidor de padrão', 'node', ['padrao.mjs'], SCRIPTS],
  ['Provas de tela', 'docker', ['compose', 'exec', '-T', 'web', 'npm', 'test'], RAIZ],
  ['Alinhamento 1440px', 'node', ['auditoria-ui.mjs', './auditoria', '1440'], SCRIPTS],
  ['Alinhamento 420px', 'node', ['auditoria-ui.mjs', './auditoria-celular', '420'], SCRIPTS],
  // As provas de integração do backend APAGAM o banco de teste.
  // Nunca podem dividir a vez com nada que toque nele.
  ['Provas do backend', 'docker', ['compose', 'exec', '-T', 'api', 'npm', 'test'], RAIZ],
];

const rodarBackend = backendMudou();

console.log('  Fechando a etapa. São ' + FILA.length + ' passos, em fila.\n');

const tudo = [];

for (const [nome, comando, argumentos, pasta] of FILA) {
  if (nome === 'Provas do backend' && !rodarBackend) {
    console.log('  ' + nome.padEnd(24) + 'pulado   nada mudou em backend/ desde o último marco');
    continue;
  }

  process.stdout.write('  ' + nome.padEnd(24) + '... ');
  const r = await rodar(nome, comando, argumentos, pasta);
  console.log(r.segundos + 's  ' + resumir(r));
  tudo.push(r);
}

console.log('');

const ruins = tudo.filter((r) => r.codigo !== 0);
const total = tudo.reduce((s, r) => s + r.segundos, 0);

console.log('  Total: ' + Math.floor(total / 60) + 'min ' + (total % 60) + 's');
console.log('');

if (ruins.length > 0) {
  console.log('  REPROVADO em: ' + ruins.map((r) => r.nome).join(', '));
  console.log('');

  for (const r of ruins) {
    console.log('  --- ' + r.nome + ' ---');
    console.log(r.saida.split('\n').slice(-25).join('\n'));
    console.log('');
  }

  process.exit(1);
}

console.log('  Tudo verde. A etapa pode fechar.');
console.log('');
