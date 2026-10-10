// ============================================================
//  Catálogo: famílias e materiais/serviços
//
//  A FAMÍLIA é a peça que faz a cotação funcionar: quando o
//  comprador monta um BID de elétrica, o sistema sabe quais
//  fornecedores convidar porque eles estão ligados à família.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { lerCsvMateriais } from '../servicos/importacao-cadastros.js';
import { lerPaginacao, camposDaPagina } from '../servicos/paginacao.js';
import {
  numero, erroDeValidacao, textoObrigatorio, textoOpcional, UNIDADES, gtinValido,
} from '../servicos/util.js';

const esquemaFamilia = z.object({
  codigo: textoObrigatorio(2, 'O código'),
  nome: textoObrigatorio(3, 'O nome'),
  descricao: textoOpcional(500),
});

const esquemaMaterial = z.object({
  familiaId: z.string().uuid('Escolha uma família.'),
  codigoInterno: textoObrigatorio(1, 'O código Porto'),
  descricao: textoObrigatorio(3, 'A descrição'),
  tipo: z.enum(['MATERIAL', 'SERVICO']).default('MATERIAL'),
  marca: textoOpcional(120),
  gtin: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' ? undefined : v))
    .refine((v) => v === undefined || gtinValido(v), {
      message: 'Código de barras inválido: o dígito verificador não confere.',
    }),
  normaTecnica: textoOpcional(60),
  unidadeMedida: z.enum(UNIDADES),
  pontoPedido: z.coerce.number().min(0).optional(),
  codigoLinhaPadrao: textoOpcional(60),
  observacoes: textoOpcional(1000),
});

function formatarMaterial(m: {
  pontoPedido: unknown;
  familia?: { id: string; codigo: string; nome: string };
  [chave: string]: unknown;
}) {
  return {
    ...m,
    pontoPedido: numero(m.pontoPedido as never),
  };
}

