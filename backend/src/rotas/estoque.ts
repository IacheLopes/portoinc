// ============================================================
//  Estoque: saldo, extrato e movimentos
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { lerPaginacao, camposDaPagina } from '../servicos/paginacao.js';
import { numero, erroDeValidacao, textoOpcional, quantidadeBr } from '../servicos/util.js';
import {
  formatarNumeroMovimento, conferirMovimento, precisaComprar,
  quantidadeSugerida, explicarAlerta, valorDoEstoque,
  type LinhaDeSaldo,
} from '../servicos/estoque.js';
import { movimentar, saldoDe, comRepeticao } from '../servicos/movimentar-estoque.js';

const esquemaMovimento = z.object({
  almoxarifadoId: z.string().uuid(),
  materialId: z.string().uuid(),
  tipo: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE']),
  /** No ajuste é a CONTAGEM FÍSICA; nos demais, a quantidade. */
  quantidade: z.number(),
  valorUnitario: z.number().min(0).optional().nullable(),
  destino: textoOpcional(120),
  observacao: textoOpcional(500),
});

const esquemaTransferencia = z.object({
  materialId: z.string().uuid(),
  origemId: z.string().uuid(),
  destinoId: z.string().uuid(),
  quantidade: z.number().positive(),
  observacao: textoOpcional(500),
});

