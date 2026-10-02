// ============================================================
//  A janela de números da barra de páginas
//
//  Mesma regra do backend (`servicos/paginacao.ts` de lá). Está
//  nos dois lados porque a barra desenha sozinha, sem perguntar
//  ao servidor quais números mostrar — e uma volta de rede para
//  decidir isso seria absurdo.
//
//  Os dois têm o MESMO teste, com os mesmos casos. Se um dia
//  divergirem, o teste grita.
// ============================================================

/**
 * O que toda lista paginada devolve junto com os itens.
 *
 * Mora aqui porque são dez listas, em nove serviços diferentes.
 * Enquanto era uma só, a interface ficava junto da sua tela; dez
 * cópias do mesmo quarteto divergiriam no dia em que a resposta
 * ganhasse um campo.
 */
export interface DadosDaPagina {
  /** Quantas existem NO TOTAL, não quantas vieram. */
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
}

/**
 * Os números que a barra mostra, com os buracos.
 *
 * Com 250 páginas, enfileirar 250 botões é inútil. A janela
 * mostra as vizinhas da atual e SEMPRE a primeira e a última.
 *
 * O `null` é um buraco, e vira reticência na tela — ele é
 * informação: diz que existe coisa pulada ali no meio.
 *
 *   1 … 5 6 [7] 8 9 … 250
 */
export function janelaDePaginas(
  atual: number,
  paginas: number,
  vizinhas = 1,
): Array<number | null> {
  const semBuraco = 5 + vizinhas * 2;
  if (paginas <= semBuraco) {
    return Array.from({ length: paginas }, (_, i) => i + 1);
  }

  const primeira = 1;
  const ultima = paginas;

  const inicio = Math.max(primeira + 1, atual - vizinhas);
  const fim = Math.min(ultima - 1, atual + vizinhas);

  const lista: Array<number | null> = [primeira];

  // Buraco só quando pula MAIS de uma página: trocar "2" por "…"
  // esconde sem economizar.
  if (inicio > primeira + 1) lista.push(null);

  for (let p = inicio; p <= fim; p++) lista.push(p);

  if (fim < ultima - 1) lista.push(null);

  lista.push(ultima);

  return lista;
}
