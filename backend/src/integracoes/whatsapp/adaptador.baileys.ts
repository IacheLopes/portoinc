// ============================================================
//  ADAPTADOR BAILEYS (WhatsApp nao oficial)
//
//  AVISO: a Baileys NAO e a API oficial do WhatsApp. Use um chip
//  de testes, NUNCA o numero comercial da Porto Inc. -- existe
//  risco real de bloqueio da conta pelo WhatsApp.
//
//  Para ativar: no .env, WHATSAPP_ADAPTER=baileys.
//
//  A sessao (credenciais do numero conectado) fica no volume
//  /app/sessao-whatsapp. Ela nunca vai para o git e nunca
//  aparece em log.
//
//  Decisoes que vieram de erros ja cometidos em outro projeto:
//
//  1. A biblioteca e carregada SOB DEMANDA. Ela e pesada e so
//     faz sentido quando existe conexao de verdade; nos testes e
//     no modo simulado ninguem paga esse custo.
//  2. O QR fica SO NA MEMORIA. Log de Docker e persistente, e o
//     QR e credencial: quem fotografa o log entra na conta.
//  3. Antes de limpar a sessao, removemos TODOS os ouvintes. Um
//     "saveCreds" atrasado reescreveria o arquivo recem-apagado.
//  4. Ao limpar, apagamos o CONTEUDO da pasta, nunca a pasta: em
//     volume do Docker o ponto de montagem esta em uso e o
//     sistema recusa apagar (EBUSY).
//  5. So um socket por processo. Dois sockets brigam pela mesma
//     sessao e derrubam os dois.
//  6. No envio, perguntamos ao WhatsApp qual e o numero canonico
//     (onWhatsApp) em vez de adivinhar o nono digito.
// ============================================================

import { mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

import type {
  MensagemRecebida,
  PortaWhatsApp, MensagemWhatsApp, ResultadoEnvio, EstadoConexao, SituacaoWhatsApp,
} from './porta.js';

const exigir = createRequire(import.meta.url);

/** O Baileys fala muito; nao queremos nada disso no nosso log. */
const LOGGER_MUDO: Record<string, unknown> = {
  level: 'silent',
  child: () => LOGGER_MUDO,
  trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {},
};

interface Biblioteca {
  makeWASocket: (opcoes: Record<string, unknown>) => SocketWhatsApp;
  useMultiFileAuthState: (pasta: string) => Promise<{
    state: { creds: unknown; keys: unknown };
    saveCreds: () => Promise<void>;
  }>;
  fetchLatestBaileysVersion?: () => Promise<{ version: number[] }>;
  makeCacheableSignalKeyStore?: (chaves: unknown, logger: unknown) => unknown;
  DisconnectReason: Record<string, number>;
  /**
   * Baixa e DESCRIPTOGRAFA a midia de uma mensagem.
   *
   * O arquivo nao viaja na mensagem: o que chega e uma referencia
   * cifrada, e so a biblioteca sabe busca-la e abrir.
   */
  downloadMediaMessage?: (
    mensagem: unknown,
    tipo: 'buffer',
    opcoes: Record<string, unknown>,
  ) => Promise<Buffer>;
}

interface SocketWhatsApp {
  ev: {
    on: (evento: string, ouvinte: (dados: never) => void) => void;
    removeAllListeners: () => void;
  };
  end: (erro?: unknown) => void;
  logout: () => Promise<void>;
  user?: { id?: string };
  onWhatsApp: (numero: string) => Promise<Array<{ exists: boolean; jid: string }> | undefined>;
  sendMessage: (
    destino: string,
    conteudo: Record<string, unknown>,
  ) => Promise<{ key?: { id?: string } } | undefined>;
  /** Os dados de um grupo. `subject` e o nome que aparece no celular. */
  groupMetadata?: (jid: string) => Promise<{ subject?: string } | undefined>;
  /** Todos os grupos de que a conta participa. */
  groupFetchAllParticipating?: () => Promise<Record<string, { subject?: string }>>;
  /** Pede de novo a midia que o servidor ja descartou. */
  updateMediaMessage?: (mensagem: unknown) => Promise<unknown>;
}

/** Mantem DDI, DDD e os dois ultimos digitos. O resto vira ponto. */
export function mascarar(numero: string | null | undefined): string {
  if (!numero) return '—';

  const digitos = String(numero).split('@')[0].split(':')[0];
  if (digitos.length <= 6) return digitos.replace(/\d(?=\d{2})/g, '•');

  return digitos.slice(0, 4) + '•'.repeat(digitos.length - 6) + digitos.slice(-2);
}

/**
 * Deixa o telefone so com digitos e confere se e plausivel.
 *
 * NAO acrescenta nem tira o nono digito: quem sabe o numero certo
 * e o WhatsApp, e a gente pergunta a ele no envio.
 */
export function normalizarTelefone(entrada: string): string {
  const texto = String(entrada ?? '');
  if (texto.includes('@')) throw new Error('Informe um telefone, não um endereço interno.');

  const digitos = texto.replace(/\D/g, '');
  if (digitos === '') throw new Error('Número vazio.');

  if (digitos.length < 10 || digitos.length > 15) {
    throw new Error(
      'Número com ' + digitos.length + ' dígitos não parece válido. Use DDI + DDD + número.',
    );
  }

  return comDdiDoBrasil(digitos);
}

/**
 * Poe o 55 na frente quando ele nao foi digitado.
 *
 * Pedido dele em 10/10/2026, depois de a primeira mensagem de
 * teste sair como `8399•••••48`: ele digitou o numero do jeito
 * que a gente fala no Brasil, com DDD e sem pais. O WhatsApp nao
 * entende assim, e o envio morre dizendo que o numero nao existe.
 *
 * A ARMADILHA, E POR QUE ISTO OLHA O TAMANHO E NAO O COMECO
 *
 * "Comeca com 55" NAO prova que o DDI esta la: o DDD 55 existe,
 * e e o de Santa Maria, no Rio Grande do Sul. O numero
 * `55999994448` comeca com 55 e mesmo assim esta SEM o pais — a
 * regra ingenua o deixaria passar e a mensagem nunca chegaria.
 *
 * O tamanho nao tem essa ambiguidade:
 *
 *     10  DDD + fixo (8)          falta o pais
 *     11  DDD + celular (9)       falta o pais
 *     12  55 + DDD + fixo         completo
 *     13  55 + DDD + celular      completo
 *     14+ numero de outro pais    nao se mexe
 */
function comDdiDoBrasil(digitos: string): string {
  if (digitos.length === 10 || digitos.length === 11) return '55' + digitos;
  return digitos;
}

const EXPLICACAO: Record<EstadoConexao, string> = {
  desconectado: 'Desligado. Clique em Conectar para gerar o QR Code.',
  iniciando: 'Preparando a conexão...',
  qr_pronto: 'QR Code pronto. Leia com o celular em Aparelhos conectados.',
  aguardando_leitura: 'Esperando você escanear o QR Code.',
  //  "QR LIDO" ERA MENTIRA NO UNICO CASO EM QUE ESTA FRASE APARECE.
  //
  //  Depois de alguem escanear, o QR ainda esta em memoria, entao
  //  o estado vira `aguardando_leitura`. Este aqui so acontece
  //  quando NAO ha QR nenhum — ou seja, retomando sessao salva.
  //  A frase dizia justamente o contrario do que tinha havido.
  autenticando: 'Confirmando a sessão salva com o WhatsApp...',
  conectado: 'Conectado.',
  reconectando: 'A conexão caiu. Reconectando sozinho, sem pedir QR de novo.',
  deslogado: 'A sessão foi encerrada no celular. Gere um QR novo para reconectar.',
  erro: 'Algo deu errado na conexão.',
};

/** O formato cru do Baileys, so a parte que a gente le. */
interface RecadoCru {
  key?: {
    remoteJid?: string;
    fromMe?: boolean;
    id?: string;
    participant?: string;
    //  O TELEFONE DE VERDADE, quando o WhatsApp manda o LID por
    //  cima. Ver o comentario em `peneirar`.
    participantPn?: string;
    senderPn?: string;
  };
  pushName?: string;
  messageTimestamp?: number | { toNumber?: () => number };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    audioMessage?: { mimetype?: string; seconds?: number };
  } | null;
}

export class AdaptadorWhatsAppBaileys implements PortaWhatsApp {
  readonly nome = 'baileys';

  private ouvintes: ((m: MensagemRecebida) => void)[] = [];

  private lib: Biblioteca | null = null;
  private sock: SocketWhatsApp | null = null;

  private conexao: EstadoConexao = 'desconectado';
  private desde: Date | null = null;
  private detalhe: string | null = null;

  /** Guard do socket unico. */
  private iniciando = false;
  /** Verdadeiro durante logout/limpeza: ignora fechamentos duplicados. */
  private encerrando = false;
  /** Verdadeiro enquanto a conexao esta sendo retomada pelo proprio sistema. */
  private retomando = false;
  /** Texto do QR. So memoria. */
  private qrAtual: string | null = null;
  private numero: string | null = null;
  private reconexao: NodeJS.Timeout | null = null;