export async function rotasEstoque(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Saldo de um almoxarifado
  // --------------------------------------------------------
  app.get(
    '/api/estoque',
    { preHandler: app.exigirPermissao('estoque.ver') },
    async (req) => {
      const { almoxarifadoId, busca } = req.query as { almoxarifadoId?: string; busca?: string };

      const almoxarifados = await banco.almoxarifado.findMany({
        where: { ativo: true },
        // Obra primeiro, central por último: quase todo mundo que
        // abre esta tela trabalha numa obra.
        orderBy: [{ central: 'asc' }, { nome: 'asc' }],
        select: {
          id: true, codigo: true, nome: true, central: true,
          obra: { select: { id: true, codigo: true, nome: true } },
        },
      });

      // Sem escolha explícita, abre onde há material. Cair num
      // almoxarifado vazio faz a pessoa achar que o estoque sumiu.
      let escolhido = almoxarifadoId ?? null;

      if (!escolhido) {
        const comMaterial = await banco.saldoEstoque.groupBy({
          by: ['almoxarifadoId'],
          _count: { _all: true },
          orderBy: { _count: { almoxarifadoId: 'desc' } },
          take: 1,
        });

        escolhido = comMaterial[0]?.almoxarifadoId ?? almoxarifados[0]?.id ?? null;
      }

      if (!escolhido) return { almoxarifados, almoxarifadoId: null, linhas: [], resumo: null };

      const saldos = await banco.saldoEstoque.findMany({
        where: {
          almoxarifadoId: escolhido,
          material: busca
            ? {
                OR: [
                  { descricao: { contains: busca, mode: 'insensitive' } },
                  { codigoInterno: { contains: busca, mode: 'insensitive' } },
                ],
              }
            : undefined,
        },
        include: {
          material: {
            select: {
              id: true, codigoInterno: true, descricao: true, unidadeMedida: true,
              pontoPedido: true, gtin: true,
              familia: { select: { codigo: true, nome: true } },
            },
          },
        },
        orderBy: { material: { descricao: 'asc' } },
      });

      const linhas: Array<LinhaDeSaldo & { gtin: string | null; familia: string; alerta: string }> =
        saldos.map((s) => {
          const base: LinhaDeSaldo = {
            materialId: s.material.id,
            codigo: s.material.codigoInterno,
            descricao: s.material.descricao,
            unidadeMedida: s.material.unidadeMedida,
            quantidade: numero(s.quantidade) ?? 0,
            custoMedio: numero(s.custoMedio),
            pontoPedido: numero(s.material.pontoPedido),
          };

          return {
            ...base,
            gtin: s.material.gtin,
            familia: s.material.familia.codigo + ' — ' + s.material.familia.nome,
            alerta: explicarAlerta(base),
          };
        });

      const precisam = linhas.filter((l) => precisaComprar(l));

      return {
        almoxarifados,
        almoxarifadoId: escolhido,
        linhas,
        resumo: {
          itens: linhas.length,
          valorTotal: valorDoEstoque(linhas),
          abaixoDoMinimo: precisam.length,
          semSaldo: linhas.filter((l) => l.quantidade <= 0).length,
        },
      };
    },
  );

  // --------------------------------------------------------
  //  Extrato de movimentos
  // --------------------------------------------------------
  app.get(
    '/api/estoque/movimentos',
    { preHandler: app.exigirPermissao('estoque.ver') },
    async (req) => {
      const { almoxarifadoId, materialId } = req.query as {
        almoxarifadoId?: string;
        materialId?: string;
      };

      // O extrato é a lista que cresce mais rápido do sistema: toda
      // retirada de saco de cimento vira uma linha aqui, e ela nunca
      // é apagada. Em 200 ela parava e dizia que era tudo.
      const filtro = {
        almoxarifadoId: almoxarifadoId || undefined,
        materialId: materialId || undefined,
      };

      const pedido = lerPaginacao(req.query as { pagina?: string; porPagina?: string });

      const [total, movimentos] = await Promise.all([
        banco.movimentoEstoque.count({ where: filtro }),
        banco.movimentoEstoque.findMany({
          where: filtro,
          include: {
            material: { select: { codigoInterno: true, descricao: true, unidadeMedida: true } },
            almoxarifado: { select: { codigo: true, nome: true } },
            usuario: { select: { nome: true } },
          },
          orderBy: { numero: 'desc' },
          skip: pedido.pular,
          take: pedido.porPagina,
        }),
      ]);

      return {
        movimentos: movimentos.map((m) => ({
          id: m.id,
          numeroFormatado: formatarNumeroMovimento(m.numero),
          tipo: m.tipo,
          almoxarifado: m.almoxarifado.nome,
          codigo: m.material.codigoInterno,
          descricao: m.material.descricao,
          unidadeMedida: m.material.unidadeMedida,
          quantidade: numero(m.quantidade) ?? 0,
          saldoDepois: numero(m.saldoDepois) ?? 0,
          valorUnitario: numero(m.valorUnitario),
          usuario: m.usuario.nome,
          destino: m.destino,
          observacao: m.observacao,
          criadoEm: m.criadoEm,
        })),
        ...camposDaPagina(total, pedido),
      };
    },
  );

  // --------------------------------------------------------
  //  Retirada, entrada avulsa e ajuste
  // --------------------------------------------------------
  app.post(
    '/api/estoque/movimentos',
    { preHandler: app.exigirPermissao('estoque.movimentar') },
    async (req, res) => {
      const dados = esquemaMovimento.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const { almoxarifadoId, materialId, tipo } = dados.data;

      const almoxarifado = await banco.almoxarifado.findFirst({
        where: { id: almoxarifadoId, ativo: true },
      });
      if (!almoxarifado) return res.status(404).send({ erro: 'Almoxarifado não encontrado.' });

      const material = await banco.material.findFirst({ where: { id: materialId, ativo: true } });
      if (!material) return res.status(404).send({ erro: 'Material não encontrado.' });

      const nome = material.codigoInterno + ' ' + material.descricao;
      const saldoAtual = await saldoDe(banco, almoxarifadoId, materialId);

      // No ajuste, o almoxarife informa quanto CONTOU. A diferença
      // é conta do sistema: é assim que a pessoa pensa na frente da
      // prateleira, e evita erro de sinal.
      const quantidade =
        tipo === 'AJUSTE' ? arredondar(dados.data.quantidade - saldoAtual) : dados.data.quantidade;

      const problemas = conferirMovimento(
        { tipo, quantidade, destino: dados.data.destino, observacao: dados.data.observacao },
        saldoAtual,
        nome,
      );

      if (problemas.length > 0) {
        return res.status(400).send({ erro: 'Não foi possível registrar.', detalhes: problemas });
      }

      const gravado = await comRepeticao(() =>
        banco.$transaction(
          (tx) =>
            movimentar(tx, {
              almoxarifadoId,
              materialId,
              usuarioId: req.usuario!.id,
              tipo,
              quantidade,
              valorUnitario: dados.data.valorUnitario ?? null,
              destino: dados.data.destino,
              observacao: dados.data.observacao,
            }),
          { isolationLevel: 'Serializable' },
        ),
      );

      return {
        ok: true,
        movimento: {
          id: gravado.id,
          numeroFormatado: formatarNumeroMovimento(gravado.numero),
        },
        saldoDepois: gravado.saldoDepois,
        mensagem: descrever(tipo, quantidade, material.unidadeMedida, gravado.saldoDepois),
      };
    },
  );

  // --------------------------------------------------------
  //  Transferência entre almoxarifados
  // --------------------------------------------------------
  app.post(
    '/api/estoque/transferir',
    { preHandler: app.exigirPermissao('estoque.movimentar') },
    async (req, res) => {
      const dados = esquemaTransferencia.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const { origemId, destinoId, materialId, quantidade } = dados.data;

      if (origemId === destinoId) {
        return res.status(400).send({ erro: 'Escolha dois almoxarifados diferentes.' });
      }

      const [origem, destino, material] = await Promise.all([
        banco.almoxarifado.findFirst({ where: { id: origemId, ativo: true } }),
        banco.almoxarifado.findFirst({ where: { id: destinoId, ativo: true } }),
        banco.material.findFirst({ where: { id: materialId, ativo: true } }),
      ]);

      if (!origem || !destino) {
        return res.status(404).send({ erro: 'Almoxarifado não encontrado.' });
      }
      if (!material) return res.status(404).send({ erro: 'Material não encontrado.' });

      const saldoOrigem = await saldoDe(banco, origemId, materialId);
      const nome = material.codigoInterno + ' ' + material.descricao;

      const problemas = conferirMovimento(
        { tipo: 'TRANSFERENCIA_SAIDA', quantidade },
        saldoOrigem,
        nome,
      );

      if (problemas.length > 0) {
        return res.status(400).send({ erro: 'Não foi possível transferir.', detalhes: problemas });
      }

      // O custo médio viaja junto: o material não fica mais caro
      // nem mais barato só por mudar de prateleira.
      const saldo = await banco.saldoEstoque.findUnique({
        where: { almoxarifadoId_materialId: { almoxarifadoId: origemId, materialId } },
      });
      const custo = numero(saldo?.custoMedio);

      await comRepeticao(() =>
        banco.$transaction(
          async (tx) => {
            await movimentar(tx, {
              almoxarifadoId: origemId,
              materialId,
              usuarioId: req.usuario!.id,
              tipo: 'TRANSFERENCIA_SAIDA',
              quantidade,
              destino: destino.nome,
              observacao: dados.data.observacao,
            });

            await movimentar(tx, {
              almoxarifadoId: destinoId,
              materialId,
              usuarioId: req.usuario!.id,
              tipo: 'TRANSFERENCIA_ENTRADA',
              quantidade,
              valorUnitario: custo,
              destino: origem.nome,
              observacao: dados.data.observacao,
            });
          },
          { isolationLevel: 'Serializable' },
        ),
      );

      return {
        ok: true,
        mensagem:
          quantidade +
          ' ' +
          material.unidadeMedida +
          ' de ' +
          material.descricao +
          ': ' +
          origem.nome +
          ' → ' +
          destino.nome +
          '.',
      };
    },
  );

  // --------------------------------------------------------
  //  Sugestão de reposição
  //
  //  Devolve os itens no ponto de pedido já no formato que a
  //  tela de solicitação usa. A criação continua passando pela
  //  rota de solicitações — uma porta só para nascer solicitação.
  // --------------------------------------------------------
  app.get(
    '/api/estoque/reposicao',
    { preHandler: app.exigirPermissao('estoque.ver') },
    async (req, res) => {
      const { almoxarifadoId } = req.query as { almoxarifadoId?: string };
      if (!almoxarifadoId) return res.status(400).send({ erro: 'Escolha um almoxarifado.' });

      const almoxarifado = await banco.almoxarifado.findUnique({
        where: { id: almoxarifadoId },
        include: { obra: { select: { id: true, codigo: true, nome: true } } },
      });

      if (!almoxarifado) return res.status(404).send({ erro: 'Almoxarifado não encontrado.' });

      const saldos = await banco.saldoEstoque.findMany({
        where: { almoxarifadoId },
        include: {
          material: {
            select: {
              id: true, codigoInterno: true, descricao: true, unidadeMedida: true,
              pontoPedido: true, codigoLinhaPadrao: true,
            },
          },
        },
      });

      // A linha de orçamento sugerida do material, dentro da obra
      // deste almoxarifado.
      const linhasDaObra = almoxarifado.obra
        ? await banco.linhaOrcamento.findMany({
            where: { obraId: almoxarifado.obra.id },
            select: { id: true, codigo: true },
          })
        : [];

      const porCodigo = new Map(linhasDaObra.map((l) => [l.codigo, l.id]));

      const itens = saldos
        .map((s) => {
          const linha: LinhaDeSaldo = {
            materialId: s.material.id,
            codigo: s.material.codigoInterno,
            descricao: s.material.descricao,
            unidadeMedida: s.material.unidadeMedida,
            quantidade: numero(s.quantidade) ?? 0,
            custoMedio: numero(s.custoMedio),
            pontoPedido: numero(s.material.pontoPedido),
          };

          return { linha, s };
        })
        .filter(({ linha }) => precisaComprar(linha))
        .map(({ linha, s }) => ({
          materialId: linha.materialId,
          codigo: linha.codigo,
          descricao: linha.descricao,
          unidadeMedida: linha.unidadeMedida,
          saldoAtual: linha.quantidade,
          pontoPedido: linha.pontoPedido,
          quantidade: quantidadeSugerida(linha),
          valorEstimado: linha.custoMedio,
          linhaOrcamentoId: s.material.codigoLinhaPadrao
            ? (porCodigo.get(s.material.codigoLinhaPadrao) ?? null)
            : null,
          motivo: explicarAlerta(linha),
        }));

      return {
        obra: almoxarifado.obra,
        itens,
        mensagem:
          itens.length === 0
            ? 'Nenhum material abaixo do mínimo neste almoxarifado.'
            : itens.length === 1
              ? '1 material precisa de reposição.'
              : itens.length + ' materiais precisam de reposição.',
      };
    },
  );
}

function arredondar(valor: number): number {
  return Math.round(valor * 10000) / 10000;
}

function descrever(
  tipo: string,
  quantidade: number,
  unidade: string,
  saldo: number,
): string {
  const qtd = quantidadeBr(Math.abs(quantidade));
  const novo = quantidadeBr(saldo);

  if (tipo === 'SAIDA') return 'Saíram ' + qtd + ' ' + unidade + '. Saldo agora: ' + novo + '.';
  if (tipo === 'ENTRADA') return 'Entraram ' + qtd + ' ' + unidade + '. Saldo agora: ' + novo + '.';

  const direcao = quantidade < 0 ? 'a menos' : 'a mais';
  return 'Ajuste de ' + qtd + ' ' + unidade + ' ' + direcao + '. Saldo agora: ' + novo + '.';
}
