// ============================================================
//  APOSENTADA — NÃO USE. Está aqui como registro.
//
//  Esta régua nunca conseguiu medir hover de verdade. Foram
//  TRÊS implementações, e a terceira foi a que provou por quê.
//
//  1. `CSS.forcePseudoState` (Design 1)
//     O atalho do DevTools. Instável neste Edge: no mesmo botão
//     detectava a mudança numa execução e não na seguinte.
//     Acusou 16 telas sem hover.
//
//  2. Mouse de verdade, ponto no centro (Design 1)
//     Continuou dando falso positivo, no padrão "3 de 6 sem
//     hover", tela após tela. A causa ficou como suspeita.
//
//  3. Mouse de verdade, com o ponto conferido (Design 8)
//     A suspeita era certa: o centro da caixa pode cair em cima
//     de um filho, de um vizinho, ou de nada. Conferir com
//     `elementFromPoint` resolveu ESSA parte — e ela achou um
//     defeito real, o foco invisível das opções de radio.
//
//     Mas aí entrou o controle ("prove que enxerga antes de
//     acusar"), e ele revelou o problema de baixo:
//
//         controle: MUDOU | :hover casa: false | sob: a.menu__item
//
//     O ponteiro está sobre o elemento certo, o estilo muda —
//     e o navegador NÃO considera o elemento :hover. O que a
//     régua chamava de "hover detectado" era outra coisa
//     mudando de estilo. O controle era, ele mesmo, um falso
//     positivo.
//
//  ----------------------------------------------------------
//  A PISTA, para quem tentar de novo
//
//  Numa sonda isolada o `:hover` CASA de verdade. A diferença
//  medida entre as duas: a sonda usa
//  `Emulation.setDeviceMetricsOverride`, e esta régua sobe o
//  Edge só com `--window-size`. É o primeiro lugar para olhar.
//
//  ----------------------------------------------------------
//  E POR QUE ELA NÃO FICOU LIGADA "POR VIA DAS DÚVIDAS"
//
//  Ferramenta que mente é pior que ferramenta que falta. Uma
//  régua que diz "tudo certo" sobre algo que ela não mede
//  ensina a confiar no silêncio dela.
//
//  Hover fica, então, como a única coisa deste sistema que NÃO
//  é medida. Está escrito, e é melhor assim do que escondido
//  atrás de um verde que não vale nada.
// ============================================================
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { matarOrfaos } from './orfaos.mjs';

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));

const SAIDA = process.argv[2];
const LARGURA = Number(process.argv[3] ?? 1440);
const PORTA = 9361 + (Date.now() % 40) * 10;

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
  ['/admin/avisos?ver=whatsapp', 'admin-avisos-whatsapp'],
  ['/admin/avisos?ver=email', 'admin-avisos-email'],
  ['/admin/status', 'admin-status'],
  ['/minha-senha', 'minha-senha'],
];

/** Propriedades em que um hover costuma se manifestar. */
// Só nomes de propriedade RESOLVIDA, nunca atalho.
//
// `border-color` é atalho: lido pela própria página devolve string
// vazia, e aí todo elemento parecia igual antes e depois. Os quatro
// lados separados sempre respondem.
const OLHAR = [
  'background-color', 'color', 'opacity',
  'box-shadow', 'text-decoration-line', 'transform',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  // O foco do sistema e um contorno: sem a espessura e o estilo,
  // a mudanca passava despercebida e tudo parecia sem foco.
  'outline-color', 'outline-width', 'outline-style', 'outline-offset',
  'filter',
  // O hover nem sempre e cor: na rosca engrossa o traco, no link
  // engrossa o sublinhado. Sem estas, os dois pareciam sem hover.
  'stroke-width', 'stroke', 'text-decoration-thickness', 'text-underline-offset',
];

mkdirSync(SAIDA, { recursive: true });

