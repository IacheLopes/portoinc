// ============================================================
//  Testes da Etapa 10 - WhatsApp
//
//  O que mais importa aqui é a TRAVA: enquanto o modo de teste
//  estiver ligado, nenhuma mensagem pode sair para um número que
//  não esteja na lista de autorizados.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let comprador = '';
let solicitante = '';
let almoxarife = '';

const NUMERO = '5511987654321';

/** Tira todos os números da lista, para cada bloco começar limpo. */
async function limparLista() {
  const lista = await chamar('/api/whatsapp/autorizados', { token: admin });

  for (const a of lista.corpo.autorizados ?? []) {
    await chamar('/api/whatsapp/autorizados/' + a.id, { metodo: 'DELETE', token: admin });
  }
}

before(async () => {
  await limparDados();

  await criarUsuarioTeste('admin10@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('comprador10@teste.com.br', ['COMPRADOR']);
  await criarUsuarioTeste('solicitante10@teste.com.br', ['SOLICITANTE']);
  await criarUsuarioTeste('almox10@teste.com.br', ['ALMOXARIFE']);

  admin = await entrarComo('admin10@teste.com.br');
  comprador = await entrarComo('comprador10@teste.com.br');
  solicitante = await entrarComo('solicitante10@teste.com.br');
  almoxarife = await entrarComo('almox10@teste.com.br');

  await chamar('/api/whatsapp/conectar', { metodo: 'POST', token: admin });
});

after(encerrar);

describe('Situação da conexão', () => {
  it('mostra o adaptador e o modo de teste', async () => {
    const r = await chamar('/api/whatsapp/situacao', { token: admin });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.adaptador, 'mock');
    assert.equal(r.corpo.simulado, true);
    assert.equal(r.corpo.modoTeste, true, 'o modo de teste precisa vir LIGADO por padrão');
    assert.ok(typeof r.corpo.detalhe === 'string');
  });

  it('o simulado não tem QR Code', async () => {
    const r = await chamar('/api/whatsapp/qr', { token: admin });

    assert.equal(r.status, 404);
  });

  it('conectar e desconectar respondem', async () => {
    const conectou = await chamar('/api/whatsapp/conectar', { metodo: 'POST', token: admin });
    assert.equal(conectou.status, 200);
    assert.equal(conectou.corpo.estado, 'conectado');

    const desligou = await chamar('/api/whatsapp/desconectar', { metodo: 'POST', token: admin });
    assert.equal(desligou.status, 200);
    assert.equal(desligou.corpo.estado, 'desconectado');

    await chamar('/api/whatsapp/conectar', { metodo: 'POST', token: admin });
  });
});

