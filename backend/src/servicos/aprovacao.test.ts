// ============================================================
//  Testes das regras de aprovação
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularEstado, podeDecidir, proximaSituacao, descreverDecisao, nomeDaFuncao,
} from './aprovacao.js';

describe('Estado da aprovação — basta uma assinatura', () => {
  const exigidas = ['GESTOR_OBRA', 'ENGENHEIRO'];

  it('sem assinatura nenhuma, não está completa', () => {
    const e = calcularEstado(exigidas, false, []);

    assert.equal(e.completa, false);
    assert.equal(e.assinaram.length, 0);
    assert.deepEqual(e.faltam, exigidas);
    assert.ok(e.resumo.includes('uma destas funções'));
  });

  it('uma assinatura já completa', () => {
    const e = calcularEstado(exigidas, false, [
      { funcaoCodigo: 'GESTOR_OBRA', decisao: 'APROVADA' },
    ]);

    assert.equal(e.completa, true);
  });
});

describe('Estado da aprovação — todas precisam assinar', () => {
  const exigidas = ['GESTOR_OBRA', 'ENGENHEIRO'];

  it('uma assinatura ainda não basta', () => {
    const e = calcularEstado(exigidas, true, [
      { funcaoCodigo: 'GESTOR_OBRA', decisao: 'APROVADA' },
    ]);

    assert.equal(e.completa, false);
    assert.deepEqual(e.faltam, ['ENGENHEIRO']);
    assert.ok(e.resumo.includes('1 de 2'));
    // O resumo usa o nome de exibição, não o código interno.
    assert.ok(e.resumo.includes('Engenheiro'));
    assert.ok(!e.resumo.includes('ENGENHEIRO'), 'não deve vazar o código cru para a tela');
  });

  it('as duas assinaturas completam', () => {
    const e = calcularEstado(exigidas, true, [
      { funcaoCodigo: 'GESTOR_OBRA', decisao: 'APROVADA' },
      { funcaoCodigo: 'ENGENHEIRO', decisao: 'APROVADA' },
    ]);

    assert.equal(e.completa, true);
    assert.equal(e.faltam.length, 0);
  });

  it('uma reprovação derruba tudo, mesmo com outra aprovação', () => {
    const e = calcularEstado(exigidas, true, [
      { funcaoCodigo: 'GESTOR_OBRA', decisao: 'APROVADA' },
      { funcaoCodigo: 'ENGENHEIRO', decisao: 'REPROVADA' },
    ]);

    assert.equal(e.reprovada, true);
    assert.equal(e.completa, false);
  });
});

describe('Quem pode decidir', () => {
  const base = {
    situacao: 'AGUARDANDO_APROVACAO',
    funcoesDoUsuario: ['GESTOR_OBRA'],
    funcoesExigidas: ['GESTOR_OBRA', 'ENGENHEIRO'],
    jaAssinou: [] as string[],
    ehOAutor: false,
  };

  it('libera quem tem a função exigida', () => {
    const r = podeDecidir(base);

    assert.equal(r.pode, true);
    if (r.pode) assert.deepEqual(r.funcoesDisponiveis, ['GESTOR_OBRA']);
  });

  it('BLOQUEIA o autor de aprovar o próprio pedido', () => {
    const r = podeDecidir({ ...base, ehOAutor: true });

    assert.equal(r.pode, false);
    if (!r.pode) assert.ok(r.motivo.includes('você mesmo abriu'));
  });

  it('bloqueia quem não tem função exigida', () => {
    const r = podeDecidir({ ...base, funcoesDoUsuario: ['ALMOXARIFE'] });

    assert.equal(r.pode, false);
    if (!r.pode) assert.ok(r.motivo.includes('precisa da assinatura'));
  });

  it('bloqueia quem já assinou', () => {
    const r = podeDecidir({ ...base, jaAssinou: ['GESTOR_OBRA'] });

    assert.equal(r.pode, false);
    if (!r.pode) assert.ok(r.motivo.includes('já assinou'));
  });

  it('bloqueia quando não está aguardando aprovação', () => {
    for (const situacao of ['RASCUNHO', 'APROVADA', 'REPROVADA', 'CANCELADA']) {
      const r = podeDecidir({ ...base, situacao });
      assert.equal(r.pode, false, situacao + ' não deveria aceitar decisão');
    }
  });

  it('quem acumula duas funções exigidas pode assinar por ambas', () => {
    const r = podeDecidir({
      ...base,
      funcoesDoUsuario: ['GESTOR_OBRA', 'ENGENHEIRO'],
    });

    assert.equal(r.pode, true);
    if (r.pode) assert.equal(r.funcoesDisponiveis.length, 2);
  });

  it('depois de assinar por uma, ainda pode pela outra', () => {
    const r = podeDecidir({
      ...base,
      funcoesDoUsuario: ['GESTOR_OBRA', 'ENGENHEIRO'],
      jaAssinou: ['GESTOR_OBRA'],
    });

    assert.equal(r.pode, true);
    if (r.pode) assert.deepEqual(r.funcoesDisponiveis, ['ENGENHEIRO']);
  });
});

