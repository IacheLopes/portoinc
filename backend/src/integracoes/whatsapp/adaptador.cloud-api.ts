// ============================================================
//  ADAPTADOR WHATSAPP CLOUD API (oficial da Meta) - PRODUCAO
//
//  Estrutura pronta, credenciais ainda nao configuradas.
//  Para ativar, no futuro:
//    1. Criar conta no Meta Business e verificar a empresa
//    2. Cadastrar os modelos de mensagem e aguardar aprovacao
//    3. Preencher no .env:
//         WHATSAPP_CLOUD_TOKEN=...
//         WHATSAPP_CLOUD_PHONE_ID=...
//    4. No .env: WHATSAPP_ADAPTER=cloud-api
//
//  Nao exige biblioteca externa: e apenas HTTP.
// ============================================================

import type {
  PortaWhatsApp, MensagemWhatsApp, ResultadoEnvio, EstadoConexao, SituacaoWhatsApp,
} from './porta.js';

const URL_BASE = 'https://graph.facebook.com/v21.0';

export class AdaptadorWhatsAppCloudApi implements PortaWhatsApp {
  readonly nome = 'cloud-api';
  private conexao: EstadoConexao = 'desconectado';

  constructor(
    private readonly token: string,
    private readonly idTelefone: string,
  ) {}

  async conectar(): Promise<void> {
    if (!this.token || !this.idTelefone) {
      this.conexao = 'erro';
      throw new Error(
        'Credenciais da WhatsApp Cloud API ausentes. Defina ' +
        'WHATSAPP_CLOUD_TOKEN e WHATSAPP_CLOUD_PHONE_ID no arquivo .env',
      );
    }
    this.conexao = 'conectado';
  }

  async desconectar(): Promise<void> {
    this.conexao = 'desconectado';
  }

  estado(): EstadoConexao {
    return this.conexao;
  }

  situacao(): SituacaoWhatsApp {
    return {
      estado: this.conexao,
      numero: null,
      temQr: false,
      desde: null,
      detalhe:
        'API oficial: a conexão é por token, não por QR Code. ' +
        'Quem autoriza o número é a Meta, no painel da conta comercial.',
    };
  }

  /** A API oficial nao usa QR: a autorizacao e por token. */
  async qrPng(): Promise<Buffer | null> {
    return null;
  }

  async enviar(mensagem: MensagemWhatsApp): Promise<ResultadoEnvio> {
    const agora = new Date();
    try {
      const resposta = await fetch(URL_BASE + '/' + this.idTelefone + '/messages', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + this.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: mensagem.para,
          type: 'text',
          text: { body: mensagem.texto },
        }),
      });

      if (!resposta.ok) {
        return {
          sucesso: false,
          erro: 'Meta respondeu ' + resposta.status + ': ' + (await resposta.text()),
          adaptador: this.nome,
          enviadoEm: agora,
        };
      }

      const dados = (await resposta.json()) as { messages?: Array<{ id: string }> };
      return {
        sucesso: true,
        idMensagem: dados.messages?.[0]?.id,
        adaptador: this.nome,
        enviadoEm: agora,
      };
    } catch (erro) {
      return {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : 'Falha desconhecida',
        adaptador: this.nome,
        enviadoEm: agora,
      };
    }
  }
}
