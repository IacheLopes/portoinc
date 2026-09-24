// ============================================================
//  Conferidor de padrão
//
//    npm run padrao
//
//  Lê o CÓDIGO-FONTE do frontend e acusa o que foge do combinado.
//  É o que faz "tudo padronizado" durar depois que eu sair de
//  perto: quem mexer no sistema descobre na hora, não numa revisão
//  seis meses depois.
//
//  ----------------------------------------------------------
//  A DÍVIDA CONHECIDA
//
//  O sistema foi construído antes do padrão existir, então hoje
//  ele já nasce com violações — 84 cartões escritos à mão, por
//  exemplo. Um conferidor que reprova desde o primeiro dia é um
//  conferidor que todo mundo aprende a ignorar.
//
//  Por isso ele compara com `padrao-divida.json`, que guarda
//  quanta dívida foi ACEITA. Ele reprova quando um número SOBE, e
//  avisa (sem reprovar) quando cai — aí é só atualizar o arquivo.
//  A dívida encolhe a cada etapa de design até chegar a zero.
//  ============================================================

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRONT = join(RAIZ, 'frontend', 'src');
const DIVIDA = join(RAIZ, 'scripts', 'padrao-divida.json');

// ------------------------------------------------------------
//  Leitura dos arquivos
// ------------------------------------------------------------
function arquivos(pasta, filtro) {
  const achados = [];

  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) achados.push(...arquivos(caminho, filtro));
    else if (filtro(nome)) achados.push(caminho);
  }

  return achados;
}

const ehTeste = (n) => n.includes('.test.');
const telas = arquivos(join(FRONT, 'paginas'), (n) => n.endsWith('.tsx') && !ehTeste(n));

// Cartao a mao tambem se esconde em componentes/. A regra olhava so
// as telas, e por isso disse "divida zero" enquanto o PainelDecisao
// desenhava um a mao — e ele quebrou quando o padding do .cartao saiu
// para o .cartao__corpo, no Design 6. Achado pelo dono do sistema em
// 2026-09-24, com o titulo "Sua decisao" cortado no topo.
const componentes = arquivos(join(FRONT, 'componentes'), (n) => n.endsWith('.tsx') && !ehTeste(n));
const fontes = arquivos(FRONT, (n) => (n.endsWith('.ts') || n.endsWith('.tsx')) && !ehTeste(n));
const estilos = arquivos(join(FRONT, 'estilos'), (n) => n.endsWith('.css'));

const curto = (c) => relative(RAIZ, c).replace(/\\/g, '/');

/**
 * Exceção declarada no próprio arquivo.
 *
 *   // padrao-ignora: sem-titulo — é conteúdo de aba, o título é do invólucro
 *
 * Sem isto a ferramenta obrigaria a inventar um título errado só
 * para ela calar a boca — que é como um conferidor piora o sistema
 * em vez de melhorar. A regra é declarar E dizer por quê.
 */
function dispensado(caminho, chave) {
  return new RegExp('padrao-ignora:\\s*' + chave + '\\b').test(readFileSync(caminho, 'utf8'));
}

// ------------------------------------------------------------
//  As regras
// ------------------------------------------------------------
const regras = [];

function regra(chave, titulo, porque, achar) {
  regras.push({ chave, titulo, porque, achados: achar() });
}

// --- Hierarquia de botão ---
// --- Vários botões principais: MUDOU DE CASA ---
//
// Esta regra saiu daqui no Design 4 e foi para a régua de tela.
//
// Daqui ela não tinha como acertar: conta `botao--principal` no
// arquivo, e o arquivo tem o botão da página, o do formulário e o
// do modal — que nunca aparecem ao mesmo tempo. Em Locação ela
// acusava três onde a pessoa vê um, e a dívida ficou parada em 13
// porque não havia o que consertar.
//
// Quem conta agora é `auditoria-ui.mjs`, que olha o que está de
// fato na tela.

