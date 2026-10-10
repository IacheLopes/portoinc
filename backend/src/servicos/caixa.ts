// ============================================================
//  O caixa: o que entrou, o que saiu, o que sobrou
//
//  O FINANCEIRO DESCONTAVA DE UMA CONTA QUE NUNCA RECEBEU NADA.
//
//  Até aqui, só existia saída: a nota do fornecedor virava parcela
//  em contas a pagar e pronto. Dava para ver quanto a Porto Inc.
//  devia, e nunca quanto ela tinha.
//
//  Iache, perguntando onde se cadastra a receita da empresa e as
//  despesas que não vêm de compra, e Emerson, na reunião de
//  08/10/2026: "ele vai descontar de uma conta que não tem
//  cadastro de dinheiro de entrada".
//
//  As contas ficam aqui, longe do banco, para poderem ser testadas
//  sozinhas — mesma divisão de `indicadores-financeiros.ts`: quem
//  busca os dados é a rota, quem decide o que cada número significa
//  é este arquivo.
//
//  O DINHEIRO QUE SAI VEM DE DOIS LUGARES, e é de propósito:
//
//    · a COMPRA sai da nota fiscal, com fornecedor, pedido e
//      conferência atrás dela — isso continua em contas a pagar;
//    · a DESPESA AVULSA é lançada à mão: combustível, aluguel do
//      container, diária de máquina. Não tem nota de compra, não
//      passa por cotação, e hoje não tinha onde ser registrada.
//
//  Somar os dois é o trabalho deste arquivo. Repetir a compra como
//  lançamento daria dois lugares para a mesma dívida, e um dia eles
//  divergiriam.
// ============================================================

import type { MesDoFluxo } from './indicadores-financeiros.js';
import { diasAte } from './fiscal.js';

/** O número que aparece na tela: LC-00001. */
export function formatarNumeroLancamento(numero: number): string {
  return 'LC-' + String(numero).padStart(5, '0');
}

export interface LancamentoParaCaixa {
  tipo: 'RECEITA' | 'DESPESA';
  valor: number;
  /**
   * Dinheiro que a empresa já tinha ao entrar no sistema.
   *
   * Continua sendo entrada, e por isso soma no saldo como
   * qualquer outra. Só não conta como faturamento.
   */
  aberturaDeCaixa?: boolean;
  previstoPara: Date;
  realizadoEm: Date | null;
  situacao: 'PREVISTO' | 'REALIZADO' | 'CANCELADO';
  /**
   * Texto livre, e pode faltar.
   *
   * Opcional porque quem monta o fluxo de caixa mensal nao precisa
   * dela — e carregar coluna que nao se usa e peso a toa numa
   * consulta que roda a cada abertura do painel.
   */
  categoria?: string | null;
}

/** Da conta a pagar, o caixa só precisa disto. */
export interface ContaParaCaixa {
  valor: number;
  valorPago: number | null;
  situacao: 'ABERTA' | 'PAGA' | 'CANCELADA';
}

/** A mesma conta, mais a data — o calendário precisa saber QUANDO. */
export interface ContaFutura extends ContaParaCaixa {
  vencimento: Date;
}

export interface Caixa {
  /** Tudo que já caiu, inclusive o que a empresa trouxe de fora. */
  entrou: number;
  /**
   * Quanto do `entrou` é dinheiro que a empresa JÁ TINHA.
   *
   * Zero na empresa que nasceu dentro do sistema. Na que veio da
   * planilha, é o saldo de abertura — e sem separá-lo o cartão
   * "Entrou" anunciava faturamento que ninguém faturou.
   */
  aberturaDeCaixa: number;
  /** `entrou - aberturaDeCaixa`: o que a empresa faturou AQUI. */
  faturou: number;
  /** Dinheiro que já saiu: compras pagas + despesas avulsas feitas. */
  saiu: number;
  /** `entrou - saiu`. O número que não existia. */
  saldo: number;
  /** Receita prevista e ainda não recebida. */
  aReceber: number;
  /** Compras em aberto + despesas avulsas previstas. */
  aPagar: number;
  /** `saldo + aReceber - aPagar`: como o caixa termina se tudo acontecer. */
  previsto: number;
  /**
   * De onde vem cada metade das somas acima.
   *
   * Sem isto, um saldo negativo não diz se o problema é compra ou
   * custo de operação — e são dois assuntos com dois donos.
   */
  detalhe: {
    comprasPagas: number;
    despesasFeitas: number;
    comprasEmAberto: number;
    despesasPrevistas: number;
  };
}

