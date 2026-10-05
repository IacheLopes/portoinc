// ============================================================
//  Pente-fino: acha defeito LENDO o codigo, sem navegador.
//
//  Por que ele existe
//
//  A regua de telas (auditoria-ui.mjs) sobe o Edge, faz login e
//  visita 34 rotas. Custa ~25s por volta. Rodada como LACO de
//  correcao — mede, conserta, mede de novo — ela consumiu horas
//  ao longo dos nove Designs.
//
//  So que o defeito do cartao de locacao rasgado ao meio foi
//  achado LENDO o CSS, em minutos, sem navegador nenhum. E os
//  irmaos dele sao todos achaveis do mesmo jeito.
//
//  Divisao de trabalho, entao:
//    - este script acha CLASSE de defeito, em ~1 segundo
//    - a regua de telas confirma, UMA vez, no fim
//    - o navegador serve para eu VER, nao para acusar
//
//  As regras 4 a 8 vem da skill `frontend-design` da Anthropic:
//  sao os sinais de design generico que ela manda evitar.
// ============================================================

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const ESTILOS = join(RAIZ, 'frontend/src/estilos');
const FONTE = join(RAIZ, 'frontend/src');

const achados = [];
function achar(regra, arquivo, linha, detalhe) {
  achados.push({ regra, arquivo: relative(RAIZ, arquivo).replace(/\\/g, '/'), linha, detalhe });
}

