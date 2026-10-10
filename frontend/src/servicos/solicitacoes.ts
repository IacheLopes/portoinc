// ============================================================
//  Chamadas das telas de Solicitação de compra
// ============================================================

import { chamar, baixarArquivo } from './api';
import type { DadosDaPagina } from './paginacao';
import type { Material } from './cadastros';

/**
 * As situações que a solicitação pode ter.
 *
 * `EM_COTACAO` faltava aqui. O servidor tem ela desde sempre — é
 * para onde a solicitação vai quando entra num pacote de cotação —,
 * mas a tela não conhecia o nome, e o selo saía VAZIO: a linha
 * aparecia na lista sem situação nenhuma, como se estivesse em
 * lugar nenhum. O dono reparou em 27/09/2026, com a SOL-00003 e a
 * SOL-00006 mudas na tabela.
 *
 * O TypeScript não pegou porque o valor vem da API como texto e é
 * convertido para este tipo na fronteira — mentir aqui não custa
 * erro de compilação, custa selo em branco na tela.
 */
export type SituacaoSolicitacao =
  | 'RASCUNHO'
  | 'AGUARDANDO_APROVACAO'
  | 'EM_REVISAO'
  | 'APROVADA'
  | 'EM_COTACAO'
  | 'ATENDIDA'
  | 'REPROVADA'
  | 'CANCELADA';

export const ROTULO_SITUACAO: Record<SituacaoSolicitacao, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  EM_REVISAO: 'Em revisão',
  APROVADA: 'Aprovada',
  EM_COTACAO: 'Em cotação',
  ATENDIDA: 'Atendida',
  REPROVADA: 'Reprovada',
  CANCELADA: 'Cancelada',
};

export const COR_SITUACAO: Record<SituacaoSolicitacao, 'info' | 'atencao' | 'sucesso' | 'erro'> = {
  RASCUNHO: 'info',
  AGUARDANDO_APROVACAO: 'atencao',
  EM_REVISAO: 'atencao',
  APROVADA: 'sucesso',
  // `info`, e não `sucesso`: estar em cotação não é um desfecho, é
  // uma etapa andando. Verde ali faria a pessoa parar de esperar.
  EM_COTACAO: 'info',
  // Verde aqui e o unico desfecho bom do fluxo: o material chegou.
  ATENDIDA: 'sucesso',
  REPROVADA: 'erro',
  CANCELADA: 'erro',
};

export interface ItemSolicitacao {
  id: string;
  ordem: number;
  material: Pick<Material, 'id' | 'codigoInterno' | 'descricao' | 'unidadeMedida' | 'normaTecnica' | 'tipo'> & {
    familia: { id: string; codigo: string; nome: string };
  };
  linhaOrcamento: { id: string; codigo: string; descricao: string } | null;
  quantidade: number;
  unidadeMedida: string;
  descricaoComplementar: string | null;
  especificacaoTecnica: string | null;
  primeiraCompra: boolean;
  valorEstimado: number | null;
  valorTotal: number;
}

export interface Solicitacao {
  id: string;
  numero: number;
  numeroFormatado: string;
  situacao: SituacaoSolicitacao;
  obra: { id: string; codigo: string; nome: string; cliente: string | null };
  solicitante: { id: string; nome: string; email: string };
  justificativa: string | null;
  observacoes: string | null;
  dataDesejada: string | null;
  criadaEm: string;
  enviadaEm: string | null;
  decididaEm: string | null;
  /** Quando quem pediu confirmou que e o material certo. */
  validadaEm: string | null;
  validadaPor: string | null;
  itens: ItemSolicitacao[];
  totalEstimado: number;
  podeEditar: boolean;
  /**
   * O que ainda impede o envio, vindo pronto do servidor.
   *
   * Mesma conferência que o envio faz, só que entregue ANTES do
   * clique. Vazio significa "pode enviar".
   */
  impedimentos: string[];
  exigeTodas: boolean;
  funcoesExigidas: string[];
  estadoAprovacao: {
    faltam: string[];
    assinaram: string[];
    reprovada: boolean;
    completa: boolean;
    resumo: string;
  };
  aprovacoes: Array<{
    id: string;
    decisao: string;
    observacao: string | null;
    usuario: string;
    /** Nome da função, para ler na tabela. */
    funcao: string;
    /** Código da função, para comparar com `funcoesExigidas`. */
    funcaoCodigo: string;
    criadaEm: string;
  }>;
  eventos: Array<{
    id: string;
    tipo: string;
    descricao: string;
    usuario: string;
    criadoEm: string;
  }>;
}

