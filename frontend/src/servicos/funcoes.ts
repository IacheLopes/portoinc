// ============================================================
//  Funções e permissões
//
//  A listagem já existia, dentro do cliente de Usuários — era
//  dela que a tela de Usuários montava as caixas de função.
//  Criar, ajustar e apagar nasceram em 09/10/2026, quando a
//  análise de coerência achou que "as funções devem ser criáveis
//  dentro do sistema" estava na primeira página do fluxo de
//  compras, dado como confirmado, e não existia.
// ============================================================

import { chamar } from './api';

export interface PermissaoDaFuncao {
  codigo: string;
  nome: string;
  grupo: string;
}

export interface Funcao {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  /** Veio com o sistema: nome e código travados, e não se apaga. */
  sistema: boolean;
  /** Quantas pessoas estão com ela. */
  usuarios: number;
  permissoes: PermissaoDaFuncao[];
}

export interface Permissao {
  id: string;
  codigo: string;
  nome: string;
  /** Almoxarifado, Cadastros, Compras, Financeiro, Locação... */
  grupo: string;
}

export interface FuncaoParaGravar {
  codigo?: string;
  nome?: string;
  descricao?: string | null;
  permissoes: string[];
}

export function listarFuncoes() {
  return chamar<{ funcoes: Funcao[] }>('/api/funcoes');
}

/**
 * As permissões que a tela oferece.
 *
 * Não são todas as que existem: `sistema.status` fica de fora,
 * porque abre o diagnóstico e o guia promete que essa tela não
 * aparece para mais ninguém.
 */
export function listarPermissoes() {
  return chamar<{ permissoes: Permissao[] }>('/api/permissoes');
}

export function criarFuncao(dados: FuncaoParaGravar) {
  return chamar<{ funcao: Funcao }>('/api/funcoes', { metodo: 'POST', corpo: dados });
}

export function editarFuncao(id: string, dados: Partial<FuncaoParaGravar>) {
  return chamar<{ funcao: Funcao }>('/api/funcoes/' + id, { metodo: 'PATCH', corpo: dados });
}

export function apagarFuncao(id: string) {
  return chamar<{ ok: boolean; mensagem: string }>('/api/funcoes/' + id, { metodo: 'DELETE' });
}
