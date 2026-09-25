// ============================================================
//  Procurar município, e adivinhar o nome fantasia
//
//  A lista dos 5.570 municípios (IBGE, DTB 2023) mora em
//  `dados/municipios.ts` e pesa 72 KB. Ela é carregada SÓ quando
//  alguém abre uma tela que tem campo de cidade — por isso o
//  `import()` lá embaixo, e não um import normal no topo.
// ============================================================

export interface Municipio {
  nome: string;
  uf: string;
}

let cache: Municipio[] | null = null;

/** Carrega a lista na primeira vez que alguém precisa dela. */
export async function carregarMunicipios(): Promise<Municipio[]> {
  if (cache) return cache;

  const { MUNICIPIOS_POR_UF } = await import('../dados/municipios');

  const lista: Municipio[] = [];
  for (const [uf, nomes] of Object.entries(MUNICIPIOS_POR_UF)) {
    for (const nome of nomes.split('|')) lista.push({ nome, uf });
  }

  cache = lista;

  return lista;
}

/**
 * Deixa o texto comparável: sem acento, sem maiúscula.
 *
 * Quem procura "sao jose" tem de achar "São José". Exigir o acento
 * certo num campo de busca é pedir que a pessoa já saiba escrever o
 * que está tentando encontrar.
 */
export function comparavel(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Os municípios que combinam com o que foi digitado.
 *
 * Quem COMEÇA com o texto vem primeiro: digitando "santos", "Santos"
 * tem de aparecer antes de "Porto dos Santos". Ordem de lista de
 * sugestão é o que faz ela servir ou atrapalhar.
 */
export function procurarMunicipios(
  lista: readonly Municipio[],
  busca: string,
  limite = 8,
): Municipio[] {
  const alvo = comparavel(busca);
  if (alvo.length < 2) return [];

  const comeca: Municipio[] = [];
  const contem: Municipio[] = [];

  for (const m of lista) {
    const nome = comparavel(m.nome);

    if (nome.startsWith(alvo)) comeca.push(m);
    else if (nome.includes(alvo)) contem.push(m);

    if (comeca.length >= limite) break;
  }

  return [...comeca, ...contem].slice(0, limite);
}

// ------------------------------------------------------------
//  Nome fantasia
// ------------------------------------------------------------

/**
 * Termos que descrevem o NEGÓCIO, não a empresa.
 *
 * "Marquilip Comércio e Representação Ltda" — o nome é "Marquilip";
 * o resto diz o que ela faz. Cortar no primeiro destes acerta a
 * maioria dos casos.
 */
const DESCRITORES = [
  'comercio', 'comercial', 'industria', 'industrial', 'distribuidora',
  'distribuidor', 'representacao', 'representacoes', 'materiais',
  'material', 'servicos', 'servico', 'engenharia', 'construcoes',
  'empreendimentos', 'transportes', 'locacao', 'locacoes', 'importacao',
  'exportacao', 'atacadista', 'varejista', 'depositos', 'deposito',
];

/** Formas jurídicas, que nunca fazem parte do nome de chamar. */
const FORMAS_JURIDICAS = [
  'ltda', 'me', 'epp', 'eireli', 'sa', 's/a', 's.a', 's.a.', 'eppme',
  'mei', 'cia', 'sociedade', 'anonima', 'limitada', 'filial', 'matriz',
];

/**
 * Sugere o nome de chamar a partir da razão social.
 *
 *   Marquilip Comércio e Representação Ltda  ->  Marquilip
 *   Constrular Materiais de Construção Ltda  ->  Constrular
 *   Casa do Construtor Ltda                  ->  Casa do Construtor
 *
 * É palpite, e vai errar às vezes. Por isso é SUGESTÃO: quem cadastra
 * apaga e escreve outro se não gostar. O que ela nunca pode fazer é
 * sobrescrever o que a pessoa já digitou — quem cuida disso é a tela.
 */
export function sugerirNomeFantasia(razaoSocial: string): string {
  const bruto = String(razaoSocial ?? '').trim();
  if (bruto === '') return '';

  const palavras = bruto.split(/\s+/);
  const mantidas: string[] = [];

  for (const palavra of palavras) {
    const limpa = comparavel(palavra).replace(/[.,]/g, '');

    // Corta no primeiro termo que descreve o ramo. O que vem antes é
    // o nome; o que vem depois é a explicação do que a empresa faz.
    if (DESCRITORES.includes(limpa)) break;

    // "e", "de", "do" sozinhos no fim não fazem nome: "Casa do" é
    // pedaço, "Casa do Construtor" é nome.
    if (FORMAS_JURIDICAS.includes(limpa)) continue;

    mantidas.push(palavra);
  }

  while (mantidas.length > 0 && /^(e|de|da|do|das|dos|&)$/i.test(mantidas.at(-1) ?? '')) {
    mantidas.pop();
  }

  const sugestao = mantidas.join(' ').replace(/[.,;]+$/, '').trim();

  // Sem sugestão melhor que a própria razão social, não sugere nada:
  // repetir o campo inteiro não ajuda ninguém.
  return sugestao === '' || comparavel(sugestao) === comparavel(bruto) ? '' : sugestao;
}
