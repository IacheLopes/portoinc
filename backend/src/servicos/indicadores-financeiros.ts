// ============================================================
//  Indicadores do financeiro
//
//  As contas ficam aqui, longe do banco, para poderem ser
//  testadas sozinhas. Quem busca os dados é a rota; quem decide
//  o que cada número significa é este arquivo.
//
//  Cada indicador responde a uma pergunta que alguém faz de
//  verdade na construtora. Número que não responde pergunta
//  nenhuma não entrou.
// ============================================================

import { diasAte } from './fiscal.js';

export interface ParcelaParaIndicador {
  valor: number;
  vencimento: Date;
  situacao: 'ABERTA' | 'PAGA' | 'CANCELADA';
  pagoEm: Date | null;
  valorPago: number | null;
  /** Emissão da nota que gerou a parcela. */
  emitidaEm: Date;
  fornecedor: string;
  obra: string | null;
}

// ------------------------------------------------------------
//  Os quatro números do topo
// ------------------------------------------------------------

export interface Resumo {
  quantidade: number;
  valor: number;
}

export interface ResumoDaCarteira {
  vencidas: Resumo;
  proximos7Dias: Resumo;
  emAberto: Resumo;
  pagoNoMes: Resumo;
}

export function resumirCarteira(
  parcelas: ParcelaParaIndicador[],
  hoje = new Date(),
): ResumoDaCarteira {
  const abertas = parcelas.filter((p) => p.situacao === 'ABERTA');

  const vencidas = abertas.filter((p) => diasAte(p.vencimento, hoje) < 0);
  const seteDias = abertas.filter((p) => {
    const d = diasAte(p.vencimento, hoje);
    return d >= 0 && d <= 7;
  });

  const inicioDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const pagasNoMes = parcelas.filter(
    (p) => p.situacao === 'PAGA' && p.pagoEm !== null && p.pagoEm >= inicioDoMes,
  );

  return {
    vencidas: resumir(vencidas),
    proximos7Dias: resumir(seteDias),
    emAberto: resumir(abertas),
    pagoNoMes: {
      quantidade: pagasNoMes.length,
      valor: arredondar(pagasNoMes.reduce((s, p) => s + (p.valorPago ?? p.valor), 0)),
    },
  };
}

function resumir(parcelas: ParcelaParaIndicador[]): Resumo {
  return {
    quantidade: parcelas.length,
    valor: arredondar(parcelas.reduce((s, p) => s + p.valor, 0)),
  };
}

// ------------------------------------------------------------
//  Indicadores de gestão
// ------------------------------------------------------------

export interface IndicadoresDeGestao {
  /**
   * Dias médios entre a emissão da nota e o vencimento.
   * Quanto maior, mais fôlego de caixa a Porto Inc. negociou.
   */
  prazoMedioPagamento: number;
  /**
   * Percentual das parcelas pagas que saíram até o vencimento.
   * É a régua da saúde do processo, não do fornecedor.
   */
  pontualidade: number;
  /** Quanto ainda vai sair, somando tudo que está em aberto. */
  totalComprometido: number;
  /** Maior parcela em aberto: a que mais assusta o caixa. */
  maiorParcelaAberta: number;
  /** Dias até o próximo vencimento. Nulo quando não há nada em aberto. */
  diasParaProximoVencimento: number | null;
  /** Valor médio das parcelas em aberto. */
  ticketMedio: number;
}

export function calcularIndicadores(
  parcelas: ParcelaParaIndicador[],
  hoje = new Date(),
): IndicadoresDeGestao {
  const abertas = parcelas.filter((p) => p.situacao === 'ABERTA');
  const pagas = parcelas.filter((p) => p.situacao === 'PAGA' && p.pagoEm !== null);

  // Prazo negociado: da emissão da nota até o vencimento.
  const prazos = parcelas
    .filter((p) => p.situacao !== 'CANCELADA')
    .map((p) => diasAte(p.vencimento, p.emitidaEm))
    .filter((d) => d >= 0);

  const emDia = pagas.filter((p) => diasAte(p.vencimento, p.pagoEm!) >= 0);

  const proximos = abertas
    .map((p) => diasAte(p.vencimento, hoje))
    .sort((a, b) => a - b);

  return {
    prazoMedioPagamento: prazos.length > 0 ? Math.round(media(prazos)) : 0,
    pontualidade: pagas.length > 0 ? Math.round((emDia.length / pagas.length) * 100) : 100,
    totalComprometido: arredondar(abertas.reduce((s, p) => s + p.valor, 0)),
    maiorParcelaAberta: abertas.length > 0 ? Math.max(...abertas.map((p) => p.valor)) : 0,
    diasParaProximoVencimento: proximos.length > 0 ? proximos[0] : null,
    ticketMedio: abertas.length > 0 ? arredondar(media(abertas.map((p) => p.valor))) : 0,
  };
}

// ------------------------------------------------------------
//  Fluxo de caixa por mês
// ------------------------------------------------------------

