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
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { matarOrfaos } from './orfaos.mjs';
import { fileURLToPath } from 'node:url';

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const SAIDA = process.argv[2];
const LARGURA = Number(process.argv[3] ?? 1440);
// A conta é o quarto argumento, mas só se não for uma bandeira:
// `--sem-print` caía nessa posição e virava o e-mail do login.
const QUARTO = process.argv[4];
const CONTA = QUARTO && !QUARTO.startsWith('--') ? QUARTO : 'porto@dev.com';
// A senha estava cravada aqui dentro. Em 27/09/2026 o dono trocou a
// senha do admin durante a validacao e a regua parou de entrar, sem
// dizer por que: ela so reclamava que o menu nao apareceu.
//
//   SENHA_AUDITORIA=... node auditoria-ui.mjs <pasta> <largura> [conta]
//  A CONTA DEV E O PADRAO PORQUE E A QUE ENXERGA TUDO.
//
//  A lista de telas inclui "Status do sistema", que saiu da vista
//  de todo mundo no commit b38e9f5 e hoje so abre para a DEV. Com
//  o administrador no lugar dela, essa tela vinha em branco.
//
//  E o padrao antigo (admin@portoinc.com.br + Porto@2026) nao
//  entrava: a conta do administrador e a UNICA cuja senha e
//  `admin123` — as seis de papel usam Porto@2026. A regua morria
//  com "nao apareceu .menu__lista em 40s", mensagem que manda
//  procurar defeito na barra lateral.
const SENHA = process.env.SENHA_AUDITORIA ?? 'admin123';
// Medir sem fotografar: o print e a parte cara, e so serve quando
// eu vou OLHAR o resultado.
const SEM_PRINT = process.argv.includes('--sem-print');
const ALTURA = 1000;
const PORTA = 9340 + (LARGURA % 7) + (Date.now() % 40) * 10;

// OS EXEMPLOS NAO PODEM SER CRAVADOS
//
// Estes quatro ids ficavam escritos a mao aqui dentro. Em 28/09/2026
// tres deles ja nao existiam no banco, e as telas de detalhe
// responderam "NAO CARREGOU" — o mesmo jeito de falhar da senha, no
// dia anterior: a regua envelhece calada e ninguem nota.
//
// Agora ela pergunta a API qual e o primeiro de cada coisa. Se a API
// nao responder, seguimos com o que da: as telas de detalhe caem,
// mas as outras 30 continuam sendo medidas.
const API = process.env.API_AUDITORIA ?? 'http://localhost:3000';

/**
 * Onde o sistema está servindo.
 *
 * Em desenvolvimento é o Vite, na 5173. Mas a pilha de PRODUÇÃO
 * sobe na 8080, servida por Nginx — e medir a tela que a empresa
 * vai receber exige poder apontar para lá. Era endereço fixo até
 * 10/10/2026, quando a imagem de produção foi construída pela
 * primeira vez.
 */
const SITE = process.env.SITE_AUDITORIA ?? 'http://localhost:5173';

async function descobrirExemplos() {
  const vazio = { OBRA: '', SOLICITACAO: '', COTACAO: '', PEDIDO: '', PEDIDO_ID: '' };

  try {
    const entrada = await fetch(API + '/api/autenticacao/entrar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: CONTA, senha: SENHA }),
    });

    if (!entrada.ok) return vazio;

    const { token } = await entrada.json();
    const cracha = { headers: { authorization: 'Bearer ' + token } };

    const ler = async (rota, caminho) => {
      const r = await fetch(API + rota, cracha);
      if (!r.ok) return '';
      const corpo = await r.json();
      const lista = caminho.split('.').reduce((o, k) => o?.[k], corpo);
      return lista?.[0] ?? null;
    };

    const pedido = await ler('/api/pedidos', 'pedidos');

    return {
      OBRA: (await ler('/api/obras', 'obras'))?.id ?? '',
      SOLICITACAO: (await ler('/api/solicitacoes', 'solicitacoes'))?.id ?? '',
      COTACAO: (await ler('/api/cotacoes', 'cotacoes'))?.id ?? '',
      // A tela de conferencia quer o numero cru, e a lista so
      // devolve "PC-00001".
      PEDIDO: (pedido?.numeroFormatado ?? '').replace(/\D/g, ''),
      PEDIDO_ID: pedido?.id ?? '',
    };
  } catch {
    return vazio;
  }
}

const exemplos = await descobrirExemplos();

// Para olhar UMA solicitacao especifica — a que esta no estado que
// eu quero fotografar, e nao a primeira da lista:
//
//   SOLICITACAO_AUDITORIA=<id> node auditoria-ui.mjs ...
const { OBRA, PEDIDO, PEDIDO_ID } = exemplos;
const SOLICITACAO = process.env.SOLICITACAO_AUDITORIA ?? exemplos.SOLICITACAO;

// Idem para a cotacao: o botao de convidar so existe com o pacote
// ABERTO, e a primeira da lista nem sempre esta.
const COTACAO_ESCOLHIDA = process.env.COTACAO_AUDITORIA ?? exemplos.COTACAO;

// Cada tela diz QUEM a desenha.
//
// Serve para o `--so-mudadas`: com o arquivo em mãos, a régua
// pergunta ao git o que mexeu e mede só as telas afetadas. Sem isto
// ela teria de adivinhar pelo nome da rota, e adivinhar aqui é
// deixar defeito passar.
//
// Quando uma tela é desenhada por mais de um arquivo, estão todos
// listados — Avisos, por exemplo, é uma casca com duas abas dentro.
const PG = 'frontend/src/paginas/';

