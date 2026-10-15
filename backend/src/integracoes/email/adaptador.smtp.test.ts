// ============================================================
//  O ENVELOPE DO E-MAIL SMTP
//
//  Três coisas entraram em 15/10/2026, depois de o e-mail de
//  teste cair na caixa de spam dele: nome no remetente, `Reply-To`
//  e a parte HTML junto do texto.
//
//  As três quebram CALADAS. A mensagem sai, ninguém vê erro, e só
//  quem recebe percebe — tarde, e sem saber dizer o que mudou.
//  Por isso aqui se confere o envelope, e não o resultado.
//
//  O nodemailer entra por injeção: nada abre conexão.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AdaptadorEmailSmtp } from './adaptador.smtp.js';

const CONTA = {
  host: 'smtp.gmail.com',
  porta: 587,
  usuario: 'compras@portoinc.com.br',
  senha: 'senha-de-aplicativo',
  remetente: 'compras@portoinc.com.br',
};

/** Guarda o que o nodemailer receberia, sem mandar nada. */
function espiao() {
  const enviadas: Record<string, unknown>[] = [];
  const opcoes: Record<string, unknown>[] = [];

  const biblioteca = {
    createTransport(o: Record<string, unknown>) {
      opcoes.push(o);
      return {
        async sendMail(m: Record<string, unknown>) {
          enviadas.push(m);
          return { messageId: '<abc@portoinc>' };
        },
      };
    },
  };

  return { biblioteca, enviadas, opcoes };
}

const UM_EMAIL = {
  para: 'vendas@fornecedor.com.br',
  assunto: 'Convite para cotação',
  corpo: 'A Porto Inc. está cotando 3 itens.',
};

describe('O remetente que o fornecedor vê', () => {
  it('vai com nome quando há nome', async () => {
    const { biblioteca, enviadas } = espiao();

    await new AdaptadorEmailSmtp(
      { ...CONTA, nomeRemetente: 'Porto Inc. — Compras' },
      biblioteca,
    ).enviar(UM_EMAIL);

    //  PAR, não string montada à mão: nome com acento ou com
    //  vírgula quebra a string e o nodemailer monta certo.
    assert.deepEqual(enviadas[0]?.from, {
      name: 'Porto Inc. — Compras',
      address: 'compras@portoinc.com.br',
    });
  });

  it('sem nome, continua só o endereço — nada quebra', async () => {
    const { biblioteca, enviadas } = espiao();

    await new AdaptadorEmailSmtp(CONTA, biblioteca).enviar(UM_EMAIL);

    assert.equal(enviadas[0]?.from, 'compras@portoinc.com.br');
  });

  it('a resposta volta para o remetente', async () => {
    const { biblioteca, enviadas } = espiao();

    await new AdaptadorEmailSmtp(CONTA, biblioteca).enviar(UM_EMAIL);

    //  Sem isto, responder cai no endereço que autenticou no SMTP,
    //  que pode não ser o do setor de compras.
    assert.equal(enviadas[0]?.replyTo, 'compras@portoinc.com.br');
  });
});

describe('As duas versões da mensagem', () => {
  it('texto e HTML saem juntos', async () => {
    const { biblioteca, enviadas } = espiao();

    await new AdaptadorEmailSmtp(CONTA, biblioteca).enviar({
      ...UM_EMAIL,
      corpoHtml: '<p>A Porto Inc. está cotando 3 itens.</p>',
    });

    //  As DUAS. É isso que faz `multipart/alternative`, e é o que
    //  tira a mensagem da minoria só-texto.
    assert.equal(enviadas[0]?.text, 'A Porto Inc. está cotando 3 itens.');
    assert.equal(enviadas[0]?.html, '<p>A Porto Inc. está cotando 3 itens.</p>');
  });

  it('sem HTML, a chave não vai vazia', async () => {
    const { biblioteca, enviadas } = espiao();

    await new AdaptadorEmailSmtp(CONTA, biblioteca).enviar(UM_EMAIL);

    //  `html: undefined` fez provedor recusar mensagem antes. A
    //  chave simplesmente não existe quando não há HTML.
    assert.ok(!('html' in (enviadas[0] ?? {})));
    assert.equal(enviadas[0]?.text, 'A Porto Inc. está cotando 3 itens.');
  });
});

describe('A conexão', () => {
  it('é criada UMA vez e reaproveitada', async () => {
    const { biblioteca, opcoes } = espiao();
    const smtp = new AdaptadorEmailSmtp(CONTA, biblioteca);

    await smtp.enviar(UM_EMAIL);
    await smtp.enviar(UM_EMAIL);
    await smtp.enviar(UM_EMAIL);

    //  Uma rodada de convites a seis fornecedores abriria seis
    //  conexões — e é o padrão que faz conta ser marcada como
    //  suspeita, o que nos trouxe até aqui.
    assert.equal(opcoes.length, 1, 'três envios, uma conexão');
  });

  it('587 sobe por STARTTLS; 465 é SSL direto', async () => {
    const a = espiao();
    await new AdaptadorEmailSmtp(CONTA, a.biblioteca).enviar(UM_EMAIL);
    assert.equal(a.opcoes[0]?.secure, false, '587 não é secure direto');

    const b = espiao();
    await new AdaptadorEmailSmtp({ ...CONTA, porta: 465 }, b.biblioteca).enviar(UM_EMAIL);
    assert.equal(b.opcoes[0]?.secure, true);
  });
});

describe('Quando falta configuração', () => {
  it('recusa sem abrir conexão', async () => {
    const { biblioteca, opcoes } = espiao();

    const r = await new AdaptadorEmailSmtp({ ...CONTA, senha: '' }, biblioteca).enviar(
      UM_EMAIL,
    );

    assert.equal(r.sucesso, false);
    assert.match(String(r.erro), /falta servidor, usuário ou senha/i);
    assert.equal(opcoes.length, 0, 'não chega a tentar conectar');
  });
});
