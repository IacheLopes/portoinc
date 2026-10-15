// ============================================================
//  Envio por e-mail
//
//  O fluxo de compras manda o pedido sair "por e-mail/WhatsApp".
//  Esta é a metade do e-mail.
//
//  A TRAVA DE TESTE SAIU EM 12/10/2026, e boa parte deste arquivo
//  mudou de lado por causa disso: onde se provava que o e-mail era
//  BARRADO fora de uma lista, agora se prova que ele SAI para
//  qualquer endereço. O que ficou de guarda é o formato do
//  endereço — e o histórico, que registra tanto o que saiu quanto
//  o que falhou.
//
//  O WhatsApp mantém a trava dele, e a diferença é real: lá,
//  depois de ler o QR, o sistema dispara para qualquer número do
//  cadastro. No e-mail o freio é não haver remetente configurado.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let comprador = '';
let almoxarife = '';

const ENDERECO = 'fornecedor.teste@exemplo.com.br';

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
  it('vem simulada enquanto ninguém configurar o provedor', async () => {
    const r = await chamar('/api/email/situacao', { token: admin });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.adaptador, 'mock');
    assert.equal(r.corpo.simulado, true);
  });

  it('e NÃO fala mais de modo de teste', async () => {
    //  O campo saiu da resposta junto com a trava. Se ele voltar, a
    //  tela volta a prometer uma restrição que não existe.
    const r = await chamar('/api/email/situacao', { token: admin });

    assert.equal(r.corpo.modoTeste, undefined, 'modoTeste não existe mais');
  });
});

describe('NÃO EXISTE MAIS LISTA DE AUTORIZADOS', () => {
  it('a rota da lista sumiu', async () => {
    const r = await chamar('/api/email/autorizados', { token: admin });

    assert.equal(r.status, 404, 'a rota foi removida, não desligada');
  });

  it('e o e-mail sai para endereço que ninguém liberou', async () => {
    //  Este era o teste "BLOQUEIA envio para quem não está na
    //  lista". Virou o oposto, de propósito: é o que a remoção da
    //  trava quer dizer na prática.
    const r = await chamar('/api/email/teste', {
      metodo: 'POST',
      token: admin,
      corpo: { para: 'nunca.foi.liberado@exemplo.com.br' },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.sucesso, true);
    assert.equal(r.corpo.bloqueado, false);
    assert.match(r.corpo.mensagem, /ainda não sai do sistema/);
  });
});

describe('O que ainda segura um envio', () => {
  it('endereço com erro de digitação é recusado', async () => {
    //  O único guarda que sobrou, e ele é de formato: o resto quem
    //  diz é o provedor, ao recusar.
    const r = await chamar('/api/email/teste', {
      metodo: 'POST',
      token: admin,
      corpo: { para: 'isso-nao-e-email.com.br' },
    });

    assert.equal(r.status, 502);
    assert.equal(r.corpo.sucesso, false);
    assert.equal(r.corpo.bloqueado, false, 'não é bloqueio: é endereço inválido');
    assert.match(r.corpo.mensagem, /não parece um endereço/);
  });

  it('o endereço é guardado sempre em minúscula', async () => {
    //  Quem digita de outro jeito precisa cair na mesma linha do
    //  histórico, senão o mesmo fornecedor aparece duas vezes.
    await chamar('/api/email/teste', {
      metodo: 'POST',
      token: admin,
      corpo: { para: 'MAIUSCULA.Teste@Exemplo.COM.BR', assunto: 'conferindo a caixa' },
    });

    const r = await chamar('/api/email/historico', { token: admin });
    const registro = r.corpo.historico.find(
      (h: { assunto: string }) => h.assunto === 'conferindo a caixa',
    );

    assert.ok(registro, 'o envio tinha de estar no histórico');
    assert.ok(
      !/[A-Z]/.test(registro.emailMascarado.replace(/•/g, '')),
      'o endereço foi guardado com maiúscula: ' + registro.emailMascarado,
    );
  });
});

describe('Histórico', () => {
  it('guarda o que saiu E o que falhou', async () => {
    //  Era "o que foi enviado E o que foi bloqueado". Sem trava
    //  nada é bloqueado por lista — mas o histórico continua tendo
    //  de registrar a falha, que agora vem do endereço inválido ou
    //  do provedor recusando.
    await chamar('/api/email/teste', {
      metodo: 'POST',
      token: admin,
      corpo: { para: 'endereco-quebrado', assunto: 'tinha de falhar' },
    });

    await chamar('/api/email/teste', {
      metodo: 'POST',
      token: admin,
      corpo: { para: ENDERECO, assunto: 'tinha de sair' },
    });

    const r = await chamar('/api/email/historico', { token: admin });

    assert.equal(r.status, 200);

    const situacoes = r.corpo.historico.map((h: { situacao: string }) => h.situacao);
    assert.ok(situacoes.includes('ENVIADA'), 'faltou o envio que passou');
    assert.ok(situacoes.includes('FALHOU'), 'a tentativa que deu errado TEM de ficar registrada');
    assert.ok(!situacoes.includes('BLOQUEADA'), 'não existe mais envio bloqueado por lista');
  });

  it('mostra o endereço MASCARADO, nunca inteiro', async () => {
    //  Isto vinha da lista de autorizados e continua valendo no
    //  histórico: a tela mostra de quem é, sem entregar o contato.
    const r = await chamar('/api/email/historico', { token: admin });
    const registro = r.corpo.historico.find(
      (h: { assunto: string }) => h.assunto === 'tinha de sair',
    );

    assert.ok(registro);
    assert.match(registro.emailMascarado, /•/);
    assert.ok(
      !registro.emailMascarado.includes('fornecedor.teste'),
      'o endereço inteiro não pode aparecer na tela',
    );
  });
});

describe('Quem pode mexer', () => {
  it('só quem administra integrações vê o histórico', async () => {
    const r = await chamar('/api/email/historico', { token: comprador });
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
