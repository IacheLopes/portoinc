// ============================================================
//  PORTA do WhatsApp
//
//  Isto e um "contrato": descreve O QUE o sistema precisa,
//  sem dizer COMO sera feito. Qualquer adaptador (mock, Baileys
//  ou API oficial) precisa cumprir exatamente este contrato.
//
//  O resto do sistema SO conhece esta porta. Por isso trocar de
//  provedor nao quebra nada.
// ============================================================

export interface MensagemWhatsApp {
  /** Telefone no formato internacional. Ex: 5511999998888 */
  para: string;
  texto: string;
  anexo?: {
    nomeArquivo: string;
    conteudo: Buffer;
    tipoMime: string;
  };
}

export interface ResultadoEnvio {
  sucesso: boolean;
  /** Identificador da mensagem no provedor, quando houver. */
  idMensagem?: string;
  erro?: string;
  /** Qual adaptador atendeu. Util para auditoria. */
  adaptador: string;
  enviadoEm: Date;
}

/**
 * Os estados por que a conexao passa.
 *
 * Os nomes vieram do que o Baileys realmente informa. Mesmo os
 * adaptadores que nao usam QR respeitam a lista, para a tela ser
 * a mesma independente do provedor.
 */
export type EstadoConexao =
  | 'desconectado'
  | 'iniciando'
  | 'qr_pronto'
  | 'aguardando_leitura'
  | 'autenticando'
  | 'conectado'
  | 'reconectando'
  | 'deslogado'
  | 'erro';

export interface SituacaoWhatsApp {
  estado: EstadoConexao;
  /** Numero conectado, sempre MASCARADO. Nunca o numero inteiro. */
  numero: string | null;
  /** Ha um QR esperando leitura? */
  temQr: boolean;
  /** Desde quando esta neste estado. */
  desde: Date | null;
  /** Explicacao em portugues do que esta acontecendo. */
  detalhe: string | null;
}

export interface PortaWhatsApp {
  readonly nome: string;
  conectar(): Promise<void>;
  desconectar(): Promise<void>;
  estado(): EstadoConexao;
  situacao(): SituacaoWhatsApp;
  /**
   * PNG do QR para escanear, ou null quando nao ha QR.
   *
   * O QR e uma CREDENCIAL temporaria: fica so na memoria, nunca
   * em log nem em disco.
   */
  qrPng(): Promise<Buffer | null>;
  enviar(mensagem: MensagemWhatsApp): Promise<ResultadoEnvio>;

  /**
   * Retoma sozinho uma sessao JA autorizada, se houver uma.
   *
   * Chamado quando a API sobe. Existe por um motivo bem concreto:
   * toda atualizacao do sistema em producao reinicia a API, e com
   * ela a conexao do WhatsApp caia — ficando no chao ate alguem
   * lembrar de abrir a tela e clicar em Conectar. Ninguem lembra.
   *
   * REGRA: so retoma o que JA foi autorizado. Se nao houver sessao
   * salva, nao faz nada — em especial, nao gera QR. QR que nasce
   * sozinho num servidor e um convite aberto esperando leitor.
   *
   * Opcional de proposito: adaptador que nao tem sessao para
   * retomar (o simulado, a API oficial) simplesmente nao
   * implementa.
   */
  retomarSessao?(): Promise<void>;
}