export interface ItemParaEnviar {
  materialId: string;
  quantidade: number;
  linhaOrcamentoId?: string | null;
  descricaoComplementar?: string;
  especificacaoTecnica?: string;
  valorEstimado?: number | null;
}

export function listarSolicitacoes(filtros: {
  situacao?: string;
  obraId?: string;
  apenasMinhas?: boolean;
  pagina?: number;
} = {}) {
  const partes = Object.entries(filtros)
    .filter(([, v]) => v !== undefined && v !== '' && v !== false)
    .map(([k, v]) => k + '=' + encodeURIComponent(String(v)));

  return chamar<{ solicitacoes: Solicitacao[]; vendoTodas: boolean } & DadosDaPagina>(
    '/api/solicitacoes' + (partes.length ? '?' + partes.join('&') : ''),
  );
}

/**
 * Quem precisa assinar esta compra.
 *
 * O servidor manda a LISTA de funções, e não só a frase pronta: a
 * tela de detalhe risca as que já assinaram, e para isso precisa dos
 * códigos. A frase continua vindo porque o histórico e o aviso de
 * "enviada" só têm lugar para texto.
 *
 * Vale antes de enviar, quando `funcoesExigidas` na solicitação ainda
 * está vazio — a fotografia da alçada só é tirada no envio.
 */
export interface ResumoDaAlcada {
  /** Nome da faixa que pegou o valor. `null` = nenhuma cobre. */
  faixa: string | null;
  exigeTodas: boolean;
  funcoes: Array<{ codigo: string; nome: string }>;
  explicacao: string;
}

export function buscarSolicitacao(id: string) {
  return chamar<{
    solicitacao: Solicitacao;
    aprovacao: ResumoDaAlcada;
  }>('/api/solicitacoes/' + id);
}

export function criarSolicitacao(dados: {
  obraId: string;
  justificativa?: string;
  observacoes?: string;
  dataDesejada?: string;
  itens: ItemParaEnviar[];
}) {
  return chamar<{ solicitacao: Solicitacao }>('/api/solicitacoes', {
    metodo: 'POST',
    corpo: dados,
  });
}

/**
 * Muda o cabeçalho de um rascunho: obra, prazo, justificativa,
 * observações.
 *
 * O servidor já fazia isto desde a Etapa 3, e a rota nunca foi
 * chamada por tela nenhuma. Resultado: um rascunho com erro de
 * digitação só podia ser CANCELADO e refeito do zero — o dono do
 * sistema tropeçou nisso duas vezes em 27/09/2026, com uma
 * solicitação de dois itens.
 */
export function editarSolicitacao(
  id: string,
  dados: {
    obraId?: string;
    justificativa?: string;
    observacoes?: string;
    dataDesejada?: string;
  },
) {
  return chamar<{ solicitacao: Solicitacao }>('/api/solicitacoes/' + id, {
    metodo: 'PATCH',
    corpo: dados,
  });
}

export function trocarItens(id: string, itens: ItemParaEnviar[]) {
  return chamar<{ solicitacao: Solicitacao }>('/api/solicitacoes/' + id + '/itens', {
    metodo: 'POST',
    corpo: { itens },
  });
}

export function enviarSolicitacao(id: string) {
  return chamar<{
    solicitacao: Solicitacao;
    aprovacao: ResumoDaAlcada;
  }>('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST' });
}

