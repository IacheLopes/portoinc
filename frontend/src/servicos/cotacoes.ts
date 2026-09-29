// ============================================================
//  Chamadas das telas de Cotação (BID) e do portal do fornecedor
// ============================================================

import { chamar, baixarArquivo } from './api';

export type SituacaoBid =
  | 'RASCUNHO'
  | 'ABERTO'
  | 'ENCERRADO'
  | 'CONCLUIDO'
  | 'CANCELADO';

export const ROTULO_SITUACAO_BID: Record<SituacaoBid, string> = {
  RASCUNHO: 'Rascunho',
  ABERTO: 'Aberto para cotação',
  ENCERRADO: 'Encerrado',
  CONCLUIDO: 'Pedidos gerados',
  CANCELADO: 'Cancelado',
};

export const COR_SITUACAO_BID: Record<SituacaoBid, 'info' | 'sucesso' | 'atencao' | 'erro'> = {
  RASCUNHO: 'info',
  ABERTO: 'sucesso',
  ENCERRADO: 'atencao',
  CONCLUIDO: 'sucesso',
  CANCELADO: 'erro',
};

export interface ItemDisponivel {
  id: string;
  material: {
    id: string;
    codigoInterno: string;
    descricao: string;
    unidadeMedida: string;
    normaTecnica: string | null;
    familia: { id: string; codigo: string; nome: string };
  };
  quantidade: number;
  unidadeMedida: string;
  especificacaoTecnica: string | null;
  descricaoComplementar: string | null;
  primeiraCompra: boolean;
  valorEstimado: number | null;
  solicitacao: {
    id: string;
    numeroFormatado: string;
    obra: { id: string; codigo: string; nome: string };
    solicitante: string;
    dataDesejada: string | null;
  };
}

export interface ItemBid {
  id: string;
  ordem: number;
  material: {
    codigoInterno: string;
    descricao: string;
    unidadeMedida: string;
    normaTecnica: string | null;
    marca: string | null;
    familia: { codigo: string; nome: string };
  };
  quantidade: number;
  unidadeMedida: string;
  especificacaoTecnica: string | null;
  descricaoComplementar: string | null;
  origem: { solicitacao: string; obra: { codigo: string; nome: string } };
  respostas: number;
}

export interface ConvidadoBid {
  id: string;
  fornecedor: {
    id: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    cnpj: string;
    whatsapp: string | null;
    email: string | null;
  };
  expiraEm: string;
  visualizadoEm: string | null;
  respondidoEm: string | null;
  token?: string;
  frete: number | null;
  outrosCustos: number | null;
  pagamento: string;
  observacao: string | null;
  respondeu: boolean;
  totais?: {
    subtotal: number;
    frete: number;
    outros: number;
    total: number;
    itensCotados: number;
    itensIndisponiveis: number;
    completa: boolean;
  };
}

export interface Cotacao {
  id: string;
  numero: number;
  numeroFormatado: string;
  titulo: string;
  situacao: SituacaoBid;
  comprador: { id: string; nome: string };
  prazoResposta: string;
  observacoes: string | null;
  criadoEm: string;
  abertoEm: string | null;
  encerradoEm: string | null;
  itens: ItemBid[];
  convidados: ConvidadoBid[];
  podeEditar: boolean;
  respostasRecebidas: number;
}

export interface FornecedorSugerido {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  whatsapp: string | null;
  email: string | null;
  familias: Array<{ id: string; codigo: string; nome: string }>;
  cobertura: number;
  jaConvidado: boolean;
}

// ------------------------------------------------------------
//  Comprador
// ------------------------------------------------------------
export function listarItensDisponiveis(familiaId?: string) {
  const q = familiaId ? '?familiaId=' + encodeURIComponent(familiaId) : '';
  return chamar<{ itens: ItemDisponivel[] }>('/api/cotacoes/itens-disponiveis' + q);
}

export function listarCotacoes(situacao?: string) {
  const q = situacao ? '?situacao=' + encodeURIComponent(situacao) : '';
  return chamar<{ cotacoes: Cotacao[] }>('/api/cotacoes' + q);
}

