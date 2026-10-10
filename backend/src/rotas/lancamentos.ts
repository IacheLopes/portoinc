// ============================================================
//  Receitas e despesas lançadas à mão
//
//  O FINANCEIRO SÓ SABIA TIRAR.
//
//  A nota do fornecedor virava parcela em contas a pagar, e
//  pronto. Não havia de onde descontar: o sistema controlava a
//  saída de um caixa que nunca tinha recebido nada.
//
//  Emerson, na reunião de 08/10/2026: "como é que tu fez um
//  financeiro que eu não consigo cadastrar receita e despesa? Ele
//  vai descontar de uma conta que não tem cadastro de dinheiro de
//  entrada". A regra que ficou para a casa: todo financeiro da AV2
//  tem cadastro de receita e de despesa.
//
//  ESTAS ROTAS NÃO SUBSTITUEM AS CONTAS A PAGAR, e isso é de
//  propósito. A compra continua nascendo da nota fiscal, com
//  fornecedor, pedido e conferência atrás dela. Repetir a mesma
//  dívida aqui daria dois lugares para o mesmo dinheiro, e um dia
//  eles divergiriam.
//
//  Aqui mora o que NÃO vem de compra: a medição que o cliente
//  pagou, o aporte do sócio, o combustível, o aluguel do
//  container, a diária da retroescavadeira.
// ============================================================

import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { lerPaginacao, camposDaPagina } from '../servicos/paginacao.js';
import {
  numero, erroDeValidacao, textoOpcional, textoObrigatorio, reaisBr,
} from '../servicos/util.js';
import { gerarArquivoDaTabela, formatoValido } from '../servicos/tabela-arquivo.js';
import { dataBr } from '../servicos/data-br.js';
import {
  formatarNumeroLancamento, montarCaixa, agruparPorCategoria, calendarioDoCaixa,
} from '../servicos/caixa.js';
import type { LancamentoParaCaixa, ContaFutura } from '../servicos/caixa.js';

const TIPOS = ['RECEITA', 'DESPESA'] as const;

/**
 * O rótulo muda com o tipo, e isso não é enfeite.
 *
 * "Realizado" obriga quem lê a traduzir de cabeça: para a receita o
 * que aconteceu foi o dinheiro CAIR; para a despesa, SAIR. No papel
 * impresso, onde ninguém pode perguntar, isso pesa mais ainda.
 */
const SITUACAO_NO_PAPEL: Record<string, Record<string, string>> = {
  RECEITA: { PREVISTO: 'A receber', REALIZADO: 'Recebido', CANCELADO: 'Cancelado' },
  DESPESA: { PREVISTO: 'A pagar', REALIZADO: 'Pago', CANCELADO: 'Cancelado' },
};

const esquemaNovo = z.object({
  tipo: z.enum(TIPOS),
  /**
   * Dinheiro que a empresa já tinha ao entrar no sistema.
   *
   * Entra no saldo como qualquer entrada; não entra no
   * faturamento. Só vale para RECEITA — "saldo inicial negativo"
   * é dívida, e dívida tem o lugar dela.
   */
  aberturaDeCaixa: z.boolean().default(false),
  descricao: textoObrigatorio(3, 'A descrição'),
  // Positivo sempre. Quem diz se soma ou subtrai é o TIPO, não o
  // sinal: com valor negativo numa despesa, o saldo passaria a
  // somar — e ninguém repara num menos perdido no meio da lista.
  valor: z.coerce.number().positive('O valor precisa ser maior que zero.'),
  previstoPara: z.string().min(1, 'Informe a data.'),
  obraId: z.string().uuid().optional().nullable(),
  categoria: textoOpcional(60),
  formaPagamento: textoOpcional(60),
  observacoes: textoOpcional(500),
  /** Já acontecida? Então marca de uma vez, sem dois passos. */
  jaAconteceu: z.boolean().optional(),
});

const esquemaEdicao = esquemaNovo.partial().omit({ jaAconteceu: true });

const INCLUIR = {
  obra: { select: { id: true, codigo: true, nome: true } },
  criadoPor: { select: { nome: true } },
} as const;