/**
 * O caixa, somando as duas origens de saída.
 *
 * CANCELADO não entra em conta nenhuma, dos dois lados: lançamento
 * cancelado continua na lista para quem for auditar, mas não é
 * dinheiro.
 */
export function montarCaixa(
  lancamentos: LancamentoParaCaixa[],
  contas: ContaParaCaixa[],
): Caixa {
  const vivos = lancamentos.filter((l) => l.situacao !== 'CANCELADO');

  const recebidas = vivos.filter((l) => l.tipo === 'RECEITA' && l.situacao === 'REALIZADO');
  const entrou = somar(recebidas);
  const aberturaDeCaixa = somar(recebidas.filter((l) => l.aberturaDeCaixa === true));
  const faturou = arredondar(entrou - aberturaDeCaixa);
  const aReceber = somar(
    vivos.filter((l) => l.tipo === 'RECEITA' && l.situacao === 'PREVISTO'),
  );

  const despesasFeitas = somar(
    vivos.filter((l) => l.tipo === 'DESPESA' && l.situacao === 'REALIZADO'),
  );
  const despesasPrevistas = somar(
    vivos.filter((l) => l.tipo === 'DESPESA' && l.situacao === 'PREVISTO'),
  );

  // Na parcela paga vale o que SAIU, não o que foi combinado: a
  // Porto Inc. negocia desconto na hora de pagar, e o caixa precisa
  // do valor real. Por isso `valorPago ?? valor`.
  const pagas = contas.filter((c) => c.situacao === 'PAGA');
  const comprasPagas = arredondar(
    pagas.reduce((s, c) => s + (c.valorPago ?? c.valor), 0),
  );
  const comprasEmAberto = arredondar(
    contas.filter((c) => c.situacao === 'ABERTA').reduce((s, c) => s + c.valor, 0),
  );

  const saiu = arredondar(comprasPagas + despesasFeitas);
  const aPagar = arredondar(comprasEmAberto + despesasPrevistas);
  const saldo = arredondar(entrou - saiu);

  return {
    entrou,
    aberturaDeCaixa,
    faturou,
    saiu,
    saldo,
    aReceber,
    aPagar,
    previsto: arredondar(saldo + aReceber - aPagar),
    detalhe: { comprasPagas, despesasFeitas, comprasEmAberto, despesasPrevistas },
  };
}

// ------------------------------------------------------------
//  O fluxo mensal ganha a entrada
// ------------------------------------------------------------

export interface MesDoCaixa extends MesDoFluxo {
  /** Receita que caiu no mês. */
  entrada: number;
  /** Receita prevista para o mês e ainda não recebida. */
  aReceber: number;
}

/**
 * Dobra os lançamentos no fluxo que `montarFluxo` já montou.
 *
 * O gráfico de doze meses mostrava três barras — a vencer, vencido,
 * pago — e as três eram saída. Quem olhava via a construtora só
 * gastando.
 *
 * A DESPESA AVULSA CAI NAS MESMAS TRÊS BARRAS das parcelas, e isso
 * não é atalho: do ponto de vista do caixa, combustível pago em
 * março e parcela paga em março são a mesma coisa — dinheiro que
 * saiu em março. Separá-las no gráfico contaria uma história sobre a
 * origem do gasto, que é assunto da lista, não do fluxo.
 *
 * A RECEITA É BARRA NOVA, porque muda o sinal.
 *
 * Recebe o fluxo pronto em vez de refazê-lo: os meses e a janela
 * (quais aparecem, qual fica no meio) são regra de
 * `indicadores-financeiros.ts`, e duas cópias dessa janela
 * divergiriam no dia em que o filtro de período mudasse.
 */
