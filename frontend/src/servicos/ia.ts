// ============================================================
//  Chamadas da Área IA
//
//  O cérebro do assistente: o nome por que ele atende, as
//  instruções que moldam o jeito dele, o modelo, os grupos
//  liberados e as chaves de ligar.
// ============================================================

import { chamar } from './api';

export interface SituacaoIA {
  nome: string;
  instrucoes: string | null;
  modelo: string | null;
  modeloEscolhido: string | null;
  /** Mostra que a chave existe sem mostrar o que é. */
  chaveMascarada: string | null;
  temChave: boolean;
  adaptador: string;
  simulado: boolean;
  pronto: boolean;
  ativo: boolean;
  responderNoPrivado: boolean;
  exigirNomeEmGrupo: boolean;
  transcreverAudio: boolean;
  limitePorHora: number;
  confirmadoEm: string | null;
  atualizadoEm: string | null;
}

export interface GrupoDoAssistente {
  id: string;
  nome: string | null;
  liberado: boolean;
  vistoEm: string;
  liberadoEm: string | null;
}

export interface ConversaDoAssistente {
  id: string;
  direcao: 'ENTRADA' | 'SAIDA';
  numeroMascarado: string;
  deQuem: string | null;
  texto: string;
  situacao: string;
  erro: string | null;
  modelo: string | null;
  consultas: string[];
  tokens: number | null;
  ehGrupo: boolean;
  criadoEm: string;
}

export interface AjusteDoCerebro {
  nome?: string;
  instrucoes?: string | null;
  modelo?: string | null;
  chave?: string;
  ativo?: boolean;
  responderNoPrivado?: boolean;
  exigirNomeEmGrupo?: boolean;
  transcreverAudio?: boolean;
  limitePorHora?: number;
}

export interface ItemDoDiagnostico {
  chave: string;
  titulo: string;
  ok: boolean;
  falta: string;
}

export function buscarDiagnostico() {
  return chamar<{ pronto: boolean; itens: ItemDoDiagnostico[] }>('/api/ia/diagnostico');
}

export function buscarSituacaoIA() {
  return chamar<SituacaoIA>('/api/ia/situacao');
}

export function listarModelosIA() {
  //  Vai até o provedor perguntar o catálogo da conta.
  return chamar<{ modelos: string[] }>('/api/ia/modelos', { espera: 30000 });
}

export function salvarCerebro(dados: AjusteDoCerebro) {
  return chamar<{ mensagem: string }>('/api/ia/cerebro', { metodo: 'PATCH', corpo: dados });
}

export function ligarIA(dados: AjusteDoCerebro) {
  return chamar<{ mensagem: string; modelo: string; resposta: string | null }>('/api/ia/ligar', {
    metodo: 'POST',
    corpo: dados,
    //  Ligar faz uma pergunta de prova ao modelo: é uma ida ao
    //  provedor, com fila. Não cabe nos 15 segundos de sempre.
    espera: 60000,
  });
}

export function desligarIA() {
  return chamar<{ mensagem: string }>('/api/ia/desligar', { metodo: 'POST' });
}

export function perguntarAoAssistente(pergunta: string) {
  return chamar<{
    resposta: string;
    consultas: string[];
    querUmaPessoa: boolean;
    modelo: string | null;
    tokens: number;
  }>('/api/ia/perguntar', { metodo: 'POST', corpo: { pergunta }, espera: 90000 });
}

export function listarGruposDoAssistente() {
  return chamar<{ grupos: GrupoDoAssistente[] }>('/api/ia/grupos');
}

/** Os grupos do WhatsApp conectado que ainda não estão na lista. */
export function listarGruposDisponiveis() {
  //  Vai até o WhatsApp buscar os grupos da conta.
  return chamar<{ grupos: Array<{ jid: string; nome: string | null }>; conectado: boolean }>(
    '/api/ia/grupos-disponiveis',
    { espera: 30000 },
  );
}

export function adicionarGrupo(jid: string) {
  return chamar<{ mensagem: string }>('/api/ia/grupos', {
    metodo: 'POST',
    corpo: { jid },
    espera: 30000,
  });
}

export function tirarGrupo(id: string) {
  return chamar<{ mensagem: string }>('/api/ia/grupos/' + id, { metodo: 'DELETE' });
}

export function listarConversasDoAssistente() {
  return chamar<{ conversas: ConversaDoAssistente[] }>('/api/ia/conversas');
}

export function testarNome(frase: string) {
  return chamar<{ nome: string; chamaria: boolean }>('/api/ia/testar-nome', {
    metodo: 'POST',
    corpo: { frase },
  });
}
