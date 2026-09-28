// ============================================================
//  O prazo de pagamento vale dinheiro
// ============================================================

import { describe, it, expect } from 'vitest';
import { ganhoDoPrazo, TAXAS_DE_CUSTO_DO_DINHEIRO } from './cotacoes';

describe('Ganho do prazo', () => {
  it('desconta a taxa da empresa sobre o prazo médio', () => {
    // R$ 10.000 em 60 dias, a 1,5% ao mês: dois meses de 1,5%.
    expect(ganhoDoPrazo(10000, 60, 1.5)).toBe(300);
  });

  it('meio mês desconta metade', () => {
    expect(ganhoDoPrazo(10000, 15, 2)).toBe(100);
  });

  it('sem taxa informada não inventa desconto', () => {
    // O padrão é zero justamente para isto: enquanto a empresa não
    // disser quanto custa o dinheiro dela, nenhuma proposta é
    // reescrita pelo sistema.
    expect(ganhoDoPrazo(10000, 60, 0)).toBe(0);
  });

  it('sem prazo calculável não há ganho', () => {
    // Fornecedor que informou parcelas sem dizer o intervalo.
    expect(ganhoDoPrazo(10000, null, 1.5)).toBe(0);
  });

  it('pagamento à vista não rende nada', () => {
    expect(ganhoDoPrazo(10000, 0, 1.5)).toBe(0);
  });

  it('sem total não há o que descontar', () => {
    // Fornecedor que não cotou o pacote inteiro.
    expect(ganhoDoPrazo(null, 60, 1.5)).toBe(0);
  });

  it('arredonda em centavos', () => {
    expect(ganhoDoPrazo(1234.56, 45, 1.3)).toBe(24.07);
  });

  it('a primeira faixa é "não considerar"', () => {
    expect(TAXAS_DE_CUSTO_DO_DINHEIRO[0]).toBe(0);
  });
});
