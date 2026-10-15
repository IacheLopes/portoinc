// ============================================================
//  A IA QUE A TELA CONFIGURA
//
//  Mesmo desenho do e-mail: por baixo fica o que o `.env` manda,
//  e por cima o que alguém cadastrou na Área IA. A ordem importa
//  — quem mexeu na tela mexeu DEPOIS de quem escreveu no `.env`,
//  e a decisão mais recente é a que vale.
//
//  Quem já dependia do `.env` continua funcionando: nada do que
//  existe hoje quebra por causa da tela.
// ============================================================

import type { PortaIA, PedidoIA, RespostaIA } from './porta.js';
import { AdaptadorIaGroq } from './adaptador.groq.js';
import { cerebro } from '../../servicos/configuracao-ia.js';

export class AdaptadorIaConfiguravel implements PortaIA {
  /** Guardado por chave+modelo: trocar na tela troca o adaptador. */
  private cache: { assinatura: string; porta: AdaptadorIaGroq } | null = null;

  constructor(private readonly reserva: PortaIA) {}

  /** O que vale agora: a tela, se houver; senão o `.env`. */
  private atual(): PortaIA {
    const c = cerebro();

    if (!c.ativo || !c.chave) return this.reserva;

    const assinatura = c.chave + '|' + (c.modelo ?? '');
    if (this.cache?.assinatura !== assinatura) {
      this.cache = {
        assinatura,
        porta: new AdaptadorIaGroq({ token: c.chave, modelo: c.modelo ?? undefined }),
      };
    }

    return this.cache.porta;
  }

  get nome(): string {
    return this.atual().nome;
  }

  pronto(): boolean {
    return this.atual().pronto();
  }

  modelo(): string | null {
    return this.atual().modelo();
  }

  ehTentativaDeSequestro(texto: string): Promise<boolean> {
    return this.atual().ehTentativaDeSequestro(texto);
  }

  responder(pedido: PedidoIA): Promise<RespostaIA> {
    return this.atual().responder(pedido);
  }

  /**
   * Transcreve áudio, quando o adaptador por baixo souber.
   *
   * Opcional de propósito: o simulado não transcreve nada, e o
   * sistema sobe igual.
   */
  transcrever(audio: Buffer, tipoMime: string): Promise<string | null> {
    const atual = this.atual();
    return typeof atual.transcrever === 'function'
      ? atual.transcrever(audio, tipoMime)
      : Promise.resolve(null);
  }

  /** Os modelos que a conta tem, para a tela listar. */
  modelosDisponiveis(): Promise<string[]> {
    const atual = this.atual();
    return typeof atual.modelosDisponiveis === 'function'
      ? atual.modelosDisponiveis()
      : Promise.resolve([]);
  }
}
