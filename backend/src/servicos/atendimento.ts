// ============================================================
//  O ATENDIMENTO
//
//  O caminho inteiro de uma mensagem que chega:
//
//    chegou → já vi? → é áudio? transcrevo → gravo
//           → é para mim? → quem falou é da casa?
//           → pensa → gravo o que ele diria
//           → mando, OU guardo como rascunho
//
//  É FERRAMENTA INTERNA. Quem conversa com ele é gente da Porto
//  Inc. — reconhecida pelo TELEFONE do cadastro. Quem não está no
//  sistema não é atendido: não é canal de atendimento.
//
//  E O NÚMERO É SEMPRE O DO QR. Não existe número escrito em
//  lugar nenhum: quem atende é a sessão conectada.
// ============================================================

import { banco } from '../plugins/banco.js';
import { integracoes } from '../integracoes/index.js';
import { responder, identificar } from './assistente.js';
import type { QuemPergunta } from './assistente-ferramentas.js';
import { cerebro } from './configuracao-ia.js';
import type { MensagemRecebida } from '../integracoes/whatsapp/porta.js';
import type { TurnoIA } from '../integracoes/ia/porta.js';

/**
 * QUANTAS MENSAGENS DE TRÁS ELA ENXERGA.
 *
 * Seis é conversa; sessenta é a conta do mês. Cada turno antigo
 * viaja junto em toda pergunta nova, então memória longa fica
 * cara depressa — e o modelo começa a responder ao assunto de
 * ontem.
 */
const LEMBRA = 6;

/**
 * E por quanto tempo.
 *
 * Duas horas depois, "sim" não responde mais a nada: a pessoa
 * mudou de assunto, de dia, às vezes de obra. Memória velha é
 * pior do que memória nenhuma, porque parece certa.
 */
const ESQUECE_DEPOIS_DE = 2 * 60 * 60 * 1000;

/**
 * POR QUANTO TEMPO A CONVERSA CONTINUA SENDO COM ELE.
 *
 * Cinco minutos. Quem acabou de perguntar e recebeu resposta não
 * repete o nome na frase seguinte — ninguém faz isso falando com
 * gente. Mas o crédito não pode durar a tarde inteira: meia hora
 * depois, qualquer frase solta no grupo voltaria a acordá-lo.
 */
const AINDA_COMIGO = 5 * 60 * 1000;

/**
 * E POR QUANTO TEMPO ELA AINDA É A MESMA CONVERSA.
 *
 * Uma hora. Serve para a SAUDAÇÃO: quem já foi cumprimentado há
 * dez minutos não precisa de "boa tarde" outra vez, mas quem
 * volta à tarde depois de falar de manhã, sim.
 *
 * É maior do que o crédito de continuar sem dizer o nome, e por
 * um bom motivo: deixar de cumprimentar é inofensivo; responder
 * uma frase solta que não era com ele, não.
 */
const MESMA_CONVERSA = 60 * 60 * 1000;

/** Ignora texto gigante: não é pergunta, é despejo. */
const LIMITE_DE_TEXTO = 1500;

/**
 * Já tratei esta mensagem?
 *
 * O Baileys reentrega o mesmo lote quando a conexão oscila. Sem
 * esta trava, uma reconexão faria o assistente responder tudo de
 * novo.
 */
async function jaVista(idMensagem: string): Promise<boolean> {
  if (!idMensagem) return false;

  const existe = await banco.mensagemEnviada.findFirst({
    where: { idMensagem, direcao: 'ENTRADA' },
    select: { id: true },
  });

  return existe !== null;
}

/**
 * Quantas mensagens esta pessoa mandou na última hora.
 *
 * Devolve o número, e não um sim/não, porque o PRIMEIRO estouro
 * merece tratamento diferente dos seguintes — ver abaixo.
 */
async function quantasNaUltimaHora(numero: string): Promise<number> {
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);

  return banco.mensagemEnviada.count({
    where: { numero, direcao: 'ENTRADA', criadoEm: { gte: umaHoraAtras } },
  });
}

/**
 * CHAMARAM PELO NOME?
 *
 * A ideia veio da reunião de 14/10/2026: a IA do chefe dele
 * atende por "Faísca", e quem quer falar com ela diz o nome. É
 * como as pessoas já conversam — ninguém marca ninguém com `@`
 * no meio de uma conversa de trabalho.
 *
 * A comparação ignora acento e maiúscula, e exige a palavra
 * INTEIRA: um assistente chamado "Porto" não pode acordar com
 * "importante", e é exatamente nesse tipo de detalhe que um
 * robô vira praga no grupo.
 */
