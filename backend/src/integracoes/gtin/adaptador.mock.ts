// ============================================================
//  ADAPTADOR GTIN SIMULADO (catalogo local)
//
//  Catalogo pequeno para testes, com codigos reais tirados da
//  planilha da Porto Inc. Nao depende de servico pago.
// ============================================================

import type { PortaGtin, ProdutoGtin } from './porta.js';
import { gtinValido } from './porta.js';

const CATALOGO: Record<string, Omit<ProdutoGtin, 'gtin' | 'origem'>> = {
  '7899888400575': { descricao: 'Cimento Portland CP-II 50kg', marca: 'Votoran', unidade: 'SC' },
  '7896193243897': { descricao: 'Argamassa AC-II 20kg',        marca: 'Quartzolit', unidade: 'SC' },
  '7898494150676': { descricao: 'Cal hidratada CH-III 20kg',   marca: 'Itau', unidade: 'SC' },
};

export class AdaptadorGtinMock implements PortaGtin {
  readonly nome = 'mock';

  disponivel(): boolean {
    return true;
  }

  async consultar(gtin: string): Promise<ProdutoGtin | null> {
    const limpo = gtin.replace(/\D/g, '');
    if (!gtinValido(limpo)) return null;

    const achado = CATALOGO[limpo];
    if (!achado) return null;

    return { gtin: limpo, origem: 'catalogo-local', ...achado };
  }
}
