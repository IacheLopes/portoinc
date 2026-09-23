// ============================================================
//  A tela inicial
//
//  Ela responde uma pergunta só: **o que precisa de você agora?**
//
//  Antes era um muro de atalhos — treze caixas iguais, todas
//  dizendo "clique aqui", nenhuma dizendo se havia algo para
//  fazer. Quem chegava de manhã tinha de abrir tela por tela para
//  descobrir que três notas venceram ontem.
//
//  Aqui mora a REGRA: dada a contagem crua, o que vira urgente, o
//  que vira acompanhamento, e o que nem aparece. A consulta ao
//  banco fica na rota; assim esta parte se testa sem banco nenhum.
// ============================================================

/**
 * O peso do cartão.
 *
 * `erro` é prazo já perdido — dinheiro vencido, equipamento que
 * devia ter voltado. `atencao` é o que vence se ninguém agir.
 * `neutro` é acompanhamento: bom saber, não pede nada.
 */
export type Tom = 'neutro' | 'atencao' | 'erro';

export interface CartaoDoInicio {
  chave: string;
  rotulo: string;
  valor: number;
  /** Uma linha em português dizendo o que o número significa. */
  detalhe: string;
  tom: Tom;
  /** Para onde vai quem clica. Cartão que não leva a lugar nenhum é enfeite. */
  para: string;
}

/** As contagens cruas, como a rota as tira do banco. */
export interface ContagensDoInicio {
  aprovacoesEsperando: number;
  minhasSolicitacoesAndando: number;
  cotacoesAbertas: number;
  pedidosRascunho: number;
  pedidosAguardandoEntrega: number;
  materiaisAbaixoDoMinimo: number;
  contasVencidas: number;
  contasVencendoEm7Dias: number;
  locacoesAtrasadas: number;
}

export const CONTAGENS_ZERADAS: ContagensDoInicio = {
  aprovacoesEsperando: 0,
  minhasSolicitacoesAndando: 0,
  cotacoesAbertas: 0,
  pedidosRascunho: 0,
  pedidosAguardandoEntrega: 0,
  materiaisAbaixoDoMinimo: 0,
  contasVencidas: 0,
  contasVencendoEm7Dias: 0,
  locacoesAtrasadas: 0,
};

/** "1 nota" e "3 notas" — sem "1 nota(s)", que ninguém fala. */
function plural(n: number, um: string, muitos: string): string {
  return n === 1 ? '1 ' + um : n + ' ' + muitos;
}

interface Definicao {
  chave: string;
  /** Quem não tem esta permissão nem vê o cartão. */
  permissao: string;
  rotulo: string;
  para: string;
  valor: (c: ContagensDoInicio) => number;
  tom: (n: number) => Tom;
  detalhe: (n: number) => string;
}

/**
 * A lista, na ordem em que o dia acontece: o que já atrasou, o que
 * vence, o que está em andamento.
 */
