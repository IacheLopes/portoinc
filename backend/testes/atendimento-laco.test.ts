// ============================================================
//  O ASSISTENTE NÃO PODE CONVERSAR CONSIGO MESMO
//
//  Em 14/10/2026 ele entrou em laço num grupo de verdade. Mandava
//  "Entendido.", a própria mensagem voltava marcada como sua, e
//  ele respondia a ela. "Ok." "Tudo bem." "Entendido." — doze
//  mensagens em dois minutos, até o dono desligar para não perder
//  o número.
//
//  A trava existia e estava certa: comparar o identificador do
//  que chega com o do que saiu. Só que o identificador NUNCA ERA
//  GRAVADO — a coluna ficava vazia e a comparação não batia em
//  nada.
//
//  Uma trava só não basta para algo que custa o WhatsApp de uma
//  pessoa. São três agora, e cada uma falha de um jeito
//  diferente:
//
//    1. o IDENTIFICADOR — a certa, quando o provedor devolve um;
//    2. o TEXTO IDÊNTICO — para quando a primeira falhar;
//    3. o DISJUNTOR — para quando ninguém previu o motivo.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, encerrar } from './ajuda.js';
import { banco } from '../src/plugins/banco.js';
import { integracoes } from '../src/integracoes/index.js';
import { atender } from '../src/servicos/atendimento.js';
import { salvar as salvarCerebro } from '../src/servicos/configuracao-ia.js';
import type { MensagemRecebida } from '../src/integracoes/whatsapp/porta.js';

const GRUPO = '120363000000000007@g.us';

function recado(parcial: Partial<MensagemRecebida>): MensagemRecebida {
  return {
    de: '5583993952248',
    texto: 'oi',
    idMensagem: 'M' + Math.random().toString(36).slice(2),
    recebidaEm: new Date(),
    grupo: { jid: GRUPO },
    responderPara: GRUPO,
    deMim: true,
    comigoMesmo: false,
    ...parcial,
  };
}

/** Finge que o assistente mandou isto agora. */
async function jaMandei(texto: string, idMensagem: string | null) {
  return banco.mensagemEnviada.create({
    data: {
      numero: '120363000000000007',
      texto,
      situacao: 'ENVIADA',
      direcao: 'SAIDA',
      adaptador: 'mock',
      contexto: 'assistente',
      referencia: GRUPO,
      idMensagem,
    },
  });
}

before(async () => {
  await limparDados();

  //  O SIMULADO RECUSA ENVIO DESCONECTADO, como o de verdade.
  //  Prova que espera mensagem saindo precisa do WhatsApp de pé —
  //  senão ela estaria medindo um dublê que mente.
  await integracoes.whatsapp.conectar();

  await salvarCerebro({
    nome: 'Vigo',
    ativo: true,
    exigirNomeEmGrupo: false,
    limitePorHora: 0,
  });

  await banco.grupoWhatsApp.create({
    data: { jid: GRUPO, nome: 'Obra Porto Belo', liberado: true },
  });
});

after(encerrar);

describe('1. A trava do identificador', () => {
  it('não responde à mensagem que ELE MESMO mandou', async () => {
    const minha = await jaMandei('Temos 10 fornecedores.', 'ID-DELE-123');

    const r = await atender(
      recado({ texto: 'Temos 10 fornecedores.', idMensagem: 'ID-DELE-123' }),
    );

    assert.equal(r.ignorado, 'resposta-minha');
    assert.ok(minha);
  });
});

describe('2. A trava do texto idêntico', () => {
  it('não responde ao ECO da própria frase, mesmo sem identificador', async () => {
    //  É o caso real de 14/10/2026: a resposta saiu, voltou como
    //  "minha", e o id não tinha sido gravado. Sem esta trava, a
    //  conversa recomeça do zero a cada volta.
    await jaMandei('Entendido.', null);

    const r = await atender(
      recado({ texto: 'Entendido.', idMensagem: 'OUTRO-ID-QUALQUER' }),
    );

    assert.equal(r.ignorado, 'eco');
  });

  it('mas responde se QUEM FALOU não for o próprio número', async () => {
    //  Pessoa repetindo o que ele disse é raro, mas acontece — e
    //  não é motivo para ignorar gente.
    await jaMandei('Bom dia.', null);

    const r = await atender(
      recado({ texto: 'Bom dia.', de: '5511999990000', deMim: false }),
    );

    assert.notEqual(r.ignorado, 'eco', 'calou para uma pessoa de verdade');
  });
});

describe('3. O disjuntor', () => {
  it('corta quando ele já falou demais no mesmo minuto', async () => {
    //  Nenhuma conversa de gente tem o assistente falando cinco
    //  vezes no mesmo minuto na mesma sala. Laço tem, e é a
    //  primeira coisa que ele faz.
    for (let i = 0; i < 5; i += 1) {
      await jaMandei('resposta número ' + i, 'ID-' + i);
    }

    const r = await atender(
      recado({ texto: 'e quantas obras temos?', de: '5511888880000', deMim: false }),
    );

    assert.equal(r.ignorado, 'disjuntor');
  });

  it('e o que ele ia dizer fica guardado como rascunho', async () => {
    //  Cortar o envio não pode significar perder o trabalho: a
    //  resposta foi pensada, custou token, e serve para alguém
    //  entender o que aconteceu.
    const rascunho = await banco.mensagemEnviada.findFirst({
      where: { situacao: 'RASCUNHO', direcao: 'SAIDA', referencia: GRUPO },
      orderBy: { criadoEm: 'desc' },
    });

    assert.ok(rascunho, 'o disjuntor jogou a resposta fora');
    assert.match(rascunho.erro ?? '', /Disjuntor/);
  });
});
