// ============================================================
//  Locação de equipamentos
//
//  A frase que originou este módulo, da ata de reunião:
//  "colocar para alertar os itens que eles locaram no dia em
//  que eles acham que já deve ser usado".
//
//  Traduzindo: equipamento parado no canteiro continua contando
//  diária, e ninguém percebe. O sistema tem que avisar ANTES de
//  virar prejuízo — do mesmo jeito que o orçamento avisa em 80%
//  em vez de esperar estourar.
//
//  As contas ficam aqui, longe do banco, para poderem ser
//  testadas sozinhas.
// ============================================================

export type Periodo = 'DIARIA' | 'SEMANAL' | 'MENSAL';
export type SituacaoLocacao = 'ATIVA' | 'DEVOLVIDA' | 'CANCELADA';

/** Quantos dias cada período cobre. */
const DIAS_DO_PERIODO: Record<Periodo, number> = {
  DIARIA: 1,
  SEMANAL: 7,
  MENSAL: 30,
};

export const ROTULO_PERIODO: Record<Periodo, string> = {
  DIARIA: 'por dia',
  SEMANAL: 'por semana',
  MENSAL: 'por mês',
};

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Dias inteiros entre duas datas, ignorando a hora. */
export function diasEntre(inicio: Date, fim: Date): number {
  const a = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const b = Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate());

  return Math.round((b - a) / 86400000);
}

// ------------------------------------------------------------
//  Quanto já custou
// ------------------------------------------------------------

export interface ContratoParaConta {
  quantidade: number;
  periodicidade: Periodo;
  valorPeriodo: number;
  inicioEm: Date;
  previsaoDevolucao: Date;
  devolvidoEm: Date | null;
  situacao: SituacaoLocacao;
}

/**
 * Até que dia o relógio contou.
 *
 * Se já voltou, parou no dia da devolução. Se ainda está na obra,
 * conta até hoje — é justamente isso que faz o número subir
 * sozinho enquanto ninguém devolve.
 */
export function fimDaContagem(c: ContratoParaConta, hoje: Date): Date {
  if (c.situacao === 'CANCELADA') return c.inicioEm;

  return c.devolvidoEm ?? hoje;
}

/** Dias em que o equipamento ficou (ou está) com a construtora. */
export function diasDeUso(c: ContratoParaConta, hoje: Date): number {
  // O primeiro dia conta: pegar de manhã e devolver à tarde é
  // uma diária, não zero.
  return Math.max(0, diasEntre(c.inicioEm, fimDaContagem(c, hoje))) + 1;
}

/**
 * Quantos períodos o fornecedor vai cobrar.
 *
 * Período começado é período cobrado: ninguém aluga meia semana.
 * Por isso arredonda para cima.
 */
export function periodosCobrados(c: ContratoParaConta, hoje: Date): number {
  if (c.situacao === 'CANCELADA') return 0;

  return Math.ceil(diasDeUso(c, hoje) / DIAS_DO_PERIODO[c.periodicidade]);
}

/** Quanto a locação já custou até agora. */
export function custoAcumulado(c: ContratoParaConta, hoje: Date): number {
  return arredondar(periodosCobrados(c, hoje) * c.valorPeriodo * c.quantidade);
}

/** Quanto custaria se voltasse exatamente na data combinada. */
export function custoPrevisto(c: ContratoParaConta): number {
  const ateOPrazo: ContratoParaConta = {
    ...c,
    devolvidoEm: c.previsaoDevolucao,
    situacao: c.situacao === 'CANCELADA' ? 'CANCELADA' : 'DEVOLVIDA',
  };

  return custoAcumulado(ateOPrazo, c.previsaoDevolucao);
}

/** Dias além do combinado. Zero quando está no prazo. */
export function diasDeAtraso(c: ContratoParaConta, hoje: Date): number {
  if (c.situacao === 'CANCELADA') return 0;

  return Math.max(0, diasEntre(c.previsaoDevolucao, fimDaContagem(c, hoje)));
}

/**
 * Quanto o atraso já custou.
 *
 * É o número que faz o alerta ser levado a sério: "a betoneira
 * está 12 dias atrasada" não move ninguém, "o atraso já custou
 * R$ 780" move.
 */
export function custoDoAtraso(c: ContratoParaConta, hoje: Date): number {
  return arredondar(Math.max(0, custoAcumulado(c, hoje) - custoPrevisto(c)));
}

// ------------------------------------------------------------
//  O alerta
// ------------------------------------------------------------

export type Alerta =
  | 'DEVOLVIDA'
  | 'CANCELADA'
  /** Passou da data combinada e não voltou. */
  | 'ATRASADA'
  /** Vence hoje. */
  | 'VENCE_HOJE'
  /** Vence nos próximos dias. */
  | 'PERTO'
  | 'EM_DIA';

/**
 * Quantos dias antes o sistema começa a avisar.
 *
 * Avisar só no dia do vencimento não ajuda: entre pedir a
 * retirada e o fornecedor aparecer costuma passar uns dias, e
 * cada um deles é mais uma diária.
 */
export const AVISAR_COM_ANTECEDENCIA = 3;

export function alertaDe(c: ContratoParaConta, hoje: Date): Alerta {
  if (c.situacao === 'CANCELADA') return 'CANCELADA';
  if (c.situacao === 'DEVOLVIDA') return 'DEVOLVIDA';

  const faltam = diasEntre(hoje, c.previsaoDevolucao);

  if (faltam < 0) return 'ATRASADA';
  if (faltam === 0) return 'VENCE_HOJE';
  if (faltam <= AVISAR_COM_ANTECEDENCIA) return 'PERTO';

  return 'EM_DIA';
}