describe('A trava da lista de autorizados', () => {
  it('BLOQUEIA número fora da lista', async () => {
    await limparLista();

    const r = await chamar('/api/whatsapp/testar', {
      metodo: 'POST', token: admin,
      corpo: { para: NUMERO, texto: 'mensagem que não deve sair' },
    });

    assert.equal(r.status, 403);
    assert.equal(r.corpo.bloqueado, true);
    assert.equal(r.corpo.sucesso, false);
    assert.match(r.corpo.mensagem, /não está na lista de autorizados/);
  });

  it('o bloqueio fica registrado no histórico', async () => {
    const r = await chamar('/api/whatsapp/historico', { token: admin });
    const bloqueada = r.corpo.mensagens.find(
      (m: { situacao: string }) => m.situacao === 'BLOQUEADA',
    );

    assert.ok(bloqueada, 'a tentativa bloqueada precisa aparecer no histórico');
    assert.equal(bloqueada.contexto, 'teste');
  });

  it('DEIXA passar depois de liberar', async () => {
    await limparLista();

    const liberou = await chamar('/api/whatsapp/autorizados', {
      metodo: 'POST', token: admin,
      corpo: { numero: NUMERO, nome: 'Celular de teste' },
    });
    assert.equal(liberou.status, 201);

    const r = await chamar('/api/whatsapp/testar', {
      metodo: 'POST', token: admin,
      corpo: { para: NUMERO, texto: 'agora pode' },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.sucesso, true);
    assert.equal(r.corpo.bloqueado, false);
  });

  it('BLOQUEIA de novo depois de tirar da lista', async () => {
    const lista = await chamar('/api/whatsapp/autorizados', { token: admin });
    const meu = lista.corpo.autorizados.find(
      (a: { numero: string }) => a.numero === NUMERO,
    );

    await chamar('/api/whatsapp/autorizados/' + meu.id, { metodo: 'DELETE', token: admin });

    const r = await chamar('/api/whatsapp/testar', {
      metodo: 'POST', token: admin,
      corpo: { para: NUMERO, texto: 'não pode mais' },
    });

    assert.equal(r.status, 403);
    assert.equal(r.corpo.bloqueado, true);
  });

  it('a lista aceita número formatado e guarda só os dígitos', async () => {
    await limparLista();

    const r = await chamar('/api/whatsapp/autorizados', {
      metodo: 'POST', token: admin,
      corpo: { numero: '+55 (11) 98765-4321', nome: 'Com formatação' },
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.autorizado.numero, NUMERO);
  });

  it('o mesmo número não entra duas vezes', async () => {
    const r = await chamar('/api/whatsapp/autorizados', {
      metodo: 'POST', token: admin,
      corpo: { numero: NUMERO, nome: 'Repetido' },
    });

    assert.equal(r.status, 409);
  });

  it('o número aparece MASCARADO na lista', async () => {
    const r = await chamar('/api/whatsapp/autorizados', { token: admin });
    const primeiro = r.corpo.autorizados[0];

    assert.match(primeiro.numeroMascarado, /•/);
    assert.notEqual(primeiro.numeroMascarado, primeiro.numero);
  });

  it('recusa número que não parece telefone', async () => {
    const r = await chamar('/api/whatsapp/autorizados', {
      metodo: 'POST', token: admin,
      corpo: { numero: '123456789012345678', nome: 'Inválido' },
    });

    assert.equal(r.status, 400);
  });
});

describe('Histórico', () => {
  it('guarda o que foi enviado, com quem enviou', async () => {
    await limparLista();
    await chamar('/api/whatsapp/autorizados', {
      metodo: 'POST', token: admin,
      corpo: { numero: NUMERO, nome: 'Celular de teste' },
    });

    await chamar('/api/whatsapp/testar', {
      metodo: 'POST', token: admin,
      corpo: { para: NUMERO, texto: 'mensagem para o histórico' },
    });

    const r = await chamar('/api/whatsapp/historico', { token: admin });
    const enviada = r.corpo.mensagens.find(
      (m: { situacao: string; texto: string }) =>
        m.situacao === 'ENVIADA' && m.texto.includes('histórico'),
    );

    assert.ok(enviada);
    assert.equal(enviada.adaptador, 'mock');
    assert.ok(enviada.enviadoPor);
    assert.match(enviada.numeroMascarado, /•/, 'o histórico nunca mostra o número inteiro');
  });
});

describe('Quem pode mexer', () => {
  it('só quem administra integrações vê a tela', async () => {
    for (const token of [comprador, solicitante, almoxarife]) {
      const r = await chamar('/api/whatsapp/situacao', { token });
      assert.equal(r.status, 403);
    }
  });

  it('comprador não libera número', async () => {
    const r = await chamar('/api/whatsapp/autorizados', {
      metodo: 'POST', token: comprador,
      corpo: { numero: '5511999999999', nome: 'Tentativa' },
    });

    assert.equal(r.status, 403);
  });

  it('comprador não vê o histórico', async () => {
    const r = await chamar('/api/whatsapp/historico', { token: comprador });

    assert.equal(r.status, 403);
  });
});

describe('Envio ligado ao fluxo de compras', () => {
  it('o almoxarife não manda pedido por WhatsApp', async () => {
    const r = await chamar('/api/pedidos/00000000-0000-4000-8000-000000000000/enviar-whatsapp', {
      metodo: 'POST', token: almoxarife,
    });

    assert.equal(r.status, 403);
  });

  it('pedido inexistente devolve 404, não erro técnico', async () => {
    const r = await chamar('/api/pedidos/00000000-0000-4000-8000-000000000000/enviar-whatsapp', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 404);
  });

  it('cotação inexistente devolve 404', async () => {
    const r = await chamar('/api/cotacoes/00000000-0000-4000-8000-000000000000/enviar-convites', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 404);
  });
});
