// ============================================================
//  Recebimento no almoxarifado
//
//  As regras de conferência ficam aqui, longe do banco e do
//  Fastify, para poderem ser testadas sozinhas.
//
//  A ideia central é o SALDO: o pedido diz quanto foi comprado,
//  os recebimentos anteriores dizem quanto já entrou, e a
//  diferença é o que o fornecedor ainda deve.
// ============================================================

/** Quanto de diferença ignoramos ao comparar quantidades. */
const TOLERANCIA = 0.0001;

export type SituacaoItemRecebido = 'CONFORME' | 'COM_RESSALVA' | 'DEVOLVIDO';

export interface ItemDoPedido {
  pedidoItemId: string;
  /** O "COD PORTO" do material. */
  codigo: string;
  /** Código de barras, quando o material tem. */
  gtin: string | null;
  descricao: string;
  unidadeMedida: string;
  quantidadePedida: number;
  quantidadeJaRecebida: number;
}

export interface SaldoItem extends ItemDoPedido {
  /** Quanto o fornecedor ainda deve entregar. */
  saldo: number;
  /** Verdadeiro quando esse item já chegou por inteiro. */
  concluido: boolean;
}

export interface LinhaConferida {
  pedidoItemId: string;
  quantidadeRecebida: number;
  quantidadeDevolvida: number;
  situacao: SituacaoItemRecebido;
  motivo?: string | null;
}

// ------------------------------------------------------------
//  Numeração
// ------------------------------------------------------------

/** 42 vira "REC-00042". */
export function formatarNumeroRecebimento(numero: number): string {
  return 'REC-' + String(numero).padStart(5, '0');
}

/**
 * Entende o número do pedido do jeito que a pessoa digitar.
 *
 * O almoxarife vai ter o PDF na mão, um leitor de código de
 * barras, ou vai simplesmente digitar. Aceitar só o formato
 * exato "PC-00001" transformaria a tela num campo minado.
 *
 * Aceita: "PC-00001", "pc1", "  1 ", "00001", "PC 42".
 */
