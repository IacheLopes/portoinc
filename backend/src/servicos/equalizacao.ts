// ============================================================
//  Equalização: comparar as cotações lado a lado
//
//  Responde a pergunta do comprador: "quem deu o melhor preço
//  em cada item, e quanto eu economizo escolhendo item a item
//  em vez de fechar tudo com um fornecedor só?"
// ============================================================

import { dataBr } from './data-br.js';
import { plural, quantidadeBr } from './util.js';

export interface RespostaDeFornecedor {
  bidFornecedorId: string;
  fornecedorNome: string;
  disponivel: boolean;
  valorUnitario: number | null;
  marca: string | null;
  modelo: string | null;
  prazoEntregaDias: number | null;
  observacao: string | null;
}

export interface ItemParaComparar {
  bidItemId: string;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  quantidade: number;
  respostas: RespostaDeFornecedor[];
}

export interface LinhaComparativa {
  bidItemId: string;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  quantidade: number;
  /** Quem deu o menor preço. Nulo quando ninguém cotou. */
  melhorFornecedorId: string | null;
  melhorValorUnitario: number | null;
  melhorTotal: number | null;
  /** Diferença entre o pior e o melhor preço, em reais. */
  amplitude: number | null;
  respostas: Array<
    RespostaDeFornecedor & {
      total: number | null;
      ehMelhor: boolean;
      /** Quanto por cento acima do melhor preço. */
      acimaEmPorcento: number | null;
    }
  >;
}

export interface ResumoFornecedor {
  bidFornecedorId: string;
  fornecedorNome: string;
  /** Total se fechasse TUDO com este fornecedor. */
  totalSeFecharTudo: number | null;
  /** Só é possível fechar tudo se ele cotou todos os itens. */
  cotouTudo: boolean;
  itensCotados: number;
  itensIndisponiveis: number;
  /**
   * Em quantos itens ele deu o melhor preço.
   *
   * Havendo empate, conta para TODOS os empatados — a pergunta é
   * sobre preço, não sobre quem leva o item.
   */
  itensVencidos: number;
  /** Itens em que ele está cobrando MAIS que o melhor preço. */
  itensAtras: string[];
  frete: number;
  outrosCustos: number;
}

export interface Comparativo {
  linhas: LinhaComparativa[];
  fornecedores: ResumoFornecedor[];
  /** Melhor preço item a item, JÁ com o frete de cada vencedor. */
  melhorCombinacao: number;
  /** Só a soma dos itens, sem frete. */
  somaDosItens: number;
  /** Frete somado de todos os fornecedores vencedores. */
  freteDaCombinacao: number;
  /** Quantos fornecedores diferentes venceriam. */
  fornecedoresVencedores: number;
  /** Menor total fechando tudo com um fornecedor só. */
  melhorFornecedorUnico: { nome: string; total: number } | null;
  /** Quanto se ganha escolhendo item a item. */
  economiaAoMisturar: number;
  itensSemCotacao: number;
}

