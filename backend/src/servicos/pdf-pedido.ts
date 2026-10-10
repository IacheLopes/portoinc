// ============================================================
//  PDF do pedido de compra
//
//  É o documento que vai para o fornecedor e que ele apresenta
//  junto com a nota fiscal na entrega. Por isso ele carrega o
//  número do pedido em destaque: é por ele que o almoxarife vai
//  conferir o recebimento na Etapa 7.
// ============================================================

import PDFDocument from 'pdfkit';
import { dataBr, geradoEm } from './data-br.js';
import { formatarTelefone, reaisBr, quantidadeBr } from './util.js';
import { paraOPdf } from './pdf-texto.js';
import { formatarNumeroPedido } from './equalizacao.js';
import { formatarCnpj } from './util.js';

const MARINHO = '#0f2942';
const AZUL = '#2f6fed';
const CINZA = '#5a6b7d';
const BORDA = '#dde4ec';

export interface DadosPedido {
  numero: number;
  situacao: string;
  criadoEm: Date;
  comprador: string;
  origem: string;
  fornecedor: {
    razaoSocial: string;
    nomeFantasia: string | null;
    cnpj: string;
    email: string | null;
    telefone: string | null;
  };
  frete: number;
  outrosCustos: number;
  pagamento: string;
  observacoes: string | null;
  itens: Array<{
    ordem: number;
    codigo: string;
    descricao: string;
    normaTecnica: string | null;
    unidadeMedida: string;
    quantidade: number;
    valorUnitario: number;
    marca: string | null;
    modelo: string | null;
    prazoEntregaDias: number | null;
    obra: { codigo: string; nome: string };
  }>;
}

