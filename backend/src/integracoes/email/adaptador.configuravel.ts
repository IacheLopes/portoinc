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

export class AdaptadorEmailConfiguravel implements PortaEmail {
  /**
   * O nome muda conforme quem vai atender.
   *
   * A tela de status mostra isto, e ela tem de dizer a verdade do
   * momento: `mock` enquanto ninguém configurou, `resend` depois
   * que alguém ligou pela tela.
   */
  get nome(): string {
    return configuracaoAtual() ? 'resend' : this.reserva.nome;
  }

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

    //  Um adaptador por envio. Criar o Resend é só guardar duas
    //  strings — não abre conexão, não custa nada — e assim uma
    //  troca de chave vale no envio seguinte, sem cache para
    //  invalidar e sem estado velho escondido aqui dentro.
    const provedor = new AdaptadorEmailResend(config.chave, config.remetente);
    return provedor.enviar(email);
  }
}
