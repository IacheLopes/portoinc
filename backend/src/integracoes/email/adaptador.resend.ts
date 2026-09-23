// ============================================================
//  ADAPTADOR RESEND (provedor de e-mail transacional) - PRODUCAO
//
//  Estrutura pronta, credenciais ainda nao configuradas.
//  Para ativar, no futuro:
//    1. Criar conta no provedor e cadastrar o dominio da empresa
//    2. Publicar os registros SPF e DKIM no DNS do dominio
//       (sem isso o e-mail sai, mas cai na caixa de spam do
//        fornecedor - que e pior do que nao enviar)
//    3. Preencher no .env:
//         EMAIL_API_TOKEN=...
//         EMAIL_REMETENTE=compras@suaempresa.com.br
//    4. No .env: EMAIL_ADAPTER=resend
//
//  Nao exige biblioteca externa: e apenas HTTP. Se um dia a
//  empresa preferir mandar pela propria conta de e-mail (Gmail
//  corporativo, Microsoft 365), isso e um adaptador SMTP novo ao
//  lado deste - nada no resto do sistema muda.
// ============================================================

import type { PortaEmail, Email, ResultadoEmail } from './porta.js';

const URL_ENVIO = 'https://api.resend.com/emails';

export class AdaptadorEmailResend implements PortaEmail {
  readonly nome = 'resend';

  constructor(
    private readonly token: string,
    private readonly de: string,
  ) {}

  remetente(): string | null {
    return this.de || null;
  }

  pronto(): boolean {
    return Boolean(this.token && this.de);
  }

  async enviar(email: Email): Promise<ResultadoEmail> {
    const agora = new Date();

    if (!this.pronto()) {
      return {
        sucesso: false,
        erro:
          'Credenciais de e-mail ausentes. Defina EMAIL_API_TOKEN e ' +
          'EMAIL_REMETENTE no arquivo .env',
        adaptador: this.nome,
        enviadoEm: agora,
      };
    }

    try {
      const resposta = await fetch(URL_ENVIO, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + this.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.de,
          to: [email.para],
          subject: email.assunto,
          text: email.corpo,
          attachments: (email.anexos ?? []).map((a) => ({
            filename: a.nomeArquivo,
            content: a.conteudo.toString('base64'),
          })),
        }),
      });

      const dados = (await resposta.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };

      if (!resposta.ok) {
        return {
          sucesso: false,
          erro: dados.message ?? 'O provedor recusou o envio (HTTP ' + resposta.status + ').',
          adaptador: this.nome,
          enviadoEm: agora,
        };
      }

      return {
        sucesso: true,
        idMensagem: dados.id,
        adaptador: this.nome,
        enviadoEm: agora,
      };
    } catch (erro) {
      return {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : 'Falha ao falar com o provedor.',
        adaptador: this.nome,
        enviadoEm: agora,
      };
    }
  }
}
