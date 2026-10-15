// ============================================================
//  ADAPTADOR SMTP — a conta de e-mail da própria empresa
//
//  O outro caminho era o Resend: um serviço de e-mail por HTTP,
//  rápido de ligar, mas que exige CADASTRAR O DOMÍNIO e publicar
//  registros SPF e DKIM no DNS. Isso depende de quem administra o
//  domínio da empresa — e, no caso da Porto Inc., de um domínio
//  que ainda não existe.
//
//  Aqui a empresa usa a conta que já tem. Gmail corporativo ou
//  Microsoft 365: ela entrega o endereço e uma SENHA DE APLICATIVO,
//  que uma pessoa gera sozinha em cinco minutos, sem envolver TI.
//
//  POR QUE SENHA DE APLICATIVO, e não a senha normal:
//  as duas contas exigem isso quando há verificação em duas etapas
//  — que é o padrão hoje. A senha de aplicativo serve só para este
//  uso, é revogável sozinha, e não dá acesso à caixa de entrada.
//
//  LIMITE QUE PRECISA ESTAR ESCRITO: contas comuns de Gmail e 365
//  têm teto diário de envio (algumas centenas de mensagens). Para o
//  volume da Porto Inc. — convite de cotação e pedido de compra —
//  sobra. Se um dia virar disparo em massa, o caminho é o Resend,
//  e por isso ele continua aqui ao lado em vez de ter sido
//  substituído.
// ============================================================

import type { PortaEmail, Email, ResultadoEmail } from './porta.js';

/** O que o nodemailer expõe, só a parte que usamos. */
interface Transportador {
  sendMail: (mensagem: Record<string, unknown>) => Promise<{ messageId?: string }>;
}

interface Nodemailer {
  createTransport: (opcoes: Record<string, unknown>) => Transportador;
}

export interface DadosSmtp {
  host: string;
  porta: number;
  usuario: string;
  senha: string;
  /** De onde a mensagem sai. Normalmente igual ao usuário. */
  remetente: string;
  /**
   * O nome que aparece no lugar do endereço, na caixa de entrada.
   *
   * Sem ele, o fornecedor recebe `natsu15ep@gmail.com` e precisa
   * adivinhar quem é. Com ele, lê **Porto Inc. — Compras**.
   *
   * Conta pessoal de Gmail mandando convite comercial sem nome é
   * um dos padrões que filtro de spam pontua, e é também o que faz
   * uma pessoa não abrir.
   */
  nomeRemetente?: string;
}

export class AdaptadorEmailSmtp implements PortaEmail {
  readonly nome = 'smtp';

  private transportador: Transportador | null = null;

  /**
   * A biblioteca entra pelo construtor, e só nas provas.
   *
   * Sem isto não havia como conferir o que vai no envelope — o
   * nome do remetente, o `Reply-To` e a parte HTML — sem abrir
   * conexão com um servidor de e-mail de verdade. E é exatamente o
   * tipo de coisa que quebra calada: a mensagem sai, ninguém vê
   * erro, e o fornecedor recebe um endereço cru sem nome.
   *
   * Em produção fica `undefined` e o `import('nodemailer')`
   * acontece como sempre.
   */
  constructor(
    private readonly dados: DadosSmtp,
    private readonly biblioteca?: Nodemailer,
  ) {}

  remetente(): string | null {
    return this.pronto() ? this.dados.remetente : null;
  }

  pronto(): boolean {
    return Boolean(
      this.dados.host && this.dados.porta && this.dados.usuario && this.dados.senha,
    );
  }

  /**
   * O transportador é criado uma vez e reaproveitado.
   *
   * Cada `createTransport` abre a sua própria conexão com o
   * servidor. Criando um por envio, uma rodada de convites a seis
   * fornecedores abriria seis conexões — e provedor nenhum gosta
   * disso: é o padrão que faz conta ser marcada como suspeita.
   */
  private async obter(): Promise<Transportador> {
    if (this.transportador) return this.transportador;

    const lib =
      this.biblioteca ??
      ((await import('nodemailer')) as unknown as {
        default?: Nodemailer;
      } & Nodemailer);

    const nodemailer = (lib as { default?: Nodemailer }).default ?? (lib as Nodemailer);

    this.transportador = nodemailer.createTransport({
      host: this.dados.host,
      port: this.dados.porta,
      //  465 é SSL direto; 587 começa em claro e sobe para TLS com
      //  STARTTLS. Marcar `secure` errado faz a conexão travar sem
      //  mensagem útil, e é o erro número um de quem configura SMTP.
      secure: this.dados.porta === 465,
      auth: { user: this.dados.usuario, pass: this.dados.senha },
    });

    return this.transportador;
  }

  async enviar(email: Email): Promise<ResultadoEmail> {
    const agora = new Date();

    if (!this.pronto()) {
      return {
        sucesso: false,
        erro: 'SMTP sem configuração completa: falta servidor, usuário ou senha.',
        adaptador: this.nome,
        enviadoEm: agora,
      };
    }

    try {
      const transportador = await this.obter();

      const enviada = await transportador.sendMail({
        //  COM NOME, quando houver. O nodemailer monta o
        //  `Nome <endereco>` sozinho a partir deste par — fazer a
        //  string na mão quebra em nome com acento ou com vírgula.
        from: this.dados.nomeRemetente
          ? { name: this.dados.nomeRemetente, address: this.dados.remetente }
          : this.dados.remetente,
        to: email.para,
        subject: email.assunto,
        text: email.corpo,
        //  As DUAS versões, quando a de HTML existe. O nodemailer
        //  monta `multipart/alternative` ao receber `text` e `html`
        //  juntos, e cada programa escolhe a que sabe mostrar.
        ...(email.corpoHtml ? { html: email.corpoHtml } : {}),
        //  PARA ONDE VAI A RESPOSTA.
        //
        //  Sem isto, responder cai no endereço que autenticou no
        //  SMTP — que pode não ser o do setor de compras. O ganho
        //  contra spam é pequeno; o ganho é o fornecedor conseguir
        //  responder e alguém ler.
        replyTo: this.dados.remetente,
        attachments: (email.anexos ?? []).map((a) => ({
          filename: a.nomeArquivo,
          content: a.conteudo,
          contentType: a.tipoMime,
        })),
      });

      return {
        sucesso: true,
        idMensagem: enviada?.messageId,
        adaptador: this.nome,
        enviadoEm: agora,
      };
    } catch (erro) {
      //  A MENSAGEM DO PROVEDOR VEM INTEIRA.
      //
      //  Quem configura SMTP erra em coisas específicas — senha de
      //  aplicativo não gerada, porta trocada, conta sem verificação
      //  em duas etapas — e o servidor diz exatamente qual. Trocar
      //  isso por "falha ao enviar" transforma cinco minutos de
      //  conserto numa tarde de tentativa e erro.
      return {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : 'Falha ao enviar pelo SMTP.',
        adaptador: this.nome,
        enviadoEm: agora,
      };
    }
  }
}

/**
 * Os servidores que a tela já conhece.
 *
 * Existe para a pessoa não precisar saber o que é "host" nem
 * "porta": ela escolhe Gmail, e o resto se preenche. "Outro" fica
 * para quem tem servidor próprio — e aí os campos aparecem.
 */
export const SERVIDORES_CONHECIDOS = {
  GMAIL: { host: 'smtp.gmail.com', porta: 587, nome: 'Gmail / Google Workspace' },
  MICROSOFT: { host: 'smtp.office365.com', porta: 587, nome: 'Microsoft 365 / Outlook' },
} as const;
