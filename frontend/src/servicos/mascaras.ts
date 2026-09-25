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
