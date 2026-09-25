// ============================================================
//  Tabela para arquivo: PDF e Word
//
//  Todo relatório e toda exportação do sistema são, no fundo,
//  a MESMA coisa: um título, umas linhas de contexto e uma
//  tabela. Então o desenho fica num lugar só — assim os cinco
//  relatórios e as contas a pagar saem com a mesma cara, e
//  arrumar o cabeçalho arruma todos de uma vez.
//
//  Dois formatos, porque servem a coisas diferentes:
//
//    PDF   para imprimir, assinar, anexar num e-mail. Sai
//          igual em qualquer máquina.
//    DOCX  para abrir no Word e mexer: cortar linha, escrever
//          um comentário, colar num relatório maior.
//
//  O PDF usa PDFKit com as fontes padrão (Helvetica), que não
//  precisam de arquivo externo — é o que mantém o container
//  leve. Um gerador baseado em navegador usaria ~400 MB.
// ============================================================

import PDFDocument from 'pdfkit';
import { geradoEm } from './data-br.js';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  AlignmentType, BorderStyle, HeadingLevel, PageOrientation, WidthType,
} from 'docx';

const MARINHO = '#0f2942';
const AZUL = '#2f6fed';
const CINZA = '#5a6b7d';
const BORDA = '#dde4ec';

/** As mesmas cores, sem o "#", que é como o Word as espera. */
const W_MARINHO = '0F2942';
const W_AZUL = '2F6FED';
const W_CINZA = '5A6B7D';
const W_BORDA = 'DDE4EC';

export type FormatoArquivo = 'pdf' | 'docx';

export const FORMATOS: FormatoArquivo[] = ['pdf', 'docx'];

export function formatoValido(v: unknown): v is FormatoArquivo {
  return typeof v === 'string' && (FORMATOS as string[]).includes(v);
}

export interface ColunaDaTabela {
  titulo: string;
  campo: string;
  /** Números alinham à direita: assim as casas decimais ficam uma sob a outra. */
  numero?: boolean;
  /** Peso relativo da largura. Uma coluna de descrição pede mais que uma de código. */
  peso?: number;
}

export interface BlocoDeTabela {
  /** Título acima da tabela. Só aparece quando há mais de uma. */
  titulo?: string;
  colunas: ColunaDaTabela[];
  linhas: readonly object[];
}

export interface TabelaParaArquivo {
  /** Nome do arquivo, sem extensão. */
  arquivo: string;
  titulo: string;
  /** Uma frase explicando o que o documento responde. */
  subtitulo?: string;
  /** Contexto: obra, período, quem gerou. */
  resumo?: Array<{ rotulo: string; valor: string }>;
  /** Uma ou mais tabelas, na ordem em que aparecem. */
  tabelas: BlocoDeTabela[];
  /** Observação no pé do documento. */
  nota?: string;
}

/** A tabela mais larga manda na orientação da folha. */
function maisColunas(t: TabelaParaArquivo): number {
  return Math.max(...t.tabelas.map((b) => b.colunas.length), 1);
}

function texto(linha: object, campo: string): string {
  const v = (linha as Record<string, unknown>)[campo];
  if (v === null || v === undefined || v === '') return '—';

  return String(v);
}



// ============================================================
//  PDF
// ============================================================

/**
 * Deitado ou em pé?
 *
 * Tabela com muita coluna em página em pé fica com as colunas
 * espremidas e o texto quebrando em cada célula. A partir de
 * seis colunas vale mais virar a folha.
 */
function ehDeitado(colunas: number): boolean {
  return colunas >= 6;
}

