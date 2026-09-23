// ============================================================
//  PDF da solicitação de compra
//
//  Pedido da reunião: "gerar PDF de requisições aprovadas".
//
//  Usamos PDFKit com as fontes padrão do PDF (Helvetica), que
//  não precisam de arquivo externo. Isso mantém o container
//  leve — um gerador baseado em navegador usaria ~400 MB.
// ============================================================

import PDFDocument from 'pdfkit';
import { formatarNumero, ROTULO_SITUACAO, type Situacao } from './solicitacao.js';

const MARINHO = '#0f2942';
const AZUL = '#2f6fed';
const CINZA = '#5a6b7d';
const BORDA = '#dde4ec';

export interface DadosPdf {
  numero: number;
  situacao: Situacao;
  criadaEm: Date;
  enviadaEm: Date | null;
  dataDesejada: Date | null;
  justificativa: string | null;
  observacoes: string | null;
  solicitante: { nome: string; email: string };
  obra: { codigo: string; nome: string; cliente: string | null };
  itens: Array<{
    ordem: number;
    codigoInterno: string;
    descricao: string;
    unidadeMedida: string;
    quantidade: number;
    descricaoComplementar: string | null;
    especificacaoTecnica: string | null;
    primeiraCompra: boolean;
    normaTecnica: string | null;
    linhaOrcamento: string | null;
    valorEstimado: number | null;
  }>;
  totalEstimado: number;
}

function data(valor: Date | null): string {
  if (!valor) return '—';
  return valor.toLocaleDateString('pt-BR');
}

