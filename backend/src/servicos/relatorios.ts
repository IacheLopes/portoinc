// ============================================================
//  Relatórios
//
//  As contas ficam aqui, longe do banco, para poderem ser
//  testadas sozinhas.
//
//  Cada relatório responde a uma pergunta que alguém faz de
//  verdade na construtora:
//
//    1. A obra está estourando o orçamento?
//    2. A cotação valeu a pena?
//    3. Em quem dá para confiar?
//    4. Onde o processo trava?
//    5. O que a empresa mais compra?
// ============================================================

/** Divisão que não explode quando o de baixo é zero. */
function porcentagem(parte: number, todo: number): number {
  if (todo === 0) return 0;
  return Math.round((parte / todo) * 1000) / 10;
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

/** Dias inteiros entre duas datas, ignorando a hora. */
export function diasEntre(inicio: Date, fim: Date): number {
  const a = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const b = Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate());

  return Math.round((b - a) / 86400000);
}

// ------------------------------------------------------------
//  1. Orçado × realizado
// ------------------------------------------------------------

export interface LinhaDeOrcamento {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidadePrevista: number;
  valorUnitarioPrevisto: number;
  /** Quanto já foi comprado apontando nesta linha. */
  realizado: number;
}

export interface LinhaComparada extends LinhaDeOrcamento {
  previsto: number;
  saldo: number;
  /** Quanto do previsto já foi consumido. */
  consumido: number;
  situacao: 'FOLGADO' | 'ATENCAO' | 'ESTOUROU' | 'SEM_PREVISAO';
}

/**
 * Compara o que foi orçado com o que foi comprado.
 *
 * "Atenção" começa em 80% de propósito: avisar só quando estourou
 * não ajuda ninguém — quando o número fica vermelho, o dinheiro
 * já saiu.
 */
export function compararOrcamento(linhas: LinhaDeOrcamento[]): LinhaComparada[] {
  return linhas.map((l) => {
    const previsto = arredondar(l.quantidadePrevista * l.valorUnitarioPrevisto);
    const consumido = porcentagem(l.realizado, previsto);

    let situacao: LinhaComparada['situacao'];
    if (previsto <= 0) situacao = 'SEM_PREVISAO';
    else if (l.realizado > previsto) situacao = 'ESTOUROU';
    else if (consumido >= 80) situacao = 'ATENCAO';
    else situacao = 'FOLGADO';

    return {
      ...l,
      previsto,
      realizado: arredondar(l.realizado),
      saldo: arredondar(previsto - l.realizado),
      consumido,
      situacao,
    };
  });
}

export interface ResumoDoOrcamento {
  previsto: number;
  realizado: number;
  saldo: number;
  consumido: number;
  linhasEstouradas: number;
  linhasEmAtencao: number;
}

export function resumirOrcamento(linhas: LinhaComparada[]): ResumoDoOrcamento {
  const previsto = arredondar(linhas.reduce((s, l) => s + l.previsto, 0));
  const realizado = arredondar(linhas.reduce((s, l) => s + l.realizado, 0));

  return {
    previsto,
    realizado,
    saldo: arredondar(previsto - realizado),
    consumido: porcentagem(realizado, previsto),
    linhasEstouradas: linhas.filter((l) => l.situacao === 'ESTOUROU').length,
    linhasEmAtencao: linhas.filter((l) => l.situacao === 'ATENCAO').length,
  };
}

// ------------------------------------------------------------
//  2. Economia nas cotações
// ------------------------------------------------------------

export interface CotacaoParaAnalise {
  numeroFormatado: string;
  titulo: string;
  encerradaEm: Date | null;
  fornecedoresConvidados: number;
  fornecedoresResponderam: number;
  /** Soma do valor que o solicitante estimou. */
  estimado: number;
  /** Soma do que foi realmente fechado nos pedidos. */
  fechado: number;
  /** A pior proposta recebida, para mostrar a faixa. */
  maiorProposta: number;
}

export interface EconomiaDaCotacao extends CotacaoParaAnalise {
  /** Diferença entre o estimado e o fechado. */
  economia: number;
  economiaPercentual: number;
  /** Diferença entre a pior proposta e a escolhida. */
  ganhoNaDisputa: number;
  taxaDeResposta: number;
}

