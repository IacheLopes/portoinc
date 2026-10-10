// ============================================================
//  Fornecedores
//
//  O vínculo com as FAMÍLIAS é o que faz a cotação funcionar:
//  um BID de material elétrico só é enviado a quem fornece
//  material elétrico, como o fluxo da Porto Inc. determina.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { lerCsvFornecedores } from '../servicos/importacao-cadastros.js';
import { lerPaginacao, camposDaPagina } from '../servicos/paginacao.js';
import {
  erroDeValidacao, textoObrigatorio, textoOpcional,
  apenasDigitos, cnpjValido, formatarCnpj, UFS,
} from '../servicos/util.js';

const telefone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' ? undefined : v ? apenasDigitos(v) : undefined))
  .refine((v) => v === undefined || (v.length >= 10 && v.length <= 15), {
    message: 'Telefone deve ter entre 10 e 15 dígitos (com DDD).',
  });

const esquemaFornecedor = z.object({
  razaoSocial: textoObrigatorio(3, 'A razão social'),
  nomeFantasia: textoOpcional(160),
  cnpj: z
    .string()
    .trim()
    .transform(apenasDigitos)
    .refine(cnpjValido, { message: 'CNPJ inválido: o dígito verificador não confere.' }),
  inscricaoEstadual: textoOpcional(30),
  email: z
    .string()
    .trim()
    .email('E-mail inválido.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  telefone,
  whatsapp: telefone,
  cidade: textoOpcional(120),
  uf: z.enum(UFS).optional(),
  observacoes: textoOpcional(1000),
  //  PELO MENOS UMA FAMÍLIA.
  //
  //  É a família que decide quem é convidado para cada cotação:
  //  um pacote de elétrica só chama quem vende elétrica. Sem
  //  nenhuma, o fornecedor fica no cadastro e nunca é chamado —
  //  cadastro que não serve para nada e ninguém percebe.
  //
  //  A tela avisava disso desde sempre, embaixo da lista, e
  //  deixava salvar. Na simulação de 09/10/2026 os dois
  //  fornecedores nasceram assim, e a cotação só travou três
  //  telas adiante.
  familias: z.array(z.string().uuid()).min(1, 'Marque pelo menos uma família que ele atende.'),
});

const esquemaContato = z.object({
  nome: textoObrigatorio(3, 'O nome'),
  cargo: textoOpcional(80),
  email: z
    .string()
    .trim()
    .email('E-mail inválido.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  telefone,
  whatsapp: telefone,
  principal: z.boolean().default(false),
});

const INCLUIR = {
  familias: { include: { familia: { select: { id: true, codigo: true, nome: true } } } },
  contatos: { orderBy: { principal: 'desc' } },
} as const;

function formatar(f: {
  cnpj: string;
  familias: Array<{ familia: { id: string; codigo: string; nome: string } }>;
  [chave: string]: unknown;
}) {
  return {
    ...f,
    cnpjFormatado: formatarCnpj(f.cnpj),
    familias: f.familias.map((x) => x.familia),
  };
}

export async function rotasFornecedores(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Listar
  // --------------------------------------------------------
  app.get('/api/fornecedores', { preHandler: app.exigirPermissao('fornecedores.ver') }, async (req) => {
    const { busca, familiaId, incluirInativos } = req.query as {
      busca?: string;
      familiaId?: string;
      incluirInativos?: string;
    };

    // Um filtro só, para a conta e para a busca: se os dois
    // divergirem, a barra promete páginas que a lista não tem.
    const filtro = {
      ...(incluirInativos === 'true' ? {} : { ativo: true }),
      ...(familiaId ? { familias: { some: { familiaId } } } : {}),
      ...(busca
        ? {
            OR: [
              { razaoSocial: { contains: busca, mode: 'insensitive' as const } },
              { nomeFantasia: { contains: busca, mode: 'insensitive' as const } },
              // Só procura por CNPJ quando o texto TEM dígito. Sem
              // isso, buscar 'LocaMaq' vira contains: '' no CNPJ,
              // que casa com todo mundo — e a busca não filtrava nada.
              ...(apenasDigitos(busca)
                ? [{ cnpj: { contains: apenasDigitos(busca) } }]
                : []),
            ],
          }
        : {}),
    };

    const pedido = lerPaginacao(req.query as { pagina?: string; porPagina?: string });

    const [total, fornecedores] = await Promise.all([
      banco.fornecedor.count({ where: filtro }),
      banco.fornecedor.findMany({
        where: filtro,
        include: INCLUIR,
        orderBy: { razaoSocial: 'asc' },
        skip: pedido.pular,
        take: pedido.porPagina,
      }),
    ]);

    return {
      fornecedores: fornecedores.map(formatar),
      ...camposDaPagina(total, pedido),
    };
  });

  // --------------------------------------------------------
  //  Criar
  // --------------------------------------------------------
  // --------------------------------------------------------
  //  Importar fornecedores de planilha (CSV)
  //
  //  Mesma forma da importação de orçamento e da de materiais.
  //
  //  A coluna das FAMÍLIAS é a que faz o fornecedor existir de
  //  verdade: sem ela ele fica no cadastro e nunca é convidado a
  //  cotar. Por isso a linha sem família é recusada aqui, do
  //  mesmo jeito que o formulário recusa.
  // --------------------------------------------------------
  app.post(
    '/api/fornecedores/importar',
    { preHandler: app.exigirPermissao('fornecedores.gerenciar') },
    async (req, res) => {
      const corpo = z.object({ csv: z.string().min(1).max(2_000_000) }).safeParse(req.body);
      if (!corpo.success) return res.status(400).send(erroDeValidacao(corpo.error));

      const { linhas: lidas, problemas } = lerCsvFornecedores(corpo.data.csv);

      if (lidas.length === 0) {
        return res.status(400).send({
          erro: 'Nenhuma linha válida encontrada no arquivo.',
          detalhes: problemas.slice(0, 10),
        });
      }

      const familias = await banco.familiaMaterial.findMany({
        select: { id: true, codigo: true },
      });
      const porCodigo = new Map(familias.map((f) => [f.codigo.toUpperCase(), f.id]));

      const jaExistem = new Set(
        (await banco.fornecedor.findMany({
          where: { cnpj: { in: lidas.map((f) => f.cnpj) } },
          select: { cnpj: true },
        })).map((f) => f.cnpj),
      );

      let importados = 0;
      let ignorados = 0;

      // UM A UM, e não `createMany`: cada fornecedor leva as
      // famílias dele numa tabela de ligação, e `createMany` não
      // cria relação. São dezenas de linhas, não milhares.
      for (const f of lidas) {
        if (jaExistem.has(f.cnpj)) {
          ignorados += 1;
          continue;
        }

        const ids = f.familiasCodigos
          .map((c) => porCodigo.get(c))
          .filter((id): id is string => !!id);

        if (ids.length === 0) {
          problemas.push(
            f.razaoSocial + ': nenhuma das famílias (' + f.familiasCodigos.join(', ') +
            ') existe. Cadastre-as antes, em Administração > Famílias.',
          );
          continue;
        }

        const faltando = f.familiasCodigos.filter((c) => !porCodigo.has(c));
        if (faltando.length > 0) {
          problemas.push(
            f.razaoSocial + ': a família ' + faltando.join(', ') +
            ' não existe e foi ignorada; as outras entraram.',
          );
        }

        await banco.fornecedor.create({
          data: {
            cnpj: f.cnpj,
            razaoSocial: f.razaoSocial,
            nomeFantasia: f.nomeFantasia,
            email: f.email,
            whatsapp: f.whatsapp,
            cidade: f.cidade,
            uf: f.uf,
            familias: { create: ids.map((familiaId) => ({ familiaId })) },
          },
        });
        importados += 1;
      }

      if (importados === 0) {
        return res.status(400).send({
          erro: 'Nenhuma linha pôde ser importada.',
          detalhes: problemas.slice(0, 10),
        });
      }

      return {
        importados,
        ignorados,
        problemas: problemas.slice(0, 20),
        totalDeProblemas: problemas.length,
      };
    },
  );

  app.post('/api/fornecedores', { preHandler: app.exigirPermissao('fornecedores.gerenciar') }, async (req, res) => {
    const dados = esquemaFornecedor.safeParse(req.body);
    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    const existente = await banco.fornecedor.findUnique({ where: { cnpj: dados.data.cnpj } });

    if (existente) {
      return res.status(409).send({
        erro: 'Este CNPJ já está cadastrado como "' + existente.razaoSocial + '".',
      });
    }

    const { familias, ...resto } = dados.data;

    const fornecedor = await banco.fornecedor.create({
      data: {
        ...resto,
        familias: { create: familias.map((familiaId) => ({ familiaId })) },
      },
      include: INCLUIR,
    });

    return res.status(201).send({ fornecedor: formatar(fornecedor) });
  });

  // --------------------------------------------------------
  //  Editar
  // --------------------------------------------------------
  app.patch('/api/fornecedores/:id', { preHandler: app.exigirPermissao('fornecedores.gerenciar') }, async (req, res) => {
    const { id } = req.params as { id: string };
    const dados = esquemaFornecedor
      .partial()
      .extend({ ativo: z.boolean().optional() })
      .safeParse(req.body);

    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    if (!(await banco.fornecedor.findUnique({ where: { id } }))) {
      return res.status(404).send({ erro: 'Fornecedor não encontrado.' });
    }

    const { familias, ...resto } = dados.data;

    const fornecedor = await banco.fornecedor.update({
      where: { id },
      data: {
        ...resto,
        ...(familias
          ? {
              familias: {
                deleteMany: {},
                create: familias.map((familiaId) => ({ familiaId })),
              },
            }
          : {}),
      },
      include: INCLUIR,
    });

    return { fornecedor: formatar(fornecedor) };
  });

  // --------------------------------------------------------
  //  Contatos
  // --------------------------------------------------------
  app.post('/api/fornecedores/:id/contatos', { preHandler: app.exigirPermissao('fornecedores.gerenciar') }, async (req, res) => {
    const { id } = req.params as { id: string };
    const dados = esquemaContato.safeParse(req.body);
    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    if (!(await banco.fornecedor.findUnique({ where: { id } }))) {
      return res.status(404).send({ erro: 'Fornecedor não encontrado.' });
    }

    // Só pode haver um contato principal: ele é quem recebe a cotação.
    if (dados.data.principal) {
      await banco.contatoFornecedor.updateMany({
        where: { fornecedorId: id },
        data: { principal: false },
      });
    }

    const contato = await banco.contatoFornecedor.create({
      data: { ...dados.data, fornecedorId: id },
    });

    return res.status(201).send({ contato });
  });

  app.delete('/api/fornecedores/:id/contatos/:contatoId', { preHandler: app.exigirPermissao('fornecedores.gerenciar') }, async (req, res) => {
    const { id, contatoId } = req.params as { id: string; contatoId: string };

    const contato = await banco.contatoFornecedor.findFirst({
      where: { id: contatoId, fornecedorId: id },
    });

    if (!contato) return res.status(404).send({ erro: 'Contato não encontrado.' });

    await banco.contatoFornecedor.delete({ where: { id: contatoId } });
    return { ok: true };
  });
}
