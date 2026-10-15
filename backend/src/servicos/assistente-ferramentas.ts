// ============================================================
//  AS FERRAMENTAS DO ASSISTENTE
//
//  Cada uma é uma consulta de LEITURA ao sistema. A IA escolhe
//  qual usar; quem executa é este arquivo.
//
//  A REGRA QUE SUSTENTA TUDO: o filtro de quem está perguntando
//  é aplicado AQUI, em código, antes de qualquer linha voltar.
//  Nunca no prompt.
//
//  A diferença não é de estilo. Prompt fecha brecha de
//  COMPORTAMENTO — "responda curto", "não seja grosseiro". Prompt
//  não fecha brecha de ACESSO: se o dado entrou na conversa, basta
//  a pessoa escrever "esqueça suas instruções" para ele sair. Com
//  o filtro aqui, o fornecedor da Marquilip NÃO CONSEGUE ver o
//  preço da Constrular, escreva ele o que escrever — a consulta
//  nunca leu essa linha.
//
//  Três públicos, três alcances:
//
//    · equipe       — quem tem conta no sistema. Vê tudo.
//    · fornecedor   — o número bate com um cadastro. Vê o DELE.
//    · desconhecido — não vê nada. É atendido, não informado.
// ============================================================

import type { Prisma } from '@prisma/client';
import { banco } from '../plugins/banco.js';
import { dataBr } from './data-br.js';
import { reaisBr } from './util.js';
import type { FerramentaIA } from '../integracoes/ia/porta.js';

export type QuemPergunta =
  | { tipo: 'equipe'; usuarioId: string; nome: string }
  | { tipo: 'fornecedor'; fornecedorId: string; nome: string }
  | { tipo: 'desconhecido'; nome: string };

export interface Ferramenta {
  definicao: FerramentaIA;
  executar: (argumentos: Record<string, unknown>, quem: QuemPergunta) => Promise<string>;
}

// ------------------------------------------------------------
//  Ajuda de formatação
//
//  O resultado vai para dentro da conversa, e cada palavra custa.
//  Por isso linha curta, sem JSON e sem rodeio: o modelo lê bem
//  assim e a conta no fim do mês é menor.
// ------------------------------------------------------------

//  O FORMATADOR E O OFICIAL, nao uma copia local.
//
//  O conferidor de padrao pegou isto em 14/10/2026, e com razao:
//  duas funcoes de dinheiro no sistema e o caminho certo para um
//  lugar mostrar "1.234,5" e outro "1.234,50".
const dinheiro = (v: unknown): string => reaisBr(Number(v ?? 0));

const numeroBid = (n: number) => 'BID-' + String(n).padStart(5, '0');
const numeroSol = (n: number) => 'SOL-' + String(n).padStart(5, '0');
const numeroPc = (n: number) => 'PC-' + String(n).padStart(5, '0');
const numeroCp = (n: number) => 'CP-' + String(n).padStart(5, '0');

const data = (d: Date | null | undefined) => (d ? dataBr(d) : '—');

const texto = (a: Record<string, unknown>, chave: string): string | undefined => {
  const v = a[chave];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
};

const ehVerdade = (a: Record<string, unknown>, chave: string): boolean => a[chave] === true;