export function buscarCotacao(id: string) {
  return chamar<{ cotacao: Cotacao }>('/api/cotacoes/' + id);
}

export function criarCotacao(dados: {
  titulo: string;
  prazoResposta: string;
  observacoes?: string;
  itens: string[];
}) {
  return chamar<{ cotacao: Cotacao }>('/api/cotacoes', { metodo: 'POST', corpo: dados });
}

export function fornecedoresSugeridos(id: string) {
  return chamar<{ familiasDoPacote: number; fornecedores: FornecedorSugerido[] }>(
    '/api/cotacoes/' + id + '/fornecedores-sugeridos',
  );
}

export function convidarFornecedores(id: string, fornecedores: string[]) {
  return chamar<{ cotacao: Cotacao; convidados: number }>(
    '/api/cotacoes/' + id + '/fornecedores',
    { metodo: 'POST', corpo: { fornecedores } },
  );
}

export function removerConvite(id: string, conviteId: string) {
  return chamar<{ ok: boolean }>('/api/cotacoes/' + id + '/fornecedores/' + conviteId, {
    metodo: 'DELETE',
  });
}

/** Abre o pacote. NÃO envia nada: convidar é ato próprio. */
export function abrirCotacao(id: string) {
  return chamar<{ cotacao: Cotacao; mensagem: string }>(
    '/api/cotacoes/' + id + '/abrir',
    { metodo: 'POST' },
  );
}

export function encerrarCotacao(id: string) {
  return chamar<{ ok: boolean; mensagem: string }>('/api/cotacoes/' + id + '/encerrar', {
    metodo: 'POST',
  });
}

// ------------------------------------------------------------
//  Portal público (sem login)
// ------------------------------------------------------------
export interface ItemDoPortal {
  id: string;
  codigo: string;
  descricao: string;
  marcaReferencia: string | null;
  normaTecnica: string | null;
  especificacao: string | null;
  detalhes: string | null;
  quantidade: number;
  unidadeMedida: string;
  minhaResposta: {
    disponivel: boolean;
    valorUnitario: number | null;
    marca: string | null;
    modelo: string | null;
    prazoEntregaDias: number | null;
    observacao: string | null;
  } | null;
}

export interface CotacaoDoPortal {
  numeroFormatado: string;
  titulo: string;
  observacoes: string | null;
  prazoResposta: string;
  fornecedor: { razaoSocial: string; nomeFantasia: string | null; cnpj: string };
  jaRespondeu: boolean;
  respondidoEm: string | null;
  itens: ItemDoPortal[];
  minhasCondicoes: {
    valorFrete: number | null;
    outrosCustos: number | null;
    percentualEntrada: number | null;
    quantidadeParcelas: number | null;
    intervaloParcelasDias: number | null;
    observacaoFornecedor: string | null;
  };
}

/** Estas duas não usam o crachá: são públicas. */
export async function abrirPortal(token: string) {
  const r = await fetch('/api/portal/' + encodeURIComponent(token), {
    headers: { Accept: 'application/json' },
  });

  const corpo = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(corpo.erro ?? 'Não foi possível abrir esta cotação.');
  }

  return corpo as { cotacao: CotacaoDoPortal };
}

export async function responderPortal(
  token: string,
  dados: {
    itens: Array<{
      bidItemId: string;
      disponivel: boolean;
      valorUnitario?: number | null;
      marca?: string;
      modelo?: string;
      prazoEntregaDias?: number | null;
      observacao?: string;
    }>;
    valorFrete?: number | null;
    outrosCustos?: number | null;
    percentualEntrada?: number | null;
    quantidadeParcelas?: number | null;
    intervaloParcelasDias?: number | null;
    observacaoFornecedor?: string;
  },
) {
  const r = await fetch('/api/portal/' + encodeURIComponent(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(dados),
  });

  const corpo = await r.json().catch(() => ({}));

  if (!r.ok) {
    const erro = new Error(corpo.erro ?? 'Não foi possível enviar a cotação.');
    (erro as Error & { detalhes?: string[] }).detalhes = (corpo.detalhes ?? []).map(
      (d: string | { mensagem: string }) => (typeof d === 'string' ? d : d.mensagem),
    );
    throw erro;
  }

  return corpo as {
    ok: boolean;
    mensagem: string;
    resumo: {
      itensCotados: number;
      itensIndisponiveis: number;
      subtotal: number;
      frete: number;
      outros: number;
      total: number;
      pagamento: string;
    };
    podeRevisar: boolean;
    prazoResposta: string;
  };
}

