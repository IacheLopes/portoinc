// ============================================================
//  Obras, linhas de orçamento e almoxarifados
//
//  A obra é o centro de tudo: toda solicitação aponta para uma
//  obra e para uma linha do orçamento dela. É assim que se
//  descobre quanto custou cada parte de cada empreendimento.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import {
  numero, erroDeValidacao, textoObrigatorio, textoOpcional, UFS,
} from '../servicos/util.js';
import { lerCsvOrcamento } from '../servicos/orcamento.js';
import { inicioDoDiaBr } from '../servicos/data-br.js';

const SITUACOES = ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PARALISADA', 'CONCLUIDA'] as const;

const esquemaObra = z.object({
  codigo: textoObrigatorio(2, 'O código'),
  nome: textoObrigatorio(3, 'O nome'),
  cliente: textoOpcional(),
  endereco: textoOpcional(),
  cidade: textoOpcional(120),
  uf: z.enum(UFS).optional(),
  situacao: z.enum(SITUACOES).default('PLANEJAMENTO'),
  dataInicio: z.string().date().optional(),
  dataPrevisaoFim: z.string().date().optional(),
});

const esquemaLinha = z.object({
  codigo: textoObrigatorio(1, 'O código'),
  descricao: textoObrigatorio(3, 'A descrição'),
  unidade: textoObrigatorio(1, 'A unidade'),
  quantidadePrevista: z.coerce.number().min(0).default(0),
  valorUnitarioPrevisto: z.coerce.number().min(0).default(0),
  ordem: z.coerce.number().int().default(0),
});

function formatarObra(obra: {
  id: string; codigo: string; nome: string; cliente: string | null;
  endereco: string | null; cidade: string | null; uf: string | null;
  situacao: string; dataInicio: Date | null; dataPrevisaoFim: Date | null;
  ativa: boolean;
  _count?: { linhas: number; almoxarifados: number };
}) {
  return {
    ...obra,
    linhas: obra._count?.linhas ?? 0,
    almoxarifados: obra._count?.almoxarifados ?? 0,
    _count: undefined,
  };
}

