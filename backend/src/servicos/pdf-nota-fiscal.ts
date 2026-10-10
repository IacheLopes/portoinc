// ============================================================
//  PDF da nota fiscal — o ESPELHO
//
//  ATENÇÃO AO NOME. Isto NÃO é um DANFE.
//
//  O DANFE tem layout definido em lei e só vale acompanhado do
//  protocolo de autorização que a SEFAZ devolve. Enquanto o
//  certificado digital A1 da empresa não estiver configurado, o
//  sistema não tem esse protocolo — e um papel que se parece com
//  um DANFE sem sê-lo é pior do que nenhum papel.
//
//  O que este arquivo gera é o ESPELHO: uma folha com o que foi
//  lançado no sistema, para o almoxarifado arquivar e o financeiro
//  conferir. Ele diz isso de forma clara no rodapé.
//
//  Quando o fornecedor manda o PDF de verdade, é esse PDF que fica
//  guardado (ver `arquivos.ts`); o espelho existe para a nota
//  digitada à mão, que é a maioria hoje.
// ============================================================

import PDFDocument from 'pdfkit';
import { dataBr, geradoEm } from './data-br.js';
import { formatarCnpj, reaisBr, quantidadeBr } from './util.js';
import { paraOPdf } from './pdf-texto.js';

const MARINHO = '#0f2942';
const AZUL = '#2f6fed';
const CINZA = '#5a6b7d';
const BORDA = '#dde4ec';

export interface DadosNotaFiscal {
  numero: string;
  serie: string;
  chaveAcesso: string | null;
  emitidaEm: Date;
  situacao: string;
  doXml: boolean;
  valorTotal: number;
  valorProdutos: number | null;
  valorFrete: number | null;
  divergencias: string[];
  observacoes: string | null;
  lancadaPor: string;
  fornecedor: {
    razaoSocial: string;
    nomeFantasia: string | null;
    cnpj: string;
  };
  pedido: { numeroFormatado: string } | null;
  itens: Array<{
    ordem: number;
    codigo: string | null;
    descricao: string;
    unidade: string | null;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }>;
}

/** A chave tem 44 dígitos: quebrada de 4 em 4, dá para conferir com o olho. */
function chaveLegivel(chave: string): string {
  return (chave.match(/.{1,4}/g) ?? []).join(' ');
}