export function lerNumeroPedido(texto: string): number | null {
  const limpo = String(texto ?? '')
    .trim()
    .toUpperCase()
    .replace(/^PC[\s-]*/, '')
    .replace(/\s/g, '');

  if (limpo === '' || !/^\d+$/.test(limpo)) return null;

  const n = Number.parseInt(limpo, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ------------------------------------------------------------
//  Saldos
// ------------------------------------------------------------

/**
 * Monta a linha de conferência de cada item: quanto foi pedido,
 * quanto já entrou e quanto ainda falta.
 *
 * Material devolvido NÃO baixa saldo de propósito: se chegaram
 * 10 sacos e 3 estavam rasgados, o fornecedor continua devendo
 * esses 3. Baixar o saldo seria perdoar a dívida sozinho.
 */
export function calcularSaldos(itens: ItemDoPedido[]): SaldoItem[] {
  return itens.map((item) => {
    const saldo = Math.max(0, item.quantidadePedida - item.quantidadeJaRecebida);

    return {
      ...item,
      saldo,
      concluido: saldo <= TOLERANCIA,
    };
  });
}

/**
 * Procura um item pelo que foi bipado ou digitado.
 *
 * Tenta o código de barras primeiro (é o que o leitor manda) e
 * depois o código interno. Ignora zeros à esquerda porque muita
 * etiqueta antiga vem com eles.
 */
export function acharItemPorCodigo(itens: SaldoItem[], texto: string): SaldoItem | null {
  const busca = String(texto ?? '').trim();
  if (busca === '') return null;

  const semZeros = busca.replace(/^0+/, '');

  const porGtin = itens.find((i) => i.gtin && i.gtin === busca);
  if (porGtin) return porGtin;

  const porCodigo = itens.find(
    (i) =>
      i.codigo.toUpperCase() === busca.toUpperCase() ||
      i.codigo.replace(/^0+/, '').toUpperCase() === semZeros.toUpperCase(),
  );

  return porCodigo ?? null;
}

// ------------------------------------------------------------
//  Conferência
// ------------------------------------------------------------

/**
 * Confere o que o almoxarife preencheu antes de gravar.
 *
 * Devolve uma lista de problemas em português. Lista vazia
 * significa que pode gravar.
 */
export function conferirRecebimento(linhas: LinhaConferida[], saldos: SaldoItem[]): string[] {
  const problemas: string[] = [];
  const porId = new Map(saldos.map((s) => [s.pedidoItemId, s]));

  let algumaCoisaChegou = false;

  for (const linha of linhas) {
    const item = porId.get(linha.pedidoItemId);

    if (!item) {
      problemas.push('Um dos itens conferidos não pertence a este pedido.');
      continue;
    }

    const recebida = Number(linha.quantidadeRecebida) || 0;
    const devolvida = Number(linha.quantidadeDevolvida) || 0;
    const nome = item.codigo + ' ' + item.descricao;

    if (recebida < 0 || devolvida < 0) {
      problemas.push(nome + ': quantidade não pode ser negativa.');
      continue;
    }

    if (recebida === 0 && devolvida === 0) continue;
    algumaCoisaChegou = true;

    if (item.concluido) {
      problemas.push(nome + ': este item já foi recebido por inteiro.');
      continue;
    }

    if (recebida + devolvida > item.saldo + TOLERANCIA) {
      problemas.push(
        nome +
          ': o saldo é de ' +
          formatarQuantidade(item.saldo) +
          ' ' +
          item.unidadeMedida +
          ', e você informou ' +
          formatarQuantidade(recebida + devolvida) +
          '.',
      );
      continue;
    }

    const motivo = (linha.motivo ?? '').trim();

    if (linha.situacao !== 'CONFORME' && motivo.length < 3) {
      problemas.push(
        nome + ': explique o motivo da ' + (linha.situacao === 'DEVOLVIDO' ? 'devolução' : 'ressalva') + '.',
      );
    }

    if (linha.situacao === 'DEVOLVIDO' && devolvida <= 0) {
      problemas.push(nome + ': marcado como devolvido, mas sem quantidade devolvida.');
    }

    if (linha.situacao === 'CONFORME' && devolvida > 0) {
      problemas.push(
        nome + ': tem quantidade devolvida, então marque como "com ressalva" ou "devolvido".',
      );
    }
  }

  if (!algumaCoisaChegou) {
    problemas.push('Informe pelo menos um item recebido ou devolvido.');
  }

  return problemas;
}

/**
 * Qual passa a ser a situação do pedido depois desta entrega.
 *
 * Só fica RECEBIDO quando não sobra saldo em nenhum item — é o
 * que autoriza o financeiro a pagar a conta inteira na Etapa 9.
 */
export function situacaoDoPedido(saldosDepois: number[]): 'RECEBIDO' | 'RECEBIDO_PARCIAL' {
  const faltaAlgo = saldosDepois.some((s) => s > TOLERANCIA);
  return faltaAlgo ? 'RECEBIDO_PARCIAL' : 'RECEBIDO';
}

/** Recalcula o saldo de cada item depois de aplicar a conferência. */
export function saldosDepoisDe(saldos: SaldoItem[], linhas: LinhaConferida[]): number[] {
  const recebidoAgora = new Map<string, number>();

  for (const linha of linhas) {
    const atual = recebidoAgora.get(linha.pedidoItemId) ?? 0;
    recebidoAgora.set(linha.pedidoItemId, atual + (Number(linha.quantidadeRecebida) || 0));
  }

  return saldos.map((s) => Math.max(0, s.saldo - (recebidoAgora.get(s.pedidoItemId) ?? 0)));
}

/**
 * Uma frase para o almoxarife saber o que acabou de registrar,
 * sem ter que ler a tabela inteira de novo.
 */
export function resumirConferencia(linhas: LinhaConferida[], saldosDepois: number[]): string {
  const ativas = linhas.filter(
    (l) => (Number(l.quantidadeRecebida) || 0) > 0 || (Number(l.quantidadeDevolvida) || 0) > 0,
  );

  const conformes = ativas.filter((l) => l.situacao === 'CONFORME').length;
  const ressalvas = ativas.filter((l) => l.situacao === 'COM_RESSALVA').length;
  const devolvidos = ativas.filter((l) => l.situacao === 'DEVOLVIDO').length;

  const partes: string[] = [];
  if (conformes > 0) partes.push(conformes + (conformes === 1 ? ' item conforme' : ' itens conformes'));
  if (ressalvas > 0) partes.push(ressalvas + (ressalvas === 1 ? ' com ressalva' : ' com ressalva'));
  if (devolvidos > 0) partes.push(devolvidos + (devolvidos === 1 ? ' devolvido' : ' devolvidos'));

  const faltando = saldosDepois.filter((s) => s > TOLERANCIA).length;

  const fim =
    faltando === 0
      ? ' Pedido recebido por inteiro.'
      : faltando === 1
        ? ' Ainda falta chegar 1 item.'
        : ' Ainda faltam chegar ' + faltando + ' itens.';

  return (partes.length > 0 ? partes.join(', ') + '.' : 'Nada registrado.') + fim;
}

/** Números com vírgula e sem casas inúteis: 10, 2,5 e 0,75. */
export function formatarQuantidade(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(valor);
}