export function analisarCotacoes(cotacoes: CotacaoParaAnalise[]): EconomiaDaCotacao[] {
  return cotacoes.map((c) => ({
    ...c,
    estimado: arredondar(c.estimado),
    fechado: arredondar(c.fechado),
    economia: arredondar(c.estimado - c.fechado),
    economiaPercentual: porcentagem(c.estimado - c.fechado, c.estimado),
    ganhoNaDisputa: arredondar(Math.max(0, c.maiorProposta - c.fechado)),
    taxaDeResposta: porcentagem(c.fornecedoresResponderam, c.fornecedoresConvidados),
  }));
}

export interface ResumoDaEconomia {
  cotacoes: number;
  estimado: number;
  fechado: number;
  economia: number;
  economiaPercentual: number;
  ganhoNaDisputa: number;
  taxaMediaDeResposta: number;
  mediaDeFornecedoresPorCotacao: number;
}

export function resumirEconomia(cotacoes: EconomiaDaCotacao[]): ResumoDaEconomia {
  const estimado = arredondar(cotacoes.reduce((s, c) => s + c.estimado, 0));
  const fechado = arredondar(cotacoes.reduce((s, c) => s + c.fechado, 0));

  return {
    cotacoes: cotacoes.length,
    estimado,
    fechado,
    economia: arredondar(estimado - fechado),
    economiaPercentual: porcentagem(estimado - fechado, estimado),
    ganhoNaDisputa: arredondar(cotacoes.reduce((s, c) => s + c.ganhoNaDisputa, 0)),
    taxaMediaDeResposta: Math.round(media(cotacoes.map((c) => c.taxaDeResposta)) * 10) / 10,
    mediaDeFornecedoresPorCotacao:
      Math.round(media(cotacoes.map((c) => c.fornecedoresConvidados)) * 10) / 10,
  };
}

// ------------------------------------------------------------
//  3. Desempenho do fornecedor
// ------------------------------------------------------------

export interface EntregaDoFornecedor {
  /** Dias prometidos na cotação. */
  prazoPrometido: number | null;
  /** Dias que realmente levou, do pedido até chegar. */
  prazoReal: number | null;
  comRessalva: boolean;
  devolvido: boolean;
}

export interface FornecedorParaAnalise {
  nome: string;
  convites: number;
  respostas: number;
  pedidos: number;
  valorComprado: number;
  entregas: EntregaDoFornecedor[];
}

export interface DesempenhoDoFornecedor {
  nome: string;
  convites: number;
  respostas: number;
  taxaDeResposta: number;
  pedidos: number;
  valorComprado: number;
  entregas: number;
  /** Entregas que chegaram dentro do prazo prometido. */
  noPrazo: number;
  pontualidade: number;
  atrasoMedio: number;
  ressalvas: number;
  devolucoes: number;
  /** Entregas sem ressalva e sem devolução. */
  qualidade: number;
  /** Uma frase curta resumindo o fornecedor. */
  leitura: string;
}

export function analisarFornecedores(
  fornecedores: FornecedorParaAnalise[],
): DesempenhoDoFornecedor[] {
  return fornecedores
    .map((f) => {
      const comPrazo = f.entregas.filter(
        (e) => e.prazoPrometido !== null && e.prazoReal !== null,
      );

      const noPrazo = comPrazo.filter((e) => e.prazoReal! <= e.prazoPrometido!).length;
      const atrasos = comPrazo
        .map((e) => e.prazoReal! - e.prazoPrometido!)
        .filter((d) => d > 0);

      const ressalvas = f.entregas.filter((e) => e.comRessalva).length;
      const devolucoes = f.entregas.filter((e) => e.devolvido).length;
      const semProblema = f.entregas.filter((e) => !e.comRessalva && !e.devolvido).length;

      const pontualidade = comPrazo.length > 0 ? porcentagem(noPrazo, comPrazo.length) : 100;
      const qualidade = f.entregas.length > 0 ? porcentagem(semProblema, f.entregas.length) : 100;
      const taxaDeResposta = porcentagem(f.respostas, f.convites);

      return {
        nome: f.nome,
        convites: f.convites,
        respostas: f.respostas,
        taxaDeResposta,
        pedidos: f.pedidos,
        valorComprado: arredondar(f.valorComprado),
        entregas: f.entregas.length,
        noPrazo,
        pontualidade,
        atrasoMedio: Math.round(media(atrasos)),
        ressalvas,
        devolucoes,
        qualidade,
        leitura: lerFornecedor({
          entregas: f.entregas.length,
          convites: f.convites,
          taxaDeResposta,
          pontualidade,
          qualidade,
        }),
      };
    })
    .sort((a, b) => b.valorComprado - a.valorComprado);
}