export const ROTULO_ALERTA: Record<Alerta, string> = {
  ATRASADA: 'Atrasada',
  VENCE_HOJE: 'Vence hoje',
  PERTO: 'Vence em breve',
  EM_DIA: 'Em dia',
  DEVOLVIDA: 'Devolvida',
  CANCELADA: 'Cancelada',
};

/** Uma frase em português sobre o que fazer com este contrato. */
export function lerContrato(c: ContratoParaConta, hoje: Date): string {
  const alerta = alertaDe(c, hoje);

  if (alerta === 'CANCELADA') return 'Contrato cancelado antes de começar.';
  if (alerta === 'DEVOLVIDA') {
    const atraso = diasDeAtraso(c, hoje);
    if (atraso === 0) return 'Devolvida no prazo.';

    return 'Devolvida com ' + atraso + ' dia(s) de atraso, que custaram ' +
      emReais(custoDoAtraso(c, hoje)) + '.';
  }

  if (alerta === 'ATRASADA') {
    const atraso = diasDeAtraso(c, hoje);
    return 'Parada há ' + atraso + ' dia(s) além do combinado. ' +
      'O atraso já custou ' + emReais(custoDoAtraso(c, hoje)) + '.';
  }

  if (alerta === 'VENCE_HOJE') return 'Vence hoje. Combine a retirada com o fornecedor.';

  if (alerta === 'PERTO') {
    const faltam = diasEntre(hoje, c.previsaoDevolucao);
    return 'Vence em ' + faltam + ' dia(s). Se ainda precisa, renegocie antes de virar atraso.';
  }

  return 'Em dia.';
}

function emReais(valor: number): string {
  return 'R$ ' + valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

// ------------------------------------------------------------
//  Resumo do painel
// ------------------------------------------------------------

export interface ResumoDaLocacao {
  ativas: number;
  atrasadas: number;
  vencendo: number;
  /** Quanto os contratos ativos já custaram até hoje. */
  custoEmAndamento: number;
  /** Quanto o atraso dos contratos ativos já custou. */
  desperdicio: number;
  /** Total pago em locação, contando as já devolvidas. */
  custoTotal: number;
}

export function resumirLocacoes(
  contratos: ContratoParaConta[],
  hoje: Date,
): ResumoDaLocacao {
  const ativos = contratos.filter((c) => c.situacao === 'ATIVA');

  const conta = (lista: ContratoParaConta[], f: (c: ContratoParaConta) => number) =>
    arredondar(lista.reduce((s, c) => s + f(c), 0));

  return {
    ativas: ativos.length,
    atrasadas: ativos.filter((c) => alertaDe(c, hoje) === 'ATRASADA').length,
    vencendo: ativos.filter((c) => ['VENCE_HOJE', 'PERTO'].includes(alertaDe(c, hoje))).length,
    custoEmAndamento: conta(ativos, (c) => custoAcumulado(c, hoje)),
    desperdicio: conta(ativos, (c) => custoDoAtraso(c, hoje)),
    custoTotal: conta(
      contratos.filter((c) => c.situacao !== 'CANCELADA'),
      (c) => custoAcumulado(c, hoje),
    ),
  };
}

// ------------------------------------------------------------
//  Regras de mudança de estado
// ------------------------------------------------------------

export interface Recusa {
  ok: false;
  erro: string;
}

export interface Aceite {
  ok: true;
}

export type Conferencia = Aceite | Recusa;

/** O que precisa ser verdade para contratar. */
export function conferirContrato(dados: {
  inicioEm: Date;
  previsaoDevolucao: Date;
  valorPeriodo: number;
  quantidade: number;
}): Conferencia {
  if (dados.quantidade <= 0) {
    return { ok: false, erro: 'A quantidade precisa ser maior que zero.' };
  }

  if (dados.valorPeriodo <= 0) {
    return { ok: false, erro: 'O valor do período precisa ser maior que zero.' };
  }

  if (diasEntre(dados.inicioEm, dados.previsaoDevolucao) < 0) {
    return {
      ok: false,
      erro: 'A devolução não pode ser antes do início da locação.',
    };
  }

  return { ok: true };
}

/** O que precisa ser verdade para registrar a devolução. */
export function conferirDevolucao(
  c: { situacao: SituacaoLocacao; inicioEm: Date },
  devolvidoEm: Date,
): Conferencia {
  if (c.situacao === 'DEVOLVIDA') {
    return { ok: false, erro: 'Esta locação já foi devolvida.' };
  }

  if (c.situacao === 'CANCELADA') {
    return { ok: false, erro: 'Esta locação foi cancelada e não tem o que devolver.' };
  }

  if (diasEntre(c.inicioEm, devolvidoEm) < 0) {
    return { ok: false, erro: 'A devolução não pode ser antes do início da locação.' };
  }

  return { ok: true };
}

/** Cancelar só faz sentido enquanto nada aconteceu. */
export function conferirCancelamento(c: { situacao: SituacaoLocacao }): Conferencia {
  if (c.situacao === 'DEVOLVIDA') {
    return {
      ok: false,
      erro: 'Esta locação já foi devolvida. O que aconteceu não se apaga.',
    };
  }

  if (c.situacao === 'CANCELADA') {
    return { ok: false, erro: 'Esta locação já está cancelada.' };
  }

  return { ok: true };
}

/** "LOC-00042" */
export function formatarNumero(numero: number): string {
  return 'LOC-' + String(numero).padStart(5, '0');
}
