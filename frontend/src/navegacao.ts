// ============================================================

import type { NomeDoIcone } from './componentes/Icone';
//  Os módulos do sistema, num lugar só
//
//  O menu lateral e os atalhos da tela de início liam listas
//  SEPARADAS. Deu no que tinha de dar: a Etapa 11 e a 12
//  entraram no menu e a tela de início continuou anunciando
//  que faltavam os relatórios e a locação.
//
//  Agora é uma lista só. Módulo novo = uma linha aqui, e ele
//  aparece nos dois lugares.
// ============================================================

/**
 * Os grupos do menu, na ordem do caminho que o trabalho percorre:
 * pedir, comprar, receber, guardar, pagar.
 *
 * É assim que as pessoas da obra já pensam, então é assim que o
 * menu se organiza. Grupo nenhum passa de quatro itens — é o
 * tamanho que o olho lê sem precisar contar.
 */
export const GRUPOS = ['Compras', 'Almoxarifado', 'Gestão', 'Administração'] as const;

export type Grupo = (typeof GRUPOS)[number];

export interface Modulo {
  /** Nome curto, para o menu lateral. */
  rotulo: string;
  /** Nome da ação, para o cartão da tela de início. */
  titulo: string;
  /** O que a pessoa faz ali, em uma linha. */
  descricao: string;
  para: string;
  icone: NomeDoIcone;
  /** Permissões que liberam o módulo. Vazio = todos veem. */
  permissoes: string[];
  /**
   * Falso para o que não é uma "ação" que alguém vai procurar
   * na tela de início.
   */
  noInicio?: boolean;
  /** Sem grupo, o item fica solto no alto do menu. É o caso do Início. */
  grupo?: Grupo;
}

export const MODULOS: Modulo[] = [
  {
    rotulo: 'Início',
    titulo: 'Início',
    descricao: 'A tela inicial',
    para: '/',
    icone: 'casa',
    permissoes: [],
    noInicio: false,
  },
  {
    rotulo: 'Solicitações',
    grupo: 'Compras',
    titulo: 'Abrir solicitação',
    descricao: 'Pedir material ou serviço para a obra',
    para: '/solicitacoes',
    icone: 'escrever',
    permissoes: ['solicitacoes.criar', 'solicitacoes.ver_todas'],
  },
  {
    rotulo: 'Aprovações',
    grupo: 'Compras',
    titulo: 'Aprovações pendentes',
    descricao: 'Liberar ou devolver pedidos de compra',
    para: '/aprovacoes',
    icone: 'certo',
    permissoes: ['solicitacoes.aprovar'],
  },
  {
    rotulo: 'Cotações',
    grupo: 'Compras',
    titulo: 'Cotações',
    descricao: 'Montar pacote e convidar fornecedores',
    para: '/cotacoes',
    icone: 'conversa',
    permissoes: ['cotacoes.gerenciar'],
  },
  {
    rotulo: 'Pedidos',
    grupo: 'Compras',
    titulo: 'Pedidos de compra',
    descricao: 'Ver os pedidos emitidos e baixar o PDF',
    para: '/pedidos',
    icone: 'documento',
    permissoes: ['pedidos.gerenciar', 'financeiro.ver'],
  },
  {
    rotulo: 'Recebimento',
    grupo: 'Almoxarifado',
    titulo: 'Receber material',
    descricao: 'Conferir a entrega contra o pedido',
    para: '/recebimento',
    icone: 'caixa',
    permissoes: ['recebimento.registrar'],
  },
  {
    rotulo: 'Estoque',
    grupo: 'Almoxarifado',
    titulo: 'Estoque',
    descricao: 'Ver saldo, retirar material e conferir o mínimo',
    para: '/estoque',
    icone: 'obra',
    permissoes: ['estoque.ver'],
  },
  {
    rotulo: 'Locação',
    grupo: 'Almoxarifado',
    titulo: 'Locação de equipamentos',
    descricao: 'Ver o que está alugado e o que já passou do prazo',
    para: '/locacao',
    icone: 'maquina',
    permissoes: ['locacao.ver'],
  },
  {
    rotulo: 'Financeiro',
    grupo: 'Gestão',
    titulo: 'Contas a pagar',
    descricao: 'Notas fiscais, parcelas e vencimentos',
    para: '/financeiro',
    icone: 'dinheiro',
    permissoes: ['financeiro.ver'],
  },
  {
    rotulo: 'Relatórios',
    grupo: 'Gestão',
    titulo: 'Relatórios',
    descricao: 'Orçamento, economia, fornecedores, tempos e consumo',
    para: '/relatorios',
    icone: 'grafico',
    permissoes: ['relatorios.ver'],
  },
  {
    rotulo: 'Cadastros',
    grupo: 'Administração',
    titulo: 'Cadastros',
    descricao: 'Obras, materiais, fornecedores e alçadas',
    para: '/cadastros',
    icone: 'pasta',
    permissoes: ['materiais.ver', 'obras.ver'],
  },
  {
    rotulo: 'Usuários',
    grupo: 'Administração',
    titulo: 'Usuários',
    descricao: 'Cadastrar pessoas e definir funções',
    para: '/admin/usuarios',
    icone: 'pessoas',
    permissoes: ['usuarios.ver'],
  },
  {
    rotulo: 'Avisos',
    grupo: 'Administração',
    titulo: 'Avisos ao fornecedor',
    descricao: 'WhatsApp e e-mail: conectar e ver o que saiu',
    para: '/admin/avisos',
    icone: 'conversa',
    permissoes: ['sistema.integracoes'],
  },
  {
    rotulo: 'Status do sistema',
    grupo: 'Administração',
    titulo: 'Status do sistema',
    descricao: 'Conferir se tudo está no ar',
    para: '/admin/status',
    icone: 'engrenagem',
    permissoes: ['sistema.status'],
  },
];

