// ============================================================
//  Envio por e-mail
//
//  O fluxo de compras manda o pedido sair "por e-mail/WhatsApp".
//  Esta é a metade do e-mail.
//
//  O que mais importa aqui é a mesma TRAVA do WhatsApp: enquanto
//  o modo de teste estiver ligado, nenhum e-mail pode sair para
//  um endereço fora da lista de autorizados.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let comprador = '';
let almoxarife = '';

const ENDERECO = 'fornecedor.teste@exemplo.com.br';

/** Esvazia a lista, para cada bloco começar do zero. */
async function limparLista() {
  const lista = await chamar('/api/email/autorizados', { token: admin });

  for (const a of lista.corpo.autorizados ?? []) {
    await chamar('/api/email/autorizados/' + a.id, { metodo: 'DELETE', token: admin });
  }
}

before(async () => {
  await limparDados();

  await criarUsuarioTeste('admin-email@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('comprador-email@teste.com.br', ['COMPRADOR']);
  await criarUsuarioTeste('almox-email@teste.com.br', ['ALMOXARIFE']);

  admin = await entrarComo('admin-email@teste.com.br');
  comprador = await entrarComo('comprador-email@teste.com.br');
  almoxarife = await entrarComo('almox-email@teste.com.br');
});

after(encerrar);

describe('Situação do e-mail', () => {
  it('vem simulado e com o modo de teste LIGADO', async () => {
    const r = await chamar('/api/email/situacao', { token: admin });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.adaptador, 'mock');
    assert.equal(r.corpo.simulado, true);
    assert.equal(r.corpo.modoTeste, true, 'o modo de teste precisa vir LIGADO por padrão');
  });
});

