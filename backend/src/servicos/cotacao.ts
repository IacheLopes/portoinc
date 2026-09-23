// ============================================================
//  Regras da cotação (BID)
//
//  Este é o primeiro ponto do sistema em que gente de FORA da
//  empresa interage com ele. Por isso o cuidado maior:
//   - o link é longo e aleatório, funciona como uma senha
//   - ele vence
//   - o fornecedor só enxerga o próprio pacote, nunca o preço
//     dos concorrentes
// ============================================================

import { randomBytes } from 'node:crypto';

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

const CAMINHOS: Record<SituacaoBid, SituacaoBid[]> = {
  RASCUNHO: ['ABERTO', 'CANCELADO'],
  ABERTO: ['ENCERRADO', 'CANCELADO'],
  // Encerrado pode reabrir numa última chamada, ou virar pedido.
  ENCERRADO: ['ABERTO', 'CONCLUIDO', 'CANCELADO'],
  CONCLUIDO: [],
  CANCELADO: [],
};

export function podeIrPara(atual: SituacaoBid, destino: SituacaoBid): boolean {
  return CAMINHOS[atual].includes(destino);
}

/** Só rascunho aceita mudança de itens e de convidados. */
export function podeEditarBid(situacao: SituacaoBid): boolean {
  return situacao === 'RASCUNHO';
}

/** Número legível: 7 vira BID-00007. */
export function formatarNumeroBid(numero: number): string {
  return 'BID-' + String(numero).padStart(5, '0');
}

/**
 * Gera a chave do link público.
 *
 * 32 bytes aleatórios = 256 bits. Adivinhar por tentativa é
 * inviável, o que permite que o fornecedor entre sem senha.
 */
export function gerarToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface ConferenciaAbertura {
  quantidadeItens: number;
  quantidadeConvidados: number;
  prazoResposta: Date;
  agora?: Date;
}

/** Impedimentos para abrir o pacote para cotação. */
export function conferirAbertura(dados: ConferenciaAbertura): string[] {
  const problemas: string[] = [];
  const agora = dados.agora ?? new Date();

  if (dados.quantidadeItens === 0) {
    problemas.push('Adicione pelo menos um item aprovado ao pacote.');
  }

  if (dados.quantidadeConvidados === 0) {
    problemas.push('Convide pelo menos um fornecedor.');
  }

  if (dados.prazoResposta <= agora) {
    problemas.push('O prazo de resposta precisa ser no futuro.');
  }

  return problemas;
}

export type MotivoRecusa =
  | 'nao-encontrado'
  | 'vencido'
  | 'pacote-fechado'
  | 'ja-respondido';

export const MENSAGEM_RECUSA: Record<MotivoRecusa, string> = {
  'nao-encontrado':
    'Este link não é válido. Confira se você copiou o endereço inteiro.',
  vencido:
    'O prazo para responder esta cotação já encerrou. Fale com o comprador da Porto Inc.',
  'pacote-fechado':
    'Esta cotação não está mais aberta para respostas.',
  'ja-respondido':
    'Você já respondeu esta cotação. Para alterar, fale com o comprador.',
};

/** Código HTTP adequado a cada recusa. */
export const STATUS_RECUSA: Record<MotivoRecusa, number> = {
  'nao-encontrado': 404,
  vencido: 410,
  'pacote-fechado': 409,
  'ja-respondido': 409,
};

export interface EstadoDoLink {
  existe: boolean;
  expiraEm?: Date;
  situacaoBid?: SituacaoBid;
  respondidoEm?: Date | null;
  /** Quando true, o fornecedor pode revisar a resposta. */
  permiteRevisao?: boolean;
  agora?: Date;
}

export type ResultadoLink =
  | { ok: true; jaRespondeu: boolean }
  | { ok: false; motivo: MotivoRecusa };

/** Decide se o link ainda vale. */
export function conferirLink(estado: EstadoDoLink): ResultadoLink {
  if (!estado.existe) return { ok: false, motivo: 'nao-encontrado' };

  const agora = estado.agora ?? new Date();

  if (estado.situacaoBid !== 'ABERTO') {
    return { ok: false, motivo: 'pacote-fechado' };
  }

  if (estado.expiraEm && estado.expiraEm <= agora) {
    return { ok: false, motivo: 'vencido' };
  }

  const jaRespondeu = Boolean(estado.respondidoEm);

  // O fluxo da Porto Inc. prevê "rever cotação": o fornecedor
  // pode corrigir enquanto o prazo estiver correndo.
  if (jaRespondeu && estado.permiteRevisao === false) {
    return { ok: false, motivo: 'ja-respondido' };
  }

  return { ok: true, jaRespondeu };
}

export interface ItemCotado {
  disponivel: boolean;
  valorUnitario: number | null;
  quantidade: number;
}

export interface TotaisCotacao {
  /** Soma dos itens cotados, sem frete. */
  subtotal: number;
  frete: number;
  outros: number;
  total: number;
  itensCotados: number;
  itensIndisponiveis: number;
  /** Verdadeiro quando o fornecedor cotou tudo que foi pedido. */
  completa: boolean;
}

export function calcularTotais(
  itens: ItemCotado[],
  frete = 0,
  outros = 0,
  totalDeItensDoPacote?: number,
): TotaisCotacao {
  const disponiveis = itens.filter((i) => i.disponivel && i.valorUnitario !== null);

  const subtotal = disponiveis.reduce(
    (soma, i) => soma + i.quantidade * (i.valorUnitario ?? 0),
    0,
  );

  const esperados = totalDeItensDoPacote ?? itens.length;

  return {
    subtotal,
    frete,
    outros,
    total: subtotal + frete + outros,
    itensCotados: disponiveis.length,
    itensIndisponiveis: itens.filter((i) => !i.disponivel).length,
    completa: itens.length === esperados && disponiveis.length + itens.filter((i) => !i.disponivel).length === esperados,
  };
}

/** Descreve a forma de pagamento em uma frase. */
export function descreverPagamento(
  percentualEntrada: number | null,
  parcelas: number | null,
  intervaloDias: number | null,
): string {
  if (!parcelas && !percentualEntrada) return 'Não informada';

  const partes: string[] = [];

  if (percentualEntrada && percentualEntrada > 0) {
    partes.push(percentualEntrada + '% de entrada');
  }

  if (parcelas && parcelas > 0) {
    partes.push(
      parcelas === 1
        ? 'pagamento em 1 vez'
        : parcelas + 'x' + (intervaloDias ? ' a cada ' + intervaloDias + ' dias' : ''),
    );
  }

  return partes.join(' + ');
}
