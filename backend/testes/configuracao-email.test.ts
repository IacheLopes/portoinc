// ============================================================
//  LIGAR O E-MAIL PELA TELA
//
//  Pedido dele em 10/10/2026: "a estrutura tem que ficar pronta,
//  pra só cadastrar o e-mail da Porto e já funcionar".
//
//  O que estes testes protegem, na ordem do que custaria mais
//  caro se quebrasse:
//
//    1. A CHAVE NUNCA VOLTA para a tela. Nem inteira, nem num
//       campo escondido, nem por engano num log de resposta.
//    2. SALVAR NÃO É LIGAR. Chave errada fica guardada e NÃO
//       confirmada — porque chave errada salva em silêncio
//       quebra o envio em silêncio.
//    3. O `.env` continua valendo como reserva. Quem já
//       dependia dele não pode quebrar na atualização.
//    4. Desligar NÃO APAGA a chave: serve para parar num
//       incidente e religar sem redigitar.
// ============================================================

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { banco } from '../src/plugins/banco.js';
import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';
import {
  recarregar,
  configuracaoAtual,
  guardar,
  confirmar,
  desligar,
  religar,
  resumir,
} from '../src/servicos/configuracao-email.js';

let admin = '';

before(async () => {
  await limparDados();
  await criarUsuarioTeste('admin-email@teste.com.br', ['ADMINISTRADOR']);
  admin = await entrarComo('admin-email@teste.com.br');
});

beforeEach(async () => {
  await banco.configuracaoEmail.deleteMany();
  await recarregar();
});

after(async () => {
  await banco.configuracaoEmail.deleteMany();
  await encerrar();
});

describe('A chave do provedor', () => {
  it('NUNCA volta para a tela, nem inteira nem em pedaço grande', async () => {
    const CHAVE = 're_segredo_que_nao_pode_vazar_123';

    await guardar({
      remetente: 'compras@portoinc.com.br',
      chave: CHAVE,
      quem: 'Teste',
    });

    const r = await chamar('/api/email/configuracao', { token: admin });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.configurado, true);
    assert.equal(r.corpo.remetente, 'compras@portoinc.com.br');

    //  A resposta INTEIRA não pode conter a chave em lugar nenhum.
    const tudo = JSON.stringify(r.corpo);
    assert.ok(!tudo.includes(CHAVE), 'a chave vazou na resposta');
    assert.ok(!tudo.includes('segredo_que_nao_pode_vazar'), 'vazou um pedaço da chave');

    //  Só o fim, para reconhecer qual é.
    assert.equal(r.corpo.chaveParcial, '••••••••_123');
  });

  it('e também não fica em texto puro no banco', async () => {
    const CHAVE = 're_outra_chave_secreta_456';

    await guardar({ remetente: 'a@b.com.br', chave: CHAVE, quem: null });

    const linha = await banco.configuracaoEmail.findUnique({ where: { id: 'unico' } });
    assert.ok(linha);
    assert.ok(!linha.chaveCifrada.includes(CHAVE), 'a chave está legível no banco');
    assert.ok(!linha.chaveCifrada.includes('chave_secreta'), 'pedaço legível no banco');
  });
});

describe('Salvar não é ligar', () => {
  it('guardado sem prova NÃO conta como confirmado', async () => {
    //  É o que separa "configurei" de "funciona". Chave errada
    //  salva em silêncio quebra o envio em silêncio.
    await guardar({ remetente: 'a@b.com.br', chave: 'chave-qualquer', quem: null });

    const r = await resumir();
    assert.equal(r.configurado, true);
    assert.equal(r.confirmadoEm, null, 'não pode nascer confirmado');
  });

  it('só a prova confirma', async () => {
    await guardar({ remetente: 'a@b.com.br', chave: 'chave-qualquer', quem: null });
    await confirmar();

    const r = await resumir();
    assert.ok(r.confirmadoEm, 'depois da prova tem de ficar confirmado');
  });

  it('guardar de novo apaga a confirmação antiga', async () => {
    //  Chave nova é chave não provada, mesmo que a anterior
    //  funcionasse. Herdar a confirmação diria que funciona algo
    //  que ninguém testou.
    await guardar({ remetente: 'a@b.com.br', chave: 'primeira', quem: null });
    await confirmar();
    assert.ok((await resumir()).confirmadoEm);

    await guardar({ remetente: 'a@b.com.br', chave: 'segunda', quem: null });
    assert.equal((await resumir()).confirmadoEm, null);
  });
});

describe('Desligar e religar', () => {
  it('desligar NÃO apaga a chave', async () => {
    //  Serve para parar o envio num incidente e religar depois
    //  sem redigitar — que é quando ninguém lembra dela.
    await guardar({ remetente: 'a@b.com.br', chave: 'chave-guardada', quem: null });
    await desligar();

    const r = await resumir();
    assert.equal(r.ativo, false);
    assert.equal(r.configurado, true, 'a chave tem de continuar guardada');
    assert.equal(configuracaoAtual(), null, 'desligado não pode enviar');

    await religar();
    assert.ok(configuracaoAtual(), 'religar volta a valer sem redigitar');
  });
});

describe('A configuração em vigor', () => {
  it('nada salvo quer dizer "usa o que o .env mandou"', async () => {
    assert.equal(configuracaoAtual(), null);
  });

  it('salvar passa a valer NA HORA, sem reiniciar a API', async () => {
    //  É a promessa do pedido dele. Sem isto, "salvar e já
    //  funcionar" seria mentira e pediria um reinício.
    assert.equal(configuracaoAtual(), null);

    await guardar({ remetente: 'compras@portoinc.com.br', chave: 'k', quem: null });

    assert.equal(configuracaoAtual()?.remetente, 'compras@portoinc.com.br');
  });

  it('chave ilegível vira "não configurado", e não erro', async () => {
    //  Acontece quando o JWT_SECRET muda ou o backup veio de
    //  outro ambiente. Derrubar o envio por causa disso seria
    //  pior do que voltar para o simulado.
    await guardar({ remetente: 'a@b.com.br', chave: 'k', quem: null });
    await banco.configuracaoEmail.update({
      where: { id: 'unico' },
      data: { chaveCifrada: 'isto.nao.decifra' },
    });

    await recarregar();
    assert.equal(configuracaoAtual(), null);

    const r = await resumir();
    assert.equal(r.configurado, false, 'tem de pedir para cadastrar de novo');
  });
});

describe('Quem pode mexer', () => {
  it('só quem administra integrações', async () => {
    await criarUsuarioTeste('almox-email@teste.com.br', ['ALMOXARIFE']);
    const almox = await entrarComo('almox-email@teste.com.br');

    const lendo = await chamar('/api/email/configuracao', { token: almox });
    assert.equal(lendo.status, 403);

    const ligando = await chamar('/api/email/configuracao', {
      metodo: 'POST',
      token: almox,
      corpo: { remetente: 'a@b.com.br', chave: 'chave-qualquer' },
    });
    assert.equal(ligando.status, 403);
  });

  it('remetente que não é e-mail é recusado antes de guardar', async () => {
    const r = await chamar('/api/email/configuracao', {
      metodo: 'POST',
      token: admin,
      corpo: { remetente: 'isto-nao-e-email', chave: 'chave-qualquer' },
    });

    assert.equal(r.status, 400);
    assert.equal(await banco.configuracaoEmail.count(), 0, 'não pode ter guardado nada');
  });
});
