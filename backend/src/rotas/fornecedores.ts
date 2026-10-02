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
  familias: z.array(z.string().uuid()).default([]),
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
