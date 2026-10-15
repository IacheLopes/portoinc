// ============================================================
//  ADAPTADOR SIMULADO da IA
//
//  Existe pelo mesmo motivo dos outros simulados do sistema: as
//  provas automáticas não podem depender de internet, de chave
//  válida nem de quanto a Groq está cobrando hoje.
//
//  E tem um motivo a mais, só deste: modelo de linguagem NÃO
//  RESPONDE IGUAL DUAS VEZES. Um teste que mandasse a pergunta
//  de verdade e conferisse a resposta falharia sozinho na
//  terça-feira seguinte, sem ninguém ter mexido em nada.
//
//  O QUE SE TESTA COM ELE: que a conversa é montada certo, que a
//  ferramenta pedida é executada, que o resultado volta para o
//  modelo e que a resposta final é registrada. Ou seja, a
//  MECÂNICA — que é nossa. A qualidade do texto é da Groq.
// ============================================================

import type { PortaIA, PedidoIA, RespostaIA } from './porta.js';

export class AdaptadorIaMock implements PortaIA {
  readonly nome = 'mock';

  /**
   * O que ela vai responder na próxima vez.
   *
   * O teste enfileira o roteiro e confere o que o sistema fez com
   * ele. Vazio, ela responde uma frase neutra.
   */
  private roteiro: RespostaIA[] = [];

  /** Tudo que recebeu, para o teste conferir o que foi pedido. */
  readonly recebidos: PedidoIA[] = [];

  /** Texto que o classificador vai considerar sequestro. */
  private suspeitos = new Set<string>();

  pronto(): boolean {
    return true;
  }

  modelo(): string | null {
    return 'simulado';
  }

  /** O teste diz o que a IA deve responder, na ordem. */
  enfileirar(...respostas: Partial<RespostaIA>[]): void {
    for (const r of respostas) {
      this.roteiro.push({
        texto: r.texto ?? null,
        chamadas: r.chamadas ?? [],
        modelo: 'simulado',
        tokens: r.tokens ?? { entrada: 0, saida: 0 },
        adaptador: this.nome,
      });
    }
  }

  marcarComoSequestro(texto: string): void {
    this.suspeitos.add(texto);
  }

  async ehTentativaDeSequestro(texto: string): Promise<boolean> {
    return this.suspeitos.has(texto);
  }

  async responder(pedido: PedidoIA): Promise<RespostaIA> {
    this.recebidos.push(pedido);

    return (
      this.roteiro.shift() ?? {
        texto: 'Não consegui consultar isso agora.',
        chamadas: [],
        modelo: 'simulado',
        tokens: { entrada: 0, saida: 0 },
        adaptador: this.nome,
      }
    );
  }
}
