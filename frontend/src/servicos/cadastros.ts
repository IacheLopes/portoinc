// ============================================================
//  Chamadas das telas de Cadastros
// ============================================================

import { chamar } from './api';
import type { DadosDaPagina } from './paginacao';

// ------------------------------------------------------------
//  Tipos
// ------------------------------------------------------------
export type SituacaoObra = 'PLANEJAMENTO' | 'EM_ANDAMENTO' | 'PARALISADA' | 'CONCLUIDA';
export type TipoItem = 'MATERIAL' | 'SERVICO';

export interface Obra {
  id: string;
  codigo: string;
  nome: string;
  cliente: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  situacao: SituacaoObra;
  dataInicio: string | null;
  dataPrevisaoFim: string | null;
  ativa: boolean;
  linhas: number;
  almoxarifados: number;
}

export interface LinhaOrcamento {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidadePrevista: number;
  valorUnitarioPrevisto: number;
  valorTotalPrevisto: number;
  ordem: number;
}

export interface ObraDetalhe extends Omit<Obra, 'linhas' | 'almoxarifados'> {
  linhas: LinhaOrcamento[];
  almoxarifados: Array<{ id: string; codigo: string; nome: string; central: boolean }>;
  orcamentoTotal: number;
}

export interface Familia {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
  materiais: number;
  fornecedores: number;
}

export interface Material {
  id: string;
  codigoInterno: string;
  descricao: string;
  tipo: TipoItem;
  marca: string | null;
  gtin: string | null;
  normaTecnica: string | null;
  unidadeMedida: string;
  pontoPedido: number | null;
  codigoLinhaPadrao: string | null;
  ativo: boolean;
  familia: { id: string; codigo: string; nome: string };
}

export interface Fornecedor {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  cnpjFormatado: string;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  cidade: string | null;
  uf: string | null;
  ativo: boolean;
  familias: Array<{ id: string; codigo: string; nome: string }>;
  contatos: Array<{
    id: string;
    nome: string;
    cargo: string | null;
    email: string | null;
    whatsapp: string | null;
    principal: boolean;
  }>;
}

export interface RegraAlcada {
  id: string;
  descricao: string;
  valorMinimo: number;
  valorMaximo: number | null;
  exigeTodas: boolean;
  ordem: number;
  ativa: boolean;
  funcoes: Array<{ id: string; codigo: string; nome: string }>;
}

// ------------------------------------------------------------
//  Obras
// ------------------------------------------------------------
export function listarObras(busca?: string) {
  const q = busca ? '?busca=' + encodeURIComponent(busca) : '';
  return chamar<{ obras: Obra[] }>('/api/obras' + q);
}

export function buscarObra(id: string) {
  return chamar<{ obra: ObraDetalhe }>('/api/obras/' + id);
}

/** Corrige uma obra. Renomear aqui renomeia o almoxarifado dela. */
export function editarObra(id: string, dados: Record<string, unknown>) {
  return chamar<{ obra: Obra }>('/api/obras/' + id, { metodo: 'PATCH', corpo: dados });
}

export function criarObra(dados: Record<string, unknown>) {
  return chamar<{ obra: Obra }>('/api/obras', { metodo: 'POST', corpo: dados });
}

export function criarLinha(obraId: string, dados: Record<string, unknown>) {
  return chamar<{ linha: LinhaOrcamento }>('/api/obras/' + obraId + '/linhas', {
    metodo: 'POST',
    corpo: dados,
  });
}

export function apagarLinha(obraId: string, linhaId: string) {
  return chamar<{ ok: boolean }>('/api/obras/' + obraId + '/linhas/' + linhaId, {
    metodo: 'DELETE',
  });
}

export function importarOrcamento(obraId: string, csv: string) {
  return chamar<{
    importadas: number;
    ignoradas: number;
    problemas: string[];
    totalDeProblemas: number;
  }>('/api/obras/' + obraId + '/linhas/importar', { metodo: 'POST', corpo: { csv } });
}

/**
 * Importar catálogo de planilha.
 *
 * Mesma forma da importação de orçamento, e de propósito: quem
 * entendeu uma entendeu as três.
 */
export function importarMateriais(csv: string) {
  return chamar<{
    importados: number;
    ignorados: number;
    problemas: string[];
    totalDeProblemas: number;
  }>('/api/materiais/importar', { metodo: 'POST', corpo: { csv } });
}

/** Importar fornecedores de planilha. */
export function importarFornecedores(csv: string) {
  return chamar<{
    importados: number;
    ignorados: number;
    problemas: string[];
    totalDeProblemas: number;
  }>('/api/fornecedores/importar', { metodo: 'POST', corpo: { csv } });
}

// ------------------------------------------------------------
//  Famílias
// ------------------------------------------------------------
export function listarFamilias() {
  return chamar<{ familias: Familia[] }>('/api/familias');
}

export function criarFamilia(dados: Record<string, unknown>) {
  return chamar<{ familia: Familia }>('/api/familias', { metodo: 'POST', corpo: dados });
}

/**
 * Corrige uma familia ja cadastrada.
 *
 * O servidor aceitava isto desde sempre; faltava a tela. Quem errava o
 * codigo ou o nome no cadastro ficava com o erro para sempre — e o
 * codigo aparece em filtro, em relatorio e na tela de material.
 */
export function editarFamilia(id: string, dados: Record<string, unknown>) {
  return chamar<{ familia: Familia }>('/api/familias/' + id, {
    metodo: 'PATCH',
    corpo: dados,
  });
}

