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
  | 'ATENDIDA'
  | 'REPROVADA'
  | 'CANCELADA';

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  EM_REVISAO: 'Em revisão',
  APROVADA: 'Aprovada',
  EM_COTACAO: 'Em cotação',
  ATENDIDA: 'Atendida',
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
  // Dois caminhos a partir daqui:
  //
  //  - ATENDIDA, quando tudo que foi pedido chegou. É o fim.
  //  - de volta para a fila, quando o preço real da cotação
  //    estoura a faixa de alçada — para a assinatura não virar
  //    formalidade: quem assinou R$ 1.900 não autorizou R$ 8.000.
  EM_COTACAO: ['ATENDIDA', 'AGUARDANDO_APROVACAO'],
  ATENDIDA: [],
  REPROVADA: [],
  CANCELADA: [],
};

export function podeIrPara(atual: Situacao, destino: Situacao): boolean {
  return CAMINHOS[atual].includes(destino);
}

/**
 * A solicitação já foi atendida por inteiro?
 *
 * TODOS os itens precisam ter chegado. Fechar no primeiro seria o
 * mesmo defeito da planilha ao contrário: quem pediu cimento e
 * areia veria "atendida" com a areia ainda na rua.
 *
 * Item que nunca virou pedido — porque ninguém cotou — mantém a
 * solicitação aberta, e está certo: ela não foi atendida.
 */
