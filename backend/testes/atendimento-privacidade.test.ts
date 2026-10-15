// ============================================================
//  O QUE O SISTEMA NAO PODE GUARDAR
//
//  O assistente roda no celular de UMA PESSOA, e esse celular
//  tem grupo de familia, grupo de oferta, grupo de outro
//  trabalho. Nada disso e da Porto Inc.
//
//  Em 14/10/2026 o sistema gravava TODA mensagem que chegava e so
//  depois decidia se era para ele — e foram parar no banco da
//  empresa uma propaganda de memoria RAM e a conversa de um grupo
//  de outra firma. Esta prova existe para isso nao voltar.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, encerrar } from './ajuda.js';
import { banco } from '../src/plugins/banco.js';
import { integracoes } from '../src/integracoes/index.js';
import { atender } from '../src/servicos/atendimento.js';
import { salvar as salvarCerebro } from '../src/servicos/configuracao-ia.js';
import type { MensagemRecebida } from '../src/integracoes/whatsapp/porta.js';

const GRUPO_ALHEIO = '120363000000000001@g.us';
const GRUPO_DA_OBRA = '120363000000000002@g.us';

function recado(parcial: Partial<MensagemRecebida>): MensagemRecebida {
  return {
    de: '5583999990000',
    texto: 'oi',
    idMensagem: 'M' + Math.random().toString(36).slice(2),
    recebidaEm: new Date(),
    grupo: null,
    responderPara: '5583999990000@s.whatsapp.net',
    deMim: false,
    comigoMesmo: false,
    ...parcial,
  };
}

async function quantasMensagens(): Promise<number> {
  return banco.mensagemEnviada.count();
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
    exigirNomeEmGrupo: true,
    responderNoPrivado: true,
  });

  await banco.grupoWhatsApp.create({
    data: { jid: GRUPO_ALHEIO, nome: 'Ofertas de hardware', liberado: false },
  });

  await banco.grupoWhatsApp.create({
    data: { jid: GRUPO_DA_OBRA, nome: 'Obra Porto Belo', liberado: true },
  });
});

after(encerrar);

describe('Mensagem de grupo que ninguém liberou', () => {
  it('NÃO entra no banco da empresa', async () => {
    const antes = await quantasMensagens();

    const r = await atender(
      recado({
        texto: 'Memória Corsair 16GB por R$ 349, só hoje!',
        grupo: { jid: GRUPO_ALHEIO },
        responderPara: GRUPO_ALHEIO,
      }),
    );

    assert.equal(r.ignorado, 'grupo-nao-liberado');
    assert.equal(await quantasMensagens(), antes, 'gravou conversa de grupo alheio');
  });

  it('e um grupo NUNCA ESCOLHIDO não vira nem linha na tabela', async () => {
    //  Mudou em 14/10/2026. Antes, todo grupo de onde chegasse
    //  mensagem era anotado, para a tela poder liberá-lo depois —
    //  e num celular pessoal a tela da empresa foi se enchendo com
    //  "Planejamento de Casamento" e "Faculdade".
    //
    //  Agora quem administra ESCOLHE o grupo numa lista vinda do
    //  próprio WhatsApp. O que não foi escolhido não existe aqui.
    const antes = await banco.grupoWhatsApp.count();

    const r = await atender(
      recado({
        texto: 'alguém viu o churrasco de sábado?',
        grupo: { jid: '120363000000000099@g.us' },
        responderPara: '120363000000000099@g.us',
      }),
    );

    assert.equal(r.ignorado, 'grupo-nao-liberado');
    assert.equal(await banco.grupoWhatsApp.count(), antes, 'anotou um grupo que ninguém escolheu');
  });
});

describe('Mensagem de grupo liberado, mas sem chamar pelo nome', () => {
  it('também NÃO entra no banco', async () => {
    //  Num grupo de obra passam dezenas de mensagens por dia que
    //  não são com ele. Guardar todas seria o mesmo problema, só
    //  que dentro de casa.
    const antes = await quantasMensagens();

    const r = await atender(
      recado({
        texto: 'o caminhão chegou agora, descarregando',
        grupo: { jid: GRUPO_DA_OBRA },
        responderPara: GRUPO_DA_OBRA,
      }),
    );

    assert.equal(r.ignorado, 'nao-chamaram');
    assert.equal(await quantasMensagens(), antes, 'gravou conversa que não era com ele');
  });
});

describe('Mensagem dirigida a ele', () => {
  it('no GRUPO ESCOLHIDO, é atendida mesmo de quem não tem cadastro', async () => {
    //  Decisão dele em 14/10/2026: no grupo, quem autoriza é a
    //  SALA, não a pessoa. A resposta aparece para todo mundo que
    //  está lá — atender o cadastrado e calar para o colega ao
    //  lado seria teatro, já que o mesmo texto chega aos mesmos
    //  olhos.
    const antes = await quantasMensagens();

    const r = await atender(
      recado({
        texto: 'Vigo, tem cotação aberta?',
        grupo: { jid: GRUPO_DA_OBRA },
        responderPara: GRUPO_DA_OBRA,
        nomeDeExibicao: 'Diego',
      }),
    );

    assert.notEqual(r.ignorado, 'nao-e-da-casa', 'no grupo escolhido, atende quem perguntar');
    assert.ok(await quantasMensagens() > antes, 'a conversa precisa ficar registrada');
  });

  it('no PRIVADO, continua valendo o cadastro', async () => {
    //  Aqui não há sala nenhuma autorizando: é um número
    //  desconhecido falando direto com a ferramenta da empresa.
    const antes = await quantasMensagens();

    const r = await atender(recado({ texto: 'quantos fornecedores vocês têm?' }));

    assert.equal(r.ignorado, 'nao-e-da-casa');
    assert.equal(await quantasMensagens(), antes + 1, 'o que é dirigido a ele precisa ficar');
  });
});
