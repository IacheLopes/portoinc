// ============================================================
//  Chamadas da tela de e-mail
//
//  O fluxo de compras manda o pedido sair "por e-mail/WhatsApp".
//  Esta é a metade do e-mail, com a mesma trava do WhatsApp.
// ============================================================

import { chamar } from './api';
import type { SituacaoMensagem } from './whatsapp';

export interface SituacaoEmail {
  adaptador: string;
  simulado: boolean;
  pronto: boolean;
  remetente: string | null;
  modoTeste: boolean;
  detalhe: string;
}

export interface EmailAutorizado {
  id: string;
  email: string;
  emailMascarado: string;
  nome: string;
  observacao: string | null;
  criadoPor: string;
  criadoEm: string;
}

export interface EmailDoHistorico {
  id: string;
  emailMascarado: string;
  destino: string | null;
  assunto: string;
  corpo: string;
  temAnexo: boolean;
  situacao: SituacaoMensagem;
  erro: string | null;
  adaptador: string;
  contexto: string | null;
  referencia: string | null;
  enviadoPor: string | null;
  criadoEm: string;
}

export interface RespostaDeEnvio {
  sucesso: boolean;
  bloqueado: boolean;
  mensagem: string;
}

export function buscarSituacaoEmail() {
  return chamar<SituacaoEmail>('/api/email/situacao');
}

export function listarEmailsAutorizados() {
  return chamar<{ modoTeste: boolean; autorizados: EmailAutorizado[] }>('/api/email/autorizados');
}

export function autorizarEmail(dados: { email: string; nome: string; observacao?: string }) {
  return chamar<{ autorizado: EmailAutorizado; mensagem: string }>('/api/email/autorizados', {
    metodo: 'POST',
    corpo: dados,
  });
}

export function removerEmailAutorizado(id: string) {
  return chamar<{ ok: boolean; mensagem: string }>('/api/email/autorizados/' + id, {
    metodo: 'DELETE',
  });
}

export function enviarEmailDeTeste(dados: { para: string; assunto?: string; corpo?: string }) {
  return chamar<RespostaDeEnvio>('/api/email/teste', { metodo: 'POST', corpo: dados });
}

export function listarHistoricoDeEmail() {
  return chamar<{ historico: EmailDoHistorico[] }>('/api/email/historico');
}

export function convidarPorEmail(cotacaoId: string) {
  return chamar<{
    enviados: number;
    bloqueados: number;
    mensagem: string;
    resultados: Array<{
      fornecedor: string;
      sucesso: boolean;
      bloqueado: boolean;
      mensagem: string;
    }>;
  }>('/api/cotacoes/' + cotacaoId + '/convidar-email', { metodo: 'POST' });
}

export function enviarPedidoPorEmail(pedidoId: string) {
  return chamar<RespostaDeEnvio>('/api/pedidos/' + pedidoId + '/enviar-email', {
    metodo: 'POST',
  });
}
