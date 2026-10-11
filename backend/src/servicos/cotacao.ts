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
import { porcentoEmFrase } from './util.js';

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
 * ESTA CHAVE É A SENHA DAQUELA COTAÇÃO: quem a tem responde em
 * nome do fornecedor. Por isso ela é sorteada, e não derivada de
 * nada que alguém possa descobrir.
 *
 * ERAM 32 BYTES, E VIRARAM 9, em 10/10/2026.
 *
 * O link viaja pelo WhatsApp, e com 32 bytes ele tinha 43
 * caracteres só de chave — uma parede de letras embaixo de uma
 * mensagem curta. O dono reclamou olhando a conversa no celular,
 * e tinha razão: endereço assim assusta quem recebe.
 *
 * 9 bytes = 72 bits = 12 caracteres. Para adivinhar um token
 * seria preciso acertar entre 4,7 sextilhões — e a rota do
 * portal aceita 30 tentativas por 5 minutos, o que torna a
 * busca por força bruta impossível em qualquer prazo humano.
 *
 * Os tokens antigos continuam valendo: estão guardados, e nada
 * aqui os invalida.
 */
export function gerarToken(): string {
  return randomBytes(9).toString('base64url');
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
  //  A FRASE É DELE, e é um agradecimento, não uma recusa. Quem
  //  abre este link de novo quase sempre está conferindo se deu
  //  certo — tratar isso como erro assusta sem motivo.
  'ja-respondido': 'Você já enviou a sua cotação, muito obrigado!',
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
  /**
   * Em qual rodada o fornecedor respondeu.
   *
   * Nulo em convite antigo, de antes da coluna existir: aí não
   * trava, que era o comportamento de então.
   */
  rodadaRespondida?: number | null;
  /** A rodada em que o pacote está agora. */
  rodadaAtual?: number;
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

  //  A COTAÇÃO ENVIADA É FINAL — DENTRO DA RODADA.
  //
  //  Até 10/10/2026 o portal deixava revisar à vontade enquanto o
  //  prazo corresse. Ele testou com um celular de verdade e
  //  pediu o contrário: "após eu responder, se eu clicar no link
  //  novamente eu posso mudar as informações, isso não pode
  //  acontecer".
  //
  //  Mas a trava não pode olhar só para "já respondeu", senão
  //  atropela a última chamada — que existe exatamente para pedir
  //  que o fornecedor REVEJA o preço, e manda link para quem já
  //  respondeu. Por isso a comparação é com a RODADA: respondeu na
  //  1, travado na 1; a última chamada leva o pacote para a 2 e o
  //  link destrava sozinho, sem ninguém ter de lembrar.
  //
  //  O ">=" e não "===" por segurança: se por algum caminho a
  //  rodada respondida ficar à frente da atual, o certo é travar,
  //  não liberar.
  const respondeuNestaRodada =
    estado.rodadaRespondida != null &&
    estado.rodadaAtual != null &&
    estado.rodadaRespondida >= estado.rodadaAtual;

  if (jaRespondeu && respondeuNestaRodada) {
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
  //  VAZIO É À VISTA, e não "não sei".
  //
  //  Três lugares já tratavam assim; só o texto hesitava:
  //
  //    1. O portal diz ao fornecedor, embaixo dos campos:
  //       "Deixe tudo vazio se for à vista".
  //    2. `gerarParcelas` monta UMA parcela na data da nota —
  //       e tem o comentário "Sem condição nenhuma: à vista".
  //    3. `descreverCondicao`, do financeiro, já devolve "À vista"
  //       para a mesma entrada. Duas funções descrevendo a mesma
  //       coisa, no mesmo sistema, discordando.
  //
  //  Dizer "Não informada" fazia o pedido parecer incompleto para
  //  quem recebe — e ele sai em PDF e em mensagem de WhatsApp, que
  //  é documento comercial.
  if (!parcelas && !percentualEntrada) return 'À vista';

  const partes: string[] = [];

  if (percentualEntrada && percentualEntrada > 0) {
    partes.push(porcentoEmFrase(percentualEntrada) + ' de entrada');
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

/**
 * Em quantos dias, em média, este dinheiro sai do caixa.
 *
 * Duas propostas com o mesmo preço não custam o mesmo: quem aceita
 * receber em 3x a cada 30 dias está emprestando dinheiro para a
 * construtora, e quem exige tudo na entrega não está. O prazo médio
 * é o que torna as duas comparáveis.
 *
 * É a média dos vencimentos PONDERADA pelo peso de cada pagamento:
 * a entrada pesa no dia 0, e as parcelas nos dias 30, 60, 90...
 *
 * Nulo quando não dá para saber — fornecedor que informou parcelas
 * sem dizer o intervalo não tem prazo calculável, e inventar 30 dias
 * aqui seria colocar palavra na boca dele.
 */
export function prazoMedioDePagamento(
  percentualEntrada: number | null,
  parcelas: number | null,
  intervaloDias: number | null,
): number | null {
  //  NADA PREENCHIDO É À VISTA: o dinheiro sai no dia, prazo zero.
  //
  //  CUIDADO AO MEXER: existem dois "não sei" diferentes aqui, e
  //  unificá-los conserta uma mentira criando outra.
  //
  //    - nada preenchido          -> à vista, por definição do portal
  //    - entrada sem parcelas     -> e o resto, quando? ninguém sabe
  //    - parcelas sem intervalo   -> a cada quantos dias? ninguém sabe
  //
  //  Só o primeiro vira zero. Os outros dois continuam nulos, e o
  //  motivo está logo abaixo: inventar número é pôr palavra na boca
  //  do fornecedor.
  if (!percentualEntrada && !parcelas) return 0;

  const entrada = percentualEntrada ?? 0;
  const resto = 100 - entrada;

  // Pagou tudo na entrada: o dinheiro sai hoje.
  if (resto <= 0) return 0;

  if (!parcelas || parcelas <= 0) return null;
  if (!intervaloDias || intervaloDias <= 0) return null;

  // Cada parcela vale resto/n e vence em intervalo × k.
  // Σ k, de 1 a n, é n(n+1)/2 — daí a fórmula fechada.
  const somaPonderada = resto * intervaloDias * ((parcelas + 1) / 2);

  return Math.round((somaPonderada / 100) * 10) / 10;
}

// A conversão do prazo em reais NÃO mora aqui.
//
// Ela depende da taxa que a empresa escolhe na tela, e o servidor
// não tem esse número. Fica em `frontend/src/servicos/cotacoes.ts`,
// com os testes dela — uma conta só, num lugar só.