export function acrescentarLancamentosAoFluxo(
  meses: MesDoFluxo[],
  lancamentos: LancamentoParaCaixa[],
  hoje = new Date(),
): MesDoCaixa[] {
  const comEntrada: MesDoCaixa[] = meses.map((m) => ({ ...m, entrada: 0, aReceber: 0 }));
  const porChave = new Map(comEntrada.map((m) => [m.chave, m]));

  for (const l of lancamentos) {
    if (l.situacao === 'CANCELADO') continue;

    // O realizado conta no mês em que o dinheiro andou; o previsto,
    // no mês em que está prometido.
    const data = l.situacao === 'REALIZADO' && l.realizadoEm ? l.realizadoEm : l.previstoPara;
    const mes = porChave.get(chaveDoMes(data));
    if (!mes) continue;

    if (l.tipo === 'RECEITA') {
      if (l.situacao === 'REALIZADO') mes.entrada = arredondar(mes.entrada + l.valor);
      else mes.aReceber = arredondar(mes.aReceber + l.valor);
    } else if (l.situacao === 'REALIZADO') {
      mes.pago = arredondar(mes.pago + l.valor);
    } else if (diasAte(l.previstoPara, hoje) < 0) {
      mes.vencido = arredondar(mes.vencido + l.valor);
    } else {
      mes.aVencer = arredondar(mes.aVencer + l.valor);
    }
  }

  // O total é a escala da barra de SAÍDA, e precisa continuar sendo
  // só saída: somando a entrada aqui, a barra de um mês de muita
  // receita ficaria alta sem que nada tivesse saído.
  for (const m of comEntrada) {
    m.total = arredondar(m.aVencer + m.vencido + m.pago);
  }

  return comEntrada;
}

// ------------------------------------------------------------
//  De onde vem, para onde vai
//
//  O painel de contas a pagar tem cinco gráficos, e todos olham
//  para a COMPRA: a carteira, a pontualidade, para quem se deve, o
//  custo por obra.
//
//  Nenhum deles enxerga o dinheiro que não nasce de compra — que
//  é justamente o que esta tela passou a cadastrar. Combustível,
//  aluguel de container, taxa de prefeitura, a medição que entrou:
//  tudo isso era invisível até 08/10/2026.
// ------------------------------------------------------------

export interface FatiaDeCategoria {
  nome: string;
  valor: number;
  percentual: number;
}

/** Quando a categoria não foi preenchida. */
const SEM_CATEGORIA = 'Sem categoria';

/**
 * Soma por categoria, do maior para o menor.
 *
 * SÓ O QUE JÁ ACONTECEU. Misturar o previsto faria a rosca dizer
 * "a empresa gasta 40% com aluguel" por causa de um aluguel que
 * ainda nem foi pago — e o gráfico que responde "para onde vai o
 * dinheiro" tem de falar de dinheiro que foi.
 *
 * O que passar do `limite` vira uma fatia "Outras": seis fatias é o
 * que a rosca mostra sem virar confete, e a cauda somada continua
 * fechando o total.
 */
export function agruparPorCategoria(
  lancamentos: LancamentoParaCaixa[],
  tipo: 'RECEITA' | 'DESPESA',
  limite = 6,
): FatiaDeCategoria[] {
  const meus = lancamentos.filter(
    (l) => l.tipo === tipo && l.situacao === 'REALIZADO',
  );

  const mapa = new Map<string, number>();
  for (const l of meus) {
    const nome = l.categoria?.trim() || SEM_CATEGORIA;
    mapa.set(nome, arredondar((mapa.get(nome) ?? 0) + l.valor));
  }

  const total = arredondar([...mapa.values()].reduce((s, v) => s + v, 0));
  if (total <= 0) return [];

  const ordenadas = [...mapa.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);

  const cabem = ordenadas.slice(0, limite);
  const resto = ordenadas.slice(limite);

  if (resto.length > 0) {
    cabem.push({
      nome: 'Outras ' + resto.length,
      valor: arredondar(resto.reduce((s, c) => s + c.valor, 0)),
    });
  }

  return cabem.map((c) => ({
    ...c,
    percentual: Math.round((c.valor / total) * 100),
  }));
}

// ------------------------------------------------------------
//  O que vem pela frente
//
//  O cartão "Se tudo acontecer" dá o total e não diz QUANDO. Com
//  R$ 96 mil a receber e R$ 5 mil a pagar, o saldo final é bom — e
//  ainda assim pode faltar dinheiro no dia 17, se o que entra só
//  entra no dia 26.
//
//  Esta é a pergunta de caixa de verdade, e ela é sobre ORDEM, não
//  sobre soma.
// ------------------------------------------------------------

export interface SemanaDoCaixa {
  /** "13 a 19/out" */
  rotulo: string;
  /** O primeiro dia, em AAAA-MM-DD. Serve de chave na tela. */
  chave: string;
  entra: number;
  sai: number;
  /** O saldo depois de tudo que acontece até o fim desta semana. */
  saldoProjetado: number;
}

