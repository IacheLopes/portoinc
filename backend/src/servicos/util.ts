// ============================================================
//  Utilidades compartilhadas pelas rotas de cadastro
// ============================================================

import type { Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * O banco guarda dinheiro e quantidade como Decimal, que é o tipo
 * certo: com número comum, 0.1 + 0.2 daria 0.30000000000000004.
 * Mas o JSON não tem Decimal, então convertemos na saída.
 */
export function numero(valor: Prisma.Decimal | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  return Number(valor);
}

/** Monta a resposta padrão de erro de validação. */
export function erroDeValidacao(erro: z.ZodError) {
  return {
    erro: 'Dados inválidos',
    detalhes: erro.issues.map((i) => ({
      campo: i.path.join('.'),
      mensagem: i.message,
    })),
  };
}

/** Texto obrigatório já sem espaços nas pontas. */
export function textoObrigatorio(minimo: number, rotulo: string) {
  return z
    .string()
    .trim()
    .min(minimo, rotulo + ' precisa ter pelo menos ' + minimo + ' caracteres.');
}

/** Texto opcional: string vazia vira ausente, para não gravar lixo. */
/**
 * Campo de texto que pode não vir.
 *
 * Aceita ausente, vazio E nulo — os três chegam de lugares
 * diferentes: campo em branco na tela manda "", um JSON montado
 * a partir de outro endpoint manda null, e um formulário que
 * nem tem o campo simplesmente não manda nada. Recusar o null
 * quebraria o caminho "leio o XML e mando de volta para gravar".
 */
export function textoOpcional(maximo = 255) {
  return z
    .string()
    .trim()
    .max(maximo)
    .nullish()
    .transform((v) => (v === '' || v === null ? undefined : v));
}

/** Remove tudo que não for número. Usado em CNPJ e telefone. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/**
 * Confere o dígito verificador do CNPJ.
 * Evita cadastrar fornecedor com número digitado errado — e um CNPJ
 * errado só aparece no fim do processo, quando a nota fiscal não bate.
 */
export function cnpjValido(entrada: string): boolean {
  const cnpj = apenasDigitos(entrada);

  if (cnpj.length !== 14) return false;
  // Sequências como 11111111111111 passam na conta mas não existem.
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcular = (base: string, pesoInicial: number): number => {
    let soma = 0;
    let peso = pesoInicial;

    for (const digito of base) {
      soma += Number(digito) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const primeiro = calcular(cnpj.slice(0, 12), 5);
  const segundo = calcular(cnpj.slice(0, 13), 6);

  return primeiro === Number(cnpj[12]) && segundo === Number(cnpj[13]);
}

/** Formata 12345678000199 como 12.345.678/0001-99 */
export function formatarCnpj(cnpj: string): string {
  const d = apenasDigitos(cnpj);
  if (d.length !== 14) return cnpj;
  return (
    d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) +
    '/' + d.slice(8, 12) + '-' + d.slice(12)
  );
}

/** Unidades de medida aceitas no cadastro de material. */
export const UNIDADES = [
  'UN', 'PC', 'CX', 'SC', 'FD', 'PAR', 'JG', 'RL', 'GL', 'LT', 'BD',
  'KG', 'TON', 'G',
  'M', 'M2', 'M3', 'CM', 'KM',
  'L', 'ML',
  'H', 'DIA', 'MES', 'VB',
] as const;

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const;

/**
 * +55 (11) 94444-3333
 *
 * O telefone e guardado em digitos puros, porque e o que a integracao
 * do WhatsApp exige. Num documento isso saia assim:
 *
 *   vendas@segurancatotal.com.br · 5511944443333
 *
 * Treze digitos colados no pedido de compra que vai para o
 * fornecedor. A pontuacao e so leitura — o dado nao muda.
 */
export function formatarTelefone(valor: string | null | undefined): string {
  const d = String(valor ?? '').replace(/\D/g, '');
  if (d === '') return '';

  const nacional = d.startsWith('55') && (d.length === 12 || d.length === 13)
    ? d.slice(2)
    : d;

  if (nacional.length < 10 || nacional.length > 11) return String(valor);

  const corte = nacional.length === 10 ? 6 : 7;

  return '+55 (' + nacional.slice(0, 2) + ') '
    + nacional.slice(2, corte) + '-' + nacional.slice(corte);
}

/**
 * R$ 5.000,00 — para texto que a pessoa le.
 *
 * Os avisos das faixas de alcada escreviam "R$ 5000.00": ponto
 * americano, sem separador de milhar. Num aviso que existe justamente
 * para a pessoa conferir um VALOR, o proprio valor saia num formato
 * que ela nao usa.
 */
export function reaisBr(valor: number): string {
  return 'R$ ' + valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
