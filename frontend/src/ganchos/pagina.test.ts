// ============================================================
//  O gancho de página
//
//  Ele guarda o comportamento de DEZ listas. Um defeito aqui é
//  um defeito em dez telas, então as regras dele têm teste.
//
//  A que mais importa é a do filtro: trocar o filtro volta para
//  a página 1. Sem ela, quem está na página 7 e filtra por
//  "Rascunho" cai numa página 7 que não existe mais, vê a lista
//  vazia e conclui que não há rascunho nenhum.
// ============================================================

import { useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagina } from './pagina';

/** A resposta que o servidor manda junto com as linhas. */
function resposta(total: number, pagina = 1, porPagina = 20) {
  return {
    total,
    pagina,
    porPagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

describe('onde a pessoa está', () => {
  it('começa na página 1, com uma página só', () => {
    const { result } = renderHook(() => usePagina(''));

    expect(result.current.pagina).toBe(1);
    expect(result.current.dados).toEqual({ total: 0, paginas: 1, porPagina: 20 });
    expect(result.current.trocando).toBe(false);
  });

  it('trocar de página avisa que está buscando, até a resposta chegar', () => {
    const { result } = renderHook(() => usePagina(''));

    act(() => result.current.irPara(3));

    expect(result.current.pagina).toBe(3);
    // É isto que esmaece a lista e trava os botões: sem ele, a
    // pessoa clica em "3" e nada na tela diz que algo começou.
    expect(result.current.trocando).toBe(true);

    act(() => result.current.chegou(resposta(68, 3)));

    expect(result.current.trocando).toBe(false);
    expect(result.current.dados).toEqual({ total: 68, paginas: 4, porPagina: 20 });
  });

  it('se a busca falhar, os botões destravam', () => {
    const { result } = renderHook(() => usePagina(''));

    act(() => result.current.irPara(2));
    act(() => result.current.falhou());

    // Travado para sempre seria pior que o erro: a pessoa não
    // conseguiria nem voltar para a página que funcionava.
    expect(result.current.trocando).toBe(false);
  });
});

describe('a âncora da rolagem', () => {
  it('rola até a lista, instantâneo', () => {
    const { result } = renderHook(() => usePagina(''));

    const rolar = vi.fn();
    // @ts-expect-error — basta o método que o gancho chama.
    result.current.topo.current = { scrollIntoView: rolar };

    act(() => result.current.irPara(2));

    expect(rolar).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('sem âncora montada, trocar de página não estoura', () => {
    const { result } = renderHook(() => usePagina(''));

    expect(() => act(() => result.current.irPara(2))).not.toThrow();
    expect(result.current.pagina).toBe(2);
  });
});

describe('trocar o filtro volta para a página 1', () => {
  it('estando na página 7, filtrar leva para a 1', () => {
    const { result, rerender } = renderHook(({ filtro }) => usePagina(filtro), {
      initialProps: { filtro: '' },
    });

    act(() => result.current.irPara(7));
    expect(result.current.pagina).toBe(7);

    rerender({ filtro: 'RASCUNHO' });

    expect(result.current.pagina).toBe(1);
  });

  it('o mesmo filtro de novo não mexe na página', () => {
    const { result, rerender } = renderHook(({ filtro }) => usePagina(filtro), {
      initialProps: { filtro: 'APROVADA' },
    });

    act(() => result.current.irPara(4));
    rerender({ filtro: 'APROVADA' });

    // Repintar por qualquer outro motivo não pode jogar a pessoa
    // de volta para o começo da lista.
    expect(result.current.pagina).toBe(4);
  });

  it('a tela não busca a página velha com o filtro novo', () => {
    // Esta é a razão de o ajuste ser feito durante a pintura, e
    // não num `useEffect`.
    //
    // Num efeito, o efeito que BUSCA a lista roda na mesma passada,
    // ainda com a página 7: uma chamada de rede jogada fora, e logo
    // outra com a página 1 — e, se a primeira responder depois da
    // segunda, a tela mostra a página errada.
    //
    // Então o teste imita quem busca: um efeito que depende do
    // filtro e da página, igual ao das nove telas, anotando o par
    // que cada chamada viu.
    const buscas: Array<string> = [];

    const { result, rerender } = renderHook(
      ({ filtro }) => {
        const pag = usePagina(filtro);

        useEffect(() => {
          buscas.push(filtro + '/' + pag.pagina);
        }, [filtro, pag.pagina]);

        return pag;
      },
      { initialProps: { filtro: '' } },
    );

    act(() => result.current.irPara(7));
    buscas.length = 0;

    act(() => rerender({ filtro: 'PAGA' }));

    // Uma busca só, e já da página 1. A pintura com a página 7
    // acontece — React a descarta antes de rodar efeito nenhum —,
    // mas ninguém sai à rede por causa dela.
    expect(buscas).toEqual(['PAGA/1']);
  });
});
