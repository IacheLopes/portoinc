// ============================================================
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
  icone: string;
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
    icone: '⌂',
    permissoes: [],
    noInicio: false,
  },
  {
    rotulo: 'Solicitações',
    grupo: 'Compras',
    titulo: 'Abrir solicitação',
    descricao: 'Pedir material ou serviço para a obra',
    para: '/solicitacoes',
    icone: '📝',
    permissoes: ['solicitacoes.criar', 'solicitacoes.ver_todas'],
  },
  {
    rotulo: 'Aprovações',
    grupo: 'Compras',
    titulo: 'Aprovações pendentes',
    descricao: 'Liberar ou devolver pedidos de compra',
    para: '/aprovacoes',
    icone: '✓',
    permissoes: ['solicitacoes.aprovar'],
  },
  {
    rotulo: 'Cotações',
    grupo: 'Compras',
    titulo: 'Cotações',
    descricao: 'Montar pacote e convidar fornecedores',
    para: '/cotacoes',
    icone: '💬',
    permissoes: ['cotacoes.gerenciar'],
  },
  {
    rotulo: 'Pedidos',
    grupo: 'Compras',
    titulo: 'Pedidos de compra',
    descricao: 'Ver os pedidos emitidos e baixar o PDF',
    para: '/pedidos',
    icone: '📄',
    permissoes: ['pedidos.gerenciar', 'financeiro.ver'],
  },
  {
    rotulo: 'Recebimento',
    grupo: 'Almoxarifado',
    titulo: 'Receber material',
    descricao: 'Conferir a entrega contra o pedido',
    para: '/recebimento',
    icone: '📦',
    permissoes: ['recebimento.registrar'],
  },
  {
    rotulo: 'Estoque',
    grupo: 'Almoxarifado',
    titulo: 'Estoque',
    descricao: 'Ver saldo, retirar material e conferir o mínimo',
    para: '/estoque',
    icone: '🏗',
    permissoes: ['estoque.ver'],
  },
  {
    rotulo: 'Locação',
    grupo: 'Almoxarifado',
    titulo: 'Locação de equipamentos',
    descricao: 'Ver o que está alugado e o que já passou do prazo',
    para: '/locacao',
    icone: '🚜',
    permissoes: ['locacao.ver'],
  },
  {
    rotulo: 'Financeiro',
    grupo: 'Gestão',
    titulo: 'Contas a pagar',
    descricao: 'Notas fiscais, parcelas e vencimentos',
    para: '/financeiro',
    icone: '💰',
    permissoes: ['financeiro.ver'],
  },
  {
    rotulo: 'Relatórios',
    grupo: 'Gestão',
    titulo: 'Relatórios',
    descricao: 'Orçamento, economia, fornecedores, tempos e consumo',
    para: '/relatorios',
    icone: '📊',
    permissoes: ['relatorios.ver'],
  },
  {
    rotulo: 'Cadastros',
    grupo: 'Administração',
    titulo: 'Cadastros',
    descricao: 'Obras, materiais, fornecedores e alçadas',
    para: '/cadastros',
    icone: '📁',
    permissoes: ['materiais.ver', 'obras.ver'],
  },
  {
    rotulo: 'Usuários',
    grupo: 'Administração',
    titulo: 'Usuários',
    descricao: 'Cadastrar pessoas e definir funções',
    para: '/admin/usuarios',
    icone: '👥',
    permissoes: ['usuarios.ver'],
  },
  {
    rotulo: 'Avisos',
    grupo: 'Administração',
    titulo: 'Avisos ao fornecedor',
    descricao: 'WhatsApp e e-mail: conectar e ver o que saiu',
    para: '/admin/avisos',
    icone: '💬',
    permissoes: ['sistema.integracoes'],
  },
  {
    rotulo: 'Status do sistema',
    grupo: 'Administração',
    titulo: 'Status do sistema',
    descricao: 'Conferir se tudo está no ar',
    para: '/admin/status',
    icone: '⚙',
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