const DEFINICOES: Definicao[] = [
  {
    chave: 'contasVencidas',
    permissao: 'financeiro.ver',
    rotulo: 'Contas vencidas',
    para: '/financeiro?ver=vencidas',
    valor: (c) => c.contasVencidas,
    tom: (n) => (n > 0 ? 'erro' : 'neutro'),
    detalhe: (n) => (n === 0
      ? 'Nenhuma parcela passou do vencimento'
      : plural(n, 'parcela passou', 'parcelas passaram') + ' do vencimento'),
  },
  {
    chave: 'locacoesAtrasadas',
    permissao: 'locacao.ver',
    rotulo: 'Equipamento sem voltar',
    para: '/locacao',
    valor: (c) => c.locacoesAtrasadas,
    tom: (n) => (n > 0 ? 'erro' : 'neutro'),
    detalhe: (n) => (n === 0
      ? 'Nenhum contrato passou da data de devolução'
      : plural(n, 'contrato passou', 'contratos passaram') + ' da devolução e segue contando diária'),
  },
  {
    chave: 'aprovacoesEsperando',
    permissao: 'solicitacoes.aprovar',
    rotulo: 'Esperando sua assinatura',
    para: '/aprovacoes',
    valor: (c) => c.aprovacoesEsperando,
    tom: (n) => (n > 0 ? 'atencao' : 'neutro'),
    detalhe: (n) => (n === 0
      ? 'Nada parado com você'
      : plural(n, 'solicitação parada', 'solicitações paradas') + ' esperando você'),
  },
  {
    chave: 'contasVencendoEm7Dias',
    permissao: 'financeiro.ver',
    rotulo: 'Vence em 7 dias',
    para: '/financeiro?ver=proximas',
    valor: (c) => c.contasVencendoEm7Dias,
    tom: (n) => (n > 0 ? 'atencao' : 'neutro'),
    detalhe: (n) => (n === 0
      ? 'Nada vencendo esta semana'
      : plural(n, 'parcela vence', 'parcelas vencem') + ' nos próximos 7 dias'),
  },
  {
    chave: 'materiaisAbaixoDoMinimo',
    permissao: 'estoque.ver',
    rotulo: 'Abaixo do mínimo',
    para: '/estoque',
    valor: (c) => c.materiaisAbaixoDoMinimo,
    tom: (n) => (n > 0 ? 'atencao' : 'neutro'),
    detalhe: (n) => (n === 0
      ? 'Nenhum material no vermelho'
      : plural(n, 'material chegou', 'materiais chegaram') + ' ao ponto de repor'),
  },
  {
    chave: 'pedidosRascunho',
    permissao: 'pedidos.gerenciar',
    rotulo: 'Pedido sem enviar',
    para: '/pedidos',
    valor: (c) => c.pedidosRascunho,
    tom: (n) => (n > 0 ? 'atencao' : 'neutro'),
    detalhe: (n) => (n === 0
      ? 'Todo pedido emitido já foi para o fornecedor'
      : plural(n, 'pedido emitido', 'pedidos emitidos') + ' que o fornecedor ainda não recebeu'),
  },
  {
    chave: 'pedidosAguardandoEntrega',
    permissao: 'recebimento.registrar',
    rotulo: 'Esperando entrega',
    para: '/recebimento',
    valor: (c) => c.pedidosAguardandoEntrega,
    tom: () => 'neutro',
    detalhe: (n) => (n === 0
      ? 'Nenhuma entrega em aberto'
      : plural(n, 'pedido a conferir', 'pedidos a conferir') + ' quando o material chegar'),
  },
  {
    chave: 'cotacoesAbertas',
    permissao: 'cotacoes.gerenciar',
    rotulo: 'Cotações abertas',
    para: '/cotacoes',
    valor: (c) => c.cotacoesAbertas,
    tom: () => 'neutro',
    detalhe: (n) => (n === 0
      ? 'Nenhuma cotação esperando fornecedor'
      : plural(n, 'cotação aguardando', 'cotações aguardando') + ' resposta de fornecedor'),
  },
  {
    chave: 'minhasSolicitacoesAndando',
    permissao: 'solicitacoes.criar',
    rotulo: 'Seus pedidos andando',
    para: '/solicitacoes',
    valor: (c) => c.minhasSolicitacoesAndando,
    tom: () => 'neutro',
    detalhe: (n) => (n === 0
      ? 'Você não tem solicitação em andamento'
      : plural(n, 'solicitação sua', 'solicitações suas') + ' ainda em andamento'),
  },
];

export interface Inicio {
  /** O que pede ação hoje. Vazio quer dizer: está tudo em dia. */
  urgentes: CartaoDoInicio[];
  /** Acompanhamento: bom saber, não cobra nada. */
  acompanhar: CartaoDoInicio[];
}

/**
 * Monta a tela inicial.
 *
 * Duas regras, e só:
 *
 *   1. Sem a permissão, o cartão nem existe. Mostrar "Contas
 *      vencidas: 3" para quem não pode abrir o financeiro é contar
 *      uma novidade que a pessoa não pode resolver.
 *   2. Urgente é o que tem peso E tem número. Um "Contas vencidas:
 *      0" em vermelho no alto da tela ensina a ignorar vermelho.
 */
export function montarInicio(
  contagens: ContagensDoInicio,
  permissoes: string[],
): Inicio {
  const urgentes: CartaoDoInicio[] = [];
  const acompanhar: CartaoDoInicio[] = [];

  for (const d of DEFINICOES) {
    if (!permissoes.includes(d.permissao)) continue;

    const valor = d.valor(contagens);
    const cartao: CartaoDoInicio = {
      chave: d.chave,
      rotulo: d.rotulo,
      valor,
      detalhe: d.detalhe(valor),
      tom: d.tom(valor),
      para: d.para,
    };

    if (cartao.tom !== 'neutro' && valor > 0) urgentes.push(cartao);
    else acompanhar.push(cartao);
  }

  return { urgentes, acompanhar };
}

/** As permissões que o cálculo precisa conferir, sem repetir. */
export function permissoesDoInicio(): string[] {
  return [...new Set(DEFINICOES.map((d) => d.permissao))];
}
