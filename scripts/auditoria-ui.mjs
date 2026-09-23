// ============================================================
//  Auditoria de UI: mede, não olha.
//
//  Percorre todas as telas e devolve uma lista de problemas
//  MEDIDOS: rolagem horizontal, controles desalinhados na barra
//  de ações, alvo de toque pequeno demais, texto estourando a
//  caixa, cartões de alturas diferentes na mesma fileira.
//
//   node auditoria.mjs <pasta> <largura> [conta]
// ============================================================
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const SAIDA = process.argv[2];
const LARGURA = Number(process.argv[3] ?? 1440);
const CONTA = process.argv[4] ?? 'admin@portoinc.com.br';
const ALTURA = 1000;
const PORTA = 9340 + (LARGURA % 7);

const OBRA = '83fbfc58-1d58-46d7-add8-48270ebdf663';
const SOLICITACAO = 'da72ade4-0c9d-4bec-8348-f911bc04606f';
const COTACAO = 'f5c04aad-add6-4e56-8ff2-fe166f0098be';
const PEDIDO = '17';

const TELAS = [
  ['/', 'inicio'],
  ['/solicitacoes', 'solicitacoes-lista'],
  ['/solicitacoes/nova', 'solicitacoes-nova'],
  ['/solicitacoes/' + SOLICITACAO, 'solicitacoes-detalhe'],
  ['/aprovacoes', 'aprovacoes'],
  ['/cotacoes', 'cotacoes-lista'],
  ['/cotacoes/nova', 'cotacoes-nova'],
  ['/cotacoes/' + COTACAO, 'cotacoes-detalhe'],
  ['/cotacoes/' + COTACAO + '/equalizacao', 'cotacoes-equalizacao'],
  ['/pedidos', 'pedidos'],
  ['/recebimento', 'recebimento'],
  ['/recebimento/' + PEDIDO, 'recebimento-conferir'],
  ['/estoque', 'estoque'],
  ['/estoque/movimentos', 'estoque-movimentos'],
  ['/locacao', 'locacao'],
  ['/financeiro', 'financeiro'],
  ['/financeiro/notas', 'financeiro-notas'],
  ['/relatorios', 'relatorios-orcamento'],
  ['/relatorios?ver=economia', 'relatorios-economia'],
  ['/relatorios?ver=fornecedores', 'relatorios-fornecedores'],
  ['/relatorios?ver=tempos', 'relatorios-tempos'],
  ['/relatorios?ver=consumo', 'relatorios-consumo'],
  ['/cadastros', 'cadastros-indice'],
  ['/cadastros/familias', 'cadastros-familias'],
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
  '--window-size=' + LARGURA + ',' + ALTURA, 'about:blank',
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
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error(d.text + ' :: ' + (d.exception?.description ?? '').slice(0, 200));
  }
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
await cdp('Emulation.setDeviceMetricsOverride', {
  width: LARGURA, height: ALTURA, deviceScaleFactor: 1, mobile: LARGURA < 700,
});

await cdp('Page.navigate', { url: 'http://localhost:5173/entrar' });
await esperarPor('input[type="password"]');

await js([
  '(() => {',
  "const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;",
  "const campos = [...document.querySelectorAll('input')];",
  "const email = campos.find(c => c.type === 'email') || campos[0];",
  "const senha = campos.find(c => c.type === 'password') || campos[1];",
  'set.call(email, ' + JSON.stringify(CONTA) + '); email.dispatchEvent(new Event("input", { bubbles: true }));',
  "set.call(senha, 'Porto@2026'); senha.dispatchEvent(new Event('input', { bubbles: true }));",
  "document.querySelector('form').requestSubmit();",
  '})()',
].join('\n'));

await esperarPor('.menu__lista');

// Trava: se o login nao pegou, TODAS as telas viram a pagina de
// entrada e a auditoria devolve um 'ok' que nao vale nada.
const entrou = await js('JSON.stringify({ rota: location.pathname, temMenu: !!document.querySelector(".menu__lista") })');
if (!JSON.parse(entrou).temMenu) {
  console.error('RECUSADO: nao consegui entrar no sistema. Sem sessao, a auditoria mediria a tela de login 33 vezes.');
  edge.kill();
  process.exit(1);
}