export function gerarPdfDaTabela(t: TabelaParaArquivo): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const deitado = ehDeitado(maisColunas(t));
    const pagina = {
      size: 'A4' as const,
      layout: (deitado ? 'landscape' : 'portrait') as 'landscape' | 'portrait',
      margins: { top: 45, bottom: 50, left: 40, right: 40 },
    };

    const doc = new PDFDocument({
      ...pagina,
      // Guarda as folhas em vez de fechar cada uma: sem isso nao da
      // para voltar e escrever "de quantas" no rodape.
      bufferPages: true,
      info: { Title: t.titulo, Author: 'Porto Inc.' },
    });

    const pedacos: Buffer[] = [];
    doc.on('data', (p: Buffer) => pedacos.push(p));
    doc.on('end', () => resolve(Buffer.concat(pedacos)));
    doc.on('error', reject);

    const ESQ = 40;
    const larguraUtil = doc.page.width - 80;
    const rodapeY = doc.page.height - 38;

    /**
     * A marca fala baixo.
     *
     * Ela vinha em 16pt em negrito, do mesmo peso do titulo do
     * documento e na mesma linha que ele: dois blocos escuros
     * disputando o olho, e nenhum ganhando. Quem abre o arquivo quer
     * saber PRIMEIRO o que ele e; de quem ele e vem logo depois, e
     * nao precisa gritar para isso.
     */
    function marca() {
      doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(12)
        .text('Porto Inc', ESQ, 42, { continued: true });
      doc.fillColor(AZUL).text('.');

      doc.fillColor(CINZA).font('Helvetica').fontSize(7.5)
        .text('Compras e Almoxarifado', ESQ, 58);
    }

    /**
     * "Página 2 de 5", e nao "Página 2".
     *
     * Num relatorio impresso e grampeado, "Página 2" sozinha nao
     * responde a unica pergunta que se faz ao folhear: esta inteiro?
     * O total so existe quando o documento termina, por isso os
     * rodapes sao escritos no fim, sobre as folhas ja montadas
     * (`bufferPages`).
     */
    function escreverRodapes() {
      const faixa = doc.bufferedPageRange();

      for (let i = 0; i < faixa.count; i += 1) {
        doc.switchToPage(faixa.start + i);

        // Escrever abaixo da margem de baixo faz o PDFKit abrir uma
        // folha nova sozinho. Zeramos enquanto escrevemos.
        const margemDeBaixo = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        doc.fillColor(CINZA).font('Helvetica').fontSize(7.5)
          .text(geradoEm(), ESQ, rodapeY, {
            width: larguraUtil / 2, lineBreak: false,
          });

        doc.text('Página ' + (i + 1) + ' de ' + faixa.count,
          ESQ + larguraUtil / 2, rodapeY, {
            width: larguraUtil / 2, align: 'right', lineBreak: false,
          });

        doc.page.margins.bottom = margemDeBaixo;
      }
    }

    function novaPagina(): number {
      doc.addPage(pagina);
      marca();
      return 84;
    }

    // ---------- Primeira página ----------
    marca();

    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(17)
      .text(t.titulo, ESQ, 38, { width: larguraUtil, align: 'right' });

    if (t.subtitulo) {
      doc.fillColor(CINZA).font('Helvetica').fontSize(9)
        .text(t.subtitulo, ESQ, 60, { width: larguraUtil, align: 'right' });
    }

    doc.moveTo(ESQ, 80).lineTo(doc.page.width - ESQ, 80)
      .strokeColor(AZUL).lineWidth(2).stroke();

    let y = 94;

    // ---------- Contexto ----------
    if (t.resumo && t.resumo.length > 0) {
      const porLinha = deitado ? 4 : 3;
      const largura = larguraUtil / porLinha;

      t.resumo.forEach((item, i) => {
        const coluna = i % porLinha;
        const fileira = Math.floor(i / porLinha);
        const x = ESQ + coluna * largura;
        const topo = y + fileira * 30;

        // Sem `toUpperCase`. Rotulo em CAIXA ALTA e o vicio mais
        // comum de layout gerado — e o sistema nao faz isso em tela
        // nenhuma, entao o arquivo baixado contradizia a tela.
        doc.fillColor(CINZA).font('Helvetica').fontSize(7.5)
          .text(item.rotulo, x, topo, { width: largura - 8, lineBreak: false });

        doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(10)
          .text(item.valor, x, topo + 10, { width: largura - 8, lineBreak: false });
      });

      y += Math.ceil(t.resumo.length / porLinha) * 30 + 4;
    }

    // ---------- As tabelas ----------
    for (const bloco of t.tabelas) {
      const pesoTotal = bloco.colunas.reduce((s, c) => s + (c.peso ?? 1), 0);
      const larguras = bloco.colunas.map((c) => ((c.peso ?? 1) / pesoTotal) * larguraUtil);

      const posicoes: number[] = [];
      let acumulado = ESQ;
      for (const l of larguras) {
        posicoes.push(acumulado);
        acumulado += l;
      }

      function cabecalhoDaTabela(topo: number): number {
        doc.rect(ESQ, topo, larguraUtil, 20).fill(MARINHO);

        bloco.colunas.forEach((c, i) => {
          const rotulo = c.titulo;
          const cabe = larguras[i] - 10;

          // "Solicitações na conta" não cabe em coluna estreita e
          // quebraria em duas linhas, passando por cima da primeira
          // fileira. Encolhe a letra até caber; abaixo de 5,5 pt
          // ninguém leria, então aí deixa quebrar.
          //
          // Em caixa alta isso acontecia muito mais: o mesmo texto
          // ocupa cerca de 12% a mais de largura, e vários cabeçalhos
          // vinham encolhidos sem precisar.
          let corpo = 7.5;
          doc.font('Helvetica-Bold').fontSize(corpo);

          while (corpo > 5.5 && doc.widthOfString(rotulo) > cabe) {
            corpo -= 0.5;
            doc.fontSize(corpo);
          }

          doc.fillColor('#ffffff')
            .text(rotulo, posicoes[i] + 5, topo + 6.5 + (7.5 - corpo) / 2, {
              width: cabe,
              align: c.numero ? 'right' : 'left',
              lineBreak: false,
            });
        });

        return topo + 20;
      }

      if (bloco.titulo) {
        // Um título sozinho no pé da folha, com a tabela na página
        // seguinte, fica órfão. Só vale escrever se couber título
        // mais cabeçalho mais uma fileira.
        if (y + 60 > rodapeY - 14) y = novaPagina();

        doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(11)
          .text(bloco.titulo, ESQ, y + 10, { width: larguraUtil });
        y = doc.y + 8;
      }

      if (bloco.linhas.length === 0) {
        doc.fillColor(CINZA).font('Helvetica-Oblique').fontSize(10)
          .text('Nenhum dado no período.', ESQ, y + 10, { width: larguraUtil });
        y = doc.y + 12;
        continue;
      }

      y = cabecalhoDaTabela(y);

      bloco.linhas.forEach((linha, indice) => {
        // Mede antes de desenhar: a célula mais alta define a altura
        // da fileira, senão um texto longo escaparia da zebra.
        const alturas = bloco.colunas.map((c, i) =>
          doc.font('Helvetica').fontSize(8)
            .heightOfString(texto(linha, c.campo), { width: larguras[i] - 10 }),
        );
        const altura = Math.max(...alturas, 12) + 10;

        if (y + altura > rodapeY - 14) {
          y = cabecalhoDaTabela(novaPagina());
        }

        // Sem faixa cinza alternada.
        //
        // Ela vinha JUNTO com um traço debaixo de cada fileira: dois
        // separadores para o mesmo trabalho. E papel branco com faixa
        // cinza clara sai sujo na fotocópia e gasta tinta à toa — este
        // documento é feito para imprimir e assinar. O traço ficou, e a
        // fileira ganhou o ar que a faixa fingia dar.
        bloco.colunas.forEach((c, i) => {
          doc.fillColor('#16202b').font('Helvetica').fontSize(8)
            .text(texto(linha, c.campo), posicoes[i] + 5, y + 5, {
              width: larguras[i] - 10,
              align: c.numero ? 'right' : 'left',
            });
        });

        doc.moveTo(ESQ, y + altura).lineTo(ESQ + larguraUtil, y + altura)
          .strokeColor(BORDA).lineWidth(0.5).stroke();

        y += altura;
      });
    }

    if (t.nota) {
      if (y + 30 > rodapeY - 14) y = novaPagina();

      doc.fillColor(CINZA).font('Helvetica').fontSize(8)
        .text(t.nota, ESQ, y + 10, { width: larguraUtil });
    }

    escreverRodapes();
    doc.flushPages();
    doc.end();
  });
}