/**
 * Quantas entregas são necessárias antes de dar um veredito.
 *
 * Com uma ou duas, qualquer número vira 0% ou 100% e a frase
 * mentiria nos dois sentidos: uma ressalva isolada viraria
 * "chega com problema com frequência", e um acerto isolado
 * viraria "cumpre prazo e entrega certo".
 */
const ENTREGAS_PARA_CONCLUIR = 3;

/**
 * Uma frase em português para quem não quer ler a tabela inteira.
 *
 * A ordem importa: o problema mais grave aparece primeiro.
 */
function lerFornecedor(d: {
  entregas: number;
  convites: number;
  taxaDeResposta: number;
  pontualidade: number;
  qualidade: number;
}): string {
  if (d.entregas === 0 && d.convites === 0) return 'Ainda sem histórico.';
  if (d.entregas === 0) return 'Convidado, mas ainda não entregou nada.';

  if (d.entregas < ENTREGAS_PARA_CONCLUIR) {
    const plural = d.entregas === 1 ? 'entrega' : 'entregas';
    return `Só ${d.entregas} ${plural} até agora — pouco para concluir.`;
  }

  if (d.qualidade < 70) return 'Atenção: material chega com problema com frequência.';
  if (d.pontualidade < 60) return 'Atrasa com frequência. Combine prazo com folga.';
  if (d.taxaDeResposta < 50 && d.convites >= 3) return 'Responde pouco às cotações.';

  if (d.pontualidade === 100 && d.qualidade === 100) return 'Cumpre prazo e entrega certo.';
  if (d.pontualidade >= 80 && d.qualidade >= 80) return 'Bom histórico, sem problema relevante.';

  return 'Histórico misto: vale acompanhar.';
}

// ------------------------------------------------------------
//  4. Tempo do processo
// ------------------------------------------------------------

export interface PassagemDaSolicitacao {
  numeroFormatado: string;
  obra: string | null;
  criadaEm: Date;
  enviadaEm: Date | null;
  aprovadaEm: Date | null;
  cotadaEm: Date | null;
  pedidoEm: Date | null;
  recebidoEm: Date | null;
}

export interface EtapaDoTempo {
  etapa: string;
  descricao: string;
  /** Média de dias nessa etapa. */
  dias: number;
  /** Quantas solicitações já passaram por ela. */
  amostra: number;
}

/**
 * Onde o tempo se perde entre pedir e receber.
 *
 * Só entra no cálculo quem já passou pela etapa: misturar o que
 * ainda está em andamento puxaria as médias para baixo e daria
 * uma impressão boa que não existe.
 */
