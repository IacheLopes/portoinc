// ============================================================
//  O histórico de tudo que saiu do sistema
//
//  Uma lista só para os dois canais: WhatsApp e e-mail levam o
//  MESMO convite e o MESMO pedido, e quem pergunta "o BID-00005
//  saiu?" não quer perguntar duas vezes.
// ============================================================

import { chamar } from './api';

export type Canal = 'whatsapp' | 'email';
export type SituacaoEnvio = 'ENVIADA' | 'FALHOU' | 'BLOQUEADA';

export interface ItemDoHistorico {
  id: string;
  canal: Canal;
  /** Para quem foi, sempre mascarado. */
  para: string;
  destino: string | null;
  /** O texto no WhatsApp, o assunto no e-mail. */
  resumo: string;
  temAnexo: boolean;
  situacao: SituacaoEnvio;
  erro: string | null;
  contexto: string | null;
  referencia: string | null;
  quem: string | null;
  quando: string;
}

export interface PaginaDoHistorico {
  itens: ItemDoHistorico[];
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
}

export interface FiltroDoHistorico {
  canal?: Canal | 'todos';
  situacao?: SituacaoEnvio | 'todas';
  dias?: number;
  termo?: string;
  pagina?: number;
}

export function buscarHistoricoDeComunicacao(filtro: FiltroDoHistorico = {}) {
  const q = new URLSearchParams();

  if (filtro.canal && filtro.canal !== 'todos') q.set('canal', filtro.canal);
  if (filtro.situacao && filtro.situacao !== 'todas') q.set('situacao', filtro.situacao);
  if (filtro.dias) q.set('dias', String(filtro.dias));
  if (filtro.termo?.trim()) q.set('termo', filtro.termo.trim());
  if (filtro.pagina && filtro.pagina > 1) q.set('pagina', String(filtro.pagina));

  const texto = q.toString();
  return chamar<PaginaDoHistorico>('/api/comunicacao/historico' + (texto ? '?' + texto : ''));
}

/** O nome do canal na tela. */
export const ROTULO_CANAL: Record<Canal, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
};

/** De onde o envio partiu, em português. */
export const ROTULO_CONTEXTO: Record<string, string> = {
  cotacao: 'Convite de cotação',
  pedido: 'Pedido de compra',
  teste: 'Teste de conexão',
};
