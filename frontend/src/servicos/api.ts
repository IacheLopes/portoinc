// ============================================================
//  Conversa com a API
//
//  Um único lugar fala com o backend. Ele cuida de três coisas:
//    1. anexar o crachá (token) em toda chamada
//    2. renovar o crachá sozinho quando vencer
//    3. transformar erro técnico em mensagem que o usuário entende
// ============================================================

export interface UsuarioLogado {
  id: string;
  nome: string;
  email: string;
  precisaTrocarSenha: boolean;
  funcoes: string[];
  permissoes: string[];
}

export interface ResumoIntegracao {
  area: string;
  adaptador: string;
  simulado: boolean;
  descricao: string;
}

export interface StatusSistema {
  sistema: string;
  versao: string;
  ambiente: string;
  ligadoHaSegundos: number;
  banco: { conectado: boolean; funcoesCadastradas: number; usuariosCadastrados: number };
  memoria: { usadaMb: number; limiteMb: number };
  integracoes: ResumoIntegracao[];
}

export interface FuncaoResumo {
  id: string;
  codigo: string;
  nome: string;
}

export interface UsuarioAdmin {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  precisaTrocarSenha: boolean;
  ultimoAcesso: string | null;
  criadoEm: string;
  funcoes: FuncaoResumo[];
}

export interface DetalheErro {
  campo: string;
  mensagem: string;
}

export class ErroApi extends Error {
  constructor(
    mensagem: string,
    readonly status?: number,
    readonly detalhes?: DetalheErro[] | string[],
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

// ------------------------------------------------------------
//  O crachá fica só na memória, nunca no localStorage.
//  Assim um script malicioso na página não consegue roubá-lo.
// ------------------------------------------------------------
let tokenAtual: string | null = null;
let aoPerderSessao: (() => void) | null = null;

export function guardarToken(token: string | null) {
  tokenAtual = token;
}

export function aoDeslogar(callback: () => void) {
  aoPerderSessao = callback;
}

async function interpretarErro(resposta: Response): Promise<never> {
  let corpo: { erro?: string; detalhes?: DetalheErro[] | string[] } = {};

  try {
    corpo = await resposta.json();
  } catch {
    /* resposta sem JSON */
  }

  throw new ErroApi(
    corpo.erro ?? 'O servidor respondeu com erro ' + resposta.status + '.',
    resposta.status,
    corpo.detalhes,
  );
}

export interface Opcoes {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  corpo?: unknown;
  /** Impede laço infinito na renovação. */
  semRenovar?: boolean;
}

export async function chamar<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { metodo = 'GET', corpo, semRenovar = false } = opcoes;

  const cabecalhos: Record<string, string> = { Accept: 'application/json' };
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  if (tokenAtual) cabecalhos.Authorization = 'Bearer ' + tokenAtual;

  let resposta: Response;

  try {
    resposta = await fetch(caminho, {
      method: metodo,
      headers: cabecalhos,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      credentials: 'include', // envia o cookie da sessão
      signal: AbortSignal.timeout(15000),
    });
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'TimeoutError') {
      throw new ErroApi('O servidor demorou demais para responder.');
    }
    throw new ErroApi('Não foi possível falar com o servidor. Verifique se a API está no ar.');
  }

  // Crachá vencido: tenta renovar uma vez e repete a chamada.
  if (resposta.status === 401 && !semRenovar) {
    const renovou = await tentarRenovar();

    if (renovou) {
      return chamar<T>(caminho, { ...opcoes, semRenovar: true });
    }

    tokenAtual = null;
    aoPerderSessao?.();
    return interpretarErro(resposta);
  }

  if (!resposta.ok) return interpretarErro(resposta);
  if (resposta.status === 204) return undefined as T;

  return (await resposta.json()) as T;
}

// ------------------------------------------------------------
//  Renovação da sessão: uma de cada vez
//
//  O cookie da sessão é de uso único. A cada renovação ele é
//  trocado por um novo e o antigo deixa de valer na hora — é o
//  que impede alguém de reaproveitar um cookie roubado.
//
//  O efeito colateral: se duas chamadas pedirem renovação ao
//  mesmo tempo (uma tela que carrega três listas de uma vez, ou
//  a mesma pessoa com duas abas abertas), a segunda chega com o
//  cookie já trocado e a sessão cai sem motivo nenhum.
//
//  Por isso existe uma "fila de uma vaga": a primeira chamada
//  renova e todas as outras esperam essa mesma resposta.
// ------------------------------------------------------------
let renovacaoEmAndamento: Promise<UsuarioLogado | null> | null = null;

