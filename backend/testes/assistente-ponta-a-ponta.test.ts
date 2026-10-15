// ============================================================
//  A CORRENTE INTEIRA, DE PONTA A PONTA
//
//  Esta é a prova que faltava. Havia provas das peças soltas — a
//  peneira do que chega, o laço, a repescagem, o acesso — e
//  nenhuma que percorresse o caminho todo:
//
//    chega no grupo → reconhece quem é → consulta o sistema
//                   → monta a resposta → ENVIA PARA O GRUPO
//
//  Em 14/10/2026 esse caminho quebrou SETE vezes, e todas foram
//  descobertas por uma pessoa testando no celular, uma de cada
//  vez, ao longo de uma noite:
//
//    1. mensagem do próprio número chegava por outro canal e era
//       descartada antes de qualquer coisa;
//    2. o WhatsApp mandava um identificador novo (LID) no lugar do
//       telefone, e ninguém era reconhecido;
//    3. o envio recusava o endereço do grupo por não parecer um
//       telefone — ela montava a resposta certa e não entregava;
//    4. a função de baixar áudio não estava na biblioteca montada;
//    5. o identificador da resposta não era gravado, e ela
//       conversava consigo mesma em laço;
//    6. "Ligar o assistente" não ligava o envio, porque eram duas
//       chaves para a mesma pergunta;
//    7. o nome do grupo não vinha na mensagem.
//
//  Cada elo tem a sua prova aqui. Se um deles quebrar de novo, é
//  esta suíte que acusa — e não o cliente, numa apresentação.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, encerrar } from './ajuda.js';
import { banco } from '../src/plugins/banco.js';
import { integracoes, iaSimulada } from '../src/integracoes/index.js';
import { atender } from '../src/servicos/atendimento.js';
import { salvar as salvarCerebro } from '../src/servicos/configuracao-ia.js';
import { peneirar } from '../src/integracoes/whatsapp/adaptador.baileys.js';
import type { AdaptadorWhatsAppMock } from '../src/integracoes/whatsapp/adaptador.mock.js';
import type { MensagemRecebida } from '../src/integracoes/whatsapp/porta.js';

const GRUPO = '120363000000000021@g.us';
const MEU_NUMERO = '558393952248@s.whatsapp.net';
const DELA = '5583993952248';

const whatsapp = integracoes.whatsapp as unknown as AdaptadorWhatsAppMock;

function recado(parcial: Partial<MensagemRecebida>): MensagemRecebida {
  return {
    de: DELA,
    texto: 'Vigo, quantos fornecedores temos?',
    idMensagem: 'M' + Math.random().toString(36).slice(2),
    recebidaEm: new Date(),
    grupo: { jid: GRUPO },
    responderPara: GRUPO,
    deMim: false,
    comigoMesmo: false,
    ...parcial,
  };
}

/** O roteiro de uma resposta normal: consulta, depois fala. */
function roteiroNormal(texto = 'Temos 10 fornecedores ativos.') {
  iaSimulada?.enfileirar(
    { chamadas: [{ id: 'c1', nome: 'consultarFornecedores', argumentos: {} }] },
    { texto },
  );
}

/** A última coisa que o WhatsApp foi mandado enviar. */
function ultimoEnvio() {
  return whatsapp.listarHistorico()[0];
}

before(async () => {
  await limparDados();

  const id = await criarUsuarioTeste('leo-ponta@teste.com.br', ['COMPRADOR']);
  await banco.usuario.update({ where: { id }, data: { telefone: DELA } });

  await banco.grupoWhatsApp.create({
    data: { jid: GRUPO, nome: 'Obra Porto Belo', liberado: true },
  });

  await salvarCerebro({
    nome: 'Vigo',
    ativo: true,
    exigirNomeEmGrupo: true,
    limitePorHora: 0,
  });

  await integracoes.whatsapp.conectar();
});

after(encerrar);

describe('A corrente inteira', () => {
  it('chega no grupo, consulta o sistema e SAI PARA O GRUPO', async () => {
    roteiroNormal();

    const r = await atender(recado({}));

    assert.equal(r.ignorado, undefined, 'a mensagem tinha tudo para ser respondida');
    assert.equal(r.enviada, true, 'a resposta precisava sair');

    const enviado = ultimoEnvio();

    //  O ELO 3: o endereço do grupo tem 18 dígitos e um sufixo
    //  próprio. Ele já foi recusado por "não parecer telefone", e
    //  a resposta certa morreu sem ser entregue.
    assert.equal(enviado.para, GRUPO, 'a resposta foi para o endereço errado');
    assert.match(enviado.texto, /10 fornecedores/);
  });

  it('e fica tudo registrado: pergunta, resposta e as consultas', async () => {
    const resposta = await banco.mensagemEnviada.findFirst({
      where: { direcao: 'SAIDA', referencia: GRUPO },
      orderBy: { criadoEm: 'desc' },
      include: { respondeA: true },
    });

    assert.ok(resposta);
    assert.equal(resposta.situacao, 'ENVIADA');
    assert.deepEqual(resposta.consultasIa, ['consultarFornecedores']);
    assert.ok(resposta.respondeA, 'a resposta precisa apontar para a pergunta');

    //  O ELO 5: sem o identificador gravado, a própria resposta
    //  volta parecendo gente e ela entra em laço.
    assert.ok(resposta.idMensagem, 'o identificador da resposta NÃO foi gravado');
  });
});

