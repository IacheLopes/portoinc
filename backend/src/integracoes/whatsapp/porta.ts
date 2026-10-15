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

/** Uma mensagem que CHEGOU. */
export interface MensagemRecebida {
  /**
   * Numero de QUEM FALOU, so digitos.
   *
   * Em grupo isto NAO e o grupo: e o participante. A identidade
   * de quem pergunta e sempre de uma pessoa, nunca de uma sala.
   */
  de: string;
  texto: string;
  /** Identificador no provedor, para nao processar duas vezes. */
  idMensagem: string;
  /** Nome que a pessoa usa no WhatsApp, quando ele informa. */
  nomeDeExibicao?: string;
  recebidaEm: Date;

  /** O grupo de onde veio, ou null quando e conversa privada. */
  grupo: { jid: string; nome?: string } | null;

  /** Para onde a resposta volta: o grupo, ou a pessoa. */
  responderPara: string;

  /**
   * Saiu do PROPRIO numero conectado.
   *
   * Pode ser duas coisas muito diferentes: a resposta que o
   * sistema acabou de mandar (e ai responder seria laco), ou o
   * dono do celular digitando — que e gente da empresa e tem todo
   * direito de perguntar. Quem separa as duas e o `atendimento`.
   */
  deMim: boolean;

  /** E a conversa do numero consigo mesmo ("Mensagem para mim"). */
  comigoMesmo: boolean;

  /** Audio esperando transcricao. */
  audio?: { baixar: () => Promise<Buffer | null>; tipoMime: string };
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

  /**
   * Avisa a cada mensagem que CHEGA.
   *
   * O ASSISTENTE ATENDE NO NUMERO QUE LEU O QR — seja ele qual
   * for. Nao ha numero escrito em lugar nenhum do codigo: quem
   * decide e a sessao conectada. Trocou o QR, trocou o atendente,
   * e nada precisa ser reconfigurado.
   *
   * O QUE NAO CHEGA AQUI, e cada uma destas e uma brecha fechada:
   *
   *   · as proprias mensagens do numero conectado. Sem isto o
   *     assistente responderia a si mesmo, em circulo, para
   *     sempre;
   *   · grupo. Um robo respondendo em grupo e spam, e o grupo
   *     costuma nao ser da empresa;
   *   · status e transmissao, que nao sao conversa;
   *   · o que nao e texto. Audio, figurinha e foto ficam
   *     registrados, mas nao viram pergunta.
   *
   * Opcional: adaptador que nao recebe (o simulado, a API
   * oficial por enquanto) simplesmente nao implementa.
   */
  aoReceber?(ouvinte: (mensagem: MensagemRecebida) => void): void;

  /**
   * O nome do grupo, perguntado ao provedor.
   *
   * Nao vem na mensagem: o que chega e o JID, um numero enorme que
   * nao diz nada a ninguem. Sem isto a tela lista "Grupo sem nome"
   * e quem administra tem de adivinhar qual liberar.
   */
  nomeDoGrupo?(jid: string): Promise<string | null>;

  /**
   * Os grupos de que a conta participa, para a tela oferecer a
   * escolha. Adaptador que nao sabe listar devolve vazio.
   */
  listarGrupos?(): Promise<Array<{ jid: string; nome: string | null }>>;
}