// ============================================================
//  Word (.docx)
// ============================================================

function celula(conteudo: string, opcoes: { negrito?: boolean; direita?: boolean; branco?: boolean; fundo?: string }) {
  return new TableCell({
    shading: opcoes.fundo ? { fill: opcoes.fundo } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: opcoes.direita ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [
          new TextRun({
            text: conteudo,
            bold: opcoes.negrito,
            size: 16, // meio-ponto: 16 = 8pt
            color: opcoes.branco ? 'FFFFFF' : '16202B',
          }),
        ],
      }),
    ],
  });
}

export async function gerarDocxDaTabela(t: TabelaParaArquivo): Promise<Buffer> {
  const deitado = ehDeitado(maisColunas(t));

  const corpo: Array<Paragraph | Table> = [
    new Paragraph({
      children: [
        new TextRun({ text: 'Porto Inc', bold: true, size: 20, color: W_MARINHO }),
        new TextRun({ text: '.', bold: true, size: 20, color: W_AZUL }),
        new TextRun({ text: '   Compras e Almoxarifado', size: 15, color: W_CINZA }),
      ],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 0 },
      children: [new TextRun({ text: t.titulo, bold: true, size: 30, color: W_MARINHO })],
    }),
  ];

  if (t.subtitulo) {
    corpo.push(new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: t.subtitulo, size: 18, color: W_CINZA })],
    }));
  }

  if (t.resumo && t.resumo.length > 0) {
    for (const item of t.resumo) {
      corpo.push(new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: item.rotulo + ': ', bold: true, size: 18, color: W_CINZA }),
          new TextRun({ text: item.valor, size: 18, color: W_MARINHO }),
        ],
      }));
    }
  }

  corpo.push(new Paragraph({ text: '', spacing: { after: 120 } }));

  const borda = { style: BorderStyle.SINGLE, size: 2, color: W_BORDA };

  for (const tabela of t.tabelas) {
    if (tabela.titulo) {
      corpo.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: tabela.titulo, bold: true, size: 22, color: W_MARINHO })],
      }));
    }

    if (tabela.linhas.length === 0) {
      corpo.push(new Paragraph({
        children: [new TextRun({
          text: 'Nenhum dado no período.', italics: true, size: 18, color: W_CINZA,
        })],
      }));
      continue;
    }

    const pesoTotal = tabela.colunas.reduce((soma, c) => soma + (c.peso ?? 1), 0);

    corpo.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: borda, bottom: borda, left: borda, right: borda,
        insideHorizontal: borda, insideVertical: borda,
      },
      columnWidths: tabela.colunas.map((c) => Math.round(((c.peso ?? 1) / pesoTotal) * 10000)),
      rows: [
        new TableRow({
          // Repete o cabeçalho quando a tabela passa de página:
          // sem isso, da segunda folha em diante ninguém sabe
          // que coluna é qual.
          tableHeader: true,
          children: tabela.colunas.map((c) =>
            celula(c.titulo, {
              negrito: true, branco: true, fundo: W_MARINHO, direita: c.numero,
            }),
          ),
        }),
        ...tabela.linhas.map((linha) =>
          new TableRow({
            children: tabela.colunas.map((c) =>
              celula(texto(linha, c.campo), { direita: c.numero }),
            ),
          }),
        ),
      ],
    }));
  }

  if (t.nota) {
    corpo.push(new Paragraph({
      spacing: { before: 200 },
      children: [new TextRun({ text: t.nota, size: 16, color: W_CINZA })],
    }));
  }

  corpo.push(new Paragraph({
    spacing: { before: 240 },
    children: [new TextRun({ text: geradoEm(), size: 15, color: W_CINZA })],
  }));

  const doc = new Document({
    creator: 'Porto Inc.',
    title: t.titulo,
    sections: [{
      properties: {
        page: {
          size: deitado ? { orientation: PageOrientation.LANDSCAPE } : undefined,
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children: corpo,
    }],
  });

  return Packer.toBuffer(doc);
}

// ============================================================
//  Entrada única
// ============================================================

const TIPOS: Record<FormatoArquivo, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export interface ArquivoPronto {
  conteudo: Buffer;
  tipo: string;
  nome: string;
}

/** Gera a tabela no formato pedido, pronta para o download. */
export async function gerarArquivoDaTabela(
  t: TabelaParaArquivo,
  formato: FormatoArquivo,
): Promise<ArquivoPronto> {
  const conteudo = formato === 'docx'
    ? await gerarDocxDaTabela(t)
    : await gerarPdfDaTabela(t);

  return { conteudo, tipo: TIPOS[formato], nome: t.arquivo + '.' + formato };
}
