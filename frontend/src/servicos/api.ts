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

  // ----------------------------------------------------------
  //  A mensagem já sai dizendo QUAL campo está errado
  //
  //  O servidor manda "Dados inválidos" e, ao lado, a lista de
  //  campos com o problema de cada um. Só que 18 das 34 telas
  //  mostravam apenas `e.message` e jogavam a lista fora: a pessoa
  //  lia "Dados inválidos" e ficava adivinhando qual campo era.
  //  Foi o que aconteceu ao registrar uma locação, em 2026-09-24.
  //
  //  Juntar aqui conserta as 18 de uma vez, e as 16 que já mostram
  //  os detalhes continuam funcionando — elas leem `detalhes`, que
  //  segue intacto.
  // ----------------------------------------------------------
  throw new ErroApi(
    comCampos(corpo.erro ?? 'O servidor respondeu com erro ' + resposta.status + '.', corpo.detalhes),
    resposta.status,
    corpo.detalhes,
  );
}

/**
 * "Dados inválidos" vira
 * "Dados inválidos — Fornecedor: campo obrigatório; Obra: campo
 * obrigatório; e mais 6 campos".
 */
function comCampos(mensagem: string, detalhes?: DetalheErro[] | string[]): string {
  if (!detalhes?.length) return mensagem;

  const partes = detalhes
    .map((d) => {
      if (typeof d === 'string') return d;
      if (!d.mensagem) return '';
      // O nome técnico do campo vira gente: `previsaoDevolucao` →
      // "Previsão devolução" não sai perfeito em português, mas diz
      // MUITO mais do que oito vezes "Campo obrigatório".
      // Sem o ponto final: elas são unidas por ponto e vírgula, e
      // "obrigatório.;" fica com cara de defeito.
      const frase = d.mensagem.replace(/\.$/, '');
      const rotulo = humanizarCampo(d.campo);
      return rotulo ? rotulo + ': ' + minuscula(frase) : frase;
    })
    .filter(Boolean);

  if (partes.length === 0) return mensagem;

  // Três bastam. Listar oito numa linha só ninguém lê, e a tela
  // ainda mostra a lista inteira quando sabe fazer isso.
  const TETO = 3;
  const mostradas = partes.slice(0, TETO).join('; ');
  const resto = partes.length - TETO;

  return mensagem.replace(/[.:]$/, '')
    + ' — ' + mostradas
    + (resto > 0 ? '; e mais ' + resto + (resto === 1 ? ' campo' : ' campos') : '');
}

/** `previsaoDevolucao` → "Previsão devolução"; `obraId` → "Obra". */
function humanizarCampo(campo?: string): string {
  if (!campo) return '';
  const limpo = campo
    .split('.')
    .at(-1)!
    .replace(/Id$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
  if (!limpo) return '';
  return limpo.charAt(0).toUpperCase() + limpo.slice(1).toLowerCase();
}

/** "Campo obrigatório." depois de dois-pontos vira minúscula. */
function minuscula(frase: string): string {
  return frase.charAt(0).toLowerCase() + frase.slice(1);
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

      // 204 = não havia sessão guardada neste navegador. Não é erro:
      // é a resposta de "nunca entrou aqui". Sem este caso, o 204
      // caía no `catch` abaixo por falta de corpo — funcionava, mas
      // por acidente.
      if (resposta.status === 204 || !resposta.ok) return null;

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

/** O link de uso unico que a pessoa usa para criar a senha dela. */
export interface Convite {
  token: string;
  expiraEm: string;
}

/**
 * Cria a conta. NAO recebe senha.
 *
 * Quem cria a conta nao escolhe a senha de ninguem: a resposta traz
 * um convite, o administrador copia o link e manda, e a pessoa cria
 * a dela. Ate isso acontecer, ninguem no mundo sabe uma senha que
 * abra essa conta.
 */
export function criarUsuario(dados: {
  nome: string;
  email: string;
  telefone?: string;
  funcoes: string[];
}) {
  return chamar<{ usuario: UsuarioAdmin; convite: Convite }>('/api/usuarios', {
    metodo: 'POST',
    corpo: dados,
  });
}

/**
 * Invalida a senha de outra pessoa e devolve um link novo.
 *
 * O servidor derruba TODAS as sessoes dela junto — quem estivesse
 * logado com a conta cai na hora. E o certo: se a senha esta sendo
 * redefinida, e porque alguem perdeu o controle dela.
 *
 * Nao existe mais "digitar a senha nova de alguem": quem esqueceu a
 * senha quer escolher uma que lembre, nao receber outra de presente.
 */
export function redefinirSenhaDe(id: string) {
  return chamar<{ ok: boolean; mensagem: string; convite: Convite }>(
    '/api/usuarios/' + id + '/senha',
    { metodo: 'POST' },
  );
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
