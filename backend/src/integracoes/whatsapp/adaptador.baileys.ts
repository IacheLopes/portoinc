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

export class AdaptadorWhatsAppBaileys implements PortaWhatsApp {
  readonly nome = 'baileys';

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

    try {
      const conteudo: Record<string, unknown> = mensagem.anexo
        ? {
            document: mensagem.anexo.conteudo,
            fileName: mensagem.anexo.nomeArquivo,
            mimetype: mensagem.anexo.tipoMime,
            caption: mensagem.texto,
          }
        : { text: mensagem.texto };

      const enviada = await this.sock.sendMessage(encontrado.jid, conteudo);

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
        enviadoEm: new Date(),
      };
    }
  }
}
