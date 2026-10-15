// ============================================================
//  ADAPTADOR SIMULADO (mock) - padrao do ambiente de testes
//
//  Nao envia nada para fora. Apenas guarda o que SERIA enviado,
//  para voce conferir na tela. Risco zero: nenhum numero real e
//  acionado e nenhuma conta pode ser banida.
// ============================================================

import type {
  PortaWhatsApp, MensagemWhatsApp, ResultadoEnvio, EstadoConexao, SituacaoWhatsApp,
} from './porta.js';

export interface RegistroMock extends ResultadoEnvio {
  para: string;
  texto: string;
  temAnexo: boolean;
}

export class AdaptadorWhatsAppMock implements PortaWhatsApp {
  readonly nome = 'mock';
  private conexao: EstadoConexao = 'desconectado';
  private desde: Date | null = null;

  /** Historico do que seria enviado. Limitado para nao consumir memoria. */
  private readonly historico: RegistroMock[] = [];
  private static readonly LIMITE_HISTORICO = 100;

  async conectar(): Promise<void> {
    this.conexao = 'conectado';
    this.desde = new Date();
  }

  async desconectar(): Promise<void> {
    this.conexao = 'desconectado';
    this.desde = new Date();
  }

  estado(): EstadoConexao {
    return this.conexao;
  }

  situacao(): SituacaoWhatsApp {
    return {
      estado: this.conexao,
      numero: this.conexao === 'conectado' ? '55••••••••99' : null,
      temQr: false,
      desde: this.desde,
      detalhe:
        this.conexao === 'conectado'
          ? 'Nenhuma mensagem sai do sistema ainda. Todas ficam registradas aqui.'
          : 'Envio desligado.',
    };
  }

  /** No simulado nao existe QR: nao ha nada para escanear. */
  async qrPng(): Promise<Buffer | null> {
    return null;
  }

  async enviar(mensagem: MensagemWhatsApp): Promise<ResultadoEnvio> {
    //  DESCONECTADO RECUSA, como o de verdade.
    //
    //  Ate 14/10/2026 este simulado dizia "enviei" em qualquer
    //  situacao — inclusive desligado. Dublê que nunca falha
    //  esconde justamente a falha mais comum, que e o WhatsApp
    //  cair no meio do expediente. A prova de ponta a ponta nao
    //  conseguia nem descrever esse caso.
    if (this.conexao !== 'conectado') {
      return {
        sucesso: false,
        erro: 'WhatsApp não está conectado (simulado).',
        adaptador: this.nome,
        enviadoEm: new Date(),
      };
    }

    const resultado: ResultadoEnvio = {
      sucesso: true,
      idMensagem: 'mock-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      adaptador: this.nome,
      enviadoEm: new Date(),
    };

    this.historico.unshift({
      ...resultado,
      para: mensagem.para,
      texto: mensagem.texto,
      temAnexo: Boolean(mensagem.anexo),
    });

    if (this.historico.length > AdaptadorWhatsAppMock.LIMITE_HISTORICO) {
      this.historico.length = AdaptadorWhatsAppMock.LIMITE_HISTORICO;
    }

    return resultado;
  }

  /** Usado pela tela de testes para mostrar o que seria enviado. */
  listarHistorico(): RegistroMock[] {
    return [...this.historico];
  }
}