/** Tira comentario, para nenhuma regra acusar o texto que EXPLICA a regra. */
function semComentario(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Numero da linha de um indice no texto. */
function linhaDe(texto, i) {
  return texto.slice(0, i).split('\n').length;
}

const arquivosCss = readdirSync(ESTILOS)
  .filter((f) => f.endsWith('.css'))
  .map((f) => join(ESTILOS, f));

// ------------------------------------------------------------
//  1. Regra de desktop sobrevivendo dentro do modo cartao
//
//  ESTE e o defeito da foto 3. Abaixo de 640px a linha da tabela
//  vira cartao e nao existe mais COLUNA — mas a regra que
//  estreitava a coluna continua valendo, e prende a celula.
// ------------------------------------------------------------
// O `\s*` fica FORA do grupo: a declaracao quase sempre vem depois de
// uma quebra de linha e de indentacao. Sem isso a regra passava por cima
// de `.celula-texto { max-width: 180px }` — o defeito que motivou o script.
const PROP_DE_LARGURA = /(?:^|[;{])\s*(max-width|min-width|width)\s*:\s*([^;}]+)/g;
const ALVO_DE_CELULA = /(^|[\s,>])(td|th|\.celula[\w-]*|\.tabela\s)/;

/** Valores que NAO sao teto de largura, e sim truque conhecido de tabela:
 *    width: 1%  -> manda a coluna encolher ate caber o conteudo
 *    width: 1px -> parte da tecnica de esconder so para leitor de tela
 *  Nenhum dos dois prende celula dentro de cartao. */
const TRUQUE_DE_TABELA = /^(auto|100%|none|1%|1px)$/;

/** Escapou do modo cartao? So se disser isso explicitamente. */
const FORA_DO_CARTAO = /:not\(\s*\.tabela-area--cartoes\s*\)/;

for (const arq of arquivosCss) {
  const bruto = readFileSync(arq, 'utf8');
  const css = semComentario(bruto);

  // ---- 1a. A regra SEM media query nenhuma.
  //
  // Foi o que me escapou em 24/09/2026: consertei o teto de 180px
  // dentro do @media e nao vi que existia um teto de 260px solto,
  // valendo em TODA largura. O cartao continuou rasgado, so que
  // em 75% em vez de 53%. Teto de largura em celula e suspeito
  // onde quer que ele esteja.
  for (const regra of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const seletor = regra[1].trim();
    if (!ALVO_DE_CELULA.test(seletor) || FORA_DO_CARTAO.test(seletor)) continue;
    if (/@/.test(seletor)) continue;
    for (const decl of regra[2].matchAll(PROP_DE_LARGURA)) {
      const valor = decl[2].trim();
      if (TRUQUE_DE_TABELA.test(valor)) continue;
      achar('CELULA_PRESA_NO_CARTAO', arq, linhaDe(css, regra.index),
        `sem @media · ${seletor} { ${decl[1]}: ${valor} }`);
    }
  }

  // ---- 1b. Acha cada bloco @media (max-width: N) por contagem de chaves.
  const aberturas = [...css.matchAll(/@media[^{]*max-width\s*:\s*(\d+)px[^{]*\{/g)];

  for (const abre of aberturas) {
    const limite = Number(abre[1]);
    if (limite > 700) continue; // acima disso nao e o modo cartao

    let prof = 1;
    let i = abre.index + abre[0].length;
    const inicio = i;
    while (i < css.length && prof > 0) {
      if (css[i] === '{') prof++;
      else if (css[i] === '}') prof--;
      i++;
    }
    const bloco = css.slice(inicio, i - 1);

    // Dentro do bloco, cada regra "seletor { corpo }"
    for (const regra of bloco.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const seletor = regra[1].trim();
      const corpo = regra[2];
      if (!ALVO_DE_CELULA.test(seletor) || FORA_DO_CARTAO.test(seletor)) continue;

      for (const decl of corpo.matchAll(PROP_DE_LARGURA)) {
        const valor = decl[2].trim();
        if (TRUQUE_DE_TABELA.test(valor)) continue;
        achar(
          'CELULA_PRESA_NO_CARTAO',
          arq,
          linhaDe(css, inicio + regra.index),
          `@${limite}px · ${seletor} { ${decl[1]}: ${valor} }`,
        );
      }
    }
  }
}

// ------------------------------------------------------------
//  2. Grade de coluna FIXA no celular
//
//  ESTE e o defeito da foto 1: `repeat(2, ...)` obriga duas
//  colunas mesmo quando o conteudo nao cabe, e deixa cartao
//  orfao quando o numero e impar.
// ------------------------------------------------------------
for (const arq of arquivosCss) {
  const css = semComentario(readFileSync(arq, 'utf8'));
  for (const m of css.matchAll(/grid-template-columns\s*:\s*repeat\(\s*(\d+)\s*,/g)) {
    achar('GRADE_DE_COLUNA_FIXA', arq, linhaDe(css, m.index), `repeat(${m[1]}, ...) — nao se adapta ao conteudo`);
  }
}

// ------------------------------------------------------------
//  2b. Cor de linha pintada nas CELULAS, sem contrapartida no
//      modo cartao.
//
//  `.linha-vencida > * { background }` e o certo enquanto a linha
//  e linha. No celular a linha vira cartao e as celulas ficam
//  recuadas pelo padding dele: a cor virava retangulos soltos com
//  moldura branca em volta. Visto no iPhone em 2026-09-24 — a
//  regua de telas nao pega, porque nada transborda nem rola.
//
//  A regra cobra que exista, em algum lugar, uma regra com
//  `.tabela-area--cartoes` citando a mesma classe.
// ------------------------------------------------------------
{
  const todoCss = arquivosCss.map((f) => semComentario(readFileSync(f, 'utf8'))).join('\n');

  for (const arq of arquivosCss) {
    const css = semComentario(readFileSync(arq, 'utf8'));
    for (const m of css.matchAll(/(\.[\w-]+)\s*>\s*\*\s*\{([^}]*)\}/g)) {
      if (!/background\s*:/.test(m[2])) continue;
      const classe = m[1];
      const temCartao = new RegExp('\\.tabela-area--cartoes[^{}]*\\' + classe + '\\b').test(todoCss);
      if (temCartao) continue;
      achar('COR_DE_LINHA_SEM_MODO_CARTAO', arq, linhaDe(css, m.index),
        `${classe} > * pinta a celula, e nada repinta o cartao no celular`);
    }
  }
}

// ------------------------------------------------------------
//  2c. A tecnica de "so para leitor de tela" aplicada num <table>
//
//  `.apenas-leitor-tela` encolhe a caixa para 1px e recorta o
//  resto. Num <table> nao funciona: a largura MINIMA do conteudo
//  vence o `width: 1px`, e a tabela fica com a largura real —
//  invisivel, mas empurrando a pagina.
//
//  Medido em 2026-09-24: 574px numa tela de 393, em 4 telas. O
//  celular disfarcava encolhendo a pagina inteira para caber; so
//  apareceu depois que `minimum-scale=1` proibiu o encolhimento.
//
//  A correcao e por a classe num <div> em volta.
// ------------------------------------------------------------
{
  const tsx = [];
  (function anda(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = join(dir, e.name);
      if (e.isDirectory()) anda(f);
      else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) tsx.push(f);
    }
  })(FONTE);

  for (const f of tsx) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<table[^>]*className=["'{][^>]*apenas-leitor-tela/g)) {
      achar('ESCONDER_TABELA_PELA_CLASSE', f, s.slice(0, m.index).split('\n').length,
        '<table> nao obedece width:1px — ponha a classe num <div> em volta');
    }
  }
}

// ------------------------------------------------------------
//  3. Emoji fazendo papel de icone
// ------------------------------------------------------------
const EMOJI = /\p{Extended_Pictographic}/gu;
let totalEmoji = 0;
const arquivosComEmoji = [];
(function anda(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) anda(f);
    else if (/\.(tsx?|css)$/.test(e.name) && !/\.test\./.test(e.name)) {
      const m = readFileSync(f, 'utf8').match(EMOJI);
      if (m) { totalEmoji += m.length; arquivosComEmoji.push([relative(RAIZ, f).replace(/\\/g, '/'), m.length]); }
    }
  }
})(FONTE);