  /**
   * Avisado a cada mudanca de estado, se alguem quiser ouvir.
   *
   * O ADAPTADOR NAO CONHECE O BANCO, E ISSO E DE PROPOSITO. Ele
   * e uma tomada: sabe falar com o WhatsApp e mais nada. Quem
   * quiser guardar a historia liga este aviso no quadro de
   * tomadas (`integracoes/index.ts`), que e o unico lugar do
   * sistema que conhece os dois lados.
   *
   * O aviso e disparado SEM espera (`void`): gravar o diario nao
   * pode atrasar nem derrubar a conexao.
   */
  constructor(
    private readonly pastaSessao: string,
    private readonly aoMudarEstado?: (
      estado: EstadoConexao,
      detalhe: string | null,
      numeroMascarado: string | null,
    ) => void,
  ) {}

  // --------------------------------------------------------
  //  Estado
  // --------------------------------------------------------
  estado(): EstadoConexao {
    return this.conexao;
  }

  situacao(): SituacaoWhatsApp {
    return {
      estado: this.conexao,
      numero: this.numero ? mascarar(this.numero) : null,
      temQr: this.qrAtual !== null,
      desde: this.desde,
      detalhe: this.detalhe ?? EXPLICACAO[this.conexao],
    };
  }

  async qrPng(): Promise<Buffer | null> {
    if (!this.qrAtual) return null;

    const qrcode = exigir('qrcode') as {
      toBuffer: (texto: string, opcoes: Record<string, unknown>) => Promise<Buffer>;
    };

    return qrcode.toBuffer(this.qrAtual, {
      type: 'png',
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
  }

  private mudarPara(estado: EstadoConexao, detalhe?: string): void {
    this.conexao = estado;
    this.desde = new Date();
    this.detalhe = detalhe ?? null;

    //  O diario nunca pode atrapalhar a conexao: se quem ouve
    //  explodir, a culpa nao e do WhatsApp.
    try {
      this.aoMudarEstado?.(
        estado,
        this.detalhe ?? EXPLICACAO[estado],
        this.numero ? mascarar(this.numero) : null,
      );
    } catch {
      // Observacao que derruba o observado e pior que nenhuma.
    }
  }

  // --------------------------------------------------------
  //  Conexao
  // --------------------------------------------------------

  /**
   * Retoma a sessao sozinho quando a API sobe.
   *
   * POR QUE ISTO EXISTE, nas palavras dele em 10/10/2026:
   *
   *   "durante o suporte que vamos prestar no futuro, toda vez
   *    que formos subir alguma atualizacao na producao ele vai
   *    cair, entao e necessario que ele reconecte sozinho"
   *
   * Esta certo, e ja tinha acontecido duas vezes no mesmo dia:
   * cada arquivo salvo no backend reinicia a API, e a conexao
   * ficava no chao ate alguem abrir a tela e clicar.
   *
   * A TRAVA: so retoma o que JA foi autorizado por uma pessoa.
   * Sem `creds.json` nao faz nada — em especial, nao gera QR.
   * QR nascendo sozinho num servidor e um convite aberto
   * esperando leitor, e ninguem estaria olhando a tela para ver.
   */
  async retomarSessao(): Promise<void> {
    if (!this.temSessaoSalva()) return;

    //  O diario precisa separar "alguem clicou em Conectar" de
    //  "o sistema voltou e retomou sozinho". Sao a mesma conexao
    //  e historias diferentes.
    this.retomando = true;
    try {
      await this.conectar();
    } finally {
      this.retomando = false;
    }
  }

  async conectar(): Promise<void> {
    if (this.sock || this.iniciando) return; // socket unico

    this.iniciando = true;

    if (this.retomando) {
      this.mudarPara(
        'iniciando',
        'O sistema voltou e está retomando a conexão sozinho, com a sessão já salva.',
      );
    }

    try {
      mkdirSync(this.pastaSessao, { recursive: true });

      const lib = await this.carregarBiblioteca();
      const { state, saveCreds } = await lib.useMultiFileAuthState(this.pastaSessao);

      let versao: number[] | undefined;
      if (lib.fetchLatestBaileysVersion) {
        try {
          ({ version: versao } = await lib.fetchLatestBaileysVersion());
        } catch {
          /* sem internet para consultar: usa a versao embutida */
        }
      }

      this.mudarPara('iniciando');

      // O cache das chaves reduz muito o erro de "sincronizando".
      const chaves = lib.makeCacheableSignalKeyStore
        ? lib.makeCacheableSignalKeyStore(state.keys, LOGGER_MUDO)
        : state.keys;

      const sock = lib.makeWASocket({
        version: versao,
        auth: { creds: state.creds, keys: chaves },
        logger: LOGGER_MUDO,
        printQRInTerminal: false, // o QR e tratado so em memoria
        browser: ['Porto Inc. Compras', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
      });

      this.sock = sock;

      sock.ev.on('creds.update', saveCreds as never);

      //  O OUVIDO. Ver `aoReceber` e `peneirar`, logo abaixo.
      sock.ev.on('messages.upsert', ((lote: {
        type?: string;
        messages?: RecadoCru[];
      }) => {
        //  `notify` E MENSAGEM NOVA DE OUTRA PESSOA.
        //
        //  O que VOCE MESMO manda, do seu celular, nao chega como
        //  `notify`: chega como `append` — "acrescente isto a
        //  conversa, foi voce que escreveu de outro aparelho".
        //
        //  Descobri isso em 14/10/2026, com ele mandando mensagem
        //  no grupo pelo proprio numero conectado e o assistente
        //  mudo. A mensagem chegava e morria nesta linha.
        //
        //  `append` tambem e o tipo da SINCRONIZACAO DE HISTORICO,
        //  e ai esta o cuidado: aceitar `append` sem mais nada
        //  faria o assistente responder meses de conversa de uma
        //  vez na primeira reconexao. Por isso duas cercas —
        //  so o que e `fromMe`, e so o que acabou de acontecer.
        const ehNova = lote.type === 'notify';
        const ehMinha = lote.type === 'append';

        if (!ehNova && !ehMinha) return;

        for (const cru of lote.messages ?? []) {
          if (ehMinha && !cru.key?.fromMe) continue;

          //  DIAGNOSTICO TEMPORARIO (14/10/2026): o WhatsApp passou
          //  a mandar LID no lugar do telefone, e precisamos ver
          //  quais campos vem preenchidos de verdade. Sai daqui
          //  assim que o reconhecimento estiver confirmado.
          if (process.env.IA_DIAGNOSTICO === 'true') {
            console.log(
              '[chave] tipo=' + lote.type +
              ' fromMe=' + cru.key?.fromMe +
              ' remoteJid=' + cru.key?.remoteJid +
              ' participant=' + cru.key?.participant +
              ' participantPn=' + cru.key?.participantPn +
              ' senderPn=' + cru.key?.senderPn,
            );
          }

          const recado = this.peneirar(cru);
          if (!recado) continue;

          //  A CERCA DO TEMPO, para historico antigo nao virar
          //  pergunta.
          //
          //  Eram dois minutos. Subiu para QUINZE em 14/10/2026,
          //  porque e por aqui que chega a mensagem que ficou sem
          //  resposta enquanto o sistema estava fora do ar — e
          //  responde-la na volta foi pedido dele.
          //
          //  O que protege do despejo de historico deixou de ser so
          //  o relogio: e a regra de que ele so responde se a
          //  pergunta ainda for A ULTIMA da conversa. Em conversa
          //  antiga sempre ha algo depois, entao ele se cala
          //  sozinho. Ver `repescagem`, em `servicos/atendimento`.
          if (Date.now() - recado.recebidaEm.getTime() > 15 * 60 * 1000) continue;

          for (const ouvinte of this.ouvintes) ouvinte(recado);
        }
      }) as never);
      sock.ev.on('connection.update', ((atualizacao: {
        connection?: string;
        qr?: string;
        lastDisconnect?: { error?: { output?: { statusCode?: number } } };
      }) => {
        this.aoMudarConexao(atualizacao, lib);
      }) as never);

      this.iniciando = false;
    } catch (erro) {
      this.iniciando = false;
      this.sock = null;
      this.mudarPara('erro', erro instanceof Error ? erro.message : 'Falha ao conectar.');
      throw erro;
    }
  }

  /**
   * O NOME DO GRUPO NAO VEM NA MENSAGEM.
   *
   * O `messages.upsert` entrega o JID — aquele numero enorme — e
   * mais nada. O nome que aparece no celular ("Obra Porto Belo")
   * precisa ser PERGUNTADO ao WhatsApp, numa chamada separada.
   *
   * Por isso ela e chamada so quando o nome ainda nao e conhecido:
   * pedir metadado de grupo a cada mensagem e o tipo de insistencia
   * que faz o WhatsApp comecar a recusar.
   */
  async nomeDoGrupo(jid: string): Promise<string | null> {
    try {
      if (!this.sock?.groupMetadata) return null;

      const dados = await this.sock.groupMetadata(jid);
      return dados?.subject?.trim() || null;
    } catch {
      //  Grupo de que a conta saiu, ou sem internet. O grupo
      //  continua na lista pelo JID, so que sem nome — melhor do
      //  que derrubar o atendimento por causa de um rotulo.
      return null;
    }
  }

  /**
   * TODOS OS GRUPOS DE QUE A CONTA PARTICIPA.
   *
   * Existe para a tela poder OFERECER a escolha, em vez de a lista
   * ir se enchendo sozinha com todo grupo que manda mensagem — o
   * que, num celular pessoal, significava a tela da empresa
   * listando o grupo da familia e o das ofertas.
   */
  async listarGrupos(): Promise<Array<{ jid: string; nome: string | null }>> {
    try {
      if (!this.sock?.groupFetchAllParticipating) return [];

      const todos = await this.sock.groupFetchAllParticipating();

      return Object.entries(todos ?? {})
        .map(([jid, dados]) => ({ jid, nome: dados?.subject?.trim() || null }))
        .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'));
    } catch {
      return [];
    }
  }

  aoReceber(ouvinte: (m: MensagemRecebida) => void): void {
    this.ouvintes.push(ouvinte);
  }

  /**
   * AS QUATRO PENEIRAS.
   *
   * O `messages.upsert` entrega TUDO que acontece na conta: o que
   * a gente mesmo manda, grupo, status, figurinha, audio. Quase
   * nada disso e pergunta para o assistente, e cada uma destas
   * peneiras fecha uma brecha concreta:
   *
   *   1. `fromMe` — a propria mensagem do numero conectado. Sem
   *      isto o assistente le a resposta que ele acabou de mandar,
   *      responde a ela, le de novo, e o laco so para quando a
   *      conta e banida;
   *   2. `@g.us` — grupo. Robo respondendo em grupo e spam, e o
   *      grupo quase nunca e da empresa;
   *   3. `status@broadcast` — status e lista de transmissao. Nao
   *      sao conversa com ninguem;
   *   4. sem texto — audio, figurinha, foto sem legenda. Ficam na
   *      conta da pessoa, mas nao viram pergunta: responder "nao
   *      entendi" a cada figurinha e pior do que ficar quieto.
   *
   * Devolve `null` quando a mensagem nao e para o assistente.
   */
  private peneirar(cru: RecadoCru): MensagemRecebida | null {
    return peneirar(cru, (recado) => this.baixarMidia(recado), this.numero);
  }

  /**
   * Baixa o audio do WhatsApp.
   *
   * O arquivo nao vem na mensagem: vem uma referencia cifrada, e
   * quem busca e descriptografa e a propria biblioteca. Por isso
   * o download e PREGUICOSO — so acontece se o atendimento
   * decidir que vale transcrever. Audio de grupo em que ninguem
   * chamou o assistente nao precisa ser baixado.
   */
  private async baixarMidia(cru: RecadoCru): Promise<Buffer | null> {
    try {
      const lib = await this.carregarBiblioteca();
      if (!lib.downloadMediaMessage) return null;

      const conteudo = await lib.downloadMediaMessage(cru, 'buffer', {
        logger: LOGGER_MUDO,
        //  Midia que o WhatsApp ja descartou do servidor precisa
        //  ser pedida de novo ao aparelho de quem mandou. Sem
        //  isto, audio de alguns minutos atras falha em silencio.
        reuploadRequest: this.sock?.updateMediaMessage,
      });

      return Buffer.isBuffer(conteudo) ? conteudo : null;
    } catch {
      //  Midia expirada ou sem internet: o atendimento segue sem
      //  o audio, e a mensagem fica registrada do mesmo jeito.
      return null;
    }
  }

  private aoMudarConexao(
    atualizacao: {
      connection?: string;
      qr?: string;
      lastDisconnect?: { error?: { output?: { statusCode?: number } } };
    },
    lib: Biblioteca,
  ): void {
    const { connection, qr, lastDisconnect } = atualizacao;

    if (qr) {
      this.qrAtual = qr;
      this.mudarPara('qr_pronto');
    }

    if (connection === 'connecting') {
      this.mudarPara(this.qrAtual ? 'aguardando_leitura' : 'autenticando');
    }

    if (connection === 'open') {
      this.qrAtual = null;
      this.numero = this.sock?.user?.id ?? null;
      this.mudarPara('conectado');
    }

    if (connection === 'close') {
      if (this.encerrando) return; // ja estamos tratando o encerramento

      const codigo = lastDisconnect?.error?.output?.statusCode;
      const deslogou = codigo === lib.DisconnectReason.loggedOut;

      this.desmontar(); // tira os ouvintes ANTES de qualquer limpeza

      if (deslogou) {
        this.encerrando = true;
        this.numero = null;
        this.qrAtual = null;
        this.mudarPara('deslogado', 'A sessão foi encerrada no celular.');
        this.limparSessao();

        this.reconexao = setTimeout(() => {
          this.encerrando = false;
          void this.conectar(); // gera um QR novo
        }, 1500);
      } else {
        this.mudarPara('reconectando', 'Conexão caiu (código ' + codigo + '). Tentando de novo...');

        this.reconexao = setTimeout(() => {
          void this.conectar(); // a sessao continua valida: nao pede QR
        }, 2500);
      }
    }
  }

  async desconectar(): Promise<void> {
    if (this.reconexao) {
      clearTimeout(this.reconexao);
      this.reconexao = null;
    }

    if (this.encerrando) return;
    this.encerrando = true;

    try {
      if (this.sock) await this.sock.logout();
    } catch {
      /* ja caiu ou nunca conectou: seguimos para a limpeza */
    }

    this.desmontar();
    this.limparSessao();

    this.numero = null;
    this.qrAtual = null;
    this.mudarPara('desconectado', 'Desligado por aqui. A sessão foi apagada.');
    this.encerrando = false;
  }

  /**
   * Desmonta o socket: tira TODOS os ouvintes e encerra.
   *
   * A ordem importa. Se a sessao for apagada com os ouvintes
   * ativos, um "creds.update" atrasado grava tudo de volta e o
   * logout nao acontece de verdade.
   */
  private desmontar(): void {
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
      } catch {
        /* socket ja morto */
      }
      try {
        this.sock.end(undefined);
      } catch {
        /* idem */
      }
    }

    this.sock = null;
    this.iniciando = false;
  }

  /**
   * Apaga o CONTEUDO da pasta da sessao.
   *
   * Nunca a pasta em si: ela e o ponto de montagem de um volume
   * do Docker e o sistema recusa apagar (EBUSY).
   */
  private limparSessao(): void {
    try {
      mkdirSync(this.pastaSessao, { recursive: true });

      for (const nome of readdirSync(this.pastaSessao)) {
        rmSync(join(this.pastaSessao, nome), { recursive: true, force: true });
      }
    } catch {
      /* se falhar, o proximo conectar tenta de novo */
    }
  }

  /** Ha sessao salva? Usado para saber se vai pedir QR. */
  temSessaoSalva(): boolean {
    try {
      return existsSync(join(this.pastaSessao, 'creds.json'));
    } catch {
      return false;
    }
  }

  private async carregarBiblioteca(): Promise<Biblioteca> {
    if (this.lib) return this.lib;

    // Carregamento tardio: a biblioteca so entra na memoria
    // quando existe conexao real.
    const b = exigir('@whiskeysockets/baileys') as Record<string, unknown>;

    this.lib = {
      makeWASocket: (b.default ?? b.makeWASocket) as Biblioteca['makeWASocket'],
      useMultiFileAuthState: b.useMultiFileAuthState as Biblioteca['useMultiFileAuthState'],
      fetchLatestBaileysVersion: b.fetchLatestBaileysVersion as Biblioteca['fetchLatestBaileysVersion'],
      makeCacheableSignalKeyStore: b.makeCacheableSignalKeyStore as Biblioteca['makeCacheableSignalKeyStore'],
      DisconnectReason: b.DisconnectReason as Record<string, number>,
      //  SEM ESTA LINHA O AUDIO NAO CHEGA.
      //
      //  A `lib` e montada a mao, funcao por funcao — e em
      //  14/10/2026 o assistente passou a transcrever audio sem
      //  que `downloadMediaMessage` tivesse sido incluida aqui.
      //  Resultado: o recado de voz chegava, o download devolvia
      //  nulo e a mensagem morria como "audio sem transcricao".
      downloadMediaMessage: b.downloadMediaMessage as Biblioteca['downloadMediaMessage'],
    };

    return this.lib;
  }

  // --------------------------------------------------------
  //  Envio
  // --------------------------------------------------------
  async enviar(mensagem: MensagemWhatsApp): Promise<ResultadoEnvio> {
    const agora = new Date();

    if (this.conexao !== 'conectado' || !this.sock) {
      return {
        sucesso: false,
        erro: 'WhatsApp não está conectado (' + EXPLICACAO[this.conexao] + ')',
        adaptador: this.nome,
        enviadoEm: agora,
      };
    }

    //  GRUPO NAO E TELEFONE.
    //
    //  O endereco de um grupo e `120363411210921556@g.us`: dezoito
    //  digitos e um sufixo proprio. Passando isso pela validacao de
    //  telefone, ela recusa — com razao — e a resposta do assistente
    //  morre com "informe um telefone, nao um endereco interno".
    //
    //  Foi o que aconteceu em 14/10/2026: ele reconhecia quem
    //  perguntou, montava a resposta certa, e nao conseguia
    //  entrega-la. Para grupo o endereco ja E o destino: nao ha o
    //  que normalizar nem a quem perguntar se existe.
    if (mensagem.para.endsWith('@g.us')) {
      return this.entregar(mensagem, mensagem.para, agora);
    }

    let digitos: string;
    try {
      digitos = normalizarTelefone(mensagem.para);
    } catch (erro) {
      return {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : 'Número inválido.',
        adaptador: this.nome,
        enviadoEm: agora,
      };
    }

    // Pergunta ao WhatsApp qual e o endereco certo. Ele devolve o
    // numero canonico, que pode ter o nono digito diferente do que
    // foi digitado.
    let encontrado: { exists: boolean; jid: string } | undefined;
    try {
      const resposta = await this.sock.onWhatsApp(digitos);
      encontrado = Array.isArray(resposta) ? resposta[0] : undefined;
    } catch (erro) {
      return {
        sucesso: false,
        erro: 'Não consegui conferir o número no WhatsApp: ' +
          (erro instanceof Error ? erro.message : 'falha na consulta'),
        adaptador: this.nome,
        enviadoEm: agora,
      };
    }

    if (!encontrado?.exists) {
      return {
        sucesso: false,
        erro: 'O número ' + mascarar(digitos) + ' não tem WhatsApp.',
        adaptador: this.nome,
        enviadoEm: agora,
      };
    }

    return this.entregar(mensagem, encontrado.jid, agora);
  }

  /**
   * A entrega em si, comum a pessoa e a grupo.
   *
   * O que muda entre os dois e so COMO SE CHEGA ao endereco:
   * telefone passa por validacao e por uma consulta ao WhatsApp,
   * grupo ja vem pronto. Daqui para baixo e identico, e por isso
   * mora num lugar so.
   */
  private async entregar(
    mensagem: MensagemWhatsApp,
    destino: string,
    agora: Date,
  ): Promise<ResultadoEnvio> {
    try {
      const conteudo: Record<string, unknown> = mensagem.anexo
        ? {
            document: mensagem.anexo.conteudo,
            fileName: mensagem.anexo.nomeArquivo,
            mimetype: mensagem.anexo.tipoMime,
            caption: mensagem.texto,
          }
        : { text: mensagem.texto };

      const enviada = await this.sock!.sendMessage(destino, conteudo);

      return {
        sucesso: true,
        idMensagem: enviada?.key?.id ?? undefined,
        adaptador: this.nome,
        enviadoEm: new Date(),
      };
    } catch (erro) {
      return {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : 'Falha ao enviar.',
        adaptador: this.nome,
        enviadoEm: agora,
      };
    }
  }
}

/**
 * A peneira, fora da classe PARA PODER SER TESTADA.
 *
 * Ela e regra pura: entra o recado cru do Baileys, sai a mensagem
 * ou `null`. Nao precisa de socket, de sessao nem de internet —
 * e e justamente a parte que, se falhar, faz o assistente
 * responder a si mesmo para sempre.
 */
export function peneirar(
  cru: RecadoCru,
  baixarMidia?: (cru: RecadoCru) => Promise<Buffer | null>,
  meuNumero?: string | null,
): MensagemRecebida | null {
  const jid = cru.key?.remoteJid ?? '';

  //  1. STATUS E TRANSMISSAO nao sao conversa com ninguem.
  if (jid === 'status@broadcast' || jid.endsWith('@broadcast')) return null;

  if (!jid.includes('@')) return null;

  const ehGrupo = jid.endsWith('@g.us');
  const deMim = Boolean(cru.key?.fromMe);

  const soDigitos = (t: string) => t.split('@')[0].split(':')[0].replace(/\D/g, '');
  const meu = meuNumero ? soDigitos(meuNumero) : '';
  const comigoMesmo = !ehGrupo && Boolean(meu) && soDigitos(jid) === meu;

  //  2. O QUE SAI DO PROPRIO NUMERO, e a parte delicada.
  //
  //     Tudo que o celular conectado manda vem marcado como
  //     "minha". Isso e TRES coisas diferentes:
  //
  //       a) a resposta que o sistema acabou de mandar — responder
  //          a ela seria laco infinito;
  //       b) o dono digitando no grupo ou na conversa consigo
  //          mesmo — e gente da empresa perguntando, tem de ser
  //          atendido;
  //       c) o dono conversando com a esposa, com o fornecedor,
  //          com quem for — NAO e assunto do assistente, e ler
  //          isso seria bisbilhotar a conversa alheia.
  //
  //     Aqui so o (c) morre. O (a) e o (b) seguem, e quem os
  //     separa e o `atendimento`, que sabe quais mensagens o
  //     sistema mandou.
  if (deMim && !ehGrupo && !comigoMesmo) return null;

  //  3. QUEM FALOU, e nao de onde.
  //
  //     Em grupo o `remoteJid` e a SALA; quem falou vem em
  //     `participant`. Identidade e sempre de pessoa: sem isto,
  //     todo mundo do grupo seria "o grupo" e ninguem seria
  //     reconhecido como da equipe.
  //  QUEM FALOU — E O LID.
  //
  //  O WhatsApp passou a identificar gente por LID: um numero
  //  grande e sem significado, que ESCONDE o telefone. Em
  //  14/10/2026 uma mensagem no grupo chegou como
  //  `256375338881247` — nao e telefone de ninguem, e por isso o
  //  assistente nao reconheceu o proprio dono do sistema.
  //
  //  A biblioteca manda o telefone de verdade NUM CAMPO AO LADO:
  //  `participantPn` em grupo, `senderPn` no privado. E dele que
  //  a identificacao precisa — o LID nao casa com cadastro nenhum.
  //
  //  O `participant` continua como reserva: em conversa antiga, e
  //  em conta que ainda nao migrou, e ele que vem preenchido. E
  //  quando a mensagem e SUA, o WhatsApp as vezes nao preenche
  //  nenhum dos dois — do ponto de vista dele, obviamente foi
  //  voce —, entao sobra o numero conectado.
  //  SE E MINHA, SOU EU — e ponto. Esta linha vem PRIMEIRO de
  //  proposito: medido em 14/10/2026, a propria mensagem no grupo
  //  chega com `fromMe=true` e `participant=256375338881247@lid`,
  //  sem telefone nenhum ao lado. Perguntar quem e o dono do LID
  //  quando o WhatsApp acabou de dizer "foi voce" e dar voltas
  //  para chegar onde ja se estava.
  const deJid = deMim
    ? (meuNumero ?? cru.key?.participantPn ?? cru.key?.senderPn ?? '')
    : ehGrupo
      ? (cru.key?.participantPn || cru.key?.participant || '')
      : (cru.key?.senderPn || jid);
  const de = deJid.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (!de) return null;

  const texto =
    cru.message?.conversation ??
    cru.message?.extendedTextMessage?.text ??
    cru.message?.imageMessage?.caption ??
    cru.message?.videoMessage?.caption ??
    '';

  const audioCru = cru.message?.audioMessage;

  //  4. SEM TEXTO E SEM AUDIO nao e pergunta. Figurinha e foto sem
  //     legenda ficam de fora: responder "nao entendi" a cada
  //     figurinha e pior do que ficar quieto.
  if (!texto.trim() && !audioCru) return null;

  const carimbo = cru.messageTimestamp;
  const segundos =
    typeof carimbo === 'number'
      ? carimbo
      : typeof carimbo?.toNumber === 'function'
        ? carimbo.toNumber()
        : 0;

  return {
    de,
    texto: texto.trim(),
    idMensagem: cru.key?.id ?? '',
    nomeDeExibicao: cru.pushName,
    recebidaEm: segundos ? new Date(segundos * 1000) : new Date(),
    grupo: ehGrupo ? { jid } : null,
    deMim,
    comigoMesmo,
    //  A resposta volta para o GRUPO quando a pergunta veio do
    //  grupo. Responder no privado quem perguntou na sala e
    //  esconder a resposta de quem tambem queria saber.
    responderPara: jid,
    ...(audioCru && baixarMidia
      ? {
          audio: {
            tipoMime: audioCru.mimetype ?? 'audio/ogg',
            baixar: () => baixarMidia(cru),
          },
        }
      : {}),
  };
}