/**
 * A linha como o banco devolve, derivada do include acima.
 *
 * Escrita a mao, esta forma viraria mentira no dia em que o modelo
 * ganhasse um campo: o `valor` Decimal declarado como `unknown`
 * passava pelo compilador e quebrava na conversao.
 */
type LinhaDoBanco = Prisma.LancamentoFinanceiroGetPayload<{ include: typeof INCLUIR }>;

function formatar(l: LinhaDoBanco) {
  return {
    id: l.id,
    numeroFormatado: formatarNumeroLancamento(l.numero),
    tipo: l.tipo,
    descricao: l.descricao,
    valor: numero(l.valor) ?? 0,
    previstoPara: l.previstoPara,
    realizadoEm: l.realizadoEm,
    situacao: l.situacao,
    aberturaDeCaixa: l.aberturaDeCaixa,
    categoria: l.categoria,
    formaPagamento: l.formaPagamento,
    observacoes: l.observacoes,
    obra: l.obra,
    criadoPor: l.criadoPor.nome,
    criadoEm: l.criadoEm,
  };
}

// ------------------------------------------------------------
//  A trilha
//
//  O plano de arquitetura do projeto pede auditoria de "toda
//  aprovação, alteração de preço e movimento de estoque". A
//  solicitação ganhou a dela; o dinheiro lançado à mão, não.
//
//  Dava para trocar uma entrada de R$ 100.000 por uma saída de
//  R$ 100.000 — R$ 200 mil de diferença no saldo — sem deixar nem
//  quem fez nem o que havia antes. Saldo que muda sem rastro é pior
//  que saldo errado: o errado alguém percebe.
// ------------------------------------------------------------

/** Grava um evento. Nunca derruba a ação: trilha não trava trabalho. */
async function anotar(
  lancamentoId: string,
  usuarioId: string,
  tipo: string,
  descricao: string,
): Promise<void> {
  try {
    await banco.lancamentoEvento.create({
      data: { lancamentoId, usuarioId, tipo, descricao },
    });
  } catch {
    // Se a trilha falhar, o lançamento já aconteceu. Derrubar a
    // resposta agora faria a pessoa repetir uma operação que deu
    // certo — e duplicar dinheiro é pior que perder uma linha de log.
  }
}

/**
 * O que mudou, campo a campo, em "antes → depois".
 *
 * SÓ O QUE MUDOU DE VERDADE. Uma correção que trocou só o valor não
 * pode anotar sete campos iguais — trilha cheia de linha sem
 * novidade é trilha que ninguém lê, e trilha que ninguém lê não
 * audita nada.
 */
function oQueMudou(
  antes: Record<string, unknown>,
  depois: Record<string, unknown>,
  rotulos: Record<string, string>,
): string[] {
  const linhas: string[] = [];

  for (const [campo, rotulo] of Object.entries(rotulos)) {
    if (!(campo in depois) || depois[campo] === undefined) continue;
    if (String(antes[campo] ?? '') === String(depois[campo] ?? '')) continue;

    linhas.push(
      rotulo + ': ' +
      (antes[campo] === null || antes[campo] === '' || antes[campo] === undefined
        ? '(vazio)'
        : String(antes[campo])) +
      ' → ' +
      (depois[campo] === null || depois[campo] === ''
        ? '(vazio)'
        : String(depois[campo])),
    );
  }

  return linhas;
}

