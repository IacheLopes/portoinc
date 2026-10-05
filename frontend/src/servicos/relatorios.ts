// ============================================================
//  Relatórios
//
//  Cinco perguntas, cinco respostas. As contas são feitas no
//  servidor: aqui só pedimos e mostramos.
// ============================================================

import { chamar, baixarArquivo } from './api';
import type { FormatoDeArquivo } from '../componentes/BotaoBaixar';

export interface ObraResumo {
  id: string;
  codigo: string;
  nome: string;
}

// ------------------------------------------------------------
//  1. Orçado × realizado
// ------------------------------------------------------------

export type SituacaoDaLinha = 'FOLGADO' | 'ATENCAO' | 'ESTOUROU' | 'SEM_PREVISAO';

export interface LinhaDoOrcamento {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidadePrevista: number;
  valorUnitarioPrevisto: number;
  previsto: number;
  realizado: number;
  saldo: number;
  consumido: number;
  situacao: SituacaoDaLinha;
}

export interface ResumoDoOrcamento {
  previsto: number;
  realizado: number;
  /** Dinheiro já aprovado que ainda não virou pedido. */
  comprometido: number;
  saldo: number;
  consumido: number;
  linhasEstouradas: number;
  linhasEmAtencao: number;
}

export interface RelatorioDeOrcamento {
  obras: ObraResumo[];
  obraId: string | null;
  obra: ObraResumo | null;
  linhas: LinhaDoOrcamento[];
  resumo: ResumoDoOrcamento;
  foraDoOrcamento: number;
}

export const ROTULO_SITUACAO: Record<SituacaoDaLinha, string> = {
  FOLGADO: 'Folgado',
  ATENCAO: 'Atenção',
  ESTOUROU: 'Estourou',
  SEM_PREVISAO: 'Sem previsão',
};

export const COR_SITUACAO: Record<SituacaoDaLinha, 'sucesso' | 'atencao' | 'erro' | 'neutro'> = {
  FOLGADO: 'sucesso',
  ATENCAO: 'atencao',
  ESTOUROU: 'erro',
  SEM_PREVISAO: 'neutro',
};

export function buscarOrcamento(obraId?: string) {
  return chamar<RelatorioDeOrcamento>(
    '/api/relatorios/orcamento' + (obraId ? '?obraId=' + obraId : ''),
  );
}

export function exportarOrcamento(formato: FormatoDeArquivo, obraId?: string) {
  return baixarArquivo(
    '/api/relatorios/orcamento?formato=' + formato + (obraId ? '&obraId=' + obraId : ''),
    'orcado-x-realizado.' + formato,
  );
}

// ------------------------------------------------------------
//  2. Economia nas cotações
// ------------------------------------------------------------

export interface CotacaoAnalisada {
  numeroFormatado: string;
  titulo: string;
  encerradaEm: string | null;
  fornecedoresConvidados: number;
  fornecedoresResponderam: number;
  taxaDeResposta: number;
  estimado: number;
  fechado: number;
  economia: number;
  economiaPercentual: number;
  ganhoNaDisputa: number;
}

export interface ResumoDaEconomia {
  cotacoes: number;
  estimado: number;
  fechado: number;
  economia: number;
  economiaPercentual: number;
  ganhoNaDisputa: number;
  taxaMediaDeResposta: number;
  mediaDeFornecedoresPorCotacao: number;
}

export interface RelatorioDeEconomia {
  de: string;
  ate: string;
  cotacoes: CotacaoAnalisada[];
  resumo: ResumoDaEconomia;
}

export function buscarEconomia(periodo: { de?: string; ate?: string } = {}) {
  return chamar<RelatorioDeEconomia>('/api/relatorios/economia' + comPeriodo(periodo));
}

export function exportarEconomia(
  formato: FormatoDeArquivo,
  periodo: { de?: string; ate?: string } = {},
) {
  return baixarArquivo(
    '/api/relatorios/economia' + comPeriodo(periodo, formato),
    'economia-nas-cotacoes.' + formato,
  );
}

// ------------------------------------------------------------
//  3. Desempenho do fornecedor
// ------------------------------------------------------------

export interface DesempenhoDoFornecedor {
  nome: string;
  convites: number;
  respostas: number;
  taxaDeResposta: number;
  pedidos: number;
  valorComprado: number;
  entregas: number;
  noPrazo: number;
  pontualidade: number;
  atrasoMedio: number;
  ressalvas: number;
  devolucoes: number;
  qualidade: number;
  leitura: string;
  /**
   * Quando ele entregou pela última vez. `null` = nunca entregou.
   *
   * Sem isto a tabela dizia "64% no prazo" e quem lia não tinha
   * como saber se era de agosto ou de três anos atrás.
   */
  ultimaEntrega: string | null;
  /** Desde quando há história dele. `null` = nunca entregou. */
  primeiraEntrega: string | null;
  /** Quanto das compras da empresa passou por ele, em %. */
  participacao: number;
  /** Depender demais dele é risco? */
  concentracao: 'OK' | 'ATENCAO';
}