// ------------------------------------------------------------
//  A régua, executada dentro da página
// ------------------------------------------------------------
const MEDIR = `(() => {
  const achados = [];
  const larguraTela = window.innerWidth;
  const nomear = (el) => {
    const classe = (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.');
    const texto = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
    return el.tagName.toLowerCase() + (classe ? '.' + classe : '') + (texto ? ' "' + texto + '"' : '');
  };

  // 1. Rolagem horizontal da página inteira.
  const largura = document.documentElement.scrollWidth;
  if (largura > larguraTela + 1) {
    const culpados = [...document.querySelectorAll('main *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > larguraTela + 1;
      })
      .slice(0, 4)
      .map((el) => nomear(el) + ' (vai ate ' + Math.round(el.getBoundingClientRect().right) + 'px)');

    achados.push({ tipo: 'ROLAGEM_HORIZONTAL', detalhe: largura + 'px numa tela de ' + larguraTela + 'px', culpados });
  }

  // 2. Barra de ações: controles com bases diferentes.
  for (const barra of document.querySelectorAll('.barra-acoes')) {
    const controles = [...barra.children]
      .map((filho) => filho.matches('.campo') ? filho.querySelector('.campo__entrada, .campo__area') : filho)
      .filter((el) => el && el.getBoundingClientRect().height > 0);

    if (controles.length < 2) continue;

    const soControles = controles.every((el) => el.matches('input, select, textarea, button, .botao, .baixar'));
    const medida = (el) => {
      const r = el.getBoundingClientRect();
      return Math.round(soControles ? r.bottom : r.top + r.height / 2);
    };
    const bases = controles.map(medida);
    const topos = controles.map((el) => Math.round(el.getBoundingClientRect().top));

    // Só vale como desalinhamento se os controles realmente se
    // sobrepuserem na vertical. Comparar por 'tops parecidos' dava
    // falso positivo no celular, onde eles empilham.
    const fundos = controles.map((el) => Math.round(el.getBoundingClientRect().bottom));
    const mesmaFileira = Math.min(...fundos) > Math.max(...topos);
    const desvio = Math.max(...bases) - Math.min(...bases);

    if (mesmaFileira && desvio > 2) {
      achados.push({
        tipo: 'BARRA_ACOES_DESALINHADA',
        detalhe: desvio + 'px de diferenca na base',
        culpados: controles.map((el, i) => nomear(el) + ' base=' + bases[i]),
      });
    }
  }

  // 3. Alvo de toque pequeno demais (WCAG: 44px).
  const pequenos = [...document.querySelectorAll('button, a.botao, a.atalho, input, select, textarea, [role=menuitem], [role=tab]')]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      if (el.closest('.apenas-leitor-tela') || el.classList.contains('apenas-leitor-tela')) return false;
      // Checkbox e radio: quem recebe o toque e o rotulo em volta.
      if (el.matches('input[type=checkbox], input[type=radio]')) return false;
      return r.height > 0 && r.width > 0 && r.height < 44 && !el.closest('.menu__lista');
    })
    .map((el) => nomear(el) + ' h=' + Math.round(el.getBoundingClientRect().height));

  if (pequenos.length > 0) {
    achados.push({ tipo: 'ALVO_PEQUENO', detalhe: pequenos.length + ' elemento(s)', culpados: pequenos.slice(0, 8) });
  }

  // 4. Texto estourando a caixa.
  const estourando = [...document.querySelectorAll('main *')]
    .filter((el) => {
      if (el.children.length > 0) return false;
      // SVG nao recorta texto, e scrollWidth ali nao quer dizer nada.
      if (el.ownerSVGElement || el.closest('svg')) return false;
      if (el.closest('.apenas-leitor-tela') || el.classList.contains('apenas-leitor-tela')) return false;
      const estilo = getComputedStyle(el);
      if (estilo.overflowX !== 'visible' && estilo.overflowX !== 'clip') return false;
      return el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0;
    })
    .slice(0, 6)
    .map((el) => nomear(el) + ' (' + el.scrollWidth + ' > ' + el.clientWidth + ')');

  if (estourando.length > 0) {
    achados.push({ tipo: 'TEXTO_ESTOURANDO', detalhe: estourando.length + ' elemento(s)', culpados: estourando });
  }

  // 5. Cartões de alturas diferentes na mesma fileira de uma grade.
  for (const grade of document.querySelectorAll('.grade, .painel-financeiro, .painel-relatorio')) {
    const filhos = [...grade.children].filter((el) => el.getBoundingClientRect().height > 0);
    const fileiras = new Map();

    for (const el of filhos) {
      const r = el.getBoundingClientRect();
      const chave = Math.round(r.top / 8) * 8;
      if (!fileiras.has(chave)) fileiras.set(chave, []);
      fileiras.get(chave).push({ el, h: Math.round(r.height) });
    }

    for (const [, itens] of fileiras) {
      if (itens.length < 2) continue;
      const alturas = itens.map((i) => i.h);
      const desvio = Math.max(...alturas) - Math.min(...alturas);

      if (desvio > 2) {
        achados.push({
          tipo: 'CARTOES_DESIGUAIS',
          detalhe: desvio + 'px de diferenca em ' + (grade.className || 'grade'),
          culpados: itens.map((i) => nomear(i.el) + ' h=' + i.h),
        });
      }
    }
  }

  // 6. Cabeçalho de página: toda tela precisa de um h1.
  const h1 = document.querySelectorAll('main h1, .conteudo h1, h1');
  if (h1.length === 0) achados.push({ tipo: 'SEM_H1', detalhe: 'a tela nao tem titulo', culpados: [] });
  if (h1.length > 1) achados.push({ tipo: 'MAIS_DE_UM_H1', detalhe: h1.length + ' titulos', culpados: [...h1].map(nomear) });

  // 6b. Campo de formulário sem nome acessível.
  const semNome = [...document.querySelectorAll('main input, main select, main textarea')]
    .filter((el) => {
      if (el.type === 'hidden' || el.closest('.apenas-leitor-tela')) return false;
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
      if (el.closest('label')) return false;
      if (el.id && [...document.querySelectorAll('label[for]')].some((l) => l.htmlFor === el.id)) return false;
      return true;
    })
    .map((el) => nomear(el) + (el.placeholder ? ' (so placeholder:  + el.placeholder.slice(0, 30) + )' : ' (sem nada)'));

  if (semNome.length > 0) {
    achados.push({ tipo: 'CAMPO_SEM_ROTULO', detalhe: semNome.length + ' campo(s)', culpados: semNome.slice(0, 6) });
  }

  // 7. Botões sem texto acessível.
  const mudos = [...document.querySelectorAll('button')]
    .filter((b) => !(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title'))
    .map(nomear);

  if (mudos.length > 0) {
    achados.push({ tipo: 'BOTAO_SEM_NOME', detalhe: mudos.length + ' botao(oes)', culpados: mudos.slice(0, 5) });
  }

  // 8. Tabela sem legenda para leitor de tela.
  const semLegenda = [...document.querySelectorAll('table')]
    .filter((t) => !t.querySelector('caption') && !t.getAttribute('aria-label'))
    .map(nomear);

  if (semLegenda.length > 0) {
    achados.push({ tipo: 'TABELA_SEM_LEGENDA', detalhe: semLegenda.length + ' tabela(s)', culpados: semLegenda.slice(0, 3) });
  }

  return JSON.stringify({
    achados,
    estado: {
      vazio: !!document.querySelector('.estado'),
      linhas: document.querySelectorAll('tbody tr').length,
      titulo: (document.querySelector('h1') || {}).textContent || '(sem h1)',
    },
  });
})()`;

