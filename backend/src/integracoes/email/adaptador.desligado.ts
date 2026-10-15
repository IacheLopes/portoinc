// ============================================================
//  E-MAIL DESLIGADO — o padrão de uma instalação nova
//
//  Substituiu o simulado no caminho de produção em 15/10/2026.
//
//  O simulado dizia `pronto: true` e devolvia `sucesso: true` sem
//  nada sair. Serviu enquanto o e-mail estava em construção, e
//  virou armadilha depois: a tela mostrava verde, o histórico
//  enchia de "enviado", e nenhuma caixa de entrada do mundo tinha
//  recebido coisa alguma. É o mesmo defeito que o simulado do
//  WhatsApp tinha — e lá ele escondeu, por uma noite inteira, que
//  as respostas do assistente não estavam saindo.
//
//  Este aqui não finge. Enquanto ninguém cadastrar a conta da
//  empresa, ele diz que está desligado e recusa cada envio com a
//  razão escrita por extenso.
//
//  Não é o mesmo que estar quebrado: é o estado correto de um
//  sistema recém-instalado, em que ninguém ligou o e-mail ainda.
// ============================================================

import type { PortaEmail, Email, ResultadoEmail } from './porta.js';

const COMO_LIGAR =
  'O e-mail ainda não foi ligado. Cadastre a conta da empresa em ' +
  'Administração → Comunicação → E-mail.';

export class AdaptadorEmailDesligado implements PortaEmail {
  readonly nome = 'desligado';

  remetente(): string | null {
    return null;
  }

  pronto(): boolean {
    return false;
  }

  async enviar(_email: Email): Promise<ResultadoEmail> {
    return {
      sucesso: false,
      erro: COMO_LIGAR,
      adaptador: this.nome,
      enviadoEm: new Date(),
    };
  }
}
