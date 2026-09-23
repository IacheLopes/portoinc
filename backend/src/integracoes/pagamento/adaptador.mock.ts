// ============================================================
//  ADAPTADOR DE PAGAMENTO SIMULADO
//
//  Apenas registra a ordem como "aguardando aprovacao".
//  Nenhum centavo se move. Seguro para testes.
// ============================================================

import type { PortaPagamento, OrdemPagamento, ResultadoPagamento } from './porta.js';

export class AdaptadorPagamentoMock implements PortaPagamento {
  readonly nome = 'mock';

  disponivel(): boolean {
    return true;
  }

  async registrar(ordem: OrdemPagamento): Promise<ResultadoPagamento> {
    return {
      situacao: 'aguardando_aprovacao',
      comprovante: 'simulado-' + ordem.referencia,
      adaptador: this.nome,
    };
  }
}