// ------------------------------------------------------------
//  As etapas do projeto
//
//  O aviso da tela de início se monta a partir desta lista. Não
//  há texto escrito à mão dizendo "faltam os relatórios": marcar
//  a etapa como pronta já corrige a frase.
// ------------------------------------------------------------

export interface Etapa {
  numero: number;
  nome: string;
  pronta: boolean;
}

export const ETAPAS: Etapa[] = [
  { numero: 1, nome: 'Acesso ao sistema', pronta: true },
  { numero: 2, nome: 'Cadastros', pronta: true },
  { numero: 3, nome: 'Solicitação de compra', pronta: true },
  { numero: 4, nome: 'Aprovação', pronta: true },
  { numero: 5, nome: 'Cotação', pronta: true },
  { numero: 6, nome: 'Equalização e pedido', pronta: true },
  { numero: 7, nome: 'Recebimento', pronta: true },
  { numero: 8, nome: 'Estoque', pronta: true },
  { numero: 9, nome: 'Fiscal e contas a pagar', pronta: true },
  { numero: 10, nome: 'WhatsApp', pronta: true },
  { numero: 11, nome: 'Relatórios', pronta: true },
  { numero: 12, nome: 'Locação de equipamentos', pronta: true },
];

export const ETAPAS_PRONTAS = ETAPAS.filter((e) => e.pronta).length;
export const ETAPAS_TOTAIS = ETAPAS.length;
export const MODULO_COMPLETO = ETAPAS_PRONTAS === ETAPAS_TOTAIS;

/**
 * A finalização NÃO é uma etapa, de propósito.
 *
 * Ligar as integrações de verdade e instalar num servidor não espera
 * código que falte aqui: espera uma decisão da direção, e não há data.
 * Enquanto isso contou como "etapa 13 de 13", esta tela anunciava um
 * cronograma que não existe — e quem lia entendia que havia atraso.
 */
export const FINALIZACAO = {
  resumo:
    'Ligar as integrações de verdade e instalar no servidor definitivo é a ' +
    'finalização, e acontece quando a direção decidir. Não há data marcada.',
  itens: [
    'WhatsApp, nota fiscal, código de barras e banco ligados de verdade',
    'Sistema instalado no servidor definitivo',
    'Treinamento da equipe',
  ],
};

/**
 * O que ainda falta, em português.
 *
 * Usa dois-pontos de propósito: "falta a entrega" e "faltam os
 * relatórios" mudam artigo, gênero e número, e montar isso à mão
 * dá frase errada na primeira etapa nova que entrar na lista.
 */
