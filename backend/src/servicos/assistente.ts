// ============================================================
//  O ASSISTENTE
//
//  Junta as três peças: quem está perguntando, o que ele pode
//  ver, e o modelo que transforma dado em frase.
//
//  O CICLO, que não é o óbvio:
//
//    1. a pergunta chega;
//    2. o classificador confere se é tentativa de sequestro;
//    3. o modelo recebe a pergunta E A LISTA DE FERRAMENTAS —
//       nunca os dados;
//    4. ele pede uma ou mais consultas;
//    5. NÓS executamos, com o filtro de quem perguntou;
//    6. o resultado volta para ele;
//    7. ele responde em português, com o que leu.
//
//  Os passos 4 a 6 repetem até ele parar de pedir consulta, com
//  teto — ver `VOLTAS_NO_MAXIMO`.
// ============================================================

import { banco } from '../plugins/banco.js';
import { integracoes } from '../integracoes/index.js';
import { DEFINICOES, executarFerramenta, type QuemPergunta } from './assistente-ferramentas.js';
import { cerebro } from './configuracao-ia.js';
import { dataBr, horaBr, diaDaSemanaBr } from './data-br.js';
import type { TurnoIA } from '../integracoes/ia/porta.js';

/**
 * Quantas vezes ela pode pedir consulta antes de ter de falar.
 *
 * Sem teto, um modelo confuso pede a mesma coisa em círculo e a
 * conta sobe sozinha.
 *
 * Eram QUATRO, e foi pouco: em 14/10/2026 alguém perguntou
 * "quantos fornecedores tem, quantos materiais, qual estoque e
 * qual foi a última cotação" — quatro perguntas numa frase. Ela
 * consultou quatro vezes, bateu no teto e respondeu "essa
 * pergunta ficou grande para mim", com os dados JÁ NA MÃO.
 *
 * Sete cobre a pergunta de quatro partes com folga para uma
 * consulta repetida no meio.
 */
const VOLTAS_NO_MAXIMO = 7;

/**
 * Teto de tokens de SAÍDA.
 *
 * NÃO é o tamanho da resposta: quem segura o tamanho é a
 * instrução, que manda escrever curto. Este número é o orçamento
 * total — e nestes modelos o RACIOCÍNIO sai do mesmo bolso.
 *
 * Eram 600, e isso quebrava em silêncio: numa pergunta de quatro
 * partes ("quantos fornecedores, quantos materiais, qual estoque
 * e qual a última cotação") o modelo gastava o orçamento inteiro
 * pensando e devolvia texto VAZIO — que vira "não consegui
 * consultar isso agora", sem nenhuma pista do porquê.
 *
 * 1600 dá folga para pensar e escrever. O custo só aparece se for
 * usado: o que não se escreve não se paga.
 */
const LIMITE_DE_SAIDA = 1600;

// ============================================================
//  Quem está do outro lado
// ============================================================

/**
 * As formas em que o mesmo celular pode estar escrito.
 *
 * O NONO DÍGITO É A ARMADILHA, e ela já custou caro aqui: em
 * 11/10/2026 uma mensagem foi para o número errado porque o
 * WhatsApp guardava `558393952248` e o cadastro tinha
 * `5583993952248` — a mesma pessoa, doze e treze dígitos.
 *
 * Celular brasileiro ganhou um 9 na frente do número; contato
 * antigo, linha fixa e o próprio WhatsApp guardam das duas
 * formas. Comparar cru faz o fornecedor certo entrar como
 * estranho — e estranho não vê nada.
 */
export function formasDoNumero(bruto: string): string[] {
  const d = String(bruto ?? '').replace(/\D/g, '');
  if (!d) return [];

  const formas = new Set<string>([d]);

  //  55 + DDD(2) + 9 + 8 dígitos = 13. Tira o nono.
  if (d.length === 13 && d.startsWith('55') && d[4] === '9') {
    formas.add(d.slice(0, 4) + d.slice(5));
  }

  //  55 + DDD(2) + 8 dígitos = 12. Põe o nono.
  if (d.length === 12 && d.startsWith('55')) {
    formas.add(d.slice(0, 4) + '9' + d.slice(4));
  }

  //  Sem o país, do jeito que se digita no Brasil.
  if (d.length >= 12 && d.startsWith('55')) formas.add(d.slice(2));

  return [...formas];
}

/**
 * De quem é este número?
 *
 * A ordem importa: EQUIPE antes de FORNECEDOR. Se a mesma pessoa
 * estiver nos dois lugares, ela é da casa — vê mais, não menos.
 */