const MES_CURTO = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

/**
 * As próximas semanas, com o saldo caminhando.
 *
 * DUAS DECISÕES QUE MUDAM O NÚMERO, e por isso ficam escritas:
 *
 *  1. O QUE JÁ VENCEU CAI NA PRIMEIRA SEMANA. Uma parcela que
 *     venceu semana passada continua tendo de ser paga; deixá-la de
 *     fora faria o caixa parecer mais folgado do que é. Ela entra
 *     agora, que é quando o dinheiro vai sair.
 *
 *  2. O QUE CAI DEPOIS DA JANELA FICA DE FORA. Por isso o último
 *     saldo daqui NÃO bate com o cartão "Se tudo acontecer", que
 *     soma tudo. São perguntas diferentes: o cartão pergunta "como
 *     termina", o calendário pergunta "o que acontece até lá". A
 *     tela diz quantas semanas está mostrando.
 */
export function calendarioDoCaixa(
  saldoHoje: number,
  lancamentos: LancamentoParaCaixa[],
  contas: ContaFutura[],
  hoje = new Date(),
  semanas = 6,
): SemanaDoCaixa[] {
  const inicio = inicioDaSemana(hoje);

  const linhas: SemanaDoCaixa[] = [];
  for (let i = 0; i < semanas; i++) {
    const comeco = new Date(inicio);
    comeco.setDate(comeco.getDate() + i * 7);

    const fim = new Date(comeco);
    fim.setDate(fim.getDate() + 6);

    linhas.push({
      chave: iso(comeco),
      rotulo: rotuloDaSemana(comeco, fim),
      entra: 0,
      sai: 0,
      saldoProjetado: 0,
    });
  }

  /** Em qual semana a data cai. Atrasado vai para a primeira. */
  const ondeCai = (data: Date): SemanaDoCaixa | null => {
    const dias = Math.floor((diaLimpo(data).getTime() - inicio.getTime()) / 86400000);
    if (dias < 0) return linhas[0];
    const semana = Math.floor(dias / 7);
    return semana < linhas.length ? linhas[semana] : null;
  };

  for (const l of lancamentos) {
    if (l.situacao !== 'PREVISTO') continue;
    const semana = ondeCai(l.previstoPara);
    if (!semana) continue;

    if (l.tipo === 'RECEITA') semana.entra = arredondar(semana.entra + l.valor);
    else semana.sai = arredondar(semana.sai + l.valor);
  }

  for (const c of contas) {
    if (c.situacao !== 'ABERTA') continue;
    const semana = ondeCai(c.vencimento);
    if (!semana) continue;

    semana.sai = arredondar(semana.sai + c.valor);
  }

  let caminhando = saldoHoje;
  for (const semana of linhas) {
    caminhando = arredondar(caminhando + semana.entra - semana.sai);
    semana.saldoProjetado = caminhando;
  }

  return linhas;
}

/** Segunda-feira da semana em que a data cai. */
function inicioDaSemana(data: Date): Date {
  const d = diaLimpo(data);
  // getDay(): 0 = domingo. A semana da obra começa na segunda.
  const recuo = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - recuo);
  return d;
}

function diaLimpo(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function iso(data: Date): string {
  return data.getFullYear() +
    '-' + String(data.getMonth() + 1).padStart(2, '0') +
    '-' + String(data.getDate()).padStart(2, '0');
}

/** "13 a 19/out", e "29/set a 5/out" quando a semana vira o mês. */
function rotuloDaSemana(comeco: Date, fim: Date): string {
  const mesmoMes = comeco.getMonth() === fim.getMonth();

  return mesmoMes
    ? comeco.getDate() + ' a ' + fim.getDate() + '/' + MES_CURTO[fim.getMonth()]
    : comeco.getDate() + '/' + MES_CURTO[comeco.getMonth()] +
      ' a ' + fim.getDate() + '/' + MES_CURTO[fim.getMonth()];
}

// ------------------------------------------------------------
//  Apoio
// ------------------------------------------------------------

function chaveDoMes(data: Date): string {
  return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0');
}

function somar(lancamentos: LancamentoParaCaixa[]): number {
  return arredondar(lancamentos.reduce((s, l) => s + l.valor, 0));
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}
