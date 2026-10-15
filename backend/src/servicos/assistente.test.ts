// ============================================================
//  O ASSISTENTE — a mecânica
//
//  O que se prova aqui é o que é NOSSO: a peneira do que chega,
//  o reconhecimento de número e o ciclo pergunta → ferramenta →
//  resposta.
//
//  O que NÃO se prova aqui é a qualidade do texto. Modelo de
//  linguagem não responde igual duas vezes, e um teste que
//  conferisse a frase quebraria sozinho na terça seguinte sem
//  ninguém ter mexido em nada. Para OLHAR a qualidade existe
//  `testes/manual-assistente.ts`, que pergunta de verdade.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { peneirar } from '../integracoes/whatsapp/adaptador.baileys.js';
import { formasDoNumero, instrucoes } from './assistente.js';
import { chamaramPeloNome } from './atendimento.js';

const DE_FORA = { remoteJid: '5583999998888@s.whatsapp.net', fromMe: false, id: 'A1' };

describe('A peneira do que chega', () => {
  it('deixa passar a mensagem de uma pessoa', () => {
    const r = peneirar({ key: DE_FORA, message: { conversation: 'O pedido saiu?' } });

    assert.ok(r);
    assert.equal(r.de, '5583999998888');
    assert.equal(r.texto, 'O pedido saiu?');
  });

  it('IGNORA o dono conversando com TERCEIRO', () => {
    //  Tudo que sai do celular conectado vem marcado como "minha".
    //  Mas isso é três coisas: a resposta do próprio sistema, o
    //  dono perguntando, e o dono conversando com a esposa ou com
    //  um fornecedor. Esta última não é assunto do assistente, e
    //  lê-la seria bisbilhotar conversa alheia.
    const r = peneirar(
      { key: { ...DE_FORA, fromMe: true }, message: { conversation: 'chego em 20 minutos' } },
      undefined,
      '5511888887777@s.whatsapp.net',
    );

    assert.equal(r, null);
  });

  it('ACEITA o dono falando na conversa consigo mesmo', () => {
    //  É assim que ele testa: "Mensagem para mim", no próprio
    //  WhatsApp. Antes caía na peneira do `fromMe` junto com tudo
    //  mais, e ele não conseguia falar com o próprio assistente.
    const r = peneirar(
      {
        key: { remoteJid: '5583993952248@s.whatsapp.net', fromMe: true, id: 'E1' },
        message: { conversation: 'Vigo, tem cotação aberta?' },
      },
      undefined,
      '5583993952248:9@s.whatsapp.net',
    );

    assert.ok(r, 'o dono precisa conseguir falar com o próprio assistente');
    assert.equal(r.deMim, true);
    assert.equal(r.comigoMesmo, true);
  });

  it('ACEITA o dono falando no grupo SEM o campo de participante', () => {
    //  Quando a mensagem é sua, o WhatsApp às vezes não preenche
    //  `participant` — do ponto de vista dele, obviamente foi
    //  você. Sem o remendo, a própria mensagem no grupo ficava sem
    //  remetente e morria na peneira: foi por isso que o
    //  assistente ficou mudo no primeiro teste em grupo.
    const r = peneirar(
      {
        key: { remoteJid: '120363000000000000@g.us', fromMe: true, id: 'E3' },
        message: { conversation: 'Vigo, tem cotação aberta?' },
      },
      undefined,
      '5583993952248:9@s.whatsapp.net',
    );

    assert.ok(r, 'a própria mensagem no grupo precisa chegar');
    assert.equal(r.de, '5583993952248', 'sem participante, quem falou é o dono do número');
  });

  it('ACEITA o dono falando no grupo', () => {
    //  Ele também trabalha na empresa: se o assistente roda no
    //  celular dele, calar justo ele seria o cúmulo.
    const r = peneirar(
      {
        key: {
          remoteJid: '120363000000000000@g.us',
          fromMe: true,
          id: 'E2',
          participant: '5583993952248@s.whatsapp.net',
        },
        message: { conversation: 'Vigo, quem assina acima de 15 mil?' },
      },
      undefined,
      '5583993952248@s.whatsapp.net',
    );

    assert.ok(r);
    assert.equal(r.deMim, true);
    assert.equal(r.grupo?.jid, '120363000000000000@g.us');
    assert.equal(r.de, '5583993952248', 'em grupo, quem fala é o participante');
  });

  it('ACEITA grupo, e marca de qual', () => {
    //  Grupo deixou de ser barrado em 14/10/2026: o assistente é
    //  ferramenta interna e o grupo de trabalho é onde o pessoal
    //  pergunta. Quem decide se ele RESPONDE ali é o atendimento —
    //  grupo liberado, e chamado pelo nome.
    const r = peneirar({
      key: {
        remoteJid: '120363000000000000@g.us',
        fromMe: false,
        id: 'B1',
        participant: '5583999998888@s.whatsapp.net',
      },
      message: { conversation: 'alguém viu o cimento?' },
    });

    assert.ok(r);
    assert.equal(r.grupo?.jid, '120363000000000000@g.us');
    assert.equal(r.responderPara, '120363000000000000@g.us', 'responde no grupo');
  });

  it('IGNORA status e transmissão', () => {
    const r = peneirar({
      key: { remoteJid: 'status@broadcast', fromMe: false, id: 'C1' },
      message: { conversation: 'bom dia a todos' },
    });

    assert.equal(r, null);
  });

  it('IGNORA o que não tem texto', () => {
    //  Figurinha, áudio e foto sem legenda. Responder "não
    //  entendi" a cada figurinha é pior do que ficar quieto.
    assert.equal(peneirar({ key: DE_FORA, message: {} }), null);
    assert.equal(peneirar({ key: DE_FORA, message: null }), null);
    assert.equal(peneirar({ key: DE_FORA, message: { conversation: '   ' } }), null);
  });

  it('lê a legenda de uma foto, que É pergunta', () => {
    const r = peneirar({
      key: DE_FORA,
      message: { imageMessage: { caption: 'é esta a nota do PC-00001?' } },
    });

    assert.ok(r);
    assert.match(r.texto, /PC-00001/);
  });

  it('tira o sufixo de dispositivo do número', () => {
    const r = peneirar({
      key: { remoteJid: '5583999998888:12@s.whatsapp.net', fromMe: false, id: 'D1' },
      message: { conversation: 'oi' },
    });

    assert.equal(r?.de, '5583999998888');
  });
});