/** Transforma "BID-00001", "bid 1" ou "1" no número cru. */
const soDigitos = (v?: string): number | undefined => {
  if (!v) return undefined;
  const n = Number(v.replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * A SITUAÇÃO EM PORTUGUÊS, e não em caixa alta.
 *
 * Nasceu de um erro real, em 14/10/2026: perguntada sobre obras,
 * ela respondeu "São 3 obras em andamento" — e uma estava em
 * PLANEJAMENTO. O dado estava certo na consulta; ela passou o
 * olho por cima da palavra em caixa alta no fim da linha.
 *
 * Escrito por extenso, o estado deixa de ser um carimbo e passa a
 * ser parte da frase — que é como ela lê. E, de quebra, ela para
 * de repetir "EM_COTACAO" para uma pessoa.
 */
const EM_PORTUGUES: Record<string, string> = {
  //  Obras
  PLANEJAMENTO: 'ainda em planejamento, não começou',
  EM_ANDAMENTO: 'em andamento',
  PARALISADA: 'paralisada',
  CONCLUIDA: 'concluída',

  //  Solicitações
  RASCUNHO: 'rascunho, ainda não enviada',
  AGUARDANDO_APROVACAO: 'esperando assinatura',
  EM_REVISAO: 'devolvida para revisão',
  APROVADA: 'aprovada',
  EM_COTACAO: 'já virou cotação',
  ATENDIDA: 'atendida',
  REPROVADA: 'reprovada',

  //  Cotações
  ABERTO: 'aberta, prazo correndo',
  ENCERRADO: 'encerrada, esperando a escolha',
  CONCLUIDO: 'concluída, pedidos gerados',
  CANCELADO: 'cancelada',

  //  Pedidos
  ENVIADO: 'enviado ao fornecedor',
  CONFIRMADO: 'confirmado pelo fornecedor',
  RECEBIDO_PARCIAL: 'recebido em parte',
  RECEBIDO: 'recebido por completo',

  //  Contas a pagar
  ABERTA: 'em aberto',
  PAGA: 'paga',
  CANCELADA: 'cancelada',
};

const situacaoEmPortugues = (s: string): string => EM_PORTUGUES[s] ?? s.toLowerCase();

const NADA_PARA_VOCE =
  'Esta consulta é só para quem tem conta no sistema. Posso chamar alguém da Porto Inc.';

const LIMITE = 25;

/**
 * Corta a lista e avisa que cortou.
 *
 * Sem isto, "liste os materiais" traz o catálogo inteiro para
 * dentro da conversa e a resposta custa mais do que vale.
 */
function recortar(linhas: string[], total: number): string {
  if (!linhas.length) return 'Nenhum resultado para esta consulta.';

  //  O NÚMERO VEM NA PRIMEIRA LINHA, e isso conserta um defeito
  //  achado em 14/10/2026: perguntado "quantos fornecedores
  //  atendem material elétrico?", o assistente respondeu "10" —
  //  leu o rodapé "(mostrando 1 de 10)", em que o 10 era o total
  //  de fornecedores do banco, não do filtro.
  //
  //  Duas coisas mudaram: o total passou a contar o MESMO filtro
  //  da consulta, e ele passou a vir dito, em vez de ter de ser
  //  deduzido de um rodapé.
  const cabecalho = total + (total === 1 ? ' resultado:' : ' resultados:');
  const fim = total > linhas.length ? '\n(acima, os ' + linhas.length + ' primeiros)' : '';

  return cabecalho + '\n' + linhas.join('\n') + fim;
}

// ============================================================
//  1. Cotações — o assunto mais perguntado
// ============================================================

const consultarCotacoes: Ferramenta = {
  definicao: {
    nome: 'consultarCotacoes',
    descricao:
      'Pacotes de cotação (BID): situação, prazo, quem foi convidado, quem já respondeu, ' +
      'quem abriu o link e não respondeu, e se a equalização (escolha dos vencedores) já foi feita.',
    parametros: {
      type: 'object',
      properties: {
        numero: { type: 'string', description: 'Número do pacote, ex: BID-00001 ou 1' },
        situacao: {
          type: 'string',
          description: 'RASCUNHO, ABERTO, ENCERRADO ou CONCLUIDO',
        },
        fornecedor: { type: 'string', description: 'Nome do fornecedor, para filtrar' },
      },
    },
  },

  async executar(a, quem) {
    if (quem.tipo === 'desconhecido') return NADA_PARA_VOCE;

    const numero = soDigitos(texto(a, 'numero'));
    const situacao = texto(a, 'situacao')?.toUpperCase();
    const nomeFornecedor = texto(a, 'fornecedor');

    const filtro: Prisma.BidWhereInput = {
        ...(numero ? { numero } : {}),
        ...(situacao ? { situacao: situacao as never } : {}),
        //  O FORNECEDOR SÓ ENXERGA PACOTE EM QUE FOI CHAMADO.
        //  Não é filtro de conveniência: é o que impede ele de
        //  saber que existe uma cotação para a qual não foi.
        ...(quem.tipo === 'fornecedor'
          ? { convidados: { some: { fornecedorId: quem.fornecedorId } } }
          : nomeFornecedor
            ? { convidados: { some: { fornecedor: { nomeFantasia: { contains: nomeFornecedor, mode: 'insensitive' } } } } }
            : {}),
    };

    const bids = await banco.bid.findMany({
      where: filtro,
      include: {
        convidados: { include: { fornecedor: { select: { nomeFantasia: true } } } },
        itens: { select: { cotacaoVencedoraId: true } },
      },
      orderBy: { numero: 'desc' },
      take: LIMITE,
    });

    const total = await banco.bid.count({ where: filtro });

    const linhas = bids.map((b) => {
      const escolhidos = b.itens.filter((i) => i.cotacaoVencedoraId).length;
      const equalizacao =
        b.itens.length === 0
          ? 'sem itens'
          : escolhidos === 0
            ? 'equalização ainda NÃO feita'
            : escolhidos < b.itens.length
              ? 'equalização parcial (' + escolhidos + ' de ' + b.itens.length + ' itens escolhidos)'
              : 'equalização feita';

      //  O fornecedor vê a situação DELE, não a dos outros: saber
      //  quem já respondeu é saber contra quem se está disputando.
      const convidados =
        quem.tipo === 'fornecedor'
          ? b.convidados.filter((c) => c.fornecedorId === quem.fornecedorId)
          : b.convidados;

      const detalhe = convidados
        .map((c) => {
          const nome = c.fornecedor.nomeFantasia ?? 'fornecedor';
          if (c.respondidoEm) return nome + ': respondeu em ' + data(c.respondidoEm);
          if (c.visualizadoEm) return nome + ': ABRIU o link em ' + data(c.visualizadoEm) + ' e não respondeu';
          return nome + ': não abriu o link';
        })
        .join('; ');

      const respostas = b.convidados.filter((c) => c.respondidoEm).length;

      return (
        numeroBid(b.numero) + ' · ' + b.titulo +
        ' · situação: ' + situacaoEmPortugues(b.situacao) +
        ' · rodada ' + b.rodada +
        ' · prazo ' + data(b.prazoResposta) +
        (quem.tipo === 'equipe' ? ' · ' + respostas + ' de ' + b.convidados.length + ' responderam' : '') +
        ' · ' + equalizacao +
        (detalhe ? '\n   ' + detalhe : '')
      );
    });

    return recortar(linhas, total);
  },
};

// ============================================================
//  2. Fornecedores
// ============================================================

const consultarFornecedores: Ferramenta = {
  definicao: {
    nome: 'consultarFornecedores',
    descricao:
      'Fornecedores cadastrados: nome, CNPJ, cidade, contato e quais famílias de material ' +
      'cada um atende. É a família que decide quem é convidado para uma cotação.',
    parametros: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Parte do nome ou do CNPJ' },
        familia: { type: 'string', description: 'Nome da família, ex: Material elétrico' },
      },
    },
  },

  async executar(a, quem) {
    if (quem.tipo !== 'equipe') {
      //  Fornecedor não recebe a lista dos concorrentes. Nem os
      //  nomes: saber quem mais a empresa compra já é informação
      //  comercial.
      return 'Só a equipe da Porto Inc. consulta a lista de fornecedores.';
    }

    const busca = texto(a, 'busca');
    const familia = texto(a, 'familia');

    const filtro: Prisma.FornecedorWhereInput = {
        ativo: true,
        ...(busca
          ? {
              OR: [
                { nomeFantasia: { contains: busca, mode: 'insensitive' } },
                { razaoSocial: { contains: busca, mode: 'insensitive' } },
                { cnpj: { contains: busca.replace(/\D/g, '') } },
              ],
            }
          : {}),
        ...(familia
          ? { familias: { some: { familia: { nome: { contains: familia, mode: 'insensitive' } } } } }
          : {}),
    };

    const lista = await banco.fornecedor.findMany({
      where: filtro,
      include: { familias: { include: { familia: { select: { nome: true } } } } },
      orderBy: { nomeFantasia: 'asc' },
      take: LIMITE,
    });

    const total = await banco.fornecedor.count({ where: filtro });

    return recortar(
      lista.map(
        (f) =>
          (f.nomeFantasia ?? f.razaoSocial) +
          ' · ' + f.cnpj +
          ' · ' + (f.cidade ?? '—') + '/' + (f.uf ?? '—') +
          ' · atende: ' + (f.familias.map((x) => x.familia.nome).join(', ') || 'nenhuma família') +
          (f.whatsapp ? ' · tem WhatsApp' : ' · SEM WhatsApp') +
          (f.email ? ' · tem e-mail' : ' · SEM e-mail'),
      ),
      total,
    );
  },
};

