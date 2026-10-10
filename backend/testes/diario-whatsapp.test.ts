// ============================================================
//  O DIÁRIO DA CONEXÃO
//
//  Pedido dele em 10/10/2026: "hora que foi conectado, hora que
//  foi desconectado, status online/offline, se caiu".
//
//  Três coisas aqui nasceram de defeito MEDIDO, não de
//  imaginação — e por isso cada uma tem teste:
//
//    1. a ORDEM. As escritas eram disparadas sem espera e
//       corriam entre si: na primeira conexão de verdade,
//       `iniciando` foi gravado 1ms DEPOIS de `autenticando`,
//       que veio antes dele. O diário contava ao contrário.
//    2. a NÃO REPETIÇÃO, quebrada pela mesma corrida.
//    3. o BURACO DA PARTIDA. Quando a API morre, ninguém
//       consegue anotar "caí" — o processo já não existe.
//
//  Os hooks ficam no TOPO, fora de `describe`: dentro dele este
//  Node cancela tudo com "did not finish before its parent".
// ============================================================

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { banco } from '../src/plugins/banco.js';
import {
  anotarEstado,
  listarEventos,
  resumirConexao,
  conferirPartida,
} from '../src/servicos/diario-whatsapp.js';

before(async () => {
  await banco.eventoWhatsApp.deleteMany();
});

beforeEach(async () => {
  await banco.eventoWhatsApp.deleteMany();
});

after(async () => {
  await banco.eventoWhatsApp.deleteMany();
  await banco.$disconnect();
});

describe('O diário guarda as mudanças', () => {
  it('guarda a mudança com o número mascarado', async () => {
    await anotarEstado('conectado', 'Conectado.', '5583••••••48');

    const [evento] = await listarEventos();
    assert.equal(evento.estado, 'conectado');
    assert.equal(evento.detalhe, 'Conectado.');
    assert.equal(evento.numeroMascarado, '5583••••••48');
  });

  it('estado repetido não vira linha nova', async () => {
    await anotarEstado('conectado', 'Conectado.', null);
    await anotarEstado('conectado', 'Conectado.', null);
    await anotarEstado('conectado', 'Conectado.', null);

    assert.equal((await listarEventos()).length, 1);
  });

  it('mas o mesmo estado volta a contar depois de outro no meio', async () => {
    await anotarEstado('conectado', null, null);
    await anotarEstado('reconectando', null, null);
    await anotarEstado('conectado', null, null);

    assert.equal((await listarEventos()).length, 3);
  });

  it('DISPARADAS JUNTAS, entram na ordem em que foram pedidas', async () => {
    //  O defeito n. 1. Sem a fila, estas três corriam e a ordem
    //  no banco saía embaralhada — foi o que aconteceu na
    //  primeira conexão de verdade. Dispara sem esperar, que é
    //  exatamente como o adaptador faz.
    await Promise.all([
      anotarEstado('iniciando', null, null),
      anotarEstado('autenticando', null, null),
      anotarEstado('conectado', null, null),
    ]);

    const eventos = await listarEventos();
    assert.deepEqual(
      eventos.map((e) => e.estado),
      ['conectado', 'autenticando', 'iniciando'],
      'o diário tem de contar a história na ordem certa',
    );
  });

  it('e disparadas juntas com estado REPETIDO, grava uma só', async () => {
    //  O defeito n. 2: as três leem "o último é outro" ao mesmo
    //  tempo, e as três gravam.
    await Promise.all([
      anotarEstado('reconectando', null, null),
      anotarEstado('reconectando', null, null),
      anotarEstado('reconectando', null, null),
    ]);

    assert.equal((await listarEventos()).length, 1);
  });
});

describe('O resumo que a tela mostra', () => {
  it('no ar: diz desde quando, e que não caiu', async () => {
    await anotarEstado('conectado', 'Conectado.', '5583••••••48');

    const r = await resumirConexao('conectado');
    assert.ok(r.noArDesde, 'precisa dizer desde quando está no ar');
    assert.equal(r.ultimaQueda, null);
    assert.equal(r.quedasEm24h, 0);
  });

  it('fora do ar: não inventa um "desde", mas lembra a última vez', async () => {
    await anotarEstado('conectado', null, null);
    await anotarEstado('desconectado', 'Desligado.', null);

    const r = await resumirConexao('desconectado');
    assert.equal(r.noArDesde, null, 'fora do ar não tem "desde quando está no ar"');
    assert.ok(r.ultimaVezNoAr, 'mas lembra quando esteve');
    assert.ok(r.ultimoFim, 'e quando parou');
  });

  it('conta as quedas, e separa QUEDA de DESLIGAMENTO', async () => {
    await anotarEstado('conectado', null, null);
    await anotarEstado('reconectando', 'Conexão caiu (código 515).', null);
    await anotarEstado('conectado', null, null);
    await anotarEstado('reconectando', 'Conexão caiu (código 515).', null);
    await anotarEstado('conectado', null, null);
    await anotarEstado('desconectado', 'Desligado por aqui.', null);

    const r = await resumirConexao('desconectado');
    assert.equal(r.quedasEm24h, 2, 'duas quedas, não três');
    assert.match(String(r.ultimaQueda?.detalhe), /caiu/i);
    assert.match(String(r.ultimoFim?.detalhe), /Desligado/i);
  });
});

describe('O buraco da partida', () => {
  it('API reiniciada com a conexão no ar vira linha explicando', async () => {
    //  O defeito n. 3: o processo morre e ninguém anota.
    await anotarEstado('conectado', 'Conectado.', '5583••••••48');

    //  A API volta, e o adaptador nasce desconectado.
    await conferirPartida('desconectado');

    const [ultimo] = await listarEventos();
    assert.equal(ultimo.estado, 'desconectado');
    assert.match(String(ultimo.detalhe), /reiniciado/i);
    assert.match(String(ultimo.detalhe), /sem QR novo/i, 'tem de dizer o que fazer agora');
  });

  it('API reiniciada com a conexão JÁ fora do ar não inventa nada', async () => {
    await anotarEstado('conectado', null, null);
    await anotarEstado('desconectado', 'Desligado por aqui.', null);

    const antes = (await listarEventos()).length;
    await conferirPartida('desconectado');

    assert.equal((await listarEventos()).length, antes, 'não pode duplicar a parada');
  });

  it('API que volta JÁ conectada não registra parada nenhuma', async () => {
    await anotarEstado('conectado', null, null);

    const antes = (await listarEventos()).length;
    await conferirPartida('conectado');

    assert.equal((await listarEventos()).length, antes);
  });

  it('diário vazio na primeira partida da vida não vira linha', async () => {
    await conferirPartida('desconectado');
    assert.equal((await listarEventos()).length, 0);
  });
});