// O QUE ESTA LISTA NAO COBRE, e por que
//
// `/portal/:token` — o portal do fornecedor. A regua faz login e
// percorre rotas fixas; o portal e publico e o endereco depende de um
// token que so existe com uma cotacao ABERTA e um convite dentro
// dela. Nao da para cravar aqui.
//
// O preco disso foi cobrado em 27/09/2026: o portal rolava para os
// lados em 393px (um `<fieldset>` com 470px de largura, porque
// fieldset nao encolhe sozinho) e ninguem viu, porque a unica tela
// que gente de fora usa e justamente a que a regua nao mede.
//
// Ate a regua saber montar uma cotacao de mentira, o portal se mede
// A MAO — ha um caso proprio no guia de teste manual (CT-84).
//
// `/senha/:token` — o convite de senha, nascido em 10/10/2026, tem o
// MESMO problema e metade da solucao. O estado de RECUSA ("este link
// nao existe") nao depende de token nenhum e entra na lista abaixo.
// O FORMULARIO depende de um convite vivo, e por isso se mede a mao,
// como o portal.
const TELAS = [
  ['/', 'inicio', [PG + 'Inicio.tsx']],
  // As quatro telas indice. Passaram a ser a porta de tudo em
  // 08/10/2026, quando a barra deixou de listar telas.
  ['/compras', 'indice-compras', [PG + 'Indices.tsx']],
  ['/almoxarifado', 'indice-almoxarifado', [PG + 'Indices.tsx']],
  ['/financeiro', 'indice-financeiro', [PG + 'Indices.tsx']],
  ['/administracao', 'indice-administracao', [PG + 'Indices.tsx']],
  ['/solicitacoes', 'solicitacoes-lista', [PG + 'solicitacoes/Lista.tsx']],
  // Quarto item: o texto do botao que abre o modal. Sem ele a regua
  // media a tela de tras e dizia que estava tudo certo — e os maiores
  // formularios do sistema ficavam fora de toda medicao.
  ['/solicitacoes', 'solicitacoes-nova', [PG + 'solicitacoes/Nova.tsx'], '+ Nova solicitação'],
  ['/solicitacoes/' + SOLICITACAO, 'solicitacoes-detalhe', [PG + 'solicitacoes/Detalhe.tsx']],
  ['/aprovacoes', 'aprovacoes', [PG + 'aprovacoes/Fila.tsx']],
  ['/cotacoes', 'cotacoes-lista', [PG + 'cotacoes/Lista.tsx']],
  ['/cotacoes', 'cotacoes-nova', [PG + 'cotacoes/Nova.tsx'], '+ Novo pacote de cotação'],
  ['/cotacoes/' + COTACAO_ESCOLHIDA, 'cotacoes-detalhe', [PG + 'cotacoes/Detalhe.tsx']],
  ['/cotacoes/' + COTACAO_ESCOLHIDA + '/equalizacao', 'cotacoes-equalizacao', [PG + 'cotacoes/Equalizacao.tsx']],
  ['/pedidos', 'pedidos', [PG + 'pedidos/Lista.tsx']],
  ['/pedidos/' + PEDIDO_ID, 'pedidos-detalhe', [PG + 'pedidos/Detalhe.tsx']],
  ['/recebimento', 'recebimento', [PG + 'recebimento/Painel.tsx']],
  ['/recebimento/' + PEDIDO, 'recebimento-conferir', [PG + 'recebimento/Conferir.tsx']],
  ['/estoque', 'estoque', [PG + 'estoque/Painel.tsx']],
  ['/estoque/movimentos', 'estoque-movimentos', [PG + 'estoque/Movimentos.tsx']],
  ['/locacao', 'locacao', [PG + 'locacao/Painel.tsx']],
  ['/financeiro/contas', 'financeiro-contas', [PG + 'financeiro/Painel.tsx']],
  ['/financeiro/notas', 'financeiro-notas', [PG + 'financeiro/Notas.tsx']],
  ['/financeiro/lancamentos', 'financeiro-lancamentos', [PG + 'financeiro/Lancamentos.tsx']],
  ['/relatorios', 'relatorios-orcamento', [PG + 'relatorios/Painel.tsx']],
  ['/relatorios?ver=economia', 'relatorios-economia', [PG + 'relatorios/Painel.tsx']],
  ['/relatorios?ver=fornecedores', 'relatorios-fornecedores', [PG + 'relatorios/Painel.tsx']],
  ['/relatorios?ver=tempos', 'relatorios-tempos', [PG + 'relatorios/Painel.tsx']],
  ['/relatorios?ver=consumo', 'relatorios-consumo', [PG + 'relatorios/Painel.tsx']],
  ['/relatorios?ver=parado', 'relatorios-estoque-parado', [PG + 'relatorios/Painel.tsx']],
  ['/cadastros/familias', 'cadastros-familias', [PG + 'cadastros/Familias.tsx']],
  ['/cadastros/materiais', 'cadastros-materiais', [PG + 'cadastros/Materiais.tsx']],
  ['/cadastros/fornecedores', 'cadastros-fornecedores', [PG + 'cadastros/Fornecedores.tsx']],
  ['/cadastros/obras', 'cadastros-obras', [PG + 'cadastros/Obras.tsx']],
  ['/cadastros/obras/' + OBRA, 'cadastros-obra-detalhe', [PG + 'cadastros/ObraDetalhe.tsx']],
  ['/cadastros/alcadas', 'cadastros-alcadas', [PG + 'cadastros/Alcadas.tsx']],
  ['/admin/usuarios', 'admin-usuarios', [PG + 'admin/Usuarios.tsx']],
  //  "Funcoes" deixou de ser tela propria em 10/10/2026: virou a
  //  segunda aba de Usuarios. O endereco antigo /admin/funcoes
  //  redireciona para ca, e a regua mede a aba, nao o desvio.
  ['/admin/usuarios?ver=funcoes', 'admin-funcoes', [PG + 'admin/Funcoes.tsx']],
  ['/admin/avisos?ver=whatsapp', 'admin-avisos-whatsapp', [PG + 'admin/Avisos.tsx', PG + 'admin/WhatsApp.tsx']],
  ['/admin/avisos?ver=email', 'admin-avisos-email', [PG + 'admin/Avisos.tsx', PG + 'admin/Email.tsx']],
  ['/admin/status', 'admin-status', [PG + 'admin/StatusSistema.tsx']],
  ['/minha-senha', 'minha-senha', [PG + 'MinhaSenha.tsx']],
  //  O convite de senha quando o link nao serve. E a tela que quem
  //  recebeu um link velho vai ver, e ela nao pede token valido.
  ['/senha/link-que-nao-existe', 'senha-link-recusado', [PG + 'CriarSenha.tsx']],
];

// ------------------------------------------------------------
//  Medir só o que mudou
//
//  Percorrer as 34 telas para conferir 3 que mudaram não descobre
//  nada: descobre 31 vezes o que já se sabia.
//
//  A regra é conservadora de propósito. Errar para menos aqui é
//  deixar defeito passar; errar para mais custa segundos. Por isso,
//  em toda dúvida — git mudo, arquivo que não sei de quem é, coisa
//  compartilhada mexida — ela mede tudo.
// ------------------------------------------------------------
const SO_MUDADAS = process.argv.includes('--so-mudadas');
const RAIZ_PROJETO = join(dirname(fileURLToPath(import.meta.url)), '..');

const git = (comando) => execSync('git ' + comando, { cwd: RAIZ_PROJETO }).toString().trim();

/** O que mexeu desde o último marco, contando o que ainda não foi salvo. */
function arquivosMexidos() {
  const marco = git('describe --tags --abbrev=0');

  const mexidos = [
    // `git diff <marco>` compara a pasta de trabalho com o marco, então
    // já inclui o que está salvo e o que não está.
    ...git('diff --name-only ' + marco).split('\n'),
    ...git('ls-files --others --exclude-standard').split('\n'),
  ].map((l) => l.trim()).filter(Boolean);

  return { marco, mexidos };
}

/**
 * Só a versão mudou neste arquivo?
 *
 * Subo a versão em toda etapa, e ela é escrita em dois lugares: o
 * `package.json` e o rodapé da barra lateral, que fica no Layout —
 * um componente compartilhado. Se isso contasse como "mexeu em coisa
 * que toda tela usa", a régua mediria as 34 telas sempre e o corte
 * não serviria para nada.
 *
 * Uma dependência nova, ou qualquer outra linha do Layout, cai fora
 * deste teste e força a volta inteira.
 */
function soAVersao(arquivo, marco) {
  try {
    const diff = execSync('git diff -U0 ' + marco + ' -- ' + arquivo, { cwd: RAIZ_PROJETO }).toString();
    const linhas = diff.split('\n').filter((l) => /^[+-][^+-]/.test(l));
    return linhas.length > 0 && linhas.every((l) => /"version"|menu__versao/.test(l));
  } catch {
    return false;
  }
}

/** Mexeu em coisa que TODA tela usa: estilo, componente, navegação, tema? */
function ehDeTodos(arquivo, marco) {
  if (!arquivo.startsWith('frontend/')) return false;
  if (arquivo.startsWith(PG)) return false;
  if (/\.test\.tsx?$/.test(arquivo)) return false;
  if (soAVersao(arquivo, marco)) return false;
  return true;
}

function telasParaMedir() {
  if (!SO_MUDADAS) return TELAS;

  let marco;
  let mexidos;
  try {
    ({ marco, mexidos } = arquivosMexidos());
  } catch {
    console.log('  git nao respondeu: medindo as ' + TELAS.length + ' telas.');
    return TELAS;
  }

  const deTodos = mexidos.filter((a) => ehDeTodos(a, marco));
  if (deTodos.length > 0) {
    console.log('  Mexeu em coisa que toda tela usa (' + deTodos.slice(0, 3).join(', ') +
      (deTodos.length > 3 ? ', +' + (deTodos.length - 3) : '') + '): medindo as ' + TELAS.length + '.');
    return TELAS;
  }

  const escolhidas = TELAS.filter(([, , arquivos]) => arquivos.some((a) => mexidos.includes(a)));

  const paginasMexidas = mexidos.filter((a) => a.startsWith(PG) && !/\.test\.tsx?$/.test(a));
  const orfas = paginasMexidas.filter((a) => !TELAS.some(([, , arq]) => arq.includes(a)));
  if (orfas.length > 0) {
    console.log('  Nao sei que tela usa ' + orfas.join(', ') + ': medindo as ' + TELAS.length + '.');
    return TELAS;
  }

  console.log('  Desde ' + marco + ': ' + escolhidas.length + ' de ' + TELAS.length + ' telas mexidas.');
  return escolhidas;
}

// ------------------------------------------------------------
//  `--so-esta <nome>`: mede UMA tela
//
//  A regua foi feita para o `admin`, que abre tudo. Rodando com uma
//  conta de menos permissoes — para ver um painel que so aparece
//  para quem assina, por exemplo — ela gasta o orcamento de espera
//  em cada tela que aquela pessoa nao pode abrir: 8 telas em varios
//  minutos, contra 34 em 45s.
//
//  Quando o que interessa e uma tela so, medir 34 e desperdicio.
// ------------------------------------------------------------
const SO_ESTA = (() => {
  const i = process.argv.indexOf('--so-esta');
  return i >= 0 ? process.argv[i + 1] : null;
})();

