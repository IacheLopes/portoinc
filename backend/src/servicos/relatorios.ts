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

import { reaisBr } from './util.js';

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
  /**
   * Dinheiro que já tem dono e ainda não virou compra.
   *
   * Solicitação aprovada esperando cotação, cotação em andamento,
   * pedido emitido que ainda não chegou. Não saiu do caixa, mas
   * também não está disponível.
   *
   * Sem isso o relatório era espelho retrovisor: o engenheiro via
   * "gastei 3%" e achava que tinha 97% na mão, quando metade já
   * estava prometida. É a informação que mais evita estouro.
   */
  comprometido: number;
  /** Previsto menos o que saiu E o que já está prometido. */
  saldo: number;
  consumido: number;
  linhasEstouradas: number;
  linhasEmAtencao: number;
}

export function resumirOrcamento(
  linhas: LinhaComparada[],
  comprometido = 0,
): ResumoDoOrcamento {
  const previsto = arredondar(linhas.reduce((s, l) => s + l.previsto, 0));
  const realizado = arredondar(linhas.reduce((s, l) => s + l.realizado, 0));

  return {
    previsto,
    realizado,
    comprometido: arredondar(comprometido),
    // O saldo desconta os DOIS. Mostrar só o gasto seria prometer
    // um dinheiro que já foi prometido.
    saldo: arredondar(previsto - realizado - comprometido),
    consumido: porcentagem(realizado + comprometido, previsto),
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
  /**
   * Quando o caminhão chegou.
   *
   * Sem isto, o relatório de fornecedores era o único dos seis sem
   * nenhuma noção de tempo: dizia "64% no prazo" e quem lia não
   * tinha como saber se aquilo era de agosto ou de três anos atrás.
   */
  quando: Date;
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
  /**
   * Quando ele entregou pela última vez. `null` = nunca entregou.
   *
   * É o dado que faltava para a tabela ser lida direito. Um
   * fornecedor com 64% de pontualidade e última entrega em março
   * conta uma história; o mesmo 64% com a última entrega há dois
   * anos conta outra, e a tabela mostrava as duas igual.
   */
  ultimaEntrega: Date | null;
  /** Desde quando há história dele. `null` = nunca entregou. */
  primeiraEntrega: Date | null;
  /** Uma frase curta resumindo o fornecedor. */
  leitura: string;
  /** Quanto das compras da empresa passou por ele, em %. */
  participacao: number;
  /**
   * Depender demais dele é risco?
   *
   * A pergunta que a diretoria faz e que nenhum relatório
   * respondia. Se um fornecedor concentra a maior parte das
   * compras, ele deixa de ser opção e vira dependência: quando
   * subir o preço, não há para onde correr.
   */
  concentracao: 'OK' | 'ATENCAO';
}

/**
 * A partir de quanto a dependência de um fornecedor vira risco.
 *
 * Não é um número sagrado: é o ponto em que a empresa perde poder de
 * barganha. Acima disso, se ele quebrar ou subir o preço, a obra
 * para ou paga o que ele pedir.
 */
const CONCENTRACAO_DE_RISCO = 40;

/**
 * Quantos meses inteiros entre duas datas.
 *
 * Arredonda para baixo: 45 dias é "1 mês", não "2". A frase do
 * relatório prefere errar para menos — dizer que sumiu há mais
 * tempo do que sumiu seria acusar sem base.
 */
function mesesEntre(de: Date, ate: Date): number {
  return Math.max(0, Math.floor((ate.getTime() - de.getTime()) / (30 * 86400000)));
}

export function analisarFornecedores(
  fornecedores: FornecedorParaAnalise[],
  hoje = new Date(),
): DesempenhoDoFornecedor[] {
  // Quanto a empresa comprou ao todo, para medir de quem ela
  // depende. A conta é feita ANTES do mapa porque cada fornecedor
  // precisa saber o tamanho do bolo, não só o pedaço dele.
  const totalDaEmpresa = fornecedores.reduce((s, f) => s + f.valorComprado, 0);

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
      const participacao = porcentagem(f.valorComprado, totalDaEmpresa);

      const datas = f.entregas.map((e) => e.quando);
      const ultimaEntrega = datas.length > 0
        ? datas.reduce((a, b) => (b > a ? b : a))
        : null;
      const primeiraEntrega = datas.length > 0
        ? datas.reduce((a, b) => (b < a ? b : a))
        : null;

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
        participacao,
        ultimaEntrega,
        primeiraEntrega,
        // Só acusa quem de fato comprou: um fornecedor com 100% de
        // zero não é dependência, é lista vazia.
        concentracao:
          f.valorComprado > 0 && participacao >= CONCENTRACAO_DE_RISCO
            ? ('ATENCAO' as const)
            : ('OK' as const),
        leitura: lerFornecedor({
          entregas: f.entregas.length,
          convites: f.convites,
          taxaDeResposta,
          pontualidade,
          qualidade,
          mesesSemEntregar: ultimaEntrega === null
            ? null
            : mesesEntre(ultimaEntrega, hoje),
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
  /** Há quantos meses não entrega. `null` = nunca entregou. */
  mesesSemEntregar: number | null;
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

  const veredito =
    d.pontualidade === 100 && d.qualidade === 100
      ? 'Cumpre prazo e entrega certo'
      : d.pontualidade >= 80 && d.qualidade >= 80
        ? 'Bom histórico, sem problema relevante'
        : 'Histórico misto: vale acompanhar';

  return veredito + envelhecimento(d.mesesSemEntregar) + '.';
}

/**
 * Há quanto tempo essa opinião parou no tempo.
 *
 * O relatório olha a vida inteira do fornecedor — foi decisão da
 * casa, para o histórico não apagar fornecedor ruim nem prender
 * fornecedor que melhorou. O preço disso é que a frase pode estar
 * falando de uma relação que acabou: "cumpre prazo e entrega certo"
 * sobre quem não entrega desde 2023.
 *
 * Então a frase diz. Não esconde número nenhum, não inventa janela:
 * acrescenta o fato que faltava para quem lê julgar.
 *
 * DOZE MESES, e não um número novo: é o mesmo período que os outros
 * três relatórios usam por padrão. Um fornecedor que não entrega há
 * mais de um ano saiu da faixa que o resto do sistema chama de
 * "como estamos indo".
 */
const MESES_PARA_ENVELHECER = 12;

function envelhecimento(meses: number | null): string {
  if (meses === null || meses < MESES_PARA_ENVELHECER) return '';

  return meses >= 24
    ? ' — mas não entrega há mais de ' + Math.floor(meses / 12) + ' anos'
    : ' — mas não entrega há ' + meses + ' meses';
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

// ------------------------------------------------------------
//  6. Estoque parado
//
//  Material encostado no almoxarifado é dinheiro que a empresa
//  já pagou e ainda não usou. Ele não aparece em relatório
//  nenhum: o orçado × realizado já deu a compra por gasta, e o
//  saldo de estoque diz o que tem, nunca há quanto tempo está lá.
// ------------------------------------------------------------

/** Quantos dias sem sair até um material virar caso para olhar. */
export const DIAS_PARADO_PADRAO = 90;

export interface MaterialNaPrateleira {
  codigo: string;
  descricao: string;
  familia: string;
  unidadeMedida: string;
  almoxarifado: string;
  quantidade: number;
  /** Custo médio ponderado. Nulo quando nunca houve entrada valorizada. */
  custoMedio: number | null;
  /** Última vez que saiu material. Nulo: nunca saiu nada. */
  ultimaSaida: Date | null;
  /** Quando este material apareceu no almoxarifado. */
  primeiraEntrada: Date | null;
}

export interface LinhaDeEstoqueParado extends MaterialNaPrateleira {
  /** Dias desde a última saída — ou desde que entrou, se nunca saiu. */
  diasParado: number;
  /** Quanto dinheiro está encostado nesta linha. */
  valorParado: number;
  /** NUNCA_SAIU dói mais do que PAROU: foi comprado à toa. */
  motivo: 'NUNCA_SAIU' | 'PAROU';
}

export interface ResumoDoEstoqueParado {
  /** Soma do dinheiro encostado. */
  valorParado: number;
  itens: number;
  /** Quantos nunca tiveram uma saída sequer. */
  nuncaSairam: number;
  /** O material parado há mais tempo. */
  maisAntigo: number;
  leitura: string;
}

/**
 * Separa o que está encostado há mais de `dias`.
 *
 * Conta da última SAÍDA, não da entrada. Material que entrou
 * ontem e nunca saiu é justamente o caso ruim — contar da entrada
 * o esconderia por três meses.
 */
export function acharEstoqueParado(
  materiais: MaterialNaPrateleira[],
  dias = DIAS_PARADO_PADRAO,
  hoje = new Date(),
): { linhas: LinhaDeEstoqueParado[]; resumo: ResumoDoEstoqueParado } {
  const linhas: LinhaDeEstoqueParado[] = [];

  for (const m of materiais) {
    // Saldo zerado não é dinheiro parado, é prateleira vazia.
    if (m.quantidade <= 0) continue;

    const desde = m.ultimaSaida ?? m.primeiraEntrada;

    // Sem nenhuma data não há o que julgar. Acusar de parado o que
    // não se sabe seria pior do que ficar calado.
    if (!desde) continue;

    const diasParado = diasEntre(desde, hoje);
    if (diasParado < dias) continue;

    linhas.push({
      ...m,
      diasParado,
      valorParado: arredondar(m.quantidade * (m.custoMedio ?? 0)),
      motivo: m.ultimaSaida ? 'PAROU' : 'NUNCA_SAIU',
    });
  }

  linhas.sort((a, b) => b.valorParado - a.valorParado || b.diasParado - a.diasParado);

  const valorParado = arredondar(linhas.reduce((s, l) => s + l.valorParado, 0));
  const nuncaSairam = linhas.filter((l) => l.motivo === 'NUNCA_SAIU').length;
  const maisAntigo = linhas.reduce((maior, l) => Math.max(maior, l.diasParado), 0);

  return {
    linhas,
    resumo: {
      valorParado,
      itens: linhas.length,
      nuncaSairam,
      maisAntigo,
      leitura: lerEstoqueParado(linhas.length, valorParado, nuncaSairam, dias),
    },
  };
}

function lerEstoqueParado(
  itens: number,
  valor: number,
  nuncaSairam: number,
  dias: number,
): string {
  if (itens === 0) {
    return 'Nada encostado há mais de ' + dias + ' dias. O estoque está girando.';
  }

  const reais = reaisBr(valor);

  const abertura = itens === 1
    ? 'Um material está parado'
    : itens + ' materiais estão parados';

  const fim = nuncaSairam > 0
    ? ' ' + (nuncaSairam === 1
      ? 'Um deles nunca saiu do almoxarifado desde que chegou.'
      : nuncaSairam + ' deles nunca saíram do almoxarifado desde que chegaram.')
    : '';

  return abertura + ' há mais de ' + dias + ' dias, somando ' + reais +
    ' de dinheiro já pago e ainda sem uso.' + fim;
}
