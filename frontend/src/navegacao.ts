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
 * A BARRA LATERAL NÃO LISTA TELAS. LISTA QUATRO DESTINOS.
 *
 * Ela listava as 14 telas, agrupadas sob quatro títulos: 18 linhas
 * para quem administra. Da reunião de 08/10/2026: "vai
 * tudo ficar meio que encolhido, pra parecer que é pouca coisa, e
 * ele querer colocar mais... fica coisa demais... é pra dar uma
 * resumida no tanto de aba que tem aí".
 *
 * O pedido NÃO era ter menos telas — era o sistema PARECER enxuto,
 * para o cliente querer pedir mais. Juntar alguns itens resolveria
 * por dois módulos e a conta voltaria a crescer.
 *
 * Então a barra passou a listar DESTINOS, e cada destino é uma tela
 * índice com cartões. Seis linhas para todo mundo — Início,
 * Relatórios e estes quatro — e seis linhas depois de dez telas
 * novas.
 *
 * NÃO É PADRÃO NOVO: o Cadastros já funcionava assim, escondendo
 * cinco telas atrás de uma linha, e ninguém nunca reclamou. O que
 * mudou foi aplicar ao menu inteiro.
 *
 * A ordem é a do caminho do trabalho: pedir, receber, pagar, e
 * depois o que sustenta tudo.
 *
 * A REGRA QUE FAZ ISSO DURAR: tela nova vira cartão num índice que
 * já existe. Índice novo é decisão do dono, não conveniência de
 * quem programa. Há teste cobrando isso em `navegacao.test.ts`.
 */
export const DESTINOS = ['Compras', 'Almoxarifado', 'Financeiro', 'Administração'] as const;

export type Destino = (typeof DESTINOS)[number];

export interface Indice {
  destino: Destino;
  /** O endereço da tela índice. */
  para: string;
  icone: NomeDoIcone;
  /** A linha sob o título da tela índice. */
  descricao: string;
}

export const INDICES: Indice[] = [
  {
    destino: 'Compras',
    para: '/compras',
    icone: 'prancheta',
    descricao: 'O caminho de uma compra, do pedido da obra até o pedido ao fornecedor.',
  },
  {
    destino: 'Almoxarifado',
    para: '/almoxarifado',
    icone: 'caixa',
    descricao: 'O material depois que ele chega: conferir, guardar e devolver o que é alugado.',
  },
  {
    destino: 'Financeiro',
    para: '/financeiro',
    icone: 'dinheiro',
    descricao: 'O dinheiro que sai pelas compras e o que entra e sai por fora delas.',
  },
  {
    destino: 'Administração',
    para: '/administracao',
    icone: 'engrenagem',
    descricao: 'A base que o resto do sistema usa, e quem tem acesso a ela.',
  },
];

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
  /**
   * Em qual tela índice este módulo aparece como cartão.
   *
   * Sem destino, o item fica SOLTO na barra lateral. São dois, e não
   * crescem: Início e Relatórios. O Início porque é a casa; os
   * Relatórios porque falam de tudo e não cabem num destino só —
   * enfiar em "Financeiro" diria que o relatório de consumo é
   * assunto de dinheiro.
   */
  grupo?: Destino;
  /**
   * Onde este item SOLTO aparece na barra.
   *
   * Sem isto ele vai para o alto, junto do Início. Com isto, ele
   * desce e fica logo abaixo do destino indicado.
   *
   * É o caso dos Relatórios: eles falam do sistema inteiro e não
   * cabem dentro de um destino só — enfiar em "Financeiro" diria que
   * o relatório de consumo é assunto de dinheiro, e o engenheiro e o
   * gestor de obra, que leem relatório e NÃO abrem o financeiro,
   * perderiam o acesso.
   *
   * Mas o lugar deles é perto do Financeiro, e não no alto da barra.
   * Então: solto, e ancorado.
   *
   * Se o destino da âncora não aparecer para a pessoa, o item cai no
   * lugar onde ele TERIA ficado — a ordem relativa se mantém.
   */
  aposNaBarra?: Destino;
  /**
   * A ordem do cartão no índice, quando a lista for mesmo uma
   * SEQUÊNCIA. O número some onde não for: numerar 1-2-3 coisas que
   * são paralelas promete uma ordem que não existe.
   */
  ordem?: number;
}

