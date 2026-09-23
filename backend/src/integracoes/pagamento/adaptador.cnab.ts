// ============================================================
//  ADAPTADOR CNAB - AGUARDANDO DEFINICAO DO BANCO
//
//  Caminho recomendado antes da API bancaria: gerar um arquivo
//  de remessa CNAB 240 que o financeiro sobe no internet banking.
//
//  Vantagem: nao exige contrato de API nem homologacao, e o
//  pagamento continua passando pela conferencia de uma pessoa.
//
//  Para ativar:
//    1. Descobrir o layout do banco da Porto Inc.
//    2. No .env: PAGAMENTO_ADAPTER=cnab
// ============================================================

import type { PortaPagamento, OrdemPagamento, ResultadoPagamento } from './porta.js';

export class AdaptadorPagamentoCnab implements PortaPagamento {
  readonly nome = 'cnab';

  constructor(private readonly codigoBanco: string) {}

  disponivel(): boolean {
    return Boolean(this.codigoBanco);
  }

  async registrar(_ordem: OrdemPagamento): Promise<ResultadoPagamento> {
    throw new Error('Geracao de CNAB ainda nao ativada: falta definir o banco e o layout.');
  }
}
