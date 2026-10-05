// ============================================================
//  Estoque
//
//  Duas ideias sustentam tudo aqui:
//
//  1. O extrato de movimentos é a verdade. Ele nunca é apagado
//     nem corrigido: errou, faz um movimento contrário. É o que
//     permite explicar qualquer saldo meses depois.
//
//  2. O saldo é uma fotografia mantida em paralelo, só para a
//     tela responder rápido "tem ou não tem".
// ============================================================

/**
 * Folga para a imprecisão do ponto flutuante.
 *
 * `0.1 + 0.2` não dá `0.3` em computador nenhum, e um saldo que
 * deveria bater exato com o ponto de pedido ficaria de fora do
 * alerta por um fio.
 *
 * É EXPORTADA porque a tela inicial conta "material no ponto de
 * repor" com uma consulta ao banco, e a consulta precisa da mesma
 * folga. Duas cópias deste número divergiriam no dia em que ele
 * mudasse — assim há uma só, e ela viaja como parâmetro.
 */
export const TOLERANCIA = 0.0001;

export type TipoMovimento =
  | 'ENTRADA'
  | 'SAIDA'
  | 'AJUSTE'
  | 'TRANSFERENCIA_SAIDA'
  | 'TRANSFERENCIA_ENTRADA';

export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Retirada',
  AJUSTE: 'Ajuste de inventário',
  TRANSFERENCIA_SAIDA: 'Transferência (saiu)',
  TRANSFERENCIA_ENTRADA: 'Transferência (entrou)',
};

/** 42 vira "MOV-00042". */
export function formatarNumeroMovimento(numero: number): string {
  return 'MOV-' + String(numero).padStart(5, '0');
}

/** Movimentos que somam no saldo. */
export function soma(tipo: TipoMovimento): boolean {
  return tipo === 'ENTRADA' || tipo === 'TRANSFERENCIA_ENTRADA';
}

// ------------------------------------------------------------
//  Saldo e custo médio
// ------------------------------------------------------------

export interface EstadoDoSaldo {
  quantidade: number;
  custoMedio: number | null;
}

/**
 * Aplica um movimento sobre o saldo e devolve o novo estado.
 *
 * **Custo médio ponderado.** Quando entra material, o custo do
 * estoque vira a média entre o que já estava lá e o que chegou:
 *
 *     (saldo × custo atual + quantidade × preço novo)
 *     ------------------------------------------------
 *              saldo + quantidade
 *
 * É esse número que vale para apontar o consumo da obra. Usar o
 * preço da última nota faria o mesmo saco de cimento valer coisas
 * diferentes dependendo do dia em que foi retirado.
 *
 * Na saída o custo médio não muda: sai material, não muda o preço
 * do que ficou.
 */
export function aplicarMovimento(
  atual: EstadoDoSaldo,
  tipo: TipoMovimento,
  quantidade: number,
  valorUnitario?: number | null,
): EstadoDoSaldo {
  // No ajuste a quantidade já vem com sinal: é a diferença que a
  // contagem física encontrou.
  const delta = tipo === 'AJUSTE' ? quantidade : soma(tipo) ? quantidade : -quantidade;
  const nova = arredondar(atual.quantidade + delta);

  const entrouComPreco =
    delta > 0 && valorUnitario !== null && valorUnitario !== undefined && valorUnitario > 0;

  if (!entrouComPreco) {
    // Estoque zerado perde a referência de custo: o próximo lote
    // que entrar define o preço sozinho.
    return { quantidade: nova, custoMedio: nova <= TOLERANCIA ? null : atual.custoMedio };
  }

  const valorAnterior = atual.quantidade > 0 ? atual.quantidade * (atual.custoMedio ?? 0) : 0;
  const valorQueEntrou = delta * valorUnitario;
  const base = Math.max(atual.quantidade, 0) + delta;

  return {
    quantidade: nova,
    custoMedio: base > 0 ? arredondar((valorAnterior + valorQueEntrou) / base) : valorUnitario,
  };
}

/** Quatro casas: é a precisão que o banco guarda. */
function arredondar(valor: number): number {
  return Math.round(valor * 10000) / 10000;
}