export function oQueFalta(): string {
  const faltando = ETAPAS.filter((e) => !e.pronta).map((e) => e.nome.toLowerCase());

  if (faltando.length === 0) return 'Nada mais falta para o módulo 1.';

  return 'Ainda falta: ' + faltando.join(', ') + '.';
}

/**
 * Monta o menu agrupado, com o que a pessoa pode ver.
 *
 * Grupo que ficou sem nenhum item some junto com o rótulo: para o
 * almoxarife não faz sentido aparecer um título "Gestão" sozinho,
 * sem nada embaixo.
 */
export function menuAgrupado(
  podeVer: (m: Modulo) => boolean,
): { soltos: Modulo[]; grupos: Array<{ nome: Grupo; itens: Modulo[] }> } {
  const visiveis = MODULOS.filter(podeVer);

  return {
    soltos: visiveis.filter((m) => !m.grupo),
    grupos: GRUPOS
      .map((nome) => ({ nome, itens: visiveis.filter((m) => m.grupo === nome) }))
      .filter((g) => g.itens.length > 0),
  };
}

// ============================================================
//  A hierarquia das telas
//
//  De onde saem as migalhas ("Início › Cotações › BID-00002") e
//  o botão de Voltar. Mora aqui junto com o menu de propósito:
//  quando menu e migalhas liam listas separadas, elas divergiram
//  e a tela de Início passou a anunciar coisa que não era mais
//  verdade.
// ============================================================

export interface Pagina {
  /** O padrão da rota, como está no App.tsx. */
  rota: string;
  /** Nome curto, para a migalha e para o botão de voltar. */
  titulo: string;
  /** A rota da tela-mãe. Sem mãe só o Início. */
  mae?: string;
}

/**
 * A tela-mãe, e não "a tela anterior".
 *
 * Voltar para a anterior parece igual mas não é: se a pessoa
 * chegou por outro caminho, ou acabou de salvar um formulário, o
 * botão a joga num lugar inesperado ou numa tela desatualizada.
 * A tela-mãe é sempre o mesmo lugar.
 */
export const PAGINAS: Pagina[] = [
  { rota: '/', titulo: 'Início' },
  { rota: '/minha-senha', titulo: 'Minha senha', mae: '/' },

  // --- Compras ---
  { rota: '/solicitacoes', titulo: 'Solicitações', mae: '/' },
  { rota: '/solicitacoes/nova', titulo: 'Nova solicitação', mae: '/solicitacoes' },
  { rota: '/solicitacoes/:id', titulo: 'Solicitação', mae: '/solicitacoes' },
  { rota: '/aprovacoes', titulo: 'Aprovações', mae: '/' },
  { rota: '/cotacoes', titulo: 'Cotações', mae: '/' },
  { rota: '/cotacoes/nova', titulo: 'Novo pacote', mae: '/cotacoes' },
  { rota: '/cotacoes/:id', titulo: 'Pacote de cotação', mae: '/cotacoes' },
  { rota: '/cotacoes/:id/equalizacao', titulo: 'Equalização', mae: '/cotacoes/:id' },
  { rota: '/pedidos', titulo: 'Pedidos', mae: '/' },

  // --- Almoxarifado ---
  { rota: '/recebimento', titulo: 'Recebimento', mae: '/' },
  { rota: '/recebimento/:numero', titulo: 'Conferência', mae: '/recebimento' },
  { rota: '/estoque', titulo: 'Estoque', mae: '/' },
  { rota: '/estoque/movimentos', titulo: 'Extrato', mae: '/estoque' },
  { rota: '/locacao', titulo: 'Locação', mae: '/' },

  // --- Gestão ---
  { rota: '/financeiro', titulo: 'Financeiro', mae: '/' },
  { rota: '/financeiro/notas', titulo: 'Notas fiscais', mae: '/financeiro' },
  { rota: '/relatorios', titulo: 'Relatórios', mae: '/' },

  // --- Administração ---
  { rota: '/cadastros', titulo: 'Cadastros', mae: '/' },
  { rota: '/cadastros/familias', titulo: 'Famílias', mae: '/cadastros' },
  { rota: '/cadastros/materiais', titulo: 'Materiais', mae: '/cadastros' },
  { rota: '/cadastros/fornecedores', titulo: 'Fornecedores', mae: '/cadastros' },
  { rota: '/cadastros/obras', titulo: 'Obras', mae: '/cadastros' },
  { rota: '/cadastros/obras/:id', titulo: 'Obra', mae: '/cadastros/obras' },
  { rota: '/cadastros/alcadas', titulo: 'Limites de alçada', mae: '/cadastros' },
  { rota: '/admin/usuarios', titulo: 'Usuários', mae: '/' },
  { rota: '/admin/avisos', titulo: 'Avisos ao fornecedor', mae: '/' },
  { rota: '/admin/whatsapp', titulo: 'Avisos ao fornecedor', mae: '/' },
  { rota: '/admin/status', titulo: 'Status do sistema', mae: '/' },
];

