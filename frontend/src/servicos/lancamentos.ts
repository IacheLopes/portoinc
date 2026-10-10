// ============================================================
//  Chamadas da tela de receitas e despesas
//
//  O lugar que faltava: onde se cadastra a receita da empresa e a
//  despesa que não nasce de uma compra.
// ============================================================

import { chamar, baixarArquivo } from './api';
import type { FormatoDeArquivo } from '../componentes/BotaoBaixar';
import type { DadosDaPagina } from './paginacao';

export type TipoLancamento = 'RECEITA' | 'DESPESA';
export type SituacaoLancamento = 'PREVISTO' | 'REALIZADO' | 'CANCELADO';

export const ROTULO_TIPO: Record<TipoLancamento, string> = {
  RECEITA: 'Entrada',
  DESPESA: 'Saída',
};

/**
 * O rótulo muda com o tipo, e isso não é enfeite.
 *
 * "Realizado" não diz nada a quem está olhando: para a receita, o
 * que aconteceu foi que o dinheiro CAIU; para a despesa, que ele
 * SAIU. Uma palavra só para os dois obrigaria a traduzir de cabeça.
 */
export const ROTULO_SITUACAO: Record<TipoLancamento, Record<SituacaoLancamento, string>> = {
  RECEITA: { PREVISTO: 'A receber', REALIZADO: 'Recebido', CANCELADO: 'Cancelado' },
  DESPESA: { PREVISTO: 'A pagar', REALIZADO: 'Pago', CANCELADO: 'Cancelado' },
};

export const COR_SITUACAO: Record<SituacaoLancamento, 'info' | 'sucesso' | 'erro'> = {
  PREVISTO: 'info',
  REALIZADO: 'sucesso',
  CANCELADO: 'erro',
};

export interface ObraDoLancamento {
  id: string;
  codigo: string;
  nome: string;
}

export interface Lancamento {
  id: string;
  numeroFormatado: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  previstoPara: string;
  realizadoEm: string | null;
  situacao: SituacaoLancamento;
  /** Entrada que a empresa já tinha: soma no saldo, não no faturamento. */
  aberturaDeCaixa: boolean;
  categoria: string | null;
  formaPagamento: string | null;
  observacoes: string | null;
  obra: ObraDoLancamento | null;
  criadoPor: string;
  criadoEm: string;
}

export interface Caixa {
  entrou: number;
  /** Quanto do `entrou` é dinheiro que a empresa já tinha. */
  aberturaDeCaixa: number;
  /** `entrou - aberturaDeCaixa`: o que ela faturou aqui dentro. */
  faturou: number;
  saiu: number;
  saldo: number;
  aReceber: number;
  aPagar: number;
  previsto: number;
  detalhe: {
    comprasPagas: number;
    despesasFeitas: number;
    comprasEmAberto: number;
    despesasPrevistas: number;
  };
}

export interface NovoLancamento {
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  previstoPara: string;
  obraId?: string | null;
  categoria?: string;
  formaPagamento?: string;
  observacoes?: string;
  jaAconteceu?: boolean;
  /** Dinheiro que a empresa já tinha ao entrar no sistema. */
  aberturaDeCaixa?: boolean;
}

export function listarLancamentos(
  filtros: { tipo?: string; situacao?: string; obraId?: string; pagina?: number } = {},
) {
  const q = new URLSearchParams();
  if (filtros.tipo) q.set('tipo', filtros.tipo);
  if (filtros.situacao) q.set('situacao', filtros.situacao);
  if (filtros.obraId) q.set('obraId', filtros.obraId);
  if (filtros.pagina && filtros.pagina > 1) q.set('pagina', String(filtros.pagina));

  const cauda = q.toString();
  return chamar<{ lancamentos: Lancamento[] } & DadosDaPagina>(
    '/api/lancamentos' + (cauda ? '?' + cauda : ''),
  );
}

export interface FatiaDeCategoria {
  nome: string;
  valor: number;
  percentual: number;
}

