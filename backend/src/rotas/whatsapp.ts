// ============================================================
//  WhatsApp: conexão, lista de autorizados e histórico
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { integracoes } from '../integracoes/index.js';
import { erroDeValidacao, textoOpcional, textoObrigatorio } from '../servicos/util.js';
import { formatarNumeroBid } from '../servicos/cotacao.js';
import { formatarNumeroPedido } from '../servicos/equalizacao.js';
import { descreverPagamento } from '../servicos/cotacao.js';
import { numero as decimal } from '../servicos/util.js';
import { gerarPdfPedido } from '../servicos/pdf-pedido.js';
import {
  enviarPeloWhatsApp, modoTeste, mascarar, normalizarTelefone,
  textoConviteCotacao, textoPedidoDeCompra,
} from '../servicos/whatsapp.js';

const esquemaNumero = z.object({
  numero: textoObrigatorio(10, 'O número'),
  nome: textoObrigatorio(2, 'O nome'),
  observacao: textoOpcional(200),
});

export async function rotasWhatsApp(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Situação da conexão
  // --------------------------------------------------------
  app.get(
    '/api/whatsapp/situacao',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => {
      const autorizados = await banco.numeroAutorizado.count();

      return {
        adaptador: integracoes.whatsapp.nome,
        simulado: integracoes.whatsapp.nome === 'mock',
        modoTeste: modoTeste(),
        numerosAutorizados: autorizados,
        ...integracoes.whatsapp.situacao(),
      };
    },
  );

  // --------------------------------------------------------
  //  O QR Code, como imagem
  //
  //  Sai como PNG direto, nunca como texto: assim ele não passa
  //  por log nem fica no histórico do navegador.
  // --------------------------------------------------------
  app.get(
    '/api/whatsapp/qr',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (_req, res) => {
      const png = await integracoes.whatsapp.qrPng();

      if (!png) {
        return res.status(404).send({
          erro: 'Não há QR Code no momento.',
          situacao: integracoes.whatsapp.situacao(),
        });
      }

      return res
        .header('Content-Type', 'image/png')
        .header('Cache-Control', 'no-store')
        .send(png);
    },
  );

  // --------------------------------------------------------
  //  Conectar e desconectar
  // --------------------------------------------------------
  app.post(
    '/api/whatsapp/conectar',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (_req, res) => {
      try {
        await integracoes.whatsapp.conectar();

        return {
          ok: true,
          ...integracoes.whatsapp.situacao(),
          mensagem:
            integracoes.whatsapp.nome === 'mock'
              ? 'Modo simulado ligado. Nada sai para fora.'
              : 'Conexão iniciada. O QR Code aparece em alguns segundos.',
        };
      } catch (erro) {
        return res.status(502).send({
          erro: erro instanceof Error ? erro.message : 'Não foi possível conectar.',
          situacao: integracoes.whatsapp.situacao(),
        });
      }
    },
  );

  app.post(
    '/api/whatsapp/desconectar',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => {
      await integracoes.whatsapp.desconectar();

      return {
        ok: true,
        ...integracoes.whatsapp.situacao(),
        mensagem: 'Desconectado. A sessão foi apagada — o próximo acesso pede QR novo.',
      };
    },
  );

  // --------------------------------------------------------
  //  Lista de números autorizados
  // --------------------------------------------------------
  app.get(
    '/api/whatsapp/autorizados',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => {
      const lista = await banco.numeroAutorizado.findMany({
        include: { criadoPor: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
      });

      return {
        modoTeste: modoTeste(),
        autorizados: lista.map((a) => ({
          id: a.id,
          numero: a.numero,
          numeroMascarado: mascarar(a.numero),
          nome: a.nome,
          observacao: a.observacao,
          criadoPor: a.criadoPor.nome,
          criadoEm: a.criadoEm,
        })),
      };
    },
  );

  app.post(
    '/api/whatsapp/autorizados',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const dados = esquemaNumero.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      let digitos: string;
      try {
        digitos = normalizarTelefone(dados.data.numero);
      } catch (erro) {
        return res.status(400).send({
          erro: erro instanceof Error ? erro.message : 'Número inválido.',
        });
      }

      const repetido = await banco.numeroAutorizado.findUnique({ where: { numero: digitos } });
      if (repetido) {
        return res.status(409).send({ erro: 'Este número já está na lista.' });
      }

      const criado = await banco.numeroAutorizado.create({
        data: {
          numero: digitos,
          nome: dados.data.nome,
          observacao: dados.data.observacao,
          criadoPorId: req.usuario!.id,
        },
      });

      return res.status(201).send({
        autorizado: {
          id: criado.id,
          numero: criado.numero,
          numeroMascarado: mascarar(criado.numero),
          nome: criado.nome,
        },
        mensagem: criado.nome + ' liberado para receber mensagens de teste.',
      });
    },
  );

  app.delete(
    '/api/whatsapp/autorizados/:id',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const existe = await banco.numeroAutorizado.findUnique({ where: { id } });
      if (!existe) return res.status(404).send({ erro: 'Número não encontrado na lista.' });

      await banco.numeroAutorizado.delete({ where: { id } });

      return { ok: true, mensagem: existe.nome + ' saiu da lista de autorizados.' };
    },
  );

  // --------------------------------------------------------
  //  Envio de teste
  // --------------------------------------------------------
  app.post(
    '/api/whatsapp/testar',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const dados = z
        .object({
          para: textoObrigatorio(10, 'O número'),
          texto: textoObrigatorio(1, 'A mensagem').max(1000),
        })
        .safeParse(req.body);

      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const resposta = await enviarPeloWhatsApp({
        para: dados.data.para,
        texto: dados.data.texto,
        contexto: 'teste',
        usuarioId: req.usuario!.id,
      });

      return res.status(resposta.sucesso ? 200 : resposta.bloqueado ? 403 : 502).send(resposta);
    },
  );

  // --------------------------------------------------------
  //  Histórico
  // --------------------------------------------------------
  app.get(
    '/api/whatsapp/historico',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => {
      const mensagens = await banco.mensagemEnviada.findMany({
        include: { enviadoPor: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
        take: 100,
      });

      return {
        mensagens: mensagens.map((m) => ({
          id: m.id,
          numeroMascarado: mascarar(m.numero),
          destino: m.destino,
          texto: m.texto,
          temAnexo: m.temAnexo,
          situacao: m.situacao,
          erro: m.erro,
          adaptador: m.adaptador,
          contexto: m.contexto,
          referencia: m.referencia,
          enviadoPor: m.enviadoPor?.nome ?? null,
          criadoEm: m.criadoEm,
        })),
      };
    },
  );

  // --------------------------------------------------------
  //  Enviar o convite de uma cotação
  // --------------------------------------------------------
  app.post(
    '/api/cotacoes/:id/enviar-convites',
    { preHandler: app.exigirPermissao('cotacoes.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const bid = await banco.bid.findUnique({
        where: { id },
        include: {
          itens: { select: { id: true } },
          convidados: { include: { fornecedor: true } },
        },
      });

      if (!bid) return res.status(404).send({ erro: 'Cotação não encontrada.' });

      if (bid.situacao !== 'ABERTO') {
        return res.status(409).send({
          erro: 'A cotação precisa estar aberta para os convites saírem.',
          situacaoAtual: bid.situacao,
        });
      }

      const base = process.env.URL_PUBLICA ?? 'http://localhost:5173';
      const resultados = [];

      for (const convite of bid.convidados) {
        const telefone = convite.fornecedor.whatsapp;
        const nome = convite.fornecedor.nomeFantasia ?? convite.fornecedor.razaoSocial;

        if (!telefone) {
          resultados.push({
            fornecedor: nome,
            sucesso: false,
            bloqueado: false,
            mensagem: 'Fornecedor sem WhatsApp cadastrado.',
          });
          continue;
        }

        const resposta = await enviarPeloWhatsApp({
          para: telefone,
          destino: nome,
          texto: textoConviteCotacao({
            numeroBid: formatarNumeroBid(bid.numero),
            titulo: bid.titulo,
            prazo: bid.prazoResposta,
            link: base + '/portal/' + convite.token,
            quantidadeItens: bid.itens.length,
          }),
          contexto: 'cotacao',
          referencia: formatarNumeroBid(bid.numero),
          usuarioId: req.usuario!.id,
        });

        resultados.push({ fornecedor: nome, ...resposta });
      }

      const enviados = resultados.filter((r) => r.sucesso).length;
      const bloqueados = resultados.filter((r) => r.bloqueado).length;

      return {
        ok: enviados > 0,
        resultados,
        mensagem:
          enviados +
          ' de ' +
          resultados.length +
          ' convite(s) enviado(s)' +
          (bloqueados > 0
            ? '. ' + bloqueados + ' bloqueado(s) por não estarem na lista de autorizados.'
            : '.'),
      };
    },
  );

  // --------------------------------------------------------
  //  Enviar o PDF de um pedido de compra
  // --------------------------------------------------------
  app.post(
    '/api/pedidos/:id/enviar-whatsapp',
    { preHandler: app.exigirPermissao('pedidos.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const pedido = await banco.pedido.findUnique({
        where: { id },
        include: {
          fornecedor: true,
          comprador: { select: { nome: true } },
          bid: { select: { numero: true, titulo: true } },
          itens: {
            orderBy: { ordem: 'asc' },
            include: {
              bidItem: {
                include: {
                  material: { select: { codigoInterno: true, descricao: true, normaTecnica: true } },
                  solicitacaoItem: {
                    select: {
                      solicitacao: {
                        select: { numero: true, obra: { select: { codigo: true, nome: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!pedido) return res.status(404).send({ erro: 'Pedido não encontrado.' });

      if (!pedido.fornecedor.whatsapp) {
        return res.status(400).send({
          erro: 'Este fornecedor não tem WhatsApp cadastrado.',
        });
      }

      const total =
        pedido.itens.reduce(
          (s, i) => s + (decimal(i.quantidade) ?? 0) * (decimal(i.valorUnitario) ?? 0),
          0,
        ) +
        (decimal(pedido.valorFrete) ?? 0) +
        (decimal(pedido.outrosCustos) ?? 0);

      const pdf = await gerarPdfPedido({
        numero: pedido.numero,
        situacao: pedido.situacao,
        criadoEm: pedido.criadoEm,
        comprador: pedido.comprador.nome,
        origem: formatarNumeroBid(pedido.bid.numero) + ' — ' + pedido.bid.titulo,
        fornecedor: {
          razaoSocial: pedido.fornecedor.razaoSocial,
          nomeFantasia: pedido.fornecedor.nomeFantasia,
          cnpj: pedido.fornecedor.cnpj,
          email: pedido.fornecedor.email,
          telefone: pedido.fornecedor.whatsapp ?? pedido.fornecedor.telefone,
        },
        frete: decimal(pedido.valorFrete) ?? 0,
        outrosCustos: decimal(pedido.outrosCustos) ?? 0,
        pagamento: descreverPagamento(
          decimal(pedido.percentualEntrada),
          pedido.quantidadeParcelas,
          pedido.intervaloParcelasDias,
        ),
        observacoes: pedido.observacoes,
        itens: pedido.itens.map((i) => ({
          ordem: i.ordem,
          codigo: i.bidItem.material.codigoInterno,
          descricao: i.bidItem.material.descricao,
          normaTecnica: i.bidItem.material.normaTecnica,
          unidadeMedida: i.unidadeMedida,
          quantidade: decimal(i.quantidade) ?? 0,
          valorUnitario: decimal(i.valorUnitario) ?? 0,
          marca: i.marca,
          modelo: i.modelo,
          prazoEntregaDias: i.prazoEntregaDias,
          obra: i.bidItem.solicitacaoItem.solicitacao.obra,
        })),
      });

      const nomeFornecedor = pedido.fornecedor.nomeFantasia ?? pedido.fornecedor.razaoSocial;
      const numeroFormatado = formatarNumeroPedido(pedido.numero);

      const resposta = await enviarPeloWhatsApp({
        para: pedido.fornecedor.whatsapp,
        destino: nomeFornecedor,
        texto: textoPedidoDeCompra({
          numeroPedido: numeroFormatado,
          fornecedor: nomeFornecedor,
          total: 'R$ ' + total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
          pagamento: descreverPagamento(
            decimal(pedido.percentualEntrada),
            pedido.quantidadeParcelas,
            pedido.intervaloParcelasDias,
          ),
        }),
        anexo: {
          nomeArquivo: numeroFormatado + '.pdf',
          conteudo: pdf,
          tipoMime: 'application/pdf',
        },
        contexto: 'pedido',
        referencia: numeroFormatado,
        usuarioId: req.usuario!.id,
      });

      // Enviou de verdade: o pedido sai do rascunho sozinho.
      if (resposta.sucesso && pedido.situacao === 'RASCUNHO') {
        await banco.pedido.update({
          where: { id },
          data: { situacao: 'ENVIADO', enviadoEm: new Date() },
        });
      }

      return res.status(resposta.sucesso ? 200 : resposta.bloqueado ? 403 : 502).send(resposta);
    },
  );
}
