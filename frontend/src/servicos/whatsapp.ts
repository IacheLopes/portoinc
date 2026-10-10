// ============================================================
//  Chamadas da tela de WhatsApp (Etapa 10)
// ============================================================

import { chamar, buscarImagem } from './api';

export type EstadoConexao =
  | 'desconectado'
  | 'iniciando'
  | 'qr_pronto'
  | 'aguardando_leitura'
  | 'autenticando'
  | 'conectado'
  | 'reconectando'
  | 'deslogado'
  | 'erro';

export const ROTULO_ESTADO: Record<EstadoConexao, string> = {
  desconectado: 'Desligado',
  iniciando: 'Iniciando',
  qr_pronto: 'QR Code pronto',
  aguardando_leitura: 'Esperando leitura',
  autenticando: 'Autenticando',
  conectado: 'Conectado',
  reconectando: 'Reconectando',
  deslogado: 'Sessão encerrada',
  erro: 'Erro',
};

export const COR_ESTADO: Record<EstadoConexao, 'info' | 'sucesso' | 'atencao' | 'erro'> = {
  desconectado: 'info',
  iniciando: 'info',
  qr_pronto: 'atencao',
  aguardando_leitura: 'atencao',
  autenticando: 'atencao',
  conectado: 'sucesso',
  reconectando: 'atencao',
  deslogado: 'erro',
  erro: 'erro',
};

export type SituacaoMensagem = 'ENVIADA' | 'FALHOU' | 'BLOQUEADA';

export const ROTULO_MENSAGEM: Record<SituacaoMensagem, string> = {
  ENVIADA: 'Enviada',
  FALHOU: 'Falhou',
  BLOQUEADA: 'Bloqueada',
};

export const COR_MENSAGEM: Record<SituacaoMensagem, 'info' | 'sucesso' | 'atencao' | 'erro'> = {
  ENVIADA: 'sucesso',
  FALHOU: 'erro',
  BLOQUEADA: 'atencao',
};

/** O que o diario da conexao responde. */
export interface ResumoDaConexao {
  /** Quando a conexao ATUAL comecou. Nulo se nao esta no ar. */
  noArDesde: string | null;
  /** Quando esteve no ar pela ultima vez, mesmo que ja tenha saido. */
  ultimaVezNoAr: string | null;
  ultimaQueda: { quando: string; detalhe: string | null } | null;
  ultimoFim: { quando: string; detalhe: string | null } | null;
  quedasEm24h: number;
}

export interface SituacaoWhatsApp {
  adaptador: string;
  simulado: boolean;
  modoTeste: boolean;
  numerosAutorizados: number;
  estado: EstadoConexao;
  numero: string | null;
  temQr: boolean;
  /**
   * Ha quanto tempo o adaptador esta NESTE estado.
   *
   * Nao e a hora da conexao: numa reconexao e a hora da ultima
   * tentativa. Para a pergunta "a que horas subiu?", use
   * `conexao.noArDesde`.
   */
  desde: string | null;
  detalhe: string | null;
  conexao: ResumoDaConexao;
}

export interface NumeroAutorizado {
  id: string;
  numero: string;
  numeroMascarado: string;
  nome: string;
  observacao: string | null;
  criadoPor: string;
  criadoEm: string;
}

export interface MensagemDoHistorico {
  id: string;
  numeroMascarado: string;
  destino: string | null;
  texto: string;
  temAnexo: boolean;
  situacao: SituacaoMensagem;
  erro: string | null;
  adaptador: string;
  contexto: string | null;
  referencia: string | null;
  enviadoPor: string | null;
  criadoEm: string;
}

export function buscarSituacao() {
  return chamar<SituacaoWhatsApp>('/api/whatsapp/situacao');
}


export function conectar() {
  return chamar<SituacaoWhatsApp & { ok: boolean; mensagem: string }>('/api/whatsapp/conectar', {
    metodo: 'POST',
  });
}

export function desconectar() {
  return chamar<SituacaoWhatsApp & { ok: boolean; mensagem: string }>('/api/whatsapp/desconectar', {
    metodo: 'POST',
  });
}

export function listarAutorizados() {
  return chamar<{ modoTeste: boolean; autorizados: NumeroAutorizado[] }>(
    '/api/whatsapp/autorizados',
  );
}

export function autorizarNumero(dados: { numero: string; nome: string; observacao?: string }) {
  return chamar<{ autorizado: NumeroAutorizado; mensagem: string }>('/api/whatsapp/autorizados', {
    metodo: 'POST',
    corpo: dados,
  });
}

export function removerAutorizado(id: string) {
  return chamar<{ ok: boolean; mensagem: string }>('/api/whatsapp/autorizados/' + id, {
    metodo: 'DELETE',
  });
}

export function enviarTeste(dados: { para: string; texto: string }) {
  return chamar<{ sucesso: boolean; bloqueado: boolean; mensagem: string }>(
    '/api/whatsapp/testar',
    { metodo: 'POST', corpo: dados },
  );
}

export function listarHistorico() {
  return chamar<{ mensagens: MensagemDoHistorico[] }>('/api/whatsapp/historico');
}

export function enviarConvites(cotacaoId: string) {
  return chamar<{
    ok: boolean;
    mensagem: string;
    resultados: Array<{
      fornecedor: string;
      sucesso: boolean;
      bloqueado: boolean;
      mensagem: string;
    }>;
  }>('/api/cotacoes/' + cotacaoId + '/enviar-convites', { metodo: 'POST' });
}

export function enviarPedidoPorWhatsApp(pedidoId: string) {
  return chamar<{ sucesso: boolean; bloqueado: boolean; mensagem: string }>(
    '/api/pedidos/' + pedidoId + '/enviar-whatsapp',
    { metodo: 'POST' },
  );
}

/**
 * Busca o PNG do QR Code e devolve um endereço temporário.
 *
 * O carimbo de tempo impede o navegador de guardar em cache e
 * mostrar um QR já vencido.
 */
export function buscarQr(): Promise<string | null> {
  return buscarImagem('/api/whatsapp/qr?t=' + Date.now());
}
