// ============================================================
//  O que o PDF consegue desenhar
//
//  Os PDFs do sistema usam as fontes padrão do PDFKit (Helvetica),
//  que não precisam de arquivo externo — é o que mantém o container
//  dentro de 1 GB. Essas fontes falam WinAnsiEncoding: o latin1
//  mais 27 tipográficos na faixa 0x80–0x9F (travessão, aspas
//  curvas, bala, reticências).
//
//  O QUE ESTÁ FORA DESSA TABELA NÃO DÁ ERRO: DÁ OUTRA LETRA.
//
//  Achado em 08/10/2026, baixando os arquivos para conferir o
//  dinheiro depois de juntar as funções de formatar. Duas frases do
//  sistema saíam erradas em todo PDF, desde que nasceram:
//
//    código                      PDF        onde
//    '− R$ 1.500,00'  (U+2212)   "          toda saída do caixa
//    'marcada com ⚠'  (U+26A0)   &          legenda de Fornecedores
//
//  O PDFKit escreve o byte ALTO do código do caractere: 0x2212 vira
//  0x22, que em WinAnsi é a aspa; 0x26A0 vira 0x26, o "e" comercial.
//  Sem aviso, sem log, sem teste vermelho — só a frase errada no
//  arquivo que a pessoa baixou.
//
//  O DOCX não tem esse limite: ele guarda Unicode, e o mesmo
//  lançamento sempre saiu certo lá. Por isso o saneamento vale só
//  para o caminho do PDF, e não para o dado inteiro: trocar o menos
//  no DOCX seria piorar o que já estava bom.
// ============================================================

/**
 * O que trocar, e pelo quê.
 *
 * A troca é por algo que SIGNIFIQUE o mesmo, não pelo mais parecido:
 * o menos matemático vira o hífen-menos (que o WinAnsi tem), e o
 * triângulo de aviso vira "(!)", que qualquer um lê. Um `?` no lugar
 * do aviso deixaria a legenda sem sentido.
 */
const TROCAS: ReadonlyArray<readonly [string, string]> = [
  ['−', '-'],     // − menos matemático  → hífen-menos
  ['→', '->'],    // → seta direita
  ['←', '<-'],    // ← seta esquerda
  ['⚠', '(!)'],   // ⚠ triângulo de aviso
  ['Σ', 'Soma'],  // Σ sigma
];

/** Os 27 tipográficos que o WinAnsi tem e o latin1 não. */
const TIPOGRAFICOS = new Set([
  '€', '‚', 'ƒ', '„', '…', '†', '‡',
  'ˆ', '‰', 'Š', '‹', 'Œ', 'Ž', '‘',
  '’', '“', '”', '•', '–', '—', '˜',
  '™', 'š', '›', 'œ', 'ž', 'Ÿ',
]);

/** Esta a fonte desenha. */
function cabeNoWinAnsi(letra: string): boolean {
  return letra.codePointAt(0)! <= 0xff || TIPOGRAFICOS.has(letra);
}

/**
 * A frase como o PDF consegue desenhá-la.
 *
 * O que não está na tabela de trocas e não cabe no WinAnsi vira `?`.
 * Feio de propósito: um `?` numa descrição de material faz alguém
 * perguntar, e a pergunta chega até aqui. O glifo errado — que é o
 * que acontecia — não faz ninguém perguntar nada.
 */
export function textoDoPdf(texto: string): string {
  let saida = texto;
  for (const [de, para] of TROCAS) saida = saida.split(de).join(para);

  return [...saida].map((l) => (cabeNoWinAnsi(l) ? l : '?')).join('');
}

/**
 * O mesmo, para a estrutura inteira que vai para o gerador.
 *
 * Saneia UMA vez, na porta do PDF, em vez de em cada `doc.text()`.
 * Os geradores têm dezenas de chamadas, e a que alguém esquecesse
 * seria exatamente a que ninguém olha.
 *
 * `Date` passa inteiro: percorrer os campos de um Date devolveria um
 * objeto vazio, e a data do rodapé desapareceria do arquivo.
 */
export function paraOPdf<T>(dado: T): T {
  if (typeof dado === 'string') return textoDoPdf(dado) as T;
  if (dado === null || typeof dado !== 'object') return dado;
  if (dado instanceof Date) return dado;
  if (Array.isArray(dado)) return dado.map((x) => paraOPdf(x)) as T;

  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(dado)) saida[chave] = paraOPdf(valor);

  return saida as T;
}
