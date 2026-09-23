// ============================================================
//  Locação de equipamentos
//
//  Equipamento alugado tem relógio correndo: o custo sobe
//  sozinho enquanto ele não volta. Toda conta é feita no
//  servidor — aqui só pedimos e mostramos.
// ============================================================

import { chamar, baixarArquivo } from './api';
import type { FormatoDeArquivo } from '../componentes/BotaoBaixar';

export type Periodicidade = 'DIARIA' | 'SEMANAL' | 'MENSAL';
export type SituacaoLocacao = 'ATIVA' | 'DEVOLVIDA' | 'CANCELADA';
export type AlertaLocacao =
  | 'ATRASADA' | 'VENCE_HOJE' | 'PERTO' | 'EM_DIA' | 'DEVOLVIDA' | 'CANCELADA';

export interface ObraResumo {
  id: string;
  codigo: string;
  nome: string;
}

export interface FornecedorResumo {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
}

export interface Locacao {
  id: string;
  numero: number;
  numeroFormatado: string;
  situacao: SituacaoLocacao;
  alerta: AlertaLocacao;
  alertaRotulo: string;
  leitura: string;

  fornecedor: FornecedorResumo;
  obra: ObraResumo;
  material: { id: string; codigoInterno: string; descricao: string } | null;
  pedido: { id: string; numero: number } | null;

  descricao: string;
  identificacao: string | null;
  quantidade: number;
  unidadeMedida: string;

  periodicidade: Periodicidade;
  periodicidadeRotulo: string;
  valorPeriodo: number;

  inicioEm: string;
  previsaoDevolucao: string;
  devolvidoEm: string | null;

  diasDeUso: number;
  periodosCobrados: number;
  custoAcumulado: number;
  custoPrevisto: number;
  diasDeAtraso: number;
  custoDoAtraso: number;

  observacoes: string | null;
  motivo: string | null;
  responsavel: { id: string; nome: string };
  devolvidoPor: { id: string; nome: string } | null;
  criadoEm: string;
}

export interface ResumoDaLocacao {
  ativas: number;
  atrasadas: number;
  vencendo: number;
  custoEmAndamento: number;
  desperdicio: number;
  custoTotal: number;
}

export interface PainelDeLocacao {
  contratos: Locacao[];
  resumo: ResumoDaLocacao;
  obras: ObraResumo[];
}

export interface ItemComprado {
  pedidoItemId: string;
  pedidoId: string;
  pedidoNumero: number;
  fornecedor: FornecedorResumo;
  obra: ObraResumo;
  material: { id: string; codigoInterno: string; descricao: string };
  quantidade: number;
  unidadeMedida: string;
  valorUnitario: number;
  prazoEntregaDias: number | null;
  saiuEm: string;
}

export interface NovaLocacao {
  fornecedorId: string;
  obraId: string;
  materialId?: string | null;
  pedidoItemId?: string | null;
  descricao: string;
  identificacao?: string;
  quantidade: number;
  unidadeMedida: string;
  periodicidade: Periodicidade;
  valorPeriodo: number;
  inicioEm: string;
  previsaoDevolucao: string;
  observacoes?: string;
}

// ------------------------------------------------------------
//  Rótulos e cores
// ------------------------------------------------------------

export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = {
  DIARIA: 'Por dia',
  SEMANAL: 'Por semana',
  MENSAL: 'Por mês',
};

export const COR_ALERTA: Record<AlertaLocacao, 'sucesso' | 'atencao' | 'erro' | 'info'> = {
  ATRASADA: 'erro',
  VENCE_HOJE: 'atencao',
  PERTO: 'atencao',
  EM_DIA: 'sucesso',
  DEVOLVIDA: 'info',
  CANCELADA: 'info',
};

/** Os filtros da barra, na ordem em que fazem sentido olhar. */
export const FILTROS_DE_ALERTA = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'ATRASADA', rotulo: 'Atrasadas' },
  { valor: 'VENCE_HOJE', rotulo: 'Vencem hoje' },
  { valor: 'PERTO', rotulo: 'Vencem em breve' },
  { valor: 'EM_DIA', rotulo: 'Em dia' },
  { valor: 'DEVOLVIDA', rotulo: 'Devolvidas' },
  { valor: 'CANCELADA', rotulo: 'Canceladas' },
];

// ------------------------------------------------------------
//  Chamadas
// ------------------------------------------------------------

function comFiltro(filtro: { obraId?: string; alerta?: string }, formato?: FormatoDeArquivo) {
  const partes: string[] = [];

  if (formato) partes.push('formato=' + formato);
  if (filtro.obraId) partes.push('obraId=' + filtro.obraId);
  if (filtro.alerta) partes.push('alerta=' + filtro.alerta);

  return partes.length > 0 ? '?' + partes.join('&') : '';
}

export function buscarLocacoes(filtro: { obraId?: string; alerta?: string } = {}) {
  return chamar<PainelDeLocacao>('/api/locacao' + comFiltro(filtro));
}

export function buscarLocacao(id: string) {
  return chamar<{ contrato: Locacao }>('/api/locacao/' + id);
}

export function listarItensComprados() {
  return chamar<{ itens: ItemComprado[] }>('/api/locacao/pedidos-disponiveis');
}

export function contratarLocacao(dados: NovaLocacao) {
  return chamar<{ contrato: Locacao }>('/api/locacao', { metodo: 'POST', corpo: dados });
}

export function devolverLocacao(id: string, dados: { devolvidoEm?: string; motivo?: string }) {
  return chamar<{ contrato: Locacao; mensagem: string }>('/api/locacao/' + id + '/devolver', {
    metodo: 'POST',
    corpo: dados,
  });
}

export function cancelarLocacao(id: string, motivo: string) {
  return chamar<{ contrato: Locacao }>('/api/locacao/' + id + '/cancelar', {
    metodo: 'POST',
    corpo: { motivo },
  });
}

export function exportarLocacoes(
  formato: FormatoDeArquivo,
  filtro: { obraId?: string; alerta?: string } = {},
) {
  return baixarArquivo(
    '/api/locacao' + comFiltro(filtro, formato),
    'locacao-de-equipamentos.' + formato,
  );
}
