// ============================================================
//  Auditoria de hover
//
//  Para cada elemento clicável de cada tela: força o estado
//  :hover pelo protocolo do navegador e compara o estilo antes
//  e depois. Se nada muda, não há retorno visual.
//
//  Confere também o contrário: coisa que NÃO é clicável não
//  deve reagir ao mouse, e coisa clicável precisa de cursor de
//  mão e de foco visível pelo teclado.
//
//   node hover.mjs <pasta> [largura]
// ============================================================
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));

const SAIDA = process.argv[2];
const LARGURA = Number(process.argv[3] ?? 1440);
const PORTA = 9361;

const OBRA = '83fbfc58-1d58-46d7-add8-48270ebdf663';
const SOLICITACAO = 'da72ade4-0c9d-4bec-8348-f911bc04606f';
const COTACAO = 'f5c04aad-add6-4e56-8ff2-fe166f0098be';

const TELAS = [
  ['/', 'inicio'],
  ['/solicitacoes', 'solicitacoes-lista'],
  ['/solicitacoes/nova', 'solicitacoes-nova'],
  ['/solicitacoes/' + SOLICITACAO, 'solicitacoes-detalhe'],
  ['/aprovacoes', 'aprovacoes'],
  ['/cotacoes', 'cotacoes-lista'],
  ['/cotacoes/' + COTACAO, 'cotacoes-detalhe'],
  ['/cotacoes/' + COTACAO + '/equalizacao', 'cotacoes-equalizacao'],
  ['/pedidos', 'pedidos'],
  ['/recebimento', 'recebimento'],
  ['/estoque', 'estoque'],
  ['/estoque/movimentos', 'estoque-movimentos'],
  ['/locacao', 'locacao'],
  ['/financeiro', 'financeiro'],
  ['/financeiro/notas', 'financeiro-notas'],
  ['/relatorios', 'relatorios'],
  ['/relatorios?ver=consumo', 'relatorios-consumo'],
  ['/cadastros', 'cadastros-indice'],
  ['/cadastros/materiais', 'cadastros-materiais'],
  ['/cadastros/fornecedores', 'cadastros-fornecedores'],
  ['/cadastros/obras', 'cadastros-obras'],
  ['/cadastros/obras/' + OBRA, 'cadastros-obra-detalhe'],
  ['/cadastros/alcadas', 'cadastros-alcadas'],
  ['/admin/usuarios', 'admin-usuarios'],
  ['/admin/whatsapp', 'admin-whatsapp'],
  ['/admin/status', 'admin-status'],
  ['/minha-senha', 'minha-senha'],
];

/** Propriedades em que um hover costuma se manifestar. */
const OLHAR = [
  'background-color', 'color', 'border-color', 'opacity',
  'box-shadow', 'text-decoration-line', 'transform',
  // O foco do sistema e um contorno: sem a espessura e o estilo,
  // a mudanca passava despercebida e tudo parecia sem foco.
  'outline-color', 'outline-width', 'outline-style', 'outline-offset',
  'border-bottom-color', 'filter',
  // O hover nem sempre e cor: na rosca engrossa o traco, no link
  // engrossa o sublinhado. Sem estas, os dois pareciam sem hover.
  'stroke-width', 'stroke', 'text-decoration-thickness', 'text-underline-offset',
];

mkdirSync(SAIDA, { recursive: true });

// O perfil do navegador vai para a pasta temporaria do sistema, NAO para
// dentro do projeto: a pasta do projeto e sincronizada pelo OneDrive, e o
// Edge nao consegue subir de dentro dela. E lixo de uma execucao so.
const PERFIL = join(tmpdir(), 'portoink-auditoria-' + PORTA);
rmSync(PERFIL, { recursive: true, force: true });

const edge = spawn(EDGE, [
  '--headless=new', '--remote-debugging-port=' + PORTA, '--no-first-run',
  '--disable-gpu', '--hide-scrollbars',
  '--user-data-dir=' + PERFIL,
  '--window-size=' + LARGURA + ',1000', 'about:blank',
], { stdio: 'ignore' });

