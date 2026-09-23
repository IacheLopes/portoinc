// ============================================================
//  A tela inicial
//
//  Uma chamada só traz tudo, já filtrado pelas permissões de quem
//  pediu. Quem decide o que é urgente é o servidor — a tela só
//  desenha, e por isso não há como ela e a fila de aprovação
//  discordarem sobre o mesmo número.
// ============================================================

import { chamar } from './api';

export type Tom = 'neutro' | 'atencao' | 'erro';

export interface CartaoDoInicio {
  chave: string;
  rotulo: string;
  valor: number;
  detalhe: string;
  tom: Tom;
  para: string;
}

export interface ResumoDoInicio {
  /** O que pede ação hoje. Vazio quer dizer: está tudo em dia. */
  urgentes: CartaoDoInicio[];
  /** Acompanhamento: bom saber, não cobra nada. */
  acompanhar: CartaoDoInicio[];
}

export function buscarInicio(): Promise<ResumoDoInicio> {
  return chamar<ResumoDoInicio>('/api/inicio');
}
