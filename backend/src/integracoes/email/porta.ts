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
  /** Texto puro. E a versao que vale: toda mensagem tem esta. */
  corpo: string;
  /**
   * A MESMA mensagem em HTML, quando houver.
   *
   * Aqui estava escrito "nada de HTML: menos chance de cair em
   * caixa de spam", e era CRENCA ERRADA — do tipo que custa caro,
   * porque soa prudente. Mensagem so-texto e minoria no mundo
   * real, e filtro de spam pontua o que e incomum: um e-mail
   * transacional sem parte HTML parece script, nao parece empresa.
   *
   * O certo e `multipart/alternative`: as duas versoes juntas, e
   * cada programa de e-mail escolhe a que sabe mostrar. Quem le em
   * texto puro continua lendo igual.
   *
   * Descoberto em 15/10/2026, quando o e-mail de teste caiu na
   * caixa de spam dele.
   */
  corpoHtml?: string;
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
