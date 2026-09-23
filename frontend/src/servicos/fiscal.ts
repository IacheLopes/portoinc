// ============================================================
//  Chamadas das telas de Financeiro (Etapa 9)
// ============================================================

import { chamar, baixarArquivo } from './api';
import type { FormatoDeArquivo } from '../componentes/BotaoBaixar';

export type SituacaoNota = 'LANCADA' | 'CONFERIDA' | 'COM_DIVERGENCIA' | 'CANCELADA';

export const ROTULO_NOTA: Record<SituacaoNota, string> = {
  LANCADA: 'Lançada',
  CONFERIDA: 'Conferida',
  COM_DIVERGENCIA: 'Com pendência',
  CANCELADA: 'Cancelada',
};

export const COR_NOTA: Record<SituacaoNota, 'info' | 'sucesso' | 'atencao' | 'erro'> = {
  LANCADA: 'info',
  CONFERIDA: 'sucesso',
  COM_DIVERGENCIA: 'atencao',
  CANCELADA: 'erro',
};

export type EstadoTitulo = 'PAGA' | 'VENCIDA' | 'VENCE_HOJE' | 'A_VENCER' | 'CANCELADA';

export const ROTULO_TITULO: Record<EstadoTitulo, string> = {
  PAGA: 'Paga',
  VENCIDA: 'Vencida',
  VENCE_HOJE: 'Vence hoje',
  A_VENCER: 'A vencer',
  CANCELADA: 'Cancelada',
};

export const COR_TITULO: Record<EstadoTitulo, 'info' | 'sucesso' | 'atencao' | 'erro'> = {
  PAGA: 'sucesso',
  VENCIDA: 'erro',
  VENCE_HOJE: 'atencao',
  A_VENCER: 'info',
  CANCELADA: 'erro',
};

