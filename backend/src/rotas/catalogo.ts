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
import { integracoes } from '../integracoes/index.js';
import { gtinValido } from '../integracoes/gtin/porta.js';
import {
  numero, erroDeValidacao, textoObrigatorio, textoOpcional, UNIDADES,
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

    const materiais = await banco.material.findMany({
      where: {
        ...(incluirInativos === 'true' ? {} : { ativo: true }),
        ...(familiaId ? { familiaId } : {}),
        ...(tipo ? { tipo } : {}),
        ...(busca
          ? {
              OR: [
                { descricao: { contains: busca, mode: 'insensitive' } },
                { codigoInterno: { contains: busca, mode: 'insensitive' } },
                { gtin: { contains: busca } },
                { marca: { contains: busca, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { familia: { select: { id: true, codigo: true, nome: true } } },
      orderBy: { descricao: 'asc' },
      take: 300,
    });

    return { materiais: materiais.map(formatarMaterial) };
  });

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
  //  Primeiro no nosso catálogo. Se não achar, pergunta à
  //  integração de GTIN e devolve a sugestão para o usuário
  //  decidir se cadastra — o pedido da reunião de "perguntar
  //  se quer agrupar o item a uma família após bipar".
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

    const externo = await integracoes.gtin.consultar(limpo);

    return res.status(404).send({
      encontrado: false,
      erro: 'Este código de barras ainda não está no catálogo da Porto Inc.',
      sugestao: externo
        ? 'Encontramos "' + externo.descricao + '" na base externa. Deseja cadastrar e vincular a uma família?'
        : 'Cadastre o item e vincule-o a uma família.',
      dadosSugeridos: externo,
    });
  });
}