export const MODULOS: Modulo[] = [
  // ---------- Soltos na barra: são dois, e não crescem ----------
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
    rotulo: 'Relatórios',
    aposNaBarra: 'Financeiro',
    titulo: 'Relatórios',
    descricao: 'Orçamento, economia, fornecedores, tempos e consumo',
    para: '/relatorios',
    icone: 'grafico',
    permissoes: ['relatorios.ver'],
  },

  // ---------- Compras: é uma sequência, e por isso vai numerada ----------
  {
    rotulo: 'Solicitações',
    grupo: 'Compras',
    ordem: 1,
    titulo: 'Abrir solicitação',
    descricao: 'Pedir material ou serviço para uma obra',
    para: '/solicitacoes',
    icone: 'prancheta',
    permissoes: ['solicitacoes.criar', 'solicitacoes.ver_todas'],
  },
  {
    rotulo: 'Aprovações',
    grupo: 'Compras',
    ordem: 2,
    titulo: 'Aprovar pedidos',
    descricao: 'Assinar o que espera a sua decisão, dentro da sua alçada',
    para: '/aprovacoes',
    icone: 'certo',
    permissoes: ['solicitacoes.aprovar'],
  },
  {
    rotulo: 'Cotações',
    grupo: 'Compras',
    ordem: 3,
    titulo: 'Cotar com fornecedores',
    descricao: 'Montar o pacote, convidar e comparar as propostas',
    para: '/cotacoes',
    icone: 'balanca',
    permissoes: ['cotacoes.gerenciar'],
  },
  {
    rotulo: 'Pedidos',
    grupo: 'Compras',
    ordem: 4,
    titulo: 'Pedidos de compra',
    descricao: 'Ver os pedidos emitidos e baixar o PDF',
    para: '/pedidos',
    icone: 'documento',
    permissoes: ['pedidos.gerenciar', 'financeiro.ver'],
  },

  // ---------- Almoxarifado: NÃO é sequência, então sem número ----------
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
    descricao: 'Saldos por almoxarifado e o extrato de movimentos',
    para: '/estoque',
    icone: 'tijolo',
    permissoes: ['estoque.ver'],
  },
  {
    rotulo: 'Locação',
    grupo: 'Almoxarifado',
    titulo: 'Locação de equipamentos',
    descricao: 'O que está alugado, por quanto tempo e quanto já custou',
    para: '/locacao',
    icone: 'maquina',
    permissoes: ['locacao.ver'],
  },

  // ---------- Financeiro ----------
  {
    rotulo: 'Contas a pagar',
    grupo: 'Financeiro',
    titulo: 'Contas a pagar',
    descricao: 'As parcelas que nasceram das notas fiscais, e os vencimentos',
    para: '/financeiro/contas',
    icone: 'dinheiro',
    permissoes: ['financeiro.ver'],
  },
  {
    rotulo: 'Notas fiscais',
    grupo: 'Financeiro',
    titulo: 'Notas fiscais',
    descricao: 'Lançar a nota do fornecedor e gerar as parcelas',
    para: '/financeiro/notas',
    icone: 'documento',
    permissoes: ['financeiro.ver'],
  },
  {
    rotulo: 'Receitas e despesas',
    grupo: 'Financeiro',
    titulo: 'Lançar receita ou despesa',
    descricao: 'O dinheiro que entra e o gasto que não vem de compra',
    para: '/financeiro/lancamentos',
    icone: 'balanca',
    permissoes: ['financeiro.ver'],
  },

  // ---------- Administração ----------
  //
  //  Os cinco cadastros SÃO uma sequência: material precisa de
  //  família, fornecedor é ligado a famílias, obra precisa de
  //  orçamento. Numerados. O resto não é, e vai sem número.
  {
    rotulo: 'Famílias',
    grupo: 'Administração',
    ordem: 1,
    titulo: 'Famílias',
    descricao: 'Agrupam os itens por tipo. É por elas que o sistema sabe quem convidar para cada cotação.',
    para: '/cadastros/familias',
    icone: 'arquivos',
    permissoes: ['materiais.ver'],
    noInicio: false,
  },
  {
    rotulo: 'Materiais',
    grupo: 'Administração',
    ordem: 2,
    titulo: 'Materiais e serviços',
    descricao: 'O catálogo da empresa, com código Porto, código de barras e unidade de medida.',
    para: '/cadastros/materiais',
    icone: 'tijolo',
    permissoes: ['materiais.ver'],
    noInicio: false,
  },
  {
    rotulo: 'Fornecedores',
    grupo: 'Administração',
    ordem: 3,
    titulo: 'Fornecedores',
    descricao: 'Quem vende para a Porto Inc., e quais famílias cada um atende.',
    para: '/cadastros/fornecedores',
    icone: 'caminhao',
    permissoes: ['fornecedores.ver'],
    noInicio: false,
  },
  {
    rotulo: 'Obras',
    grupo: 'Administração',
    ordem: 4,
    titulo: 'Obras',
    descricao: 'Os empreendimentos, com o orçamento e o almoxarifado de cada um.',
    para: '/cadastros/obras',
    icone: 'obra',
    permissoes: ['obras.ver'],
    noInicio: false,
  },
  {
    rotulo: 'Limites de alçada',
    grupo: 'Administração',
    ordem: 5,
    titulo: 'Limites de alçada',
    descricao: 'Até quanto cada função aprova sozinha, e a partir de quanto sobe para o fundador.',
    para: '/cadastros/alcadas',
    icone: 'balanca',
    permissoes: ['alcadas.gerenciar'],
    noInicio: false,
  },
  {
    rotulo: 'Usuários',
    grupo: 'Administração',
    titulo: 'Usuários e funções',
    descricao: 'Cadastrar pessoas, criar funções e escolher o que cada uma libera',
    para: '/admin/usuarios',
    icone: 'pessoas',
    permissoes: ['usuarios.ver'],
  },
  {
    rotulo: 'Comunicação',
    grupo: 'Administração',
    titulo: 'Comunicação',
    descricao: 'WhatsApp e e-mail: conectar e ver o que saiu',
    para: '/admin/avisos',
    icone: 'conversa',
    permissoes: ['sistema.integracoes'],
  },
  {
    rotulo: 'Área IA',
    grupo: 'Administração',
    titulo: 'Área IA',
    descricao: 'O assistente que responde no WhatsApp para a equipe',
    para: '/admin/ia',
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
    noInicio: false,
  },
];

