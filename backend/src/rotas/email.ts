// ============================================================
//  E-mail: lista de autorizados, histórico e envios
//
//  O fluxo de compras manda o pedido sair "por e-mail/WhatsApp".
//  Esta é a metade do e-mail, com a mesma trava do WhatsApp:
//  enquanto o modo de teste está ligado, só sai para quem está
//  na lista.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { integracoes } from '../integracoes/index.js';
import { erroDeValidacao, textoOpcional, textoObrigatorio } from '../servicos/util.js';
import { formatarNumeroBid } from '../servicos/cotacao.js';
import { prepararPedidoParaEnvio, marcarPedidoComoEnviado } from '../servicos/envio-pedido.js';
import { dataBr } from '../servicos/data-br.js';
import {
  enviarPorEmail, modoTeste, mascararEmail, normalizarEmail,
} from '../servicos/email.js';

const esquemaAutorizado = z.object({
  email: textoObrigatorio(5, 'O e-mail'),
  nome: textoObrigatorio(2, 'O nome'),
  observacao: textoOpcional(200),
});

const esquemaTeste = z.object({
  para: textoObrigatorio(5, 'O e-mail'),
  assunto: textoOpcional(120),
  corpo: textoOpcional(2000),
});

/**
 * O texto do convite de cotação.
 *
 * Separado do WhatsApp de propósito: no e-mail cabe mais contexto,
 * e o fornecedor lê fora do celular, sem a pressa do aplicativo.
 */
export function textoConviteCotacaoEmail(dados: {
  numeroBid: string;
  titulo: string;
  prazo: Date;
  link: string;
  quantidadeItens: number;
  fornecedor: string;
}): string {
  return [
    'Olá, ' + dados.fornecedor + '.',
    '',
    'A Porto Inc. está cotando ' + dados.quantidadeItens +
      (dados.quantidadeItens === 1 ? ' item' : ' itens') + ' e gostaria da sua proposta.',
    '',
    'Cotação: ' + dados.numeroBid + ' — ' + dados.titulo,
    'Prazo para responder: ' + dataBr(dados.prazo),
    '',
    'Responda pelo link abaixo:',
    dados.link,
    '',
    'Não precisa de cadastro nem de senha. O link vale até o prazo acima.',
    '',
    'Porto Inc. — Setor de Compras',
  ].join('\n');
}

/** O texto do pedido de compra. */
export function textoPedidoDeCompraEmail(dados: {
  numeroPedido: string;
  fornecedor: string;
  total: string;
  pagamento: string;
}): string {
  return [
    'Olá, ' + dados.fornecedor + '.',
    '',
    'Segue em anexo o nosso pedido de compra ' + dados.numeroPedido + '.',
    '',
    'Total: ' + dados.total,
    'Pagamento: ' + dados.pagamento,
    '',
    'IMPORTANTE: informe o número ' + dados.numeroPedido + ' na nota fiscal e na ' +
      'entrega. É por ele que o almoxarifado confere o material na chegada.',
    '',
    'Porto Inc. — Setor de Compras',
  ].join('\n');
}