export function buscarFornecedores() {
  return chamar<{
    fornecedores: DesempenhoDoFornecedor[];
    /** O período que a história cobre. `null` = nenhuma entrega. */
    periodoDaHistoria: string | null;
  }>('/api/relatorios/fornecedores');
}

export function exportarFornecedores(formato: FormatoDeArquivo) {
  return baixarArquivo(
    '/api/relatorios/fornecedores?formato=' + formato,
    'desempenho-dos-fornecedores.' + formato,
  );
}

// ------------------------------------------------------------
//  4. Tempo do processo
// ------------------------------------------------------------

export interface EtapaDoTempo {
  etapa: string;
  descricao: string;
  dias: number;
  amostra: number;
}

export interface RelatorioDeTempos {
  de: string;
  ate: string;
  obras: ObraResumo[];
  obraId: string | null;
  etapas: EtapaDoTempo[];
  total: { dias: number; amostra: number; maisDemorada: string | null };
  solicitacoes: number;
}

export function buscarTempos(filtro: { obraId?: string; de?: string; ate?: string } = {}) {
  return chamar<RelatorioDeTempos>('/api/relatorios/tempos' + comPeriodo(filtro));
}

export function exportarTempos(
  formato: FormatoDeArquivo,
  filtro: { obraId?: string; de?: string; ate?: string } = {},
) {
  return baixarArquivo(
    '/api/relatorios/tempos' + comPeriodo(filtro, formato),
    'tempo-do-processo.' + formato,
  );
}

// ------------------------------------------------------------
//  5. Consumo por família e material
// ------------------------------------------------------------

export interface LinhaDeConsumo {
  nome: string;
  quantidade: number;
  valor: number;
  itens: number;
  participacao: number;
}

export interface MaterialMaisComprado {
  codigo: string;
  descricao: string;
  familia: string;
  unidadeMedida: string;
  quantidade: number;
  valor: number;
  participacao: number;
  precoMedio: number;
}

export interface RelatorioDeConsumo {
  de: string;
  ate: string;
  obras: ObraResumo[];
  obraId: string | null;
  familias: LinhaDeConsumo[];
  materiais: MaterialMaisComprado[];
  total: number;
  linhas: number;
}

export function buscarConsumo(filtro: { obraId?: string; de?: string; ate?: string } = {}) {
  return chamar<RelatorioDeConsumo>('/api/relatorios/consumo' + comPeriodo(filtro));
}

export function exportarConsumo(
  formato: FormatoDeArquivo,
  filtro: { obraId?: string; de?: string; ate?: string } = {},
) {
  return baixarArquivo(
    '/api/relatorios/consumo' + comPeriodo(filtro, formato),
    'consumo-de-materiais.' + formato,
  );
}

// ------------------------------------------------------------
//  6. Estoque parado
// ------------------------------------------------------------

export interface LinhaDeEstoqueParado {
  codigo: string;
  descricao: string;
  familia: string;
  unidadeMedida: string;
  almoxarifado: string;
  quantidade: number;
  custoMedio: number | null;
  diasParado: number;
  valorParado: number;
  motivo: 'NUNCA_SAIU' | 'PAROU';
}

export interface RelatorioDeEstoqueParado {
  dias: number;
  linhas: LinhaDeEstoqueParado[];
  resumo: {
    valorParado: number;
    itens: number;
    nuncaSairam: number;
    maisAntigo: number;
    leitura: string;
  };
}

export function buscarEstoqueParado(dias: number) {
  return chamar<RelatorioDeEstoqueParado>('/api/relatorios/estoque-parado?dias=' + dias);
}

export function exportarEstoqueParado(formato: FormatoDeArquivo, dias: number) {
  return baixarArquivo(
    '/api/relatorios/estoque-parado?formato=' + formato + '&dias=' + dias,
    'estoque-parado.' + formato,
  );
}

// ------------------------------------------------------------
//  Apoio
// ------------------------------------------------------------

/** Monta a query do período, com ou sem o pedido de arquivo. */
function comPeriodo(
  filtro: { obraId?: string; de?: string; ate?: string },
  formato?: FormatoDeArquivo,
): string {
  const partes: string[] = [];

  if (formato) partes.push('formato=' + formato);
  if (filtro.obraId) partes.push('obraId=' + filtro.obraId);
  if (filtro.de) partes.push('de=' + filtro.de);
  if (filtro.ate) partes.push('ate=' + filtro.ate);

  return partes.length > 0 ? '?' + partes.join('&') : '';
}