/** `--abrir "Nova locacao"`: clica no botao antes de medir. */
const ABRIR = (() => {
  const i = process.argv.indexOf('--abrir');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const ESCOLHIDAS = SO_ESTA
  ? TELAS.filter(([, nome]) => nome === SO_ESTA)
  : telasParaMedir();

if (SO_ESTA && ESCOLHIDAS.length === 0) {
  console.log('  Nao existe tela chamada "' + SO_ESTA + '".');
  console.log('  Nomes: ' + TELAS.map(([, n]) => n).join(', '));
  process.exit(1);
}

// Nada para medir: nem abre o navegador. Subir o Edge e fazer login
// custava 8s para depois nao olhar tela nenhuma.
if (ESCOLHIDAS.length === 0) {
  console.log('  Nada mexido no frontend desde o ultimo marco: nem abro o navegador.');
  console.log('');
  console.log('==== RESUMO (0 de ' + TELAS.length + ' telas) ====');
  process.exit(0);
}

mkdirSync(SAIDA, { recursive: true });

// O perfil do navegador vai para a pasta temporaria do sistema, NAO para
// dentro do projeto: a pasta do projeto e sincronizada pelo OneDrive, e o
// Edge nao consegue subir de dentro dela. E lixo de uma execucao so.
// Perfil NOVO a cada execução, em vez de apagar o anterior.
// Apagar falha quando o navegador da rodada passada ainda está vivo
// segurando a pasta, e a régua morre antes de medir qualquer coisa.
const PERFIL = join(tmpdir(), 'portoink-auditoria-' + PORTA + '-' + Date.now());

// Faxina antes de abrir: medicao interrompida deixa navegador vivo.
matarOrfaos();

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

// ------------------------------------------------------------
//  TODO COMANDO TEM PRAZO
//
//  Esta promessa so se resolvia pela resposta do navegador. Sem
//  prazo, e sem ninguem olhando se o socket caiu: um comando sem
//  resposta pendurava a regua PARA SEMPRE — processo vivo, zero de
//  CPU, nenhum arquivo novo, nenhuma linha de erro.
//
//  Aconteceu em 08/10/2026, na tela 38 de 40. A causa foi minha: eu
//  editei arquivos do backend durante a varredura, e o `tsx watch`
//  reinicia a API a cada save. Com `awaitPromise: true`, um `fetch`
//  da pagina para uma API que esta reiniciando e uma promessa que
//  nunca assenta — e o `Runtime.evaluate` espera por ela, com razao.
//
//  A causa de fora foi minha; a de dentro e daqui. Varredura que
//  morre tem de DIZER que morreu: quem espera 45 minutos por um
//  resumo nao pode descobrir pelo contador de arquivos que ele nunca
//  vem.
//
//  30s e folgado: os prazos longos da regua (40s para um seletor
//  aparecer, 30s para a tela acalmar) sao lacos AQUI no node, com
//  chamadas curtas la dentro. Comando que passa de 30s nao esta
//  devagar, esta perdido.
// ------------------------------------------------------------
const LIMITE_DO_COMANDO = 30000;

const cdp = (method, params = {}) => {
  proximo += 1;
  const id = proximo;

  return new Promise((ok, nao) => {
    const relogio = setTimeout(() => {
      pendentes.delete(id);
      nao(new Error(
        'o navegador nao respondeu a ' + method + ' em '
        + (LIMITE_DO_COMANDO / 1000) + 's',
      ));
    }, LIMITE_DO_COMANDO);

    pendentes.set(id, {
      ok: (v) => { clearTimeout(relogio); ok(v); },
      nao: (e) => { clearTimeout(relogio); nao(e); },
    });

    ws.send(JSON.stringify({ id, method, params }));
  });
};

// Socket caiu: o que estava pendente morre AGORA, com motivo. Sem
// isto, Edge fechado tambem pendurava a regua — pelo mesmo caminho,
// esperando resposta de quem ja foi embora.
const matarPendentes = (motivo) => () => {
  for (const [id, { nao }] of [...pendentes]) {
    pendentes.delete(id);
    nao(new Error(motivo));
  }
};

ws.onclose = matarPendentes('a conexao com o navegador fechou');
ws.onerror = matarPendentes('a conexao com o navegador deu erro');

const js = async (e) => {
  const r = await cdp('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error(d.text + ' :: ' + (d.exception?.description ?? '').slice(0, 200));
  }
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
/**
 * Espera a tela ANTIGA sair de cena.
 *
 * Aqui havia um `dormir(500)` fixo, e ele existia por um motivo
 * real: logo depois de trocar de rota o React ainda não montou nada,
 * a tela velha continua desenhada, e o "esperar acalmar" abaixo
 * declarava calma sobre a tela que eu estava deixando.
 *
 * Só que meio segundo é o PIOR caso, pago em toda tela. Cronometrado:
 * 17s das 34 telas, para um trabalho que costuma levar menos de 100ms.
 *
 * Agora pergunta de 40 em 40ms se o título mudou. As telas com o
 * mesmo título — as abas de Relatórios — pagam o limite, que é o
 * mesmo meio segundo de antes. Nunca pior, quase sempre melhor.
 */
/**
 * O que a tela mostra AGORA.
 *
 * Serve para decidir o que fazer quando ela nao acalma: esperar mais
 * e recomecar sao respostas para problemas diferentes, e sem olhar
 * nao da para escolher.
 */
async function retratoDaTela() {
  return JSON.parse(await js(`JSON.stringify({
    rota: location.pathname + location.search,
    titulo: (document.querySelector('h1') || {}).textContent || null,
    rodinha: !!document.querySelector('.girando'),
    quantos: document.querySelectorAll('button, a[href], select, input, textarea, [role=tab], [role=menuitem]').length,
    alerta: ((document.querySelector('[role=alert]') || {}).textContent || '').slice(0, 90) || null,
    estadoVazio: ((document.querySelector('.estado') || {}).textContent || '').slice(0, 90) || null,
  })`));
}

/** Sai da rota e volta, para a tela pedir os dados de novo. */
async function recarregar(caminho) {
  await js('history.pushState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate"));');
  await dormir(400);
  await js(
    'history.pushState({}, "", ' + JSON.stringify(caminho) + ');' +
    ' window.dispatchEvent(new PopStateEvent("popstate"));',
  );
}

async function esperarTrocar(tituloAnterior, limite = 500) {
  const ate = Date.now() + limite;

  while (Date.now() < ate) {
    const agora = await js('(document.querySelector("h1") || {}).textContent || ""');
    if (agora !== tituloAnterior) return;
    await dormir(40);
  }
}

/**
 * Espera o layout parar depois de mudar a largura da janela.
 *
 * Aqui havia `dormir(400)` por largura — 27s das 34 telas. E 13s
 * disso eram gastos na PRIMEIRA largura, que nem muda: ela já estava
 * posta antes de navegar.
 *
 * Em vez de contar tempo, pergunta duas coisas: a caixa de layout já
 * é a largura que pedi, e a geometria parou de mudar. A segunda parte
 * cobre transição de CSS de qualquer duração — o tempo fixo só cobria
 * por sorte.
 */
async function esperarLayoutParar(largura, limite = 1500) {
  const ate = Date.now() + limite;
  let anterior = '';

  while (Date.now() < ate) {
    const agora = await js(
      "(() => { const d = document.documentElement;" +
      " return d.clientWidth + 'x' + d.scrollWidth + 'x' + d.scrollHeight; })()",
    );

    if (agora.startsWith(largura + 'x') && agora === anterior) return;
    anterior = agora;
    await dormir(45);
  }
}

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
        // Um respiro final para transicao de CSS terminar. Curto
        // porque `esperarLayoutParar` logo abaixo confere a
        // geometria de verdade, em vez de torcer para ter dado tempo.
        await dormir(100);
        return true;
      }
    } else {
      iguais = 0;
    }

    anterior = estado.quantos;
    await dormir(70);
  }

  return false;
}

await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', {
  width: LARGURA, height: ALTURA, deviceScaleFactor: 1, mobile: LARGURA < 700,
});

