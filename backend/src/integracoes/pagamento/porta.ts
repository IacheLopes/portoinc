// ============================================================
//  PORTA DE PAGAMENTO
//
//  O fluxo termina com a nota indo para "contas a pagar".
//  Esta porta representa o passo final: mandar a ordem ao banco.
//
//  ATENCAO: pagamento e a area de MAIOR risco do sistema.
//  Por isso o padrao e "registrar", nunca "pagar automaticamente".
//  Uma pessoa sempre confirma antes de sair dinheiro.
// ============================================================

export type SituacaoPagamento = 'registrado' | 'aguardando_aprovacao' | 'pago' | 'recusado';

export interface OrdemPagamento {
  /** Identificador interno, geralmente o id da nota fiscal. */
  referencia: string;
  favorecidoNome: string;
  favorecidoDocumento: string;
  valor: number;
  vencimento: Date;
  descricao: string;
}

export interface ResultadoPagamento {
  situacao: SituacaoPagamento;
  /** Comprovante ou id da remessa, quando houver. */
  comprovante?: string;
  erro?: string;
  adaptador: string;
}

export interface PortaPagamento {
  readonly nome: string;
  disponivel(): boolean;
  /** Registra a ordem. NUNCA executa o pagamento sozinho. */
  registrar(ordem: OrdemPagamento): Promise<ResultadoPagamento>;
}
