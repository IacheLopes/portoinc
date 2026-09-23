// ============================================================
//  ADAPTADOR FISCAL SIMULADO
//
//  Devolve notas ficticias para o time conseguir testar o
//  recebimento sem precisar de certificado digital.
// ============================================================

import type { PortaFiscal, NotaFiscal } from './porta.js';

const NOTA_EXEMPLO: NotaFiscal = {
  chave: '35250912345678000199550010000001241000001242',
  numero: '124',
  serie: '1',
  cnpjEmitente: '12.345.678/0001-99',
  nomeEmitente: 'Marquilip Comercio e Representacao Ltda',
  dataEmissao: new Date('2025-09-25T10:00:00Z'),
  valorTotal: 334.0,
  itens: [
    {
      numero: 1,
      codigo: 'CIM-50',
      descricao: 'Cimento Portland CP-II 50kg',
      gtin: '7899888400575',
      unidade: 'SC',
      quantidade: 10,
      valorUnitario: 33.4,
      valorTotal: 334.0,
    },
  ],
};

export class AdaptadorFiscalMock implements PortaFiscal {
  readonly nome = 'mock';

  disponivel(): boolean {
    return true;
  }

  async consultarPorChave(chave: string): Promise<NotaFiscal | null> {
    if (chave.replace(/\D/g, '').length !== 44) return null;
    return { ...NOTA_EXEMPLO, chave };
  }

  async listarNotasRecebidas(_desde: Date): Promise<NotaFiscal[]> {
    return [NOTA_EXEMPLO];
  }
}
