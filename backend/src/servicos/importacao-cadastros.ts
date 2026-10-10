// ============================================================
//  Leitura das planilhas de catálogo (CSV)
//
//  A EMPRESA SAI DA PLANILHA, E ATÉ AQUI SÓ O ORÇAMENTO TINHA
//  PORTA.
//
//  Medido na simulação de entrega de 09/10/2026: o formulário de
//  material tem 10 campos e o de fornecedor tem 9. Uma construtora
//  com 400 materiais e 80 fornecedores digita quase 5.000 campos
//  para mudar de casa — e mudar de casa é o que o sistema inteiro
//  existe para fazer.
//
//  Mesma forma da leitura de orçamento (`orcamento.ts`), e de
//  propósito: quem já entendeu uma entende as três.
//
//    · função pura, testável em milissegundos, sem banco;
//    · a primeira linha é cabeçalho e é descartada;
//    · linha com defeito NÃO invalida o arquivo — vira um
//      problema com o NÚMERO DA LINHA, e o resto segue;
//    · código repetido dentro do arquivo é recusado.
//
//  A leitura linha a linha também é restrição real: o container
//  tem 1 GB, e um catálogo grande carregado inteiro na memória o
//  derruba.
// ============================================================

import { detectarSeparador } from './orcamento.js';
import { apenasDigitos, cnpjValido } from './util.js';

export interface MaterialLido {
  codigoInterno: string;
  descricao: string;
  unidadeMedida: string;
  familiaCodigo: string;
  marca: string | null;
  normaTecnica: string | null;
  gtin: string | null;
  pontoPedido: number | null;
  codigoLinhaPadrao: string | null;
}

export interface FornecedorLido {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  email: string | null;
  whatsapp: string | null;
  cidade: string | null;
  uf: string | null;
  familiasCodigos: string[];
}

export interface Lido<T> {
  linhas: T[];
  problemas: string[];
}

/** Corta o campo e devolve null quando veio vazio. */
function ou(valor: string | undefined): string | null {
  const limpo = (valor ?? '').trim().replace(/^"|"$/g, '');
  return limpo === '' ? null : limpo;
}

/** Quebra o arquivo em linhas de colunas, já sem o cabeçalho. */
function emColunas(csv: string): { colunas: string[]; numero: number }[] | null {
  const linhas = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (linhas.length < 2) return null;

  const separador = detectarSeparador(linhas[0]);

  return linhas.slice(1).map((linha, i) => ({
    numero: i + 2,
    colunas: linha.split(separador).map((c) => c.trim().replace(/^"|"$/g, '')),
  }));
}

/**
 * Planilha de materiais.
 *
 * Colunas, nesta ordem:
 *   familia; codigo; descricao; unidade; marca; norma; gtin;
 *   ponto_pedido; linha_orcamento
 *
 * As quatro primeiras são obrigatórias — são as mesmas que o
 * formulário exige. O resto é opcional, e o que vier em branco
 * fica em branco.
 *
 * A FAMÍLIA VEM PELO CÓDIGO, não pelo nome: nome muda, código é
 * o que a empresa já usa na planilha dela.
 */
