// ============================================================
//  Testes do app
//
//  O limitador de requisições fica DESLIGADO durante os testes —
//  senão o próprio teste seria bloqueado ao fazer dezenas de
//  logins seguidos. Foi por isso que um defeito dele sobreviveu:
//  o excesso de requisição respondia **500**, como se o servidor
//  tivesse quebrado.
//
//  A resposta do limitador é montada por uma função pura, e é
//  ela que este arquivo testa. Assim a regra fica coberta sem
//  precisar ligar o limitador.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { excessoDeRequisicoes } from './app.js';

describe('Excesso de requisições', () => {
  it('responde 429, não 500', () => {
    // 500 quer dizer "o servidor quebrou" e acorda gente de
    // madrugada. Aqui o servidor está bem: quem pediu demais foi
    // o cliente.
    assert.equal(excessoDeRequisicoes().statusCode, 429);
  });

  it('a mensagem vem no campo que a tela lê', () => {
    const resposta = excessoDeRequisicoes();

    assert.equal(typeof resposta.erro, 'string');
    assert.match(resposta.erro, /Aguarde/);
  });

  it('a mensagem diz o que fazer, não o que aconteceu', () => {
    // "Erro 429" não ajuda ninguém. "Aguarde um instante" ajuda.
    assert.match(excessoDeRequisicoes().erro, /instante|aguarde/i);
  });
});