export function chamaramPeloNome(texto: string, nome: string): boolean {
  const limpar = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();

  const alvo = limpar(nome.trim());
  if (!alvo) return false;

  //  Escapa o que for símbolo no nome, para um nome com ponto ou
  //  parêntese não virar expressão regular por acidente.
  const seguro = alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return new RegExp('(^|[^\\p{L}\\p{N}])' + seguro + '($|[^\\p{L}\\p{N}])', 'u').test(
    limpar(texto),
  );
}

/**
 * ESTE GRUPO FOI ESCOLHIDO NA ÁREA IA?
 *
 * Mudou em 14/10/2026. Antes, todo grupo de onde chegasse
 * mensagem era ANOTADO no banco, para a tela poder liberá-lo
 * depois. Funcionava, mas num celular pessoal a tela da empresa
 * ia se enchendo com o grupo da família e o das ofertas de
 * hardware — e o sistema guardava o nome de cada um deles.
 *
 * Agora é o contrário: quem administra ESCOLHE o grupo numa
 * lista, e só o escolhido existe aqui. Grupo que não foi
 * escolhido não vira linha, não vira nome e não vira registro.
 */
async function grupoEscolhido(jid: string): Promise<boolean> {
  const grupo = await banco.grupoWhatsApp.findUnique({
    where: { jid },
    select: { liberado: true },
  });

  return grupo?.liberado === true;
}

/**
 * ESTA MENSAGEM FOI O SISTEMA QUE MANDOU?
 *
 * A trava contra o laço infinito, e ela é por IDENTIFICADOR, não
 * por "veio do próprio número". A diferença importa: o dono do
 * celular também fala pelo próprio número, e ele é gente da
 * empresa com todo direito de perguntar.
 *
 * Toda resposta que sai é gravada com o id que o WhatsApp
 * devolve. Se o id bate, fomos nós — e aí não se responde.
 */
async function foiOSistemaQueMandou(idMensagem: string): Promise<boolean> {
  if (!idMensagem) return false;

  const nossa = await banco.mensagemEnviada.findFirst({
    where: { idMensagem, direcao: 'SAIDA' },
    select: { id: true },
  });

  return nossa !== null;
}

/**
 * A CONVERSA AINDA É COM ELE?
 *
 * No grupo, o nome é o que acorda o assistente. Mas depois que ele
 * responde, exigir o nome de novo em cada frase é esquisito: a
 * pessoa pergunta "Vigo, quais os fornecedores", ele responde, ela
 * emenda "e quantos atendem elétrica?" — e cai no vazio.
 *
 * Então vale um crédito curto: se ele JÁ RESPONDEU A ESTA PESSOA,
 * NESTE GRUPO, nos últimos minutos, a frase seguinte dela continua
 * sendo com ele.
 *
 * As três condições juntas importam. Só o tempo deixaria qualquer
 * um acordá-lo; só a pessoa valeria para sempre; e sem o grupo, a
 * conversa de uma sala abriria porta noutra.
 */
async function jaRespondiEssaPessoa(
  recado: MensagemRecebida,
  janela: number,
): Promise<boolean> {
  const resposta = await banco.mensagemEnviada.findFirst({
    where: {
      contexto: 'assistente',
      direcao: 'SAIDA',
      //  Só o que SAIU de fato. Rascunho e falha não chegaram a
      //  ninguém, então ninguém está respondendo a eles.
      situacao: 'ENVIADA',
      referencia: recado.grupo?.jid ?? null,
      criadoEm: { gte: new Date(Date.now() - janela) },
      respondeA: { numero: recado.de },
    },
    select: { id: true },
  });

  return resposta !== null;
}

/**
 * Ja avisei esta conversa de que estou fora do ar?
 *
 * Dez minutos. Serve para o aviso sair UMA vez por conversa, e nao
 * a cada pergunta: quando o provedor cai, costumam cair todas as
 * perguntas seguidas.
 */