function renovarSessao(): Promise<UsuarioLogado | null> {
  if (renovacaoEmAndamento) return renovacaoEmAndamento;

  renovacaoEmAndamento = (async () => {
    try {
      const resposta = await fetch('/api/autenticacao/renovar', {
        method: 'POST',
        credentials: 'include',
      });

      if (!resposta.ok) return null;

      const dados = (await resposta.json()) as { token: string; usuario: UsuarioLogado };
      tokenAtual = dados.token;
      return dados.usuario;
    } catch {
      return null;
    } finally {
      // Libera a vaga só no ciclo seguinte: quem caiu em 401 quase
      // junto ainda aproveita esta renovação em vez de pedir outra.
      setTimeout(() => {
        renovacaoEmAndamento = null;
      }, 0);
    }
  })();

  return renovacaoEmAndamento;
}

async function tentarRenovar(): Promise<boolean> {
  return (await renovarSessao()) !== null;
}

// ------------------------------------------------------------
//  Autenticação
// ------------------------------------------------------------
export function entrar(email: string, senha: string) {
  return chamar<{ token: string; usuario: UsuarioLogado }>('/api/autenticacao/entrar', {
    metodo: 'POST',
    corpo: { email, senha },
    semRenovar: true,
  });
}

/**
 * Tenta reaproveitar a sessão guardada no cookie ao abrir o sistema.
 * É isso que faz o F5 não pedir a senha de novo.
 */
export function retomarSessao(): Promise<UsuarioLogado | null> {
  return renovarSessao();
}

export function sair() {
  return chamar<{ ok: boolean }>('/api/autenticacao/sair', {
    metodo: 'POST',
    semRenovar: true,
  });
}

export function trocarSenha(senhaAtual: string, senhaNova: string) {
  return chamar<{ ok: boolean; mensagem: string }>('/api/autenticacao/senha', {
    metodo: 'POST',
    corpo: { senhaAtual, senhaNova },
  });
}

// ------------------------------------------------------------
//  Sistema e administração
// ------------------------------------------------------------
export function buscarStatus() {
  return chamar<StatusSistema>('/api/status');
}

export function listarUsuarios(busca?: string) {
  const query = busca ? '?busca=' + encodeURIComponent(busca) : '';
  return chamar<{ usuarios: UsuarioAdmin[] }>('/api/usuarios' + query);
}

export function listarFuncoes() {
  return chamar<{
    funcoes: Array<{
      id: string;
      codigo: string;
      nome: string;
      descricao: string | null;
      sistema: boolean;
      usuarios: number;
      permissoes: Array<{ codigo: string; nome: string; grupo: string }>;
    }>;
  }>('/api/funcoes');
}

export function criarUsuario(dados: {
  nome: string;
  email: string;
  telefone?: string;
  senha: string;
  funcoes: string[];
}) {
  return chamar<{ usuario: UsuarioAdmin }>('/api/usuarios', { metodo: 'POST', corpo: dados });
}

export function editarUsuario(
  id: string,
  dados: { nome?: string; telefone?: string | null; ativo?: boolean; funcoes?: string[] },
) {
  return chamar<{ usuario: UsuarioAdmin }>('/api/usuarios/' + id, {
    metodo: 'PATCH',
    corpo: dados,
  });
}

/**
 * Baixa um arquivo gerado pela API (ex.: PDF).
 * Precisa passar pelo fetch, e não por um link direto, porque a
 * rota exige o crachá no cabeçalho — e um <a href> não o envia.
 */
export async function baixarArquivo(caminho: string, nomeArquivo: string): Promise<void> {
  const resposta = await fetch(caminho, {
    headers: tokenAtual ? { Authorization: 'Bearer ' + tokenAtual } : {},
    credentials: 'include',
  });

  if (!resposta.ok) {
    throw new ErroApi('Não foi possível gerar o arquivo.', resposta.status);
  }

  const conteudo = await resposta.blob();
  const url = URL.createObjectURL(conteudo);

  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

/**
 * Traz uma imagem que exige crachá (o QR Code, por exemplo) e
 * devolve um endereço temporário que a tag <img> entende.
 *
 * Não dá para apontar o <img> direto para a rota: ele não manda
 * o crachá, e a rota recusaria.
 */
export async function buscarImagem(caminho: string): Promise<string | null> {
  const resposta = await fetch(caminho, {
    headers: tokenAtual ? { Authorization: 'Bearer ' + tokenAtual } : {},
    credentials: 'include',
  });

  if (!resposta.ok) return null;

  return URL.createObjectURL(await resposta.blob());
}
