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

const esquema = z
  .object({
    /**
     * Por onde o e-mail sai.
     *
     * SMTP usa a conta da própria empresa — Gmail ou 365 —, e é o
     * caminho que não exige mexer no DNS do domínio. RESEND é o
     * serviço por HTTP, mais robusto para volume, e exige cadastrar
     * o domínio. Em branco, RESEND, que era o único até 10/10/2026.
     */
    provedor: z.enum(['RESEND', 'SMTP']).optional(),
    remetente: z.string().email('Informe um e-mail válido para o remetente.'),
    /** Token da API no Resend; senha de aplicativo no SMTP. */
    chave: z.string().min(8, 'A senha ou chave parece curta demais.'),
    smtpHost: z.string().min(3).optional(),
    smtpPorta: z.coerce.number().int().min(1).max(65535).optional(),
    smtpUsuario: z.string().min(3).optional(),
    /** Para onde mandar a prova. Em branco, usa o e-mail de quem ligou. */
    provaPara: z.string().email('Informe um e-mail válido para a prova.').optional(),
  })
  //  SMTP SEM SERVIDOR NÃO É CONFIGURAÇÃO.
  //
  //  Sem esta conferência, salvar com o servidor em branco guarda
  //  uma configuração que o carregador descarta — e a tela fica
  //  dizendo "não configurado" logo depois de alguém ter salvo,
  //  sem explicar o porquê.
  .superRefine((d, ctx) => {
    if (d.provedor !== 'SMTP') return;

    if (!d.smtpHost) {
      ctx.addIssue({ code: 'custom', path: ['smtpHost'], message: 'Informe o servidor de saída.' });
    }
    if (!d.smtpPorta) {
      ctx.addIssue({ code: 'custom', path: ['smtpPorta'], message: 'Informe a porta.' });
    }
    if (!d.smtpUsuario) {
      ctx.addIssue({ code: 'custom', path: ['smtpUsuario'], message: 'Informe o usuário.' });
    }
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
        provedor: dados.data.provedor ?? 'RESEND',
        remetente: dados.data.remetente,
        chave: dados.data.chave,
        smtp:
          dados.data.provedor === 'SMTP'
            ? {
                host: dados.data.smtpHost as string,
                porta: dados.data.smtpPorta as number,
                usuario: dados.data.smtpUsuario as string,
              }
            : null,
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