export function medirTempos(passagens: PassagemDaSolicitacao[]): EtapaDoTempo[] {
  const trechos: Array<{
    etapa: string;
    descricao: string;
    de: keyof PassagemDaSolicitacao;
    para: keyof PassagemDaSolicitacao;
  }> = [
    {
      etapa: 'Montar o pedido',
      descricao: 'De abrir a solicitação até enviá-la para aprovação',
      de: 'criadaEm',
      para: 'enviadaEm',
    },
    {
      etapa: 'Aprovação',
      descricao: 'Da solicitação enviada até a última assinatura',
      de: 'enviadaEm',
      para: 'aprovadaEm',
    },
    {
      etapa: 'Cotação',
      descricao: 'Da aprovação até o pacote ser encerrado',
      de: 'aprovadaEm',
      para: 'cotadaEm',
    },
    {
      etapa: 'Decisão de compra',
      descricao: 'Do fim da cotação até o pedido sair',
      de: 'cotadaEm',
      para: 'pedidoEm',
    },
    {
      etapa: 'Entrega',
      descricao: 'Do pedido até o material chegar na obra',
      de: 'pedidoEm',
      para: 'recebidoEm',
    },
  ];

  return trechos.map((t) => {
    const dias = passagens
      .map((p) => {
        const inicio = p[t.de] as Date | null;
        const fim = p[t.para] as Date | null;
        if (!inicio || !fim) return null;

        const d = diasEntre(inicio, fim);
        return d >= 0 ? d : null;
      })
      .filter((d): d is number => d !== null);

    return {
      etapa: t.etapa,
      descricao: t.descricao,
      dias: Math.round(media(dias) * 10) / 10,
      amostra: dias.length,
    };
  });
}

/** O caminho inteiro, de ponta a ponta. */
export function tempoTotal(passagens: PassagemDaSolicitacao[]): {
  dias: number;
  amostra: number;
  maisDemorada: string | null;
} {
  const completas = passagens.filter((p) => p.recebidoEm !== null);
  const dias = completas.map((p) => diasEntre(p.criadaEm, p.recebidoEm!)).filter((d) => d >= 0);

  // Só apontamos um gargalo quando existe gargalo. Se tudo levou
  // zero dia, dizer "a etapa mais demorada é X" faria alguém ir
  // mexer numa etapa que não está atrasando nada.
  const etapas = medirTempos(passagens).filter((e) => e.amostra > 0 && e.dias > 0);
  const pior = etapas.length > 0
    ? etapas.reduce((a, b) => (b.dias > a.dias ? b : a))
    : null;

  return {
    dias: Math.round(media(dias) * 10) / 10,
    amostra: dias.length,
    maisDemorada: pior ? pior.etapa : null,
  };
}

// ------------------------------------------------------------
//  5. Consumo por família e material
// ------------------------------------------------------------

export interface ItemComprado {
  codigo: string;
  descricao: string;
  familia: string;
  unidadeMedida: string;
  quantidade: number;
  valor: number;
}

export interface LinhaDeConsumo {
  nome: string;
  quantidade: number;
  valor: number;
  itens: number;
  /** Quanto representa do total comprado. */
  participacao: number;
}

export function consumoPorFamilia(itens: ItemComprado[]): LinhaDeConsumo[] {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const mapa = new Map<string, { valor: number; quantidade: number; codigos: Set<string> }>();

  for (const i of itens) {
    const atual = mapa.get(i.familia) ?? { valor: 0, quantidade: 0, codigos: new Set<string>() };
    atual.valor += i.valor;
    atual.quantidade += i.quantidade;
    atual.codigos.add(i.codigo);
    mapa.set(i.familia, atual);
  }

  return [...mapa.entries()]
    .map(([nome, d]) => ({
      nome,
      valor: arredondar(d.valor),
      quantidade: arredondar(d.quantidade),
      itens: d.codigos.size,
      participacao: porcentagem(d.valor, total),
    }))
    .sort((a, b) => b.valor - a.valor);
}

export interface MaterialMaisComprado extends ItemComprado {
  participacao: number;
  precoMedio: number;
}

export function materiaisMaisComprados(
  itens: ItemComprado[],
  limite = 15,
): MaterialMaisComprado[] {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const mapa = new Map<string, ItemComprado>();

  for (const i of itens) {
    const atual = mapa.get(i.codigo);

    if (atual) {
      atual.quantidade += i.quantidade;
      atual.valor += i.valor;
    } else {
      mapa.set(i.codigo, { ...i });
    }
  }

  return [...mapa.values()]
    .map((i) => ({
      ...i,
      quantidade: arredondar(i.quantidade),
      valor: arredondar(i.valor),
      participacao: porcentagem(i.valor, total),
      precoMedio: i.quantidade > 0 ? arredondar(i.valor / i.quantidade) : 0,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limite);
}