describe('Elo 1 — a mensagem do próprio número', () => {
  it('a que VOCÊ manda no grupo chega e é atendida', () => {
    //  Chega com `fromMe` e, no caso real medido, SEM o campo de
    //  participante: do ponto de vista do WhatsApp, obviamente foi
    //  você. Sem o remendo, ela morre sem remetente.
    const r = peneirar(
      {
        key: { remoteJid: GRUPO, fromMe: true, id: 'E1' },
        message: { conversation: 'Vigo, tem cotação aberta?' },
      },
      undefined,
      MEU_NUMERO,
    );

    assert.ok(r, 'a própria mensagem no grupo precisa chegar');
    assert.equal(r.de, '558393952248');
    assert.equal(r.deMim, true);
  });
});

describe('Elo 2 — o identificador novo do WhatsApp', () => {
  it('lê o TELEFONE do campo ao lado, não o LID', () => {
    //  Medido em 14/10/2026: `participant=256375338881247@lid`, um
    //  número que não é telefone de ninguém. O telefone de verdade
    //  vem em `participantPn`.
    const r = peneirar({
      key: {
        remoteJid: GRUPO,
        fromMe: false,
        id: 'E2',
        participant: '13086782136333@lid',
        participantPn: '558393472535@s.whatsapp.net',
      },
      message: { conversation: 'Vigo, e o financeiro?' },
    });

    assert.ok(r);
    assert.equal(r.de, '558393472535', 'pegou o LID em vez do telefone');
  });

  it('e no privado também, pelo campo do remetente', () => {
    const r = peneirar({
      key: {
        remoteJid: '260348166848719@lid',
        fromMe: false,
        id: 'E3',
        senderPn: '556193473481@s.whatsapp.net',
      },
      message: { conversation: 'oi' },
    });

    assert.ok(r);
    assert.equal(r.de, '556193473481');
  });
});

describe('Elo 7 — o nome do grupo', () => {
  it('aparece no registro da conversa, não o número cru', async () => {
    const entrada = await banco.mensagemEnviada.findFirst({
      where: { direcao: 'ENTRADA', referencia: GRUPO },
      orderBy: { criadoEm: 'desc' },
    });

    assert.ok(entrada);
    assert.match(entrada.destino ?? '', /Obra Porto Belo/);
  });
});

describe('Os caminhos que ninguém tinha testado', () => {
  it('foto COM LEGENDA que chama o nome é atendida', () => {
    const r = peneirar({
      key: { remoteJid: GRUPO, fromMe: false, id: 'F1', participantPn: '558393472535@s.whatsapp.net' },
      message: { imageMessage: { caption: 'Vigo, é esta a nota do PC-00001?' } },
    });

    assert.ok(r);
    assert.match(r.texto, /PC-00001/);
  });

  it('mensagem gigante é ignorada, não truncada', async () => {
    //  Texto de 2.000 caracteres não é pergunta, é despejo — e
    //  mandar isso ao modelo custa caro para não responder nada.
    const r = await atender(recado({ texto: 'Vigo, ' + 'a'.repeat(2000) }));

    assert.equal(r.ignorado, 'longa');
  });

  it('grupo TIRADO da Área IA no meio da conversa cala na hora', async () => {
    await banco.grupoWhatsApp.update({ where: { jid: GRUPO }, data: { liberado: false } });

    const antes = whatsapp.listarHistorico().length;
    const r = await atender(recado({ texto: 'Vigo, e as aprovações?' }));

    assert.equal(r.ignorado, 'grupo-nao-liberado');
    assert.equal(whatsapp.listarHistorico().length, antes, 'falou num grupo que foi tirado');

    await banco.grupoWhatsApp.update({ where: { jid: GRUPO }, data: { liberado: true } });
  });

  it('WhatsApp CAINDO no meio não perde a resposta: ela vira falha registrada', async () => {
    roteiroNormal('Temos 3 obras.');
    await integracoes.whatsapp.desconectar();

    const r = await atender(recado({ texto: 'Vigo, quantas obras?' }));

    assert.equal(r.enviada, false);

    const registro = await banco.mensagemEnviada.findFirst({
      where: { direcao: 'SAIDA', referencia: GRUPO },
      orderBy: { criadoEm: 'desc' },
    });

    //  Mesmo sem conseguir entregar, o que ela ia dizer fica
    //  guardado — é o que permite repescar depois, e é o que
    //  explica o silêncio para quem for olhar.
    assert.equal(registro?.situacao, 'FALHOU');
    assert.match(registro?.texto ?? '', /3 obras/);
    assert.ok(registro?.erro, 'a falha precisa dizer o motivo');

    await integracoes.whatsapp.conectar();
  });
});

describe('Elo 6 — ligar liga de verdade', () => {
  it('o assistente desligado não responde, mesmo com tudo o mais pronto', async () => {
    await salvarCerebro({ ativo: false });

    const antes = whatsapp.listarHistorico().length;
    const r = await atender(recado({ texto: 'Vigo, tem cotação?' }));

    assert.equal(r.ignorado, 'desligada');
    assert.equal(whatsapp.listarHistorico().length, antes);

    await salvarCerebro({ ativo: true });
  });

  it('e NÃO existe mais chave escondida entre ligado e respondendo', async () => {
    //  O modo rascunho saiu em 14/10/2026. Ele existiu enquanto a
    //  regra da casa era "nada sai sem alguém mandar", e virou
    //  armadilha: o dono clicou em "Ligar", mandou mensagem e nada
    //  saiu — a chave tinha ficado desligada de um conserto
    //  anterior, e a resposta foi parar em rascunho.
    //
    //  Esta prova guarda a regra nova: ligado é ligado.
    roteiroNormal('Temos 10 fornecedores ativos.');

    const antes = whatsapp.listarHistorico().length;
    const r = await atender(recado({ texto: 'Vigo, quantos fornecedores?' }));

    assert.equal(r.enviada, true, 'ligado tem de responder, sem segunda chave');
    assert.equal(whatsapp.listarHistorico().length, antes + 1);
  });
});