// O perfil do navegador vai para a pasta temporaria do sistema, NAO para
// dentro do projeto: a pasta do projeto e sincronizada pelo OneDrive, e o
// Edge nao consegue subir de dentro dela. E lixo de uma execucao so.
// Perfil NOVO a cada execucao: apagar o anterior falha quando o
// navegador da rodada passada ainda esta vivo segurando a pasta.
const PERFIL = join(tmpdir(), 'portoink-auditoria-' + PORTA + '-' + Date.now());

// Faxina antes de abrir: medicao interrompida deixa navegador vivo.
matarOrfaos();

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

/**
 * Fecha o navegador DE VERDADE.
 *
 * `edge.kill()` mata só o processo lançado; o Edge se relança num
 * processo separado e sobrevive. Sem isto, cada execução deixava um
 * navegador para trás — chegaram a 76 abertos ao mesmo tempo, e a
 * máquina ficou tão ocupada que a régua passou a medir errado.
 */
async function fecharNavegador() {
  try {
    await cdp('Browser.close');
  } catch {
    /* Já fechou, ou não respondeu: o kill abaixo é a garantia. */
  }

  try { ws.close(); } catch { /* já fechado */ }
  edge.kill();
}

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

// Espera a tela PARAR DE MUDAR antes de medir.
//
// Duas tentativas anteriores falharam aqui, e vale registrar por que:
//
//   1. Espera fixa (2,2s): em maquina ocupada a regua chegava cedo e
//      media o "Carregando...", acusando falta de titulo em tela que
//      tem titulo.
//   2. Esperar a rodinha (.girando) sumir: a rodinha pode ainda NAO
//      TER APARECIDO. Logo depois de trocar de rota o React nao montou
//      nada, nao ha rodinha, e a resposta e "pronto". Telas de dezenas
//      de botoes eram medidas com 2 ou 4.
//
// O que funciona e perguntar se a tela ESTABILIZOU: contar os elementos
// e so medir quando a conta se repete tres vezes seguidas, sem rodinha.
async function esperarAcalmar(limite = 8000) {
  const ate = Date.now() + limite;
  let anterior = -1;
  let iguais = 0;

  while (Date.now() < ate) {
    const estado = JSON.parse(await js(`JSON.stringify({
      carregando: !!document.querySelector('.girando'),
      quantos: document.querySelectorAll('button, a[href], select, input, textarea, [role=tab], [role=menuitem]').length,
      temTitulo: !!document.querySelector('h1'),
    })`));

    if (!estado.carregando && estado.temTitulo && estado.quantos === anterior) {
      iguais += 1;
      if (iguais >= 2) {
        // Um respiro final para transicao de CSS terminar.
        await dormir(250);
        return true;
      }
    } else {
      iguais = 0;
    }

    anterior = estado.quantos;
    await dormir(180);
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
  await fecharNavegador();
  process.exit(1);
}

/**
 * Lê o estilo do elemento pela PRÓPRIA PÁGINA.
 *
 * `getComputedStyle` força o recálculo na hora e enxerga o estado
 * real do elemento — inclusive o `:hover` de um ponteiro de verdade.
 * O caminho do DevTools (`CSS.getComputedStyleForNode` junto com
 * `CSS.forcePseudoState`) se mostrou instável nesta versão do Edge:
 * no mesmo botão detectava a mudança numa execução e não detectava
 * na seguinte.
 */
async function estiloDe(indice) {
  const bruto = await js(`(() => {
    const e = document.querySelector('[data-auditoria="${indice}"]');
    if (!e) return 'null';
    const s = getComputedStyle(e);
    const olhar = ${JSON.stringify(OLHAR)};
    const m = {};
    for (const k of olhar) m[k] = s.getPropertyValue(k);
    return JSON.stringify(m);
  })()`);

  return bruto === 'null' ? null : JSON.parse(bruto);
}

/** Tira o ponteiro de cima de qualquer coisa. */
async function pontaLonge() {
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2, buttons: 0 });
  await dormir(120);
}

const relatorio = [];