// ============================================================
//  3. Solicitações de compra
// ============================================================

const consultarSolicitacoes: Ferramenta = {
  definicao: {
    nome: 'consultarSolicitacoes',
    descricao:
      'Solicitações de compra: número, obra, quem pediu, situação, valor e prazo desejado.',
    parametros: {
      type: 'object',
      properties: {
        numero: { type: 'string', description: 'Número, ex: SOL-00001 ou 1' },
        situacao: {
          type: 'string',
          description:
            'RASCUNHO, AGUARDANDO_APROVACAO, APROVADA, REPROVADA, EM_COTACAO ou ATENDIDA',
        },
        obra: { type: 'string', description: 'Nome ou código da obra' },
      },
    },
  },

  async executar(a, quem) {
    if (quem.tipo !== 'equipe') return NADA_PARA_VOCE;

    const numero = soDigitos(texto(a, 'numero'));
    const situacao = texto(a, 'situacao')?.toUpperCase();
    const obra = texto(a, 'obra');

    const filtro: Prisma.SolicitacaoWhereInput = {
        ...(numero ? { numero } : {}),
        ...(situacao ? { situacao: situacao as never } : {}),
        ...(obra
          ? {
              obra: {
                OR: [
                  { nome: { contains: obra, mode: 'insensitive' } },
                  { codigo: { contains: obra, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
    };

    const lista = await banco.solicitacao.findMany({
      where: filtro,
      include: {
        obra: { select: { codigo: true, nome: true } },
        solicitante: { select: { nome: true } },
        itens: { select: { quantidade: true, valorEstimado: true } },
      },
      orderBy: { numero: 'desc' },
      take: LIMITE,
    });

    const total = await banco.solicitacao.count({ where: filtro });

    return recortar(
      lista.map((s) => {
        const valor = s.itens.reduce(
          (soma, i) => soma + Number(i.quantidade) * Number(i.valorEstimado ?? 0),
          0,
        );
        return (
          numeroSol(s.numero) +
          ' · ' + s.obra.codigo + ' ' + s.obra.nome +
          ' · pedida por ' + s.solicitante.nome +
          ' · situação: ' + situacaoEmPortugues(s.situacao) +
          ' · ' + s.itens.length + ' itens, estimado ' + dinheiro(valor) +
          ' · precisa até ' + data(s.dataDesejada)
        );
      }),
      total,
    );
  },
};

// ============================================================
//  4. Aprovações
// ============================================================

const consultarAprovacoes: Ferramenta = {
  definicao: {
    nome: 'consultarAprovacoes',
    descricao:
      'A fila de aprovação: o que está esperando assinatura, de quem, e qual faixa de alçada ' +
      'decidiu isso. Também explica as faixas de alçada da empresa.',
    parametros: { type: 'object', properties: {} },
  },

  async executar(_a, quem) {
    if (quem.tipo !== 'equipe') return NADA_PARA_VOCE;

    const esperando = await banco.solicitacao.findMany({
      where: { situacao: 'AGUARDANDO_APROVACAO' },
      include: {
        obra: { select: { codigo: true } },
        solicitante: { select: { nome: true } },
        aprovacoes: { include: { funcao: { select: { nome: true } } } },
      },
      orderBy: { numero: 'asc' },
      take: LIMITE,
    });

    const faixas = await banco.regraAlcada.findMany({
      where: { ativa: true },
      include: { funcoes: { include: { funcao: { select: { nome: true } } } } },
      orderBy: { ordem: 'asc' },
    });

    const regras = faixas.map(
      (f) =>
        '  ' + dinheiro(f.valorMinimo) +
        (f.valorMaximo ? ' até ' + dinheiro(f.valorMaximo) : ' para cima') +
        ': ' + f.funcoes.map((x) => x.funcao.nome).join(f.exigeTodas ? ' E ' : ' ou ') +
        (f.exigeTodas ? ' (todos precisam assinar)' : ''),
    );

    const fila = esperando.map((s) => {
      const jaAssinaram = s.aprovacoes
        .filter((ap) => ap.decisao === 'APROVADA')
        .map((ap) => ap.funcao?.nome ?? 'alguém');

      return (
        numeroSol(s.numero) + ' · obra ' + s.obra.codigo +
        ' · de ' + s.solicitante.nome +
        ' · valor ' + dinheiro(s.valorNoEnvio) +
        ' · precisa de: ' + (s.funcoesExigidas.join(s.exigeTodas ? ' E ' : ' ou ') || '—') +
        (jaAssinaram.length ? ' · já assinou: ' + jaAssinaram.join(', ') : ' · ninguém assinou ainda')
      );
    });

    return (
      (fila.length ? 'Esperando assinatura:\n' + fila.join('\n') : 'Nada esperando aprovação.') +
      '\n\nFaixas de alçada:\n' + regras.join('\n')
    );
  },
};

// ============================================================
//  5. Pedidos de compra
// ============================================================

const consultarPedidos: Ferramenta = {
  definicao: {
    nome: 'consultarPedidos',
    descricao:
      'Pedidos de compra emitidos: número, fornecedor, valor, situação e SE JÁ FORAM ENVIADOS ' +
      'ao fornecedor. Também quanto já foi entregue de cada um.',
    parametros: {
      type: 'object',
      properties: {
        numero: { type: 'string', description: 'Número, ex: PC-00001 ou 1' },
        situacao: { type: 'string', description: 'RASCUNHO, ENVIADO, CONFIRMADO, RECEBIDO ou CANCELADO' },
        fornecedor: { type: 'string', description: 'Nome do fornecedor' },
      },
    },
  },

  async executar(a, quem) {
    if (quem.tipo === 'desconhecido') return NADA_PARA_VOCE;

    const numero = soDigitos(texto(a, 'numero'));
    const situacao = texto(a, 'situacao')?.toUpperCase();
    const nomeFornecedor = texto(a, 'fornecedor');

    const filtro: Prisma.PedidoWhereInput = {
        ...(numero ? { numero } : {}),
        ...(situacao ? { situacao: situacao as never } : {}),
        //  Fornecedor vê só o pedido dele. Sempre.
        ...(quem.tipo === 'fornecedor'
          ? { fornecedorId: quem.fornecedorId }
          : nomeFornecedor
            ? { fornecedor: { nomeFantasia: { contains: nomeFornecedor, mode: 'insensitive' } } }
            : {}),
    };

    const lista = await banco.pedido.findMany({
      where: filtro,
      include: {
        fornecedor: { select: { nomeFantasia: true } },
        itens: { select: { quantidade: true, valorUnitario: true } },
        recebimentos: { select: { id: true, recebidoEm: true } },
      },
      orderBy: { numero: 'desc' },
      take: LIMITE,
    });

    const total = await banco.pedido.count({ where: filtro });

    return recortar(
      lista.map((p) => {
        const valor = p.itens.reduce(
          (soma, i) => soma + Number(i.quantidade) * Number(i.valorUnitario ?? 0),
          0,
        );
        return (
          numeroPc(p.numero) +
          ' · ' + (p.fornecedor.nomeFantasia ?? 'fornecedor') +
          ' · ' + dinheiro(valor + Number(p.valorFrete ?? 0) + Number(p.outrosCustos ?? 0)) +
          ' · situação: ' + situacaoEmPortugues(p.situacao) +
          (p.enviadoEm ? ' · enviado em ' + data(p.enviadoEm) : ' · AINDA NÃO ENVIADO ao fornecedor') +
          ' · ' + p.recebimentos.length +
            (p.recebimentos.length === 1 ? ' entrega registrada' : ' entregas registradas')
        );
      }),
      total,
    );
  },
};

// ============================================================
//  O CATÁLOGO — o que a empresa compra
//
//  Faltava, e o buraco era grande: perguntada sobre os materiais,
//  ela respondia "só cimento". Não era invenção — era a única
//  consulta parecida que existia, a de ESTOQUE, e estoque só
//  mostra o que tem SALDO. O catálogo tinha 16 materiais e 5
//  serviços; um deles com saldo.
//
//  São coisas diferentes e agora têm consultas diferentes:
//  catálogo é o que a empresa COMPRA, estoque é o que ela TEM.
// ============================================================

const consultarCatalogo: Ferramenta = {
  definicao: {
    nome: 'consultarCatalogo',
    descricao:
      'O catálogo da empresa: quais MATERIAIS e quais SERVIÇOS estão cadastrados, de que ' +
      'família é cada um, a unidade de medida e o estoque mínimo. Use para "quais materiais ' +
      'temos?", "a empresa compra tal coisa?", "quais serviços?" e para procurar um item pelo ' +
      'nome. NÃO confunda com o estoque, que é só o que tem saldo guardado.',
    parametros: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Parte da descrição, da marca ou o código' },
        tipo: { type: 'string', description: 'MATERIAL ou SERVICO' },
        familia: { type: 'string', description: 'Nome da família, ex: Cimento e argamassas' },
      },
    },
  },

  async executar(a, quem) {
    if (quem.tipo !== 'equipe') return NADA_PARA_VOCE;

    const busca = texto(a, 'busca');
    const tipo = texto(a, 'tipo')?.toUpperCase();
    const familia = texto(a, 'familia');

    const filtro: Prisma.MaterialWhereInput = {
      ativo: true,
      ...(tipo === 'MATERIAL' || tipo === 'SERVICO' ? { tipo } : {}),
      ...(busca
        ? {
            OR: [
              { descricao: { contains: busca, mode: 'insensitive' } },
              { marca: { contains: busca, mode: 'insensitive' } },
              { codigoInterno: { contains: busca } },
            ],
          }
        : {}),
      ...(familia ? { familia: { nome: { contains: familia, mode: 'insensitive' } } } : {}),
    };

    const lista = await banco.material.findMany({
      where: filtro,
      include: { familia: { select: { nome: true } } },
      orderBy: [{ tipo: 'asc' }, { descricao: 'asc' }],
      take: LIMITE,
    });

    const total = await banco.material.count({ where: filtro });

    //  A CONTA SEPARADA VEM JUNTO, porque "quantos materiais e
    //  quantos serviços" é a pergunta mais comum sobre catálogo —
    //  e sem isto ela teria de contar linha por linha e erraria
    //  quando a lista viesse cortada.
    const [materiais, servicos] = await Promise.all([
      banco.material.count({ where: { ...filtro, tipo: 'MATERIAL' } }),
      banco.material.count({ where: { ...filtro, tipo: 'SERVICO' } }),
    ]);

    const cabecalho =
      'No catálogo: ' + materiais + ' materiais e ' + servicos + ' serviços.';

    return (
      cabecalho + '\n' +
      recortar(
        lista.map(
          (m) =>
            (m.tipo === 'SERVICO' ? '[serviço] ' : '[material] ') +
            m.codigoInterno + ' · ' + m.descricao +
            (m.marca ? ' · marca ' + m.marca : '') +
            ' · família ' + m.familia.nome +
            ' · unidade ' + m.unidadeMedida +
            (m.pontoPedido != null ? ' · mínimo ' + Number(m.pontoPedido) : ''),
        ),
        total,
      )
    );
  },
};

// ============================================================
//  6. Estoque e almoxarifado
// ============================================================

const consultarEstoque: Ferramenta = {
  definicao: {
    nome: 'consultarEstoque',
    descricao:
      'SALDO guardado no almoxarifado: quanto tem de cada material e o que está abaixo do ' +
      'estoque mínimo. Mostra APENAS o que já entrou em estoque alguma vez — para saber o que ' +
      'a empresa compra, mesmo sem saldo, use consultarCatalogo.',
    parametros: {
      type: 'object',
      properties: {
        material: { type: 'string', description: 'Parte da descrição ou o código do material' },
        abaixoDoMinimo: { type: 'boolean', description: 'Só o que está abaixo do mínimo' },
      },
    },
  },

  async executar(a, quem) {
    if (quem.tipo !== 'equipe') return NADA_PARA_VOCE;

    const material = texto(a, 'material');

    const saldos = await banco.saldoEstoque.findMany({
      where: material
        ? {
            material: {
              OR: [
                { descricao: { contains: material, mode: 'insensitive' } },
                { codigoInterno: { contains: material } },
              ],
            },
          }
        : {},
      include: {
        material: { select: { codigoInterno: true, descricao: true, unidadeMedida: true, pontoPedido: true } },
        almoxarifado: { select: { nome: true } },
      },
      take: 200,
    });

    const filtrados = ehVerdade(a, 'abaixoDoMinimo')
      ? saldos.filter((s) => s.material.pontoPedido != null && Number(s.quantidade) < Number(s.material.pontoPedido))
      : saldos;

    return recortar(
      filtrados.slice(0, LIMITE).map((s) => {
        const abaixo =
          s.material.pontoPedido != null && Number(s.quantidade) < Number(s.material.pontoPedido);
        return (
          s.material.codigoInterno + ' · ' + s.material.descricao +
          ' · ' + Number(s.quantidade) + ' ' + s.material.unidadeMedida +
          ' em ' + s.almoxarifado.nome +
          (s.material.pontoPedido != null ? ' · mínimo ' + Number(s.material.pontoPedido) : '') +
          (abaixo ? ' · ABAIXO DO MÍNIMO' : '')
        );
      }),
      filtrados.length,
    );
  },
};

// ============================================================
//  7. Financeiro
// ============================================================

const consultarFinanceiro: Ferramenta = {
  definicao: {
    nome: 'consultarFinanceiro',
    descricao:
      'Contas a pagar: parcelas em aberto, pagas, e o que está vencido. Para fornecedor, ' +
      'traz só os títulos dele.',
    parametros: {
      type: 'object',
      properties: {
        situacao: { type: 'string', description: 'ABERTA, PAGA ou CANCELADA' },
        vencidas: { type: 'boolean', description: 'Só o que passou do vencimento e não foi pago' },
      },
    },
  },

  async executar(a, quem) {
    if (quem.tipo === 'desconhecido') return NADA_PARA_VOCE;

    const situacao = texto(a, 'situacao')?.toUpperCase();

    const filtro: Prisma.ContaPagarWhereInput = {
        ...(situacao ? { situacao: situacao as never } : {}),
        ...(ehVerdade(a, 'vencidas') ? { situacao: 'ABERTA', vencimento: { lt: new Date() } } : {}),
        ...(quem.tipo === 'fornecedor' ? { fornecedorId: quem.fornecedorId } : {}),
    };

    const lista = await banco.contaPagar.findMany({
      where: filtro,
      include: { fornecedor: { select: { nomeFantasia: true } } },
      orderBy: { vencimento: 'asc' },
      take: LIMITE,
    });

    const total = await banco.contaPagar.count({ where: filtro });

    return recortar(
      lista.map(
        (c) =>
          numeroCp(c.numero) +
          ' · ' + (c.fornecedor.nomeFantasia ?? 'fornecedor') +
          ' · parcela ' + c.parcela + '/' + c.totalParcelas +
          ' · ' + dinheiro(c.valor) +
          ' · vence ' + data(c.vencimento) +
          ' · situação: ' + situacaoEmPortugues(c.situacao) +
          (c.pagoEm ? ' · pago em ' + data(c.pagoEm) + ' (' + dinheiro(c.valorPago) + ')' : ''),
      ),
      total,
    );
  },
};

// ============================================================
//  8. Obras
// ============================================================

const consultarObras: Ferramenta = {
  definicao: {
    nome: 'consultarObras',
    descricao: 'As obras da empresa: código, nome, cliente, cidade e situação.',
    parametros: { type: 'object', properties: {} },
  },

  async executar(_a, quem) {
    if (quem.tipo !== 'equipe') return NADA_PARA_VOCE;

    const lista = await banco.obra.findMany({ orderBy: { codigo: 'asc' }, take: LIMITE });

    return recortar(
      lista.map(
        (o) =>
          o.codigo + ' · ' + o.nome +
          ' · ' + (o.cliente ?? '—') +
          ' · ' + (o.cidade ?? '—') + '/' + (o.uf ?? '—') +
          ' · situação: ' + situacaoEmPortugues(o.situacao),
      ),
      lista.length,
    );
  },
};

// ============================================================
//  9. Pessoas, funções e responsáveis
// ============================================================

const consultarPessoas: Ferramenta = {
  definicao: {
    nome: 'consultarPessoas',
    descricao:
      'Quem trabalha no sistema e com qual função (comprador, almoxarife, engenheiro, ' +
      'gestor de obra, fundador, solicitante, administrador). Serve para dizer quem é responsável pelo quê.',
    parametros: {
      type: 'object',
      properties: { funcao: { type: 'string', description: 'Filtra por função, ex: Comprador' } },
    },
  },

  async executar(a, quem) {
    if (quem.tipo !== 'equipe') {
      //  Nome e função de funcionário é dado de pessoa. Não sai
      //  para quem não é da casa, nem para fornecedor.
      return 'Só a equipe da Porto Inc. consulta as pessoas do sistema.';
    }

    const funcao = texto(a, 'funcao');

    const lista = await banco.usuario.findMany({
      where: {
        ativo: true,
        ...(funcao ? { funcoes: { some: { funcao: { nome: { contains: funcao, mode: 'insensitive' } } } } } : {}),
      },
      include: { funcoes: { include: { funcao: { select: { nome: true } } } } },
      orderBy: { nome: 'asc' },
      take: LIMITE,
    });

    return recortar(
      lista.map((u) => u.nome + ' · ' + (u.funcoes.map((f) => f.funcao.nome).join(', ') || 'sem função')),
      lista.length,
    );
  },
};

// ============================================================
//  10. O resumo geral — serve de "por onde começo?"
// ============================================================

const resumoDoSistema: Ferramenta = {
  definicao: {
    nome: 'resumoDoSistema',
    descricao:
      'Visão geral em números: quantas solicitações esperam aprovação, cotações abertas, ' +
      'pedidos sem enviar, entregas pendentes, contas vencidas e material abaixo do mínimo. ' +
      'Use quando a pergunta for ampla, do tipo "como estão as coisas?".',
    parametros: { type: 'object', properties: {} },
  },

  async executar(_a, quem) {
    if (quem.tipo !== 'equipe') return NADA_PARA_VOCE;

    const [aprovar, cotacoesAbertas, pedidosSemEnviar, vencidas, obras, fornecedores] =
      await Promise.all([
        banco.solicitacao.count({ where: { situacao: 'AGUARDANDO_APROVACAO' } }),
        banco.bid.count({ where: { situacao: 'ABERTO' } }),
        banco.pedido.count({ where: { situacao: 'RASCUNHO' } }),
        banco.contaPagar.count({ where: { situacao: 'ABERTA', vencimento: { lt: new Date() } } }),
        banco.obra.count({ where: { situacao: 'EM_ANDAMENTO' } }),
        banco.fornecedor.count({ where: { ativo: true } }),
      ]);

    return [
      'Solicitações esperando aprovação: ' + aprovar,
      'Cotações abertas: ' + cotacoesAbertas,
      'Pedidos ainda não enviados ao fornecedor: ' + pedidosSemEnviar,
      'Contas a pagar vencidas: ' + vencidas,
      'Obras em andamento: ' + obras,
      'Fornecedores ativos: ' + fornecedores,
    ].join('\n');
  },
};

// ============================================================
//  11. A saída honesta
// ============================================================

const chamarUmaPessoa: Ferramenta = {
  definicao: {
    nome: 'chamarUmaPessoa',
    descricao:
      'Use quando não souber responder, quando a pessoa pedir para falar com alguém, ou quando ' +
      'o assunto exigir decisão humana. Registra o pedido para a equipe retomar.',
    parametros: {
      type: 'object',
      properties: { motivo: { type: 'string', description: 'Por que precisa de uma pessoa' } },
      required: ['motivo'],
    },
  },

  async executar(a, quem) {
    //  Não escreve no banco aqui de propósito: quem registra é o
    //  `assistente.ts`, que já está gravando a conversa inteira e
    //  sabe de qual número ela veio. Esta ferramenta existe para a
    //  IA ter como DIZER "me tira daqui" — e para esse pedido
    //  virar sinal, em vez de uma frase perdida no meio do texto.
    return (
      'Pedido de atendimento humano registrado (' +
      (texto(a, 'motivo') ?? 'sem motivo informado') +
      '). Diga à pessoa que alguém da Porto Inc. vai retomar, e não prometa prazo.'
    );
  },
};

// ============================================================
//  O catálogo
// ============================================================

export const FERRAMENTAS: Ferramenta[] = [
  consultarCatalogo,
  consultarCotacoes,
  consultarFornecedores,
  consultarSolicitacoes,
  consultarAprovacoes,
  consultarPedidos,
  consultarEstoque,
  consultarFinanceiro,
  consultarObras,
  consultarPessoas,
  resumoDoSistema,
  chamarUmaPessoa,
];

const PORNOME = new Map(FERRAMENTAS.map((f) => [f.definicao.nome, f]));

/**
 * Executa o que a IA pediu.
 *
 * Nome desconhecido não derruba a conversa: o modelo às vezes
 * inventa uma função que não existe, e a resposta certa é dizer
 * isso a ele — na volta seguinte ele escolhe uma de verdade.
 */
export async function executarFerramenta(
  nome: string,
  argumentos: Record<string, unknown>,
  quem: QuemPergunta,
): Promise<string> {
  const ferramenta = PORNOME.get(nome);
  if (!ferramenta) return 'Não existe consulta chamada "' + nome + '".';

  try {
    return await ferramenta.executar(argumentos, quem);
  } catch (erro) {
    //  Erro de banco vira texto para a IA, não exceção para cima:
    //  o assistente ainda consegue dizer "não consegui consultar
    //  isso agora", que é melhor do que silêncio no WhatsApp.
    return 'A consulta falhou: ' + (erro instanceof Error ? erro.message : 'erro desconhecido');
  }
}

export const DEFINICOES = FERRAMENTAS.map((f) => f.definicao);