export interface MesDoFluxo {
  /** "2026-10" */
  chave: string;
  /** "out/26" */
  rotulo: string;
  aVencer: number;
  vencido: number;
  pago: number;
  /** Soma das três barras. Usado para a escala do gráfico. */
  total: number;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** O fluxo só precisa disto de cada parcela — não do fornecedor nem da obra. */
export type ParcelaDoFluxo = Pick<
  ParcelaParaIndicador,
  'valor' | 'vencimento' | 'situacao' | 'pagoEm' | 'valorPago'
>;

/**
 * Doze meses: os 3 anteriores e os 9 seguintes.
 *
 * O passado mostra o que já saiu; o futuro mostra o que vem.
 * Sem o passado, não dá para comparar o mês que vem com nada.
 *
 * `hoje` e `referencia` são coisas DIFERENTES, e essa separação é o
 * que permite o filtro de período:
 *
 *   - `referencia` decide QUAIS meses aparecem no gráfico;
 *   - `hoje` decide o que é vencido e o que ainda vai vencer.
 *
 * Juntos num parâmetro só, olhar dezembro de 2025 faria toda parcela
 * em aberto parecer "a vencer" — porque em dezembro ela ainda estava.
 * O gráfico mentiria sobre o presente para poder mostrar o passado.
 */
export function montarFluxo(
  parcelas: ParcelaDoFluxo[],
  hoje = new Date(),
  mesesAntes = 3,
  mesesDepois = 8,
  referencia = hoje,
): MesDoFluxo[] {
  const meses: MesDoFluxo[] = [];

  for (let i = -mesesAntes; i <= mesesDepois; i++) {
    const data = new Date(referencia.getFullYear(), referencia.getMonth() + i, 1);
    const chave =
      data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0');

    meses.push({
      chave,
      rotulo: MESES[data.getMonth()] + '/' + String(data.getFullYear()).slice(-2),
      aVencer: 0,
      vencido: 0,
      pago: 0,
      total: 0,
    });
  }

  const porChave = new Map(meses.map((m) => [m.chave, m]));

  for (const p of parcelas) {
    if (p.situacao === 'CANCELADA') continue;

    // A parcela paga conta no mês em que SAIU o dinheiro.
    // A em aberto conta no mês em que vai vencer.
    const data = p.situacao === 'PAGA' && p.pagoEm ? p.pagoEm : p.vencimento;
    const chave = data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0');

    const mes = porChave.get(chave);
    if (!mes) continue;

    if (p.situacao === 'PAGA') {
      mes.pago = arredondar(mes.pago + (p.valorPago ?? p.valor));
    } else if (diasAte(p.vencimento, hoje) < 0) {
      mes.vencido = arredondar(mes.vencido + p.valor);
    } else {
      mes.aVencer = arredondar(mes.aVencer + p.valor);
    }
  }

  for (const m of meses) {
    m.total = arredondar(m.aVencer + m.vencido + m.pago);
  }

  return meses;
}

// ------------------------------------------------------------
//  Rankings
// ------------------------------------------------------------

export interface LinhaDeRanking {
  nome: string;
  aberto: number;
  pago: number;
  total: number;
}

/** Quem a Porto Inc. mais deve, e quanto já pagou para cada um. */
export function ranquearPor(
  parcelas: ParcelaParaIndicador[],
  campo: 'fornecedor' | 'obra',
  limite = 6,
): LinhaDeRanking[] {
  const mapa = new Map<string, LinhaDeRanking>();

  for (const p of parcelas) {
    if (p.situacao === 'CANCELADA') continue;

    const nome = (campo === 'fornecedor' ? p.fornecedor : p.obra) ?? 'Sem obra vinculada';
    const atual = mapa.get(nome) ?? { nome, aberto: 0, pago: 0, total: 0 };

    if (p.situacao === 'PAGA') atual.pago = arredondar(atual.pago + (p.valorPago ?? p.valor));
    else atual.aberto = arredondar(atual.aberto + p.valor);

    atual.total = arredondar(atual.aberto + atual.pago);
    mapa.set(nome, atual);
  }

  return [...mapa.values()].sort((a, b) => b.total - a.total).slice(0, limite);
}

// ------------------------------------------------------------
//  Fatias da carteira (para a rosca)
// ------------------------------------------------------------

export interface FatiaDaCarteira {
  rotulo: string;
  valor: number;
  /** Percentual do total, já arredondado. */
  percentual: number;
  /** Qual cor de significado usar. */
  tom: 'erro' | 'atencao' | 'info' | 'sucesso';
}

export function fatiarCarteira(
  parcelas: ParcelaParaIndicador[],
  hoje = new Date(),
): FatiaDaCarteira[] {
  const abertas = parcelas.filter((p) => p.situacao === 'ABERTA');
  const pagas = parcelas.filter((p) => p.situacao === 'PAGA');

  const vencidas = soma(abertas.filter((p) => diasAte(p.vencimento, hoje) < 0));
  const seteDias = soma(
    abertas.filter((p) => {
      const d = diasAte(p.vencimento, hoje);
      return d >= 0 && d <= 7;
    }),
  );
  const depois = soma(abertas.filter((p) => diasAte(p.vencimento, hoje) > 7));
  const pago = arredondar(pagas.reduce((s, p) => s + (p.valorPago ?? p.valor), 0));

  const bruto: Array<Omit<FatiaDaCarteira, 'percentual'>> = [
    { rotulo: 'Vencidas', valor: vencidas, tom: 'erro' },
    { rotulo: 'Vencem em 7 dias', valor: seteDias, tom: 'atencao' },
    { rotulo: 'A vencer depois', valor: depois, tom: 'info' },
    { rotulo: 'Já pagas', valor: pago, tom: 'sucesso' },
  ];

  const total = bruto.reduce((s, f) => s + f.valor, 0);

  return bruto
    .filter((f) => f.valor > 0)
    .map((f) => ({
      ...f,
      percentual: total > 0 ? Math.round((f.valor / total) * 100) : 0,
    }));
}

// ------------------------------------------------------------
//  Apoio
// ------------------------------------------------------------

function soma(parcelas: ParcelaParaIndicador[]): number {
  return arredondar(parcelas.reduce((s, p) => s + p.valor, 0));
}

function media(valores: number[]): number {
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}