async function jaAvisouDaFalha(recado: MensagemRecebida): Promise<boolean> {
  const falha = await banco.mensagemEnviada.findFirst({
    where: {
      contexto: 'assistente',
      direcao: 'SAIDA',
      situacao: 'FALHOU',
      referencia: recado.grupo?.jid ?? null,
      criadoEm: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
    select: { id: true },
  });

  return falha !== null;
}

/**
 * SEGUNDA TRAVA: O TEXTO É IDÊNTICO AO QUE EU ACABEI DE MANDAR?
 *
 * A primeira trava é o identificador. Ela é a certa — e falhou em
 * 14/10/2026 porque o identificador não estava sendo gravado.
 *
 * Esta existe justamente para o dia em que a primeira falhar de
 * novo, por outro motivo: provedor que não devolve id, mensagem
 * reenviada com id novo, qualquer coisa. Ela não depende de
 * ninguém: compara o TEXTO.
 *
 * Uma pessoa repetir palavra por palavra o que o assistente
 * acabou de dizer é raro; um laço faz isso toda vez.
 */
async function ehEcoDoQueEuDisse(recado: MensagemRecebida, texto: string): Promise<boolean> {
  if (!texto.trim()) return false;

  const igual = await banco.mensagemEnviada.findFirst({
    where: {
      contexto: 'assistente',
      direcao: 'SAIDA',
      referencia: recado.grupo?.jid ?? null,
      texto: texto.trim(),
      criadoEm: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    select: { id: true },
  });

  return igual !== null;
}

/**
 * TERCEIRA TRAVA: O DISJUNTOR.
 *
 * As duas primeiras olham a mensagem; esta olha o RITMO. Nenhuma
 * conversa de gente tem o assistente falando seis vezes no mesmo
 * minuto na mesma sala — laço tem, e é a primeira coisa que ele
 * faz.
 *
 * É a trava que não depende de eu ter previsto o motivo do laço.
 * Se as outras duas falharem por algo que ninguém imaginou, esta
 * corta em segundos, antes de o WhatsApp notar.
 */
const TETO_POR_MINUTO = 5;

async function disjuntorAbriu(recado: MensagemRecebida): Promise<boolean> {
  const quantas = await banco.mensagemEnviada.count({
    where: {
      contexto: 'assistente',
      direcao: 'SAIDA',
      situacao: 'ENVIADA',
      referencia: recado.grupo?.jid ?? null,
      criadoEm: { gte: new Date(Date.now() - 60 * 1000) },
    },
  });

  return quantas >= TETO_POR_MINUTO;
}

export type MotivoDeIgnorar =
  | 'repetida'
  | 'excesso'
  | 'longa'
  | 'sem-ia'
  | 'desligada'
  | 'grupo-nao-liberado'
  | 'nao-chamaram'
  | 'privado-desligado'
  | 'nao-e-da-casa'
  | 'audio-sem-texto'
  | 'resposta-minha'
  | 'eco'
  | 'disjuntor';

export interface ResultadoDoAtendimento {
  ignorado?: MotivoDeIgnorar;
  entradaId?: string;
  respostaId?: string;
  enviada?: boolean;
  texto?: string;
}

/**
 * O que já foi dito nesta conversa, do mais antigo ao mais novo.
 *
 * A conversa é a do GRUPO quando veio de grupo — lá o assunto é
 * coletivo, e a pergunta de um costuma continuar a do outro.
 */
async function conversaAnterior(recado: MensagemRecebida): Promise<TurnoIA[]> {
  const desde = new Date(Date.now() - ESQUECE_DEPOIS_DE);

  const linhas = await banco.mensagemEnviada.findMany({
    where: {
      contexto: 'assistente',
      criadoEm: { gte: desde },
      ...(recado.grupo ? { referencia: recado.grupo.jid } : { numero: recado.de, referencia: null }),
      //  Só o que foi DITO. Rascunho não saiu, então para quem
      //  está do outro lado ele nunca existiu — e fingir que a
      //  pessoa leu algo que não chegou faz a conversa desandar.
      situacao: { in: ['RECEBIDA', 'ENVIADA'] },
    },
    orderBy: { criadoEm: 'desc' },
    take: LEMBRA,
    select: { texto: true, direcao: true },
  });

  return linhas
    .reverse()
    .map((l): TurnoIA =>
      l.direcao === 'ENTRADA'
        ? { papel: 'pessoa', texto: l.texto }
        : { papel: 'assistente', texto: l.texto },
    );
}

export async function atender(recado: MensagemRecebida): Promise<ResultadoDoAtendimento> {
  if (await jaVista(recado.idMensagem)) return { ignorado: 'repetida' };

  //  A TRAVA DO LACO, antes de qualquer outra coisa.
  //
  //  Se foi o sistema que mandou, nao se responde. Note que a
  //  pergunta nao e "veio do proprio numero?" — e "fui eu?". Quem
  //  digita no celular conectado e o dono, e ele trabalha aqui.
  if (recado.deMim && (await foiOSistemaQueMandou(recado.idMensagem))) {
    return { ignorado: 'resposta-minha' };
  }

  //  A SEGUNDA TRAVA, para quando a primeira falhar.
  //
  //  Só vale para o que saiu do próprio número: pessoa repetindo o
  //  que ela disse é raro, mas possível, e não é motivo para
  //  ignorar gente.
  if (recado.deMim && (await ehEcoDoQueEuDisse(recado, recado.texto))) {
    console.log('[assistente] eco da própria resposta — ignorado');
    return { ignorado: 'eco' };
  }

  const c = cerebro();

  //  SÓ OS GRUPOS ESCOLHIDOS NA ÁREA IA EXISTEM AQUI.
  //
  //  Quem administra escolhe numa lista vinda do próprio WhatsApp.
  //  Grupo não escolhido nem é anotado — e é assim que a tela da
  //  empresa para de listar o grupo da família.
  let grupoLiberado = false;
  let nomeDoGrupo: string | null = null;

  if (recado.grupo) {
    //  O RELOGIO DO GRUPO ANDA A CADA MENSAGEM, seja ela para o
    //  assistente ou nao.
    //
    //  So o HORARIO, nunca o conteudo: conversa que nao e com ele
    //  continua fora do banco da empresa. Mas sem esta marca nao
    //  ha como saber que o assunto andou — e a repescagem
    //  responderia uma pergunta velha no meio de outra conversa.
    //
    //  `updateMany` de proposito: em grupo que ninguem escolheu
    //  nao existe linha, e isto vira um nada.
    await banco.grupoWhatsApp.updateMany({
      where: { jid: recado.grupo.jid },
      data: { vistoEm: new Date() },
    });

    grupoLiberado = await grupoEscolhido(recado.grupo.jid);

    if (grupoLiberado) {
      nomeDoGrupo = (
        await banco.grupoWhatsApp.findUnique({
          where: { jid: recado.grupo.jid },
          select: { nome: true },
        })
      )?.nome ?? null;
    }
  }

  // ============================================================
  //  PRIMEIRO DECIDE, DEPOIS GRAVA
  //
  //  Esta ordem é uma correção de 14/10/2026, e ela é de
  //  privacidade, não de desempenho.
  //
  //  Antes, TODA mensagem que chegava era gravada e só depois o
  //  sistema decidia se era para ele. Como o assistente roda no
  //  celular de uma pessoa, isso significava guardar no banco da
  //  empresa a conversa dos grupos pessoais dela — pauta de
  //  ofertas, conversa de amigos, o que fosse.
  //
  //  Agora nada é gravado antes de a mensagem ser, de fato, para o
  //  assistente. O que sobra registrado é só o que foi dirigido a
  //  ele — e isso basta para explicar qualquer resposta depois.
  // ============================================================

  //  Grupo que ninguém liberou: o sistema anotou o grupo (para a
  //  tela poder liberá-lo um dia) e esquece o resto. Nem o áudio
  //  se baixa.
  if (recado.grupo && !grupoLiberado) return { ignorado: 'grupo-nao-liberado' };

  if (!recado.grupo && !c.responderNoPrivado) return { ignorado: 'privado-desligado' };

  //  ÁUDIO VIRA TEXTO ANTES DE QUALQUER COISA, porque sem o texto
  //  não dá para saber nem se chamaram pelo nome.
  let texto = recado.texto;

  if (recado.audio && c.transcreverAudio && c.ativo) {
    const conteudo = await recado.audio.baixar();

    if (!conteudo) {
      //  DUAS FALHAS DIFERENTES, DOIS RECADOS DIFERENTES.
      //
      //  "Não baixou" e "baixou e não entendi" pedem conserto em
      //  lugares opostos — um é da biblioteca do WhatsApp, o outro
      //  é do transcritor. Um log só para os dois faria perder uma
      //  rodada inteira de tentativa.
      console.log('[assistente] áudio: não consegui baixar o arquivo');
    } else if (typeof integracoes.ia.transcrever === 'function') {
      const falado = await integracoes.ia.transcrever(conteudo, recado.audio.tipoMime);

      if (falado) texto = falado;
      else console.log('[assistente] áudio: baixei ' + conteudo.length + ' bytes, mas não transcrevi');
    }
  }

  //  No grupo, sem o nome não é com ele — a menos que a conversa
  //  já esteja rolando. E conversa de grupo que não é com ele não
  //  entra no banco da empresa.
  if (recado.grupo && c.exigirNomeEmGrupo && !chamaramPeloNome(texto, c.nome)) {
    const emendando = await jaRespondiEssaPessoa(recado, AINDA_COMIGO);
    if (!emendando) return { ignorado: 'nao-chamaram' };
  }

  if (!texto.trim()) return { ignorado: 'audio-sem-texto' };

  // ---------- Daqui para baixo, a mensagem É para ele ----------

  const anteriores = await conversaAnterior(recado);

  const entrada = await banco.mensagemEnviada.create({
    data: {
      numero: recado.de,
      texto: texto.slice(0, 4000),
      situacao: 'RECEBIDA',
      direcao: 'ENTRADA',
      adaptador: integracoes.whatsapp.nome,
      contexto: 'assistente',
      idMensagem: recado.idMensagem || null,
      //  Em grupo, quem mandou É UMA PESSOA; o grupo é o lugar.
      //  Guardar os dois ajuda a ler o histórico depois.
      destino: recado.grupo
        ? (nomeDoGrupo ?? 'grupo') + (recado.nomeDeExibicao ? ' · ' + recado.nomeDeExibicao : '')
        : (recado.nomeDeExibicao ?? null),
      referencia: recado.grupo?.jid ?? null,
    },
  });

  const parar = (ignorado: MotivoDeIgnorar) => ({ ignorado, entradaId: entrada.id });

  if (!c.ativo) return parar('desligada');
  if (texto.length > LIMITE_DE_TEXTO) return parar('longa');
  //  O LIMITE AVISA UMA VEZ, DEPOIS CALA.
  //
  //  Emudecer sem explicar e o pior dos dois mundos: quem esta do
  //  outro lado nao sabe se o sistema caiu, se a pergunta estava
  //  errada ou se foi ignorado. Aconteceu em 14/10/2026, testando.
  //
  //  Mas avisar a cada mensagem seria trocar um silencio ruim por
  //  um papagaio: se a pessoa (ou o robo) esta disparando, a
  //  resposta nao pode disparar junto. Por isso o aviso sai so na
  //  PRIMEIRA que passa do teto; da segunda em diante, silencio.
  //  ZERO QUER DIZER SEM LIMITE.
  //
  //  Pedido dele em 14/10/2026, para poder por o assistente a
  //  prova sem o teto atrapalhando. A trava que REALMENTE impede
  //  laco infinito e outra e continua de pe: a que reconhece a
  //  propria mensagem pelo identificador. O que se perde aqui e a
  //  defesa contra enxurrada — de robo, ou de gente nervosa — e o
  //  custo em token que ela traz.
  const quantas = c.limitePorHora > 0 ? await quantasNaUltimaHora(recado.de) : 0;

  if (c.limitePorHora > 0 && quantas > c.limitePorHora) {
    if (quantas === c.limitePorHora + 1) {
      await integracoes.whatsapp.enviar({
        para: recado.responderPara,
        texto:
          'Recebi muitas mensagens suas na última hora e vou dar uma pausa. ' +
          'Daqui a pouco volto a responder.',
      });
    }

    return parar('excesso');
  }
  if (!integracoes.ia.pronto()) return parar('sem-ia');

  // ---------- Quem falou pode ser atendido? ----------
  const reconhecido = await identificar(recado.de);

  //  NO GRUPO ESCOLHIDO, QUEM AUTORIZA É O GRUPO.
  //
  //  Decisão dele em 14/10/2026, e ela é coerente: a resposta no
  //  grupo aparece para TODO MUNDO que está lá dentro. Atender o
  //  cadastrado e calar para o colega ao lado seria teatro — o
  //  mesmo texto chega aos mesmos olhos de qualquer jeito.
  //
  //  Então o limite deixa de ser a pessoa e passa a ser a SALA.
  //  Escolher um grupo na Área IA é dizer "o que o sistema sabe
  //  pode ser dito aqui" — e é por isso que escolher um grupo é um
  //  ato consciente, um a um.
  //
  //  No PRIVADO continua valendo o cadastro: lá não há sala
  //  nenhuma autorizando, só um número desconhecido perguntando.
  const quem: QuemPergunta =
    reconhecido.tipo === 'equipe'
      ? reconhecido
      : recado.grupo
        ? {
            tipo: 'equipe',
            usuarioId: '',
            //  Sem cadastro, o nome é o que o WhatsApp mostra. É o
            //  bastante para ela cumprimentar como gente.
            nome: recado.nomeDeExibicao ?? 'colega',
          }
        : reconhecido;

  if (quem.tipo !== 'equipe') return parar('nao-e-da-casa');

  //  A memória é lida ANTES de gravar a pergunta de agora, senão
  //  a última linha da conversa seria a própria pergunta, repetida.
  //  SAUDAÇÃO É UMA VEZ POR PESSOA, POR CONVERSA.
  //
  //  Quem decide é o banco, não o modelo: se já saiu resposta para
  //  esta pessoa nesta conversa na última hora, ela já foi
  //  cumprimentada. Pedir ao modelo que "lembre" disso seria pedir
  //  que adivinhe — e foi assim que ela passou a abrir toda
  //  resposta com "boa tarde", inclusive a terceira seguida para a
  //  mesma pessoa.
  const jaCumprimentou = await jaRespondiEssaPessoa(recado, MESMA_CONVERSA);

  //  O PROVEDOR PODE RECUSAR, E ISSO NAO PODE VIRAR SILENCIO.
  //
  //  Em 14/10/2026 a cota diaria da Groq acabou no meio do teste —
  //  duzentos mil tokens — e o assistente simplesmente parou de
  //  responder. Do lado de fora, isso e indistinguivel de sistema
  //  quebrado: ninguem sabe se a pergunta se perdeu, se o WhatsApp
  //  caiu ou se foi ignorado.
  //
  //  Agora a recusa vira linha no banco E um recado curto, uma vez
  //  so. Repetir a cada mensagem transformaria uma falha chata num
  //  papagaio — e gastaria o que nao ha.
  let pensada;

  try {
    pensada = await responder(texto, quem, anteriores, { jaCumprimentou });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : 'o provedor não respondeu';

    //  A PERGUNTA VEM ANTES DO REGISTRO.
    //
    //  Invertido, ele encontraria a falha que acabou de gravar e
    //  concluiria que já havia avisado — ou seja, nunca avisaria.
    const precisaAvisar = !(await jaAvisouDaFalha(recado));

    await banco.mensagemEnviada.create({
      data: {
        numero: recado.responderPara.replace(/\D/g, '') || recado.de,
        texto: '(não foi possível responder)',
        situacao: 'FALHOU',
        direcao: 'SAIDA',
        adaptador: integracoes.whatsapp.nome,
        contexto: 'assistente',
        referencia: recado.grupo?.jid ?? null,
        respondeAId: entrada.id,
        erro: motivo.slice(0, 500),
      },
    });

    if (precisaAvisar) {
      await integracoes.whatsapp.enviar({
        para: recado.responderPara,
        texto:
          'Não consigo responder agora — o serviço de IA está indisponível. ' +
          'Assim que voltar, eu respondo.',
      });
    }

    console.log('[assistente] falhou: ' + motivo);
    return parar('sem-ia');
  }

  //  SE VAI SAIR, SAI ANTES DE GRAVAR: assim a linha no banco diz
  //  o que de fato aconteceu, e não o que a gente esperava.
  let enviada = false;
  let erro: string | null = null;
  //  O IDENTIFICADOR DA MENSAGEM QUE SAIU. É ELE que impede o laço.
  let idDaResposta: string | null = null;

  //  O DISJUNTOR, logo antes de falar.
  //
  //  Aqui, e não lá em cima, de propósito: o que precisa ser
  //  cortado é o ENVIO. Ler e pensar não aciona o WhatsApp, e é o
  //  envio em rajada que faz número ser banido.
  if (await disjuntorAbriu(recado)) {
    console.log('[assistente] DISJUNTOR: muitas respostas no mesmo minuto, parei');

    await banco.mensagemEnviada.create({
      data: {
        numero: recado.responderPara.replace(/\D/g, '') || recado.de,
        texto: pensada.texto,
        situacao: 'RASCUNHO',
        direcao: 'SAIDA',
        adaptador: integracoes.whatsapp.nome,
        contexto: 'assistente',
        referencia: recado.grupo?.jid ?? null,
        respondeAId: entrada.id,
        erro: 'Disjuntor: mais de ' + TETO_POR_MINUTO + ' respostas no mesmo minuto.',
      },
    });

    return parar('disjuntor');
  }

  //  LIGADO É LIGADO. O modo rascunho saiu em 14/10/2026: era
  //  mais uma chave para esquecer desligada, e foi exatamente o
  //  que aconteceu — o assistente no ar, pensando, e mudo.
  {
    const r = await integracoes.whatsapp.enviar({
      //  VOLTA PARA ONDE PERGUNTARAM. Perguntou no grupo, responde
      //  no grupo: esconder a resposta no privado seria tirar dela
      //  quem também queria saber.
      para: recado.responderPara,
      texto: pensada.texto,
    });

    enviada = r.sucesso;
    erro = r.erro ?? null;
    idDaResposta = r.idMensagem ?? null;
  }

  const resposta = await banco.mensagemEnviada.create({
    data: {
      numero: recado.responderPara.replace(/\D/g, '') || recado.de,
      texto: pensada.texto,
      situacao: enviada ? 'ENVIADA' : 'FALHOU',
      //  SEM ESTA LINHA O ASSISTENTE CONVERSA CONSIGO MESMO.
      //
      //  Em 14/10/2026 ele entrou em laço num grupo: mandava
      //  "Entendido.", a própria mensagem voltava marcada como
      //  `fromMe`, e ele respondia a ela. A trava existia e estava
      //  certa — compara o identificador do que chega com o do que
      //  saiu —, mas o identificador NUNCA ERA GRAVADO. A coluna
      //  ficava vazia e a comparação não batia em nada.
      idMensagem: idDaResposta,
      direcao: 'SAIDA',
      adaptador: integracoes.whatsapp.nome,
      contexto: 'assistente',
      referencia: recado.grupo?.jid ?? null,
      respondeAId: entrada.id,
      erro,
      modeloIa: pensada.modelo,
      consultasIa: pensada.consultas.map((x) => x.nome),
      tokensIa: pensada.tokens.entrada + pensada.tokens.saida,
    },
  });

  return {
    entradaId: entrada.id,
    respostaId: resposta.id,
    enviada,
    texto: pensada.texto,
  };
}

// ============================================================
//  A REPESCAGEM — quem ficou sem resposta porque ele caiu
//
//  Pedido dele em 14/10/2026, depois de a cota da Groq estourar no
//  meio de uma conversa: "toda vez que ele cair ou surgir algum
//  problema, e ele demorar demais, que responda — caso a última
//  mensagem do grupo seja para ele; se já passou, não precisa".
//
//  A REGRA QUE DECIDE É "AINDA É A ÚLTIMA?".
//
//  Uma pergunta sem resposta que continua sendo a última coisa
//  dita naquela conversa está pendurada no ar, e responder a
//  destrava. Se alguém já falou depois, o assunto andou — e
//  chegar atrasado no meio de outra coisa é pior do que ficar
//  quieto.
//
//  É essa regra, e não o relógio, que protege do despejo de
//  histórico: em conversa antiga sempre há algo depois.
// ============================================================

/** Teto de idade. Pergunta mais velha que isto já não vale. */
const REPESCAR_ATE = 15 * 60 * 1000;

/**
 * Quantas conversas por volta.
 *
 * Se a API ficar uma hora fora, muita coisa volta de uma vez. Três
 * é o pior caso aceitável: o suficiente para destravar quem estava
 * esperando, longe de parecer uma rajada.
 */
const CONVERSAS_POR_VOLTA = 3;

/** De que conversa é esta linha: o grupo, ou o número da pessoa. */
function chaveDaConversa(linha: { referencia: string | null; numero: string }): string {
  return linha.referencia ?? linha.numero;
}

export async function repescagem(): Promise<number> {
  const c = cerebro();
  if (!c.ativo || !integracoes.ia.pronto()) return 0;

  const desde = new Date(Date.now() - REPESCAR_ATE);

  //  Tudo que chegou na janela, do mais novo para o mais velho.
  const recentes = await banco.mensagemEnviada.findMany({
    where: { contexto: 'assistente', direcao: 'ENTRADA', criadoEm: { gte: desde } },
    orderBy: { criadoEm: 'desc' },
    include: { respostas: { select: { situacao: true } } },
    take: 60,
  });

  //  A PRIMEIRA DE CADA CONVERSA É A ÚLTIMA MENSAGEM DELA.
  //
  //  Como a lista vem do mais novo para o mais velho, basta pegar
  //  a primeira vez que cada conversa aparece. Se essa já foi
  //  respondida, não há o que repescar ali — e se não foi, ela é
  //  exatamente a que ficou pendurada.
  const vistas = new Set<string>();
  const pendentes: typeof recentes = [];

  for (const linha of recentes) {
    const chave = chaveDaConversa(linha);
    if (vistas.has(chave)) continue;
    vistas.add(chave);

    const jaRespondida = linha.respostas.some((r) => r.situacao === 'ENVIADA');
    if (!jaRespondida) pendentes.push(linha);
  }

  let respondidas = 0;

  for (const pendente of pendentes.slice(0, CONVERSAS_POR_VOLTA)) {
    try {
      const ehGrupo = Boolean(pendente.referencia?.endsWith('@g.us'));

      if (ehGrupo) {
        const grupo = await banco.grupoWhatsApp.findUnique({
          where: { jid: pendente.referencia! },
          select: { liberado: true, vistoEm: true },
        });

        //  Grupo tirado da Área IA é uma decisão de "não fale mais
        //  aqui". Pergunta antiga não fura isso.
        if (!grupo?.liberado) continue;

        //  O ASSUNTO ANDOU? Se chegou qualquer mensagem no grupo
        //  depois desta pergunta — inclusive conversa que não era
        //  com ele —, a pergunta deixou de ser a última. Dois
        //  segundos de folga porque a própria pergunta move o
        //  relógio ao chegar.
        if (grupo.vistoEm.getTime() > pendente.criadoEm.getTime() + 2000) continue;
      }

      const reconhecido = await identificar(pendente.numero);

      const quem: QuemPergunta =
        reconhecido.tipo === 'equipe'
          ? reconhecido
          : ehGrupo
            ? { tipo: 'equipe', usuarioId: '', nome: pendente.destino ?? 'colega' }
            : reconhecido;

      if (quem.tipo !== 'equipe') continue;

      const pensada = await responder(pendente.texto, quem, [], { jaCumprimentou: true });

      //  O PEDIDO DE DESCULPA VEM DO SISTEMA, não do modelo.
      //
      //  Pedir ao modelo que "diga que demorou" é torcer para ele
      //  lembrar. Aqui é certo: quem sabe que houve atraso é o
      //  código que está repescando.
      const texto = 'Desculpa a demora. ' + pensada.texto;

      const para = pendente.referencia ?? pendente.numero;
      const r = await integracoes.whatsapp.enviar({ para, texto });

      await banco.mensagemEnviada.create({
        data: {
          numero: para.replace(/\D/g, '') || pendente.numero,
          texto,
          situacao: r.sucesso ? 'ENVIADA' : 'FALHOU',
          direcao: 'SAIDA',
          adaptador: integracoes.whatsapp.nome,
          contexto: 'assistente',
          referencia: pendente.referencia,
          respondeAId: pendente.id,
          idMensagem: r.idMensagem ?? null,
          erro: r.erro ?? null,
          modeloIa: pensada.modelo,
          consultasIa: pensada.consultas.map((x) => x.nome),
          tokensIa: pensada.tokens.entrada + pensada.tokens.saida,
        },
      });

      if (r.sucesso) {
        respondidas += 1;
        console.log('[assistente] repesquei uma pergunta que ficou sem resposta');
      }
    } catch {
      //  Repescagem é cortesia, não obrigação: se falhar de novo,
      //  fica para a próxima volta. Nada aqui pode derrubar o
      //  atendimento normal.
    }
  }

  return respondidas;
}

/**
 * Liga o ouvido, uma vez, quando a API sobe.
 *
 * Adaptador que não recebe (o simulado, a API oficial) não tem
 * `aoReceber`, e aí isto não faz nada — o sistema sobe igual.
 */
export function ligarAssistente(aoFalhar?: (erro: unknown) => void): boolean {
  const whatsapp = integracoes.whatsapp;
  if (typeof whatsapp.aoReceber !== 'function') return false;

  //  OS MOTIVOS DE SILÊNCIO QUE NÃO PRECISAM DE LOG.
  //
  //  São o funcionamento normal: grupo que ninguém escolheu,
  //  conversa de grupo que não chama o assistente, e a resposta
  //  que ele mesmo acabou de mandar. Num celular com trinta
  //  grupos, registrar isso encheria o log de ruído e esconderia
  //  o que importa.
  const ESPERADO = new Set<MotivoDeIgnorar>([
    'grupo-nao-liberado',
    'nao-chamaram',
    'resposta-minha',
    'repetida',
  ]);

  whatsapp.aoReceber((recado) => {
    //  O ouvinte do Baileys é SÍNCRONO: devolver promessa a ele
    //  não adianta, e uma exceção aqui derrubaria o socket.
    void atender(recado)
      .then((r) => {
        //  "A mensagem chegou e não virou resposta" precisa deixar
        //  rastro, senão a única informação que sobra é o silêncio
        //  — e silêncio não diz se o problema é a conexão, o
        //  cadastro, a chave ou o limite.
        if (r.ignorado && !ESPERADO.has(r.ignorado)) {
          console.log('[assistente] não respondeu: ' + r.ignorado);
        }
      })
      .catch((e) => {
        console.log(
          '[assistente] falhou: ' + (e instanceof Error ? e.message : 'erro desconhecido'),
        );
        if (aoFalhar) aoFalhar(e);
      });
  });

  //  E CONFERE DE TEMPOS EM TEMPOS QUEM FICOU SEM RESPOSTA.
  //
  //  Dois minutos. Cobre os dois casos de uma vez, sem precisar de
  //  evento nenhum: a API que acabou de subir, e a conexao que
  //  voltou depois de cair. O proprio `repescagem` nao faz nada
  //  quando nao ha o que repescar, entao o custo de rodar a toa e
  //  uma consulta curta.
  if (process.env.NODE_ENV !== 'test') {
    const relogio = setInterval(() => {
      void repescagem().catch(() => {
        //  Cortesia que falha nao pode derrubar o atendimento.
      });
    }, 2 * 60 * 1000);

    //  Nao segura o processo de pe na hora de encerrar.
    relogio.unref?.();
  }

  return true;
}