function dinheiro(valor: number): string {
  return 'R$ ' + valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function numeroBr(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

/** Monta o PDF e devolve como Buffer, pronto para download. */
export function gerarPdfSolicitacao(dados: DadosPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 45, right: 45 },
      info: {
        Title: formatarNumero(dados.numero) + ' - Solicitação de Compra',
        Author: 'Porto Inc.',
      },
    });

    const pedacos: Buffer[] = [];
    doc.on('data', (p: Buffer) => pedacos.push(p));
    doc.on('end', () => resolve(Buffer.concat(pedacos)));
    doc.on('error', reject);

    const larguraUtil = doc.page.width - 90;

    // ---------- Cabeçalho ----------
    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(20).text('Porto Inc', 45, 45, {
      continued: true,
    });
    doc.fillColor(AZUL).text('.');

    doc.fillColor(CINZA).font('Helvetica').fontSize(9)
      .text('Compras e Almoxarifado', 45, 70);

    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(16)
      .text('Solicitação de Compra', 45, 45, { width: larguraUtil, align: 'right' });

    doc.fillColor(AZUL).fontSize(13)
      .text(formatarNumero(dados.numero), 45, 66, { width: larguraUtil, align: 'right' });

    doc.fillColor(CINZA).font('Helvetica').fontSize(9)
      .text(ROTULO_SITUACAO[dados.situacao], 45, 84, { width: larguraUtil, align: 'right' });

    doc.moveTo(45, 105).lineTo(doc.page.width - 45, 105).strokeColor(AZUL).lineWidth(2).stroke();

    // ---------- Dados gerais ----------
    let y = 122;

    const campo = (rotulo: string, valor: string, x: number, largura: number) => {
      doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text(rotulo.toUpperCase(), x, y);
      doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(10)
        .text(valor, x, y + 10, { width: largura });
    };

    campo('Obra', dados.obra.codigo + ' · ' + dados.obra.nome, 45, 260);
    campo('Solicitante', dados.solicitante.nome, 320, 230);
    y += 34;

    campo('Aberta em', data(dados.criadaEm), 45, 120);
    campo('Enviada em', data(dados.enviadaEm), 180, 120);
    campo('Precisa até', data(dados.dataDesejada), 320, 120);
    y += 34;

    if (dados.obra.cliente) {
      campo('Cliente', dados.obra.cliente, 45, 500);
      y += 34;
    }

    if (dados.justificativa) {
      doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text('JUSTIFICATIVA', 45, y);
      doc.fillColor('#16202b').font('Helvetica').fontSize(9.5)
        .text(dados.justificativa, 45, y + 11, { width: larguraUtil });
      y = doc.y + 12;
    }

    // ---------- Tabela de itens ----------
    y += 6;
    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(11).text('Itens solicitados', 45, y);
    y += 20;

    const COLUNAS = [
      { titulo: '#', x: 45, largura: 20 },
      { titulo: 'Código', x: 65, largura: 52 },
      { titulo: 'Descrição', x: 117, largura: 230 },
      { titulo: 'Un.', x: 347, largura: 28 },
      { titulo: 'Qtd.', x: 375, largura: 55, direita: true },
      { titulo: 'Vlr. estim.', x: 430, largura: 80, direita: true },
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

    for (const item of dados.itens) {
      // Quebra de página quando o item não cabe.
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = desenharCabecalho(50);
      }

      const extras: string[] = [];
      if (item.descricaoComplementar) extras.push(item.descricaoComplementar);
      if (item.normaTecnica) extras.push('Norma: ' + item.normaTecnica);
      if (item.linhaOrcamento) extras.push('Orçamento: ' + item.linhaOrcamento);
      if (item.primeiraCompra) extras.push('PRIMEIRA COMPRA');

      const alturaDescricao = doc.font('Helvetica').fontSize(9)
        .heightOfString(item.descricao, { width: 224 });
      const alturaExtras = extras.length
        ? doc.font('Helvetica').fontSize(7.5).heightOfString(extras.join(' · '), { width: 224 })
        : 0;
      const altura = Math.max(22, alturaDescricao + alturaExtras + 10);

      doc.fillColor('#16202b').font('Helvetica').fontSize(9);
      doc.text(String(item.ordem), 48, y + 5, { width: 14 });
      doc.font('Helvetica-Bold').text(item.codigoInterno, 68, y + 5, { width: 46 });
      doc.font('Helvetica').text(item.descricao, 120, y + 5, { width: 224 });

      if (extras.length) {
        doc.fillColor(CINZA).fontSize(7.5)
          .text(extras.join(' · '), 120, y + 5 + alturaDescricao + 1, { width: 224 });
      }

      doc.fillColor('#16202b').fontSize(9);
      doc.text(item.unidadeMedida, 350, y + 5, { width: 22 });
      doc.text(numeroBr(item.quantidade), 378, y + 5, { width: 49, align: 'right' });
      doc.text(
        item.valorEstimado !== null ? dinheiro(item.quantidade * item.valorEstimado) : '—',
        433, y + 5, { width: 74, align: 'right' },
      );

      y += altura;
      doc.moveTo(45, y).lineTo(doc.page.width - 45, y).strokeColor(BORDA).lineWidth(0.5).stroke();
    }

    // ---------- Total ----------
    y += 8;
    doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(10)
      .text('Total estimado', 45, y, { width: 385, align: 'right' });
    doc.fontSize(11).text(dinheiro(dados.totalEstimado), 433, y - 1, { width: 74, align: 'right' });

    y += 24;

    // ---------- Especificações técnicas ----------
    const comEspecificacao = dados.itens.filter((i) => i.especificacaoTecnica);

    if (comEspecificacao.length > 0) {
      if (y > doc.page.height - 160) {
        doc.addPage();
        y = 50;
      }

      doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(11)
        .text('Especificações técnicas', 45, y);
      y += 16;

      for (const item of comEspecificacao) {
        doc.fillColor(MARINHO).font('Helvetica-Bold').fontSize(9)
          .text(item.codigoInterno + ' · ' + item.descricao, 45, y, { width: larguraUtil });
        doc.fillColor('#16202b').font('Helvetica').fontSize(9)
          .text(item.especificacaoTecnica ?? '', 45, doc.y + 2, { width: larguraUtil });
        y = doc.y + 10;
      }
    }

    if (dados.observacoes) {
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = 50;
      }
      doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text('OBSERVAÇÕES', 45, y);
      doc.fillColor('#16202b').font('Helvetica').fontSize(9.5)
        .text(dados.observacoes, 45, y + 11, { width: larguraUtil });
      y = doc.y + 14;
    }

    // ---------- Assinaturas ----------
    // Tudo aqui precisa caber ACIMA da margem inferior (50pt).
    // Escrever abaixo dela faz o PDFKit criar uma página em branco.
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

    assinatura('Solicitante', 45);
    assinatura('Aprovador', 305);

    // ---------- Rodapé ----------
    doc.fillColor(CINZA).font('Helvetica').fontSize(7.5).text(
      'Porto Inc. · Sistema de Compras e Almoxarifado · documento gerado em ' +
        new Date().toLocaleString('pt-BR'),
      45,
      linhaRodape,
      { width: larguraUtil, align: 'center', lineBreak: false },
    );

    doc.end();
  });
}