/** Monta o mapa comparativo. */
export function montarComparativo(
  itens: ItemParaComparar[],
  custosPorFornecedor: Record<string, { frete: number; outros: number }>,
): Comparativo {
  const linhas: LinhaComparativa[] = itens.map((item) => {
    const validas = item.respostas.filter(
      (r) => r.disponivel && r.valorUnitario !== null && r.valorUnitario > 0,
    );

    const melhorValor = validas.length
      ? Math.min(...validas.map((r) => r.valorUnitario as number))
      : null;

    const piorValor = validas.length
      ? Math.max(...validas.map((r) => r.valorUnitario as number))
      : null;

    // Havendo empate, vence quem entrega mais rápido.
    const melhor = validas
      .filter((r) => r.valorUnitario === melhorValor)
      .sort((a, b) => (a.prazoEntregaDias ?? 999) - (b.prazoEntregaDias ?? 999))[0];

    return {
      bidItemId: item.bidItemId,
      codigo: item.codigo,
      descricao: item.descricao,
      unidadeMedida: item.unidadeMedida,
      quantidade: item.quantidade,
      melhorFornecedorId: melhor?.bidFornecedorId ?? null,
      melhorValorUnitario: melhorValor,
      melhorTotal: melhorValor === null ? null : melhorValor * item.quantidade,
      amplitude:
        melhorValor === null || piorValor === null
          ? null
          : (piorValor - melhorValor) * item.quantidade,
      respostas: item.respostas.map((r) => ({
        ...r,
        total:
          r.disponivel && r.valorUnitario !== null
            ? r.valorUnitario * item.quantidade
            : null,
        //  ESTAR NO MELHOR PRECO NAO E TER GANHO O DESEMPATE.
        //
        //  Isto era `r.bidFornecedorId === melhor?.bidFornecedorId`,
        //  e misturava duas perguntas diferentes:
        //
        //    1. Quem LEVA este item?        -> um so, desempate por prazo
        //    2. Quem esta no MELHOR PRECO?  -> todos que empataram nele
        //
        //  Medido em 10/10/2026, no BID-00005: Ferragens e Eletro
        //  Minas cotaram exatamente o mesmo preco nos tres itens.
        //  O desempate deu a Eletro Minas — e a Ferragens, com o
        //  preco identico, apareceu "atras em 3", igual a Cimenteira,
        //  que estava 87% mais cara.
        //
        //  O estrago nao era so na tela: `itensAtras` alimenta a
        //  ULTIMA CHAMADA, e ela sairia dizendo a Ferragens
        //  "recebemos propostas melhores nestes itens" — pedindo que
        //  ela baixasse um preco que ja era o mais barato, com uma
        //  justificativa falsa.
        //
        //  `melhorFornecedorId` continua sendo o desempate: e ele que
        //  o botao "Aceitar todos os melhores precos" usa. Quem de
        //  fato leva cada item e o comprador, clicando.
        ehMelhor: r.disponivel && r.valorUnitario !== null && r.valorUnitario === melhorValor,
        acimaEmPorcento:
          r.disponivel && r.valorUnitario !== null && melhorValor !== null && melhorValor > 0
            ? Math.round(((r.valorUnitario - melhorValor) / melhorValor) * 1000) / 10
            : null,
      })),
    };
  });

  // ---------- Resumo por fornecedor ----------
  const idsFornecedores = [
    ...new Map(
      itens
        .flatMap((i) => i.respostas)
        .map((r) => [r.bidFornecedorId, r.fornecedorNome]),
    ).entries(),
  ];

  const fornecedores: ResumoFornecedor[] = idsFornecedores.map(([id, nome]) => {
    const custos = custosPorFornecedor[id] ?? { frete: 0, outros: 0 };

    let soma = 0;
    let cotados = 0;
    let indisponiveis = 0;
    let vencidos = 0;
    const atras: string[] = [];

    for (const linha of linhas) {
      const r = linha.respostas.find((x) => x.bidFornecedorId === id);

      if (!r) continue;

      if (!r.disponivel || r.valorUnitario === null) {
        indisponiveis++;
        continue;
      }

      cotados++;
      soma += r.valorUnitario * linha.quantidade;

      if (r.ehMelhor) vencidos++;
      else if (linha.melhorFornecedorId) atras.push(linha.bidItemId);
    }

    const cotouTudo = cotados === linhas.length;

    return {
      bidFornecedorId: id,
      fornecedorNome: nome,
      totalSeFecharTudo: cotouTudo ? soma + custos.frete + custos.outros : null,
      cotouTudo,
      itensCotados: cotados,
      itensIndisponiveis: indisponiveis,
      itensVencidos: vencidos,
      itensAtras: atras,
      frete: custos.frete,
      outrosCustos: custos.outros,
    };
  });

  // Somar só os melhores preços daria uma comparação injusta:
  // escolhendo item a item você paga o frete de CADA fornecedor
  // vencedor, enquanto fechando com um só paga um frete apenas.
  const somaDosItens = linhas.reduce((s, l) => s + (l.melhorTotal ?? 0), 0);

  const vencedoresDistintos = [
    ...new Set(linhas.map((l) => l.melhorFornecedorId).filter((x): x is string => x !== null)),
  ];

  const freteDaCombinacao = vencedoresDistintos.reduce(
    (s, id) => s + (custosPorFornecedor[id]?.frete ?? 0) + (custosPorFornecedor[id]?.outros ?? 0),
    0,
  );

  const melhorCombinacao = somaDosItens + freteDaCombinacao;

  const completos = fornecedores.filter(
    (f): f is ResumoFornecedor & { totalSeFecharTudo: number } =>
      f.totalSeFecharTudo !== null,
  );

  const melhorUnico = completos.length
    ? completos.reduce((a, b) => (b.totalSeFecharTudo < a.totalSeFecharTudo ? b : a))
    : null;

  return {
    linhas,
    fornecedores: fornecedores.sort((a, b) => b.itensVencidos - a.itensVencidos),
    melhorCombinacao,
    somaDosItens,
    freteDaCombinacao,
    fornecedoresVencedores: vencedoresDistintos.length,
    melhorFornecedorUnico: melhorUnico
      ? { nome: melhorUnico.fornecedorNome, total: melhorUnico.totalSeFecharTudo }
      : null,
    economiaAoMisturar: melhorUnico
      ? Math.max(0, melhorUnico.totalSeFecharTudo - melhorCombinacao)
      : 0,
    itensSemCotacao: linhas.filter((l) => l.melhorFornecedorId === null).length,
  };
}

/** Um item em que o fornecedor não está na frente. */
export interface ItemAtras {
  codigo: string;
  descricao: string;
  /** A QUANTIDADE É O QUE DIFERENCIA DUAS LINHAS DO MESMO MATERIAL. */
  quantidade: number;
  unidadeMedida: string;
}

