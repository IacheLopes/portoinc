// ============================================================
//  Texto que sai na tela
//
//  Um lugar só para as decisões de escrita que se repetem. Elas
//  parecem detalhe e não são: "1 parcela(s) em atraso" é a frase
//  que faz um sistema parecer inacabado, e ela estava em quinze
//  lugares diferentes.
// ============================================================

/**
 * Dinheiro em português: "R$ 1.234,56".
 *
 * MOROU EM `servicos/cadastros.ts` ATE 09/10/2026 — um cliente de
 * API, com dois formatadores pendurados no fim. O resto da
 * formatação sempre morou aqui, e duas casas para a mesma coisa e
 * como nasce "1.234,5" num lugar e "1.234,50" no outro.
 *
 * O ESPAÇO DEPOIS DO R$ É NÃO SEPARÁVEL, porque `style: 'currency'`
 * devolve assim — e na tela isso é o certo: impede o "R$" de
 * quebrar linha para longe do número. O backend usa espaço comum
 * de propósito, porque lá o texto vai para arquivo, onde quem
 * aperta Ctrl+F digita espaço comum. A diferença é deliberada, e
 * está escrita nos dois lados.
 */
export function dinheiro(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  });
}

/**
 * Quantidade com separador de milhar.
 *
 * As casas são um argumento porque as duas precisões são legítimas
 * e diferentes: no estoque uma quantidade pode ter 4 casas (0,0025
 * de um insumo), num relatório de consumo 4 casas viram ruído.
 *
 * Elas eram duas funções com o mesmo nome em arquivos diferentes —
 * e é assim que um lugar mostra "1.234,5" e outro "1.234,50".
 */
export function quantidade(valor: number, casas = 4): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

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
export function plural(quantos: number, um: string, muitos: string): string {
  // O NÚMERO SAI FORMATADO. Colado cru, `plural(1234, 'nota',
  // 'notas')` escrevia "1234 notas", sem o ponto do milhar — e com
  // número quebrado escreveria "1.5 dias", com o ponto do inglês.
  //
  // Só deu para fazer isto quando `quantidade` veio morar aqui: antes
  // ela estava em `servicos/cadastros.ts`, e importar o cliente de
  // API dentro do módulo de texto arrastaria código de rede para cá.
  //
  // O parâmetro deixou de se chamar `quantidade` para não encobrir a
  // função de mesmo nome.
  return quantidade(quantos, 2) + ' ' + (quantos === 1 ? um : muitos);
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

/**
 * Só a palavra que concorda, sem o número: "usuário", "usuários".
 *
 * `plural` escreve o número junto, e na maioria dos casos é o que se
 * quer. Em dois ela não serve:
 *
 * 1. **O número está em outro elemento.** `<strong>{n}</strong>
 *    usuários` põe negrito só no número. Usar `plural` ali
 *    engrossaria a palavra também, mudando o desenho da tela para
 *    consertar a gramática.
 *
 * 2. **O verbo vem ANTES do número.** "Falta 1 dia" e "Faltam 2
 *    dias" — o verbo concorda e aparece primeiro, onde `plural` não
 *    alcança.
 *
 * Fora desses dois, use `plural`: uma chamada em vez de duas.
 */
export function palavra(quantidade: number, um: string, muitos: string): string {
  return quantidade === 1 ? um : muitos;
}

/**
 * A taxa de juros do mês: "2,0% ao mês".
 *
 * A CASA DECIMAL É FORÇADA, e é o que a separa de `porcento`.
 *
 * As taxas oferecidas na equalização vão de meio em meio ponto —
 * 0,5 · 1 · 1,5 · 2 · 2,5 · 3. Com `porcento`, a lista sai
 * "0,5% · 1% · 1,5% · 2%": metade com vírgula e metade sem, e o
 * que é uma escala de passo fixo parece um punhado de números
 * soltos.
 *
 * Morava escrita à mão dentro da tela de Equalização.
 */
export function jurosAoMes(taxa: number): string {
  return taxa.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + '% ao mês';
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

  // O SINAL VEM ANTES DO SÍMBOLO, como em todo o resto do sistema.
  // Montando o 'R$ ' à mão, o menos ficava preso no meio:
  // "R$ -20,0M". A tela e os arquivos já escrevem "-R$"; o eixo do
  // gráfico era o último lugar que discordava.
  const sinal = valor < 0 ? '-' : '';

  // BILHÃO ENTRA, e não é hipótese: a planilha "Análise de
  // aprovação" do fluxo de compras traz linhas de R$ 1,5 milhão e
  // R$ 2,0 milhões. Somando uma obra ou um ano, dezenas de milhões
  // são plausíveis — e sem este degrau o eixo escrevia
  // "R$ 1000,0M" para um bilhão, e "R$ 15000,0M" para quinze.
  //
  // Acima de bilhão o eixo volta a crescer ("R$ 1.000,0B" para um
  // trilhão), e está combinado: a casa dos bilhões é o teto.
  const escala = (divisor: number, letra: string) =>
    sinal + 'R$ ' + (absoluto / divisor).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + letra;

  if (absoluto >= 1e9) return escala(1e9, 'B');
  if (absoluto >= 1e6) return escala(1e6, 'M');
  if (absoluto >= 1000) return escala(1000, 'k');

  // Abaixo de mil não há abreviação: o número cabe inteiro.
  // `toLocaleString` no lugar de `toFixed`, que é o que põe o
  // separador certo quando o eixo chega a "R$ 999".
  return sinal + 'R$ ' + absoluto.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

/**
 * Quanto tempo faz, em português de gente.
 *
 * Nasceu para o diário da conexão do WhatsApp: "conectado às
 * 12:27" responde QUANDO, e quem olha a tela quer saber HÁ QUANTO
 * TEMPO. As duas coisas aparecem juntas, porque uma sem a outra
 * sempre deixa a pessoa fazendo conta de cabeça.
 *
 * Para de crescer em dias: diário de conexão que diz "há 3 meses"
 * está, na prática, dizendo "nunca".
 */
export function faz(quando: string | Date | null | undefined): string {
  if (!quando) return '—';

  const segundos = Math.floor((Date.now() - new Date(quando).getTime()) / 1000);

  if (segundos < 0) return 'agora';
  if (segundos < 60) return 'há segundos';

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return 'há ' + minutos + ' ' + palavra(minutos, 'minuto', 'minutos');

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return 'há ' + horas + ' ' + palavra(horas, 'hora', 'horas');

  const dias = Math.floor(horas / 24);
  return 'há ' + dias + ' ' + palavra(dias, 'dia', 'dias');
}