export function solicitacaoAtendida(
  itens: Array<{ pedida: number; recebida: number }>,
): boolean {
  if (itens.length === 0) return false;

  return itens.every((i) => i.pedida > 0 && i.recebida >= i.pedida);
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

/** "a, b e c" — a última vem com a conjunção, como se fala. */
function juntar(nomes: string[], conjuncao: 'e' | 'ou'): string {
  if (nomes.length <= 1) return nomes[0] ?? '';

  return nomes.slice(0, -1).join(', ') + ' ' + conjuncao + ' ' + nomes[nomes.length - 1];
}

/**
 * Quem precisa assinar, em dado estruturado.
 *
 * A tela de detalhe monta uma LISTA de funções com isto, e risca as
 * que já assinaram. Antes só existia a frase pronta aqui embaixo, e
 * frase não dá para riscar: a caixa "Quem aprova" dizia a mesma coisa
 * antes e depois da primeira assinatura.
 *
 * Também serve antes de enviar, quando `funcoesExigidas` na
 * solicitação ainda está vazio — a fotografia da alçada só é tirada
 * no envio.
 */
export interface ResumoDaAlcada {
  /** Nome da faixa que pegou o valor. `null` = nenhuma cobre. */
  faixa: string | null;
  /** Todas as funções assinam, ou basta uma delas. */
  exigeTodas: boolean;
  funcoes: Array<{ codigo: string; nome: string }>;
  /** A mesma coisa em uma frase, para onde só cabe texto. */
  explicacao: string;
}

export function resumoDaAlcada(faixa: FaixaAlcada | null): ResumoDaAlcada {
  return {
    faixa: faixa ? faixa.descricao : null,
    exigeTodas: faixa ? faixa.exigeTodas : false,
    funcoes: faixa ? faixa.funcoes.map((f) => ({ codigo: f.codigo, nome: f.nome })) : [],
    explicacao: explicarAprovacao(faixa),
  };
}

/**
 * Frase pronta explicando quem precisa assinar.
 *
 * Vai no histórico da solicitação e no aviso logo depois de enviar —
 * lugares onde só cabe texto corrido.
 *
 * Dizia "TODAS", em maiúsculas. Era o único CAPS LOCK da interface, e
 * maiúscula não informa: quem lê rápido vê o grito e continua sem
 * saber quantas assinaturas são. O número e a conjunção fazem o
 * trabalho sem gritar — "e" quer dizer as duas, "ou" quer dizer
 * qualquer uma delas.
 */
export function explicarAprovacao(faixa: FaixaAlcada | null): string {
  if (!faixa) {
    return 'Nenhuma faixa de alçada cobre este valor. Avise o administrador.';
  }

  const nomes = faixa.funcoes.map((f) => f.nome);

  // Com uma função só, "todas" e "basta uma" querem dizer a mesma
  // coisa. Escrever "1 de 1" ali seria burocracia.
  if (nomes.length === 1) {
    return 'Precisa de 1 assinatura: ' + nomes[0] + '.';
  }

  return faixa.exigeTodas
    ? 'Precisa de ' + nomes.length + ' assinaturas: ' + juntar(nomes, 'e') + '.'
    : 'Basta 1 assinatura: ' + juntar(nomes, 'ou') + '.';
}

// ------------------------------------------------------------
//  A alçada precisa ser conferida DUAS vezes
// ------------------------------------------------------------

/**
 * Quanto o preço real pode subir sem incomodar ninguém.
 *
 * Material varia de preço entre a estimativa e a compra, e isso é
 * normal. Travar por qualquer centavo faria o comprador achar o
 * sistema chato e, pior, procurar jeito de contorná-lo.
 */
export const TOLERANCIA_DE_ALCADA = 20;

export interface ConferenciaDeAlcada {
  /** A compra tem de voltar para a fila de aprovação. */
  precisaReaprovar: boolean;
  valorNoEnvio: number;
  valorReal: number;
  /** Quanto por cento o real ficou acima do estimado. */
  variacao: number;
  /** A faixa que vale para o preço de verdade. */
  faixaAgora: FaixaAlcada | null;
  /** Uma frase explicando, para o histórico e para a tela. */
  motivo: string | null;
}

/**
 * Confere a alçada contra o preço que a cotação fechou.
 *
 * O SISTEMA DECIDIA A ALÇADA UMA VEZ SÓ, no envio, em cima de uma
 * ESTIMATIVA — e nunca mais olhava. Quem assinasse uma solicitação
 * de R$ 1.900 estava, na prática, autorizando qualquer valor: se a
 * cotação fechasse em R$ 8.000, o pedido saía com a assinatura de
 * quem só podia até R$ 2.000. A assinatura virava formalidade.
 *
 * Achado em 28/09/2026, lendo os relatórios: uma solicitação saiu
 * com estimativa de R$ 6.880 (duas assinaturas) e fechou em
 * R$ 2.900, que precisaria de uma só.
 *
 * Aqui a regra é de mão única, de propósito:
 *
 *   - fechou MAIS BARATO → segue. As assinaturas que já existem são
 *     mais do que o valor exige; ninguém autorizou de menos.
 *   - fechou MAIS CARO, dentro da tolerância → segue.
 *   - fechou MAIS CARO e SUBIU DE FAIXA → volta para assinar.
 *
 * O frete fica de fora da conta: a alçada do envio foi decidida
 * sobre os itens, e comparar uma coisa com a outra faria o sistema
 * travar compra por causa de entrega.
 */
export function conferirAlcadaDoFechamento(entrada: {
  valorNoEnvio: number | null;
  valorReal: number;
  /** A faixa fotografada no envio. Nula se a regra foi apagada. */
  faixaDoEnvio: { valorMinimo: number } | null;
  /** Todas as faixas ativas hoje. */
  faixas: FaixaAlcada[];
  tolerancia?: number;
}): ConferenciaDeAlcada {
  const {
    valorNoEnvio, valorReal, faixaDoEnvio, faixas,
    tolerancia = TOLERANCIA_DE_ALCADA,
  } = entrada;

  const estimado = valorNoEnvio ?? 0;
  const faixaAgora = acharFaixa(valorReal, faixas);

  const variacao = estimado > 0
    ? Math.round(((valorReal - estimado) / estimado) * 1000) / 10
    : 0;

  const base = { valorNoEnvio: estimado, valorReal, variacao, faixaAgora };

  // Sem estimativa não há de que desviar. Acontece com solicitação
  // antiga, anterior à fotografia da alçada.
  if (estimado <= 0) return { ...base, precisaReaprovar: false, motivo: null };

  if (valorReal <= estimado * (1 + tolerancia / 100)) {
    return { ...base, precisaReaprovar: false, motivo: null };
  }

  // Passou da tolerância, mas continua na mesma faixa: quem assinou
  // já tinha poder para este valor.
  if (!faixaAgora || !faixaDoEnvio || faixaAgora.valorMinimo <= faixaDoEnvio.valorMinimo) {
    return { ...base, precisaReaprovar: false, motivo: null };
  }

  return {
    ...base,
    precisaReaprovar: true,
    motivo:
      'Fechou em ' + dinheiroBr(valorReal) + ', ' + variacao.toLocaleString('pt-BR') +
      '% acima dos ' + dinheiroBr(estimado) + ' estimados, e mudou de faixa de alçada. ' +
      explicarAprovacao(faixaAgora),
  };
}

/** R$ 1.234,56 — só para as frases daqui. */
function dinheiroBr(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
  });
}