for (const [caminho, nome] of TELAS) {
  await js(
    'history.pushState({}, "", ' + JSON.stringify(caminho) + ');' +
    ' window.dispatchEvent(new PopStateEvent("popstate"));',
  );
  await dormir(500);
  await esperarAcalmar();

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

    // Um elemento por TIPO, nao um por elemento.
    //
    // Os 16 botoes "Abrir" de uma tabela sao o MESMO botao repetido:
    // mesma tag, mesmas classes, mesmo CSS. Medir os 16 leva 16 vezes
    // mais tempo para descobrir exatamente a mesma coisa. O que muda
    // o resultado e o TIPO, e um de cada basta.
    const tipos = new Set();

    for (const el of candidatos) {
      if (vistos.has(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (el.disabled) continue;
      // Forma dentro de SVG e geometria de grafico: fatia, barra,
      // ponto. Ela nao recebe foco, e nao precisa — o mesmo dado
      // esta na tabela so-para-leitor-de-tela ao lado do grafico.
      if (el.ownerSVGElement) continue;
      vistos.add(el);

      const tipo = el.tagName + '|' + (el.className || '').toString().trim();
      if (tipos.has(tipo)) continue;
      tipos.add(tipo);

      el.setAttribute('data-auditoria', String(n));
      n += 1;
    }
    return n;
  })()`);

  const achados = [];

  // ----------------------------------------------------------
  //  A PROVA DE CONTROLE
  //
  //  Antes de acusar alguém, a régua mede elementos que TÊM hover de
  //  certeza — botões do sistema, que mudam de cor ao passar o mouse
  //  por regra escrita no CSS.
  //
  //  Se ela não detectar a mudança em NENHUM deles, quem está
  //  quebrado é a régua, e ela cala a boca em vez de acusar a tela.
  //  Foi por não ter isto que ela acusou 16 telas de uma vez e
  //  precisou ser aposentada no Design 1.
  //
  //  Testa VÁRIOS candidatos, e confere o ponto de cada um: o
  //  primeiro controle testava um só, sem conferir se o mouse caía
  //  em cima dele — e deu 21 telas "cegas" que não eram.
  // ----------------------------------------------------------
  const candidatosDeControle = JSON.parse(await js(`(() => {
    const fora = [];

    for (const el of document.querySelectorAll('.botao, .menu__item, .atalho')) {
      if (fora.length >= 5) break;
      // O item ativo do menu já vem com fundo: a mudança do hover
      // nele é pequena demais para servir de controle.
      if (el.classList.contains('menu__item--ativo')) continue;
      if (el.disabled) continue;

      const r = el.getBoundingClientRect();
      if (r.width < 12 || r.height < 12) continue;
      if (r.top < 0 || r.bottom > window.innerHeight) continue;

      const x = Math.round(r.x + r.width / 2);
      const y = Math.round(r.y + r.height / 2);

      // O ponto tem que ACERTAR: sem isto o mouse vai para cima de
      // outra coisa e o controle falha sem ter testado nada.
      const quem = document.elementFromPoint(x, y);
      if (!quem || !(quem === el || el.contains(quem))) continue;

      el.setAttribute('data-controle', String(fora.length));
      fora.push({ x, y, i: fora.length });
    }

    return JSON.stringify(fora);
  })()`));

  let enxerga = candidatosDeControle.length === 0;

  for (const c of candidatosDeControle) {
    const ler = () => js(
      "(() => { const e = document.querySelector('[data-controle=\"" + c.i + "\"]');"
      + ' if (!e) return "";'
      + ' const s = getComputedStyle(e);'
      + " return s.backgroundColor + '|' + s.borderColor + '|' + s.color + '|' + s.boxShadow; })()",
    );

    await pontaLonge();
    const semMouse = await ler();

    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y, buttons: 0 });
    await dormir(320);
    const comMouse = await ler();
    await pontaLonge();

    if (semMouse !== comMouse) { enxerga = true; break; }
  }

  await js("document.querySelectorAll('[data-controle]').forEach((e) => e.removeAttribute('data-controle'))");

  if (!enxerga) {
    console.log(nome.padEnd(28), 'REGUA CEGA NESTA TELA - nao acuso nada');
    relatorio.push({ tela: nome, clicaveis: quantos, cega: true, achados: [] });
    continue;
  }

  for (let i = 0; i < quantos; i += 1) {
    const cru = await js(`(() => {
      const el = document.querySelector('[data-auditoria="${i}"]');
      if (!el) return 'null';
      const r = el.getBoundingClientRect();
      const classe = (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.');
      return JSON.stringify({
        nome: el.tagName.toLowerCase() + (classe ? '.' + classe : ''),
        texto: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 26),
        cursor: getComputedStyle(el).cursor,
        dentroDeClicavel: !!el.parentElement?.closest('button, a[href], [role=menuitem], [role=tab], label'),
        ...(() => {
          // O ponto precisa ACERTAR o elemento.
          //
          // Era o centro, e pronto. Só que o centro pode cair em cima
          // de outra coisa — um filho que cobre, um vizinho por cima,
          // ou nada, quando o elemento tem forma estranha. O mouse ia
          // parar em outro lugar, o hover não aparecia, e a régua
          // acusava "sem hover" num botão que tem hover.
          //
          // Era a suspeita nunca investigada quando ela foi
          // aposentada, e era ela mesma.
          const pontos = [
            [r.x + r.width / 2, r.y + r.height / 2],
            [r.x + r.width * 0.25, r.y + r.height / 2],
            [r.x + r.width * 0.75, r.y + r.height / 2],
            [r.x + r.width / 2, r.y + r.height * 0.25],
          ];

          for (const [px, py] of pontos) {
            if (px < 0 || py < 0 || px > window.innerWidth || py > window.innerHeight) continue;
            const quem = document.elementFromPoint(Math.round(px), Math.round(py));
            if (quem && (quem === el || el.contains(quem))) {
              return { x: Math.round(px), y: Math.round(py), acertou: true };
            }
          }

          return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), acertou: false };
        })(),
        naTela: r.top >= 0 && r.bottom <= window.innerHeight,
      });
    })()`);

    if (cru === 'null') continue;

    const { nome: tag, texto, cursor, dentroDeClicavel, x, y, naTela, acertou } = JSON.parse(cru);

    // Elemento clicável que está DENTRO de outro clicável herda o
    // hover do pai: não precisa ter o seu.
    if (dentroDeClicavel) continue;

    // --- Foco: dado ANTES de mexer o mouse ---
    //
    // `:focus-visible` vale quando o navegador entende que a pessoa
    // está navegando por teclado. Mover o ponteiro primeiro estragaria
    // a leitura.
    await pontaLonge();
    const antes = await estiloDe(i);
    if (!antes) continue;

    await js(`document.querySelector('[data-auditoria="${i}"]')?.focus()`);
    await dormir(120);
    const comFoco = await estiloDe(i);

    await js('document.activeElement?.blur()');
    await dormir(80);

    // --- Hover: com o ponteiro de verdade em cima ---
    let depois = antes;

    if (naTela && acertou) {
      await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
      // A transição do sistema é de 150ms: esperar menos lê a cor no
      // meio do caminho.
      await dormir(320);
      depois = (await estiloDe(i)) ?? antes;
      await pontaLonge();
    }

    const mudou = OLHAR.filter((k) => antes[k] !== depois[k]);
    const mudouFoco = comFoco ? OLHAR.filter((k) => antes[k] !== comFoco[k]) : [];

    // Não consegui pôr o ponteiro em cima dele: outro elemento está
    // na frente, no ponto testado. Aí não dá para afirmar NADA sobre
    // o hover — e inventar um achado aqui foi o que aposentou esta
    // régua da primeira vez.
    if (naTela && !acertou) {
      achados.push({ tipo: 'NAO_CONSEGUI_APONTAR', alvo: tag + ' "' + texto + '"', cursor });
      continue;
    }

    // Elemento fora da parte visível da janela não recebe o ponteiro:
    // não dá para afirmar nada sobre o hover dele.
    if (!naTela) {
      if (mudouFoco.length === 0) {
        achados.push({ tipo: 'SEM_FOCO', alvo: tag + ' "' + texto + '"', cursor });
      }
      continue;
    }

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

await fecharNavegador();
process.exit(0);
