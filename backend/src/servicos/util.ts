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

/**
 * Campo de texto que pode não vir — e que pode ser APAGADO.
 *
 * Aceita ausente, vazio e nulo, porque os três chegam de lugares
 * diferentes: campo em branco na tela manda "", um JSON montado a
 * partir de outro endpoint manda null, e um formulário que nem tem
 * o campo simplesmente não manda nada.
 *
 * A DIFERENÇA ENTRE "NÃO VEIO" E "VEIO VAZIO" É O PONTO.
 *
 * Os três viravam `undefined`, e `undefined` diz ao Prisma "não
 * mexa neste campo". O efeito: um campo opcional, uma vez
 * preenchido, NÃO TINHA COMO SER APAGADO. Quem digitou um nome
 * fantasia errado, uma inscrição estadual que não existe ou uma
 * categoria no lançamento ficava com ela para sempre — limpar o
 * campo e salvar não fazia nada, sem erro nenhum na tela.
 *
 * Agora:
 *
 *   campo ausente  -> `undefined` -> o Prisma não toca
 *   campo em branco -> `null`      -> o Prisma APAGA
 *   campo com texto -> o texto
 *
 * Vale para as 67 chamadas do sistema. Na CRIAÇÃO não muda nada:
 * gravar `null` num campo que já nasceria nulo dá no mesmo.
 */
