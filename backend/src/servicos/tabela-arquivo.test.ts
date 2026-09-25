// ============================================================
//  Testes do gerador de PDF e Word
//
//  Não dá para "olhar" o arquivo num teste automatizado, mas dá
//  para conferir o que mais quebra na prática:
//
//    - o arquivo é mesmo do formato que diz ser
//    - o texto que deveria estar lá está
//    - tabela comprida vira mais de uma folha, sem folha em branco
//    - tabela vazia não explode
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

import {
  gerarPdfDaTabela, gerarDocxDaTabela, gerarArquivoDaTabela, formatoValido,
  type TabelaParaArquivo,
} from './tabela-arquivo.js';

function tabela(extra: Partial<TabelaParaArquivo> = {}): TabelaParaArquivo {
  return {
    arquivo: 'teste',
    titulo: 'Relatório de teste',
    subtitulo: 'Para conferir o gerador',
    resumo: [{ rotulo: 'Obra', valor: 'OB-001 · Residencial' }],
    tabelas: [{
      colunas: [
        { titulo: 'Código', campo: 'codigo' },
        { titulo: 'Descrição', campo: 'descricao', peso: 3 },
        { titulo: 'Valor', campo: 'valor', numero: true },
      ],
      linhas: [
        { codigo: '00119', descricao: 'Cimento Portland', valor: 'R$ 1.200,00' },
        { codigo: '00210', descricao: 'Areia média lavada', valor: 'R$ 340,50' },
      ],
    }],
    ...extra,
  };
}