// ------------------------------------------------------------
//  Conferências
// ------------------------------------------------------------

export interface PedidoDeMovimento {
  tipo: TipoMovimento;
  quantidade: number;
  destino?: string | null;
  observacao?: string | null;
}

/**
 * Confere um movimento antes de gravar. Lista vazia = pode.
 */
export function conferirMovimento(
  pedido: PedidoDeMovimento,
  saldoAtual: number,
  nomeDoMaterial: string,
): string[] {
  const problemas: string[] = [];
  const { tipo, quantidade } = pedido;

  if (!Number.isFinite(quantidade)) {
    problemas.push(nomeDoMaterial + ': quantidade inválida.');
    return problemas;
  }

  if (tipo === 'AJUSTE') {
    if (Math.abs(quantidade) <= TOLERANCIA) {
      problemas.push('A contagem bateu com o saldo: não há ajuste a fazer.');
    }

    if (saldoAtual + quantidade < -TOLERANCIA) {
      problemas.push('O ajuste deixaria o saldo negativo.');
    }

    if ((pedido.observacao ?? '').trim().length < 3) {
      problemas.push('Explique o que a contagem encontrou. Ajuste sem motivo não se sustenta.');
    }

    return problemas;
  }

  if (quantidade <= 0) {
    problemas.push(nomeDoMaterial + ': informe uma quantidade maior que zero.');
    return problemas;
  }

  if (!soma(tipo) && quantidade > saldoAtual + TOLERANCIA) {
    problemas.push(
      nomeDoMaterial +
        ': o almoxarifado tem ' +
        formatarQuantidade(saldoAtual) +
        ' e você pediu ' +
        formatarQuantidade(quantidade) +
        '.',
    );
  }

  if (tipo === 'SAIDA' && (pedido.destino ?? '').trim().length < 2) {
    problemas.push('Informe para quem ou para qual frente de serviço o material está saindo.');
  }

  return problemas;
}

// ------------------------------------------------------------
//  Ponto de pedido
// ------------------------------------------------------------

export interface LinhaDeSaldo {
  materialId: string;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  quantidade: number;
  custoMedio: number | null;
  pontoPedido: number | null;
}

/** Está na hora de comprar? */
export function precisaComprar(linha: LinhaDeSaldo): boolean {
  if (linha.pontoPedido === null || linha.pontoPedido <= 0) return false;
  return linha.quantidade <= linha.pontoPedido + TOLERANCIA;
}

/**
 * Quanto sugerir na reposição.
 *
 * Comprar só até o ponto de pedido deixaria o estoque no limite
 * e dispararia o mesmo alerta na semana seguinte. Por isso a
 * sugestão é repor até o **dobro** do ponto de pedido — um número
 * de partida, que o comprador ajusta antes de enviar.
 */
export function quantidadeSugerida(linha: LinhaDeSaldo): number {
  if (linha.pontoPedido === null || linha.pontoPedido <= 0) return 0;
  return arredondar(Math.max(linha.pontoPedido * 2 - linha.quantidade, linha.pontoPedido));
}

/** Uma frase curta para o alerta de compra. */
export function explicarAlerta(linha: LinhaDeSaldo): string {
  if (!precisaComprar(linha)) return '';

  if (linha.quantidade <= TOLERANCIA) {
    return 'Acabou. Mínimo é ' + formatarQuantidade(linha.pontoPedido ?? 0) + ' ' + linha.unidadeMedida + '.';
  }

  return (
    'Restam ' +
    formatarQuantidade(linha.quantidade) +
    ' ' +
    linha.unidadeMedida +
    ', mínimo é ' +
    formatarQuantidade(linha.pontoPedido ?? 0) +
    '.'
  );
}

// ------------------------------------------------------------
//  Totais
// ------------------------------------------------------------

/** Quanto vale o material parado no almoxarifado. */
export function valorDoEstoque(linhas: LinhaDeSaldo[]): number {
  return arredondar(
    linhas.reduce((soma, l) => soma + l.quantidade * (l.custoMedio ?? 0), 0),
  );
}

export function formatarQuantidade(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(valor);
}