/** Uma linha da barra lateral: ou uma tela solta, ou um destino. */
export interface LinhaDaBarra {
  rotulo: string;
  para: string;
  icone: NomeDoIcone;
  /** Verdadeiro quando a linha leva a uma tela índice. */
  ehDestino: boolean;
  /** O primeiro destino leva o fio que o separa do Início. */
  primeiroDestino?: boolean;
}

/**
 * As linhas da barra lateral, para quem a pessoa é.
 *
 * São seis no máximo: Início, Relatórios e os quatro destinos. E
 * continuam seis quando o sistema dobrar de tamanho — tela nova é
 * cartão dentro de um índice, não linha nova aqui.
 *
 * Destino sem nenhum cartão visível some: para o almoxarife não faz
 * sentido um "Financeiro" que abre uma tela vazia.
 */
export function barraLateral(podeVer: (m: Modulo) => boolean): LinhaDaBarra[] {
  const visiveis = MODULOS.filter(podeVer);

  const comoLinha = (m: Modulo): LinhaDaBarra => ({
    rotulo: m.rotulo,
    para: m.para,
    icone: m.icone,
    ehDestino: false,
  });

  // No alto: os soltos sem âncora. Hoje é só o Início.
  const linhas: LinhaDaBarra[] = visiveis
    .filter((m) => !m.grupo && !m.aposNaBarra)
    .map(comoLinha);

  let primeiro = true;

  for (const indice of INDICES) {
    if (visiveis.some((m) => m.grupo === indice.destino)) {
      linhas.push({
        rotulo: indice.destino,
        para: indice.para,
        icone: indice.icone,
        ehDestino: true,
        primeiroDestino: primeiro,
      });
      primeiro = false;
    }

    // Os ancorados caem aqui mesmo quando o destino da âncora não
    // aparece — senão o engenheiro, que não vê o Financeiro, teria os
    // Relatórios jogados para o fim da barra.
    for (const solto of visiveis.filter((m) => m.aposNaBarra === indice.destino)) {
      linhas.push(comoLinha(solto));
    }
  }

  return linhas;
}

