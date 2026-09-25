// ============================================================
//  Máscaras: CNPJ, telefone e chave de acesso
//
//  Pedido do dono na validação de 25/09/2026: "quando preencho fica
//  corrido, eu preciso me atentar aos sinais".
//
//  Ele estava certo, e o problema é maior que conforto. Um CNPJ sem
//  pontuação são catorze dígitos em fila — ninguém confere isso
//  olhando. Com a pontuação, o olho lê em blocos e o erro salta.
//
//  Regra que vale para todas: o sistema GUARDA só os dígitos e
//  MOSTRA pontuado. A pontuação é ajuda de leitura, não dado.
// ============================================================

/** Tira tudo que não é dígito. É o que o sistema guarda. */
export function soDigitos(valor: string): string {
  return String(valor ?? '').replace(/\D/g, '');
}

/**
 * 19.131.243/0001-97
 *
 * Vai pontuando conforme a pessoa digita, e para nos catorze dígitos:
 * o que passar disso é tecla batida sem querer.
 */
export function mascaraCnpj(valor: string): string {
  const d = soDigitos(valor).slice(0, 14);

  if (d.length <= 2) return d;
  if (d.length <= 5) return d.slice(0, 2) + '.' + d.slice(2);
  if (d.length <= 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5);
  if (d.length <= 12) {
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
  }

  return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8)
    + '/' + d.slice(8, 12) + '-' + d.slice(12);
}

/**
 * 123.456.789-09
 *
 * Não existe campo de CPF no sistema hoje — ele só lida com empresas.
 * Fica pronto para o dia em que entrar um prestador pessoa física.
 */
export function mascaraCpf(valor: string): string {
  const d = soDigitos(valor).slice(0, 11);

  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
  if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);

  return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
}

// ------------------------------------------------------------
//  Telefone
//
//  O sistema guarda DDI + DDD + número, tudo em dígitos, porque é
//  o que a integração do WhatsApp exige. O `55` do Brasil é posto
//  aqui e não se digita: ninguém lembra dele, e sem ele a mensagem
//  não chega.
//
//  O `0` de discagem NÃO entra. "(083)" vira "(83)" — aquele zero é
//  prefixo de operadora, não parte do número. Guardado, ele faria o
//  WhatsApp procurar um contato que não existe.
// ------------------------------------------------------------

const DDI_BRASIL = '55';

/**
 * Tira o `55` da frente, quando ele está lá.
 *
 * O que a pessoa edita é DDD + número; o DDI é enfeite fixo na tela.
 * Ao abrir um cadastro antigo, o valor vem com o 55 colado.
 */
export function parteNacional(valor: string): string {
  const d = soDigitos(valor);

  // 12 = 55 + DDD + 8 (fixo). 13 = 55 + DDD + 9 (celular).
  if (d.startsWith(DDI_BRASIL) && (d.length === 12 || d.length === 13)) {
    return d.slice(2);
  }

  return d;
}

/**
 * (83) 99839-2849 — só a parte nacional, que é o que se digita.
 *
 * Celular tem nove dígitos depois do DDD; fixo tem oito. A máscara
 * descobre qual é pelo tamanho, em vez de exigir que a pessoa avise.
 */
export function mascaraTelefone(valor: string): string {
  const d = parteNacional(valor).slice(0, 11);

  if (d.length <= 2) return d;
  if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);

  const corte = d.length <= 10 ? 6 : 7;

  return '(' + d.slice(0, 2) + ') ' + d.slice(2, corte) + '-' + d.slice(corte);
}

/** O que vai para o banco: 5583998392849. Vazio continua vazio. */
export function telefoneParaGuardar(valor: string): string {
  const d = parteNacional(valor);

  return d === '' ? '' : DDI_BRASIL + d;
}

/** +55 (83) 99839-2849 — para mostrar em tela, PDF e Word. */
export function telefoneCompleto(valor: string): string {
  const d = parteNacional(valor);

  return d === '' ? '' : '+' + DDI_BRASIL + ' ' + mascaraTelefone(d);
}

/**
 * A chave da nota fiscal, em onze grupos de quatro.
 *
 * São 44 dígitos. Conferir isso contra um DANFE sem os grupos é
 * tarefa para quem não tem mais nada a fazer.
 */
export function mascaraChaveAcesso(valor: string): string {
  const d = soDigitos(valor).slice(0, 44);

  return (d.match(/.{1,4}/g) ?? []).join(' ');
}