// ------------------------------------------------------------
//  3b. Classe usada no TSX que NINGUEM escreveu no CSS
//
//  Nasceu de um defeito de 24/09/2026. O CabecalhoDePagina punha
//  o titulo e o selo de situacao dentro de um
//  <div className="cabecalho__titulo-com-selos">, contando com um
//  `display: flex` que nunca chegou a ser escrito. Sem ele o <div>
//  e bloco comum, o <h1> toma a linha inteira e o selo desaba para
//  baixo do titulo — em TODAS as 5 telas de detalhe do sistema.
//
//  Nao aparecia em teste: o jsdom nao le folha de estilo, e a
//  marcacao estava certa. Nao aparecia na regua de tela: nada
//  transborda nem rola, so fica feio. E nao aparecia no build: para
//  o TypeScript e uma string qualquer.
//
//  Uma classe sem estilo e uma promessa que ninguem cumpriu. Custa
//  0,1s conferir todas.
// ------------------------------------------------------------
{
  const definidas = new Set();
  for (const arq of arquivosCss) {
    // Com comentario mesmo: um seletor comentado ainda documenta
    // que o nome existe, e o que eu quero pegar e o nome ORFAO.
    for (const m of readFileSync(arq, 'utf8').matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) {
      definidas.add(m[1]);
    }
  }

  const tsx = [];
  (function anda(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = join(dir, e.name);
      if (e.isDirectory()) anda(f);
      else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) tsx.push(f);
    }
  })(FONTE);

  for (const f of tsx) {
    const s = readFileSync(f, 'utf8');

    // className="a b"  ·  className={'a b'}  ·  className={`a b`}
    for (const m of s.matchAll(/className=(?:"([^"]*)"|\{'([^']*)'|\{`([^`$]*)`)/g)) {
      for (const nome of (m[1] ?? m[2] ?? m[3]).split(/\s+/)) {
        if (!nome || definidas.has(nome)) continue;

        // `'selo--' + tipo` deixa "selo--" solto no texto: e o
        // comeco de um nome montado na hora, nao uma classe orfa.
        if (/(--|__)$/.test(nome)) continue;

        achar('CLASSE_SEM_ESTILO', f, s.slice(0, m.index).split('\n').length,
          '.' + nome + ' — usada aqui, nao existe em nenhum .css');
      }
    }
  }
}

