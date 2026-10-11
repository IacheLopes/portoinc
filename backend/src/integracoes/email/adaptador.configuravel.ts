// ============================================================
//  O adaptador que obedece à TELA
//
//  Ele não manda e-mail: escolhe quem manda, a cada envio.
//
//    1. Se a tela configurou um remetente e uma chave, usa o
//       provedor de verdade com ELES.
//    2. Se não, usa o que o `.env` montou — o simulado, ou o
//       provedor com as credenciais do servidor.
//
//  POR QUE ISTO É UMA PEÇA SEPARADA
//
//  O jeito óbvio seria o `AdaptadorEmailResend` ler a
//  configuração sozinho. Ficaria errado por dois motivos: ele
//  passaria a conhecer o banco, que não é trabalho de uma tomada;
//  e o caminho do `.env` deixaria de existir, quebrando quem já
//  configurou assim.
//
//  Aqui ele é um TRILHO DE TOMADAS: a decisão de qual usar fica
//  num lugar só, e nem o Resend nem o simulado precisam saber que
//  essa decisão existe.
//
//  A ESCOLHA ACONTECE NO ENVIO, não na partida. É isso que faz
//  "salvar na tela e já funcionar" ser verdade em vez de pedir
//  um reinício da API.
// ============================================================

import type { PortaEmail, Email, ResultadoEmail } from './porta.js';
import { AdaptadorEmailResend } from './adaptador.resend.js';
import { configuracaoAtual } from '../../servicos/configuracao-email.js';
import { AdaptadorEmailSmtp } from './adaptador.smtp.js';

export class AdaptadorEmailConfiguravel implements PortaEmail {
  /**
   * O nome muda conforme quem vai atender.
   *
   * A tela de status mostra isto, e ela tem de dizer a verdade do
   * momento: `mock` enquanto ninguém configurou, `resend` depois
   * que alguém ligou pela tela.
   */
  get nome(): string {
    const config = configuracaoAtual();
    if (!config) return this.reserva.nome;
    return config.provedor === 'SMTP' ? 'smtp' : 'resend';
  }

  /** Ver o comentário em `enviar`: o SMTP abre conexão. */
  private smtpCache: { config: unknown; adaptador: AdaptadorEmailSmtp } | null = null;

  constructor(private readonly reserva: PortaEmail) {}

  remetente(): string | null {
    return configuracaoAtual()?.remetente ?? this.reserva.remetente();
  }

  pronto(): boolean {
    return configuracaoAtual() !== null || this.reserva.pronto();
  }

  async enviar(email: Email): Promise<ResultadoEmail> {
    const config = configuracaoAtual();
    if (!config) return this.reserva.enviar(email);

    //  QUEM ATENDE DEPENDE DO QUE A TELA ESCOLHEU.
    //
    //  SMTP manda pela conta de e-mail da própria empresa; Resend
    //  manda por um serviço, e exige o domínio cadastrado no DNS.
    //  A escolha mora no banco, não aqui — e muda sem reiniciar.
    if (config.provedor === 'SMTP' && config.smtp) {
      //  O transportador do SMTP abre conexão, então ele NÃO é
      //  descartável como o do Resend: guardamos enquanto a
      //  configuração for a mesma. Trocou a configuração, o
      //  `recarregar` devolve outro objeto e este cache cai fora.
      if (this.smtpCache?.config !== config) {
        this.smtpCache = {
          config,
          adaptador: new AdaptadorEmailSmtp({
            host: config.smtp.host,
            porta: config.smtp.porta,
            usuario: config.smtp.usuario,
            senha: config.chave,
            remetente: config.remetente,
          }),
        };
      }

      return this.smtpCache.adaptador.enviar(email);
    }

    //  Criar o Resend é só guardar duas strings — não abre conexão,
    //  não custa nada — e assim uma troca de chave vale no envio
    //  seguinte, sem cache para invalidar.
    const provedor = new AdaptadorEmailResend(config.chave, config.remetente);
    return provedor.enviar(email);
  }
}
