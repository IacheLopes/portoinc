// ============================================================
//  ADAPTADOR SIMULADO (mock) - o padrao
//
//  Nao manda e-mail para ninguem. Guarda o que SERIA enviado,
//  para conferir na tela. Risco zero: nenhuma caixa de entrada
//  de verdade e tocada.
// ============================================================

import type { PortaEmail, Email, ResultadoEmail } from './porta.js';

export interface RegistroEmailMock extends ResultadoEmail {
  para: string;
  assunto: string;
  corpo: string;
  anexos: number;
}

export class AdaptadorEmailMock implements PortaEmail {
  readonly nome = 'mock';

  /** Historico do que seria enviado. Limitado para nao comer memoria. */
  private readonly historico: RegistroEmailMock[] = [];
  private static readonly LIMITE_HISTORICO = 100;

  remetente(): string | null {
    return 'simulado@portoinc.local';
  }

  /** O simulado esta sempre pronto: nao depende de nada de fora. */
  pronto(): boolean {
    return true;
  }

  async enviar(email: Email): Promise<ResultadoEmail> {
    const resultado: ResultadoEmail = {
      sucesso: true,
      idMensagem: 'mock-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      adaptador: this.nome,
      enviadoEm: new Date(),
    };

    this.historico.unshift({
      ...resultado,
      para: email.para,
      assunto: email.assunto,
      corpo: email.corpo,
      anexos: email.anexos?.length ?? 0,
    });

    if (this.historico.length > AdaptadorEmailMock.LIMITE_HISTORICO) {
      this.historico.length = AdaptadorEmailMock.LIMITE_HISTORICO;
    }

    return resultado;
  }

  /** Usado pela tela de testes para mostrar o que seria enviado. */
  listarHistorico(): RegistroEmailMock[] {
    return [...this.historico];
  }
}