// ------------------------------------------------------------
//  Movimento desligado, no navegador inteiro
//
//  Os graficos animam ao aparecer: as barras do fluxo crescem em
//  600ms com atraso escalonado (ate ~1,1s somando o ultimo), a
//  rosca gira em 800ms, o medidor enche em 900ms.
//
//  A regua fotografava no meio do voo. Em 2026-09-24 saiu uma
//  captura do Financeiro com as barras quase invisiveis e a rosca
//  pela metade — e nada disso era defeito do produto. Decima vez
//  nesta obra que o defeito era a medicao.
//
//  Pior que a foto feia: o `backwards` faz o elemento ficar no
//  quadro ZERO enquanto espera o atraso, entao a ALTURA medida
//  tambem era a errada.
//
//  O sistema ja respeita `prefers-reduced-motion: reduce` e zera
//  as animacoes nesse caso. Pedir isso ao navegador deixa toda
//  medicao deterministica, sem tocar no CSS de producao.
// ------------------------------------------------------------
await cdp('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});

// ------------------------------------------------------------
//  Entrar no sistema
//
//  VIROU FUNCAO PORQUE A SESSAO MORRE NO MEIO DA VARREDURA.
//
//  O cracha de acesso dura 15 minutos (DURACAO_ACESSO, no
//  autenticacao.ts) e a varredura das 37 telas em tres larguras
//  leva uns 45. As ultimas telas da lista vinham em branco, e a
//  regua anunciava "NAO CARREGOU" como se o defeito fosse delas.
//
//  Em 08/10/2026 isso acusou cinco telas sadias: admin-usuarios,
//  os dois avisos, admin-status e minha-senha. Todas abrem
//  normalmente com sessao nova — conferido uma a uma.
//
//  Pior que regua que nao mede e regua que mede errado e culpa o
//  inocente: quem le o relatorio vai procurar defeito onde nao ha.
// ------------------------------------------------------------
async function entrarNoSistema() {
  await cdp('Page.navigate', { url: SITE + '/entrar' });
  await esperarPor('input[type="password"]');

  await js([
    '(() => {',
    "const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;",
    "const campos = [...document.querySelectorAll('input')];",
    "const email = campos.find(c => c.type === 'email') || campos[0];",
    "const senha = campos.find(c => c.type === 'password') || campos[1];",
    'set.call(email, ' + JSON.stringify(CONTA) + '); email.dispatchEvent(new Event("input", { bubbles: true }));',
    'set.call(senha, ' + JSON.stringify(SENHA) + '); senha.dispatchEvent(new Event("input", { bubbles: true }));',
    "document.querySelector('form').requestSubmit();",
    '})()',
  ].join('\n'));

  await esperarPor('.menu__lista');
}

await entrarNoSistema();

// Trava: se o login nao pegou, TODAS as telas viram a pagina de
// entrada e a auditoria devolve um 'ok' que nao vale nada.
const entrou = await js('JSON.stringify({ rota: location.pathname, temMenu: !!document.querySelector(".menu__lista") })');
if (!JSON.parse(entrou).temMenu) {
  console.error('RECUSADO: nao consegui entrar no sistema. Sem sessao, a auditoria mediria a tela de login 33 vezes.');
  console.error('  conta: ' + CONTA);
  console.error('  a senha vem de SENHA_AUDITORIA (padrao: a de fabrica das contas de teste).');
  await fecharNavegador();
  process.exit(1);
}

// ------------------------------------------------------------
//  A régua, executada dentro da página
// ------------------------------------------------------------
const MEDIR = `(() => {
  const achados = [];
  // A largura da CAIXA DE LAYOUT, nao a da janela.
  //
  // Medido com emulacao de celular ligada, em /pedidos a 420px:
  //
  //    clientWidth   420    <- a caixa onde a pagina se desenha
  //    innerWidth    830    <- a janela, ESTICADA ate caber o transbordo
  //    scrollWidth   830
  //
  // Esse esticamento e o "afasta o zoom para caber" do telefone de
  // verdade. So que a regra de rolagem horizontal compara conteudo
  // com janela — e se a janela cresce junto com o conteudo, a conta
  // nunca acusa nada. A regua passou meses dizendo "celular: sem
  // achados" porque era incapaz de achar. Com clientWidth ela para
  // de se anular.
  const larguraTela = document.documentElement.clientWidth;
  const nomear = (el) => {
    const classe = (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.');
    const texto = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
    return el.tagName.toLowerCase() + (classe ? '.' + classe : '') + (texto ? ' "' + texto + '"' : '');
  };

  // 1. A pagina desliza para o lado?
  //
  //  NAO e comparar o scrollWidth com a largura da tela. Essa conta
  //  acusou 16 das 34 telas, e nenhuma delas estava quebrada:
  //
  //    /pedidos a 420px  ->  scrollWidth 830, e a pagina nao andava
  //                          um pixel
  //
  //  A tabela rola dentro da propria caixa (overflow-x: auto), que
  //  e como ela foi construida. O scrollWidth do documento soma o
  //  conteudo de dentro dessa caixa — contabilidade interna do
  //  navegador, nao algo que a pessoa ve.
  //
  //  A pergunta certa e a que a pessoa faz com o dedo: EMPURRO a
  //  pagina para a direita e ela anda? Se nao anda, nao ha defeito.
  const antesDoEmpurrao = window.scrollX;
  window.scrollTo(99999, window.scrollY);
  const andou = window.scrollX;
  window.scrollTo(antesDoEmpurrao, window.scrollY);

  // So conta como culpado quem NAO esta dentro de uma caixa que
  // rola ou recorta: la dentro, passar da largura e o combinado.
  const contido = (el) => {
    let n = el.parentElement;
    while (n && n !== document.body) {
      const o = getComputedStyle(n).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true;
      n = n.parentElement;
    }
    return false;
  };

  const passamDaTela = [...document.querySelectorAll('body *')]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= larguraTela + 1) return false;
      if (getComputedStyle(el).position === 'fixed') return false;
      return !contido(el);
    });

  const nomearCulpados = (lista) => lista
    .slice(0, 4)
    .map((el) => nomear(el) + ' (vai ate ' + Math.round(el.getBoundingClientRect().right) + 'px)');

  if (andou > 0) {
    // Se o filtro de "nao contido" nao sobrou ninguem, a pagina ainda
    // assim anda — entao o culpado E um dos contidos, ou a propria
    // caixa que recorta. Melhor mostrar os mais largos do que devolver
    // uma acusacao sem reu: regua que diz "ha defeito" e nao diz onde
    // faz perder mais tempo do que ajuda.
    const paraMostrar = passamDaTela.length > 0
      ? passamDaTela
      : [...document.querySelectorAll('body *')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.right > larguraTela + 1
              && getComputedStyle(el).position !== 'fixed';
          })
          .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);

    achados.push({
      tipo: 'ROLAGEM_HORIZONTAL',
      detalhe: 'a pagina anda ' + andou + 'px para o lado numa tela de ' + larguraTela + 'px'
        + (passamDaTela.length === 0 ? ' (todos os largos estao dentro de caixa que recorta)' : ''),
      culpados: nomearCulpados(paraMostrar),
    });
  } else if (passamDaTela.length > 0) {
    // A pagina NAO anda, mas tem coisa passando da tela.
    //
    // Parece inofensivo e nao e. No celular o navegador monta o
    // layout viewport pelo conteudo: se ele mede 574 numa tela de
    // 393, da para AFASTAR o zoom ate caber tudo — e sobra uma
    // faixa vazia do lado direito. Foi assim que o usuario achou
    // isto no iPhone dele, em 2026-09-24, na tela do Financeiro.
    //
    // O Design 7 tirou a comparacao com o scrollWidth porque ela
    // acusava 16 telas sadias. A licao era descartar o SCROLLWIDTH
    // (que soma o conteudo de caixas que rolam por dentro), nao
    // descartar a pergunta. Aqui a conta e outra: elemento cuja
    // borda direita passa da tela e que ninguem recorta.
    achados.push({
      tipo: 'MAIS_LARGO_QUE_A_TELA',
      detalhe: passamDaTela.length
        + ' elemento(s) passam de ' + larguraTela + 'px sem a pagina rolar'
        + ' — no celular isso libera o zoom para fora',
      culpados: nomearCulpados(passamDaTela),
    });
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
      return r.height > 0 && r.width > 0 && r.height < 44 && !el.classList.contains('menu__item');
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
      // Dentro de uma caixa de 1px com recorte, o texto esta
      // ESCONDIDO de proposito — e a tecnica de so-para-leitor-de-
      // tela. Acusar que ele nao cabe ali e acusar que ele esta
      // escondido, que e justamente o ponto.
      //
      // Olho os PAIS, e nao o proprio elemento: o cabecalho da
      // tabela em modo cartao tem 1px, mas cada <th> dentro dele
      // ainda mede 32. A guarda so funciona subindo.
      let acima = el;
      let escondido = false;
      while (acima && acima !== document.body) {
        const c = acima.getBoundingClientRect();
        if (c.width <= 2 || c.height <= 2) { escondido = true; break; }
        acima = acima.parentElement;
      }
      if (escondido) return false;
      // Campo de digitacao NAO estoura: ele rola por dentro.
      //
      // Um <input> com valor maior que a caixa tem scrollWidth maior
      // que clientWidth SEMPRE — e isso e o comportamento correto,
      // nao um defeito de layout. Enquanto isso nao estava escrito
      // aqui, a regra acusava a tela de Avisos ao fornecedor em toda
      // varredura, por causa de um campo com a mensagem de teste
      // preenchida. Nona vez nesta obra que o defeito era a medicao.
      if (el.matches('input, textarea, select')) return false;
      const estilo = getComputedStyle(el);
      if (estilo.overflowX !== 'visible' && estilo.overflowX !== 'clip') return false;
      return el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0;
    })
    .slice(0, 6)
    .map((el) => nomear(el) + ' (' + el.scrollWidth + ' > ' + el.clientWidth + ')');

  if (estourando.length > 0) {
    achados.push({ tipo: 'TEXTO_ESTOURANDO', detalhe: estourando.length + ' elemento(s)', culpados: estourando });
  }

  // 5. Cartão esticado, com vazio sobrando dentro.
  //
  //  ESTA REGRA MUDOU EM 05/10/2026, e vale saber por quê.
  //
  //  Antes ela cobrava ALTURAS IGUAIS na mesma fileira: mais de 2px
  //  de diferença era achado. Fazia sentido enquanto a grade usava
  //  align-items: stretch, que iguala todo mundo — ali, diferença
  //  era sinal de bug.
  //
  //  Só que o stretch era ele próprio o defeito. O dono achou dois
  //  casos no mesmo dia: abrir o ? de UM indicador esticava os
  //  quatro da fileira, deixando três caixas com 94px de nada
  //  dentro; e o cartão da rosca, ao lado de um ranking mais alto,
  //  ficava com 172px de vazio embaixo do desenho. Palavras dele:
  //  "quebra, ta feio".
  //
  //  Com align-items: start, altura diferente passou a ser normal
  //  e desejada — é conteúdo de tamanho diferente. A régua velha
  //  acusaria isso para sempre.
  //
  //  Então a régua passou a medir o que de fato é defeito: CAIXA
  //  COM BORDA E VAZIO DENTRO. Caixas de alturas diferentes parecem
  //  o que são; caixa com vazio parece quebrada.
  //
  //  A regra nova é mais específica, e cobre o caso antigo: com
  //  stretch, o cartão mais baixo da fileira ficava justamente com
  //  sobra interna — e era isso que doía, não o número na régua.
  //  COMO SE MEDE O VAZIO, e a primeira tentativa que deu errado.
  //
  //  Tentei medir a distancia entre o fundo do ultimo filho e o
  //  fundo da caixa. Acusou 60 vezes em 15 telas que estavam
  //  certas: o PADDING do cartao caia nessa conta como se fosse
  //  vazio. Regra que acusa a tela inteira nao e regra, e ruido.
  //
  //  O que interessa nao e "sobra espaco", e sim "o esticamento
  //  acrescentou altura que o conteudo nao pediu". Isso se mede
  //  direto: solta o item do esticamento, ve de que tamanho ele
  //  fica, devolve. A diferenca e exatamente o que a grade impos —
  //  sem chutar padding, margem nem nada.
  //  ONDE ELA COBRA, e onde nao cobra.
  //
  //  So nas grades que declararam NAO esticar. A distincao e da
  //  casa, e esta escrita no CSS dos dois lados:
  //
  //    · nos paineis de Relatorios e Financeiro, cada cartao e uma
  //      coisa diferente — um grafico, um numero, uma rosca. Ali
  //      esticar so produz caixa com vazio dentro, e a grade
  //      declara align-items: start. Qualquer vazio e defeito.
  //
  //    · nas grades de catalogo — familias, fornecedores, cadastros
  //      — os cartoes sao do MESMO tipo, lado a lado. Ali alinhar a
  //      base e o acordo, e o vao de quem tem menos texto e o preco
  //      dele. Ver o comentario do .indicador__rodape no global.css,
  //      que conta a historia dessa escolha.
  //
  //  Quem garante que os paineis continuem declarando start e o
  //  pente-fino, com uma regra estatica. Esta aqui mede o
  //  resultado; aquela cobra a intencao.
  //  DOIS TIPOS DE CARTAO, DOIS DEFEITOS DIFERENTES.
  //
  //  Nos paineis convivem duas familias, e o que e defeito numa e
  //  o normal da outra:
  //
  //    · INDICADOR — o numero com o "?". Todos tem o mesmo tamanho
  //      de conteudo, entao NAO esticam: so cresce o que foi
  //      aberto. Ali, altura esticada alem do natural e vazio
  //      dentro da caixa, que e o defeito.
  //
  //    · GRAFICO — rosca, ranking, medidor. Ficam dois a dois e
  //      ESTICAM de proposito, para os fundos alinharem; o conteudo
  //      centraliza no espaco em vez de grudar no topo. Ali o
  //      defeito e o contrario: par que nao pareia.
  //
  //  Uma regra so nao serve para as duas, e foi o que me fez
  //  escrever a regra errada duas vezes. A casa declara a familia
  //  no CSS — align-self: stretch no cartao de grafico —, entao a
  //  regua le a declaracao e cobra o que cabe.
  const SOBRA_QUE_INCOMODA = 24;

  for (const grade of document.querySelectorAll('.grade, .painel-financeiro, .painel-relatorio')) {
    const alinhamento = getComputedStyle(grade).alignItems;
    const gradeEstica = alinhamento === 'stretch' || alinhamento === 'normal';

    const esticados = [];

    for (const item of grade.children) {
      const altura = item.getBoundingClientRect().height;
      if (altura <= 0) continue;

      const proprio = getComputedStyle(item).alignSelf;
      const itemEstica = gradeEstica
        ? proprio !== 'start' && proprio !== 'flex-start'
        : proprio === 'stretch';

      if (itemEstica) {
        esticados.push({ item, altura: Math.round(altura), topo: Math.round(item.getBoundingClientRect().top) });
        continue;
      }

      // Nao estica: qualquer altura alem do natural e vazio.
      const antes = item.style.alignSelf;
      item.style.alignSelf = 'start';
      const natural = item.getBoundingClientRect().height;
      item.style.alignSelf = antes;

      const sobra = Math.round(altura - natural);

      if (sobra > SOBRA_QUE_INCOMODA) {
        achados.push({
          tipo: 'CARTAO_COM_VAZIO',
          detalhe: sobra + 'px de nada dentro de ' + (grade.className || 'grade'),
          culpados: [nomear(item) + ' esticado=' + Math.round(altura) + ' natural=' + Math.round(natural)],
        });
      }
    }

    // Estica: entao o conteudo tem de CENTRALIZAR na sobra.
    //
    //  Cobrar que os esticados terminem juntos nao serve: o CSS
    //  Grid ja garante isso por definicao, entao a regra nunca
    //  poderia acusar. Regra que nao pode falhar e pior que regra
    //  nenhuma — ela da a sensacao de guarda sem guardar nada.
    //
    //  O que PODE dar errado num cartao esticado e o conteudo ficar
    //  grudado no topo, com a sobra inteira num buraco no fundo.
    //  Foi o defeito que o dono achou: "grandes e com espaco em
    //  branco que torna feio".
    //
    //  Entao a medida e a simetria: dentro da area que cresce — a
    //  da rosca, a do ranking —, o espaco acima do conteudo tem de
    //  bater com o de baixo.
    for (const { item } of esticados) {
      for (const area of item.querySelectorAll('.rosca-area, .ranking')) {
        const caixa = area.getBoundingClientRect();

        const filhos = [...area.children]
          .map((f) => f.getBoundingClientRect())
          .filter((r) => r.height > 0);

        if (filhos.length === 0) continue;

        const acima = Math.min(...filhos.map((r) => r.top)) - caixa.top;
        const abaixo = caixa.bottom - Math.max(...filhos.map((r) => r.bottom));
        const torto = Math.round(Math.abs(acima - abaixo));

        // Só vale olhar quando ha sobra de verdade: um cartao em que
        // o conteudo preenche nao tem o que centralizar.
        if (acima + abaixo > SOBRA_QUE_INCOMODA * 2 && torto > SOBRA_QUE_INCOMODA) {
          achados.push({
            tipo: 'CONTEUDO_NO_TOPO',
            detalhe: torto + 'px a mais de um lado — o cartao estica e o conteudo nao centraliza',
            culpados: [nomear(area) + ' acima=' + Math.round(acima) + ' abaixo=' + Math.round(abaixo)],
          });
        }
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

  // 8a. Tabela com dados e cabecalho INVISIVEL, no computador.
  //
  //  No celular isso e o combinado: a linha vira cartao e o rotulo
  //  passa a viver ao lado de cada valor. Na tela larga, nao — a
  //  coluna de numero sem nome e indecifravel.
  //
  //  Foi assim que a tela de Conferencia mostrou "180 | 0 | 180" por
  //  semanas: a regra que esconde o cabecalho no modo cartao ficou
  //  FORA da media query, e apagou o cabecalho de 25 telas em toda
  //  largura. Ninguem mediu, porque a regua nao perguntava isto.
  if (larguraTela > 700) {
    const semCabecalho = [...document.querySelectorAll('table')]
      .filter((t) => {
        if (!t.querySelector('tbody tr')) return false;

        //  TABELA QUE NINGUEM VE NAO TEM CABECALHO PARA JULGAR.
        //
        //  A regra pergunta "o cabecalho sumiu enquanto os dados
        //  aparecem?". Dentro de um <dialog> FECHADO nada aparece:
        //  as linhas estao no DOM porque o React ja as desenhou, e
        //  tudo ali tem tamanho zero — inclusive o cabeçalho.
        //
        //  Em 09/10/2026 isso acusou a lista de cotacoes nas duas
        //  larguras de computador. A tabela culpada era a do modal
        //  "Novo pacote de cotacao", com <thead> correto e visivel
        //  quando o modal abre. So apareceu agora porque o teste de
        //  alcada aprovou tres solicitacoes e encheu a lista: antes
        //  o tbody estava vazio e o filtro nem chegava aqui.
        const caixa = t.getBoundingClientRect();
        if (caixa.height <= 2 || caixa.width <= 2) return false;

        const cabeca = t.querySelector('thead');
        if (!cabeca) return true;
        const r = cabeca.getBoundingClientRect();
        return r.height <= 2 || r.width <= 2;
      })
      .map(nomear);

    if (semCabecalho.length > 0) {
      achados.push({
        tipo: 'TABELA_SEM_CABECALHO',
        detalhe: semCabecalho.length + ' tabela(s) com dados e cabecalho invisivel',
        culpados: semCabecalho.slice(0, 4),
      });
    }
  }

  // 8. Tabela sem legenda para leitor de tela.
  const semLegenda = [...document.querySelectorAll('table')]
    .filter((t) => !t.querySelector('caption') && !t.getAttribute('aria-label'))
    .map(nomear);

  if (semLegenda.length > 0) {
    achados.push({ tipo: 'TABELA_SEM_LEGENDA', detalhe: semLegenda.length + ' tabela(s)', culpados: semLegenda.slice(0, 3) });
  }

  // 9. Mais de um botao principal na tela.
  //
  //  Esta regra morava no conferidor de codigo, e la ela nao tinha
  //  como acertar: ele conta a classe no arquivo, e o
  //  arquivo tem o botao da pagina, o do formulario e o do modal —
  //  que nunca aparecem juntos. Em Locacao ele acusava 3 onde a
  //  pessoa ve 1.
  //
  //  Aqui e contado o que esta DE FATO na tela. Um botao principal
  //  por vez: se dois competem, nenhum e o proximo passo.
  //  Com um modal aberto, a pagina atras esta INERTE: o navegador
  //  nao deixa clicar nem tabular nada fora do <dialog>. Contar o
  //  botao da pagina junto com o do modal acusa competicao que nao
  //  existe — a pessoa so alcanca um deles.
  const modalAberto = document.querySelector('dialog[open]');
  const ondeProcurar = modalAberto ?? document.querySelector('main');

  //  ACAO DE LINHA NAO ENTRA NA CONTA.
  //
  //  A regra existe para o botao da PAGINA: se dois competem pelo
  //  proximo passo, nenhum e o proximo passo. Numa FILA, cada linha
  //  E um proximo passo, e a pessoa escolhe qual.
  //
  //  A tela de Aprovacoes pinta de azul a linha que espera a
  //  assinatura DE QUEM ESTA OLHANDO, e de cinza a que nao espera —
  //  decisao deliberada, com o motivo escrito em Fila.tsx: "linha
  //  que nao e sua abre para OLHAR, nao para assinar".
  //
  //  Com uma solicitacao na fila, a regra passava. Em 09/10/2026 a
  //  varredura funcional criou mais duas, e a regua passou a acusar
  //  "2 botoes principais ao mesmo tempo" — num desenho que estava
  //  certo, e que fica MAIS errado se for consertado.
  const seVe = (b) => {
    const r = b.getBoundingClientRect();
    const e = getComputedStyle(b);
    return r.width > 0 && r.height > 0 && e.visibility !== 'hidden';
  };

  const todosOsPrincipais = ondeProcurar
    ? [...ondeProcurar.querySelectorAll('.botao--principal')].filter(seVe)
    : [];

  const daLinha = todosOsPrincipais.filter((b) => b.closest('tr, li'));
  const principais = todosOsPrincipais.filter((b) => !b.closest('tr, li'));

  if (principais.length > 1) {
    achados.push({
      tipo: 'VARIOS_BOTOES_PRINCIPAIS',
      detalhe: principais.length + ' ao mesmo tempo',
      culpados: principais.map(nomear),
    });
  }

  //  A EXCECAO DA FILA TEM CONDICAO, E A CONDICAO TAMBEM SE MEDE.
  //
  //  Linha de fila pode ser azul porque, sozinha, ela nao compete
  //  com ninguem: a pessoa escolhe entre iguais. Mas se a pagina
  //  TAMBEM tem botao principal no cabecalho, ele volta a competir
  //  — e o olho perde o proximo passo da pagina.
  //
  //  Sem esta checagem, o DESIGN.md prometeria uma condicao que
  //  regua nenhuma cobra, e bastaria alguem pendurar um "Novo" no
  //  topo de Aprovacoes para a tela ficar errada em silencio.
  if (daLinha.length > 0 && principais.length > 0) {
    achados.push({
      tipo: 'LINHA_AZUL_COM_ACAO_NO_TOPO',
      detalhe: daLinha.length + ' linha(s) azul(is) competindo com a acao da pagina',
      culpados: [...principais, ...daLinha].map(nomear),
    });
  }

  // Onde fica a acao principal do cabecalho.
  //
  // Nao e achado por si: e uma MEDIDA, comparada ENTRE telas no fim
  // da varredura. O dono do sistema apontou que o botao azul
  // aparecia em altura diferente em cada tela — e tinha razao: a
  // acao ficava alinhada ao fim do bloco de texto, entao descricao
  // de tres linhas empurrava o botao para baixo.
  const acaoDoTopo = document.querySelector('.cabecalho__acoes .botao--principal');

  return JSON.stringify({
    achados,
    larguraMedida: larguraTela,
    estado: {
      acaoY: acaoDoTopo ? Math.round(acaoDoTopo.getBoundingClientRect().top + window.scrollY) : null,
      vazio: !!document.querySelector('.estado'),
      linhas: document.querySelectorAll('tbody tr').length,
      titulo: (document.querySelector('h1') || {}).textContent || '(sem h1)',
    },
  });
})()`;


// ------------------------------------------------------------
//  Contraste de texto, medido nos DOIS temas
//
//  Sai do MEDIR e vira script próprio por um motivo: contraste
//  não muda com a largura da janela, mas muda inteiro com o tema.
//  Medir só o tema aberto deixaria metade do sistema sem régua —
//  e o tema escuro foi pedido, não é enfeite.
// ------------------------------------------------------------
const CONTRASTE = `(() => {
  const nomear = (el) => {
    const classe = (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.');
    const texto = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
    return el.tagName.toLowerCase() + (classe ? '.' + classe : '') + (texto ? ' "' + texto + '"' : '');
  };

  // 9. Contraste de texto (WCAG AA).
  //
  //  A regua media espaco e tamanho, nunca cor. E cor errada nao
  //  "parece" errada em print: o azul da marca sobre o fundo do
  //  item ativo do menu dava 3,85:1 e passava batido a olho.
  //
  //  O minimo e 4,5:1, ou 3:1 quando o texto e grande (>=24px, ou
  //  >=18,66px e negrito) — sao os numeros da WCAG AA.
  const corDe = (t) => {
    const m = (t || '').match(/[0-9.]+/g) || [];
    return { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] };
  };

  const canal = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const luz = (c) => 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);

  // O fundo de VERDADE: sobe pelos pais ate achar um opaco. Ler so
  // o do proprio elemento daria "transparente" na maioria deles.
  const fundoReal = (el) => {
    let n = el;
    while (n) {
      const c = corDe(getComputedStyle(n).backgroundColor);
      if (c.a > 0.9) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const razao = (a, b) => {
    const x = luz(a); const y = luz(b);
    const [alto, baixo] = x > y ? [x, y] : [y, x];
    return Math.round(((alto + 0.05) / (baixo + 0.05)) * 100) / 100;
  };

  const fracos = [];
  const vistos = new Set();

  for (const el of document.querySelectorAll('main *, .menu *, .barra *')) {
    // So elementos que realmente desenham texto proprio.
    const texto = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim()).join('');
    if (!texto) continue;

    const e = getComputedStyle(el);
    if (e.visibility === 'hidden' || e.display === 'none' || +e.opacity === 0) continue;
    if (el.closest('.apenas-leitor-tela')) continue;

    const tamanho = parseFloat(e.fontSize);
    const grosso = parseInt(e.fontWeight, 10) >= 700;
    const minimo = (tamanho >= 24 || (tamanho >= 18.66 && grosso)) ? 3 : 4.5;

    // Em SVG quem pinta o texto e o fill, nao o color. Lendo color
    // ali eu media uma cor herdada que nao aparece na tela: o
    // rotulo 67% do medidor foi acusado em 1,42:1 quando ele usa
    // fill: var(--texto), que passa folgado.
    const pintura = el.ownerSVGElement ? e.fill : e.color;
    const r = razao(corDe(pintura), fundoReal(el));
    if (r >= minimo) continue;

    // Uma linha por combinacao de classe+cor: dez celulas iguais de
    // uma tabela sao UM problema, nao dez.
    const assinatura = (el.className || '') + '|' + e.color + '|' + Math.round(r * 10);
    if (vistos.has(assinatura)) continue;
    vistos.add(assinatura);

    fracos.push(nomear(el) + ' ' + r + ':1 (minimo ' + minimo + ')');
  }

  return JSON.stringify(fracos.length === 0 ? [] : [{
    tipo: 'CONTRASTE_FRACO',
    detalhe: fracos.length + ' combinacao(oes)',
    culpados: fracos.slice(0, 8),
  }]);

})()`;

const relatorio = [];

// Telas cuja foto falhou. Nao e achado de desenho: e aviso de que
// aquela tela foi MEDIDA mas nao tem retrato para eu olhar.
const semFoto = [];

/**
 * As larguras medidas nesta volta.
 *
 * Antes eram DUAS execuções: uma de computador e outra de celular,
 * cada uma abrindo navegador, fazendo login e percorrendo as 34
 * telas do zero. Duas voltas fazendo o mesmo caminho.
 *
 * Agora é uma volta só: chega na tela, mede na largura grande,
 * encolhe a janela, mede na pequena, e passa para a próxima. O
 * login e o carregamento de cada tela acontecem uma vez em vez de
 * duas.
 */
const LARGURAS = process.argv.includes('--so-uma')
  ? [LARGURA]
  : [1920, 1440, 420];

/*
 * POR QUE 1920 ENTROU, em 05/10/2026.
 *
 * A regua media 1440 e 420 — o computador e o celular. O dono abriu
 * os relatorios numa tela maior e viu o que nenhuma medicao minha
 * pegava: o desenho da rosca ficava com 195px fixos num cartao de
 * 810px, um anelzinho perdido, e a coluna do nome da legenda
 * esticava para 368px, deixando "Marquilip" a trezentos pixels do
 * proprio valor.
 *
 * Em 1440 o mesmo layout estava justo, e em 420 estava certo. O
 * defeito morava so na largura que ninguem olhava.
 *
 * Monitor de 1920 e o mais comum em escritorio. Medir so ate 1440 e
 * medir o computador de quem desenvolve, nao o de quem usa.
 */

for (const [caminho, nome, , botaoDaTela] of ESCOLHIDAS) {
  try {
    await cdp('Emulation.setDeviceMetricsOverride', {
      width: LARGURAS[0], height: ALTURA, deviceScaleFactor: 1, mobile: false,
    });

    const tituloAnterior = await js('(document.querySelector("h1") || {}).textContent || ""');

    await js(
      'history.pushState({}, "", ' + JSON.stringify(caminho) + ');' +
      ' window.dispatchEvent(new PopStateEvent("popstate"));',
    );

    await esperarTrocar(tituloAnterior);

    // A resposta do `esperarAcalmar` era JOGADA FORA. Quando a tela
    // nao acalmava no prazo, a regua media assim mesmo — e o que ela
    // media era o "Carregando", que nao tem titulo. Saia dali um
    // SEM_H1 numa tela que tem titulo.
    //
    // Pego numa rodada de estabilidade: mesma tela, tres execucoes,
    // duas certas e uma acusando SEM_H1. O defeito nao era a tela.
    //
    // Agora: segunda chance mais longa, porque a API divide um nucleo
    // com todo o resto. E se ainda assim nao carregar, a regua DIZ
    // que nao conseguiu medir, em vez de inventar um achado.
    let acalmou = await esperarAcalmar();
    // Nao acalmou: POR QUE? A resposta muda o remedio.
    if (!acalmou) {
      const porque = await retratoDaTela();

      // Caso 1: a API barrou a regua.
      //
      // O limite e 200 chamadas por minuto, e uma volta inteira gasta
      // 105 — medido. Uma volta cabe; duas coladas estouram, e ai a
      // tela desenha o aviso de excesso, que nao tem titulo. A regua
      // acusava "tela sem titulo" numa tela que tem titulo.
      //
      // Pedir de novo agora leva outro nao. A unica saida e esperar a
      // janela do limite virar.
      if (/Muitas requisi/i.test(porque.alerta ?? '')) {
        console.log(nome.padEnd(28), 'A API BARROU A REGUA - esperando a janela virar (60s)');
        await dormir(60000);
      }

      // Caso 2: busca pendurada. Esperar nao desentope; pedir de novo,
      // sim. Vale para os dois casos, entao fica fora do if.
      await recarregar(caminho);
      acalmou = await esperarAcalmar(30000);
    }

    if (!acalmou) {
      // SEGUNDA CHANCE, COM SESSAO NOVA.
      //
      // A causa mais comum de uma tela nao carregar no meio da
      // varredura nao e a tela: e o cracha de 15 minutos que
      // venceu. Entrar de novo e tentar uma vez separa o defeito
      // de verdade do cansaco da propria regua.
      //
      // Uma vez so: se nao carregar com sessao nova, o problema e
      // da tela, e insistir so faz a varredura demorar mais.
      await entrarNoSistema();
      await recarregar(caminho);
      acalmou = await esperarAcalmar(30000);
    }

    if (!acalmou) {
      // Desistir sem dizer o que se viu transforma o defeito em
      // misterio.
      const retrato = await retratoDaTela();

      relatorio.push({
        tela: nome,
        caminho,
        erro: 'nao carregou a tempo; medir agora seria medir o "Carregando"',
        retrato,
      });
      console.log(nome.padEnd(28), 'NAO CARREGOU -', JSON.stringify(retrato));
      continue;
    }

    // ----------------------------------------------------------
    //  `--abrir <texto do botao>`: mede com o modal ABERTO
    //
    //  Os formularios de criacao passaram a morar dentro de modal, e
    //  ate agora nenhuma regua entrava la: media-se a tela de tras e
    //  dizia-se que estava tudo certo. Verde sobre o que nao se
    //  mediu e pior que vermelho.
    //
    //  O texto e o do proprio botao, como a pessoa le: `--abrir
    //  "Nova locacao"`.
    // ----------------------------------------------------------
    const abrir = ABRIR ?? botaoDaTela;

    if (abrir) {
      const clicou = await js(`(() => {
        // Procura no texto E no aria-label.
        //
        // Botao cujo texto visivel e so um numero — "2", na barra
        // de paginas — nao da para achar por texto sem casar com
        // meia tela. O rotulo de acessibilidade ("Pagina 2") e
        // justamente o nome dele.
        const procurado = ${JSON.stringify(abrir)};
        const alvo = [...document.querySelectorAll('button, a')].find((b) =>
          (b.getAttribute('aria-label') || '').trim() === procurado ||
          (b.textContent || '').trim().includes(procurado),
        );
        if (!alvo) return 'nao achei o botao';
        alvo.click();
        return 'ok';
      })()`);

      if (clicou !== 'ok') {
        console.log(nome.padEnd(28), 'NAO ABRIU - ' + clicou);
        continue;
      }

      // O <dialog> anima ao abrir; medir antes disso le geometria
      // que nunca fica na tela.
      await esperarAcalmar(5000);
    }

    const achados = [];
    let estado = null;

    for (const largura of LARGURAS) {
      await cdp('Emulation.setDeviceMetricsOverride', {
        width: largura, height: ALTURA, deviceScaleFactor: 1, mobile: largura < 700,
      });
      await esperarLayoutParar(largura);

      const bruto = await js(MEDIR);
      const medido = JSON.parse(bruto);

      estado = estado ?? medido.estado;

      if (medido.larguraMedida !== largura) {
        achados.push({
          tipo: 'REGUA_NAO_REDIMENSIONOU',
          detalhe: 'pedi ' + largura + 'px e a pagina mediu ' + medido.larguraMedida + 'px',
          culpados: [],
          largura,
        });
      }

      // O achado carrega em qual largura apareceu: "alvo pequeno" no
      // celular e no computador são conversas diferentes.
      for (const a of medido.achados) achados.push({ ...a, largura });

      // Contraste só na largura grande, e nos dois temas: ele não
      // depende da largura, e medir duas vezes o mesmo seria pagar
      // o dobro por nada.
      if (largura === LARGURAS[0]) {
        // Desliga TODA transicao antes de trocar de tema.
        //
        // A troca de tema anima 160ms. Medindo dentro desse tempo, a
        // cor lida e uma cor intermediaria que nunca fica na tela: o
        // mesmo item do menu deu 2,39, 3,39 e 4,23 em telas
        // diferentes, quando o valor verdadeiro e 5,58. Contraste se
        // mede parado.
        await js(`(() => {
          const e = document.createElement('style');
          e.id = 'regua-sem-transicao';
          e.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
          document.head.appendChild(e);
        })()`);

        for (const tema of ['claro', 'escuro']) {
          await js(tema === 'escuro'
            ? "document.documentElement.setAttribute('data-tema', 'escuro')"
            : "document.documentElement.removeAttribute('data-tema')");
          await dormir(120);

          for (const a of JSON.parse(await js(CONTRASTE))) {
            achados.push({ ...a, largura, tema });
          }
        }

        // Volta ao claro, que e o padrao do sistema, e devolve as
        // transicoes. Sem isto a tela seguinte seria medida no escuro
        // e sem animacao nenhuma.
        await js("document.documentElement.removeAttribute('data-tema')");
        await js("document.getElementById('regua-sem-transicao')?.remove()");
        await dormir(80);
      }

      // O print de pagina inteira e a parte cara da medicao: numa tela
      // com 18 linhas de tabela ele sozinho leva mais que a medicao.
      // Com `--sem-print` a regua mede e nao fotografa — e o que basta
      // para fechar uma etapa. O print serve para eu OLHAR, e ai vale
      // rodar sem a opcao.
      //
      // Ele fica AQUI DENTRO, e nao depois do laco: fora, a janela ja
      // estava na ultima largura e toda foto saia de celular.
      //
      // E A FOTO NAO PODE DERRUBAR A MEDICAO.
      //
      // Ela estava dentro do mesmo `try` do laco. Quando o
      // `Page.captureScreenshot` nao respondia, a tela inteira virava
      // "NAO CONSEGUI MEDIR" — e o que se perdia era a MEDICAO, que ja
      // estava pronta trinta linhas acima, por causa do RETRATO, que e
      // enfeite.
      //
      // Custou 10 telas de 40 em 09/10/2026. O print falhava em bloco,
      // tarde na varredura, sem relacao com o tamanho da pagina:
      // `cadastros-alcadas`, de 1000px, falhou, e `admin-usuarios`, de
      // 1953px, passou. A causa da lentidao continua em aberto; o que
      // nao pode continuar e ela levar junto o dado que ja existia.
      //
      // DUAS TENTATIVAS, porque a falha e ALEATORIA.
      //
      // Medido em 09/10/2026, com os navegadores orfaos ja limpos:
      // 12 fotos de 120 falharam, espalhadas por telas diferentes e
      // larguras diferentes (420, 1440 e 1920), sem relacao com o
      // tamanho da pagina. Na primeira varredura do dia, sem prazo
      // nenhum, uma dessas penduruou a regua por 12 minutos — entao
      // isto e TRAVAMENTO, nao lentidao.
      //
      // Contra travamento aleatorio, esperar mais nao resolve;
      // pedir de novo, sim. Com ~10% de falha, a segunda tentativa
      // leva o buraco para ~1%.
      //
      // A causa de raiz continua em aberto. O suspeito e o
      // `captureBeyondViewport`, que redimensiona a superficie de
      // captura — mas suspeito nao e culpado, e nao vou escrever
      // aqui o que nao medi.
      if (!SEM_PRINT) {
        const sufixo = largura === LARGURAS[0] ? '' : '-' + largura;
        let guardou = false;

        for (let tentativa = 1; tentativa <= 2 && !guardou; tentativa += 1) {
          try {
            const { data } = await cdp('Page.captureScreenshot', {
              format: 'png',
              captureBeyondViewport: true,
            });
            writeFileSync(SAIDA + '/' + nome + sufixo + '.png', Buffer.from(data, 'base64'));
            guardou = true;
          } catch (e) {
            if (tentativa === 1) {
              console.log(nome.padEnd(28), 'foto falhou em ' + largura + 'px, tentando de novo');
              await dormir(500);
            } else {
              semFoto.push(nome + sufixo);
              console.log(nome.padEnd(28), 'sem foto em ' + largura + 'px:',
                String(e.message).slice(0, 60));
            }
          }
        }
      }
    }

    relatorio.push({ tela: nome, caminho, estado, achados });

    const resumo = achados.length === 0
      ? 'ok'
      : achados.map((a) => a.tipo + '@' + (a.tema ?? a.largura)).join(', ');
    console.log(nome.padEnd(28), resumo);
  } catch (e) {
    relatorio.push({ tela: nome, caminho, erro: String(e.message).slice(0, 160) });
    console.log(nome.padEnd(28), 'ERRO:', String(e.message).slice(0, 90));
  }
}

writeFileSync(SAIDA + '/achados.json', JSON.stringify(relatorio, null, 2));

if (semFoto.length > 0) {
  console.log('\n  SEM FOTO (medidas, mas sem retrato): ' + semFoto.join(', '));
}

console.log('\n==== RESUMO (' + ESCOLHIDAS.length + ' de ' + TELAS.length + ' telas · ' +
  LARGURAS.join('px, ') + 'px) ====');

if (ESCOLHIDAS.length === 0) {
  console.log('Nada mexido no frontend desde o ultimo marco: nada para medir.');
}

// ------------------------------------------------------------
//  A acao principal esta na mesma altura em todas as telas?
//
//  Comparacao ENTRE telas, que nenhuma regra por tela consegue
//  fazer. Uma tela nao sabe que o botao dela esta 40px mais baixo
//  que o da tela ao lado — so o conjunto sabe.
// ------------------------------------------------------------
{
  const alturas = relatorio
    .filter((t) => typeof t.estado?.acaoY === 'number')
    .map((t) => ({ tela: t.tela, y: t.estado.acaoY }));

  if (alturas.length > 1) {
    const menor = Math.min(...alturas.map((a) => a.y));
    const maior = Math.max(...alturas.map((a) => a.y));

    // 8px de folga: arredondamento de fonte e selo ao lado do
    // titulo mexem um fio, e cobrar pixel exato seria ruido.
    if (maior - menor > 8) {
      const fora = alturas.filter((a) => a.y !== menor);
      console.log('ACAO EM ALTURA DIFERENTE'.padEnd(32),
        (maior - menor) + 'px entre a mais alta e a mais baixa:',
        fora.slice(0, 5).map((a) => a.tela + '(' + a.y + ')').join(', '));
    } else {
      console.log('acao principal'.padEnd(32),
        alturas.length + ' tela(s) com o botao na mesma altura (' + menor + 'px)');
    }
  }
}

const naoMedidas = relatorio.filter((t) => t.erro);
if (naoMedidas.length > 0) {
  console.log('NAO CONSEGUI MEDIR' + ' '.repeat(14), naoMedidas.length + ' tela(s):',
    naoMedidas.map((t) => t.tela).join(', '));
}

for (const largura of LARGURAS) {
  const porTipo = new Map();

  for (const t of relatorio) {
    for (const a of (t.achados ?? []).filter((x) => x.largura === largura)) {
      if (!porTipo.has(a.tipo)) porTipo.set(a.tipo, []);
      porTipo.get(a.tipo).push(t.tela);
    }
  }

  for (const [tipo, telas] of [...porTipo].sort((a, b) => b[1].length - a[1].length)) {
    console.log(
      (tipo + '@' + largura).padEnd(32),
      telas.length + ' tela(s):',
      [...new Set(telas)].slice(0, 8).join(', '),
    );
  }
}

await fecharNavegador();
process.exit(naoMedidas.length > 0 ? 1 : 0);