describe('Para onde a solicitação vai', () => {
  const completo = calcularEstado(['GESTOR_OBRA'], false, [
    { funcaoCodigo: 'GESTOR_OBRA', decisao: 'APROVADA' },
  ]);

  const parcial = calcularEstado(['GESTOR_OBRA', 'ENGENHEIRO'], true, [
    { funcaoCodigo: 'GESTOR_OBRA', decisao: 'APROVADA' },
  ]);

  it('aprovação completa vira APROVADA', () => {
    assert.equal(proximaSituacao('APROVADA', completo), 'APROVADA');
  });

  it('aprovação parcial continua aguardando', () => {
    assert.equal(proximaSituacao('APROVADA', parcial), 'AGUARDANDO_APROVACAO');
  });

  it('reprovação vira REPROVADA na hora', () => {
    assert.equal(proximaSituacao('REPROVADA', parcial), 'REPROVADA');
  });

  it('devolução vira EM_REVISAO', () => {
    assert.equal(proximaSituacao('DEVOLVIDA', parcial), 'EM_REVISAO');
  });
});

describe('Descrição para o histórico', () => {
  const completo = calcularEstado(['GESTOR_OBRA'], false, [
    { funcaoCodigo: 'GESTOR_OBRA', decisao: 'APROVADA' },
  ]);

  const parcial = calcularEstado(['GESTOR_OBRA', 'ENGENHEIRO'], true, [
    { funcaoCodigo: 'GESTOR_OBRA', decisao: 'APROVADA' },
  ]);

  it('aprovação completa avisa que liberou para cotação', () => {
    const texto = descreverDecisao('APROVADA', 'Gestor de obra', null, completo);

    assert.ok(texto.includes('Gestor de obra'));
    assert.ok(texto.includes('liberada para cotação'));
  });

  it('aprovação parcial diz quanto falta', () => {
    const texto = descreverDecisao('APROVADA', 'Gestor de obra', null, parcial);

    assert.ok(texto.includes('1 de 2'));
  });

  it('inclui a observação quando houver', () => {
    const texto = descreverDecisao(
      'DEVOLVIDA', 'Engenheiro', 'Falta a marca do cimento', parcial,
    );

    assert.ok(texto.includes('Devolvida'));
    assert.ok(texto.includes('Falta a marca do cimento'));
  });
});

describe('Nome de exibição das funções', () => {
  it('traduz os códigos do sistema', () => {
    assert.equal(nomeDaFuncao('GESTOR_OBRA'), 'Gestor de obra');
    assert.equal(nomeDaFuncao('ALMOXARIFE'), 'Almoxarife');
    assert.equal(nomeDaFuncao('FUNDADOR'), 'Fundador');
  });

  it('trata com jeito uma função criada pela empresa', () => {
    assert.equal(nomeDaFuncao('MESTRE_DE_OBRAS'), 'Mestre de obras');
  });

  it('nunca devolve o código cru com sublinhado', () => {
    for (const codigo of ['GESTOR_OBRA', 'QUALQUER_COISA_NOVA']) {
      assert.ok(!nomeDaFuncao(codigo).includes('_'));
    }
  });
});
