// ============================================================
//  Chamadas das telas de Estoque (Etapa 8)
// ============================================================

import { chamar } from './api';
import type { DadosDaPagina } from './paginacao';

export type TipoMovimento =
  | 'ENTRADA'
  | 'SAIDA'
  | 'AJUSTE'
  | 'TRANSFERENCIA_SAIDA'
  | 'TRANSFERENCIA_ENTRADA';

export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Retirada',
  AJUSTE: 'Ajuste',
  TRANSFERENCIA_SAIDA: 'Transferência (saiu)',
  TRANSFERENCIA_ENTRADA: 'Transferência (entrou)',
};

export const COR_MOVIMENTO: Record<TipoMovimento, 'info' | 'sucesso' | 'atencao' | 'erro'> = {
  ENTRADA: 'sucesso',
  SAIDA: 'info',
  AJUSTE: 'atencao',
  TRANSFERENCIA_SAIDA: 'info',
  TRANSFERENCIA_ENTRADA: 'sucesso',
};

/** Movimentos que somam no saldo — usado só para o sinal na tela. */
export function soma(tipo: TipoMovimento): boolean {
  return tipo === 'ENTRADA' || tipo === 'TRANSFERENCIA_ENTRADA';
}

export interface AlmoxarifadoResumo {
  id: string;
  codigo: string;
  nome: string;
  central: boolean;
  obra: { id: string; codigo: string; nome: string } | null;
}

export interface LinhaEstoque {
  materialId: string;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  quantidade: number;
  custoMedio: number | null;
  pontoPedido: number | null;
  gtin: string | null;
  familia: string;
  /** Frase pronta quando o material está no ponto de pedido. */
  alerta: string;
}

export interface ResumoEstoque {
  itens: number;
  valorTotal: number;
  abaixoDoMinimo: number;
  semSaldo: number;
}

export interface Estoque {
  almoxarifados: AlmoxarifadoResumo[];
  almoxarifadoId: string | null;
  linhas: LinhaEstoque[];
  resumo: ResumoEstoque | null;
}

export interface Movimento {
  id: string;
  numeroFormatado: string;
  tipo: TipoMovimento;
  almoxarifado: string;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  quantidade: number;
  saldoDepois: number;
  valorUnitario: number | null;
  usuario: string;
  destino: string | null;
  observacao: string | null;
  criadoEm: string;
}

export interface ItemDeReposicao {
  materialId: string;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  saldoAtual: number;
  pontoPedido: number | null;
  quantidade: number;
  valorEstimado: number | null;
  linhaOrcamentoId: string | null;
  motivo: string;
}

export function buscarEstoque(almoxarifadoId?: string, busca?: string) {
  const q = new URLSearchParams();
  if (almoxarifadoId) q.set('almoxarifadoId', almoxarifadoId);
  if (busca) q.set('busca', busca);

  const cauda = q.toString();
  return chamar<Estoque>('/api/estoque' + (cauda ? '?' + cauda : ''));
}

export function listarMovimentos(
  almoxarifadoId?: string,
  materialId?: string,
  pagina?: number,
) {
  const q = new URLSearchParams();
  if (almoxarifadoId) q.set('almoxarifadoId', almoxarifadoId);
  if (materialId) q.set('materialId', materialId);
  if (pagina && pagina > 1) q.set('pagina', String(pagina));

  const cauda = q.toString();
  return chamar<{ movimentos: Movimento[] } & DadosDaPagina>(
    '/api/estoque/movimentos' + (cauda ? '?' + cauda : ''),
  );
}

export function registrarMovimento(dados: {
  almoxarifadoId: string;
  materialId: string;
  tipo: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
  quantidade: number;
  valorUnitario?: number;
  destino?: string;
  observacao?: string;
}) {
  return chamar<{
    ok: boolean;
    movimento: { id: string; numeroFormatado: string };
    saldoDepois: number;
    mensagem: string;
  }>('/api/estoque/movimentos', { metodo: 'POST', corpo: dados });
}

export function transferir(dados: {
  materialId: string;
  origemId: string;
  destinoId: string;
  quantidade: number;
  observacao?: string;
}) {
  return chamar<{ ok: boolean; mensagem: string }>('/api/estoque/transferir', {
    metodo: 'POST',
    corpo: dados,
  });
}

export function buscarReposicao(almoxarifadoId: string) {
  return chamar<{
    obra: { id: string; codigo: string; nome: string } | null;
    itens: ItemDeReposicao[];
    mensagem: string;
  }>('/api/estoque/reposicao?almoxarifadoId=' + almoxarifadoId);
}
