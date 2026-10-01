// ============================================================
//  Testes da paginação
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { lerPaginacao, montarPagina, janelaDePaginas, POR_PAGINA } from './paginacao.js';

describe('Ler o pedido de página', () => {
  it('sem nada pedido, é a página 1', () => {
    const p = lerPaginacao({});
    assert.equal(p.pagina, 1);
    assert.equal(p.porPagina, POR_PAGINA);
    assert.equal(p.pular, 0);
  });

  it('a página 3 pula as duas primeiras', () => {
    const p = lerPaginacao({ pagina: '3' });
    assert.equal(p.pular, POR_PAGINA * 2);
  });

  it('lixo na query não quebra nada', () => {
    for (const entrada of ['abacaxi', '-5', '0', '', 'NaN']) {
      assert.equal(lerPaginacao({ pagina: entrada }).pagina, 1, 'pagina=' + entrada);
    }
  });

  it('recusa página gigante para não derrubar a API', () => {
    // Sem teto, `?porPagina=999999` mandaria o banco montar a
    // tabela inteira na memória de um container de 1 GB.
    assert.equal(lerPaginacao({ porPagina: '999999' }).porPagina, 100);
  });
});

describe('Montar a resposta', () => {
  it('leva o TOTAL junto, não só o que coube', () => {
    // É este número que conserta a mentira: a tela dizia "200
    // listadas" quando havia 347.
    const r = montarPagina([1, 2, 3], 347, lerPaginacao({ pagina: '2' }));

    assert.equal(r.total, 347);
    assert.equal(r.paginas, 18);
    assert.equal(r.pagina, 2);
  });

  it('lista vazia ainda é uma página', () => {
    const r = montarPagina([], 0, lerPaginacao({}));
    assert.equal(r.paginas, 1, 'zero páginas deixaria a barra sem nada para mostrar');
  });

  it('conta exata não cria página sobrando', () => {
    assert.equal(montarPagina([], 40, lerPaginacao({})).paginas, 2);
    assert.equal(montarPagina([], 41, lerPaginacao({})).paginas, 3);
  });
});

describe('A janela de números', () => {
  it('com poucas páginas, mostra todas', () => {
    assert.deepEqual(janelaDePaginas(1, 5), [1, 2, 3, 4, 5]);
  });

  it('no meio de muitas, abre buraco dos dois lados', () => {
    assert.deepEqual(janelaDePaginas(7, 250), [1, null, 6, 7, 8, null, 250]);
  });

  it('a última SEMPRE aparece como número', () => {
    // Ver "250" diz o tamanho do conjunto. Uma seta de "ir ao
    // fim" não diria nada.
    const j = janelaDePaginas(2, 250);
    assert.equal(j[j.length - 1], 250);
  });

  it('no começo não abre buraco à esquerda', () => {
    assert.deepEqual(janelaDePaginas(1, 250), [1, 2, null, 250]);
  });

  it('no fim não abre buraco à direita', () => {
    assert.deepEqual(janelaDePaginas(250, 250), [1, null, 249, 250]);
  });

  it('não troca UM número por reticência', () => {
    // Buraco que pula uma página só esconde sem economizar.
    const j = janelaDePaginas(3, 8);
    assert.ok(!j.includes(null) || j.indexOf(null) > 1);
  });

  it('página única não vira barra vazia', () => {
    assert.deepEqual(janelaDePaginas(1, 1), [1]);
  });
});