/**
 * O passo 10 do BPMN: quem pediu diz que e o material certo.
 *
 * O almoxarife confere se chegou a QUANTIDADE certa; quem pediu e
 * que sabe se chegou a COISA certa — a marca, a bitola, a
 * resistencia. Sao duas conferencias diferentes.
 */
export function validarSolicitacao(id: string, observacao?: string) {
  return chamar<{ ok: boolean; solicitacao: Solicitacao }>(
    '/api/solicitacoes/' + id + '/validar',
    { metodo: 'POST', corpo: { observacao } },
  );
}

export function cancelarSolicitacao(id: string, motivo?: string) {
  return chamar<{ ok: boolean }>('/api/solicitacoes/' + id + '/cancelar', {
    metodo: 'POST',
    corpo: { motivo },
  });
}

/** Baixa o PDF da solicitação. */
export function baixarPdf(id: string, nomeArquivo: string): Promise<void> {
  return baixarArquivo('/api/solicitacoes/' + id + '/pdf', nomeArquivo + '.pdf');
}

export function dataBr(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function dataHoraBr(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// ------------------------------------------------------------
//  Aprovação (Etapa 4)
// ------------------------------------------------------------
export type Decisao = 'APROVADA' | 'REPROVADA' | 'DEVOLVIDA';

export interface EstadoAprovacao {
  faltam: string[];
  assinaram: string[];
  reprovada: boolean;
  completa: boolean;
  resumo: string;
}

export interface ItemDaFila {
  id: string;
  numeroFormatado: string;
  obra: { id: string; codigo: string; nome: string };
  solicitante: { id: string; nome: string };
  justificativa: string | null;
  dataDesejada: string | null;
  enviadaEm: string | null;
  quantidadeItens: number;
  totalEstimado: number;
  exigeTodas: boolean;
  funcoesExigidas: string[];
  estado: EstadoAprovacao;
  esperaMinhaAssinatura: boolean;
  motivoBloqueio: string | null;
}

export function listarFilaAprovacao() {
  return chamar<{
    fila: ItemDaFila[];
    minhasFuncoes: string[];
    /** Você assina alguma faixa de alçada? Se não, esta tela nunca terá nada. */
    assinaAlgumaFaixa: boolean;
    /** Quantas esperam aprovação no sistema inteiro, suas ou não. */
    esperandoOutros: number;
    /** Os papéis que assinam, para a tela poder dizer de quem é a fila. */
    papeisQueAssinam: string[];
    /** A fila é a do sistema inteiro (suporte), e não só a sua? */
    enxergaTudo: boolean;
    /** Dentro da fila, quantas dependem de você agora. */
    minhasDeVerdade: number;
  }>('/api/aprovacoes');
}

export function decidir(
  id: string,
  decisao: Decisao,
  observacao?: string,
  funcaoCodigo?: string,
) {
  return chamar<{
    ok: boolean;
    situacao: SituacaoSolicitacao;
    estado: EstadoAprovacao;
    mensagem: string;
  }>('/api/aprovacoes/' + id + '/decidir', {
    metodo: 'POST',
    corpo: { decisao, observacao, funcaoCodigo },
  });
}

export const ROTULO_DECISAO: Record<Decisao, string> = {
  APROVADA: 'Aprovou',
  REPROVADA: 'Reprovou',
  DEVOLVIDA: 'Devolveu para revisão',
};

/** Transforma GESTOR_OBRA em "Gestor de obra". */
const NOMES_FUNCAO: Record<string, string> = {
  SOLICITANTE: 'Solicitante',
  GESTOR_OBRA: 'Gestor de obra',
  COMPRADOR: 'Comprador',
  ENGENHEIRO: 'Engenheiro',
  FUNDADOR: 'Fundador',
  ALMOXARIFE: 'Almoxarife',
  FORNECEDOR: 'Fornecedor',
  ADMINISTRADOR: 'Administrador',
};

export function nomeDaFuncao(codigo: string): string {
  if (NOMES_FUNCAO[codigo]) return NOMES_FUNCAO[codigo];
  const limpo = codigo.replace(/_/g, ' ').toLowerCase();
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}
