// ============================================================
//  Nota fiscal e contas a pagar
//
//  Tudo aqui funciona SEM a SEFAZ. A nota entra de três jeitos:
//
//    1. Digitada pelo comprador
//    2. Lida do arquivo XML que o fornecedor manda por e-mail
//    3. (no futuro) buscada na SEFAZ pela chave
//
//  Os três terminam no mesmo lugar, então ligar a SEFAZ depois
//  não muda nada no resto do sistema.
// ============================================================

import { isoBr } from './data-br.js';
import { reaisBr, porcentoEmFrase } from './util.js';

const CENTAVO = 0.005;

// ------------------------------------------------------------
//  Chave de acesso
// ------------------------------------------------------------

/**
 * A chave de 44 dígitos carrega, dentro dela, o CNPJ de quem
 * emitiu, o número e a série da nota. Dá para conferir tudo isso
 * sem consultar ninguém — é a nota provando a si mesma.
 */
export interface DadosDaChave {
  uf: string;
  anoMes: string;
  cnpjEmitente: string;
  modelo: string;
  serie: string;
  numero: string;
  digito: string;
}

/** Deixa só os dígitos. */
export function limparChave(chave: string): string {
  return String(chave ?? '').replace(/\D/g, '');
}

/**
 * Dígito verificador da chave: módulo 11 sobre os 43 primeiros
 * dígitos, com pesos 2 a 9 repetidos da direita para a esquerda.
 */