export async function rotasEmail(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Situação
  // --------------------------------------------------------
  app.get(
    '/api/email/situacao',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => ({
      adaptador: integracoes.email.nome,
      simulado: integracoes.email.nome === 'mock',
      pronto: integracoes.email.pronto(),
      remetente: integracoes.email.remetente(),
      modoTeste: modoTeste(),
      detalhe:
        integracoes.email.nome === 'mock'
          ? 'Modo simulado: nada sai para fora. Os e-mails ficam registrados aqui.'
          : integracoes.email.pronto()
            ? 'Ligado no provedor de verdade.'
            : 'Adaptador escolhido, mas faltam as credenciais no arquivo .env.',
    }),
  );

  // --------------------------------------------------------
  //  Lista de endereços autorizados
  // --------------------------------------------------------
  app.get(
    '/api/email/autorizados',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => {
      const lista = await banco.emailAutorizado.findMany({
        include: { criadoPor: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
      });

      return {
        modoTeste: modoTeste(),
        autorizados: lista.map((a) => ({
          id: a.id,
          email: a.email,
          emailMascarado: mascararEmail(a.email),
          nome: a.nome,
          observacao: a.observacao,
          criadoPor: a.criadoPor.nome,
          criadoEm: a.criadoEm,
        })),
      };
    },
  );

  app.post(
    '/api/email/autorizados',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const dados = esquemaAutorizado.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      let endereco: string;
      try {
        endereco = normalizarEmail(dados.data.email);
      } catch (erro) {
        return res.status(400).send({
          erro: erro instanceof Error ? erro.message : 'E-mail inválido.',
        });
      }

      const repetido = await banco.emailAutorizado.findUnique({ where: { email: endereco } });
      if (repetido) {
        return res.status(409).send({ erro: 'Este e-mail já está na lista.' });
      }

      const criado = await banco.emailAutorizado.create({
        data: {
          email: endereco,
          nome: dados.data.nome,
          observacao: dados.data.observacao,
          criadoPorId: req.usuario!.id,
        },
      });

      return res.status(201).send({
        autorizado: {
          id: criado.id,
          email: criado.email,
          emailMascarado: mascararEmail(criado.email),
          nome: criado.nome,
        },
        mensagem: criado.nome + ' liberado para receber e-mails de teste.',
      });
    },
  );

  app.delete(
    '/api/email/autorizados/:id',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const existe = await banco.emailAutorizado.findUnique({ where: { id } });
      if (!existe) return res.status(404).send({ erro: 'E-mail não encontrado na lista.' });

      await banco.emailAutorizado.delete({ where: { id } });

      return { ok: true, mensagem: existe.nome + ' saiu da lista de autorizados.' };
    },
  );

  // --------------------------------------------------------
  //  Histórico
  // --------------------------------------------------------
  app.get(
    '/api/email/historico',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req) => {
      const { limite } = req.query as { limite?: string };

      const lista = await banco.emailEnviado.findMany({
        include: { enviadoPor: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
        take: Math.min(Number(limite) || 50, 200),
      });

      return {
        historico: lista.map((m) => ({
          id: m.id,
          emailMascarado: mascararEmail(m.para),
          destino: m.destino,
          assunto: m.assunto,
          corpo: m.corpo,
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
  //  Envio de teste
  // --------------------------------------------------------
  app.post(
    '/api/email/teste',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const dados = esquemaTeste.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const resposta = await enviarPorEmail({
        para: dados.data.para,
        assunto: dados.data.assunto || 'Porto Inc. — teste de envio',
        corpo:
          dados.data.corpo ||
          'Este é um teste do envio de e-mail do sistema da Porto Inc.\n\n' +
            'Se você recebeu esta mensagem, a configuração está correta.',
        contexto: 'teste',
        usuarioId: req.usuario!.id,
      });

      return res.status(resposta.sucesso ? 200 : resposta.bloqueado ? 403 : 502).send(resposta);
    },
  );

  // --------------------------------------------------------
  //  Convite de cotação
  // --------------------------------------------------------
  app.post(
    '/api/cotacoes/:id/convidar-email',
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
        const nome = convite.fornecedor.nomeFantasia ?? convite.fornecedor.razaoSocial;
        const endereco = convite.fornecedor.email;

        if (!endereco) {
          resultados.push({
            fornecedor: nome,
            sucesso: false,
            bloqueado: false,
            mensagem: 'Fornecedor sem e-mail cadastrado.',
          });
          continue;
        }

        const resposta = await enviarPorEmail({
          para: endereco,
          destino: nome,
          assunto:
            'Pedido de cotação ' + formatarNumeroBid(bid.numero) + ' — Porto Inc.',
          corpo: textoConviteCotacaoEmail({
            numeroBid: formatarNumeroBid(bid.numero),
            titulo: bid.titulo,
            prazo: bid.prazoResposta,
            link: base + '/portal/' + convite.token,
            quantidadeItens: bid.itens.length,
            fornecedor: nome,
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
        resultados,
        enviados,
        bloqueados,
        mensagem:
          enviados + ' de ' + resultados.length +
          (resultados.length === 1 ? ' convite enviado' : ' convites enviados') +
          (bloqueados > 0
            ? '. ' + (bloqueados === 1
              ? '1 foi bloqueado'
              : bloqueados + ' foram bloqueados') +
              ' pela lista de autorizados.'
            : '.'),
      };
    },
  );

  // --------------------------------------------------------
  //  Pedido de compra
  // --------------------------------------------------------
  app.post(
    '/api/pedidos/:id/enviar-email',
    { preHandler: app.exigirPermissao('pedidos.gerenciar') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const pronto = await prepararPedidoParaEnvio(id);
      if (!pronto) return res.status(404).send({ erro: 'Pedido não encontrado.' });

      if (!pronto.email) {
        return res.status(400).send({
          erro: 'Este fornecedor não tem e-mail cadastrado.',
        });
      }

      const resposta = await enviarPorEmail({
        para: pronto.email,
        destino: pronto.nomeFornecedor,
        assunto: 'Pedido de compra ' + pronto.numeroFormatado + ' — Porto Inc.',
        corpo: textoPedidoDeCompraEmail({
          numeroPedido: pronto.numeroFormatado,
          fornecedor: pronto.nomeFornecedor,
          total: pronto.totalEmReais,
          pagamento: pronto.pagamento,
        }),
        anexos: [
          {
            nomeArquivo: pronto.numeroFormatado + '.pdf',
            conteudo: pronto.pdf,
            tipoMime: 'application/pdf',
          },
        ],
        contexto: 'pedido',
        referencia: pronto.numeroFormatado,
        usuarioId: req.usuario!.id,
      });

      if (resposta.sucesso) await marcarPedidoComoEnviado(id, pronto.situacao);

      return res.status(resposta.sucesso ? 200 : resposta.bloqueado ? 403 : 502).send(resposta);
    },
  );
}