export async function rotasObras(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Listar obras
  // --------------------------------------------------------
  app.get('/api/obras', { preHandler: app.exigirPermissao('obras.ver') }, async (req) => {
    const { busca, incluirInativas } = req.query as {
      busca?: string;
      incluirInativas?: string;
    };

    const obras = await banco.obra.findMany({
      where: {
        ...(incluirInativas === 'true' ? {} : { ativa: true }),
        ...(busca
          ? {
              OR: [
                { nome: { contains: busca, mode: 'insensitive' } },
                { codigo: { contains: busca, mode: 'insensitive' } },
                { cliente: { contains: busca, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { linhas: true, almoxarifados: true } } },
      orderBy: { codigo: 'asc' },
      take: 200,
    });

    return { obras: obras.map(formatarObra) };
  });

  // --------------------------------------------------------
  //  Uma obra, com orçamento e almoxarifados
  // --------------------------------------------------------
  app.get('/api/obras/:id', { preHandler: app.exigirPermissao('obras.ver') }, async (req, res) => {
    const { id } = req.params as { id: string };

    const obra = await banco.obra.findUnique({
      where: { id },
      include: {
        linhas: { orderBy: [{ ordem: 'asc' }, { codigo: 'asc' }] },
        almoxarifados: { orderBy: { nome: 'asc' } },
      },
    });

    if (!obra) return res.status(404).send({ erro: 'Obra não encontrada.' });

    const linhas = obra.linhas.map((l) => ({
      ...l,
      quantidadePrevista: numero(l.quantidadePrevista),
      valorUnitarioPrevisto: numero(l.valorUnitarioPrevisto),
      valorTotalPrevisto:
        Number(l.quantidadePrevista) * Number(l.valorUnitarioPrevisto),
    }));

    return {
      obra: {
        ...obra,
        linhas,
        orcamentoTotal: linhas.reduce((soma, l) => soma + l.valorTotalPrevisto, 0),
      },
    };
  });

  // --------------------------------------------------------
  //  Criar obra
  // --------------------------------------------------------
  app.post('/api/obras', { preHandler: app.exigirPermissao('obras.gerenciar') }, async (req, res) => {
    const dados = esquemaObra.safeParse(req.body);
    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    const codigo = dados.data.codigo.toUpperCase();

    if (await banco.obra.findUnique({ where: { codigo } })) {
      return res.status(409).send({ erro: 'Já existe uma obra com o código ' + codigo + '.' });
    }

    const obra = await banco.obra.create({
      data: {
        ...dados.data,
        codigo,
        //  Data de calendario, nao prazo: o comeco do dia basta.
        dataInicio: dados.data.dataInicio ? inicioDoDiaBr(dados.data.dataInicio) : null,
        dataPrevisaoFim: dados.data.dataPrevisaoFim
          ? inicioDoDiaBr(dados.data.dataPrevisaoFim)
          : null,
        // Toda obra nasce com o próprio almoxarifado (decisão D3).
        almoxarifados: {
          create: {
            codigo: codigo + '-ALM',
            nome: 'Almoxarifado ' + dados.data.nome,
            central: false,
          },
        },
      },
      include: { _count: { select: { linhas: true, almoxarifados: true } } },
    });

    return res.status(201).send({ obra: formatarObra(obra) });
  });

  // --------------------------------------------------------
  //  Editar obra
  // --------------------------------------------------------
  app.patch('/api/obras/:id', { preHandler: app.exigirPermissao('obras.gerenciar') }, async (req, res) => {
    const { id } = req.params as { id: string };
    const dados = esquemaObra.partial().extend({ ativa: z.boolean().optional() }).safeParse(req.body);
    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    const antes = await banco.obra.findUnique({
      where: { id },
      include: { almoxarifados: true },
    });

    if (!antes) return res.status(404).send({ erro: 'Obra não encontrada.' });

    const codigoNovo = dados.data.codigo?.toUpperCase();

    const obra = await banco.$transaction(async (tx) => {
      const atualizada = await tx.obra.update({
        where: { id },
        data: {
          ...dados.data,
          codigo: codigoNovo,
          dataInicio: dados.data.dataInicio
            ? inicioDoDiaBr(dados.data.dataInicio)
            : undefined,
          dataPrevisaoFim: dados.data.dataPrevisaoFim
            ? inicioDoDiaBr(dados.data.dataPrevisaoFim)
            : undefined,
        },
        include: { _count: { select: { linhas: true, almoxarifados: true } } },
      });

      // ------------------------------------------------------
      //  O almoxarifado acompanha o nome da obra
      //
      //  Ele nasce com o nome COPIADO da obra ("Almoxarifado " +
      //  nome) e o codigo derivado dela ("<CODIGO>-ALM"). Copia
      //  que nao acompanha a origem vira mentira: a obra passava a
      //  se chamar "Residencial Porto Belo — Torre A" e o estoque
      //  continuava "Almoxarifado Residencial Porto Belo", que e o
      //  nome que aparece no Recebimento, no Estoque e no relatorio
      //  de movimentos.
      //
      //  So mexe no que AINDA carrega o nome derivado. Um
      //  almoxarifado que alguem tenha batizado de outro jeito fica
      //  como esta — renomear a obra nao e motivo para desfazer uma
      //  escolha que alguem fez de proposito.
      // ------------------------------------------------------
      for (const alm of antes.almoxarifados) {
        const mudanca: { nome?: string; codigo?: string } = {};

        if (dados.data.nome && dados.data.nome !== antes.nome
            && alm.nome === 'Almoxarifado ' + antes.nome) {
          mudanca.nome = 'Almoxarifado ' + dados.data.nome;
        }

        if (codigoNovo && codigoNovo !== antes.codigo
            && alm.codigo === antes.codigo + '-ALM') {
          mudanca.codigo = codigoNovo + '-ALM';
        }

        if (Object.keys(mudanca).length > 0) {
          await tx.almoxarifado.update({ where: { id: alm.id }, data: mudanca });
        }
      }

      return atualizada;
    });

    return { obra: formatarObra(obra) };
  });

  // --------------------------------------------------------
  //  Adicionar linha ao orçamento
  // --------------------------------------------------------
  app.post('/api/obras/:id/linhas', { preHandler: app.exigirPermissao('obras.gerenciar') }, async (req, res) => {
    const { id } = req.params as { id: string };
    const dados = esquemaLinha.safeParse(req.body);
    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    if (!(await banco.obra.findUnique({ where: { id } }))) {
      return res.status(404).send({ erro: 'Obra não encontrada.' });
    }

    const jaExiste = await banco.linhaOrcamento.findUnique({
      where: { obraId_codigo: { obraId: id, codigo: dados.data.codigo } },
    });

    if (jaExiste) {
      return res.status(409).send({
        erro: 'Esta obra já tem a linha ' + dados.data.codigo + '.',
      });
    }

    const linha = await banco.linhaOrcamento.create({
      data: { ...dados.data, obraId: id },
    });

    return res.status(201).send({
      linha: {
        ...linha,
        quantidadePrevista: numero(linha.quantidadePrevista),
        valorUnitarioPrevisto: numero(linha.valorUnitarioPrevisto),
      },
    });
  });

  // --------------------------------------------------------
  //  Importar orçamento de planilha (CSV)
  //
  //  Lemos linha a linha, nunca o arquivo inteiro na memória:
  //  um orçamento grande estouraria o container de 1 GB.
  // --------------------------------------------------------
  app.post('/api/obras/:id/linhas/importar', { preHandler: app.exigirPermissao('obras.gerenciar') }, async (req, res) => {
    const { id } = req.params as { id: string };
    const corpo = z.object({ csv: z.string().min(1).max(2_000_000) }).safeParse(req.body);
    if (!corpo.success) return res.status(400).send(erroDeValidacao(corpo.error));

    if (!(await banco.obra.findUnique({ where: { id } }))) {
      return res.status(404).send({ erro: 'Obra não encontrada.' });
    }

    const { linhas: lidas, problemas } = lerCsvOrcamento(corpo.data.csv);
    const paraGravar = lidas.map((l) => ({ ...l, obraId: id }));

    if (paraGravar.length === 0) {
      return res.status(400).send({
        erro: 'Nenhuma linha válida encontrada no arquivo.',
        detalhes: problemas.slice(0, 10),
      });
    }

    // skipDuplicates: linhas que já existem na obra são ignoradas,
    // então reimportar a mesma planilha não duplica nada.
    const resultado = await banco.linhaOrcamento.createMany({
      data: paraGravar,
      skipDuplicates: true,
    });

    return {
      importadas: resultado.count,
      ignoradas: paraGravar.length - resultado.count,
      problemas: problemas.slice(0, 20),
      totalDeProblemas: problemas.length,
    };
  });

  // --------------------------------------------------------
  //  Apagar linha do orçamento
  // --------------------------------------------------------
  app.delete('/api/obras/:id/linhas/:linhaId', { preHandler: app.exigirPermissao('obras.gerenciar') }, async (req, res) => {
    const { id, linhaId } = req.params as { id: string; linhaId: string };

    const linha = await banco.linhaOrcamento.findFirst({ where: { id: linhaId, obraId: id } });
    if (!linha) return res.status(404).send({ erro: 'Linha não encontrada nesta obra.' });

    await banco.linhaOrcamento.delete({ where: { id: linhaId } });
    return { ok: true };
  });

  // --------------------------------------------------------
  //  Almoxarifados (usados a partir da Etapa 8)
  // --------------------------------------------------------
  app.get('/api/almoxarifados', { preHandler: app.exigirPermissao('estoque.ver', 'obras.ver') }, async () => {
    const almoxarifados = await banco.almoxarifado.findMany({
      where: { ativo: true },
      include: { obra: { select: { codigo: true, nome: true } } },
      orderBy: [{ central: 'desc' }, { nome: 'asc' }],
    });

    return { almoxarifados };
  });
}
