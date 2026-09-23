// ============================================================
//  PORTA GTIN (codigo de barras / GS1)
//
//  Quando o almoxarife bipa um produto, o sistema pergunta a
//  esta porta "que produto e este?". Hoje responde um catalogo
//  local; amanha pode responder a GS1.
// ============================================================

export interface ProdutoGtin {
  /** Codigo de barras (GTIN-8, 12, 13 ou 14). */
  gtin: string;
  descricao: string;
  marca?: string;
  unidade?: string;
  ncm?: string;
  /** De onde veio a informacao: catalogo proprio ou GS1. */
  origem: string;
}

export interface PortaGtin {
  readonly nome: string;
  disponivel(): boolean;
  consultar(gtin: string): Promise<ProdutoGtin | null>;
}

/**
 * Valida o digito verificador do codigo de barras.
 * Serve para qualquer adaptador: evita cadastrar codigo digitado errado.
 */
export function gtinValido(gtin: string): boolean {
  const digitos = gtin.replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digitos.length)) return false;

  const numeros = digitos.split('').map(Number);
  const verificador = numeros.pop() as number;

  let soma = 0;
  // Da direita para a esquerda os pesos alternam entre 3 e 1.
  for (let i = numeros.length - 1, peso = 3; i >= 0; i--, peso = peso === 3 ? 1 : 3) {
    soma += numeros[i] * peso;
  }

  return (10 - (soma % 10)) % 10 === verificador;
}
