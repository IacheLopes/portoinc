// ============================================================
//  Preparo do pedido para envio ao fornecedor
//
//  O fluxo de compras diz que o pedido sai "por e-mail/WhatsApp".
//  São dois canais e UM pedido: buscar os dados e desenhar o PDF
//  é o mesmo trabalho nos dois casos.
//
//  Ficava dentro da rota do WhatsApp. Ao acrescentar o e-mail,
//  copiar essas 80 linhas significaria duas versões do mesmo PDF
//  envelhecendo em ritmos diferentes.
// ============================================================

import { banco } from '../plugins/banco.js';
import { numero as decimal } from './util.js';
import { formatarNumeroBid, descreverPagamento } from './cotacao.js';
import { formatarNumeroPedido } from './equalizacao.js';
import { gerarPdfPedido } from './pdf-pedido.js';

export interface PedidoPronto {
  numeroFormatado: string;
  nomeFornecedor: string;
  /** Contatos do fornecedor, como estão no cadastro. */
  whatsapp: string | null;
  email: string | null;
  situacao: string;
  total: number;
  totalEmReais: string;
  pagamento: string;
  pdf: Buffer;
}

/**
 * Junta tudo o que o envio precisa, ou devolve null se o pedido
 * não existe. Quem chama decide o que fazer com o null: a rota
 * responde 404, e só ela sabe disso.
 */
export async function prepararPedidoParaEnvio(id: string): Promise<PedidoPronto | null> {
  const pedido = await banco.pedido.findUnique({
    where: { id },
    include: {
      fornecedor: true,
      comprador: { select: { nome: true } },
      bid: { select: { numero: true, titulo: true } },
      itens: {
        orderBy: { ordem: 'asc' },
        include: {
          bidItem: {
            include: {
              material: { select: { codigoInterno: true, descricao: true, normaTecnica: true } },
              solicitacaoItem: {
                select: {
                  solicitacao: {
                    select: { numero: true, obra: { select: { codigo: true, nome: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!pedido) return null;

  const total =
    pedido.itens.reduce(
      (s, i) => s + (decimal(i.quantidade) ?? 0) * (decimal(i.valorUnitario) ?? 0),
      0,
    ) +
    (decimal(pedido.valorFrete) ?? 0) +
    (decimal(pedido.outrosCustos) ?? 0);

  const pagamento = descreverPagamento(
    decimal(pedido.percentualEntrada),
    pedido.quantidadeParcelas,
    pedido.intervaloParcelasDias,
  );

  const pdf = await gerarPdfPedido({
    numero: pedido.numero,
    situacao: pedido.situacao,
    criadoEm: pedido.criadoEm,
    comprador: pedido.comprador.nome,
    origem: formatarNumeroBid(pedido.bid.numero) + ' — ' + pedido.bid.titulo,
    fornecedor: {
      razaoSocial: pedido.fornecedor.razaoSocial,
      nomeFantasia: pedido.fornecedor.nomeFantasia,
      cnpj: pedido.fornecedor.cnpj,
      email: pedido.fornecedor.email,
      telefone: pedido.fornecedor.whatsapp ?? pedido.fornecedor.telefone,
    },
    frete: decimal(pedido.valorFrete) ?? 0,
    outrosCustos: decimal(pedido.outrosCustos) ?? 0,
    pagamento,
    observacoes: pedido.observacoes,
    itens: pedido.itens.map((i) => ({
      ordem: i.ordem,
      codigo: i.bidItem.material.codigoInterno,
      descricao: i.bidItem.material.descricao,
      normaTecnica: i.bidItem.material.normaTecnica,
      unidadeMedida: i.unidadeMedida,
      quantidade: decimal(i.quantidade) ?? 0,
      valorUnitario: decimal(i.valorUnitario) ?? 0,
      marca: i.marca,
      modelo: i.modelo,
      prazoEntregaDias: i.prazoEntregaDias,
      obra: i.bidItem.solicitacaoItem.solicitacao.obra,
    })),
  });

  return {
    numeroFormatado: formatarNumeroPedido(pedido.numero),
    nomeFornecedor: pedido.fornecedor.nomeFantasia ?? pedido.fornecedor.razaoSocial,
    whatsapp: pedido.fornecedor.whatsapp,
    email: pedido.fornecedor.email,
    situacao: pedido.situacao,
    total,
    totalEmReais: 'R$ ' + total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    pagamento,
    pdf,
  };
}

/**
 * Enviou de verdade: o pedido sai do rascunho sozinho.
 *
 * Vale para os dois canais — quem mandou por e-mail não precisa
 * mandar pelo WhatsApp só para o pedido mudar de situação.
 */
export async function marcarPedidoComoEnviado(id: string, situacaoAtual: string) {
  if (situacaoAtual !== 'RASCUNHO') return;

  await banco.pedido.update({
    where: { id },
    data: { situacao: 'ENVIADO', enviadoEm: new Date() },
  });
}