/**
 * Os cartões de uma tela índice, na ordem.
 *
 * Quem tem `ordem` vem primeiro, em sequência; o resto vem depois,
 * na ordem em que foi declarado. É o caso da Administração: os
 * cinco cadastros têm ordem entre si, e Usuários, Comunicação e Status
 * não entram nessa conta.
 */
export function cartoesDoIndice(
  destino: Destino,
  podeVer: (m: Modulo) => boolean,
): Modulo[] {
  const meus = MODULOS.filter((m) => m.grupo === destino && podeVer(m));

  return [
    ...meus.filter((m) => m.ordem !== undefined).sort((a, b) => a.ordem! - b.ordem!),
    ...meus.filter((m) => m.ordem === undefined),
  ];
}

/** O índice a que uma tela pertence. Nulo para as soltas. */
export function indiceDe(para: string): Indice | null {
  const modulo = MODULOS.find((m) => m.para === para);
  if (!modulo?.grupo) return null;
  return INDICES.find((i) => i.destino === modulo.grupo) ?? null;
}

/**
 * A porta acesa na barra, para o endereço em que a pessoa está.
 *
 * SEM ISTO, A BARRA APAGA ENQUANTO SE TRABALHA. Estando em Contas a
 * pagar, nenhuma das seis linhas ficava marcada — e a barra, que é
 * o mapa, deixava de dizer em que parte do sistema a pessoa está.
 *
 * Casa por PREFIXO, e pelo mais longo primeiro: `/cadastros/obras/123`
 * é a tela de Obras, que é da Administração. Sem o "mais longo
 * primeiro", `/financeiro/contas` cairia em `/financeiro` e daria
 * certo por sorte; com dois módulos aninhados de verdade, daria
 * errado em silêncio.
 */
