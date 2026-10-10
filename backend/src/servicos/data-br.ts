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

// ------------------------------------------------------------
//  DATA SEM HORA: o defeito que custava um dia inteiro
//
//  Quando a tela manda "2026-10-17", `new Date('2026-10-17')`
//  entende MEIA-NOITE EM UTC. No horário de Brasília isso é
//  16/10 às 21h — e o sistema mostrava, e usava, o dia 16.
//
//  Medido em 10/10/2026, no primeiro convite de cotação enviado
//  pelo WhatsApp: o comprador marcou prazo para 17/10 e o
//  fornecedor recebeu "responda até 16/10".
//
//  E não era só o que aparecia na tela. O prazo da cotação também
//  é o vencimento do LINK do portal: com meia-noite em UTC, o
//  link morria às 21h do dia 16 — o fornecedor perdia o último
//  dia de verdade, não só no texto.
//
//  Eram nove lugares, incluindo o "Precisa até" da solicitação,
//  que é o prazo que ordena a fila de quem aprova.
//
//  Em `locacao.ts` havia um remendo local — `new Date(iso +
//  'T12:00:00')`, meio-dia para fugir do deslocamento. Funcionava
//  por sorte: meio-dia está longe o bastante das duas bordas. Mas
//  é remendo de um lugar para um problema de nove.
// ------------------------------------------------------------

/**
 * Quanto o fuso da Porto Inc. está deslocado do UTC, em minutos.
 *
 * Calculado para o INSTANTE pedido, e não fixado em -180: o
 * horário de verão brasileiro acabou em 2019, mas ele já voltou
 * antes e pode voltar de novo. Fixar o número é plantar o mesmo
 * defeito para o dia em que isso acontecer.
 */
function deslocamentoEmMinutos(instante: Date): number {
  const noFuso = new Date(instante.toLocaleString('en-US', { timeZone: FUSO }));
  const emUtc = new Date(instante.toLocaleString('en-US', { timeZone: 'UTC' }));

  return Math.round((noFuso.getTime() - emUtc.getTime()) / 60000);
}

/** Separa "2026-10-17" em ano, mês e dia. Devolve null se não for. */
function partes(data: string): [number, number, number] | null {
  const achado = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data ?? ''));
  if (!achado) return null;

  return [Number(achado[1]), Number(achado[2]), Number(achado[3])];
}

/**
 * "2026-10-17" vira o instante em que o dia 17 COMEÇA no Brasil.
 *
 * Para data de calendário — início de obra, previsão de fim —,
 * onde o dia é o dado e a hora não quer dizer nada.
 */
export function inicioDoDiaBr(data: string | Date): Date {
  if (data instanceof Date) return data;

  const p = partes(data);
  //  Veio com hora junto? Então quem mandou já sabe a hora que
  //  quer, e não é trabalho desta função adivinhar outra.
  if (!p || data.includes('T')) return new Date(data);

  const [ano, mes, dia] = p;
  const palpite = new Date(Date.UTC(ano, mes - 1, dia, 0, 0, 0, 0));

  return new Date(palpite.getTime() - deslocamentoEmMinutos(palpite) * 60000);
}

/**
 * "2026-10-17" vira o instante em que o dia 17 TERMINA no Brasil.
 *
 * Para PRAZO — "responda até 17/10", "precisa até 17/10" —, onde
 * a pessoa tem o dia inteiro para cumprir. É esta a função que
 * conserta o link que morria um dia antes.
 */
export function fimDoDiaBr(data: string | Date): Date {
  if (data instanceof Date) return data;
  if (!partes(data) || data.includes('T')) return new Date(data);

  const DIA = 24 * 60 * 60 * 1000;
  return new Date(inicioDoDiaBr(data).getTime() + DIA - 1);
}