describe('A trava da lista de autorizados', () => {
  it('BLOQUEIA envio para quem não está na lista', async () => {
    await limparLista();

    const r = await chamar('/api/email/teste', {
      metodo: 'POST',
      token: admin,
      corpo: { para: ENDERECO },
    });

    assert.equal(r.status, 403);
    assert.equal(r.corpo.sucesso, false);
    assert.equal(r.corpo.bloqueado, true);
    assert.match(r.corpo.mensagem, /não está na lista/);
  });

  it('DEIXA passar depois de liberar', async () => {
    await limparLista();

    await chamar('/api/email/autorizados', {
      metodo: 'POST',
      token: admin,
      corpo: { email: ENDERECO, nome: 'Fornecedor de teste' },
    });

    const r = await chamar('/api/email/teste', {
      metodo: 'POST',
      token: admin,
      corpo: { para: ENDERECO },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.sucesso, true);
    assert.match(r.corpo.mensagem, /não saiu para fora/);
  });

  it('BLOQUEIA de novo depois de tirar da lista', async () => {
    await limparLista();

    const criado = await chamar('/api/email/autorizados', {
      metodo: 'POST',
      token: admin,
      corpo: { email: ENDERECO, nome: 'Fornecedor de teste' },
    });

    await chamar('/api/email/autorizados/' + criado.corpo.autorizado.id, {
      metodo: 'DELETE',
      token: admin,
    });

    const r = await chamar('/api/email/teste', {
      metodo: 'POST',
      token: admin,
      corpo: { para: ENDERECO },
    });

    assert.equal(r.status, 403);
    assert.equal(r.corpo.bloqueado, true);
  });

  it('a lista não diferencia maiúscula de minúscula', async () => {
    await limparLista();

    await chamar('/api/email/autorizados', {
      metodo: 'POST',
      token: admin,
      corpo: { email: 'Fornecedor.Teste@Exemplo.COM.BR', nome: 'Fornecedor' },
    });

    // Quem digita o endereço de outro jeito precisa bater na mesma
    // linha da lista, senão a trava vira loteria.
    const r = await chamar('/api/email/teste', {
      metodo: 'POST',
      token: admin,
      corpo: { para: 'FORNECEDOR.teste@exemplo.com.br' },
    });

    assert.equal(r.status, 200, 'era para passar: é o mesmo endereço');
  });

  it('o mesmo endereço não entra duas vezes', async () => {
    await limparLista();

    await chamar('/api/email/autorizados', {
      metodo: 'POST',
      token: admin,
      corpo: { email: ENDERECO, nome: 'Fornecedor' },
    });

    const r = await chamar('/api/email/autorizados', {
      metodo: 'POST',
      token: admin,
      corpo: { email: ENDERECO, nome: 'Outro nome' },
    });

    assert.equal(r.status, 409);
  });

  it('recusa o que não parece e-mail', async () => {
    const r = await chamar('/api/email/autorizados', {
      metodo: 'POST',
      token: admin,
      corpo: { email: 'isso-nao-e-email', nome: 'Alguém' },
    });

    assert.equal(r.status, 400);
    assert.match(r.corpo.erro, /não parece um endereço/);
  });

  it('o endereço aparece MASCARADO na lista', async () => {
    await limparLista();

    const r = await chamar('/api/email/autorizados', {
      metodo: 'POST',
      token: admin,
      corpo: { email: ENDERECO, nome: 'Fornecedor' },
    });

    assert.match(r.corpo.autorizado.emailMascarado, /•/);
    assert.ok(
      !r.corpo.autorizado.emailMascarado.includes('fornecedor.teste'),
      'o endereço inteiro não pode aparecer na tela',
    );
  });
});

describe('Histórico', () => {
  it('guarda o que foi enviado E o que foi bloqueado', async () => {
    await limparLista();

    // Um bloqueado...
    await chamar('/api/email/teste', {
      metodo: 'POST',
      token: admin,
      corpo: { para: 'ninguem@exemplo.com.br' },
    });

    // ...e um que passou.
    await chamar('/api/email/autorizados', {
      metodo: 'POST',
      token: admin,
      corpo: { email: ENDERECO, nome: 'Fornecedor' },
    });
    await chamar('/api/email/teste', {
      metodo: 'POST',
      token: admin,
      corpo: { para: ENDERECO },
    });

    const r = await chamar('/api/email/historico', { token: admin });

    assert.equal(r.status, 200);

    const situacoes = r.corpo.historico.map((h: { situacao: string }) => h.situacao);
    assert.ok(situacoes.includes('ENVIADA'), 'faltou o envio que passou');
    assert.ok(
      situacoes.includes('BLOQUEADA'),
      'a tentativa barrada TEM de ficar registrada',
    );
  });
});

describe('Quem pode mexer', () => {
  it('só quem administra integrações vê a lista', async () => {
    const r = await chamar('/api/email/autorizados', { token: comprador });
    assert.equal(r.status, 403);
  });

  it('almoxarife não manda e-mail de teste', async () => {
    const r = await chamar('/api/email/teste', {
      metodo: 'POST',
      token: almoxarife,
      corpo: { para: ENDERECO },
    });

    assert.equal(r.status, 403);
  });
});

describe('Envio ligado ao fluxo de compras', () => {
  it('pedido inexistente devolve 404, não erro técnico', async () => {
    const r = await chamar('/api/pedidos/00000000-0000-0000-0000-000000000000/enviar-email', {
      metodo: 'POST',
      token: admin,
    });

    assert.equal(r.status, 404);
  });

  it('cotação inexistente devolve 404', async () => {
    const r = await chamar('/api/cotacoes/00000000-0000-0000-0000-000000000000/convidar-email', {
      metodo: 'POST',
      token: admin,
    });

    assert.equal(r.status, 404);
  });

  it('o almoxarife não manda pedido por e-mail', async () => {
    const r = await chamar('/api/pedidos/00000000-0000-0000-0000-000000000000/enviar-email', {
      metodo: 'POST',
      token: almoxarife,
    });

    assert.equal(r.status, 403);
  });
});