export function gerarPdfPedido(entrada: DadosPedido): Promise<Buffer> {
  // Saneia na porta, uma vez: os geradores tem dezenas de
  // `doc.text()`, e a chamada que alguem esquecesse seria a que
  // ninguem olha.
  const dados = paraOPdf(entrada);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 45, right: 45 },
      info: {
        Title: formatarNumeroPedido(dados.numero) + ' - Pedido de Compra',
        Author: 'Porto Inc.',
      },
    });

    const pedacos: Buffer[] = [];
    doc.on('data', (p: Buffer) => pedacos.push(p));
    doc.on('end', () => resolve(Buffer.concat(pedacos)));
    doc.on('error', reject);

    const larguraUtil = doc.page.width - 90;
    const numeroFormatado = formatarNumeroPedido(dados.numero);

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
      .text('Pedido de compra', 45, 43, { width: larguraUtil, align: 'right' });

    doc.fillColor(AZUL).fontSize(15)
      .text(numeroFormatado, 45, 66, { width: larguraUtil, align: 'right' });

    doc.fillColor(CINZA).font('Helvetica').fontSize(8.5)
      .text(
        'Emitido em ' + dataBr(dados.criadoEm),
        45, 86, { width: larguraUtil, align: 'right' },
      );

    doc.moveTo(45, 106).lineTo(doc.page.width - 45, 106).strokeColor(AZUL).lineWidth(2).stroke();

    // ---------- Fornecedor ----------
    let y = 122;

    doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text('Fornecedor', 45, y);
    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(11)
      .text(dados.fornecedor.nomeFantasia ?? dados.fornecedor.razaoSocial, 45, y + 10);

    doc.fillColor('#16202b').font('Helvetica').fontSize(8.5)
      .text(dados.fornecedor.razaoSocial, 45, y + 25, { width: 300 });

    doc.text('CNPJ ' + formatarCnpj(dados.fornecedor.cnpj), 45, y + 37);

    const contato = [dados.fornecedor.email, formatarTelefone(dados.fornecedor.telefone)]
      .filter(Boolean)
      .join(' · ');

    if (contato) doc.text(contato, 45, y + 49, { width: 300 });

    // Coluna da direita
    doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text('Comprador', 340, y);
    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(10)
      .text(dados.comprador, 340, y + 10, { width: 175 });

    doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text('Origem', 340, y + 28);
    doc.fillColor('#16202b').font('Helvetica').fontSize(8.5)
      .text(dados.origem, 340, y + 38, { width: 175 });

    y += 72;

    // ---------- Aviso importante ----------
    doc.rect(45, y, larguraUtil, 26).fill('#eef2f6');
    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(8.5)
      .text(
        'Importante: informe o número ' + numeroFormatado +
        ' na nota fiscal e na entrega. Sem ele o recebimento não pode ser conferido.',
        50, y + 8, { width: larguraUtil - 10 },
      );

    y += 40;

    // ---------- Tabela de itens ----------
    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(11).text('Itens', 45, y);
    y += 18;

    const COLUNAS = [
      { titulo: '#', x: 45, largura: 18 },
      { titulo: 'Código', x: 63, largura: 48 },
      { titulo: 'Descrição', x: 111, largura: 190 },
      { titulo: 'Un.', x: 301, largura: 26 },
      { titulo: 'Qtd.', x: 327, largura: 46, direita: true },
      { titulo: 'Unitário', x: 373, largura: 62, direita: true },
      { titulo: 'Total', x: 435, largura: 70, direita: true },
    ];

    const desenharCabecalho = (topo: number) => {
      doc.rect(45, topo, larguraUtil, 18).fill(MARINHO);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
      for (const c of COLUNAS) {
        doc.text(c.titulo, c.x + 3, topo + 5, {
          width: c.largura - 6,
          align: c.direita ? 'right' : 'left',
        });
      }
      return topo + 18;
    };

    y = desenharCabecalho(y);
    let subtotal = 0;

    for (const item of dados.itens) {
      if (y > doc.page.height - 150) {
        doc.addPage();
        y = desenharCabecalho(50);
      }

      const total = item.quantidade * item.valorUnitario;
      subtotal += total;

      const extras: string[] = [];
      if (item.marca) extras.push('Marca: ' + item.marca);
      if (item.modelo) extras.push('Modelo: ' + item.modelo);
      if (item.normaTecnica) extras.push(item.normaTecnica);
      if (item.prazoEntregaDias !== null) extras.push('Entrega: ' + item.prazoEntregaDias + ' dias');
      extras.push('Obra: ' + item.obra.codigo);

      const alturaDescricao = doc.font('Helvetica').fontSize(9)
        .heightOfString(item.descricao, { width: 184 });
      const alturaExtras = doc.font('Helvetica').fontSize(7.5)
        .heightOfString(extras.join(' · '), { width: 184 });
      const altura = Math.max(22, alturaDescricao + alturaExtras + 10);

      doc.fillColor('#16202b').font('Helvetica').fontSize(9);
      doc.text(String(item.ordem), 48, y + 5, { width: 12 });
      doc.font('Helvetica-Bold').text(item.codigo, 66, y + 5, { width: 42 });
      doc.font('Helvetica').text(item.descricao, 114, y + 5, { width: 184 });

      doc.fillColor(CINZA).fontSize(7.5)
        .text(extras.join(' · '), 114, y + 5 + alturaDescricao + 1, { width: 184 });

      doc.fillColor('#16202b').fontSize(9);
      doc.text(item.unidadeMedida, 304, y + 5, { width: 20 });
      doc.text(quantidadeBr(item.quantidade), 330, y + 5, { width: 40, align: 'right' });
      doc.text(reaisBr(item.valorUnitario), 376, y + 5, { width: 56, align: 'right' });
      doc.font('Helvetica-Bold').text(reaisBr(total), 438, y + 5, { width: 64, align: 'right' });

      y += altura;
      doc.moveTo(45, y).lineTo(doc.page.width - 45, y).strokeColor(BORDA).lineWidth(0.5).stroke();
    }

    // ---------- Totais ----------
    y += 10;

    if (y > doc.page.height - 190) {
      doc.addPage();
      y = 50;
    }

    const linhaTotal = (rotulo: string, valor: string, destaque = false) => {
      doc.fillColor(destaque ? MARINHO : CINZA)
        .font(destaque ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(destaque ? 11 : 9.5)
        .text(rotulo, 300, y, { width: 135, align: 'right' });

      doc.fillColor(MARINHO)
        .font('Helvetica-Bold')
        .fontSize(destaque ? 12 : 9.5)
        .text(valor, 438, y - (destaque ? 1 : 0), { width: 64, align: 'right' });

      y += destaque ? 20 : 15;
    };

    linhaTotal('Subtotal', reaisBr(subtotal));
    if (dados.frete > 0) linhaTotal('Frete', reaisBr(dados.frete));
    if (dados.outrosCustos > 0) linhaTotal('Outros custos', reaisBr(dados.outrosCustos));

    doc.moveTo(300, y).lineTo(doc.page.width - 45, y).strokeColor(MARINHO).lineWidth(1).stroke();
    y += 8;

    linhaTotal('Total do pedido', reaisBr(subtotal + dados.frete + dados.outrosCustos), true);

    // ---------- Pagamento ----------
    y += 10;

    doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text('Condição de pagamento', 45, y);
    doc.fillColor('#16202b').font('Helvetica-Bold').fontSize(10)
      .text(dados.pagamento, 45, y + 11, { width: 250 });

    y = doc.y + 12;

    if (dados.observacoes) {
      doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text('Observações', 45, y);
      doc.fillColor('#16202b').font('Helvetica').fontSize(9)
        .text(dados.observacoes, 45, y + 11, { width: larguraUtil });
      y = doc.y + 12;
    }

    // ---------- Assinaturas ----------
    const linhaAssinatura = doc.page.height - 120;
    const linhaRodape = doc.page.height - 66;

    if (y > linhaAssinatura) {
      doc.addPage();
      y = 50;
    }

    y = Math.max(y + 20, linhaAssinatura);

    const assinatura = (rotulo: string, x: number) => {
      doc.moveTo(x, y).lineTo(x + 200, y).strokeColor(CINZA).lineWidth(0.7).stroke();
      doc.fillColor(CINZA).font('Helvetica').fontSize(8)
        .text(rotulo, x, y + 5, { width: 200, align: 'center' });
    };

    assinatura('Porto Inc. — ' + dados.comprador, 45);
    assinatura('Ciente — ' + (dados.fornecedor.nomeFantasia ?? dados.fornecedor.razaoSocial), 305);

    doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text(
      'Porto Inc. · Pedido ' + numeroFormatado + ' · ' + geradoEm().toLowerCase(),
      45,
      linhaRodape,
      { width: larguraUtil, align: 'center', lineBreak: false },
    );

    doc.end();
  });
}