export async function identificar(numero: string): Promise<QuemPergunta> {
  const formas = formasDoNumero(numero);
  if (!formas.length) return { tipo: 'desconhecido', nome: 'desconhecido' };

  const usuario = await banco.usuario.findFirst({
    where: { ativo: true, OR: formas.map((f) => ({ telefone: { contains: f.slice(-8) } })) },
    select: { id: true, nome: true, telefone: true },
  });

  if (usuario?.telefone && formas.some((f) => f.endsWith(usuario.telefone!.replace(/\D/g, '').slice(-8)))) {
    return { tipo: 'equipe', usuarioId: usuario.id, nome: usuario.nome };
  }

  const fornecedor = await banco.fornecedor.findFirst({
    where: { ativo: true, OR: formas.map((f) => ({ whatsapp: { contains: f.slice(-8) } })) },
    select: { id: true, nomeFantasia: true, razaoSocial: true },
  });

  if (fornecedor) {
    return {
      tipo: 'fornecedor',
      fornecedorId: fornecedor.id,
      nome: fornecedor.nomeFantasia ?? fornecedor.razaoSocial,
    };
  }

  return { tipo: 'desconhecido', nome: 'desconhecido' };
}

// ============================================================
//  As instruções
// ============================================================

/**
 * O prompt de sistema.
 *
 * As perguntas prováveis estão listadas de propósito — foi o
 * ponto da reunião de 14/10/2026: *"o que possivelmente vai ser
 * perguntado, você já quebra essa brecha"*. Modelo que conhece o
 * repertório erra menos na escolha da ferramenta.
 *
 * O que ele NÃO faz também está escrito, mas repare que as
 * proibições de ACESSO não dependem desta lista: elas estão nas
 * ferramentas. O que está aqui é comportamento — tom, formato,
 * e não inventar.
 */
export interface ComoEstaAConversa {
  /**
   * Já trocamos mensagem com esta pessoa agora há pouco?
   *
   * Quem decide isto é o `atendimento`, olhando o histórico — não
   * o modelo, olhando o texto. Pedir a ele que "lembre" se já
   * cumprimentou é pedir que adivinhe; o banco sabe.
   */
  jaCumprimentou?: boolean;
}