describe('O nono dígito', () => {
  //  Em 11/10/2026 uma mensagem foi para o número errado porque o
  //  WhatsApp guardava `558393952248` e o cadastro tinha
  //  `5583993952248` — a mesma pessoa, doze e treze dígitos. Sem
  //  tolerar isso, o fornecedor certo entra como estranho — e
  //  estranho não vê nada.
  it('o número com 9 também vale sem o 9', () => {
    const formas = formasDoNumero('5583993952248');

    assert.ok(formas.includes('5583993952248'));
    assert.ok(formas.includes('558393952248'), 'faltou a forma sem o nono dígito');
  });

  it('o número sem 9 também vale com o 9', () => {
    const formas = formasDoNumero('558393952248');

    assert.ok(formas.includes('5583993952248'), 'faltou a forma com o nono dígito');
  });

  it('as duas formas se encontram', () => {
    const a = formasDoNumero('5583993952248');
    const b = formasDoNumero('558393952248');

    assert.ok(a.some((x) => b.includes(x)), 'são a mesma pessoa e precisam se cruzar');
  });

  it('número vazio não vira forma nenhuma', () => {
    assert.deepEqual(formasDoNumero(''), []);
    assert.deepEqual(formasDoNumero('abc'), []);
  });
});

describe('A saudação é uma vez por conversa', () => {
  //  Num grupo ela estava abrindo TODA resposta com "boa tarde",
  //  inclusive a terceira seguida para a mesma pessoa. Ninguém
  //  cumprimenta o colega três vezes em dois minutos.
  //
  //  Quem decide se já houve cumprimento é o banco, não o modelo:
  //  por isso a instrução muda de fora para dentro.
  const alguem = { tipo: 'equipe' as const, usuarioId: 'u1', nome: 'Diego' };

  it('na primeira mensagem, manda cumprimentar uma vez', () => {
    const texto = instrucoes(alguem, { jaCumprimentou: false });

    assert.match(texto, /primeira mensagem desta pessoa/);
    assert.match(texto, /Cumprimente UMA vez/);
  });

  it('com a conversa em andamento, PROÍBE cumprimentar de novo', () => {
    const texto = instrucoes(alguem, { jaCumprimentou: true });

    assert.match(texto, /NÃO cumprimente de novo/);
    assert.doesNotMatch(texto, /Cumprimente UMA vez/);
  });

  it('e manda encerrar curto quando agradecem', () => {
    const texto = instrucoes(alguem);

    assert.match(texto, /agradecer e não perguntar mais nada/);
  });
});