/** Quantas folhas o PDF tem de verdade. */
function folhas(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

/**
 * O PDF guarda o texto em WinAnsi, que é quase latin1 — só a faixa
 * 0x80–0x9F muda. Sem esta tradução, o travessão "—" voltaria como
 * um byte solto e o teste acusaria um erro que não existe.
 */
const WINANSI: Record<string, string> = {
  '\x91': '‘', '\x92': '’',
  '\x93': '“', '\x94': '”',
  '\x96': '–', '\x97': '—',
  '\x85': '…',
};

function deWinAnsi(texto: string): string {
  return texto.replace(/[\x80-\x9F]/g, (c) => WINANSI[c] ?? c);
}

/** Todo o texto do PDF, juntando os fluxos de conteúdo. */
function textoDoPdf(pdf: Buffer): string {
  let saida = '';
  let pos = 0;

  while (true) {
    const inicio = pdf.indexOf('stream', pos);
    if (inicio < 0) break;

    let dados = inicio + 'stream'.length;
    if (pdf[dados] === 0x0d) dados += 1;
    if (pdf[dados] === 0x0a) dados += 1;

    const fim = pdf.indexOf('endstream', dados);
    if (fim < 0) break;

    // "endstream" contém "stream": pular só um byte faria o laço
    // casar de novo dentro dele e perder o fluxo seguinte.
    pos = fim + 'endstream'.length;

    try {
      const conteudo = inflateSync(pdf.subarray(dados, fim)).toString('latin1');
      for (const grupo of conteudo.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
        for (const hex of grupo[1].matchAll(/<([0-9a-fA-F]*)>/g)) {
          saida += Buffer.from(hex[1], 'hex').toString('latin1');
        }
      }
    } catch {
      // Fluxo que não é conteúdo de página (fonte, por exemplo).
    }
  }

  return deWinAnsi(saida);
}

describe('Qual formato existe', () => {
  it('aceita só PDF e Word', () => {
    assert.equal(formatoValido('pdf'), true);
    assert.equal(formatoValido('docx'), true);
  });

  it('recusa o que não existe', () => {
    for (const ruim of ['csv', 'xlsx', 'PDF', '', null, undefined, 7]) {
      assert.equal(formatoValido(ruim), false, JSON.stringify(ruim) + ' não deveria passar');
    }
  });
});

describe('PDF', () => {
  it('é um PDF de verdade', async () => {
    const pdf = await gerarPdfDaTabela(tabela());

    assert.equal(pdf.subarray(0, 4).toString('latin1'), '%PDF');
    assert.ok(pdf.length > 1000);
  });

  it('leva o título, o contexto e as linhas', async () => {
    const texto = textoDoPdf(await gerarPdfDaTabela(tabela()));

    assert.match(texto, /Relatório de teste/);
    assert.match(texto, /OB-001/);
    assert.match(texto, /Cimento Portland/);
    assert.match(texto, /R\$ 1\.200,00/);
  });

  it('tabela curta cabe numa folha só', async () => {
    assert.equal(folhas(await gerarPdfDaTabela(tabela())), 1);
  });

  it('tabela comprida vira mais folhas, sem folha em branco', async () => {
    const muitas = Array.from({ length: 120 }, (_, i) => ({
      codigo: String(i).padStart(5, '0'),
      descricao: 'Item de teste número ' + i,
      valor: 'R$ 10,00',
    }));

    const pdf = await gerarPdfDaTabela(
      tabela({ tabelas: [{ ...tabela().tabelas[0], linhas: muitas }] }),
    );

    const paginas = folhas(pdf);
    assert.ok(paginas >= 3, 'esperava várias folhas, veio ' + paginas);

    // Cada folha carrega o cabeçalho da tabela: sem isso, da segunda
    // em diante ninguém sabe que coluna é qual.
    //
    // "Código", e não "CÓDIGO": o gerador deixou de passar os títulos
    // por `toUpperCase` em 25/09/2026. Este teste pegou a mudança, que
    // é o trabalho dele — o que ele guarda é a REPETIÇÃO do cabeçalho,
    // não a caixa das letras.
    const texto = textoDoPdf(pdf);
    assert.equal(
      (texto.match(/Código/g) ?? []).length, paginas,
      'o cabeçalho da tabela tem de se repetir em toda folha',
    );

    // Nenhuma folha em branco: cada uma tem a marca da empresa.
    assert.equal(
      (texto.match(/Porto Inc/g) ?? []).length, paginas,
      'folha sem a marca é folha em branco',
    );

    // "Página 2 de 5", e não "Página 2".
    //
    // Num relatório impresso e grampeado, "Página 2" sozinha não
    // responde a única pergunta que se faz ao folhear: está inteiro?
    // O total só existe depois que o documento termina, então os
    // rodapés são escritos no fim, sobre as folhas já montadas.
    for (let n = 1; n <= paginas; n += 1) {
      assert.match(
        texto,
        new RegExp('Página ' + n + ' de ' + paginas),
        'a folha ' + n + ' tem de dizer de quantas ela é',
      );
    }
  });

  it('tabela vazia não quebra', async () => {
    const pdf = await gerarPdfDaTabela(
      tabela({ tabelas: [{ ...tabela().tabelas[0], linhas: [] }] }),
    );

    assert.match(textoDoPdf(pdf), /Nenhum dado no período/);
    assert.equal(folhas(pdf), 1);
  });

  it('vira a folha quando há muita coluna', async () => {
    const largo = tabela({
      tabelas: [{
        colunas: Array.from({ length: 8 }, (_, i) => ({ titulo: 'C' + i, campo: 'c' + i })),
        linhas: [{ c0: 'a', c1: 'b', c2: 'c', c3: 'd', c4: 'e', c5: 'f', c6: 'g', c7: 'h' }],
      }],
    });

    const deitado = (await gerarPdfDaTabela(largo)).toString('latin1');
    const emPe = (await gerarPdfDaTabela(tabela())).toString('latin1');

    assert.match(deitado, /\/MediaBox \[0 0 841\.89 595\.28\]/);
    assert.match(emPe, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  });

  it('desenha as duas tabelas quando há duas', async () => {
    const texto = textoDoPdf(await gerarPdfDaTabela(tabela({
      tabelas: [
        { titulo: 'Primeira parte', colunas: [{ titulo: 'A', campo: 'a' }], linhas: [{ a: 'um' }] },
        { titulo: 'Segunda parte', colunas: [{ titulo: 'B', campo: 'b' }], linhas: [{ b: 'dois' }] },
      ],
    })));

    assert.match(texto, /Primeira parte/);
    assert.match(texto, /Segunda parte/);
    assert.match(texto, /um/);
    assert.match(texto, /dois/);
  });
});

describe('Word', () => {
  it('é um .docx de verdade', async () => {
    const docx = await gerarDocxDaTabela(tabela());

    // .docx é um ZIP: começa com "PK".
    assert.equal(docx.subarray(0, 2).toString('latin1'), 'PK');
    assert.ok(docx.length > 1000);
  });

  it('gera uma tabela por bloco', async () => {
    const docx = await gerarDocxDaTabela(tabela({
      tabelas: [
        { titulo: 'Um', colunas: [{ titulo: 'A', campo: 'a' }], linhas: [{ a: 'x' }] },
        { titulo: 'Dois', colunas: [{ titulo: 'B', campo: 'b' }], linhas: [{ b: 'y' }] },
      ],
    }));

    assert.ok(docx.length > 1000);
  });

  it('tabela vazia não quebra', async () => {
    const docx = await gerarDocxDaTabela(
      tabela({ tabelas: [{ ...tabela().tabelas[0], linhas: [] }] }),
    );

    assert.equal(docx.subarray(0, 2).toString('latin1'), 'PK');
  });
});

describe('Entrada única', () => {
  it('devolve o tipo e o nome certos para PDF', async () => {
    const a = await gerarArquivoDaTabela(tabela({ arquivo: 'contas-a-pagar' }), 'pdf');

    assert.equal(a.tipo, 'application/pdf');
    assert.equal(a.nome, 'contas-a-pagar.pdf');
  });

  it('devolve o tipo e o nome certos para Word', async () => {
    const a = await gerarArquivoDaTabela(tabela({ arquivo: 'contas-a-pagar' }), 'docx');

    assert.match(a.tipo, /wordprocessingml\.document$/);
    assert.equal(a.nome, 'contas-a-pagar.docx');
  });

  it('célula sem valor vira travessão, não "undefined"', async () => {
    const texto = textoDoPdf(await gerarPdfDaTabela(tabela({
      tabelas: [{
        colunas: [{ titulo: 'A', campo: 'a' }, { titulo: 'B', campo: 'b' }],
        linhas: [{ a: 'tem valor' }],
      }],
    })));

    assert.ok(!texto.includes('undefined'), 'campo faltando não pode virar "undefined" na tela');
    assert.match(texto, /—/);
  });
});