export function instrucoes(quem: QuemPergunta, conversa: ComoEstaAConversa = {}): string {
  const c = cerebro();
  const agora = new Date();

  const comum = [
    'Você se chama ' + c.nome + '. É o assistente INTERNO da Porto Inc., uma',
    'construtora, e atende pelo WhatsApp as pessoas que trabalham nela.',
    '',
    //  A HORA PRECISA SER DITA.
    //
    //  Modelo de linguagem não tem relógio. Sem isto ele dá "bom
    //  dia" às onze da noite, e erra qualquer conta de "esta
    //  semana", "ainda dá tempo" ou "já passou do prazo" — que é
    //  justamente o tipo de erro que destrói a confiança numa
    //  resposta aparentemente bem escrita.
    'AGORA SÃO ' + horaBr(agora) + ' de ' + dataBr(agora) + ' (' + diaDaSemanaBr(agora) + ').',
    'Use isto para cumprimentar certo e para falar de prazo com acerto.',
    '',
    'RESPONDA A ÚLTIMA MENSAGEM',
    '- As mensagens acima são o que já foi dito nesta conversa, e servem só',
    '  de contexto. Quem você responde é a ÚLTIMA.',
    '- Se ficou alguma pergunta antiga sem resposta, não volte nela por conta',
    '  própria: a pessoa seguiu em frente, e responder o assunto de dez',
    '  minutos atrás parece desatenção, não memória.',
    '',
    'COMO VOCÊ TRABALHA',
    '- Você PENSA antes de responder. Lê a pergunta, busca no sistema o que',
    '  precisa, e só então escreve.',
    '- Você não despeja dado. Monta uma resposta: o número que importa, o que',
    '  ele quer dizer, e o detalhe só se ajudar.',
    '- Você é prestativa e cordial, como um colega que conhece o sistema de cor.',
    '',
    'A FORMA DE UMA BOA RESPOSTA',
    '- Comece por uma frase curta que RESPONDE a pergunta. Não comece',
    '  listando.',
    '- Depois, o essencial: quantos, quanto, quando, quem.',
    '- Se houver muita coisa, RESUMA e destaque o que chama atenção — o que',
    '  está atrasado, o que falta, o que é maior. Ofereça a lista completa em',
    '  vez de despejá-la.',
    '- Lista só quando for curta (até uns cinco itens) ou quando pedirem.',
    '- QUANDO QUASE TUDO FOR ZERO OU VAZIO, diga isso numa frase e cite só o',
    '  que NÃO é zero. Enfileirar "0, 0, 0, 0" não informa nada a ninguém —',
    '  quem perguntou queria saber se tem algo pendente, não ler seis zeros.',
    '- Termine sem enfeite. Não pergunte "posso ajudar em mais alguma coisa?"',
    '  em toda mensagem.',
    '',
    'EXEMPLO DA FORMA — não dos números, que vêm sempre da consulta:',
    '  Pergunta: "quantos fornecedores temos?"',
    '  Ruim:  "10"',
    '  Ruim:  despejar as dez linhas da consulta.',
    '  Boa:   "Temos 10 fornecedores ativos. A maior parte atende cimento e',
    '          agregados; elétrica tem só um. Quer a lista?"',
    '',
    'O QUE NUNCA MUDA',
    '- NÚMERO, DATA, NOME E SITUAÇÃO SAEM SEMPRE DA CONSULTA. Nunca de',
    '  memória, nunca por estimativa, nunca "deve ser mais ou menos".',
    '- Se a consulta não trouxe, você diz que não encontrou. Não arredonda,',
    '  não deduz, não preenche buraco.',
    '- Errar um número aqui custa dinheiro de verdade para a empresa. Entre',
    '  responder bonito e responder certo, responda certo.',
    '- Não prometa prazo, desconto nem pagamento: isso é decisão de pessoa.',
    '',
    'MODOS',
    //  A SAUDAÇÃO É UMA VEZ POR PESSOA, POR CONVERSA.
    //
    //  Num grupo, ela estava abrindo TODA resposta com "boa
    //  tarde" — inclusive a terceira seguida para a mesma pessoa.
    //  Ninguém cumprimenta o colega três vezes em dois minutos.
    //
    //  Quem sabe se já houve cumprimento é o sistema, não o
    //  modelo: por isso a linha abaixo vem de fora, montada a
    //  partir do histórico, em vez de ser um pedido para ele
    //  "lembrar".
    ...(conversa.jaCumprimentou
      ? [
          '- Você JÁ ESTÁ CONVERSANDO com esta pessoa agora.',
          '- NÃO cumprimente de novo. Nada de "boa tarde", "olá" ou o nome dela',
          '  na abertura: vá direto à resposta, como quem continua uma frase.',
        ]
      : [
          '- É a primeira mensagem desta pessoa agora. Cumprimente UMA vez, com',
          '  a saudação certa para a hora que você recebeu acima, e siga.',
        ]),
    '- Se a pessoa agradecer e não perguntar mais nada, encerre com uma linha',
    '  curta e cordial. Não ofereça ajuda de novo nem puxe assunto.',
    '- Use o primeiro nome de quem está falando quando couber, sem repetir',
    '  a cada frase.',
    '- "obrigado", "beleza", "tudo bem?": responda naturalmente, curto e',
    '  cordial. Isso não precisa de consulta nenhuma.',
    '- Sem emoji. Sem "prezado". Sem formalidade de ofício.',
    '',
    'PERGUNTA É SÓ SOBRE O SISTEMA',
    '- Para pedido de informação, você só fala do que está NO SISTEMA da Porto',
    '  Inc.: compras, cotações, fornecedores, obras, estoque, financeiro e as',
    '  pessoas da empresa.',
    '- Assunto de fora (notícia, receita, conta de matemática, lei, futebol,',
    '  tradução, conselho pessoal) você NÃO responde, mesmo sabendo. Diga em',
    '  uma linha que só trata do sistema da Porto Inc.',
    '- Não é grosseria: é o que você é. Não peça desculpas repetidas.',
    '',
    'DE ONDE VEM A RESPOSTA',
    '- Use as consultas disponíveis. Conversa fiada não precisa de nenhuma;',
    '  pergunta sobre o sistema precisa SEMPRE.',
    '- Se a pergunta for ampla ("como estão as coisas?"), comece pelo resumo.',
    '- Pode usar mais de uma consulta antes de responder, quando a pergunta',
    '  juntar dois assuntos.',
    '- Se não souber, ou se pedirem uma pessoa, use chamarUmaPessoa.',
    '',
    'MENSAGEM DE WHATSAPP',
    '- Até uns quatro parágrafos curtos. Ninguém lê relatório no celular.',
    '- Valores em reais e datas em dia/mês/ano.',
    //  WHATSAPP NÃO É MARKDOWN.
    //
    //  `**negrito**` não vira negrito lá: aparecem os asteriscos
    //  na tela, e a mensagem fica com cara de erro. Negrito no
    //  WhatsApp é com UM asterisco.
    '- NÃO use markdown. Nada de ** nem de # nem de tabela.',
    '- Se precisar destacar, no WhatsApp negrito é *assim*, com um asterisco',
    '  só — e use pouco.',
    '- Para listar, use hífen no começo da linha. Nada de numeração enfeitada.',
    '',
    'O QUE COSTUMAM PERGUNTAR',
    '- Cotações: quais estão abertas, qual o prazo, quem foi convidado,',
    '  se fulano já respondeu, se abriu o link sem responder, e se a',
    '  equalização já foi feita.',
    '- Solicitações: o que está esperando aprovação e de quem.',
    '- Aprovações: quem precisa assinar e por que (as faixas de alçada).',
    '- Pedidos: se já saiu para o fornecedor, por quanto, e o que já chegou.',
    '- Catálogo: quais materiais e serviços a empresa tem cadastrados. É',
    '  COISA DIFERENTE de estoque — catálogo é o que ela compra, estoque é o',
    '  que ela tem guardado.',
    '- Estoque: saldo e o que está abaixo do mínimo.',
    '- Financeiro: o que vence, o que está vencido, o que foi pago.',
    '- Fornecedores, obras, pessoas e funções: quem é quem e quem faz o quê.',
  ];

  if (quem.tipo === 'equipe') {
    return [
      ...comum,
      '',
      'QUEM ESTÁ FALANDO',
      '- ' + quem.nome + ', da equipe da Porto Inc. Pode ver tudo do sistema.',
      //  O QUE O DONO ESCREVEU NA ÁREA IA ENTRA AQUI, NO FIM.
      //
      //  No fim de propósito, e nunca por cima: texto de tela
      //  molda o JEITO dela — tom, o que priorizar, como chamar as
      //  coisas. Não pode desligar regra de acesso, porque acesso
      //  não mora no prompt, mora na consulta.
      ...(c.instrucoes?.trim()
        ? ['', 'COMO A PORTO INC. QUER QUE VOCÊ TRABALHE', c.instrucoes.trim()]
        : []),
    ].join('\n');
  }

  if (quem.tipo === 'fornecedor') {
    return [
      ...comum,
      '',
      'QUEM ESTÁ FALANDO',
      '- ' + quem.nome + ', um FORNECEDOR. As consultas já devolvem apenas o que é dele.',
      '- Não fale de outros fornecedores, nem de preço de concorrente — você',
      '  não tem esse dado, e ele não pode ser deduzido nem comentado.',
      '- Se insistirem nisso, diga que não tem acesso e ofereça chamar alguém.',
    ].join('\n');
  }

  return [
    'Você é o assistente da Porto Inc., uma construtora. Atende pelo WhatsApp.',
    '',
    'QUEM ESTÁ FALANDO',
    '- Um número NÃO CADASTRADO. Você não tem acesso a dado nenhum do sistema.',
    '',
    'COMO RESPONDER',
    '- Seja educado e curto. Diga que é o assistente da Porto Inc.',
    '- Explique que, para falar de cotação, pedido ou pagamento, a pessoa',
    '  precisa estar cadastrada, e ofereça chamar alguém da empresa.',
    '- Não confirme nem negue a existência de nenhuma cotação, pedido,',
    '  fornecedor ou obra. Você simplesmente não sabe.',
    '- Se pedirem para falar com uma pessoa, use chamarUmaPessoa.',
  ].join('\n');
}