describe('As instruções mudam com quem pergunta', () => {
  it('a equipe é avisada de que vê tudo', () => {
    const texto = instrucoes({ tipo: 'equipe', usuarioId: 'u1', nome: 'Leonardo' });

    assert.match(texto, /Leonardo/);
    assert.match(texto, /Pode ver tudo/);
  });

  it('o fornecedor é avisado de que só vê o dele', () => {
    const texto = instrucoes({ tipo: 'fornecedor', fornecedorId: 'f1', nome: 'Marquilip' });

    assert.match(texto, /FORNECEDOR/);
    assert.match(texto, /concorrente/);
  });

  it('o desconhecido não recebe NEM a lista de assuntos', () => {
    //  Dizer a um estranho "costumam me perguntar sobre cotações,
    //  pedidos e contas a pagar" já entrega que existe cotação,
    //  pedido e conta a pagar. A ele o prompt é outro, curto.
    const texto = instrucoes({ tipo: 'desconhecido', nome: 'desconhecido' });

    assert.match(texto, /NÃO CADASTRADO/);
    assert.doesNotMatch(texto, /O QUE COSTUMAM PERGUNTAR/);
    assert.match(texto, /Não confirme nem negue/);
  });
});

describe('Chamar pelo nome', () => {
  //  A ideia veio da reunião de 14/10/2026: a IA do chefe dele
  //  atende por "Faísca", e quem quer falar com ela diz o nome.
  //  É como as pessoas já conversam — ninguém marca ninguém com
  //  `@` no meio de uma conversa de trabalho.

  it('acorda quando dizem o nome', () => {
    assert.ok(chamaramPeloNome('Faisca, tem cotação aberta?', 'Faisca'));
    assert.ok(chamaramPeloNome('alguém pergunta pra Faisca aí', 'Faisca'));
  });

  it('não liga para acento nem para maiúscula', () => {
    assert.ok(chamaramPeloNome('FAÍSCA quantos fornecedores temos?', 'Faisca'));
    assert.ok(chamaramPeloNome('faísca, e o pedido?', 'FAISCA'));
  });

  it('NÃO acorda com a palavra dentro de outra', () => {
    //  É aqui que um robô vira praga no grupo: um assistente
    //  chamado "Porto" que acorda com "importante" responde o dia
    //  inteiro sem ninguém ter chamado.
    assert.equal(chamaramPeloNome('o material e importante', 'Porto'), false);
    assert.equal(chamaramPeloNome('faiscas de solda', 'Faisca'), false);
    assert.equal(chamaramPeloNome('comprei no porto alegre store', 'Port'), false);
  });

  it('NÃO acorda em conversa que não é com ele', () => {
    assert.equal(chamaramPeloNome('bom dia pessoal', 'Faisca'), false);
    assert.equal(chamaramPeloNome('', 'Faisca'), false);
  });

  it('nome vazio não acorda com nada', () => {
    assert.equal(chamaramPeloNome('Faisca, oi', '  '), false);
  });

  it('nome com pontuação não vira expressão regular por acidente', () => {
    //  Um nome como "F.A." tem ponto, que em expressão regular
    //  significa "qualquer letra". Sem escapar, ele acordaria com
    //  qualquer coisa.
    assert.ok(chamaramPeloNome('F.A. me diz o saldo', 'F.A.'));
    assert.equal(chamaramPeloNome('FXAY me diz o saldo', 'F.A.'), false);
  });
});