export async function rotasCatalogo(app: FastifyInstance) {
  // ========================================================
  //  FAMÍLIAS
  // ========================================================

  app.get('/api/familias', { preHandler: app.exigirPermissao('materiais.ver') }, async () => {
    const familias = await banco.familiaMaterial.findMany({
      include: { _count: { select: { materiais: true, fornecedores: true } } },
      orderBy: { nome: 'asc' },
    });

    return {
      familias: familias.map((f) => ({
        id: f.id,
        codigo: f.codigo,
        nome: f.nome,
        descricao: f.descricao,
        ativa: f.ativa,
        materiais: f._count.materiais,
        fornecedores: f._count.fornecedores,
      })),
    };
  });

  app.post('/api/familias', { preHandler: app.exigirPermissao('materiais.gerenciar') }, async (req, res) => {
    const dados = esquemaFamilia.safeParse(req.body);
    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    const codigo = dados.data.codigo.toUpperCase();

    if (await banco.familiaMaterial.findUnique({ where: { codigo } })) {
      return res.status(409).send({ erro: 'Já existe uma família com o código ' + codigo + '.' });
    }

    const familia = await banco.familiaMaterial.create({
      data: { ...dados.data, codigo },
    });

    return res.status(201).send({ familia });
  });

  app.patch('/api/familias/:id', { preHandler: app.exigirPermissao('materiais.gerenciar') }, async (req, res) => {
    const { id } = req.params as { id: string };
    const dados = esquemaFamilia.partial().extend({ ativa: z.boolean().optional() }).safeParse(req.body);
    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    if (!(await banco.familiaMaterial.findUnique({ where: { id } }))) {
      return res.status(404).send({ erro: 'Família não encontrada.' });
    }

    const familia = await banco.familiaMaterial.update({
      where: { id },
      data: { ...dados.data, codigo: dados.data.codigo?.toUpperCase() },
    });

    return { familia };
  });

  // ========================================================
  //  MATERIAIS E SERVIÇOS
  // ========================================================

  app.get('/api/materiais', { preHandler: app.exigirPermissao('materiais.ver') }, async (req) => {
    const { busca, familiaId, tipo, incluirInativos } = req.query as {
      busca?: string;
      familiaId?: string;
      tipo?: 'MATERIAL' | 'SERVICO';
      incluirInativos?: string;
    };

    // Um filtro só, para a conta e para a busca: se divergissem,
    // a tela diria "de 347" e mostraria outra coisa.
    const filtro = {
      ...(incluirInativos === 'true' ? {} : { ativo: true }),
      ...(familiaId ? { familiaId } : {}),
      ...(tipo ? { tipo } : {}),
      ...(busca
        ? {
            OR: [
              { descricao: { contains: busca, mode: 'insensitive' as const } },
              { codigoInterno: { contains: busca, mode: 'insensitive' as const } },
              { gtin: { contains: busca } },
              { marca: { contains: busca, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const pedido = lerPaginacao(req.query as { pagina?: string; porPagina?: string });

    const [total, materiais] = await Promise.all([
      banco.material.count({ where: filtro }),
      banco.material.findMany({
        where: filtro,
        include: { familia: { select: { id: true, codigo: true, nome: true } } },
        orderBy: { descricao: 'asc' },
        skip: pedido.pular,
        take: pedido.porPagina,
      }),
    ]);

    return {
      materiais: materiais.map(formatarMaterial),
      ...camposDaPagina(total, pedido),
    };
  });

  // --------------------------------------------------------
  //  Importar catálogo de planilha (CSV)
  //
  //  Mesma forma da importação de orçamento: lê linha a linha
  //  (o container tem 1 GB), ignora o que já existe e devolve o
  //  problema COM O NÚMERO DA LINHA.
  //
  //  Até 09/10/2026 só o orçamento tinha porta. O formulário de
  //  material tem 10 campos: um catálogo de 400 itens custava
  //  4.000 campos digitados à mão para a empresa sair da
  //  planilha — que é o que o sistema inteiro existe para fazer.
  // --------------------------------------------------------
  app.post(
    '/api/materiais/importar',
    { preHandler: app.exigirPermissao('materiais.gerenciar') },
    async (req, res) => {
      const corpo = z.object({ csv: z.string().min(1).max(2_000_000) }).safeParse(req.body);
      if (!corpo.success) return res.status(400).send(erroDeValidacao(corpo.error));

      const { linhas: lidas, problemas } = lerCsvMateriais(corpo.data.csv);

      if (lidas.length === 0) {
        return res.status(400).send({
          erro: 'Nenhuma linha válida encontrada no arquivo.',
          detalhes: problemas.slice(0, 10),
        });
      }

      // A FAMÍLIA VEM PELO CÓDIGO, e família que não existe é
      // problema da linha, não do arquivo: as outras entram.
      const familias = await banco.familiaMaterial.findMany({
        select: { id: true, codigo: true },
      });
      const porCodigo = new Map(familias.map((f) => [f.codigo.toUpperCase(), f.id]));

      const aGravar: Array<{
        familiaId: string; codigoInterno: string; descricao: string;
        unidadeMedida: string; marca: string | null; normaTecnica: string | null;
        gtin: string | null; pontoPedido: number | null; codigoLinhaPadrao: string | null;
      }> = [];

      for (const m of lidas) {
        const familiaId = porCodigo.get(m.familiaCodigo);
        if (!familiaId) {
          problemas.push(
            'Material ' + m.codigoInterno + ': a família "' + m.familiaCodigo +
            '" não existe. Cadastre-a antes, em Administração > Famílias.',
          );
          continue;
        }

        aGravar.push({
          familiaId,
          codigoInterno: m.codigoInterno.toUpperCase(),
          descricao: m.descricao,
          unidadeMedida: m.unidadeMedida,
          marca: m.marca,
          normaTecnica: m.normaTecnica,
          gtin: m.gtin,
          pontoPedido: m.pontoPedido,
          codigoLinhaPadrao: m.codigoLinhaPadrao,
        });
      }

      if (aGravar.length === 0) {
        return res.status(400).send({
          erro: 'Nenhuma linha pôde ser importada.',
          detalhes: problemas.slice(0, 10),
        });
      }

      // skipDuplicates: reimportar a mesma planilha não duplica
      // nada, igual à importação de orçamento.
      const resultado = await banco.material.createMany({
        data: aGravar,
        skipDuplicates: true,
      });

      return {
        importados: resultado.count,
        ignorados: aGravar.length - resultado.count,
        problemas: problemas.slice(0, 20),
        totalDeProblemas: problemas.length,
      };
    },
  );

  app.post('/api/materiais', { preHandler: app.exigirPermissao('materiais.gerenciar') }, async (req, res) => {
    const dados = esquemaMaterial.safeParse(req.body);
    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    const codigoInterno = dados.data.codigoInterno.toUpperCase();

    if (await banco.material.findUnique({ where: { codigoInterno } })) {
      return res.status(409).send({
        erro: 'Já existe um item com o código Porto ' + codigoInterno + '.',
      });
    }

    if (dados.data.gtin) {
      const repetido = await banco.material.findUnique({ where: { gtin: dados.data.gtin } });
      if (repetido) {
        return res.status(409).send({
          erro: 'Este código de barras já está em "' + repetido.descricao + '".',
        });
      }
    }

    // Serviço não tem código de barras nem entra no estoque.
    if (dados.data.tipo === 'SERVICO' && dados.data.gtin) {
      return res.status(400).send({ erro: 'Serviço não tem código de barras.' });
    }

    if (!(await banco.familiaMaterial.findUnique({ where: { id: dados.data.familiaId } }))) {
      return res.status(400).send({ erro: 'Família não encontrada.' });
    }

    const material = await banco.material.create({
      data: { ...dados.data, codigoInterno },
      include: { familia: { select: { id: true, codigo: true, nome: true } } },
    });

    return res.status(201).send({ material: formatarMaterial(material) });
  });

  app.patch('/api/materiais/:id', { preHandler: app.exigirPermissao('materiais.gerenciar') }, async (req, res) => {
    const { id } = req.params as { id: string };
    const dados = esquemaMaterial.partial().extend({ ativo: z.boolean().optional() }).safeParse(req.body);
    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    if (!(await banco.material.findUnique({ where: { id } }))) {
      return res.status(404).send({ erro: 'Item não encontrado.' });
    }

    const material = await banco.material.update({
      where: { id },
      data: { ...dados.data, codigoInterno: dados.data.codigoInterno?.toUpperCase() },
      include: { familia: { select: { id: true, codigo: true, nome: true } } },
    });

    return { material: formatarMaterial(material) };
  });

  // --------------------------------------------------------
  //  Bipar: procura pelo código de barras
  //
  //  No catálogo da Porto Inc., e só nele.
  //
  //  ANTES HAVIA UMA SEGUNDA PERGUNTA, À BASE DA GS1: não achando
  //  aqui, o sistema consultava o serviço pago e oferecia a
  //  descrição de lá como sugestão de cadastro. A GS1 saiu na
  //  reunião de 08/10/2026 — a Porto Inc. não vai assinar.
  //
  //  O QUE SE PERDEU É POUCO, e vale dizer qual: a tela deixou de
  //  sugerir "Cimento Portland CP-II 50kg" ao bipar um código
  //  desconhecido. Quem cadastra digita a descrição, como já
  //  digitava para tudo que não tem código de barras.
  //
  //  O que FICA: bipar, achar no catálogo próprio, e o pedido da
  //  reunião antiga de "perguntar se quer agrupar o item a uma
  //  família após bipar".
  // --------------------------------------------------------
  app.get('/api/materiais/gtin/:gtin', { preHandler: app.exigirPermissao('materiais.ver') }, async (req, res) => {
    const { gtin } = req.params as { gtin: string };
    const limpo = gtin.replace(/\D/g, '');

    if (!gtinValido(limpo)) {
      return res.status(400).send({
        erro: 'Código de barras inválido: o dígito verificador não confere.',
        sugestao: 'Confira se o código foi lido por inteiro.',
      });
    }

    const material = await banco.material.findUnique({
      where: { gtin: limpo },
      include: { familia: { select: { id: true, codigo: true, nome: true } } },
    });

    if (material) {
      return { encontrado: true, material: formatarMaterial(material) };
    }

    return res.status(404).send({
      encontrado: false,
      erro: 'Este código de barras ainda não está no catálogo da Porto Inc.',
      sugestao: 'Cadastre o item e vincule-o a uma família.',
    });
  });
}