export function gerarPdfNotaFiscal(entrada: DadosNotaFiscal): Promise<Buffer> {
  const dados = paraOPdf(entrada);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 45, right: 45 },
      info: {
        Title: 'Espelho da nota fiscal ' + dados.numero + '-' + dados.serie,
        Author: 'Porto Inc.',
      },
    });

    const pedacos: Buffer[] = [];
    doc.on('data', (p: Buffer) => pedacos.push(p));
    doc.on('end', () => resolve(Buffer.concat(pedacos)));
    doc.on('error', reject);

    const larguraUtil = doc.page.width - 90;

    // ---------- Cabeçalho ----------
    // A marca em 20pt negrito competia de igual para igual com o
    // titulo do documento, na mesma linha. Dois blocos escuros, nenhum
    // ganhando. Quem abre quer saber primeiro O QUE e o papel.
    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(14)
      .text('Porto Inc', 45, 46, { continued: true });
    doc.fillColor(AZUL).text('.');

    doc.fillColor(CINZA).font('Helvetica').fontSize(8)
      .text('Compras e Almoxarifado', 45, 64);

    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(18)
      .text('Espelho da nota fiscal', 45, 43, { width: larguraUtil, align: 'right' });

    doc.fillColor(AZUL).fontSize(15)
      .text('NF ' + dados.numero + ' / série ' + dados.serie, 45, 64, {
        width: larguraUtil, align: 'right',
      });

    doc.fillColor(CINZA).font('Helvetica').fontSize(8.5)
      .text(
        'Emitida em ' + dataBr(dados.emitidaEm) +
          (dados.doXml
            ? ' · lida do arquivo XML do fornecedor'
            : ' · digitada à mão no sistema'),
        45, 85, { width: larguraUtil, align: 'right' },
      );

    doc.moveTo(45, 106).lineTo(doc.page.width - 45, 106).strokeColor(AZUL).lineWidth(2).stroke();

    // ---------- Fornecedor e pedido ----------
    let y = 122;

    doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text('Fornecedor', 45, y);
    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(11)
      .text(dados.fornecedor.nomeFantasia ?? dados.fornecedor.razaoSocial, 45, y + 10, {
        width: 280,
      });

    doc.fillColor('#16202b').font('Helvetica').fontSize(8.5)
      .text(dados.fornecedor.razaoSocial, 45, y + 25, { width: 280 });
    doc.text('CNPJ ' + formatarCnpj(dados.fornecedor.cnpj), 45, y + 37);

    doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text('Pedido de compra', 340, y);
    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(10)
      .text(dados.pedido?.numeroFormatado ?? 'Sem pedido vinculado', 340, y + 10, { width: 175 });

    doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text('Lançada por', 340, y + 28);
    doc.fillColor('#16202b').font('Helvetica').fontSize(8.5)
      .text(dados.lancadaPor, 340, y + 38, { width: 175 });

    y += 62;

    // ---------- Chave de acesso ----------
    if (dados.chaveAcesso) {
      doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text('Chave de acesso', 45, y);
      doc.fillColor('#16202b').font('Courier').fontSize(9)
        .text(chaveLegivel(dados.chaveAcesso), 45, y + 10, { width: larguraUtil });
      y += 30;
    }

    // ---------- Itens ----------
    doc.moveTo(45, y).lineTo(doc.page.width - 45, y).strokeColor(BORDA).lineWidth(1).stroke();
    y += 10;

    // Sem itens não há tabela: só o cabeçalho, sem nada embaixo,
    // parece defeito de impressão. Nota digitada à mão costuma vir
    // assim — o detalhamento só existe quando veio do XML.
    if (dados.itens.length === 0) {
      doc.fillColor(CINZA).font('Helvetica-Oblique').fontSize(9)
        .text(
          'Esta nota foi lançada sem detalhamento de itens. O valor total confere ' +
            'com o que foi digitado; o detalhe por item existe quando a nota é lida ' +
            'do arquivo XML do fornecedor.',
          45, y, { width: larguraUtil },
        );
      y += 40;
    }

    const COLUNAS = [
      { titulo: 'ITEM', x: 45, largura: 30, alinhar: 'left' as const },
      { titulo: 'DESCRIÇÃO', x: 78, largura: 225, alinhar: 'left' as const },
      { titulo: 'UN', x: 306, largura: 28, alinhar: 'left' as const },
      { titulo: 'QTD', x: 337, largura: 55, alinhar: 'right' as const },
      { titulo: 'UNITÁRIO', x: 395, largura: 70, alinhar: 'right' as const },
      { titulo: 'TOTAL', x: 468, largura: 82, alinhar: 'right' as const },
    ];

    if (dados.itens.length > 0) {
      doc.fillColor(CINZA).font('Helvetica-Bold').fontSize(7.5);
      for (const c of COLUNAS) {
        doc.text(c.titulo, c.x, y, { width: c.largura, align: c.alinhar });
      }

      y += 14;
      doc.moveTo(45, y - 3).lineTo(doc.page.width - 45, y - 3)
        .strokeColor(BORDA).lineWidth(1).stroke();
    }

    for (const item of dados.itens) {
      // Folha nova antes de estourar a margem de baixo.
      if (y > doc.page.height - 150) {
        doc.addPage();
        y = 60;
      }

      const descricao = item.codigo ? item.codigo + ' — ' + item.descricao : item.descricao;
      const altura = doc.font('Helvetica').fontSize(8.5).heightOfString(descricao, { width: 225 });

      doc.fillColor('#16202b').font('Helvetica').fontSize(8.5);
      doc.text(String(item.ordem + 1), 45, y, { width: 30 });
      doc.text(descricao, 78, y, { width: 225 });
      doc.text(item.unidade ?? '—', 306, y, { width: 28 });
      doc.text(quantidadeBr(item.quantidade), 337, y, { width: 55, align: 'right' });
      doc.text(reaisBr(item.valorUnitario), 395, y, { width: 70, align: 'right' });
      doc.font('Helvetica-Bold').text(reaisBr(item.valorTotal), 468, y, {
        width: 82, align: 'right',
      });

      y += Math.max(altura, 11) + 7;
    }

    // ---------- Totais ----------
    y += 4;
    doc.moveTo(300, y).lineTo(doc.page.width - 45, y).strokeColor(BORDA).lineWidth(1).stroke();
    y += 8;

    const linhasTotal: Array<[string, string]> = [];
    if (dados.valorProdutos !== null) linhasTotal.push(['Produtos', reaisBr(dados.valorProdutos)]);
    if (dados.valorFrete !== null && dados.valorFrete > 0) {
      linhasTotal.push(['Frete', reaisBr(dados.valorFrete)]);
    }

    for (const [rotulo, valor] of linhasTotal) {
      doc.fillColor(CINZA).font('Helvetica').fontSize(8.5)
        .text(rotulo, 340, y, { width: 110, align: 'right' });
      doc.fillColor('#16202b').text(valor, 455, y, { width: 95, align: 'right' });
      y += 13;
    }

    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(11)
      .text('Total da nota', 300, y + 2, { width: 150, align: 'right' });
    doc.fillColor(AZUL).fontSize(13)
      .text(reaisBr(dados.valorTotal), 455, y, { width: 95, align: 'right' });

    y += 28;

    // ---------- Este papel NÃO é a nota ----------
    //
    // O aviso vivia em 7,5pt cinza no pé da folha, abaixo de um traço,
    // onde ninguém lê. É a informação mais importante do documento: um
    // espelho confundido com DANFE vira problema fiscal.
    //
    // Sobe para logo abaixo do total, em faixa, no mesmo formato do
    // aviso do pedido de compra.
    doc.rect(45, y, larguraUtil, 30).fill('#fdf3f2');
    doc.fillColor('#a3261f').font('Helvetica-Bold').fontSize(8.5)
      .text(
        'Este documento não é a nota fiscal. É um espelho interno da Porto Inc., ' +
          'montado com o que foi lançado no sistema — não substitui o DANFE e não tem valor fiscal.',
        50, y + 7, { width: larguraUtil - 10 },
      );

    y += 44;

    // ---------- Divergências ----------
    if (dados.divergencias.length > 0) {
      doc.fillColor('#a3261f').font('Helvetica-Bold').fontSize(9)
        .text('O que não bateu com o pedido', 45, y);
      y += 14;

      doc.fillColor('#16202b').font('Helvetica').fontSize(8.5);
      for (const d of dados.divergencias) {
        doc.text('• ' + d, 45, y, { width: larguraUtil });
        y += 12;
      }
      y += 6;
    }

    if (dados.observacoes) {
      doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text('Observações', 45, y);
      doc.fillColor('#16202b').font('Helvetica').fontSize(8.5)
        .text(dados.observacoes, 45, y + 10, { width: larguraUtil });
    }

    // ---------- Rodapé ----------
    //
    // Escrever abaixo da margem de baixo faz o pdfkit abrir uma
    // folha nova sozinho — uma em branco por rodapé. Zeramos a
    // margem enquanto escrevemos e devolvemos depois.
    const margemDeBaixo = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const rodape = doc.page.height - 44;
    doc.moveTo(45, rodape - 8).lineTo(doc.page.width - 45, rodape - 8)
      .strokeColor(BORDA).lineWidth(1).stroke();

    doc.fillColor(CINZA).font('Helvetica').fontSize(7.5)
      .text(
        'Porto Inc. · Espelho da NF ' + dados.numero + ' · ' + geradoEm().toLowerCase(),
        45, rodape, { width: larguraUtil, align: 'center', lineBreak: false },
      );

    doc.page.margins.bottom = margemDeBaixo;

    doc.end();
  });
}