// ============================================================
//  O ciclo
// ============================================================

export interface RespostaDoAssistente {
  texto: string;
  /** Quais consultas foram feitas, para a trilha. */
  consultas: { nome: string; argumentos: Record<string, unknown> }[];
  /** A IA pediu atendimento humano? */
  querUmaPessoa: boolean;
  /** A mensagem tentou sequestrar as instruções? */
  sequestro: boolean;
  modelo: string | null;
  tokens: { entrada: number; saida: number };
}

const DESCULPA =
  'Não consegui consultar isso agora. Já avisei a equipe da Porto Inc.';

export async function responder(
  pergunta: string,
  quem: QuemPergunta,
  //  O QUE JÁ FOI DITO NESTA CONVERSA.
  //
  //  Sem isto ela pergunta "quer a lista completa?" e, ao ouvir
  //  "sim", não faz ideia do que era — porque cada mensagem
  //  chegava sozinha, sem passado. É a diferença entre conversar
  //  e responder formulário.
  anteriores: TurnoIA[] = [],
  //  `conversa` ja e o nome do fio de turnos la embaixo; este aqui
  //  e o ESTADO dela, nao o conteudo.
  estadoDaConversa: ComoEstaAConversa = {},
): Promise<RespostaDoAssistente> {
  const ia = integracoes.ia;

  const vazio = {
    consultas: [] as { nome: string; argumentos: Record<string, unknown> }[],
    querUmaPessoa: false,
    sequestro: false,
    modelo: ia.modelo(),
    tokens: { entrada: 0, saida: 0 },
  };

  if (!ia.pronto()) {
    return { ...vazio, texto: DESCULPA };
  }

  //  A CERCA DE FORA, antes de gastar token com o modelo grande.
  if (await ia.ehTentativaDeSequestro(pergunta)) {
    return {
      ...vazio,
      sequestro: true,
      querUmaPessoa: true,
      texto:
        'Não consigo ajudar com isso. Se precisar falar com alguém da Porto Inc., me avise.',
    };
  }

  const conversa: TurnoIA[] = [...anteriores, { papel: 'pessoa', texto: pergunta }];
  const consultas: { nome: string; argumentos: Record<string, unknown> }[] = [];

  let querUmaPessoa = false;
  let modelo: string | null = null;
  const tokens = { entrada: 0, saida: 0 };

  for (let volta = 0; volta < VOLTAS_NO_MAXIMO; volta += 1) {
    //  NA ÚLTIMA VOLTA, SEM FERRAMENTA NENHUMA.
    //
    //  É o que impede a desistência burra: sem ferramentas para
    //  pedir, o modelo é obrigado a escrever com o que já juntou.
    //  E ele costuma ter juntado o bastante — no caso de
    //  14/10/2026 tinha fornecedores, catálogo e estoque em mãos
    //  quando respondeu "essa pergunta ficou grande para mim".
    //
    //  Melhor uma resposta parcial e honesta do que um pedido de
    //  desculpa por cima de dado que já estava ali.
    const ultimaVolta = volta === VOLTAS_NO_MAXIMO - 1;

    const resposta = await ia.responder({
      sistema:
        instrucoes(quem, estadoDaConversa) +
        (ultimaVolta
          ? [
              '',
              '',
              'IMPORTANTE: responda AGORA, com o que você já consultou. Não peça',
              'mais nenhuma consulta. Se faltou alguma parte da pergunta, diga qual',
              'faltou e responda o resto.',
            ].join('\n')
          : ''),
      conversa,
      ferramentas: DEFINICOES,
      //  Na última volta elas continuam DECLARADAS — o histórico
      //  precisa delas — mas o uso é proibido. Assim o modelo é
      //  obrigado a escrever com o que já juntou.
      proibirFerramentas: ultimaVolta,
      limiteDeSaida: LIMITE_DE_SAIDA,
    });

    modelo = resposta.modelo;
    tokens.entrada += resposta.tokens.entrada;
    tokens.saida += resposta.tokens.saida;

    if (!resposta.chamadas.length) {
      return {
        texto: resposta.texto?.trim() || DESCULPA,
        consultas,
        querUmaPessoa,
        sequestro: false,
        modelo,
        tokens,
      };
    }

    conversa.push({
      papel: 'assistente',
      texto: resposta.texto,
      chamadas: resposta.chamadas,
    });

    for (const chamada of resposta.chamadas) {
      if (chamada.nome === 'chamarUmaPessoa') querUmaPessoa = true;

      consultas.push({ nome: chamada.nome, argumentos: chamada.argumentos });

      const resultado = await executarFerramenta(chamada.nome, chamada.argumentos, quem);

      conversa.push({
        papel: 'ferramenta',
        idChamada: chamada.id,
        nome: chamada.nome,
        resultado,
      });
    }
  }

  //  CHEGAR AQUI FICOU DIFÍCIL: a última volta vai sem ferramenta
  //  nenhuma, então o modelo é obrigado a escrever. Só sobra o
  //  caso de ele devolver texto vazio — e aí dizer que não
  //  conseguiu é mais honesto do que inventar um fecho.
  return {
    texto:
      'Não consegui montar a resposta agora. Vou pedir para alguém da Porto Inc. te responder.',
    consultas,
    querUmaPessoa: true,
    sequestro: false,
    modelo,
    tokens,
  };
}
