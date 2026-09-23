// ============================================================
//  PORTA FISCAL (Nota Fiscal Eletronica / SEFAZ)
//
//  Contrato do que o sistema precisa da nota fiscal, sem dizer
//  de onde ela vem. Hoje vem de um simulador; amanha vira do
//  SEFAZ, e nada no resto do sistema muda.
// ============================================================

export interface ItemNotaFiscal {
  numero: number;
  codigo: string;
  descricao: string;
  /** Codigo de barras do produto, quando informado na nota. */
  gtin?: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface NotaFiscal {
  /** Chave de acesso de 44 digitos. */
  chave: string;
  numero: string;
  serie: string;
  cnpjEmitente: string;
  nomeEmitente: string;
  dataEmissao: Date;
  valorTotal: number;
  itens: ItemNotaFiscal[];
  /** XML original, quando disponivel. Guardado para auditoria. */
  xml?: string;
}

export interface PortaFiscal {
  readonly nome: string;
  disponivel(): boolean;
  /** Busca uma nota especifica pela chave de 44 digitos. */
  consultarPorChave(chave: string): Promise<NotaFiscal | null>;
  /** Lista notas emitidas CONTRA o CNPJ da Porto Inc. desde uma data. */
  listarNotasRecebidas(desde: Date): Promise<NotaFiscal[]>;
}