const relatorio = [];

for (const [caminho, nome] of TELAS) {
  try {
    await js(
      'history.pushState({}, "", ' + JSON.stringify(caminho) + ');' +
      ' window.dispatchEvent(new PopStateEvent("popstate"));',
    );
    await dormir(500);
    await esperarCarregar();

    const bruto = await js(MEDIR);
    const { achados, estado } = JSON.parse(bruto);

    const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    writeFileSync(SAIDA + '/' + nome + '.png', Buffer.from(data, 'base64'));

    relatorio.push({ tela: nome, caminho, estado, achados });

    const resumo = achados.length === 0 ? 'ok' : achados.map((a) => a.tipo).join(', ');
    console.log(nome.padEnd(28), resumo);
  } catch (e) {
    relatorio.push({ tela: nome, caminho, erro: String(e.message).slice(0, 160) });
    console.log(nome.padEnd(28), 'ERRO:', String(e.message).slice(0, 90));
  }
}

writeFileSync(SAIDA + '/achados.json', JSON.stringify(relatorio, null, 2));

const porTipo = new Map();
for (const t of relatorio) {
  for (const a of t.achados ?? []) {
    if (!porTipo.has(a.tipo)) porTipo.set(a.tipo, []);
    porTipo.get(a.tipo).push(t.tela);
  }
}

console.log('\n==== RESUMO (' + LARGURA + 'px) ====');
for (const [tipo, telas] of [...porTipo].sort((a, b) => b[1].length - a[1].length)) {
  console.log(tipo.padEnd(28), telas.length + ' tela(s):', [...new Set(telas)].slice(0, 8).join(', '));
}

ws.close();
edge.kill();
process.exit(0);