export function calcularDigitoChave(quarentaETres: string): number {
  const digitos = limparChave(quarentaETres).slice(0, 43);
  if (digitos.length !== 43) return -1;

  let soma = 0;
  let peso = 2;

  for (let i = digitos.length - 1; i >= 0; i--) {
    soma += Number(digitos[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }

  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}

/** A chave existe, tem 44 dígitos e o verificador bate? */
export function chaveValida(chave: string): boolean {
  const limpa = limparChave(chave);
  if (limpa.length !== 44) return false;

  return calcularDigitoChave(limpa) === Number(limpa[43]);
}

/** Abre a chave nos pedaços que interessam. */
export function extrairDaChave(chave: string): DadosDaChave | null {
  const c = limparChave(chave);
  if (c.length !== 44) return null;

  return {
    uf: c.slice(0, 2),
    anoMes: c.slice(2, 6),
    cnpjEmitente: c.slice(6, 20),
    modelo: c.slice(20, 22),
    serie: c.slice(22, 25),
    numero: c.slice(25, 34),
    digito: c.slice(43),
  };
}

/** 4444 4444 ... — como aparece no DANFE. */
export function formatarChave(chave: string): string {
  const c = limparChave(chave);
  return c.length === 44 ? (c.match(/.{1,4}/g) ?? []).join(' ') : chave;
}

// ------------------------------------------------------------
//  Conferência contra o pedido
// ------------------------------------------------------------

export interface NotaParaConferir {
  numero: string;
  serie: string;
  chaveAcesso?: string | null;
  cnpjFornecedor: string;
  valorTotal: number;
  emitidaEm: Date;
}

export interface PedidoParaConferir {
  numeroFormatado: string;
  cnpjFornecedor: string;
  /** Soma dos itens + frete + outros custos. */
  valorTotal: number;
  /** Quanto já foi lançado em notas anteriores deste pedido. */
  jaLancado: number;
}

/**
 * Compara a nota com o pedido e devolve o que não bate.
 *
 * Lista vazia significa "pode pagar". Qualquer item na lista vira
 * uma pendência na tela — o sistema não impede de lançar, mas
 * não deixa passar despercebido.
 */
export function conferirNotaContraPedido(
  nota: NotaParaConferir,
  pedido: PedidoParaConferir | null,
): string[] {
  const problemas: string[] = [];

  if (nota.chaveAcesso && !chaveValida(nota.chaveAcesso)) {
    problemas.push('A chave de acesso não passa na conferência dos 44 dígitos.');
  }

  // A própria chave diz de quem é a nota e qual o número dela.
  const dados = nota.chaveAcesso ? extrairDaChave(nota.chaveAcesso) : null;

  if (dados) {
    const cnpjDaChave = dados.cnpjEmitente;
    const cnpjInformado = String(nota.cnpjFornecedor ?? '').replace(/\D/g, '');

    if (cnpjInformado && cnpjDaChave !== cnpjInformado) {
      problemas.push('A chave é de outro CNPJ: ' + formatarCnpjSimples(cnpjDaChave) + '.');
    }

    if (Number(dados.numero) !== Number(nota.numero)) {
      problemas.push(
        'A chave diz que esta é a nota ' + Number(dados.numero) + ', não a ' + nota.numero + '.',
      );
    }
  }

  if (!pedido) {
    problemas.push('Nota sem pedido de compra vinculado: ninguém conferiu o que foi comprado.');
    return problemas;
  }

  const cnpjPedido = String(pedido.cnpjFornecedor ?? '').replace(/\D/g, '');
  const cnpjNota = String(nota.cnpjFornecedor ?? '').replace(/\D/g, '');

  if (cnpjPedido && cnpjNota && cnpjPedido !== cnpjNota) {
    problemas.push('A nota é de um fornecedor diferente do que está no pedido.');
  }

  const restante = pedido.valorTotal - pedido.jaLancado;
  const diferenca = nota.valorTotal - restante;

  if (Math.abs(diferenca) > CENTAVO) {
    if (diferenca > 0) {
      problemas.push(
        'A nota está ' +
          reaisBr(diferenca) +
          ' acima do que falta no pedido ' +
          pedido.numeroFormatado +
          ' (' +
          reaisBr(restante) +
          ').',
      );
    } else {
      problemas.push(
        'A nota está ' +
          reaisBr(-diferenca) +
          ' abaixo do pedido. É entrega parcial? Se for, está certo.',
      );
    }
  }

  return problemas;
}

// ------------------------------------------------------------
//  Parcelas
// ------------------------------------------------------------

export interface CondicaoDePagamento {
  /** Ex.: 30 para 30% de entrada. Nulo = sem entrada. */
  percentualEntrada?: number | null;
  /** Quantas parcelas depois da entrada. */
  quantidadeParcelas?: number | null;
  /** Dias entre uma parcela e outra. */
  intervaloDias?: number | null;
}

export interface Parcela {
  parcela: number;
  totalParcelas: number;
  valor: number;
  vencimento: Date;
}

/**
 * Transforma "30% de entrada + 3x a cada 30 dias" em parcelas
 * com data e valor.
 *
 * A última parcela absorve o arredondamento, para a soma bater
 * exatamente com a nota. Sem isso sobra ou falta centavo, e é
 * sempre o financeiro que descobre — do jeito ruim.
 */
export function gerarParcelas(
  valorTotal: number,
  condicao: CondicaoDePagamento,
  dataBase: Date,
): Parcela[] {
  const total = arredondar(valorTotal);
  if (total <= 0) return [];

  const entradaPercentual = Math.max(0, Math.min(100, condicao.percentualEntrada ?? 0));
  const quantidade = Math.max(0, condicao.quantidadeParcelas ?? 0);
  const intervalo = Math.max(1, condicao.intervaloDias ?? 30);

  // Sem condição nenhuma: à vista.
  if (entradaPercentual === 0 && quantidade === 0) {
    return [{ parcela: 1, totalParcelas: 1, valor: total, vencimento: new Date(dataBase) }];
  }

  const parcelas: Parcela[] = [];
  const temEntrada = entradaPercentual > 0;
  const totalParcelas = (temEntrada ? 1 : 0) + quantidade;

  let acumulado = 0;

  if (temEntrada) {
    const valorEntrada = arredondar((total * entradaPercentual) / 100);
    acumulado += valorEntrada;

    parcelas.push({
      parcela: 1,
      totalParcelas,
      valor: valorEntrada,
      vencimento: new Date(dataBase),
    });
  }

  const restante = arredondar(total - acumulado);
  const valorParcela = quantidade > 0 ? arredondar(restante / quantidade) : 0;

  for (let i = 1; i <= quantidade; i++) {
    const ultima = i === quantidade;
    const valor = ultima ? arredondar(total - acumulado) : valorParcela;
    acumulado = arredondar(acumulado + valor);

    parcelas.push({
      parcela: (temEntrada ? 1 : 0) + i,
      totalParcelas,
      valor,
      vencimento: somarDias(dataBase, intervalo * i),
    });
  }

  return parcelas;
}

/** Descreve a condição em uma linha, para a tela. */
export function descreverCondicao(condicao: CondicaoDePagamento): string {
  const entrada = condicao.percentualEntrada ?? 0;
  const quantidade = condicao.quantidadeParcelas ?? 0;
  const intervalo = condicao.intervaloDias ?? 30;

  if (entrada === 0 && quantidade === 0) return 'À vista';

  const partes: string[] = [];
  if (entrada > 0) partes.push(porcentoEmFrase(entrada) + ' de entrada');
  if (quantidade > 0) partes.push(quantidade + 'x a cada ' + intervalo + ' dias');

  return partes.join(' + ');
}

// ------------------------------------------------------------
//  Vencimento
// ------------------------------------------------------------

export type SituacaoVencimento = 'PAGA' | 'VENCIDA' | 'VENCE_HOJE' | 'A_VENCER' | 'CANCELADA';

/** Em que pé está a parcela, do ponto de vista do caixa. */
export function situacaoVencimento(
  vencimento: Date,
  situacao: 'ABERTA' | 'PAGA' | 'CANCELADA',
  hoje = new Date(),
): SituacaoVencimento {
  if (situacao === 'PAGA') return 'PAGA';
  if (situacao === 'CANCELADA') return 'CANCELADA';

  const dias = diasAte(vencimento, hoje);

  if (dias < 0) return 'VENCIDA';
  if (dias === 0) return 'VENCE_HOJE';
  return 'A_VENCER';
}

/** Quantos dias faltam (negativo = já venceu). Ignora a hora. */
/**
 * O dia que uma DATA-SÓ guarda.
 *
 * Vencimento não é um instante, é uma casa do calendário. Ele nasce
 * de um `<input type="date">`, que vira meia-noite UTC — então o dia
 * certo é o do UTC, e converter para fuso nenhum: "vence dia 22" é
 * dia 22 em qualquer lugar do mundo.
 */
function diaDoVencimento(data: Date): number {
  return Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()) / 86400000;
}

/**
 * O dia de HOJE no calendário de quem lê a tela.
 *
 * Aqui é o contrário: "agora" é um instante de verdade, e o dia dele
 * depende de onde a pessoa está. O container roda em UTC, então
 * `getDate()` devolvia o dia de Londres.
 *
 * Entre 21h e meia-noite de Brasília o UTC já virou o dia seguinte,
 * e uma conta que vencia amanhã aparecia como "vence hoje" — alarme
 * falso toda noite, na tela que existe para avisar prazo. Os testes
 * passavam no container (UTC) e caíam na máquina de quem desenvolve
 * (São Paulo); foi assim que o defeito apareceu, em 27/09/2026.
 */
function diaDeHoje(instante: Date): number {
  const [ano, mes, dia] = isoBr(instante).split('-').map(Number);

  return Date.UTC(ano, mes - 1, dia) / 86400000;
}

export function diasAte(vencimento: Date, hoje = new Date()): number {
  return diaDoVencimento(vencimento) - diaDeHoje(hoje);
}

/**
 * A meia-noite de HOJE, no calendário de quem lê a tela.
 *
 * Serve para contar vencimento no BANCO em vez de trazer toda
 * conta aberta para contar aqui.
 *
 * Ela existe para não deixar o banco decidir que dia é hoje. O
 * `CURRENT_DATE` do Postgres responde em UTC — o container roda
 * assim —, e depois das 21h de São Paulo o UTC já virou o dia. A
 * tela que existe para avisar prazo passaria a marcar como vencida,
 * toda noite, a conta que vence amanhã. É o mesmo defeito de
 * 27/09/2026, que levou `diaDeHoje` a existir; a diferença é que
 * agora ele viajaria para dentro da consulta.
 *
 * Então a fronteira é calculada AQUI, pelo mesmo caminho de
 * `diaDeHoje`, e vai para o banco como parâmetro. O banco não
 * precisa saber onde fica São Paulo.
 *
 * O `vencimento` é gravado como data sem fuso, e o Prisma devolve
 * em UTC — por isso a fronteira também é meia-noite UTC: os dois
 * lados da comparação falam a mesma língua.
 */
export function inicioDoDiaBr(hoje = new Date()): Date {
  return new Date(diaDeHoje(hoje) * 86400000);
}

/** A meia-noite daqui a `dias` dias. */
export function inicioDoDiaBrMais(dias: number, hoje = new Date()): Date {
  return new Date((diaDeHoje(hoje) + dias) * 86400000);
}

/** "vence em 5 dias", "venceu há 3 dias", "vence hoje". */
export function descreverVencimento(vencimento: Date, hoje = new Date()): string {
  const dias = diasAte(vencimento, hoje);

  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias === -1) return 'venceu ontem';
  if (dias > 0) return 'vence em ' + dias + ' dias';
  return 'venceu há ' + -dias + ' dias';
}

