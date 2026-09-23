// ============================================================
//  Leitura da planilha de orçamento (CSV)
//
//  Função pura: recebe texto, devolve linhas e problemas.
//  Não toca no banco — por isso pode ser testada sozinha,
//  em milissegundos, sem subir nada.
// ============================================================

export interface LinhaLida {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidadePrevista: number;
  valorUnitarioPrevisto: number;
  ordem: number;
}

export interface ResultadoLeitura {
  linhas: LinhaLida[];
  problemas: string[];
}

/**
 * Converte texto para número aceitando os dois formatos:
 *   "1.250,00" (brasileiro)  e  "1250.00" (internacional)
 * Devolve null quando não é um número válido ou é negativo.
 */
export function lerNumero(texto: string): number | null {
  const bruto = texto.trim();
  if (bruto === '') return 0;

  // Se tem vírgula, ela é o separador decimal e o ponto é de milhar.
  const limpo = bruto.includes(',')
    ? bruto.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
    : bruto.replace(/\s/g, '');

  const valor = Number(limpo);
  return Number.isFinite(valor) && valor >= 0 ? valor : null;
}

/** Descobre se o arquivo usa ponto e vírgula ou vírgula. */
export function detectarSeparador(cabecalho: string): ';' | ',' {
  const pontoVirgula = (cabecalho.match(/;/g) ?? []).length;
  const virgula = (cabecalho.match(/,/g) ?? []).length;
  return pontoVirgula > virgula ? ';' : ',';
}

/**
 * Lê o CSV inteiro.
 *
 * Regras:
 *  - a primeira linha é cabeçalho e é descartada
 *  - uma linha com defeito NÃO invalida o arquivo: ela vira um
 *    problema descrito com o número da linha, e o resto segue
 *  - código repetido dentro do arquivo é recusado
 */
export function lerCsvOrcamento(csv: string): ResultadoLeitura {
  const linhasTexto = csv.split(/\r?\n/).filter((l) => l.trim() !== '');

  if (linhasTexto.length < 2) {
    return {
      linhas: [],
      problemas: ['O arquivo precisa ter o cabeçalho e ao menos uma linha de dados.'],
    };
  }

  const separador = detectarSeparador(linhasTexto[0]);
  const problemas: string[] = [];
  const linhas: LinhaLida[] = [];
  const vistos = new Set<string>();

  for (let i = 1; i < linhasTexto.length; i++) {
    const numeroLinha = i + 1;
    const colunas = linhasTexto[i]
      .split(separador)
      .map((c) => c.trim().replace(/^"|"$/g, ''));

    if (colunas.length < 3) {
      problemas.push(
        'Linha ' + numeroLinha + ': esperávamos ao menos código, descrição e unidade.',
      );
      continue;
    }

    const [codigo, descricao, unidade, qtdBruta = '0', valorBruto = '0'] = colunas;

    if (!codigo || !descricao || !unidade) {
      problemas.push('Linha ' + numeroLinha + ': código, descrição ou unidade em branco.');
      continue;
    }

    if (vistos.has(codigo)) {
      problemas.push('Linha ' + numeroLinha + ': código ' + codigo + ' repetido no arquivo.');
      continue;
    }

    const quantidade = lerNumero(qtdBruta);
    const valor = lerNumero(valorBruto);

    if (quantidade === null || valor === null) {
      problemas.push(
        'Linha ' + numeroLinha + ': quantidade ou valor não é um número válido.',
      );
      continue;
    }

    vistos.add(codigo);
    linhas.push({
      codigo,
      descricao,
      unidade: unidade.toUpperCase(),
      quantidadePrevista: quantidade,
      valorUnitarioPrevisto: valor,
      ordem: linhas.length + 1,
    });
  }

  return { linhas, problemas };
}
