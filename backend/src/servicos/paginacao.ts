// ============================================================
//  Paginação
//
//  TODA LISTA DO SISTEMA CORTAVA NUM NÚMERO FIXO, EM SILÊNCIO.
//
//  As consultas pediam `take: 200` (ou 300, ou 500) e devolviam
//  isso como se fosse tudo. A solicitação de número 201 continuava
//  no banco e não aparecia em tela nenhuma — e a tela ainda dizia
//  "200 solicitações listadas", como se não houvesse mais.
//
//  O defeito não é o limite: é o silêncio. Quem olha conclui que
//  o sistema perdeu a compra antiga. Achado em 30/09/2026, na
//  análise de o que falta para a Porto Inc. usar de verdade.
//
//  Aqui ficam as duas pontas da conta, para as 15 telas fazerem
//  igual: ler o pedido de página e montar a resposta com o TOTAL
//  de verdade junto.
// ============================================================

/**
 * Quantas linhas por página.
 *
 * 20 cabe numa tela de computador sem rolar, e no celular — onde
 * cada linha vira um cartão — dá uma rolagem curta. Mais que isso
 * e a paginação deixa de servir para alguma coisa; menos, e quem
 * trabalha passa o dia clicando.
 */
export const POR_PAGINA = 20;

/** Teto por página. Sem ele, `?porPagina=999999` derruba a API. */
const MAXIMO_POR_PAGINA = 100;

export interface PedidoDePagina {
  pagina: number;
  porPagina: number;
  /** Quantas linhas pular — é o `skip` do banco. */
  pular: number;
}

/**
 * Lê o pedido de página da query, sem confiar em nada.
 *
 * Valor ausente, negativo, zero ou texto vira página 1. Página
 * absurda não quebra: a consulta devolve lista vazia e a tela
 * mostra que não há nada ali.
 */
export function lerPaginacao(q: { pagina?: string; porPagina?: string }): PedidoDePagina {
  const pedida = Number(q.pagina);
  const pagina = Number.isFinite(pedida) && pedida >= 1 ? Math.trunc(pedida) : 1;

  const pedidoDeTamanho = Number(q.porPagina);
  const porPagina = Number.isFinite(pedidoDeTamanho) && pedidoDeTamanho >= 1
    ? Math.min(Math.trunc(pedidoDeTamanho), MAXIMO_POR_PAGINA)
    : POR_PAGINA;

  return { pagina, porPagina, pular: (pagina - 1) * porPagina };
}

export interface Pagina<T> {
  itens: T[];
  /** Quantas existem NO TOTAL, não quantas vieram. */
  total: number;
  pagina: number;
  porPagina: number;
  /** Quantas páginas há. Zero resultados = 1 página vazia. */
  paginas: number;
}

/**
 * Monta a resposta com o total junto.
 *
 * O total é o que conserta a mentira: a tela passa a dizer
 * "mostrando 21 a 40 de 347" em vez de "200 listadas".
 */
export function montarPagina<T>(
  itens: T[],
  total: number,
  pedido: PedidoDePagina,
): Pagina<T> {
  return {
    itens,
    total,
    pagina: pedido.pagina,
    porPagina: pedido.porPagina,
    paginas: Math.max(1, Math.ceil(total / pedido.porPagina)),
  };
}

/**
 * Os números que a barra de páginas mostra, com os buracos.
 *
 * Com 250 páginas, enfileirar 250 botões é inútil e ilegível. A
 * janela mostra as vizinhas da atual e SEMPRE a primeira e a
 * última — a última como NÚMERO, não como seta de "ir ao fim":
 * ver "250" conta o tamanho do conjunto, uma seta não conta nada.
 *
 * O `null` é um buraco, e vira reticência na tela. Ele é
 * informação: diz que existe coisa pulada ali no meio.
 *
 *   1 … 5 6 [7] 8 9 … 250
 *
 * Fica aqui, e não na tela, porque é regra com casos de borda —
 * começo, fim, poucas páginas — e regra assim merece teste.
 */
export function janelaDePaginas(
  atual: number,
  paginas: number,
  vizinhas = 1,
): Array<number | null> {
  // Poucas páginas: mostra todas, sem buraco nenhum.
  const semBuraco = 5 + vizinhas * 2;
  if (paginas <= semBuraco) {
    return Array.from({ length: paginas }, (_, i) => i + 1);
  }

  const primeira = 1;
  const ultima = paginas;

  const inicio = Math.max(primeira + 1, atual - vizinhas);
  const fim = Math.min(ultima - 1, atual + vizinhas);

  const lista: Array<number | null> = [primeira];

  // Buraco só quando ele pula MAIS de uma página: um buraco no
  // lugar de um número só seria trocar "2" por "…", que esconde
  // sem economizar.
  if (inicio > primeira + 1) lista.push(null);

  for (let p = inicio; p <= fim; p++) lista.push(p);

  if (fim < ultima - 1) lista.push(null);

  lista.push(ultima);

  return lista;
}
