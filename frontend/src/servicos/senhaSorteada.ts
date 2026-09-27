// ============================================================
//  Sortear uma senha provisória
//
//  Quando alguém esquece a senha, o administrador redefine e passa a
//  nova por WhatsApp. Se ele inventar a senha de cabeça, ela vai ser
//  "Porto@2026" em todas as contas — e aí a senha provisória deixa de
//  ser provisória e vira a senha da empresa inteira.
//
//  Sorteando, cada uma é diferente e ninguém precisa pensar.
// ============================================================

/**
 * O alfabeto exclui o que se confunde ao ditar ou ao ler.
 *
 * Fora: O e 0, I e l e 1, S e 5, B e 8. A senha vai ser lida em voz
 * alta no telefone ou copiada de um print — um caractere ambíguo
 * custa uma segunda ligação.
 */
// Sem O, I, S e B nas maiúsculas; sem l nas minúsculas. Cada um
// deles tem um número parecido: 0, 1, 5 e 8.
const LETRAS = 'ACDEFGHJKLMNPQRTUVWXYZacdefghijkmnpqrtuvwxyz';
// Sem 0, 1, 5 e 8 — são os que se confundem com O, l, S e B. Eu
// mesmo deixei o 8 passar na primeira versão, e o teste pegou.
const NUMEROS = '234679';
const SIMBOLOS = '!@#$%&*?';

function sortear(alfabeto: string, quantos: number): string[] {
  const valores = new Uint32Array(quantos);
  crypto.getRandomValues(valores);

  return [...valores].map((v) => alfabeto[v % alfabeto.length]);
}

/**
 * Uma senha de 14 caracteres, com letra, número e símbolo.
 *
 * O servidor exige no mínimo 8 com letra e número. Catorze porque
 * ela vive pouco — só até a pessoa entrar — e não custa nada a mais
 * quando é para copiar e colar.
 */
export function senhaSorteada(): string {
  // Garante um de cada tipo, e completa o resto misturando tudo.
  const obrigatorios = [
    ...sortear(LETRAS, 1),
    ...sortear(NUMEROS, 1),
    ...sortear(SIMBOLOS, 1),
  ];

  const resto = sortear(LETRAS + NUMEROS + SIMBOLOS, 11);
  const tudo = [...obrigatorios, ...resto];

  // Embaralha, senão o primeiro caractere seria sempre uma letra e o
  // segundo sempre um número — padrão é o contrário de aleatório.
  for (let i = tudo.length - 1; i > 0; i -= 1) {
    const sorteio = new Uint32Array(1);
    crypto.getRandomValues(sorteio);
    const j = sorteio[0] % (i + 1);
    [tudo[i], tudo[j]] = [tudo[j], tudo[i]];
  }

  return tudo.join('');
}