// --- Cartão ---
regra(
  'cartao-na-mao',
  'Cartões escritos à mão',
  'Cartão é um componente só. Escrito à mão, cada tela ganha uma versão que envelhece sozinha.',
  () =>
    [...telas, ...componentes]
      // O proprio Cartao.tsx escreve `className="cartao"`: ele E o
      // cartao. Acusa-lo seria acusar a definicao de nao ser o uso.
      .filter((c) => !c.endsWith('Cartao.tsx'))
      .map((c) => ({
        c,
        n: (readFileSync(c, 'utf8')// `_` entra na excecao: sem ele a regra casava `cartao__corpo`,
        // que e parte da anatomia oficial e nao cartao a mao.
        .match(/className="cartao(?![a-z_-])/g) ?? []).length,
      }))
      .filter((x) => x.n > 0)
      .map((x) => curto(x.c) + ' (' + x.n + ')'),
);

// --- Formatação ---
const FORMATADORES_OFICIAIS = [
  'servicos/cadastros.ts',
  'servicos/solicitacoes.ts',
  // Casa oficial desde o Design 4: porcento, dias e dinheiroCurto
  // moram aqui. Acusar a função original é o conferidor mordendo a
  // própria cauda.
  'servicos/texto.ts',
];

regra(
  'formato-na-mao',
  'Dinheiro ou data formatados fora das funções oficiais',
  'Uma função para cada. Espalhado, um lugar mostra "1.234,5" e outro "1.234,50".',
  () =>
    fontes
      .filter((c) => !FORMATADORES_OFICIAIS.some((o) => curto(c).endsWith(o)))
      .map((c) => ({
        c,
        n: (readFileSync(c, 'utf8').match(/toLocale(String|DateString)\('pt-BR'/g) ?? []).length,
      }))
      .filter((x) => x.n > 0)
      .map((x) => curto(x.c) + ' (' + x.n + ')'),
);

// --- Título ---
regra(
  'tela-sem-titulo',
  'Telas sem título',
  'Um <h1> por tela. É por ele que o leitor de tela anuncia onde a pessoa chegou.',
  () =>
    telas
      .filter((c) => !dispensado(c, 'sem-titulo'))
      .filter((c) => {
        const s = readFileSync(c, 'utf8');
        // O cabeçalho padrão desenha o <h1> por dentro. A tela que o
        // usa tem título mesmo sem a tag aparecer no arquivo — e é o
        // caminho preferido, porque traz migalhas e Voltar junto.
        return !/<h1[\s>]/.test(s) && !s.includes('<CabecalhoDePagina');
      })
      .map(curto),
);

// --- Cabeçalho padrão ---
regra(
  'sem-cabecalho-padrao',
  'Telas sem o cabeçalho padrão',
  'É ele que traz o caminho e o Voltar. Antes dele, 25 das 34 telas não tinham para onde voltar.',
  () =>
    telas
      .filter((c) => !dispensado(c, 'sem-cabecalho'))
      .filter((c) => !readFileSync(c, 'utf8').includes('<CabecalhoDePagina'))
      .map(curto),
);

// --- Estados ---
regra(
  'lista-sem-estados',
  'Telas de lista sem os três estados',
  'Carregando, erro e vazio. Tela em branco sem explicação é a falha de uso mais comum que existe.',
  () =>
    telas
      .filter((c) => readFileSync(c, 'utf8').includes('<table'))
      .filter((c) => !dispensado(c, 'sem-estados'))
      .filter((c) => {
        const s = readFileSync(c, 'utf8');
        return !(s.includes('<Carregando') && s.includes('<Erro') && s.includes('<Vazio'));
      })
      .map(curto),
);

// --- Cor solta ---
regra(
  'cor-solta',
  'Cor escrita direto no CSS, fora dos tokens',
  'Toda cor sai de tokens.css. Solta, ela não troca junto com o tema.',
  () =>
    estilos
      .filter((c) => !c.endsWith('tokens.css'))
      .filter((c) => !dispensado(c, 'cor-solta'))
      .map((c) => {
        // Comentário fora primeiro.
        //
        // O conferidor acusava o próprio comentário que EXPLICA uma
        // correção: em painel.css estava escrito "este #b9cbe0 era de
        // quando a barra era azul-marinho", e ele contava isso como
        // cor solta. Uma regra que pune quem documenta a correção
        // ensina a não documentar.
        const s = readFileSync(c, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        const n = (s.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
        return { c, n };
      })
      .filter((x) => x.n > 0)
      .map((x) => curto(x.c) + ' (' + x.n + ')'),
);

// --- Espaçamento solto ---
regra(
  'espaco-solto',
  'Espaçamento em px fora da escala',
  'Só a escala --esp-*. Valor solto é o que faz uma tela respirar diferente da outra.',
  () =>
    estilos
      .filter((c) => !c.endsWith('tokens.css'))
      .map((c) => {
        const s = readFileSync(c, 'utf8');
        // Só padding/margin/gap com px. Largura e altura em px são
        // outra conversa: um ícone de 20px não é espaçamento.
        //
        // E só a partir de 4px, que é onde a escala começa (--esp-1).
        // Abaixo disso não existe valor da escala para usar: 1px é o
        // fio entre barras empilhadas, -1px é a aba sobrepondo a
        // borda do quadro. São truques de desenho, não espaçamento —
        // e acusá-los deixava quatro dívidas paradas que ninguém
        // podia pagar.
        const n = (s.match(/^\s*(padding|margin|gap)[^:]*:[^;]*\d+px/gm) ?? [])
          .filter((linha) => (linha.match(/(\d+)px/g) ?? [])
            .some((v) => Number(v.replace('px', '')) >= 4))
          .length;
        return { c, n };
      })
      .filter((x) => x.n > 0)
      .map((x) => curto(x.c) + ' (' + x.n + ')'),
);

// ------------------------------------------------------------
//  Comparação com a dívida aceita
// ------------------------------------------------------------
const aceito = existsSync(DIVIDA) ? JSON.parse(readFileSync(DIVIDA, 'utf8')) : {};
const atual = Object.fromEntries(regras.map((r) => [r.chave, r.achados.length]));

if (process.argv.includes('--aceitar')) {
  writeFileSync(DIVIDA, JSON.stringify(atual, null, 2) + '\n');
  console.log('\n  Dívida registrada em ' + curto(DIVIDA) + ':\n');
  for (const r of regras) console.log('    ' + String(r.achados.length).padStart(4) + '  ' + r.titulo);
  console.log('');
  process.exit(0);
}

console.log('');

// Com `--onde` ele lista os arquivos de cada divida, e nao so a
// contagem. Saber que ha 20 cartoes a mao nao ajuda ninguem a
// conserta-los; saber QUAIS, sim.
const ONDE = process.argv.includes('--onde');

let piorou = false;
let melhorou = false;

for (const r of regras) {
  const limite = aceito[r.chave] ?? 0;
  const agora = r.achados.length;

  if (agora > limite) {
    piorou = true;
    console.log('  PIOROU   ' + r.titulo + ': ' + agora + ' (aceito: ' + limite + ')');
    console.log('           ' + r.porque);
    for (const a of r.achados.slice(0, 8)) console.log('             - ' + a);
    if (r.achados.length > 8) console.log('             ... e mais ' + (r.achados.length - 8));
    console.log('');
  } else if (agora < limite) {
    melhorou = true;
    console.log('  melhorou ' + r.titulo + ': ' + agora + ' (era ' + limite + ')');
    if (ONDE) for (const a of r.achados) console.log('             - ' + a);
  } else if (agora > 0) {
    console.log('  dívida   ' + r.titulo + ': ' + agora);
    if (ONDE) for (const a of r.achados) console.log('             - ' + a);
  } else {
    console.log('  ok       ' + r.titulo);
  }
}

console.log('');

if (melhorou) {
  console.log('  Alguma dívida caiu. Registre o novo patamar:');
  console.log('    npm run padrao -- --aceitar');
  console.log('');
}

if (piorou) {
  console.log('  REPROVADO: algo saiu do padrão.');
  console.log('');
  process.exit(1);
}

console.log('  Aprovado.');
console.log('');
