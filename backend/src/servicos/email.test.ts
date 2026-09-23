// ============================================================
//  As contas do e-mail
//
//  Sem banco: só as regras que não dependem de nada de fora.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enderecoValido, normalizarEmail, mascararEmail } from './email.js';

describe('Endereço de e-mail', () => {
  it('aceita o que parece endereço', () => {
    assert.equal(enderecoValido('compras@portoinc.com.br'), true);
    assert.equal(enderecoValido('a.b-c+x@sub.dominio.com'), true);
  });

  it('recusa o erro de digitação óbvio', () => {
    assert.equal(enderecoValido('compras'), false);
    assert.equal(enderecoValido('compras@'), false);
    assert.equal(enderecoValido('compras@portoinc'), false);
    assert.equal(enderecoValido('com pras@portoinc.com'), false);
    assert.equal(enderecoValido(''), false);
  });

  it('guarda sempre em minúsculas e sem espaço em volta', () => {
    // E-mail não diferencia maiúscula de minúscula. Guardar como
    // veio faria a lista de autorizados falhar quando a pessoa
    // digitasse de outro jeito.
    assert.equal(normalizarEmail('  Compras@PortoInc.COM.BR '), 'compras@portoinc.com.br');
  });

  it('avisa em português quando o endereço não serve', () => {
    assert.throws(() => normalizarEmail('não é e-mail'), /não parece um endereço/);
  });
});

describe('Máscara do endereço', () => {
  it('mostra o começo e o domínio, esconde o meio', () => {
    // O histórico é visto por mais gente do que a lista de
    // contatos: o endereço inteiro ali vaza contato de fornecedor.
    assert.equal(mascararEmail('compras@portoinc.com.br'), 'co•••••@portoinc.com.br');
  });

  it('endereço curto não fica sem máscara', () => {
    const mascarado = mascararEmail('ab@x.com');
    assert.ok(mascarado.includes('•'), 'faltou esconder algo: ' + mascarado);
    assert.ok(mascarado.endsWith('@x.com'));
  });

  it('texto sem arroba não vira endereço meio mascarado', () => {
    assert.equal(mascararEmail('coisa-nenhuma'), '•••');
  });
});
