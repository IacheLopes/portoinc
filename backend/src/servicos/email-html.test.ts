// ============================================================
//  A VERSÃO HTML DO E-MAIL
//
//  Por que ela existe: o e-mail de teste caiu na caixa de spam em
//  15/10/2026. Uma das causas era a mensagem sair só em texto
//  puro — minoria no mundo real, e filtro de spam pontua o que é
//  incomum. A porta até dizia, por escrito, que HTML aumentava a
//  chance de cair em spam. Era o contrário.
//
//  O que se prova aqui é o que pode quebrar silenciosamente: o
//  escape do que vem de gente, e o link continuar clicável. O
//  resto é aparência, e aparência não se prova em teste.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { htmlDoTexto } from './email.js';

describe('O HTML do e-mail', () => {
  it('leva o texto que a pessoa receberia', () => {
    const html = htmlDoTexto('Você foi convidado a cotar 3 itens.');

    assert.match(html, /Você foi convidado a cotar 3 itens\./);
  });

  it('vem com charset e doctype — senão o acento quebra', () => {
    const html = htmlDoTexto('Cotação de cimento, areia e brita');

    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /charset="utf-8"/);
    assert.match(html, /lang="pt-BR"/);
  });

  it('transforma o link em clicável, mostrando o endereço', () => {
    const html = htmlDoTexto('Responda em http://192.168.1.109/portal/abc123');

    assert.match(html, /<a href="http:\/\/192\.168\.1\.109\/portal\/abc123"/);
    //  O ENDEREÇO CONTINUA VISÍVEL. Link escondido atrás de
    //  "clique aqui" é padrão de e-mail promocional, e conta
    //  contra a entrega.
    assert.match(html, />http:\/\/192\.168\.1\.109\/portal\/abc123</);
  });

  it('escapa o que vem digitado por gente', () => {
    //  O corpo carrega razão social e título de cotação. Um `<`
    //  solto quebraria a mensagem no cliente de e-mail — e um
    //  `<script>` não deve virar script na caixa de ninguém.
    const html = htmlDoTexto('Fornecedor <Aço & Cia> pediu <script>alert(1)</script>');

    assert.match(html, /&lt;Aço &amp; Cia&gt;/);
    assert.ok(!html.includes('<script>'), 'não pode sobrar tag de verdade');
  });

  it('escapa ANTES de fazer o link, não depois', () => {
    //  A ordem importa: escapando depois, o `<a>` que acabou de
    //  ser criado viraria `&lt;a&gt;` e o link morria. É o tipo de
    //  troca de ordem que ninguém nota até alguém clicar.
    const html = htmlDoTexto('veja http://exemplo.com/a?x=1&y=2');

    assert.match(html, /<a href="http:\/\/exemplo\.com\/a\?x=1&amp;y=2"/);
    assert.ok(!html.includes('&lt;a '), 'o link não pode ter sido escapado');
  });

  it('linha em branco separa parágrafo; linha simples só quebra', () => {
    const html = htmlDoTexto('Primeiro.\n\nSegundo.\nMesmo parágrafo.');

    assert.equal((html.match(/<p /g) ?? []).length, 2, 'dois parágrafos');
    assert.match(html, /Segundo\.<br>Mesmo parágrafo\./);
  });

  it('texto vazio não devolve HTML quebrado', () => {
    const html = htmlDoTexto('');

    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /<\/html>$/);
  });
});