// ------------------------------------------------------------
//  9. Situacao que o banco tem e a tela nao conhece
//
//  A SOL-00003 e a SOL-00006 apareceram na lista com a coluna
//  Situacao VAZIA, em 27/09/2026. O banco tinha `EM_COTACAO`; o
//  tipo da tela, nao. `ROTULO_SITUACAO['EM_COTACAO']` dava
//  `undefined`, e o selo saia em branco — a linha ficava sem
//  situacao nenhuma, como se estivesse em lugar nenhum.
//
//  O TypeScript nao pega: o valor vem da API como TEXTO e e
//  convertido para o tipo na fronteira. Mentir ali nao custa erro
//  de compilacao, custa selo em branco na tela.
//
//  Entao a conferencia e aqui: cada `enum` do schema contra o
//  `Record<Tipo, string>` que o traduz. Se o banco souber um nome
//  que a tela nao sabe, aparece.
// ------------------------------------------------------------
{
  const schema = readFileSync(join(RAIZ, 'backend/prisma/schema.prisma'), 'utf8');
  const servicos = join(FONTE, 'servicos');

  const ts = readdirSync(servicos)
    .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
    .map((f) => join(servicos, f));

  const textoDaTela = ts.map((f) => ({ arq: f, txt: readFileSync(f, 'utf8') }));

  for (const m of schema.matchAll(/enum\s+(Situacao\w+)\s*\{([^}]+)\}/g)) {
    const nome = m[1];
    const valores = m[2]
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter((l) => /^[A-Z][A-Z0-9_]*$/.test(l));

    if (valores.length === 0) continue;

    // Acha o Record que traduz esse enum. O nome do tipo na tela
    // e o mesmo do enum no banco, por convencao da casa.
    for (const { arq, txt } of textoDaTela) {
      for (const r of txt.matchAll(
        new RegExp('Record<\\s*' + nome + '\\s*,[^>]*>\\s*=\\s*\\{([^}]+)\\}', 'g'),
      )) {
        const traduzidos = new Set(
          [...r[1].matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:/gm)].map((x) => x[1]),
        );

        const faltando = valores.filter((v) => !traduzidos.has(v));
        if (faltando.length > 0) {
          achar(
            'SITUACAO_SEM_NOME_NA_TELA',
            arq,
            linhaDe(txt, r.index),
            nome + ': o banco tem ' + faltando.join(', ') + ' e este mapa nao — o selo sai vazio',
          );
        }
      }
    }
  }
}

// ------------------------------------------------------------
//  10. Filtro que sai de fininho quando nao reconhece o valor
//
//  A rota da lista de solicitacoes validava assim:
//
//    ...(situacao && SITUACOES.includes(situacao) ? { situacao } : {})
//
//  Quando a situacao ATENDIDA nasceu, aquela lista nao soube — e o
//  valor caiu no `: {}`. Resultado: a tela devolvia as SETE
//  solicitacoes com a caixa dizendo "Atendida". O dono achou que o
//  filtro estava quebrado e nao tinha como saber por que.
//
//  Filtro que MENTE e pior que filtro que da erro. O certo e
//  recusar com 400 e dizer quais valores existem.
//
//  A regra procura o formato, nao o nome: qualquer ternario cuja
//  condicao seja um `.includes(` e cujo galho falso seja `{}`.
// ------------------------------------------------------------
{
  const rotas = join(RAIZ, 'backend/src/rotas');

  for (const f of readdirSync(rotas).filter((x) => x.endsWith('.ts') && !x.includes('.test.'))) {
    const arq = join(rotas, f);
    const txt = readFileSync(arq, 'utf8');

    // O galho verdadeiro do ternario tem `:` dentro dele — e um
    // objeto. A primeira versao desta regra parava no primeiro `:`
    // e nao pegava nada; so descobri porque testei contra o codigo
    // velho antes de dar por pronta.
    for (const m of txt.matchAll(/\.includes\([^)]{0,120}\)[\s\S]{0,40}?\?[\s\S]{0,200}?:\s*\{\s*\}/g)) {
      achar(
        'FILTRO_QUE_SAI_DE_FININHO',
        arq,
        linhaDe(txt, m.index),
        'valor nao reconhecido vira "sem filtro" — a tela mostra tudo achando que filtrou',
      );
    }
  }
}

