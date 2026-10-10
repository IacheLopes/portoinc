// ============================================================
//  Convite de senha — ROTAS PÚBLICAS
//
//  ATENÇÃO: estas rotas NÃO exigem login. Quem tem o link entra.
//  É proposital: a pessoa ainda não tem senha, então não teria
//  como se identificar antes.
//
//  Três regras, as mesmas do portal do fornecedor:
//
//  1. O link vale uma vez e vence em sete dias.
//  2. A resposta diz o mínimo: o nome de quem foi convidado, para
//     a pessoa saber que abriu o link certo. Nunca a função, as
//     permissões ou qualquer coisa da empresa.
//  3. Limite apertado de tentativas: sem isso, alguém varreria
//     links no chute.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  abrirConvite,
  usarConvite,
  RECUSA_EM_PORTUGUES,
} from '../servicos/convite-de-senha.js';

const esquemaSenha = z.object({
  senha: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
});

export async function rotasConvite(app: FastifyInstance) {
  //  Mais apertado que o do portal: aqui o que está do outro lado
  //  é uma conta do sistema, não uma proposta de cotação.
  const limite = { rateLimit: { max: 20, timeWindow: '5 minutes' } };

  // --------------------------------------------------------
  //  Abrir o convite (sem gastar)
  // --------------------------------------------------------
  app.get('/api/convite/:token', { config: limite }, async (req, res) => {
    const { token } = req.params as { token: string };
    const r = await abrirConvite(token);

    if (!r.ok) {
      return res.status(410).send({
        erro: RECUSA_EM_PORTUGUES[r.motivo],
        motivo: r.motivo,
      });
    }

    return res.send(r.convite);
  });

  // --------------------------------------------------------
  //  Criar a senha e gastar o convite
  // --------------------------------------------------------
  app.post('/api/convite/:token', { config: limite }, async (req, res) => {
    const { token } = req.params as { token: string };

    const corpo = esquemaSenha.safeParse(req.body);
    if (!corpo.success) {
      return res.status(400).send({
        erro: 'Dados inválidos',
        detalhes: corpo.error.issues.map((i) => ({
          campo: i.path.join('.'),
          mensagem: i.message,
        })),
      });
    }

    const r = await usarConvite(token, corpo.data.senha);

    if (!r.ok) {
      if (r.motivo === 'fraca') {
        return res.status(400).send({ erro: 'Senha fraca', detalhes: r.problemas });
      }
      return res.status(410).send({
        erro: RECUSA_EM_PORTUGUES[r.motivo],
        motivo: r.motivo,
      });
    }

    //  Não devolvemos sessão: a pessoa entra pela tela de entrada,
    //  digitando a senha que acabou de criar. Uma senha que nunca
    //  foi usada para entrar é uma senha que ela ainda não decorou.
    return res.send({
      ok: true,
      email: r.email,
      mensagem: 'Senha criada. Entre com ela para começar.',
    });
  });
}
