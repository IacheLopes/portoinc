// ============================================================
//  Data e hora no fuso de quem lê
//
//  `toLocaleString('pt-BR')` não diz em que fuso a data está —
//  diz só em que IDIOMA escrevê-la. O fuso vem do sistema
//  operacional, e o container roda em UTC.
//
//  O resultado, medido em 24/09/2026 às 21h20 de Brasília:
//
//      Emitido em 24/09/2026          ← no cabeçalho
//      gerado em 25/09/2026, 00:20    ← no rodapé da MESMA folha
//
//  Um pedido de compra assinado e mandado para o fornecedor com a
//  data do dia seguinte. Todo documento tirado depois das 21h saía
//  datado errado — e ninguém percebia, porque durante o expediente
//  o defeito some.
//
//  Aqui o fuso é dito em voz alta. Não depende de variável de
//  ambiente, nem de como a máquina de produção estiver configurada.
// ============================================================

/** Onde a Porto Inc. trabalha. */
const FUSO = 'America/Sao_Paulo';

/** 24/09/2026 */
export function dataBr(valor: Date | null | undefined): string {
  if (!valor) return '—';

  return valor.toLocaleDateString('pt-BR', { timeZone: FUSO });
}

/** 24/09/2026, 21:20 */
export function dataHoraBr(valor: Date = new Date()): string {
  return valor.toLocaleString('pt-BR', {
    timeZone: FUSO,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * A frase que fecha todo documento do sistema.
 *
 * Estava escrita de três jeitos diferentes em três arquivos —
 * "Gerado pelo sistema em", "documento gerado em", "gerado em" —
 * em documentos que a mesma pessoa recebe no mesmo dia.
 */
export function geradoEm(): string {
  return 'Gerado pelo sistema em ' + dataHoraBr();
}

/**
 * A data de hoje como "2026-09-24", no fuso de Brasília.
 *
 * O relatório sem filtro mostra os últimos 12 meses, e o fim desse
 * período é "hoje". Calculado com `getFullYear/getMonth/getDate`, que
 * leem o relógio do container, o rótulo saía "25/09/2025 a 25/09/2026"
 * às nove da noite — um relatório que diz cobrir até amanhã.
 *
 * `en-CA` é o atalho para ano-mês-dia com zero à esquerda.
 */
export function isoBr(valor: Date = new Date()): string {
  return valor.toLocaleDateString('en-CA', { timeZone: FUSO });
}