/** Quebra o endereço em pedaços, sem os vazios das barras. */
function pedacos(caminho: string): string[] {
  return caminho.split('/').filter(Boolean);
}

/**
 * O endereço casa com o padrão da rota?
 *
 * `/cotacoes/abc/equalizacao` casa com `/cotacoes/:id/equalizacao`;
 * `/cotacoes/nova` NÃO casa com `/cotacoes/:id`, porque o pedaço
 * fixo ganha do coringa — senão "nova" viraria um id.
 */
export function casa(rota: string, caminho: string): boolean {
  const r = pedacos(rota);
  const c = pedacos(caminho);

  if (r.length !== c.length) return false;

  return r.every((parte, i) => parte.startsWith(':') || parte === c[i]);
}

/**
 * A página que corresponde ao endereço.
 *
 * O padrão sem coringa vence: entre `/cotacoes/nova` e
 * `/cotacoes/:id`, quem abriu "nova" está na tela de novo pacote,
 * não numa cotação chamada "nova".
 */
export function paginaDe(caminho: string): Pagina | null {
  const candidatas = PAGINAS.filter((p) => casa(p.rota, caminho));
  if (candidatas.length === 0) return null;

  const fixas = candidatas.filter((p) => !p.rota.includes(':'));
  return fixas[0] ?? candidatas[0];
}

/**
 * Troca os coringas do padrão pelos valores do endereço atual.
 *
 * A mãe de `/cotacoes/:id/equalizacao` é `/cotacoes/:id` — e o
 * botão precisa levar à cotação DAQUELE id, não a um endereço com
 * dois-pontos no meio.
 */
export function enderecoReal(rota: string, atual: string): string {
  const paginaAtual = paginaDe(atual);
  if (!paginaAtual) return rota;

  const padrao = pedacos(paginaAtual.rota);
  const valores = pedacos(atual);

  const mapa = new Map<string, string>();
  padrao.forEach((parte, i) => {
    if (parte.startsWith(':')) mapa.set(parte, valores[i]);
  });

  const montado = pedacos(rota)
    .map((parte) => (parte.startsWith(':') ? mapa.get(parte) ?? parte : parte))
    .join('/');

  return '/' + montado;
}

/**
 * A trilha do Início até a tela atual.
 *
 * Devolve os endereços já resolvidos, prontos para virar link.
 */
export function trilhaDe(caminho: string): Array<{ titulo: string; para: string }> {
  const atual = paginaDe(caminho);
  if (!atual) return [];

  const trilha: Array<{ titulo: string; para: string }> = [];
  let passo: Pagina | undefined = atual;
  // Trava contra hierarquia circular: uma mãe apontando de volta
  // para a filha travaria a tela inteira num laço infinito.
  let voltas = 0;

  while (passo && voltas < PAGINAS.length) {
    trilha.unshift({
      titulo: passo.titulo,
      para: enderecoReal(passo.rota, caminho),
    });

    passo = passo.mae ? PAGINAS.find((p) => p.rota === passo!.mae) : undefined;
    voltas += 1;
  }

  return trilha;
}

/**
 * Para onde o botão de Voltar leva, e o que ele diz.
 *
 * Null só no Início, que não tem mãe.
 */
export function voltarDe(caminho: string): { titulo: string; para: string } | null {
  const atual = paginaDe(caminho);
  if (!atual?.mae) return null;

  const mae = PAGINAS.find((p) => p.rota === atual.mae);
  if (!mae) return null;

  return { titulo: mae.titulo, para: enderecoReal(mae.rota, caminho) };
}
