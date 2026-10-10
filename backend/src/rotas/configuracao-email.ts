// ============================================================
//  Ligar o e-mail pela tela
//
//  Pedido dele em 10/10/2026: "a estrutura tem que ficar pronta,
//  pra só cadastrar o e-mail da Porto e já funcionar".
//
//  A ROTA DE SALVAR NÃO SÓ SALVA: ELA PROVA.
//
//  Uma chave errada salva em silêncio quebra o envio em silêncio,
//  e a empresa só descobre quando um fornecedor reclama que nunca
//  recebeu o convite. Por isso "ligar" manda um e-mail de teste
//  na hora, para o endereço de quem está ligando, e só marca o
//  canal como confirmado se ele chegar.
//
//  É o mesmo comportamento do QR do WhatsApp, que só diz
//  "Conectado" quando conectou de verdade.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { erroDeValidacao } from '../servicos/util.js';
import { integracoes } from '../integracoes/index.js';
import {
  resumir,
  guardar,
  confirmar,
  desligar,
  religar,
} from '../servicos/configuracao-email.js';

const esquema = z.object({
  remetente: z.string().email('Informe um e-mail válido para o remetente.'),
  chave: z.string().min(8, 'A chave do provedor parece curta demais.'),
  /** Para onde mandar a prova. Em branco, usa o e-mail de quem ligou. */
  provaPara: z.string().email('Informe um e-mail válido para a prova.').optional(),
});

export async function rotasConfiguracaoEmail(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Como está
  // --------------------------------------------------------
  app.get(
    '/api/email/configuracao',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => resumir(),
  );

  // --------------------------------------------------------
  //  Ligar: guarda e prova
  // --------------------------------------------------------
  app.post(
    '/api/email/configuracao',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const dados = esquema.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const provaPara = dados.data.provaPara ?? req.usuario!.email;

      await guardar({
        remetente: dados.data.remetente,
        chave: dados.data.chave,
        quem: req.usuario?.nome ?? null,
      });

      //  A prova sai pelo caminho normal de envio, não por um
      //  atalho: se o caminho normal estiver quebrado, é disso
      //  que a pessoa precisa saber.
      const prova = await integracoes.email.enviar({
        para: provaPara,
        assunto: 'Porto Inc. — e-mail ligado',
        corpo:
          'Se você está lendo isto, o e-mail do sistema está funcionando.\n\n' +
          'A partir de agora os convites de cotação e os pedidos de compra saem ' +
          'por aqui, de ' + dados.data.remetente + '.',
      });

      if (!prova.sucesso) {
        //  Fica GUARDADO e não confirmado: a pessoa corrige a
        //  chave sem redigitar o resto, e a tela mostra que
        //  faltou a prova.
        return res.status(502).send({
          ok: false,
          guardado: true,
          erro:
            'A configuração foi guardada, mas o e-mail de prova não saiu: ' +
            (prova.erro ?? 'o provedor não explicou o motivo.'),
          configuracao: await resumir(),
        });
      }

      await confirmar();

      return {
        ok: true,
        mensagem: 'E-mail ligado. Mandamos uma prova para ' + provaPara + '.',
        configuracao: await resumir(),
      };
    },
  );

  // --------------------------------------------------------
  //  Desligar e religar, sem perder a chave
  // --------------------------------------------------------
  app.post(
    '/api/email/configuracao/desligar',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => {
      await desligar();
      return {
        ok: true,
        mensagem: 'Envio de e-mail desligado. A configuração continua guardada.',
        configuracao: await resumir(),
      };
    },
  );

  app.post(
    '/api/email/configuracao/religar',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => {
      await religar();
      return {
        ok: true,
        mensagem: 'Envio de e-mail religado.',
        configuracao: await resumir(),
      };
    },
  );
}