export interface SemanaDoCaixa {
  rotulo: string;
  chave: string;
  entra: number;
  sai: number;
  /** O saldo depois de tudo que acontece ate o fim desta semana. */
  saldoProjetado: number;
}

export interface ResumoDoCaixa {
  caixa: Caixa;
  /** Receitas recebidas por categoria. */
  deOndeVem: FatiaDeCategoria[];
  /** Despesas avulsas pagas por categoria. */
  paraOndeVai: FatiaDeCategoria[];
  calendario: SemanaDoCaixa[];
  /** Quantas semanas o calendario cobre. A tela precisa dizer. */
  semanas: number;
  obraId: string | null;
}

/**
 * Tudo numa chamada: o saldo, as categorias e o calendario.
 *
 * Tres rotas fariam a tela abrir em tres tempos e dariam tres
 * chances de um numero discordar do outro. Todos saem das mesmas
 * duas listas, carregadas uma vez no servidor.
 */
export function buscarCaixa(obraId?: string) {
  const cauda = obraId ? '?obraId=' + encodeURIComponent(obraId) : '';
  return chamar<ResumoDoCaixa>('/api/lancamentos/caixa' + cauda);
}

/**
 * Baixa a lista em PDF ou Word, RESPEITANDO O FILTRO DA TELA.
 *
 * Baixar sempre tudo faria quem filtrou "so saidas" receber um
 * papel com as entradas juntas, e so descobrir depois de imprimir.
 */
export function exportarLancamentos(
  formato: FormatoDeArquivo,
  filtros: { tipo?: string; situacao?: string; obraId?: string } = {},
) {
  const q = new URLSearchParams({ formato });
  if (filtros.tipo) q.set('tipo', filtros.tipo);
  if (filtros.situacao) q.set('situacao', filtros.situacao);
  if (filtros.obraId) q.set('obraId', filtros.obraId);

  return baixarArquivo(
    '/api/lancamentos/exportar?' + q.toString(),
    'receitas-e-despesas.' + formato,
  );
}

export interface EventoDoLancamento {
  id: string;
  tipo: string;
  descricao: string;
  /** Quem fez. "Usuário removido" quando a pessoa saiu da empresa. */
  quem: string;
  quando: string;
}

/**
 * A trilha de um lançamento.
 *
 * Rota própria, e não junto da lista: ninguém lê a trilha de vinte
 * lançamentos de uma vez. Carregá-la sempre seria pagar, a cada
 * abertura da tela, por algo que se olha uma vez por mês.
 */
export function buscarEventos(id: string) {
  return chamar<{ numeroFormatado: string; eventos: EventoDoLancamento[] }>(
    '/api/lancamentos/' + id + '/eventos',
  );
}

export function criarLancamento(dados: NovoLancamento) {
  return chamar<{ lancamento: Lancamento }>('/api/lancamentos', {
    metodo: 'POST',
    corpo: dados,
  });
}

export function editarLancamento(id: string, dados: Partial<NovoLancamento>) {
  return chamar<{ lancamento: Lancamento }>('/api/lancamentos/' + id, {
    metodo: 'PATCH',
    corpo: dados,
  });
}

export function realizarLancamento(id: string, realizadoEm?: string) {
  return chamar<{ lancamento: Lancamento; mensagem: string }>(
    '/api/lancamentos/' + id + '/realizar',
    { metodo: 'POST', corpo: { realizadoEm } },
  );
}

/**
 * Desfaz o "já aconteceu".
 *
 * A caixa de marcar só existe na criação, e nasce marcada. Quem
 * clicou sem querer não tinha como voltar: o único caminho era
 * cancelar e lançar de novo, deixando dois números no extrato.
 */
export function voltarParaPrevisto(id: string) {
  return chamar<{ lancamento: Lancamento; mensagem: string }>(
    '/api/lancamentos/' + id + '/voltar-para-previsto',
    { metodo: 'POST' },
  );
}

export function cancelarLancamento(id: string, motivo: string) {
  return chamar<{ lancamento: Lancamento }>('/api/lancamentos/' + id + '/cancelar', {
    metodo: 'POST',
    corpo: { motivo },
  });
}