/** 42 vira "CP-00042". */
export function formatarNumeroConta(numero: number): string {
  return 'CP-' + String(numero).padStart(5, '0');
}

// ------------------------------------------------------------
//  Leitura do XML da NF-e
//
//  Um leitor pequeno, feito à mão, em vez de uma biblioteca de
//  XML: o arquivo da nota tem estrutura fixa e conhecida, e cada
//  dependência a mais pesa no limite de 1 GB do container.
// ------------------------------------------------------------

export interface ItemDoXml {
  ordem: number;
  codigo: string | null;
  descricao: string;
  gtin: string | null;
  unidade: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface NotaDoXml {
  chaveAcesso: string | null;
  numero: string;
  serie: string;
  emitidaEm: Date | null;
  cnpjEmitente: string | null;
  nomeEmitente: string | null;
  valorTotal: number;
  valorProdutos: number | null;
  valorFrete: number | null;
  itens: ItemDoXml[];
}

/** Pega o conteúdo da primeira tag com aquele nome. */
function tag(xml: string, nome: string): string | null {
  const re = new RegExp('<(?:\\w+:)?' + nome + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + nome + '>', 'i');
  const achado = xml.match(re);
  if (!achado) return null;

  return achado[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

/** Pega todos os blocos com aquele nome. */
function blocos(xml: string, nome: string): string[] {
  const re = new RegExp('<(?:\\w+:)?' + nome + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + nome + '>', 'gi');
  return [...xml.matchAll(re)].map((m) => m[1]);
}

function numeroDoXml(texto: string | null): number {
  if (texto === null) return 0;
  const n = Number(String(texto).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lê o XML da NF-e. Devolve null quando o arquivo não parece uma
 * nota — melhor recusar claramente do que gravar lixo.
 */
export function lerXmlNotaFiscal(xml: string): NotaDoXml | null {
  const texto = String(xml ?? '');
  if (!/<(\w+:)?infNFe/i.test(texto)) return null;

  // A chave vive no atributo Id do infNFe: Id="NFe3525...".
  const idAchado = texto.match(/<(?:\w+:)?infNFe[^>]*\bId\s*=\s*"([^"]+)"/i);
  const chave = idAchado ? limparChave(idAchado[1]) : null;

  const ide = tag(texto, 'ide') ?? '';
  const emit = tag(texto, 'emit') ?? '';
  const totais = tag(texto, 'ICMSTot') ?? '';

  const numero = tag(ide, 'nNF');
  if (!numero) return null;

  const emissao = tag(ide, 'dhEmi') ?? tag(ide, 'dEmi');
  const data = emissao ? new Date(emissao) : null;

  const itens: ItemDoXml[] = blocos(texto, 'det').map((det, indice) => {
    const prod = tag(det, 'prod') ?? det;
    const ean = tag(prod, 'cEAN');

    return {
      ordem: indice + 1,
      codigo: tag(prod, 'cProd'),
      descricao: tag(prod, 'xProd') ?? 'Item sem descrição',
      gtin: ean && ean !== 'SEM GTIN' ? ean : null,
      unidade: tag(prod, 'uCom'),
      quantidade: numeroDoXml(tag(prod, 'qCom')),
      valorUnitario: numeroDoXml(tag(prod, 'vUnCom')),
      valorTotal: numeroDoXml(tag(prod, 'vProd')),
    };
  });

  return {
    chaveAcesso: chave && chave.length === 44 ? chave : null,
    numero,
    serie: tag(ide, 'serie') ?? '1',
    emitidaEm: data && !Number.isNaN(data.getTime()) ? data : null,
    cnpjEmitente: tag(emit, 'CNPJ'),
    nomeEmitente: tag(emit, 'xNome'),
    valorTotal: numeroDoXml(tag(totais, 'vNF')),
    valorProdutos: totais ? numeroDoXml(tag(totais, 'vProd')) : null,
    valorFrete: totais ? numeroDoXml(tag(totais, 'vFrete')) : null,
    itens,
  };
}

// ------------------------------------------------------------
//  Apoio
// ------------------------------------------------------------

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function somarDias(data: Date, dias: number): Date {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

function formatarCnpjSimples(cnpj: string): string {
  const c = String(cnpj).replace(/\D/g, '');
  if (c.length !== 14) return cnpj;

  return (
    c.slice(0, 2) + '.' + c.slice(2, 5) + '.' + c.slice(5, 8) +
    '/' + c.slice(8, 12) + '-' + c.slice(12)
  );
}