// ------------------------------------------------------------
//  Dinheiro
//
//  Pedido do dono: "ficou 5000 corrido e não R$ 5.000,00".
//
//  Num sistema de compras, número de dinheiro digitado errado é o
//  erro mais caro que existe: ele vira pedido, vira nota, vira conta
//  a pagar. "50000" e "5000" são parecidos demais sem os pontos.
//
//  Enquanto se digita, a máscara agrupa o milhar e deixa a pessoa
//  escrever a vírgula se quiser. AO SAIR do campo, ela completa os
//  centavos. É de propósito: completar antes faria "50" virar
//  "R$ 50,00" no meio da digitação de "5000".
// ------------------------------------------------------------

/**
 * Separa o que é real do que é centavo.
 *
 * Só dígitos e UMA vírgula. O ponto que a pessoa digita vira vírgula:
 * quem usa o teclado numérico aperta ponto sem pensar, e recusar isso
 * seria implicância com um gesto que todo mundo tem.
 */
function partesDoValor(valor: string): { reais: string; centavos: string | null } {
  const texto = String(valor ?? '').replace(/[^\d.,]/g, '');

  // Só a VÍRGULA abre centavos. O ponto agrupa milhar, sempre.
  //
  // Eu tentei duas vezes deixar o ponto servir de decimal também, por
  // causa de quem usa o teclado numérico, e as duas quebraram:
  //
  //   1ª  todo ponto virava vírgula, e "R$ 5.000" virava "R$ 5,00" a
  //       cada tecla — o campo comia o próprio valor.
  //   2ª  ponto seguido de uma ou duas casas era decimal. Aí apagar o
  //       último dígito de "R$ 123.456" deixava "123.45", que o campo
  //       relia como cento e vinte e três reais e quarenta e cinco.
  //
  // A raiz é que "123.45" é genuinamente ambíguo: pode ser alguém
  // digitando centavos no teclado numérico, ou alguém apagando um
  // dígito de 123.456. Olhando só a string, não dá para saber.
  //
  // Entre as duas, apagar acontece o tempo todo e digitar ponto é
  // hábito de uma parte das pessoas — que vê o resultado na hora e
  // corrige com a vírgula. Então o ponto agrupa, e pronto: a regra
  // fica inequívoca e o campo nunca engole valor.
  const corte = texto.lastIndexOf(',');

  const inteiro = (corte >= 0 ? texto.slice(0, corte) : texto).replace(/\D/g, '');
  const decimal = corte >= 0 ? texto.slice(corte + 1).replace(/\D/g, '') : null;

  return {
    reais: inteiro.replace(/^0+(?=\d)/, ''),
    centavos: decimal === null ? null : decimal.slice(0, 2),
  };
}

/** 5000 -> "R$ 5.000". Enquanto se digita. */
export function mascaraDinheiro(valor: string): string {
  const { reais, centavos } = partesDoValor(valor);

  if (reais === '' && centavos === null) return '';

  const agrupado = (reais === '' ? '0' : reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return 'R$ ' + agrupado + (centavos === null ? '' : ',' + centavos);
}

/** 5000 -> "R$ 5.000,00". Ao sair do campo. */
export function dinheiroCompleto(valor: string): string {
  const { reais, centavos } = partesDoValor(valor);

  if (reais === '' && (centavos === null || centavos === '')) return '';

  const agrupado = (reais === '' ? '0' : reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return 'R$ ' + agrupado + ',' + (centavos ?? '').padEnd(2, '0');
}

/**
 * "R$ 5.000,00" -> 5000. É o que vai para o servidor.
 *
 * Campo vazio devolve `null`, e não `0`: um valor não informado é
 * diferente de um valor que é zero. Frete em branco não é frete
 * grátis — é frete que ninguém disse.
 */
export function lerDinheiro(valor: string): number | null {
  const { reais, centavos } = partesDoValor(valor);

  if (reais === '' && (centavos === null || centavos === '')) return null;

  const numero = Number((reais === '' ? '0' : reais) + '.' + (centavos ?? '0').padEnd(2, '0'));

  return Number.isFinite(numero) ? numero : null;
}

/** O caminho de volta: 5000 do banco vira "R$ 5.000,00" no campo. */
export function dinheiroParaCampo(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '';

  return dinheiroCompleto(valor.toFixed(2).replace('.', ','));
}
