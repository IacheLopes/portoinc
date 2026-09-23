// ============================================================
//  Texto que sai na tela
//
//  Um lugar só para as decisões de escrita que se repetem. Elas
//  parecem detalhe e não são: "1 parcela(s) em atraso" é a frase
//  que faz um sistema parecer inacabado, e ela estava em quinze
//  lugares diferentes.
// ============================================================

/**
 * Concorda o número com o substantivo.
 *
 *   plural(1, 'parcela', 'parcelas')  ->  "1 parcela"
 *   plural(3, 'parcela', 'parcelas')  ->  "3 parcelas"
 *
 * Os dois textos são escritos por extenso, e não deduzidos com um
 * "s" no fim: em português o plural não é regular o bastante para
 * isso — "nota/notas" funciona, mas "solicitação/solicitações" e
 * "função/funções" não.
 */
export function plural(quantidade: number, um: string, muitos: string): string {
  return quantidade === 1 ? '1 ' + um : quantidade + ' ' + muitos;
}

/**
 * O mesmo, mas trocando o zero por uma frase.
 *
 *   contar(0, 'parcela', 'parcelas', 'Nada em atraso')  ->  "Nada em atraso"
 *
 * Existe porque "0 parcelas em atraso" é pior que "Nada em atraso":
 * o zero faz a pessoa ler o número antes de entender que está tudo
 * bem.
 */
export function contar(
  quantidade: number,
  um: string,
  muitos: string,
  quandoZero: string,
): string {
  return quantidade === 0 ? quandoZero : plural(quantidade, um, muitos);
}

// ------------------------------------------------------------
//  Números
//
//  Dinheiro e quantidade moram em `cadastros.ts`, que é de onde
//  dezenove arquivos já os importam. Mudá-los de casa é um trabalho
//  próprio, e não faz parte desta etapa — o que importava aqui era
//  parar de ter DUAS versões de cada um.
//
//  Os três abaixo não tinham casa nenhuma: viviam copiados dentro
//  das telas que precisavam deles.
// ------------------------------------------------------------
//
// padrao-ignora: formato-na-mao — este arquivo E uma das casas
// oficiais de formatação. A regra existe para achar cópia espalhada
// pelas telas; acusar a função original é o conferidor mordendo a
// própria cauda.

/** "45,5%" — uma casa decimal, que é o que se lê num painel. */
export function porcento(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
}

/** "1 dia", "4,5 dias". */
export function dias(valor: number): string {
  const n = valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return valor === 1 ? n + ' dia' : n + ' dias';
}

/**
 * Dinheiro abreviado, para eixo de gráfico: "R$ 1,3k", "R$ 2,1M".
 *
 * Não substitui `dinheiro()`: serve onde o espaço é de um rótulo de
 * eixo e o valor exato aparece ao apontar. Em tabela e em cartão,
 * o valor vai por extenso.
 */
export function dinheiroCurto(valor: number): string {
  const absoluto = Math.abs(valor);
  if (absoluto >= 1000000) return 'R$ ' + (valor / 1000000).toFixed(1).replace('.', ',') + 'M';
  if (absoluto >= 1000) return 'R$ ' + (valor / 1000).toFixed(1).replace('.', ',') + 'k';
  return 'R$ ' + valor.toFixed(0);
}