// ------------------------------------------------------------
//  11. Mensagem saindo por fora da porta unica
//
//  A trava que impede o sistema de mandar WhatsApp para numero
//  de desconhecido NAO mora no adaptador: mora no servico
//  `enviarPeloWhatsApp`. Quem chama `integracoes.whatsapp.enviar`
//  direto pula a lista de autorizados E o historico.
//
//  Tres rotas faziam isso — inclusive o botao "Abrir cotacao",
//  que o dono usou na gravacao. Com o Baileys ligado, aquele
//  clique teria mandado mensagem para o numero cadastrado do
//  fornecedor com o modo de teste LIGADO. Achado em 29/09/2026,
//  na vespera de conectar o primeiro celular.
//
//  O proprio cabecalho do servico ja dizia "nenhuma mensagem sai
//  sem passar por aqui". A intencao estava escrita; o codigo e
//  que nao obedecia. Agora a regua cobra.
//
//  Mesma coisa para o e-mail, pelo mesmo motivo.
// ------------------------------------------------------------
{
  const portas = { whatsapp: 'enviarPeloWhatsApp', email: 'enviarPorEmail' };
  const pastas = ['rotas', 'servicos'];

  for (const pasta of pastas) {
    const dir = join(RAIZ, 'backend/src', pasta);
    if (!existsSync(dir)) continue;

    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && !x.includes('.test.'))) {
      const arq = join(dir, f);

      // O proprio servico E a porta: ele PODE chamar o adaptador.
      if (/whatsapp\.ts$|email\.ts$/.test(f) && pasta === 'servicos') continue;

      const txt = readFileSync(arq, 'utf8');

      for (const [canal, servico] of Object.entries(portas)) {
        const chamada = new RegExp('integracoes\\.' + canal + '\\.enviar\\s*\\(', 'g');

        for (const m of txt.matchAll(chamada)) {
          achar(
            'ENVIO_FORA_DA_PORTA_UNICA',
            arq,
            linhaDe(txt, m.index),
            'chama o adaptador direto e pula a trava de autorizados — use ' + servico + '()',
          );
        }
      }
    }
  }
}

