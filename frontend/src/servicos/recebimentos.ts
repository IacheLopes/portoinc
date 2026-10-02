// ============================================================
//  Chamadas da tela de Recebimento (Etapa 7)
// ============================================================

import { chamar } from './api';
import type { DadosDaPagina } from './paginacao';

export type SituacaoPedido =
  | 'RASCUNHO'
  | 'ENVIADO'
  | 'CONFIRMADO'
  | 'RECEBIDO_PARCIAL'
  | 'RECEBIDO'
  | 'CANCELADO';

export const ROTULO_SITUACAO_PEDIDO: Record<SituacaoPedido, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADO: 'Enviado',
  CONFIRMADO: 'Confirmado',
  RECEBIDO_PARCIAL: 'Recebido em parte',
  RECEBIDO: 'Recebido',
  CANCELADO: 'Cancelado',
};

export const COR_SITUACAO_PEDIDO: Record<
  SituacaoPedido,
  'info' | 'sucesso' | 'atencao' | 'erro'
> = {
  RASCUNHO: 'info',
  ENVIADO: 'atencao',
  CONFIRMADO: 'atencao',
  RECEBIDO_PARCIAL: 'atencao',
  RECEBIDO: 'sucesso',
  CANCELADO: 'erro',
};

export type SituacaoItemRecebido = 'CONFORME' | 'COM_RESSALVA' | 'DEVOLVIDO';

export interface PedidoAberto {
  id: string;
  numeroFormatado: string;
  situacao: SituacaoPedido;
  fornecedor: string;
  obra: string | null;
  itensPendentes: number;
  totalItens: number;
  criadoEm: string;
}

export interface ItemParaConferir {
  pedidoItemId: string;
  ordem: number;
  codigo: string;
  gtin: string | null;
  descricao: string;
  unidadeMedida: string;
  quantidadePedida: number;
  quantidadeJaRecebida: number;
  saldo: number;
  concluido: boolean;
  normaTecnica: string | null;
  marca: string | null;
  valorUnitario: number;
}

export interface PedidoParaConferir {
  pedido: {
    id: string;
    numeroFormatado: string;
    situacao: SituacaoPedido;
    fornecedor: string;
    fornecedorCnpj: string;
    comprador: string;
    origem: string;
    criadoEm: string;
    enviadoEm: string | null;
    obra: string | null;
  };
  itens: ItemParaConferir[];
  tudoRecebido: boolean;
  almoxarifados: Array<{ id: string; codigo: string; nome: string; central: boolean }>;
}

export interface LinhaParaEnviar {
  pedidoItemId: string;
  quantidadeRecebida: number;
  quantidadeDevolvida: number;
  situacao: SituacaoItemRecebido;
  motivo?: string;
}

export interface RecebimentoResumo {
  id: string;
  numeroFormatado: string;
  pedido: string;
  situacaoPedido: SituacaoPedido;
  fornecedor: string;
  almoxarife: string;
  almoxarifado: string;
  notaFiscal: string | null;
  quantidadeItens: number;
  temRessalva: boolean;
  recebidoEm: string;
}

export function listarPedidosAbertos() {
  return chamar<{ pedidos: PedidoAberto[] }>('/api/recebimentos/pedidos-abertos');
}

export function buscarPedidoParaConferir(numero: string) {
  return chamar<PedidoParaConferir>('/api/recebimentos/pedido/' + encodeURIComponent(numero));
}

export function registrarRecebimento(dados: {
  pedidoId: string;
  almoxarifadoId: string;
  notaFiscal?: string;
  serieNotaFiscal?: string;
  transportadora?: string;
  observacoes?: string;
  itens: LinhaParaEnviar[];
}) {
  return chamar<{
    ok: boolean;
    recebimento: { id: string; numeroFormatado: string };
    situacaoDoPedido: SituacaoPedido;
    mensagem: string;
  }>('/api/recebimentos', { metodo: 'POST', corpo: dados });
}

export function listarRecebimentos(pagina?: number) {
  const cauda = pagina && pagina > 1 ? '?pagina=' + pagina : '';
  return chamar<{ recebimentos: RecebimentoResumo[] } & DadosDaPagina>(
    '/api/recebimentos' + cauda,
  );
}

export function marcarPedidoEnviado(id: string) {
  return chamar<{ ok: boolean; situacao: SituacaoPedido; mensagem: string }>(
    '/api/pedidos/' + id + '/enviar',
    { metodo: 'POST' },
  );
}

/**
 * Lê um número digitado em português: aceita vírgula decimal e
 * devolve 0 quando o campo está vazio.
 */
export function lerQuantidade(texto: string): number {
  const limpo = String(texto ?? '').trim().replace(',', '.');
  if (limpo === '') return 0;

  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN;
}