// ------------------------------------------------------------
//  Equalização e pedido (Etapa 6)
// ------------------------------------------------------------
export interface RespostaComparada {
  bidFornecedorId: string;
  fornecedorNome: string;
  disponivel: boolean;
  valorUnitario: number | null;
  marca: string | null;
  modelo: string | null;
  prazoEntregaDias: number | null;
  observacao: string | null;
  total: number | null;
  ehMelhor: boolean;
  acimaEmPorcento: number | null;
}

export interface LinhaComparativa {
  bidItemId: string;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  quantidade: number;
  melhorFornecedorId: string | null;
  melhorValorUnitario: number | null;
  melhorTotal: number | null;
  amplitude: number | null;
  respostas: RespostaComparada[];
}

export interface ResumoFornecedor {
  bidFornecedorId: string;
  fornecedorNome: string;
  totalSeFecharTudo: number | null;
  cotouTudo: boolean;
  itensCotados: number;
  itensIndisponiveis: number;
  itensVencidos: number;
  itensAtras: string[];
  frete: number;
  outrosCustos: number;
}

export interface Equalizacao {
  cotacao: {
    id: string;
    numeroFormatado: string;
    titulo: string;
    situacao: SituacaoBid;
    rodada: number;
    prazoResposta: string;
    totalConvidados: number;
    totalResponderam: number;
  };
  condicoes: Array<{
    bidFornecedorId: string;
    fornecedor: string;
    frete: number;
    outrosCustos: number;
    pagamento: string;
    /** Em quantos dias, em média, o dinheiro sai do caixa. */
    prazoMedioPagamento: number | null;
    observacao: string | null;
  }>;
  comparativo: {
    linhas: LinhaComparativa[];
    fornecedores: ResumoFornecedor[];
    melhorCombinacao: number;
    somaDosItens: number;
    freteDaCombinacao: number;
    fornecedoresVencedores: number;
    melhorFornecedorUnico: { nome: string; total: number } | null;
    economiaAoMisturar: number;
    itensSemCotacao: number;
  };
  /**
   * Quanto a empresa pagou da última vez, por item.
   *
   * A pergunta número um de quem compra. O sistema guardava a
   * resposta e não mostrava: numa compra da validação o solicitante
   * estimou R$ 52,00 o saco de cimento e o mercado cobrou R$ 20,00.
   * Aqui o comprador vê a comparação ANTES de escolher.
   */
  historico: Array<{
    bidItemId: string;
    ultimaCompra: { valorUnitario: number; quando: string } | null;
  }>;
  escolhas: Record<string, string>;
}

export interface PedidoResumo {
  id: string;
  numeroFormatado: string;
  situacao: string;
  fornecedor: string;
  comprador: string;
  origem: string;
  quantidadeItens: number;
  total: number;
  pagamento: string;
  criadoEm: string;
  enviadoEm: string | null;
}

export function buscarEqualizacao(id: string) {
  return chamar<Equalizacao>('/api/cotacoes/' + id + '/equalizacao');
}

export function salvarEscolhas(
  id: string,
  escolhas: Array<{ bidItemId: string; bidFornecedorId: string | null }>,
) {
  return chamar<{ ok: boolean; registradas: number }>('/api/cotacoes/' + id + '/escolhas', {
    metodo: 'POST',
    corpo: { escolhas },
  });
}

export function ultimaChamada(id: string, novoPrazo: string, observacao?: string) {
  return chamar<{
    ok: boolean;
    rodada: number;
    mensagem: string;
    avisos: Array<{ fornecedor: string; itensAtras: number; enviado: boolean; adaptador: string }>;
  }>('/api/cotacoes/' + id + '/ultima-chamada', {
    metodo: 'POST',
    corpo: { novoPrazo, observacao },
  });
}