// ------------------------------------------------------------
//  12. Pagina pedida sem total contado
//
//  Uma lista paginada e DUAS consultas: o `count`, que diz
//  quantas existem, e o `findMany` com `skip`/`take`, que traz as
//  da pagina. Se a rota traz a pagina e nao conta o total, a tela
//  nao tem como desenhar a barra — e volta a dizer "20 listadas"
//  como se fossem todas.
//
//  Era exatamente o defeito antigo, com outra roupa: as dez
//  listas pediam `take: 200` e devolviam o corte como se fosse
//  tudo. Quem escrever a decima primeira lista vai copiar uma das
//  dez; esta regra cobra o par.
// ------------------------------------------------------------
{
  const rotas = join(RAIZ, 'backend/src/rotas');

  for (const f of readdirSync(rotas).filter((x) => x.endsWith('.ts') && !x.includes('.test.'))) {
    const arq = join(rotas, f);
    const txt = readFileSync(arq, 'utf8');

    // Divide por rota: cada `app.get(`/app.post(` comeca um trecho.
    const inicios = [...txt.matchAll(/\n\s*app\.(get|post|patch|delete)\s*\(/g)].map((m) => m.index);

    for (let i = 0; i < inicios.length; i++) {
      const trecho = txt.slice(inicios[i], inicios[i + 1] ?? txt.length);

      const pedePagina = /skip:\s*pedido\.pular/.test(trecho);
      const conta = /\.count\s*\(/.test(trecho);
      const devolveConta = /camposDaPagina\s*\(/.test(trecho);

      if (pedePagina && !(conta && devolveConta)) {
        achar(
          'PAGINA_SEM_TOTAL',
          arq,
          linhaDe(txt, inicios[i]),
          'traz a pagina mas nao ' + (conta ? 'devolve camposDaPagina' : 'conta o total') +
            ' — a tela nao consegue desenhar a barra',
        );
      }
    }
  }
}

// ------------------------------------------------------------
//  13. Meia barra de paginas
//
//  A barra e feita de DUAS pecas que trabalham em lugares
//  diferentes: <ContaDaPagina/> em cima da lista, que e o que o
//  olho encontra depois de a tela rolar, e <Paginacao/> embaixo,
//  onde a pessoa age no fim da leitura.
//
//  Elas andam juntas. Sem o contador, o dono clica em "2" e se
//  pergunta "sera que eu fui para a proxima pagina?" — foi a
//  duvida que originou a divisao. Sem a barra, o contador diz
//  "mostrando 1 a 20 de 347" e nao da caminho para as outras 327.
// ------------------------------------------------------------
{
  const dir = join(RAIZ, 'frontend/src/paginas');

  const varrer = (pasta) => {
    for (const nome of readdirSync(pasta, { withFileTypes: true })) {
      const caminho = join(pasta, nome.name);

      if (nome.isDirectory()) {
        varrer(caminho);
        continue;
      }

      if (!nome.name.endsWith('.tsx') || nome.name.includes('.test.')) continue;

      const txt = readFileSync(caminho, 'utf8');
      const temBarra = /<Paginacao\b/.test(txt);
      const temConta = /<ContaDaPagina\b/.test(txt);

      if (temBarra !== temConta) {
        achar(
          'MEIA_BARRA_DE_PAGINAS',
          caminho,
          linhaDe(txt, txt.search(temBarra ? /<Paginacao\b/ : /<ContaDaPagina\b/)),
          temBarra
            ? 'tem a barra e nao tem o contador — quem clica nao ve que mudou de pagina'
            : 'tem o contador e nao tem a barra — nao da caminho para as outras paginas',
        );
      }
    }
  };

  if (existsSync(dir)) varrer(dir);
}

// ------------------------------------------------------------
//  14. Painel que volta a esticar os cartoes
//
//  As grades de Relatorios e Financeiro declaram
//  `align-items: start` de proposito. Sem isso, o navegador estica
//  todo cartao ate a altura do mais alto da fileira, e o resultado
//  e caixa com borda e vazio dentro.
//
//  O dono achou dois casos no mesmo dia, em 05/10/2026: abrir o "?"
//  de UM indicador esticava os quatro da fileira, deixando tres
//  caixas com 94px de nada; e o cartao da rosca, ao lado de um
//  ranking mais alto, ficava com 172px vazios embaixo do desenho.
//  Palavras dele: "quebra, ta feio".
//
//  A regua mede o RESULTADO, e so cobra onde a grade declarou nao
//  esticar — nas grades de catalogo alinhar e o acordo. Entao se
//  alguem apagar esta linha, a regua para de cobrar junto, e as
//  duas silenciam ao mesmo tempo. Esta regra existe para isso nao
//  passar: ela cobra a INTENCAO, no texto do CSS.
// ------------------------------------------------------------
{
  const arq = join(RAIZ, 'frontend/src/estilos/graficos.css');

  if (existsSync(arq)) {
    const css = readFileSync(arq, 'utf8');

    // O bloco que declara as duas grades, ate a chave de fechar.
    const bloco = css.match(/\.painel-financeiro,\s*\n\.painel-relatorio\s*\{[\s\S]*?\n\}/);

    if (!bloco) {
      achar(
        'PAINEL_SEM_ALINHAMENTO',
        arq,
        1,
        'nao achei o bloco das grades de painel — a regra abaixo nao esta cobrando nada',
      );
    } else if (!/align-items:\s*(start|flex-start)/.test(bloco[0])) {
      achar(
        'PAINEL_SEM_ALINHAMENTO',
        arq,
        linhaDe(css, bloco.index),
        'a grade do painel voltou a esticar os cartoes — caixa com vazio dentro',
      );
    }

    // E o contrario, para os cartoes de GRAFICO.
    //
    // Eles sao a excecao: ficam dois a dois e esticam de proposito,
    // para os fundos alinharem. Quem faz isso e um `align-self:
    // stretch` neles, por cima do `start` da grade.
    //
    // Sem essa linha os pares voltam a terminar em alturas
    // diferentes — "veja, n ta alinhado", 05/10/2026 — e a regua
    // nao acusa junto: sem esticar, nao ha vazio para ela medir.
    // Por isso a cobranca e aqui, no texto do CSS.
    if (!/\.painel-relatorio\s*>\s*\.col-meia[\s\S]{0,200}align-self:\s*stretch/.test(css)) {
      achar(
        'GRAFICOS_SEM_PAREAR',
        arq,
        1,
        'os cartoes de grafico pararam de esticar — os pares vao terminar desalinhados',
      );
    }
  }
}

// ------------------------------------------------------------
//  4 a 8. Os sinais de design generico, da skill frontend-design
// ------------------------------------------------------------
const usoDeRaio = {};
const usoDeSombra = {};
let maiusculas = 0;

for (const arq of arquivosCss) {
  const css = semComentario(readFileSync(arq, 'utf8'));

  for (const m of css.matchAll(/var\(\s*(--raio-[\w-]+)\s*\)/g)) usoDeRaio[m[1]] = (usoDeRaio[m[1]] ?? 0) + 1;
  for (const m of css.matchAll(/var\(\s*(--sombra-[\w-]+)\s*\)/g)) usoDeSombra[m[1]] = (usoDeSombra[m[1]] ?? 0) + 1;

  for (const m of css.matchAll(/text-transform\s*:\s*uppercase/g)) {
    maiusculas++;
    achar('ROTULO_EM_MAIUSCULA', arq, linhaDe(css, m.index), 'tell #5 da skill: eyebrow ALL-CAPS');
  }
}

// ------------------------------------------------------------
//  Relatorio
// ------------------------------------------------------------
const porRegra = {};
for (const a of achados) (porRegra[a.regra] ??= []).push(a);

console.log('\n================ PENTE-FINO ================\n');

for (const [regra, lista] of Object.entries(porRegra)) {
  console.log(`${regra}  (${lista.length})`);
  for (const a of lista) console.log(`    ${a.arquivo}:${a.linha}  ${a.detalhe}`);
  console.log('');
}

console.log(`EMOJI_COMO_ICONE  (${totalEmoji} em ${arquivosComEmoji.length} arquivos)`);
for (const [f, n] of arquivosComEmoji.sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`    ${String(n).padStart(3)}  ${f}`);
}
console.log(`    ... e mais ${Math.max(0, arquivosComEmoji.length - 8)} arquivo(s)\n`);

console.log('HIERARQUIA (tell #4 da skill: um raio e uma sombra para tudo)');
console.log('    raio   ', Object.entries(usoDeRaio).map(([k, v]) => `${k.replace('--raio-', '')}=${v}`).join('  ') || '(nenhum)');
console.log('    sombra ', Object.entries(usoDeSombra).map(([k, v]) => `${k.replace('--sombra-', '')}=${v}`).join('  ') || '(nenhuma)');

console.log(`\n==== ${achados.length + totalEmoji} ponto(s) para olhar ====\n`);
