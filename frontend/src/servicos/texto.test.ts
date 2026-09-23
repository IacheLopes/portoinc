// ============================================================
//  Texto que sai na tela
//
//  Parece detalhe e não é: "1 parcela(s) em atraso" é a frase que
//  faz um sistema parecer inacabado.
// ============================================================

import { describe, it, expect } from 'vitest';
import { plural, contar } from './texto';

describe('plural', () => {
  it('no singular não sai "(s)"', () => {
    expect(plural(1, 'parcela', 'parcelas')).toBe('1 parcela');
  });

  it('no plural concorda', () => {
    expect(plural(3, 'parcela', 'parcelas')).toBe('3 parcelas');
  });

  it('zero vai para o plural, como se fala', () => {
    // "0 parcela" ninguém diz.
    expect(plural(0, 'parcela', 'parcelas')).toBe('0 parcelas');
  });

  it('dá conta do plural irregular, que um "s" no fim não daria', () => {
    expect(plural(2, 'solicitação', 'solicitações')).toBe('2 solicitações');
    expect(plural(1, 'função', 'funções')).toBe('1 função');
  });
});

describe('contar', () => {
  it('troca o zero por uma frase', () => {
    expect(contar(0, 'parcela', 'parcelas', 'Nada em atraso')).toBe('Nada em atraso');
  });

  it('com número, é o plural normal', () => {
    expect(contar(1, 'parcela', 'parcelas', 'Nada em atraso')).toBe('1 parcela');
    expect(contar(4, 'parcela', 'parcelas', 'Nada em atraso')).toBe('4 parcelas');
  });
});