/** Lê a data da tela, que vem como "2026-10-08". */
function lerData(texto: string): Date | null {
  // Meio-dia, e não meia-noite: a data gravada à meia-noite de um
  // fuso vira o dia anterior noutro, e o lançamento de hoje
  // aparece como de ontem. Mesmo cuidado do resto do sistema.
  const d = new Date(texto.length === 10 ? texto + 'T12:00:00' : texto);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function rotasLancamentos(app: FastifyInstance) {
  const verFinanceiro = { preHandler: app.exigirPermissao('financeiro.ver') };
  const gerenciar = { preHandler: app.exigirPermissao('financeiro.gerenciar') };

  // --------------------------------------------------------
  //  Listar
  // --------------------------------------------------------
  app.get('/api/lancamentos', verFinanceiro, async (req) => {
    const q = req.query as {
      tipo?: string;
      situacao?: string;
      obraId?: string;
      pagina?: string;
      porPagina?: string;
    };

    // Um filtro só, para a conta e para a busca: se divergirem, a
    // barra promete páginas que a lista não tem.
    const filtro = {
      ...(q.tipo ? { tipo: q.tipo as never } : {}),
      ...(q.situacao ? { situacao: q.situacao as never } : {}),
      ...(q.obraId ? { obraId: q.obraId } : {}),
    };

    const pedido = lerPaginacao(q);

    const [total, linhas] = await Promise.all([
      banco.lancamentoFinanceiro.count({ where: filtro }),
      banco.lancamentoFinanceiro.findMany({
        where: filtro,
        include: INCLUIR,
        orderBy: [{ previstoPara: 'desc' }, { numero: 'desc' }],
        skip: pedido.pular,
        take: pedido.porPagina,
      }),
    ]);

    return {
      lancamentos: linhas.map(formatar),
      ...camposDaPagina(total, pedido),
    };
  });

  // --------------------------------------------------------
  //  O saldo
  //
  //  É a resposta à pergunta que o financeiro não sabia dar:
  //  quanto entrou, quanto saiu, quanto sobrou.
  // --------------------------------------------------------
  app.get('/api/lancamentos/caixa', verFinanceiro, async (req) => {
    const { obraId } = req.query as { obraId?: string };

    // A compra chega à obra por um caminho longo: a parcela é da
    // nota, a nota é do pedido, o item do pedido veio do item da
    // cotacao, que veio do item da solicitacao — e a OBRA está na
    // solicitacao. Nao e redundancia a ser achatada: e o rastro de
    // quem pediu, quem cotou e quem aprovou.
    const obraDaConta = obraId
      ? {
          notaFiscal: {
            pedido: {
              itens: {
                some: {
                  bidItem: { solicitacaoItem: { solicitacao: { obraId } } },
                },
              },
            },
          },
        }
      : {};

    const [lancamentos, contas] = await Promise.all([
      banco.lancamentoFinanceiro.findMany({
        where: obraId ? { obraId } : {},
        select: {
          tipo: true, valor: true, previstoPara: true, realizadoEm: true,
          situacao: true, categoria: true, aberturaDeCaixa: true,
        },
      }),
      banco.contaPagar.findMany({
        where: obraDaConta,
        select: { valor: true, valorPago: true, situacao: true, vencimento: true },
      }),
    ]);

    const paraCaixa: LancamentoParaCaixa[] = lancamentos.map((l) => ({
      tipo: l.tipo,
      valor: numero(l.valor) ?? 0,
      previstoPara: l.previstoPara,
      realizadoEm: l.realizadoEm,
      situacao: l.situacao,
      categoria: l.categoria,
      aberturaDeCaixa: l.aberturaDeCaixa,
    }));

    const parcelas: ContaFutura[] = contas.map((c) => ({
      valor: numero(c.valor) ?? 0,
      valorPago: numero(c.valorPago),
      situacao: c.situacao,
      vencimento: c.vencimento,
    }));

    const caixa = montarCaixa(paraCaixa, parcelas);

    // TRES PERGUNTAS, UMA CHAMADA SÓ.
    //
    // Quanto tenho (o caixa), de onde vem e para onde vai (as
    // categorias), e o que vem pela frente (o calendário). Separar
    // em três rotas faria a tela abrir em três tempos e daria três
    // chances de um número discordar do outro — todos saem das
    // MESMAS duas listas, carregadas uma vez.
    const SEMANAS = 6;

    return {
      caixa,
      // A rosca responde "de onde vem o dinheiro QUE A EMPRESA
      // GANHOU". O saldo de abertura não vem de lugar nenhum: ela
      // já tinha. Deixá-lo dentro fazia uma fatia de 100% com o
      // nome "Saldo inicial" e empurrava todo o resto para perto
      // de zero — medido com R$ 2 milhões na simulação de
      // 09/10/2026. Ele aparece em texto, ao lado do cartão.
      deOndeVem: agruparPorCategoria(
        paraCaixa.filter((l) => l.aberturaDeCaixa !== true),
        'RECEITA',
      ),
      paraOndeVai: agruparPorCategoria(paraCaixa, 'DESPESA'),
      calendario: calendarioDoCaixa(caixa.saldo, paraCaixa, parcelas, new Date(), SEMANAS),
      semanas: SEMANAS,
      obraId: obraId ?? null,
    };
  });

  // --------------------------------------------------------
  //  Lançar
  // --------------------------------------------------------
  app.post('/api/lancamentos', gerenciar, async (req, res) => {
    const dados = esquemaNovo.safeParse(req.body);
    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    const quando = lerData(dados.data.previstoPara);
    if (!quando) return res.status(400).send({ erro: 'Data inválida.' });

    if (dados.data.obraId) {
      const obra = await banco.obra.findUnique({ where: { id: dados.data.obraId } });
      if (!obra) return res.status(404).send({ erro: 'Obra não encontrada.' });
    }

    const lancamento = await banco.lancamentoFinanceiro.create({
      data: {
        tipo: dados.data.tipo,
        descricao: dados.data.descricao.trim(),
        valor: dados.data.valor,
        previstoPara: quando,
        obraId: dados.data.obraId ?? null,
        categoria: dados.data.categoria,
        formaPagamento: dados.data.formaPagamento,
        observacoes: dados.data.observacoes,
        criadoPorId: req.usuario!.id,
        aberturaDeCaixa: dados.data.tipo === 'RECEITA' && dados.data.aberturaDeCaixa,
        // Lançar algo que já aconteceu é o caso comum: a pessoa
        // registra depois do fato. Exigir um segundo clique para
        // dizer "e já entrou" seria trabalho à toa.
        ...(dados.data.jaAconteceu
          ? { situacao: 'REALIZADO' as const, realizadoEm: quando }
          : {}),
      },
      include: INCLUIR,
    });

    await anotar(
      lancamento.id,
      req.usuario!.id,
      'CRIADO',
      (dados.data.tipo === 'RECEITA' ? 'Entrada' : 'Saída') +
      ' de ' + reaisBr(dados.data.valor) +
      ' lançada como ' + (dados.data.jaAconteceu ? 'realizada' : 'prevista') + '.',
    );

    return res.status(201).send({ lancamento: formatar(lancamento) });
  });

  // --------------------------------------------------------
  //  Corrigir
  // --------------------------------------------------------
  app.patch('/api/lancamentos/:id', gerenciar, async (req, res) => {
    const { id } = req.params as { id: string };

    const dados = esquemaEdicao.safeParse(req.body);
    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    const atual = await banco.lancamentoFinanceiro.findUnique({ where: { id } });
    if (!atual) return res.status(404).send({ erro: 'Lançamento não encontrado.' });

    if (atual.situacao === 'CANCELADO') {
      return res.status(409).send({
        erro: 'Este lançamento está cancelado. Cancelado não se corrige: lance outro.',
      });
    }

    let quando: Date | undefined;
    if (dados.data.previstoPara) {
      const lida = lerData(dados.data.previstoPara);
      if (!lida) return res.status(400).send({ erro: 'Data inválida.' });
      quando = lida;
    }

    const lancamento = await banco.lancamentoFinanceiro.update({
      where: { id },
      data: {
        tipo: dados.data.tipo,
        descricao: dados.data.descricao?.trim(),
        valor: dados.data.valor,
        previstoPara: quando,
        obraId: dados.data.obraId === undefined ? undefined : dados.data.obraId,
        categoria: dados.data.categoria,
        formaPagamento: dados.data.formaPagamento,
        observacoes: dados.data.observacoes,
      },
      include: INCLUIR,
    });

    // O QUE MUDOU, com o que havia antes.
    //
    // É a linha que responde à pergunta de auditoria. Sem ela, trocar
    // uma entrada de R$ 100 mil por uma saída de R$ 100 mil mexia
    // R$ 200 mil no saldo sem deixar rastro.
    const mudancas = oQueMudou(
      {
        tipo: atual.tipo === 'RECEITA' ? 'Entrada' : 'Saída',
        descricao: atual.descricao,
        valor: reaisBr(numero(atual.valor) ?? 0),
        previstoPara: dataBr(atual.previstoPara),
        categoria: atual.categoria,
        formaPagamento: atual.formaPagamento,
      },
      {
        tipo: dados.data.tipo === undefined
          ? undefined
          : (dados.data.tipo === 'RECEITA' ? 'Entrada' : 'Saída'),
        descricao: dados.data.descricao?.trim(),
        valor: dados.data.valor === undefined
          ? undefined
          : reaisBr(dados.data.valor),
        previstoPara: quando === undefined ? undefined : dataBr(quando),
        categoria: dados.data.categoria,
        formaPagamento: dados.data.formaPagamento,
      },
      {
        tipo: 'Tipo',
        descricao: 'Descrição',
        valor: 'Valor',
        previstoPara: 'Data',
        categoria: 'Categoria',
        formaPagamento: 'Forma de pagamento',
      },
    );

    if (mudancas.length > 0) {
      await anotar(id, req.usuario!.id, 'CORRIGIDO', mudancas.join(' · '));
    }

    return { lancamento: formatar(lancamento) };
  });

  // --------------------------------------------------------
  //  O dinheiro andou
  // --------------------------------------------------------
  app.post('/api/lancamentos/:id/realizar', gerenciar, async (req, res) => {
    const { id } = req.params as { id: string };

    const corpo = z
      .object({ realizadoEm: z.string().optional().nullable() })
      .safeParse(req.body ?? {});
    if (!corpo.success) return res.status(400).send(erroDeValidacao(corpo.error));

    const atual = await banco.lancamentoFinanceiro.findUnique({ where: { id } });
    if (!atual) return res.status(404).send({ erro: 'Lançamento não encontrado.' });

    if (atual.situacao === 'REALIZADO') {
      return res.status(409).send({ erro: 'Este lançamento já está marcado como realizado.' });
    }
    if (atual.situacao === 'CANCELADO') {
      return res.status(409).send({ erro: 'Este lançamento está cancelado.' });
    }

    const quando = corpo.data.realizadoEm ? lerData(corpo.data.realizadoEm) : new Date();
    if (!quando) return res.status(400).send({ erro: 'Data inválida.' });

    const lancamento = await banco.lancamentoFinanceiro.update({
      where: { id },
      data: { situacao: 'REALIZADO', realizadoEm: quando },
      include: INCLUIR,
    });

    await anotar(
      id,
      req.usuario!.id,
      'REALIZADO',
      (atual.tipo === 'RECEITA' ? 'Entrada' : 'Saída') +
      ' de ' + reaisBr(numero(atual.valor) ?? 0) +
      ' registrada em ' + dataBr(quando) + '.',
    );

    return {
      lancamento: formatar(lancamento),
      mensagem: atual.tipo === 'RECEITA' ? 'Entrada registrada.' : 'Saída registrada.',
    };
  });

  // --------------------------------------------------------
  //  Voltar para previsto
  //
  //  O CAMINHO DE VOLTA QUE NÃO EXISTIA.
  //
  //  A caixa "O dinheiro já entrou" nasce MARCADA, e com razão: o
  //  caso comum é registrar depois do fato. Mas quem está mudando
  //  da planilha para o sistema lança previsão o tempo todo — e
  //  desmarcar depois era impossível: a caixa só aparece na
  //  criação, e "Corrigir" não a mostra.
  //
  //  Até 09/10/2026 o único caminho era cancelar e lançar de novo,
  //  o que deixa dois números no extrato e um deles riscado. Para
  //  um erro de clique, é caro demais.
  //
  //  Fica registrado no histórico como qualquer outra mudança de
  //  situação: desfazer não é apagar.
  // --------------------------------------------------------
  app.post('/api/lancamentos/:id/voltar-para-previsto', gerenciar, async (req, res) => {
    const { id } = req.params as { id: string };

    const atual = await banco.lancamentoFinanceiro.findUnique({ where: { id } });
    if (!atual) return res.status(404).send({ erro: 'Lançamento não encontrado.' });

    if (atual.situacao === 'PREVISTO') {
      return res.status(409).send({ erro: 'Este lançamento já está como previsto.' });
    }
    if (atual.situacao === 'CANCELADO') {
      return res.status(409).send({
        erro: 'Este lançamento está cancelado. Cancelado não volta: lance outro.',
      });
    }

    const lancamento = await banco.lancamentoFinanceiro.update({
      where: { id },
      data: { situacao: 'PREVISTO', realizadoEm: null },
      include: INCLUIR,
    });

    await anotar(
      id,
      req.usuario!.id,
      'VOLTOU_PARA_PREVISTO',
      (atual.tipo === 'RECEITA' ? 'Entrada' : 'Saída') +
      ' de ' + reaisBr(numero(atual.valor) ?? 0) +
      ' voltou a ser previsão: ainda não aconteceu.',
    );

    return {
      lancamento: formatar(lancamento),
      mensagem: atual.tipo === 'RECEITA'
        ? 'Entrada voltou para "a receber".'
        : 'Saída voltou para "a pagar".',
    };
  });

  // --------------------------------------------------------
  //  Cancelar
  //
  //  Não apaga. Lançamento é dinheiro: quem olhar o caixa daqui a
  //  um ano precisa ver que existiu e foi cancelado, não um buraco
  //  na numeração sem explicação.
  // --------------------------------------------------------
  app.post('/api/lancamentos/:id/cancelar', gerenciar, async (req, res) => {
    const { id } = req.params as { id: string };

    const corpo = z
      .object({ motivo: textoObrigatorio(3, 'O motivo') })
      .safeParse(req.body ?? {});
    if (!corpo.success) return res.status(400).send(erroDeValidacao(corpo.error));

    const atual = await banco.lancamentoFinanceiro.findUnique({ where: { id } });
    if (!atual) return res.status(404).send({ erro: 'Lançamento não encontrado.' });

    if (atual.situacao === 'CANCELADO') {
      return res.status(409).send({ erro: 'Este lançamento já está cancelado.' });
    }

    const lancamento = await banco.lancamentoFinanceiro.update({
      where: { id },
      data: {
        situacao: 'CANCELADO',
        realizadoEm: null,
        observacoes: atual.observacoes
          ? atual.observacoes + '\n\nCancelado: ' + corpo.data.motivo
          : 'Cancelado: ' + corpo.data.motivo,
      },
      include: INCLUIR,
    });

    await anotar(id, req.usuario!.id, 'CANCELADO', corpo.data.motivo);

    return { lancamento: formatar(lancamento) };
  });

  // --------------------------------------------------------
  //  A trilha de um lançamento
  //
  //  Fica numa rota própria, e não junto da lista: ninguém lê a
  //  trilha de vinte lançamentos de uma vez. Carregá-la sempre seria
  //  pagar, a cada abertura da tela, por algo que se olha uma vez
  //  por mês.
  // --------------------------------------------------------
  app.get('/api/lancamentos/:id/eventos', verFinanceiro, async (req, res) => {
    const { id } = req.params as { id: string };

    const lancamento = await banco.lancamentoFinanceiro.findUnique({
      where: { id },
      select: { numero: true },
    });
    if (!lancamento) return res.status(404).send({ erro: 'Lançamento não encontrado.' });

    const eventos = await banco.lancamentoEvento.findMany({
      where: { lancamentoId: id },
      include: { usuario: { select: { nome: true } } },
      orderBy: { criadoEm: 'asc' },
    });

    return {
      numeroFormatado: formatarNumeroLancamento(lancamento.numero),
      eventos: eventos.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        descricao: e.descricao,
        // O evento fica mesmo quando a pessoa sai da empresa: o
        // registro e de quem mexeu no dinheiro, nao do cadastro dela.
        quem: e.usuario?.nome ?? 'Usuário removido',
        quando: e.criadoEm,
      })),
    };
  });

  // --------------------------------------------------------
  //  Baixar em PDF ou Word
  //
  //  Nada sai em CSV neste sistema, e quem escolhe o formato é quem
  //  baixa, na hora.
  //
  //  O ARQUIVO RESPEITA O FILTRO DA TELA. Baixar sempre tudo faria
  //  quem filtrou "só saídas de outubro" receber um papel com o ano
  //  inteiro — e só descobrir isso depois de imprimir.
  // --------------------------------------------------------
  app.get('/api/lancamentos/exportar', verFinanceiro, async (req, res) => {
    const q = req.query as {
      formato?: string; tipo?: string; situacao?: string; obraId?: string;
    };

    // Sem escolha, PDF: é o que abre em qualquer máquina.
    const escolhido = q.formato ?? 'pdf';
    if (!formatoValido(escolhido)) {
      return res.status(400).send({ erro: 'Formato não suportado. Escolha "pdf" ou "docx".' });
    }

    const filtro = {
      ...(q.tipo ? { tipo: q.tipo as never } : {}),
      ...(q.situacao ? { situacao: q.situacao as never } : {}),
      ...(q.obraId ? { obraId: q.obraId } : {}),
    };

    const linhas = await banco.lancamentoFinanceiro.findMany({
      where: filtro,
      include: INCLUIR,
      orderBy: [{ previstoPara: 'desc' }, { numero: 'desc' }],
    });

    const vivos = linhas.filter((l) => l.situacao !== 'CANCELADO');
    const soma = (tipo: string, situacao: string) =>
      vivos
        .filter((l) => l.tipo === tipo && l.situacao === situacao)
        .reduce((s, l) => s + (numero(l.valor) ?? 0), 0);

    const entrou = soma('RECEITA', 'REALIZADO');
    const saiu = soma('DESPESA', 'REALIZADO');

    const arquivo = await gerarArquivoDaTabela({
      arquivo: 'receitas-e-despesas',
      titulo: 'Receitas e despesas',
      subtitulo: 'O dinheiro que entra e o gasto que não vem de compra',
      resumo: [
        { rotulo: 'Lançamentos', valor: String(linhas.length) },
        { rotulo: 'Entrou', valor: reaisBr(entrou) },
        { rotulo: 'Saiu (avulsas)', valor: reaisBr(saiu) },
        { rotulo: 'Saldo destes lançamentos', valor: reaisBr(Math.round((entrou - saiu) * 100) / 100) },
      ],
      // O papel diz o que NÃO está nele. Sem esta linha, quem recebe
      // o arquivo não tem como saber que as compras ficaram de fora.
      nota:
        'As compras não aparecem aqui: elas nascem da nota fiscal e vivem em contas a ' +
        'pagar. Lançamento cancelado continua na lista e fica fora das somas acima.',
      tabelas: [{
        colunas: [
          { titulo: 'Lançamento', campo: 'numero', peso: 1 },
          { titulo: 'Descrição', campo: 'descricao', peso: 2.6 },
          { titulo: 'Categoria', campo: 'categoria', peso: 1.2 },
          { titulo: 'Obra', campo: 'obra', peso: 1.6 },
          { titulo: 'Valor', campo: 'valor', peso: 1.3, numero: true },
          { titulo: 'Data', campo: 'data', peso: 1, numero: true },
          { titulo: 'Situação', campo: 'situacao', peso: 1.1 },
        ],
        linhas: linhas.map((l) => ({
          numero: formatarNumeroLancamento(l.numero),
          descricao: l.descricao,
          categoria: l.categoria ?? '—',
          obra: l.obra ? l.obra.codigo + ' — ' + l.obra.nome : 'Empresa',
          // O sinal no papel também: impresso em preto e branco, a
          // cor da tela não chega, e sem o sinal entrada e saída
          // viram a mesma coluna de números.
          valor: (l.tipo === 'RECEITA' ? '+ ' : '− ') + reaisBr(numero(l.valor) ?? 0),
          data: dataBr(l.previstoPara),
          situacao: SITUACAO_NO_PAPEL[l.tipo]?.[l.situacao] ?? l.situacao,
        })),
      }],
    }, escolhido);

    return res
      .header('Content-Type', arquivo.tipo)
      .header('Content-Disposition', 'attachment; filename="' + arquivo.nome + '"')
      .send(arquivo.conteudo);
  });
}