/**
 * Mensagem da última chamada.
 *
 * REGRA DE NEGÓCIO IMPORTANTE: nunca revelamos o preço do
 * concorrente. Dizer "o fulano está R$ 2 mais barato" ensina o
 * mercado a se alinhar, e a Porto Inc. paga mais caro no médio
 * prazo — além do risco jurídico.
 *
 * Dizemos apenas EM QUAIS ITENS ele não está na frente.
 *
 * ------------------------------------------------------------
 *  DOIS DEFEITOS CORRIGIDOS EM 10/10/2026, antes do primeiro
 *  envio de verdade — achados lendo o código, não testando:
 *
 *  1. A LISTA SAÍA COM LINHAS IDÊNTICAS. Ela levava só código e
 *     descrição, e um pacote agrupa solicitações de obras
 *     diferentes: no BID-00005 o mesmo cabo apareceu três vezes,
 *     em 20, 100 e 400 rolos. O fornecedor receberia a mesma
 *     linha três vezes, sem saber qual rever — e isso parece
 *     sistema quebrado. A quantidade é o que as separa.
 *
 *  2. ABRIA COM CÓDIGO. "Porto Inc. — BID-00005 · ÚLTIMA
 *     CHAMADA" é a mesma cara de sistema que saiu do convite no
 *     mesmo dia. Quem recebe é um vendedor, e o número do pacote
 *     ele nunca viu: o convite não o manda. Some daqui também.
 * ------------------------------------------------------------
 */
export function mensagemUltimaChamada(dados: {
  titulo: string;
  itensAtras: ItemAtras[];
  novoPrazo: Date;
  link: string;
  /** Para quem está indo. Sem isto a mensagem abre sem saudação. */
  fornecedor?: string;
  /** O recado que o comprador digitou na tela, se digitou. */
  recado?: string | null;
}): string {
  const abertura = dados.fornecedor ? 'Olá, ' + dados.fornecedor + '!' : 'Olá!';
  const prazo = 'Novo prazo: ' + dataBr(dados.novoPrazo) + '.';
  const recado = dados.recado?.trim() ? [dados.recado.trim(), ''] : [];

  //  O LINK FICA NO TEXTO, mesmo havendo cartão de prévia em
  //  cima: quem desligou prévia de link, quem está em economia
  //  de dados ou numa versão antiga recebe a mensagem sem ele.
  //  O porquê inteiro está em `servicos/whatsapp.ts`.
  const fim = ['', dados.link];

  if (dados.itensAtras.length === 0) {
    return [
      abertura,
      '',
      'A Porto Inc. reabriu o prazo desta cotação.',
      dados.titulo,
      '',
      'Sua proposta está com o melhor preço em todos os itens.',
      ...recado,
      'Se quiser revisar algo, toque no cartão acima.',
      prazo,
      ...fim,
    ].join('\n');
  }

  const lista = dados.itensAtras
    .slice(0, 10)
    .map(
      (i) =>
        '- ' + i.codigo + ' ' + i.descricao +
        ' (' + quantidadeBr(i.quantidade) + ' ' + i.unidadeMedida + ')',
    );

  if (dados.itensAtras.length > 10) {
    lista.push('(e mais ' + plural(dados.itensAtras.length - 10, 'item', 'itens') + ')');
  }

  return [
    abertura,
    '',
    'ÚLTIMA CHAMADA — a Porto Inc. reabriu o prazo.',
    dados.titulo,
    '',
    'Recebemos propostas melhores nestes itens:',
    ...lista,
    '',
    ...recado,
    'Toque no cartão acima para rever seu preço.',
    prazo,
    ...fim,
  ].join('\n');
}

export interface EscolhaPendente {
  bidItemId: string;
  descricao: string;
}

/** Impedimentos para gerar os pedidos de compra. */
export function conferirEscolhas(
  itens: Array<{ bidItemId: string; descricao: string; escolhido: boolean; temCotacao: boolean }>,
): string[] {
  const problemas: string[] = [];

  const semEscolha = itens.filter((i) => !i.escolhido && i.temCotacao);
  const semCotacao = itens.filter((i) => !i.temCotacao);

  if (itens.length === 0) {
    problemas.push('Este pacote não tem itens.');
    return problemas;
  }

  if (semEscolha.length > 0) {
    problemas.push(
      plural(semEscolha.length, 'item', 'itens') +
      ' ainda sem fornecedor escolhido: ' +
      semEscolha.slice(0, 5).map((i) => i.descricao).join(', ') +
      (semEscolha.length > 5 ? '...' : ''),
    );
  }

  if (semCotacao.length > 0) {
    problemas.push(
      plural(
        semCotacao.length,
        'item não recebeu',
        'itens não receberam',
      ) + ' nenhuma cotação. ' +
      'Considere uma última chamada ou remova-os do pacote.',
    );
  }

  return problemas;
}

/** Número legível: 9 vira PC-00009. */
export function formatarNumeroPedido(numero: number): string {
  return 'PC-' + String(numero).padStart(5, '0');
}
