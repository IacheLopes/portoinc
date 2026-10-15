// ============================================================
//  O E-MAIL DESLIGADO
//
//  O que se prova aqui é que o desligado NÃO FINGE. O simulado
//  dizia `pronto: true` e devolvia `sucesso: true` sem nada sair
//  da máquina — e a tela ficava verde. Foi o mesmo defeito que o
//  simulado do WhatsApp teve, e lá ele escondeu por uma noite
//  inteira que as respostas do assistente não estavam saindo.
//
//  São três promessas, e cada uma tem uma prova:
//    1. ele se declara não-pronto;
//    2. ele RECUSA o envio, em vez de mentir que deu certo;
//    3. a recusa diz onde ligar, não só que falhou.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AdaptadorEmailDesligado } from './adaptador.desligado.js';
import { AdaptadorEmailConfiguravel } from './adaptador.configuravel.js';

const UM_EMAIL = {
  para: 'fornecedor@exemplo.com.br',
  assunto: 'Convite para cotação',
  corpo: 'Você foi convidado a cotar.',
};

describe('O e-mail desligado', () => {
  it('não se diz pronto', () => {
    const e = new AdaptadorEmailDesligado();

    assert.equal(e.pronto(), false);
    assert.equal(e.remetente(), null, 'sem conta, não há remetente');
  });

  it('recusa o envio em vez de dizer que enviou', async () => {
    const e = new AdaptadorEmailDesligado();

    const r = await e.enviar(UM_EMAIL);

    assert.equal(r.sucesso, false, 'é a mentira do simulado que não pode voltar');
    assert.equal(r.adaptador, 'desligado');
  });

  it('a recusa diz ONDE ligar, não só que falhou', async () => {
    //  "Falha ao enviar" manda a pessoa abrir um chamado. O
    //  caminho da tela resolve sozinho.
    const r = await new AdaptadorEmailDesligado().enviar(UM_EMAIL);

    assert.match(String(r.erro), /não foi ligado/i);
    assert.match(String(r.erro), /Comunicação/i);
    assert.match(String(r.erro), /E-mail/i);
  });
});

describe('O desligado como reserva', () => {
  it('vale enquanto ninguém cadastrar a conta da empresa', async () => {
    //  É esta a instalação nova: `.env` sem nada e tela sem nada.
    //  O configurável procura a conta da tela, não acha, e cai na
    //  reserva — que agora é o desligado.
    const email = new AdaptadorEmailConfiguravel(new AdaptadorEmailDesligado());

    assert.equal(email.pronto(), false, 'a tela precisa poder mostrar "desligado"');

    const r = await email.enviar(UM_EMAIL);
    assert.equal(r.sucesso, false);
    assert.match(String(r.erro), /não foi ligado/i);
  });
});