for (let i = 0; i < 80; i += 1) {
  try {
    if ((await fetch('http://127.0.0.1:' + PORTA + '/json/version')).ok) break;
  } catch { /* subindo */ }
  await new Promise((r) => setTimeout(r, 300));
}

const alvos = await (await fetch('http://127.0.0.1:' + PORTA + '/json/list')).json();
const ws = new WebSocket(alvos.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });

let proximo = 0;
const pendentes = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pendentes.has(m.id)) {
    const { ok, nao } = pendentes.get(m.id);
    pendentes.delete(m.id);
    if (m.error) nao(new Error(m.error.message)); else ok(m.result);
  }
};

const cdp = (method, params = {}) => {
  proximo += 1;
  const id = proximo;
  return new Promise((ok, nao) => {
    pendentes.set(id, { ok, nao });
    ws.send(JSON.stringify({ id, method, params }));
  });
};

const js = async (e) => {
  const r = await cdp('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Espera um elemento APARECER na tela.
//
// Espera fixa falha justamente no pior momento: container recém
// reiniciado, máquina ocupada. E falha com mensagem que não ajuda.
async function esperarPor(seletor, limite = 40000) {
  const ate = Date.now() + limite;
  while (Date.now() < ate) {
    if (await js('!!document.querySelector(' + JSON.stringify(seletor) + ')')) return true;
    await dormir(200);
  }
  throw new Error('nao apareceu na tela em ' + (limite / 1000) + 's: ' + seletor);
}

// Espera a tela PARAR de carregar antes de medir.
//
// Com espera fixa a regua chegava cedo demais em maquina ocupada e media o
// "Carregando...", acusando falta de titulo em tela que tem titulo. Aqui ela
// pergunta ao navegador se a rodinha (.girando) ja sumiu.
async function esperarCarregar(limite = 20000) {
  const ate = Date.now() + limite;
  while (Date.now() < ate) {
    const pronto = await js("!document.querySelector('.girando')");
    if (pronto) { await dormir(400); return true; }
    await dormir(200);
  }
  return false;
}

await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('DOM.enable');
await cdp('CSS.enable');
await cdp('Emulation.setDeviceMetricsOverride', {
  width: LARGURA, height: 1000, deviceScaleFactor: 1, mobile: false,
});

await cdp('Page.navigate', { url: 'http://localhost:5173/entrar' });
await esperarPor('input[type="password"]');

await js([
  '(() => {',
  "const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;",
  "const campos = [...document.querySelectorAll('input')];",
  "const email = campos.find(c => c.type === 'email') || campos[0];",
  "const senha = campos.find(c => c.type === 'password') || campos[1];",
  "set.call(email, 'admin@portoinc.com.br'); email.dispatchEvent(new Event('input', { bubbles: true }));",
  "set.call(senha, 'Porto@2026'); senha.dispatchEvent(new Event('input', { bubbles: true }));",
  "document.querySelector('form').requestSubmit();",
  '})()',
].join('\n'));

await esperarPor('.menu__lista');

const sessao = await js('!!document.querySelector(".menu__lista")');
if (!sessao) {
  console.error('RECUSADO: nao entrei no sistema.');
  edge.kill();
  process.exit(1);
}

async function estiloDe(nodeId) {
  // Da um instante para o navegador recalcular o estilo. Sem isso,
  // o estado forcado ainda nao valeu quando lemos, e todo elemento
  // parece nao ter hover nenhum.
  await dormir(60);

  const { computedStyle } = await cdp('CSS.getComputedStyleForNode', { nodeId });
  const mapa = {};
  for (const { name, value } of computedStyle) {
    if (OLHAR.includes(name)) mapa[name] = value;
  }
  return mapa;
}

const relatorio = [];

for (const [caminho, nome] of TELAS) {
  await js(
    'history.pushState({}, "", ' + JSON.stringify(caminho) + ');' +
    ' window.dispatchEvent(new PopStateEvent("popstate"));',
  );
  await dormir(500);
  await esperarCarregar();

  // Marca os clicáveis com um atributo para poder achá-los por seletor.
  const quantos = await js(`(() => {
    document.querySelectorAll('[data-auditoria]').forEach((e) => e.removeAttribute('data-auditoria'));
    const vistos = new Set();
    let n = 0;

    const candidatos = [...document.querySelectorAll('main button, main a[href], main [role=tab], main [role=menuitem], main label.opcao, main [tabindex]')];

    // Também qualquer coisa que o CSS marcou como clicável.
    for (const el of document.querySelectorAll('main *')) {
      if (getComputedStyle(el).cursor === 'pointer') candidatos.push(el);
    }

    for (const el of candidatos) {
      if (vistos.has(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (el.disabled) continue;
      vistos.add(el);
      el.setAttribute('data-auditoria', String(n));
      n += 1;
    }
    return n;
  })()`);

  const achados = [];

  for (let i = 0; i < quantos; i += 1) {
    const { root } = await cdp('DOM.getDocument', { depth: -1 });
    const { nodeId } = await cdp('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: '[data-auditoria="' + i + '"]',
    });
    if (!nodeId) continue;

    const antes = await estiloDe(nodeId);

    await cdp('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
    const depois = await estiloDe(nodeId);

    await cdp('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['focus-visible'] });
    const comFoco = await estiloDe(nodeId);

    await cdp('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });

    const mudou = OLHAR.filter((k) => antes[k] !== depois[k]);
    const mudouFoco = OLHAR.filter((k) => antes[k] !== comFoco[k]);

    const info = await js(`(() => {
      const el = document.querySelector('[data-auditoria="${i}"]');
      const r = el.getBoundingClientRect();
      const classe = (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.');
      return JSON.stringify({
        nome: el.tagName.toLowerCase() + (classe ? '.' + classe : ''),
        texto: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 26),
        cursor: getComputedStyle(el).cursor,
        dentroDeClicavel: !!el.parentElement?.closest('button, a[href], [role=menuitem], [role=tab], label'),
      });
    })()`);

    const { nome: tag, texto, cursor, dentroDeClicavel } = JSON.parse(info);

    // Elemento clicável que está DENTRO de outro clicável herda o
    // hover do pai: não precisa ter o seu.
    if (dentroDeClicavel) continue;

    if (mudou.length === 0) {
      achados.push({ tipo: 'SEM_HOVER', alvo: tag + ' "' + texto + '"', cursor });
    }

    if (mudouFoco.length === 0) {
      achados.push({ tipo: 'SEM_FOCO', alvo: tag + ' "' + texto + '"', cursor });
    }

    // 'help' e uma escolha legitima: o cartao de indicador explica
    // um numero em vez de levar a outra tela.
    if (cursor !== 'pointer' && cursor !== 'help') {
      achados.push({ tipo: 'SEM_CURSOR_DE_MAO', alvo: tag + ' "' + texto + '"', cursor });
    }
  }

  relatorio.push({ tela: nome, clicaveis: quantos, achados });

  const resumo = achados.length === 0
    ? 'ok (' + quantos + ' clicaveis)'
    : achados.length + ' de ' + quantos + ': ' + [...new Set(achados.map((a) => a.tipo))].join(', ');

  console.log(nome.padEnd(26), resumo);
}

writeFileSync(SAIDA + '/hover.json', JSON.stringify(relatorio, null, 2));

const porTipo = new Map();
for (const t of relatorio) {
  for (const a of t.achados) {
    const chave = a.tipo + ' :: ' + a.alvo.replace(/ ".*"/, '');
    if (!porTipo.has(chave)) porTipo.set(chave, new Set());
    porTipo.get(chave).add(t.tela);
  }
}

console.log('\n==== RESUMO ====');
for (const [chave, telas] of [...porTipo].sort((a, b) => b[1].size - a[1].size)) {
  console.log(String(telas.size).padStart(3), 'tela(s)', chave);
}

ws.close();
edge.kill();
process.exit(0);