// ------------------------------------------------------------
//  Materiais
// ------------------------------------------------------------
export function listarMateriais(filtros: {
  busca?: string;
  familiaId?: string;
  tipo?: TipoItem;
  pagina?: number;
} = {}) {
  const partes = Object.entries(filtros)
    .filter(([, v]) => v)
    .map(([k, v]) => k + '=' + encodeURIComponent(String(v)));

  return chamar<{ materiais: Material[] } & DadosDaPagina>(
    '/api/materiais' + (partes.length ? '?' + partes.join('&') : ''),
  );
}

export function criarMaterial(dados: Record<string, unknown>) {
  return chamar<{ material: Material }>('/api/materiais', { metodo: 'POST', corpo: dados });
}

/** Corrige um item do catalogo. Mesma historia da familia. */
export function editarMaterial(id: string, dados: Record<string, unknown>) {
  return chamar<{ material: Material }>('/api/materiais/' + id, {
    metodo: 'PATCH',
    corpo: dados,
  });
}

export function biparCodigo(gtin: string) {
  return chamar<{ encontrado: boolean; material: Material }>('/api/materiais/gtin/' + gtin);
}

// ------------------------------------------------------------
//  Fornecedores
// ------------------------------------------------------------
export function listarFornecedores(
  filtros: { busca?: string; familiaId?: string; pagina?: number } = {},
) {
  const partes = Object.entries(filtros)
    .filter(([, v]) => v)
    .map(([k, v]) => k + '=' + encodeURIComponent(String(v)));

  return chamar<{ fornecedores: Fornecedor[] } & DadosDaPagina>(
    '/api/fornecedores' + (partes.length ? '?' + partes.join('&') : ''),
  );
}

/** Corrige um fornecedor ja cadastrado. */
export function editarFornecedor(id: string, dados: Record<string, unknown>) {
  return chamar<{ fornecedor: Fornecedor }>('/api/fornecedores/' + id, {
    metodo: 'PATCH',
    corpo: dados,
  });
}

export function criarFornecedor(dados: Record<string, unknown>) {
  return chamar<{ fornecedor: Fornecedor }>('/api/fornecedores', {
    metodo: 'POST',
    corpo: dados,
  });
}

// ------------------------------------------------------------
//  Alçadas
// ------------------------------------------------------------
export function listarAlcadas() {
  return chamar<{ regras: RegraAlcada[]; avisos: string[] }>('/api/alcadas');
}

export function simularAlcada(valor: number) {
  return chamar<{
    valor: number;
    encontrada: boolean;
    explicacao?: string;
    mensagem?: string;
    regra?: RegraAlcada;
  }>('/api/alcadas/simular?valor=' + valor);
}

/** Corrige uma faixa ja criada. */
export function editarAlcada(id: string, dados: Record<string, unknown>) {
  return chamar<{ regra: RegraAlcada }>('/api/alcadas/' + id, {
    metodo: 'PATCH',
    corpo: dados,
  });
}

export function criarAlcada(dados: Record<string, unknown>) {
  return chamar<{ regra: RegraAlcada }>('/api/alcadas', { metodo: 'POST', corpo: dados });
}

export const ROTULO_SITUACAO: Record<SituacaoObra, string> = {
  PLANEJAMENTO: 'Planejamento',
  EM_ANDAMENTO: 'Em andamento',
  PARALISADA: 'Paralisada',
  CONCLUIDA: 'Concluída',
};

export const UNIDADES = [
  'UN', 'PC', 'CX', 'SC', 'FD', 'PAR', 'JG', 'RL', 'GL', 'LT', 'BD',
  'KG', 'TON', 'G',
  'M', 'M2', 'M3', 'CM', 'KM',
  'L', 'ML',
  'H', 'DIA', 'MES', 'VB',
];

/**
 * O nome por extenso de cada sigla.
 *
 * A lista mostrava só "SC", "FD", "GL", "VB". Quem é da construção lê
 * de olhos fechados; quem está aprendendo o sistema fica adivinhando —
 * e errar a unidade de um material estraga a conta de todo pedido que
 * vier depois dele.
 *
 * `SEMANA` entra aqui por causa da Locação, que tem lista própria.
 */
export const NOME_DA_UNIDADE: Record<string, string> = {
  UN: 'Unidade', PC: 'Peça', CX: 'Caixa', SC: 'Saco', FD: 'Fardo',
  PAR: 'Par', JG: 'Jogo', RL: 'Rolo', GL: 'Galão', LT: 'Lata', BD: 'Balde',
  KG: 'Quilo', TON: 'Tonelada', G: 'Grama',
  M: 'Metro', M2: 'Metro quadrado', M3: 'Metro cúbico',
  CM: 'Centímetro', KM: 'Quilômetro',
  L: 'Litro', ML: 'Mililitro',
  H: 'Hora', DIA: 'Dia', SEMANA: 'Semana', MES: 'Mês', VB: 'Verba',
};

/**
 * As opções da lista suspensa: `SC — Saco`.
 *
 * A sigla vem PRIMEIRO de propósito. É ela que o sistema guarda e que
 * aparece na tabela, no pedido e na nota — então a lista ensina a
 * ligação no sentido em que a pessoa vai precisar dela depois.
 */
export function opcoesDeUnidade(lista: readonly string[] = UNIDADES) {
  return lista.map((u) => ({
    valor: u,
    rotulo: NOME_DA_UNIDADE[u] ? u + ' — ' + NOME_DA_UNIDADE[u] : u,
  }));
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];
