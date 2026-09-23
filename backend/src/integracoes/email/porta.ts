// ============================================================
//  PORTA do e-mail
//
//  Contrato: descreve O QUE o sistema precisa, sem dizer COMO.
//  Qualquer adaptador (simulado ou provedor de verdade) cumpre
//  exatamente isto, e o resto do sistema so conhece esta porta.
//
//  O fluxo de compras pede que o pedido saia "por e-mail/WhatsApp".
//  O WhatsApp ja tinha porta propria; esta e a outra metade.
// ============================================================

export interface AnexoEmail {
  nomeArquivo: string;
  conteudo: Buffer;
  tipoMime: string;
}

export interface Email {
  /** Um endereco so. Lista de destinatarios vira uma chamada cada. */
  para: string;
  assunto: string;
  /** Texto puro. Nada de HTML: menos chance de cair em caixa de spam. */
  corpo: string;
  anexos?: AnexoEmail[];
}

export interface ResultadoEmail {
  sucesso: boolean;
  /** Identificador da mensagem no provedor, quando houver. */
  idMensagem?: string;
  erro?: string;
  /** Qual adaptador atendeu. Util para auditoria. */
  adaptador: string;
  enviadoEm: Date;
}

export interface PortaEmail {
  readonly nome: string;
  /**
   * De onde a mensagem sai, para a tela de status poder mostrar.
   * Null quando o adaptador nao esta configurado.
   */
  remetente(): string | null;
  /** O adaptador tem tudo o que precisa para funcionar? */
  pronto(): boolean;
  enviar(email: Email): Promise<ResultadoEmail>;
}
