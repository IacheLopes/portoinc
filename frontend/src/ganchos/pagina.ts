import { useRef, useState } from 'react';
import type { DadosDaPagina } from '../servicos/paginacao';

// ============================================================
//  O estado de "em que página eu estou"
//
//  Dez listas do sistema paginam. A primeira — Solicitações —
//  carregava à mão seis pedaços de estado: a página atual, o
//  "estou trocando agora", o total que veio do servidor, a
//  âncora para rolar, o reset ao filtrar e a função de trocar.
//
//  Repetir isso dez vezes não daria dez telas iguais: daria dez
//  telas PARECIDAS. Uma esqueceria de rolar, outra de voltar
//  para a página 1 ao filtrar, uma terceira esmaeceria a lista
//  sem travar os botões — e cada diferença dessas é um chamado
//  do tipo "nessa tela a paginação é esquisita".
//
//  Então o comportamento mora aqui, uma vez.
// ============================================================

/**
 * O que a tela recebe de volta.
 *
 * `T` e o elemento que vai segurar a ancora da rolagem. Quase
 * sempre e a <section> da lista, que e o padrao; em Locacao a
 * lista nao mora numa secao propria e a ancora vai num <div>.
 */
export interface EstadoDaPagina<T extends HTMLElement = HTMLElement> {
  /** A página pedida. Vai na chamada da API. */
  pagina: number;
  /**
   * Buscando a página nova?
   *
   * Diferente de "carregando": aquele vale na primeira vez,
   * quando ainda não há nada em tela. Este vale quando JÁ há
   * lista e ela está sendo trocada — é o que esmaece as linhas
   * velhas e trava os botões, em vez de apagar tudo.
   */
  trocando: boolean;
  /** O que o servidor contou: o total de verdade. */
  dados: { total: number; paginas: number; porPagina: number };
  /** Põe em volta da lista, para a rolagem ter onde parar. */
  topo: React.RefObject<T | null>;
  /** Vai para a página, rolando até a lista. */
  irPara: (pagina: number) => void;
  /** Chame quando a resposta chegar, com o corpo da resposta. */
  chegou: (resposta: DadosDaPagina) => void;
  /** Chame quando a busca falhar, para destravar os botões. */
  falhou: () => void;
}

/**
 * @param chaveDoFiltro  Os filtros da tela juntos num texto — por
 *   exemplo `situacao + '|' + obraId`. Quando ele muda, a página
 *   volta para a 1.
 *
 *   É texto, e não uma lista de dependências, porque lista
 *   espalhada em `useEffect` o lint não consegue conferir — e
 *   dependência que o lint não confere é dependência que um dia
 *   falta.
 */
export function usePagina<T extends HTMLElement = HTMLElement>(
  chaveDoFiltro: string,
): EstadoDaPagina<T> {
  const [pagina, setPagina] = useState(1);
  const [trocando, setTrocando] = useState(false);
  const [dados, setDados] = useState({ total: 0, paginas: 1, porPagina: 20 });

  const topo = useRef<T>(null);

  // Trocar o filtro volta para a página 1.
  //
  // Sem isto, quem está na página 7 e filtra por "Rascunho" cai
  // numa página 7 que não existe mais, vê a lista vazia e conclui
  // que não há rascunho nenhum.
  //
  // O ajuste é feito DURANTE a pintura, não num `useEffect`, e a
  // diferença é uma chamada de rede. Num efeito, o efeito que
  // busca a lista roda na mesma passada, ainda com a página 7:
  // uma busca jogada fora, e logo outra com a página 1. React
  // descarta esta pintura e repinta antes de rodar efeito nenhum,
  // então quem busca já nasce sabendo que a página é 1.
  const [filtroAnterior, setFiltroAnterior] = useState(chaveDoFiltro);

  if (chaveDoFiltro !== filtroAnterior) {
    setFiltroAnterior(chaveDoFiltro);
    setPagina(1);
  }

  function irPara(nova: number) {
    setTrocando(true);
    setPagina(nova);

    // Rolagem INSTANTÂNEA, não suave.
    //
    // Com a tabela cheia, a distância até o topo passa de mil
    // pixels, e a rolagem suave faz a pessoa assistir à lista
    // inteira voar — o que desorienta em vez de orientar. Isso
    // apareceu numa foto tirada no meio da animação.
    //
    // Instantâneo é mais seco e mais honesto: você clica e está
    // lá. Quem confirma que a lista mudou é o fade das linhas
    // novas e o contador logo acima delas.
    //
    // Rola até o topo da LISTA, não da página: o cabeçalho e os
    // filtros saírem de vista tirariam o contexto de onde está.
    topo.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  function chegou(resposta: DadosDaPagina) {
    setDados({
      total: resposta.total,
      paginas: resposta.paginas,
      porPagina: resposta.porPagina,
    });
    setTrocando(false);
  }

  function falhou() {
    setTrocando(false);
  }

  return { pagina, trocando, dados, topo, irPara, chegou, falhou };
}