export function textoOpcional(maximo = 255) {
  return z
    .string()
    .trim()
    .max(maximo)
    .nullish()
    .transform((v) => {
      if (v === undefined) return undefined;
      return v === '' || v === null ? null : v;
    });
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
  // Arredonda o MÓDULO, e aplica o sinal depois. Arredondar o valor
  // com sinal esbarra num detalhe do JavaScript: `Math.round(-0.5)`
  // devolve -0, então meio centavo negativo viraria zero enquanto
  // meio centavo positivo vira um centavo.
  const centavos = Math.round(Math.abs(valor) * 100);

  // Negativo que, escrito, é zero não é negativo. Uma subtração de
  // dois valores de dois decimais devolve -4,5e-13 com frequência —
  // e "-R$ 0,00" não quer dizer nada para quem lê.
  const sinal = centavos > 0 && valor < 0 ? '-' : '';

  // O SINAL VEM ANTES DO SÍMBOLO — "-R$ 250,50", e não
  // "R$ -250,50". Esta função nasceu montando o 'R$ ' à mão, o que
  // deixa o menos preso entre o símbolo e o número; a tela, que usa
  // `Intl` com `style: 'currency'`, sempre escreveu "-R$". A mesma
  // linha de caixa saía de um jeito na tabela e de outro no PDF
  // dela. Aparece em "Saldo livre" de orçamento estourado, em
  // "Saldo destes lançamentos" e na economia de cotação que fechou
  // acima do estimado.
  //
  // O ESPAÇO depois do R$ é COMUM, e aqui difere da tela de
  // propósito. `style: 'currency'` devolve espaço NÃO SEPARÁVEL,
  // que na tela é o certo: impede o "R$" de quebrar para longe do
  // número. Em arquivo é o errado — quem aperta Ctrl+F e digita
  // "R$ 1.800" com espaço comum não acha nada. O backend escreve
  // arquivo; a tela continua com o não separável.
  return sinal + 'R$ ' + (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Quantidade em português: "1.234,5678".
 *
 * O backend tinha CINCO cópias disto — duas no extrato de estoque e
 * uma em cada um dos três geradores de PDF —, todas iguais, todas
 * escritas à mão.
 *
 * As casas decimais variam com o lugar: estoque e PDF mostram até
 * quatro (meio saco de cimento, 0,5 m³ de areia), e o relatório de
 * consumo mostra duas porque a coluna é estreita. Por isso o
 * parâmetro — o FORMATO é um só, a precisão é que é do lugar.
 */
export function quantidadeBr(valor: number, casas = 4): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

/**
 * "1 dia", "3 dias", "0 dias".
 *
 * Existe porque o backend escrevia `n + ' dia(s)'` em onze frases —
 * e o "(s)" é o que faz um sistema parecer inacabado. Sete dessas
 * frases vão para dentro de PDF, que é o documento lido em reunião.
 *
 * A PALAVRA RECEBE A FRASE INTEIRA quando a concordância passa do
 * substantivo. Em português ela contamina o adjetivo e o verbo:
 *
 *   plural(n, 'dia de atraso, que custou',
 *             'dias de atraso, que custaram')
 *   plural(n, 'item marcado como disponível está',
 *             'itens marcados como disponíveis estão')
 *
 * Partir isso em pedaços e remendar com `?:` no meio da frase é como
 * nasce "1 itens marcados".
 *
 * ZERO VAI PARA O PLURAL, como se fala: "0 dias", nunca "0 dia".
 *
 * O NÚMERO SAI FORMATADO, e é o que a separa da `plural` do
 * frontend. Lá todos os chamadores passam contagem pequena; aqui
 * `1234` viraria "1234 pedidos", sem o ponto do milhar, dentro de um
 * PDF. O `casas` existe para o único chamador que passa média — o
 * tempo médio de uma solicitação, que tem duas casas.
 */
export function plural(
  quantidade: number,
  um: string,
  muitos: string,
  casas = 0,
): string {
  // O singular segue o número ESCRITO, não o calculado. Com zero
  // casas, 1,4 sai escrito "1" — e "1 dias" é exatamente o defeito
  // que esta função existe para matar.
  const fator = 10 ** casas;
  const arredondado = Math.round(quantidade * fator) / fator;

  return quantidadeBr(quantidade, casas) + ' ' + (arredondado === 1 ? um : muitos);
}

/**
 * Percentual em português: "4,9%".
 *
 * A casa decimal é FIXA de propósito. Sem ela, uma coluna com
 * "12%", "4,9%" e "7%" põe a vírgula de cada linha num lugar
 * diferente, e o olho perde a referência ao descer a coluna.
 */
/**
 * Percentual DE FRASE: "50%", "33,33%".
 *
 * Sem casa forçada, que é o que a separa de `porcentoBr`. Numa
 * frase corrida, "50,0% de entrada" soa de robô; numa COLUNA, a
 * casa fixa é que faz a vírgula cair sempre no mesmo lugar.
 *
 * O frontend já tinha esse par — `porcento` solto e `jurosAoMes`
 * forçado. São duas funções porque são duas necessidades, não
 * porque alguém duplicou.
 *
 *   coluna de relatório  ->  porcentoBr
 *   frase corrida        ->  porcentoEmFrase
 */
export function porcentoEmFrase(valor: number, casas = 2): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: casas }) + '%';
}

export function porcentoBr(valor: number, casas = 1): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }) + '%';
}


/**
 * O dígito verificador do código de barras confere?
 *
 * MORAVA NA PORTA DA INTEGRAÇÃO COM A GS1, e veio para cá quando ela
 * saiu. A conta nunca foi da GS1: é a regra do próprio código de
 * barras, publicada e fixa, e serve para o leitor que bipa errado
 * ou para o dedo que digita um número a menos.
 *
 * O código de barras CONTINUA no sistema — o que saiu foi o
 * serviço pago que respondia "que produto é este?".
 *
 * Aceita GTIN-8, 12, 13 e 14. Da direita para a esquerda os pesos
 * alternam entre 3 e 1.
 */
export function gtinValido(gtin: string): boolean {
  const digitos = gtin.replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digitos.length)) return false;

  const numeros = digitos.split('').map(Number);
  const verificador = numeros.pop() as number;

  let soma = 0;
  for (let i = numeros.length - 1, peso = 3; i >= 0; i--, peso = peso === 3 ? 1 : 3) {
    soma += numeros[i] * peso;
  }

  return (10 - (soma % 10)) % 10 === verificador;
}