export function gerarPedidos(id: string) {
  return chamar<{
    ok: boolean;
    mensagem: string;
    pedidos: Array<{ id: string; numero: string; fornecedor: string; total: number }>;
  }>('/api/cotacoes/' + id + '/gerar-pedidos', { metodo: 'POST' });
}

/** Um item do pedido, com o preço já fechado na equalização. */
export interface ItemDoPedido {
  ordem: number;
  codigo: string;
  descricao: string;
  normaTecnica: string | null;
  unidadeMedida: string;
  quantidade: number;
  valorUnitario: number;
  marca: string | null;
  modelo: string | null;
  prazoEntregaDias: number | null;
  obra: { codigo: string; nome: string };
}

/**
 * O pedido inteiro — o mesmo documento que sai no PDF.
 *
 * A tela de detalhe não existia: para ver o que havia dentro de um
 * pedido só baixando o arquivo. O servidor monta os dois a partir
 * da mesma função, senão papel e tela divergem.
 */
export interface Pedido {
  id: string;
  numeroFormatado: string;
  situacao: string;
  criadoEm: string;
  enviadoEm: string | null;
  confirmadoEm: string | null;
  comprador: string;
  /** A cotação que escolheu este fornecedor. */
  cotacao: { id: string; numeroFormatado: string; titulo: string };
  /** As solicitações que deram origem aos itens. */
  solicitacoes: Array<{ id: string; numeroFormatado: string }>;
  fornecedor: {
    id: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    cnpj: string;
    email: string | null;
    telefone: string | null;
    cidade: string | null;
    uf: string | null;
  };
  frete: number;
  outrosCustos: number;
  subtotal: number;
  total: number;
  pagamento: string;
  observacoes: string | null;
  itens: ItemDoPedido[];
}

export function listarPedidos() {
  return chamar<{ pedidos: PedidoResumo[] }>('/api/pedidos');
}

export function buscarPedido(id: string) {
  return chamar<{ pedido: Pedido }>('/api/pedidos/' + id);
}

export function baixarPdfPedido(id: string, nome: string) {
  return baixarArquivo('/api/pedidos/' + id + '/pdf', nome + '.pdf');
}

// ------------------------------------------------------------
//  O prazo de pagamento vale dinheiro
// ------------------------------------------------------------

/**
 * Quanto custa o dinheiro da construtora, ao mês.
 *
 * Faixas, e não campo aberto: ninguém sabe esse número com duas
 * casas — sabe se está perto de 1% ou de 3%. Começa em zero de
 * propósito, porque enquanto a empresa não disser a taxa dela o
 * sistema não arbitra nenhuma.
 */
export const TAXAS_DE_CUSTO_DO_DINHEIRO = [0, 0.5, 1, 1.5, 2, 2.5, 3];

export const ONDE_GUARDA_A_TAXA = 'portoink.custo-do-dinheiro';

/**
 * Quanto vale, em reais, o prazo que o fornecedor deu.
 *
 * Duas propostas com o mesmo preço não custam o mesmo: quem aceita
 * receber em 3x está emprestando dinheiro para a construtora, quem
 * exige tudo na entrega não está.
 *
 * Desconto simples sobre o custo mensal, que é como se fala disso
 * na obra ("1,5% ao mês"). Não usamos juro composto: em 60 dias a
 * diferença é de centavos, e a conta precisa ser explicável para
 * quem vai assinar.
 *
 * O prazo médio em dias vem do servidor, em `prazoMedioPagamento`.
 * A taxa vem da tela — é por isso que esta conta mora aqui e não lá.
 */
export function ganhoDoPrazo(
  total: number | null,
  prazoMedioDias: number | null,
  taxaMensal: number,
): number {
  if (total === null || prazoMedioDias === null || taxaMensal <= 0) return 0;

  return Math.round(total * (taxaMensal / 100) * (prazoMedioDias / 30) * 100) / 100;
}