export function porteDaTela(caminho: string): string | null {
  const modulo = MODULOS
    .filter((m) => m.grupo)
    .sort((a, b) => b.para.length - a.para.length)
    .find((m) => caminho === m.para || caminho.startsWith(m.para + '/'));

  if (!modulo) return null;

  return INDICES.find((i) => i.destino === modulo.grupo)?.para ?? null;
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

  // A MÃE DE CADA TELA É O ÍNDICE DELA, e não mais o Início.
  //
  // Enquanto a barra listava as 14 telas, "Início › Cotações" era
  // a verdade: dava para ir direto. Agora passa-se por Compras, e a
  // migalha tem de contar o mesmo caminho que o botão de Voltar faz
  // — senão o Voltar pula um degrau que a pessoa acabou de subir.

  // --- Compras ---
  { rota: '/compras', titulo: 'Compras', mae: '/' },
  { rota: '/solicitacoes', titulo: 'Solicitações', mae: '/compras' },
  { rota: '/solicitacoes/nova', titulo: 'Nova solicitação', mae: '/solicitacoes' },
  { rota: '/solicitacoes/:id', titulo: 'Solicitação', mae: '/solicitacoes' },
  { rota: '/aprovacoes', titulo: 'Aprovações', mae: '/compras' },
  { rota: '/cotacoes', titulo: 'Cotações', mae: '/compras' },
  { rota: '/cotacoes/nova', titulo: 'Novo pacote', mae: '/cotacoes' },
  { rota: '/cotacoes/:id', titulo: 'Pacote de cotação', mae: '/cotacoes' },
  { rota: '/cotacoes/:id/equalizacao', titulo: 'Equalização', mae: '/cotacoes/:id' },
  { rota: '/pedidos', titulo: 'Pedidos', mae: '/compras' },
  { rota: '/pedidos/:id', titulo: 'Pedido de compra', mae: '/pedidos' },

  // --- Almoxarifado ---
  { rota: '/almoxarifado', titulo: 'Almoxarifado', mae: '/' },
  { rota: '/recebimento', titulo: 'Recebimento', mae: '/almoxarifado' },
  { rota: '/recebimento/:numero', titulo: 'Conferência', mae: '/recebimento' },
  { rota: '/estoque', titulo: 'Estoque', mae: '/almoxarifado' },
  { rota: '/estoque/movimentos', titulo: 'Extrato', mae: '/estoque' },
  { rota: '/locacao', titulo: 'Locação', mae: '/almoxarifado' },

  // --- Financeiro ---
  { rota: '/financeiro', titulo: 'Financeiro', mae: '/' },
  { rota: '/financeiro/contas', titulo: 'Contas a pagar', mae: '/financeiro' },
  { rota: '/financeiro/notas', titulo: 'Notas fiscais', mae: '/financeiro' },
  { rota: '/financeiro/lancamentos', titulo: 'Receitas e despesas', mae: '/financeiro' },

  // --- Relatórios: solto, então a mãe é o Início ---
  { rota: '/relatorios', titulo: 'Relatórios', mae: '/' },

  // --- Administração ---
  { rota: '/administracao', titulo: 'Administração', mae: '/' },
  { rota: '/cadastros/familias', titulo: 'Famílias', mae: '/administracao' },
  { rota: '/cadastros/materiais', titulo: 'Materiais', mae: '/administracao' },
  { rota: '/cadastros/fornecedores', titulo: 'Fornecedores', mae: '/administracao' },
  { rota: '/cadastros/obras', titulo: 'Obras', mae: '/administracao' },
  { rota: '/cadastros/obras/:id', titulo: 'Obra', mae: '/cadastros/obras' },
  { rota: '/cadastros/alcadas', titulo: 'Limites de alçada', mae: '/administracao' },
  { rota: '/admin/usuarios', titulo: 'Usuários e funções', mae: '/administracao' },
  { rota: '/admin/avisos', titulo: 'Comunicação', mae: '/administracao' },
  { rota: '/admin/ia', titulo: 'Área IA', mae: '/administracao' },
  { rota: '/admin/whatsapp', titulo: 'Comunicação', mae: '/administracao' },
  { rota: '/admin/status', titulo: 'Status do sistema', mae: '/administracao' },
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
export function trilhaDe(
  caminho: string,
  veioDe?: string,
): Array<{ titulo: string; para: string }> {
  const atual = paginaDe(caminho);
  if (!atual) return [];

  const trilha: Array<{ titulo: string; para: string }> = [];
  let passo: Pagina | undefined = atual;

  // ----------------------------------------------------------
  //  De onde a pessoa veio vence a hierarquia fixa
  //
  //  A solicitação mora debaixo de Solicitações, e é isso que a
  //  trilha diz. Só que chega-se a ela também pela fila de
  //  Aprovações — e aí a pessoa clica em "Analisar", cai na tela, e
  //  a migalha anuncia "Início › Solicitações". Parece que o sistema
  //  a jogou para outro lugar. Foi o que o dono do sistema relatou
  //  em 2026-09-24.
  //
  //  Com "veioDe", o degrau do meio passa a ser o caminho REAL que
  //  ela fez. Sem ele, nada muda.
  // ----------------------------------------------------------
  const origem = veioDe && veioDe !== caminho ? paginaDe(veioDe) : undefined;

  if (origem) {
    trilha.unshift({ titulo: atual.titulo, para: enderecoReal(atual.rota, caminho) });
    passo = origem;
  }
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
export function voltarDe(
  caminho: string,
  veioDe?: string,
): { titulo: string; para: string } | null {
  // O Voltar segue o mesmo caminho da trilha: leva de volta para
  // ONDE A PESSOA ESTAVA, e não para onde a tela mora.
  const origem = veioDe && veioDe !== caminho ? paginaDe(veioDe) : undefined;
  if (origem) {
    return { titulo: origem.titulo, para: enderecoReal(origem.rota, veioDe!) };
  }

  const atual = paginaDe(caminho);
  if (!atual?.mae) return null;

  const mae = PAGINAS.find((p) => p.rota === atual.mae);
  if (!mae) return null;

  return { titulo: mae.titulo, para: enderecoReal(mae.rota, caminho) };
}
