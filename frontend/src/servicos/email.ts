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
  detalhe: string;
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

// ------------------------------------------------------------
//  Ligar o e-mail pela TELA
//
//  Ate 10/10/2026 isto era um arquivo no servidor mais um
//  reinicio da API. O WhatsApp nunca foi assim — ele se conecta
//  pela tela —, e o e-mail e que estava fora do padrao da casa.
// ------------------------------------------------------------

export interface ConfiguracaoDeEmail {
  configurado: boolean;
  remetente: string | null;
  /** So o fim da chave, para reconhecer qual e. Nunca ela inteira. */
  chaveParcial: string | null;
  /** Quando um envio de verdade chegou. E o que vira "funcionando". */
  confirmadoEm: string | null;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
  ativo: boolean;
}

export interface RespostaDeLigar {
  ok: boolean;
  guardado?: boolean;
  mensagem?: string;
  erro?: string;
  configuracao: ConfiguracaoDeEmail;
}

export function buscarConfiguracaoDeEmail() {
  return chamar<ConfiguracaoDeEmail>('/api/email/configuracao');
}

/** Guarda E PROVA: manda um e-mail de teste na hora. */
export function ligarEmail(dados: {
  /** SMTP usa a conta da própria empresa; RESEND, o serviço. */
  provedor?: 'RESEND' | 'SMTP';
  remetente: string;
  /** Token da API no Resend; senha de aplicativo no SMTP. */
  chave: string;
  smtpHost?: string;
  smtpPorta?: number;
  smtpUsuario?: string;
  provaPara?: string;
}) {
  return chamar<RespostaDeLigar>('/api/email/configuracao', {
    metodo: 'POST',
    corpo: dados,
  });
}

export function desligarEmail() {
  return chamar<RespostaDeLigar>('/api/email/configuracao/desligar', { metodo: 'POST' });
}

export function religarEmail() {
  return chamar<RespostaDeLigar>('/api/email/configuracao/religar', { metodo: 'POST' });
}