export function lerCsvMateriais(csv: string): Lido<MaterialLido> {
  const corpo = emColunas(csv);
  if (!corpo) {
    return {
      linhas: [],
      problemas: ['O arquivo precisa ter o cabeçalho e ao menos uma linha de dados.'],
    };
  }

  const problemas: string[] = [];
  const linhas: MaterialLido[] = [];
  const vistos = new Set<string>();

  for (const { colunas, numero } of corpo) {
    if (colunas.length < 4) {
      problemas.push(
        'Linha ' + numero + ': esperávamos ao menos família, código, descrição e unidade.',
      );
      continue;
    }

    const [familia, codigo, descricao, unidade, marca, norma, gtin, ponto, linhaOrc] = colunas;

    if (!familia || !codigo || !descricao || !unidade) {
      problemas.push('Linha ' + numero + ': família, código, descrição ou unidade em branco.');
      continue;
    }

    if (vistos.has(codigo)) {
      problemas.push('Linha ' + numero + ': código ' + codigo + ' repetido no arquivo.');
      continue;
    }
    vistos.add(codigo);

    // O ponto de pedido é número, e número inválido não vira zero
    // em silêncio: zero quer dizer "não avise", e é diferente de
    // "veio escrito errado".
    let pontoPedido: number | null = null;
    const pontoBruto = ou(ponto);
    if (pontoBruto !== null) {
      const lido = Number(pontoBruto.replace(',', '.'));
      if (!Number.isFinite(lido) || lido < 0) {
        problemas.push(
          'Linha ' + numero + ': ponto de pedido "' + pontoBruto + '" não é um número.',
        );
        continue;
      }
      pontoPedido = lido;
    }

    linhas.push({
      codigoInterno: codigo,
      descricao,
      unidadeMedida: unidade.toUpperCase(),
      familiaCodigo: familia.toUpperCase(),
      marca: ou(marca),
      normaTecnica: ou(norma),
      gtin: ou(gtin),
      pontoPedido,
      codigoLinhaPadrao: ou(linhaOrc),
    });
  }

  return { linhas, problemas };
}

/**
 * Planilha de fornecedores.
 *
 * Colunas, nesta ordem:
 *   cnpj; razao_social; nome_fantasia; email; whatsapp;
 *   cidade; uf; familias
 *
 * `familias` são códigos separados por barra: `ELE/HID`. É a
 * coluna que faz o fornecedor ser convidado para cotação — sem
 * ela ele fica no cadastro e nunca é chamado, que foi o tropeço
 * da simulação de 09/10/2026.
 */
export function lerCsvFornecedores(csv: string): Lido<FornecedorLido> {
  const corpo = emColunas(csv);
  if (!corpo) {
    return {
      linhas: [],
      problemas: ['O arquivo precisa ter o cabeçalho e ao menos uma linha de dados.'],
    };
  }

  const problemas: string[] = [];
  const linhas: FornecedorLido[] = [];
  const vistos = new Set<string>();

  for (const { colunas, numero } of corpo) {
    if (colunas.length < 3) {
      problemas.push(
        'Linha ' + numero + ': esperávamos ao menos CNPJ, razão social e as famílias.',
      );
      continue;
    }

    const [cnpjBruto, razao, fantasia, email, whats, cidade, uf, familias] = colunas;

    if (!cnpjBruto || !razao) {
      problemas.push('Linha ' + numero + ': CNPJ ou razão social em branco.');
      continue;
    }

    const cnpj = apenasDigitos(cnpjBruto);

    // CNPJ errado na planilha é o pior dos erros silenciosos: é
    // ele que liga a nota fiscal ao cadastro.
    if (!cnpjValido(cnpj)) {
      problemas.push('Linha ' + numero + ': CNPJ ' + cnpjBruto + ' não é válido.');
      continue;
    }

    if (vistos.has(cnpj)) {
      problemas.push('Linha ' + numero + ': CNPJ ' + cnpjBruto + ' repetido no arquivo.');
      continue;
    }
    vistos.add(cnpj);

    const codigos = (ou(familias) ?? '')
      .split(/[/|,]/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    if (codigos.length === 0) {
      problemas.push(
        'Linha ' + numero + ': sem família. Fornecedor sem família nunca é convidado a cotar.',
      );
      continue;
    }

    linhas.push({
      cnpj,
      razaoSocial: razao,
      nomeFantasia: ou(fantasia),
      email: ou(email),
      whatsapp: ou(whats) ? apenasDigitos(whats) : null,
      cidade: ou(cidade),
      uf: ou(uf) ? (ou(uf) as string).toUpperCase() : null,
      familiasCodigos: codigos,
    });
  }

  return { linhas, problemas };
}
