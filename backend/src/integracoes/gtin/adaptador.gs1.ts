// ============================================================
//  ADAPTADOR GS1 - AGUARDANDO CONTRATO
//
//  Estrutura pronta. Para ativar:
//    1. Associacao da Porto Inc. a GS1 Brasil (servico pago)
//    2. No .env:  GS1_TOKEN=...
//    3. No .env:  GTIN_ADAPTER=gs1
//
//  Enquanto nao houver contrato, o catalogo proprio alimentado
//  pelo proprio bipe atende bem e custa zero.
// ============================================================

import type { PortaGtin, ProdutoGtin } from './porta.js';

export class AdaptadorGtinGs1 implements PortaGtin {
  readonly nome = 'gs1';

  constructor(private readonly token: string) {}

  disponivel(): boolean {
    return Boolean(this.token);
  }

  async consultar(_gtin: string): Promise<ProdutoGtin | null> {
    throw new Error('Integracao com a GS1 ainda nao ativada: falta o contrato/token.');
  }
}
