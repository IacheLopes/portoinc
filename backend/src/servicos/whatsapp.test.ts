// ============================================================
//  Testes do WhatsApp (parte que não depende do banco)
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mascarar, normalizarTelefone } from '../integracoes/whatsapp/adaptador.baileys.js';
import { textoConviteCotacao, textoPedidoDeCompra } from './whatsapp.js';

describe('Mascarar o número', () => {
  it('mantém DDI, DDD e os dois últimos dígitos', () => {
    assert.equal(mascarar('5511987654321'), '5511•••••••21');
  });

  it('funciona com o endereço interno do WhatsApp', () => {
    assert.equal(mascarar('5511987654321@s.whatsapp.net'), '5511•••••••21');
    assert.equal(mascarar('5511987654321:12@s.whatsapp.net'), '5511•••••••21');
  });

  it('número curto também é escondido', () => {
    assert.match(mascarar('12345'), /•/);
  });

  it('vazio não quebra', () => {
    assert.equal(mascarar(null), '—');
    assert.equal(mascarar(''), '—');
  });

  it('nunca devolve o número inteiro', () => {
    const inteiro = '5511987654321';
    assert.notEqual(mascarar(inteiro), inteiro);
    assert.ok(!mascarar(inteiro).includes('98765'));
  });
});

describe('Normalizar o telefone', () => {
  it('tira a formatação', () => {
    assert.equal(normalizarTelefone('+55 (11) 98765-4321'), '5511987654321');
    assert.equal(normalizarTelefone('55 11 98765 4321'), '5511987654321');
  });

  it('NÃO inventa o nono dígito', () => {
    // Quem sabe o número certo é o WhatsApp, consultado no envio.
    assert.equal(normalizarTelefone('551187654321'), '551187654321');
  });

  it('recusa número vazio', () => {
    assert.throws(() => normalizarTelefone(''), /vazio/i);
    assert.throws(() => normalizarTelefone('abc'), /vazio/i);
  });

  it('recusa comprimento implausível', () => {
    assert.throws(() => normalizarTelefone('12345'), /não parece válido/i);
    assert.throws(() => normalizarTelefone('1234567890123456'), /não parece válido/i);
  });

  it('recusa endereço interno no lugar de telefone', () => {
    assert.throws(() => normalizarTelefone('551199@s.whatsapp.net'), /telefone/i);
  });
});

describe('Texto do convite de cotação', () => {
  const dados = {
    numeroBid: 'BID-00002',
    titulo: 'Material elétrico — 2º pavimento',
    prazo: new Date('2026-10-15T23:59:59'),
    link: 'http://localhost:5173/portal/abc123',
    quantidadeItens: 3,
  };

  it('traz número, prazo e link', () => {
    const texto = textoConviteCotacao(dados);

    assert.match(texto, /BID-00002/);
    assert.match(texto, /15\/10\/2026/);
    assert.match(texto, /portal\/abc123/);
    assert.match(texto, /3 itens para cotar/);
  });

  it('diz que não precisa de cadastro', () => {
    assert.match(textoConviteCotacao(dados), /Não precisa de cadastro/);
  });

  it('concorda no singular', () => {
    const texto = textoConviteCotacao({ ...dados, quantidadeItens: 1 });

    assert.match(texto, /1 item para cotar/);
    assert.doesNotMatch(texto, /1 itens/);
  });

  it('NÃO menciona concorrente nem preço', () => {
    const texto = textoConviteCotacao(dados);

    assert.doesNotMatch(texto, /concorrente|outro fornecedor|R\$/i);
  });
});

describe('Texto do pedido de compra', () => {
  const dados = {
    numeroPedido: 'PC-00001',
    fornecedor: 'Marquilip',
    total: 'R$ 3.420,00',
    pagamento: '30% de entrada + 3x a cada 30 dias',
  };

  it('destaca o número do pedido duas vezes', () => {
    const texto = textoPedidoDeCompra(dados);
    const vezes = (texto.match(/PC-00001/g) ?? []).length;

    assert.ok(vezes >= 2, 'o número precisa aparecer no título e no aviso');
  });

  it('pede o número na nota fiscal', () => {
    assert.match(textoPedidoDeCompra(dados), /informe o número PC-00001 na nota fiscal/i);
  });

  it('traz total e condição de pagamento', () => {
    const texto = textoPedidoDeCompra(dados);

    assert.match(texto, /R\$ 3\.420,00/);
    assert.match(texto, /30% de entrada/);
  });
});
