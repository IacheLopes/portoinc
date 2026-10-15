// ============================================================
//  QUEM FICOU SEM RESPOSTA PORQUE ELE CAIU
//
//  Pedido dele em 14/10/2026, depois de a cota da Groq estourar no
//  meio de uma conversa de verdade e o assistente emudecer.
//
//  A regra que decide é "AINDA É A ÚLTIMA?": pergunta sem resposta
//  que continua sendo a última coisa dita naquela conversa está
//  pendurada no ar, e responder destrava. Se alguém já falou
//  depois, o assunto andou — e chegar atrasado no meio de outra
//  coisa é pior do que ficar quieto.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, encerrar } from './ajuda.js';
import { banco } from '../src/plugins/banco.js';
import { integracoes } from '../src/integracoes/index.js';
import { repescagem } from '../src/servicos/atendimento.js';
import { salvar as salvarCerebro } from '../src/servicos/configuracao-ia.js';

const GRUPO = '120363000000000011@g.us';
const OUTRO_GRUPO = '120363000000000012@g.us';
const DE_QUEM = '5583993952248';

/**
 * Finge que chegou uma pergunta.
 *
 * Move também o relógio do grupo, porque é o que o fluxo de
 * verdade faz: toda mensagem que chega marca a hora, seja ela
 * para o assistente ou não.
 */
async function chegou(texto: string, grupo: string | null, quandoAtras = 60_000) {
  const quando = new Date(Date.now() - quandoAtras);

  if (grupo) {
    await banco.grupoWhatsApp.updateMany({ where: { jid: grupo }, data: { vistoEm: quando } });
  }

  return banco.mensagemEnviada.create({
    data: {
      numero: grupo ? DE_QUEM : DE_QUEM,
      texto,
      situacao: 'RECEBIDA',
      direcao: 'ENTRADA',
      adaptador: 'mock',
      contexto: 'assistente',
      referencia: grupo,
      criadoEm: quando,
    },
  });
}

/** Finge que ele respondeu. */
async function respondeu(entradaId: string, grupo: string | null) {
  return banco.mensagemEnviada.create({
    data: {
      numero: grupo ? grupo.replace(/\D/g, '') : DE_QUEM,
      texto: 'resposta qualquer',
      situacao: 'ENVIADA',
      direcao: 'SAIDA',
      adaptador: 'mock',
      contexto: 'assistente',
      referencia: grupo,
      respondeAId: entradaId,
    },
  });
}

async function quantasSairam(): Promise<number> {
  return banco.mensagemEnviada.count({ where: { direcao: 'SAIDA', situacao: 'ENVIADA' } });
}

before(async () => {
  await limparDados();

  //  O SIMULADO RECUSA ENVIO DESCONECTADO, como o de verdade.
  //  Prova que espera mensagem saindo precisa do WhatsApp de pé —
  //  senão ela estaria medindo um dublê que mente.
  await integracoes.whatsapp.conectar();

  await criarUsuarioTeste('leo-repesca@teste.com.br', ['COMPRADOR']);
  await banco.usuario.updateMany({
    where: { email: 'leo-repesca@teste.com.br' },
    data: { telefone: DE_QUEM },
  });

  await salvarCerebro({ nome: 'Vigo', ativo: true, limitePorHora: 0 });

  await banco.grupoWhatsApp.createMany({
    data: [
      { id: 'g1', jid: GRUPO, nome: 'Obra Porto Belo', liberado: true },
      { id: 'g2', jid: OUTRO_GRUPO, nome: 'Obra Vista Mar', liberado: true },
    ],
  });
});

after(encerrar);

describe('A pergunta que ainda é a última', () => {
  it('é respondida, com pedido de desculpa pela demora', async () => {
    const antes = await quantasSairam();

    await chegou('Vigo, tem cotação aberta?', GRUPO);

    const quantas = await repescagem();

    assert.equal(quantas, 1, 'a pergunta estava pendurada e precisava ser respondida');
    assert.equal(await quantasSairam(), antes + 1);

    const saiu = await banco.mensagemEnviada.findFirst({
      where: { direcao: 'SAIDA', referencia: GRUPO },
      orderBy: { criadoEm: 'desc' },
    });

    //  O pedido de desculpa vem do SISTEMA, não do modelo: quem
    //  sabe que houve atraso é o código que está repescando.
    assert.match(saiu?.texto ?? '', /^Desculpa a demora/);
  });

  it('e NÃO é respondida duas vezes', async () => {
    //  A segunda volta do relógio não pode repetir o que já saiu.
    const antes = await quantasSairam();

    const quantas = await repescagem();

    assert.equal(quantas, 0);
    assert.equal(await quantasSairam(), antes);
  });
});

describe('A pergunta que já passou', () => {
  it('NÃO é respondida quando alguém falou depois no grupo', async () => {
    const antes = await quantasSairam();

    //  A pergunta chega...
    await chegou('Vigo, e o financeiro?', OUTRO_GRUPO, 120_000);

    //  ...e DEPOIS alguém fala no grupo sobre outra coisa. Essa
    //  conversa nunca entra no banco — é de propósito, para a
    //  empresa não guardar papo alheio. O que fica é só o
    //  horário, e é ele que diz que o assunto andou.
    await banco.grupoWhatsApp.update({
      where: { jid: OUTRO_GRUPO },
      data: { vistoEm: new Date(Date.now() - 30_000) },
    });


    const quantas = await repescagem();

    assert.equal(quantas, 0, 'o assunto andou; chegar atrasado é pior que ficar quieto');
    assert.equal(await quantasSairam(), antes);
  });

  it('NÃO é respondida quando é velha demais', async () => {
    const antes = await quantasSairam();

    //  Vinte minutos: acima do teto de quinze.
    await chegou('Vigo, quantos fornecedores temos?', GRUPO, 20 * 60_000);

    const quantas = await repescagem();

    assert.equal(quantas, 0);
    assert.equal(await quantasSairam(), antes);
  });
});

describe('Com o assistente desligado', () => {
  it('não repesca nada, porque ele não deve falar', async () => {
    //  Limpa o que ficou pendurado dos blocos anteriores: senão
    //  este teste mede a pergunta do vizinho, não a sua.
    await banco.mensagemEnviada.deleteMany({ where: { direcao: 'ENTRADA' } });

    await salvarCerebro({ ativo: false });
    await chegou('Vigo, e as aprovações?', GRUPO, 60_000);

    const quantas = await repescagem();

    assert.equal(quantas, 0, 'desligado quer dizer que NADA sai — nem o atrasado');

    await salvarCerebro({ ativo: true });
  });
});

describe('Grupo tirado da Área IA', () => {
  it('não recebe repescagem', async () => {
    //  Tirar um grupo da lista é dizer "não fale mais aqui". Uma
    //  pergunta antiga não pode furar essa decisão.
    await banco.mensagemEnviada.deleteMany({ where: { direcao: 'ENTRADA' } });

    await banco.grupoWhatsApp.update({
      where: { jid: OUTRO_GRUPO },
      data: { liberado: false, vistoEm: new Date(Date.now() - 300_000) },
    });

    const antes = await quantasSairam();
    await chegou('Vigo, me diz uma coisa', OUTRO_GRUPO, 60_000);

    const quantas = await repescagem();

    assert.equal(quantas, 0);
    assert.equal(await quantasSairam(), antes);
  });
});
