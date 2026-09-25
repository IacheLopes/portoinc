// ============================================================
//  Regras da solicitação de compra
//
//  As funções puras ficam aqui, separadas das rotas, para que
//  possam ser testadas sem banco e sem rede.
// ============================================================

export type Situacao =
  | 'RASCUNHO'
  | 'AGUARDANDO_APROVACAO'
  | 'EM_REVISAO'
  | 'APROVADA'
  | 'EM_COTACAO'
  | 'REPROVADA'
  | 'CANCELADA';

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  EM_REVISAO: 'Em revisão',
  APROVADA: 'Aprovada',
  EM_COTACAO: 'Em cotação',
  REPROVADA: 'Reprovada',
  CANCELADA: 'Cancelada',
};

/**
 * Para onde cada situação pode ir.
 * Ter isso escrito num lugar só evita o clássico "a solicitação
 * voltou de aprovada para rascunho e ninguém sabe como".
 */
const CAMINHOS: Record<Situacao, Situacao[]> = {
  RASCUNHO: ['AGUARDANDO_APROVACAO', 'CANCELADA'],
  AGUARDANDO_APROVACAO: ['APROVADA', 'REPROVADA', 'EM_REVISAO', 'CANCELADA'],
  EM_REVISAO: ['AGUARDANDO_APROVACAO', 'CANCELADA'],
  APROVADA: ['EM_COTACAO'],
  EM_COTACAO: [],
  REPROVADA: [],
  CANCELADA: [],
};

export function podeIrPara(atual: Situacao, destino: Situacao): boolean {
  return CAMINHOS[atual].includes(destino);
}

/** Só rascunho e revisão aceitam mudança de itens. */
export function podeEditar(situacao: Situacao): boolean {
  return situacao === 'RASCUNHO' || situacao === 'EM_REVISAO';
}

/** Número legível: 42 vira SOL-00042. */
export function formatarNumero(numero: number): string {
  return 'SOL-' + String(numero).padStart(5, '0');
}

export interface ItemParaConferir {
  quantidade: number;
  primeiraCompra: boolean;
  especificacaoTecnica?: string | null;
  descricao: string;
}

/**
 * Confere se a solicitação pode ser enviada para aprovação.
 * Devolve a lista de impedimentos — vazia significa "pode enviar".
 */
export function conferirParaEnvio(itens: ItemParaConferir[]): string[] {
  const impedimentos: string[] = [];

  if (itens.length === 0) {
    impedimentos.push('Adicione pelo menos um item antes de enviar.');
    return impedimentos;
  }

  for (const item of itens) {
    if (item.quantidade <= 0) {
      impedimentos.push('"' + item.descricao + '": a quantidade precisa ser maior que zero.');
    }

    // Pedido da reunião: item nunca comprado exige descrição
    // qualitativa, não só a quantidade.
    if (item.primeiraCompra && !item.especificacaoTecnica?.trim()) {
      impedimentos.push(
        '"' + item.descricao + '" nunca foi comprado antes. ' +
        'Descreva a especificação técnica (marca, qualidade, dimensões) para o comprador saber o que cotar.',
      );
    }
  }

  return impedimentos;
}

export interface ItemComValor {
  quantidade: number;
  valorEstimado: number | null;
}

/** Soma o valor estimado. Item sem estimativa conta como zero. */
export function calcularTotalEstimado(itens: ItemComValor[]): number {
  return itens.reduce(
    (soma, i) => soma + i.quantidade * (i.valorEstimado ?? 0),
    0,
  );
}

export interface FaixaAlcada {
  id: string;
  descricao: string;
  valorMinimo: number;
  valorMaximo: number | null;
  exigeTodas: boolean;
  funcoes: Array<{ codigo: string; nome: string }>;
}

/** Acha a faixa de alçada que cobre o valor. */
/**
 * A faixa que manda num valor de compra.
 *
 * O minimo ENTRA na faixa; o maximo NAO. "De 0 a 5.000" cobre de
 * R$ 0,00 a R$ 4.999,99, e R$ 5.000,00 ja e da proxima.
 *
 * Era `<=` dos dois lados, e por isso o valor do teto caia em duas
 * faixas ao mesmo tempo. Para contornar, quem configurava tinha de
 * escrever "5.000" numa e "5.000,01" na outra — o dono do sistema
 * tropecou nisso em 25/09/2026 e perguntou por que precisava do
 * centavo. Nao precisa: faixa de imposto e tabela de frete funcionam
 * assim, com o teto de uma sendo o piso da seguinte.
 */
export function acharFaixa(valor: number, faixas: FaixaAlcada[]): FaixaAlcada | null {
  const candidatas = faixas.filter(
    (f) => valor >= f.valorMinimo && (f.valorMaximo === null || valor < f.valorMaximo),
  );

  if (candidatas.length === 0) return null;

  // Havendo sobreposição, vale a de maior valor mínimo —
  // a mais específica para aquele valor.
  return candidatas.reduce((a, b) => (b.valorMinimo > a.valorMinimo ? b : a));
}

/** Frase pronta explicando quem precisa assinar. */
export function explicarAprovacao(faixa: FaixaAlcada | null): string {
  if (!faixa) {
    return 'Nenhuma faixa de alçada cobre este valor. Avise o administrador.';
  }

  const nomes = faixa.funcoes.map((f) => f.nome).join(', ');

  return faixa.exigeTodas
    ? 'Precisa da assinatura de TODAS estas funções: ' + nomes + '.'
    : 'Basta a assinatura de uma destas funções: ' + nomes + '.';
}