export interface ItemDaNota {
  ordem: number;
  codigo: string | null;
  descricao: string;
  gtin: string | null;
  unidade: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface TituloDaNota {
  id: string;
  numeroFormatado: string;
  parcela: number;
  totalParcelas: number;
  valor: number;
  vencimento: string;
  situacao: string;
  pagoEm: string | null;
}

export interface Nota {
  id: string;
  numero: string;
  serie: string;
  chaveAcesso: string | null;
  chaveFormatada: string | null;
  fornecedor: string;
  fornecedorId: string;
  pedido: string | null;
  pedidoId: string | null;
  emitidaEm: string;
  valorTotal: number;
  valorProdutos: number | null;
  valorFrete: number | null;
  situacao: SituacaoNota;
  divergencias: string[];
  observacoes: string | null;
  doXml: boolean;
  lancadaPor: string;
  criadoEm: string;
  temTitulos: boolean;
  quantidadeTitulos: number;
  condicao: string;
  itens?: ItemDaNota[];
  titulos?: TituloDaNota[];
}

export interface Titulo {
  id: string;
  numeroFormatado: string;
  parcela: number;
  totalParcelas: number;
  valor: number;
  vencimento: string;
  situacao: 'ABERTA' | 'PAGA' | 'CANCELADA';
  estado: EstadoTitulo;
  quando: string;
  fornecedor: string;
  notaFiscalId: string;
  nota: string;
  pedido: string | null;
  pagoEm: string | null;
  valorPago: number | null;
  formaPagamento: string | null;
  pagoPor: string | null;
}

export interface ResumoFinanceiro {
  emAberto: { quantidade: number; valor: number };
  vencidas: { quantidade: number; valor: number };
  proximos7Dias: { quantidade: number; valor: number };
  pagoNoMes: { quantidade: number; valor: number };
  notasComPendencia: number;
  notasSemParcelas: number;
}

export interface PedidoParaNota {
  id: string;
  numeroFormatado: string;
  fornecedorId: string;
  fornecedor: string;
  cnpj: string;
  situacao: string;
  valorTotal: number;
  jaLancado: number;
  falta: number;
  pagamento: string;
}

export interface NotaLidaDoXml {
  chaveAcesso: string | null;
  numero: string;
  serie: string;
  emitidaEm: string | null;
  cnpjEmitente: string | null;
  nomeEmitente: string | null;
  valorTotal: number;
  valorProdutos: number | null;
  valorFrete: number | null;
  itens: ItemDaNota[];
}

export function buscarResumo() {
  return chamar<ResumoFinanceiro>('/api/financeiro/resumo');
}

export function listarTitulos(filtros: { situacao?: string; quando?: string } = {}) {
  const q = new URLSearchParams();
  if (filtros.situacao) q.set('situacao', filtros.situacao);
  if (filtros.quando) q.set('quando', filtros.quando);

  const cauda = q.toString();
  return chamar<{ titulos: Titulo[] }>('/api/contas-pagar' + (cauda ? '?' + cauda : ''));
}

export function pagarTitulo(
  id: string,
  dados: { pagoEm?: string; valorPago?: number; formaPagamento?: string; observacoes?: string },
) {
  return chamar<{ ok: boolean; mensagem: string }>('/api/contas-pagar/' + id + '/pagar', {
    metodo: 'POST',
    corpo: dados,
  });
}

export function listarNotas(situacao?: string) {
  return chamar<{ notas: Nota[] }>(
    '/api/notas-fiscais' + (situacao ? '?situacao=' + situacao : ''),
  );
}

export function buscarNota(id: string) {
  return chamar<{ nota: Nota }>('/api/notas-fiscais/' + id);
}

export function lerXml(xml: string) {
  return chamar<{
    nota: NotaLidaDoXml;
    chaveValida: boolean | null;
    fornecedor: { id: string; nome: string } | null;
    pedidosDoFornecedor: Array<{ id: string; numeroFormatado: string }>;
    aviso: string | null;
  }>('/api/notas-fiscais/ler-xml', { metodo: 'POST', corpo: { xml } });
}

export function lancarNota(dados: {
  numero: string;
  serie?: string;
  chaveAcesso?: string;
  fornecedorId: string;
  pedidoId?: string | null;
  emitidaEm: string;
  valorTotal: number;
  valorProdutos?: number;
  valorFrete?: number;
  observacoes?: string;
  doXml?: boolean;
  itens?: Array<Omit<ItemDaNota, 'ordem'>>;
}) {
  return chamar<{ nota: Nota; mensagem: string }>('/api/notas-fiscais', {
    metodo: 'POST',
    corpo: dados,
  });
}

export function gerarTitulos(notaId: string) {
  return chamar<{
    ok: boolean;
    condicao: string;
    titulos: Array<{ numeroFormatado: string; parcela: string; valor: number; vencimento: string }>;
    mensagem: string;
  }>('/api/notas-fiscais/' + notaId + '/gerar-titulos', { metodo: 'POST' });
}

export function cancelarNota(notaId: string) {
  return chamar<{ ok: boolean; mensagem: string }>('/api/notas-fiscais/' + notaId + '/cancelar', {
    metodo: 'POST',
  });
}

export function listarPedidosParaNota() {
  return chamar<{ pedidos: PedidoParaNota[] }>('/api/notas-fiscais/pedidos-abertos');
}

export function exportarContas(formato: FormatoDeArquivo) {
  return baixarArquivo(
    '/api/contas-pagar/exportar?formato=' + formato,
    'contas-a-pagar.' + formato,
  );
}

// ------------------------------------------------------------
//  Painel: indicadores e gráficos
// ------------------------------------------------------------

export interface ResumoDeParcelas {
  quantidade: number;
  valor: number;
}

export interface IndicadoresDeGestao {
  prazoMedioPagamento: number;
  pontualidade: number;
  totalComprometido: number;
  maiorParcelaAberta: number;
  diasParaProximoVencimento: number | null;
  ticketMedio: number;
}

export interface MesDoFluxo {
  chave: string;
  rotulo: string;
  aVencer: number;
  vencido: number;
  pago: number;
  total: number;
}

export interface LinhaDoRanking {
  nome: string;
  aberto: number;
  pago: number;
  total: number;
}

export interface FatiaDaCarteira {
  rotulo: string;
  valor: number;
  percentual: number;
  tom: 'erro' | 'atencao' | 'info' | 'sucesso';
}

export interface PainelFinanceiro {
  resumo: {
    vencidas: ResumoDeParcelas;
    proximos7Dias: ResumoDeParcelas;
    emAberto: ResumoDeParcelas;
    pagoNoMes: ResumoDeParcelas;
  };
  indicadores: IndicadoresDeGestao;
  fluxo: MesDoFluxo[];
  porFornecedor: LinhaDoRanking[];
  porObra: LinhaDoRanking[];
  carteira: FatiaDaCarteira[];
  notas: {
    comPendencia: number;
    semParcelas: number;
    lancadasNoMes: number;
  };
  totalDeParcelas: number;
}

export function buscarPainel() {
  return chamar<PainelFinanceiro>('/api/financeiro/painel');
}
