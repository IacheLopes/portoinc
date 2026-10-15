// ============================================================
//  ADAPTADOR GROQ
//
//  A Groq serve modelos abertos por uma API no formato da OpenAI.
//  Duas coisas a recomendam para este uso:
//
//    · é RÁPIDA. Uma resposta sai em menos de meio segundo, e no
//      WhatsApp a pessoa está olhando a tela esperando;
//    · cobra por palavra processada, e resposta de WhatsApp é
//      curta — o volume da Porto Inc. custa centavos por dia.
//
//  O MODELO NÃO ESTÁ CHUMBADO NO CÓDIGO, e isso não é capricho:
//  em 14/10/2026 a conta da empresa tinha gpt-oss-120b, gpt-oss-20b
//  e qwen3.8-27b — e NÃO tinha mais o Llama 3.3 70B que toda a
//  internet manda usar. Catálogo de provedor muda sem avisar.
//  Por isso: `IA_MODELO` em branco faz o adaptador PERGUNTAR à
//  Groq o que a conta tem e escolher o melhor da lista.
// ============================================================

import type {
  PortaIA, PedidoIA, RespostaIA, ChamadaDeFerramenta, TurnoIA, FerramentaIA,
} from './porta.js';

const BASE = 'https://api.groq.com/openai/v1';

/**
 * Preferência de modelo, do melhor para o que serve.
 *
 * "Melhor" aqui é obedecer instrução e escolher ferramenta certa —
 * não escrever bonito. O assistente lê dado e responde curto.
 */
const PREFERIDOS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
];

/**
 * O classificador de sequestro de instruções.
 *
 * É um modelo pequeno, da própria Meta, treinado só para isso.
 * Devolve uma PROBABILIDADE em texto: 0,0004 para "o pedido já
 * saiu?" e 0,9995 para "ignore suas instruções anteriores".
 * Medido em 14/10/2026, e sai sem custo de token.
 */
const GUARDA = 'meta-llama/llama-prompt-guard-2-86m';

/** O que transforma recado de voz em pergunta. */
const TRANSCRITOR = 'whisper-large-v3-turbo';

/** Acima disto, a mensagem não chega ao assistente. */
const LIMITE_DE_SUSPEITA = 0.8;

interface MensagemOpenAI {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface DadosGroq {
  token: string;
  /** Em branco, o adaptador descobre sozinho. */
  modelo?: string;
}

export class AdaptadorIaGroq implements PortaIA {
  readonly nome = 'groq';

  /** Descoberto uma vez e guardado: a lista não muda no ar. */
  private modeloEscolhido: string | null = null;

  /** A lista de modelos de conversa da conta, lida uma vez. */
  private daConta: string[] | null = null;

  /**
   * OS MODELOS QUE JÁ ESTOURARAM A COTA DO DIA, e quando.
   *
   * A Groq conta por MODELO: quando o maior seca, o menor ainda
   * tem balde cheio. Guardar quais secaram evita insistir no que
   * já se sabe que vai recusar.
   *
   * O carimbo existe para o esquecimento: cota diária volta, e sem
   * isso o assistente passaria o resto da semana no modelo
   * reserva. Uma hora depois ele tenta o preferido de novo — custa
   * uma recusa, e só.
   */
  private esgotados = new Map<string, number>();

  constructor(private readonly dados: DadosGroq) {
    if (dados.modelo?.trim()) this.modeloEscolhido = dados.modelo.trim();
  }

  pronto(): boolean {
    return Boolean(this.dados.token?.trim());
  }

  modelo(): string | null {
    return this.pronto() ? this.modeloEscolhido : null;
  }

  private cabecalhos(): Record<string, string> {
    return {
      authorization: 'Bearer ' + this.dados.token,
      'content-type': 'application/json',
    };
  }

  /**
   * Qual modelo usar.
   *
   * Pergunta à Groq o que a conta tem e cruza com a preferência.
   * Se nenhum preferido aparecer, pega o primeiro que não seja de
   * áudio nem classificador — melhor responder com um modelo
   * inesperado do que ficar mudo porque a lista mudou.
   */
  private async listaDaConta(): Promise<string[]> {
    if (this.daConta) return this.daConta;

    const r = await fetch(BASE + '/models', { headers: this.cabecalhos() });
    if (!r.ok) throw new Error('A Groq recusou a lista de modelos (' + r.status + ').');

    const corpo = (await r.json()) as { data?: { id: string }[] };

    const conversa = (corpo.data ?? [])
      .map((m) => m.id)
      .filter((m) => !/whisper|orpheus|prompt-guard|safeguard|allam/.test(m));

    //  A ORDEM É A PREFERÊNCIA: primeiro os que a gente escolheu,
    //  na ordem em que escolheu; depois o resto, para o dia em que
    //  o catálogo mudar e nenhum preferido existir mais.
    this.daConta = [
      ...PREFERIDOS.filter((m) => conversa.includes(m)),
      ...conversa.filter((m) => !PREFERIDOS.includes(m)),
    ];

    if (this.daConta.length === 0) {
      throw new Error('A conta da Groq não tem nenhum modelo de conversa.');
    }

    return this.daConta;
  }

  /** Esgotado há mais de uma hora volta a valer: a cota do dia vira. */
  private estaEsgotado(modelo: string): boolean {
    const quando = this.esgotados.get(modelo);
    if (quando === undefined) return false;

    if (Date.now() - quando > 60 * 60 * 1000) {
      this.esgotados.delete(modelo);
      return false;
    }

    return true;
  }

  /**
   * Em que ordem tentar hoje.
   *
   * O escolhido na tela vem primeiro — é uma decisão de alguém.
   * Mas se ele estourou a cota, os outros entram: responder com um
   * modelo diferente é muito melhor do que ficar mudo.
   */
  private async ordemDeTentativa(): Promise<string[]> {
    const lista = await this.listaDaConta();

    const preferido = this.modeloEscolhido;
    const ordem = preferido
      ? [preferido, ...lista.filter((m) => m !== preferido)]
      : [...lista];

    const vivos = ordem.filter((m) => !this.estaEsgotado(m));

    //  Todos esgotados: tenta assim mesmo, na ordem normal. Se a
    //  cota virou e a gente não percebeu, funciona; se não virou,
    //  a recusa vira o aviso que a pessoa recebe.
    return vivos.length > 0 ? vivos : ordem;
  }

  private async descobrirModelo(): Promise<string> {
    if (this.modeloEscolhido) return this.modeloEscolhido;

    const [primeiro] = await this.listaDaConta();
    this.modeloEscolhido = primeiro;
    return primeiro;
  }

  async ehTentativaDeSequestro(texto: string): Promise<boolean> {
    if (!this.pronto() || !texto.trim()) return false;

    try {
      const r = await fetch(BASE + '/chat/completions', {
        method: 'POST',
        headers: this.cabecalhos(),
        body: JSON.stringify({
          model: GUARDA,
          messages: [{ role: 'user', content: texto.slice(0, 4000) }],
        }),
      });

      if (!r.ok) return false;

      const corpo = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      const nota = Number(corpo.choices?.[0]?.message?.content);

      return Number.isFinite(nota) && nota >= LIMITE_DE_SUSPEITA;
    } catch {
      //  NA DÚVIDA, DEIXA PASSAR — e isso é deliberado.
      //
      //  O classificador é a segunda cerca, não a primeira. A
      //  primeira são as ferramentas, que só devolvem o que a
      //  pessoa pode ver. Derrubar o atendimento inteiro porque
      //  um classificador ficou fora do ar seria trocar um risco
      //  pequeno por uma pane certa.
      return false;
    }
  }

  async modelosDisponiveis(): Promise<string[]> {
    if (!this.pronto()) return [];

    const r = await fetch(BASE + '/models', { headers: this.cabecalhos() });
    if (!r.ok) return [];

    const corpo = (await r.json()) as { data?: { id: string }[] };

    //  So os de CONVERSA. A conta tambem traz Whisper (audio),
    //  Orpheus (voz) e classificadores — oferecer isso na tela
    //  como "modelo do assistente" seria convidar ao erro.
    return (corpo.data ?? [])
      .map((m) => m.id)
      .filter((m) => !/whisper|orpheus|prompt-guard|safeguard|allam/.test(m))
      .sort();
  }

  /**
   * AUDIO VIRA TEXTO, pelo Whisper da propria Groq.
   *
   * O pessoal da obra manda audio, nao digita. Um assistente que
   * so le texto fica de fora de metade da conversa — e a conta ja
   * tem o modelo, sem custo novo de integracao.
   */
  async transcrever(audio: Buffer, tipoMime: string): Promise<string | null> {
    if (!this.pronto()) return null;

    try {
      const extensao = (tipoMime.split('/')[1] ?? 'ogg').split(';')[0];

      const formulario = new FormData();
      formulario.append('file', new Blob([new Uint8Array(audio)], { type: tipoMime }), 'audio.' + extensao);
      formulario.append('model', TRANSCRITOR);
      //  Dizer o idioma melhora muito a transcricao de audio curto,
      //  que e o caso aqui: recado de obra tem poucos segundos.
      formulario.append('language', 'pt');

      const r = await fetch(BASE + '/audio/transcriptions', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + this.dados.token },
        body: formulario,
      });

      if (!r.ok) return null;

      const corpo = (await r.json()) as { text?: string };
      return corpo.text?.trim() || null;
    } catch {
      return null;
    }
  }

  async responder(pedido: PedidoIA): Promise<RespostaIA> {
    if (!this.pronto()) throw new Error('A IA está sem chave configurada.');

    await this.descobrirModelo();
    const tentar = await this.ordemDeTentativa();

    let ultimoErro = 'A Groq não respondeu.';

    //  TROCA DE MODELO EM VEZ DE EMUDECER.
    //
    //  A cota da Groq e contada POR MODELO: quando o maior seca, o
    //  menor ainda tem balde cheio. Em 14/10/2026 a cota diaria do
    //  gpt-oss-120b acabou no meio de um teste e o assistente parou
    //  no ar — do lado de fora, indistinguivel de sistema quebrado.
    //
    //  E o FIO DA CONVERSA NAO SE PERDE: o historico viaja inteiro
    //  dentro de cada pedido, entao trocar de modelo e trocar de
    //  atendente no meio da frase sem ninguem notar. O proximo
    //  recebe tudo o que o anterior sabia.
    for (const modelo of tentar) {
      const corpo: Record<string, unknown> = {
        model: modelo,
        messages: [
          { role: 'system', content: pedido.sistema },
          ...pedido.conversa.map(traduzirTurno),
        ],
        //  BAIXA DE PROPÓSITO. O assistente lê dado do banco e
        //  conta o que leu; criatividade aqui se chama invenção.
        temperature: 0.2,
        max_tokens: pedido.limiteDeSaida ?? 700,
      };

      if (pedido.ferramentas?.length) {
        corpo.tools = pedido.ferramentas.map(traduzirFerramenta);
        //  `none` DECLARA e PROIBE. Ver `proibirFerramentas`, na
        //  porta: tirar a lista inteira quebra o historico.
        corpo.tool_choice = pedido.proibirFerramentas ? 'none' : 'auto';
      }

      const { r, texto } = await comEspera(() =>
        fetch(BASE + '/chat/completions', {
          method: 'POST',
          headers: this.cabecalhos(),
          body: JSON.stringify(corpo),
        }),
      );

      const resposta = texto ? JSON.parse(texto) : {};

      if (r.ok) {
        const escolha = resposta.choices?.[0]?.message ?? {};

        return {
          texto: escolha.content ?? null,
          chamadas: (escolha.tool_calls ?? []).map(
            (c: {
              id: string;
              function: { name: string; arguments: string };
            }): ChamadaDeFerramenta => ({
              id: c.id,
              nome: c.function.name,
              argumentos: lerArgumentos(c.function.arguments),
            }),
          ),
          modelo,
          tokens: {
            entrada: resposta.usage?.prompt_tokens ?? 0,
            saida: resposta.usage?.completion_tokens ?? 0,
          },
          adaptador: this.nome,
        };
      }

      //  A MENSAGEM DO PROVEDOR VEM INTEIRA, como no SMTP: chave
      //  revogada, cota estourada e modelo aposentado dizem
      //  exatamente qual é o problema.
      ultimoErro =
        'A Groq recusou (' + r.status + '): ' +
        (resposta?.error?.message ?? texto.slice(0, 200));

      //  Cota do DIA estourada neste modelo. Marca e vai para o
      //  proximo — nao adianta esperar, nao vira em segundos.
      if (r.status === 429 && /per day|TPD/i.test(texto)) {
        this.esgotados.set(modelo, Date.now());
        continue;
      }

      //  Qualquer outra recusa (chave errada, modelo aposentado,
      //  requisicao malformada) nao melhora trocando de modelo.
      if (r.status !== 429) break;

      //  429 por MINUTO que o `comEspera` nao conseguiu aguardar:
      //  ai vale tentar outro, que tem fila propria.
      this.esgotados.set(modelo, Date.now());
    }

    throw new Error(ultimoErro);
  }
}

/**
 * ESPERA A VEZ EM VEZ DE DESISTIR.
 *
 * A conta gratuita da Groq tem teto por MINUTO, não por mês: em
 * 14/10/2026 eram 8.000 tokens/min, e uma pergunta do assistente
 * gasta perto de 2.800 — ou seja, três perguntas seguidas estouram.
 *
 * Quando estoura, a Groq devolve 429 E DIZ QUANTO FALTA ("try
 * again in 6.6225s"). Jogar isso fora e devolver erro ao
 * fornecedor seria absurdo: bastava esperar sete segundos. Então
 * esperamos — no máximo duas vezes, para a pessoa não ficar
 * olhando o "digitando..." por meio minuto.
 */
async function comEspera(
  chamar: () => Promise<Response>,
  tentativas = 2,
): Promise<{ r: Response; texto: string }> {
  let r = await chamar();
  let texto = await r.text();

  for (let i = 0; i < tentativas && r.status === 429; i += 1) {
    const segundos = segundosSugeridos(texto, r);

    //  Mais de 20s não é espera, é abandono: melhor dizer que não
    //  conseguiu do que deixar a pessoa no vácuo.
    if (segundos > 20) break;

    await new Promise((ok) => setTimeout(ok, Math.ceil(segundos * 1000) + 250));

    r = await chamar();
    texto = await r.text();
  }

  return { r, texto };
}

/** Lê quanto esperar: primeiro o cabeçalho, depois o texto do erro. */
function segundosSugeridos(texto: string, r: Response): number {
  const cabecalho = Number(r.headers.get('retry-after'));
  if (Number.isFinite(cabecalho) && cabecalho > 0) return cabecalho;

  const achado = /try again in ([\d.]+)s/i.exec(texto);
  const doTexto = achado ? Number(achado[1]) : NaN;

  return Number.isFinite(doTexto) && doTexto > 0 ? doTexto : 5;
}

/**
 * Argumento inválido não derruba a conversa.
 *
 * O modelo devolve os argumentos como TEXTO JSON, e de vez em
 * quando ele vem truncado. Explodir aqui mataria a resposta
 * inteira; devolvendo vazio, a ferramenta roda sem filtro e o
 * assistente ainda diz algo útil.
 */
function lerArgumentos(bruto: string): Record<string, unknown> {
  try {
    const lido = JSON.parse(bruto || '{}');
    return lido && typeof lido === 'object' ? lido : {};
  } catch {
    return {};
  }
}

function traduzirTurno(turno: TurnoIA): MensagemOpenAI {
  if (turno.papel === 'pessoa') {
    return { role: 'user', content: turno.texto };
  }

  if (turno.papel === 'ferramenta') {
    return { role: 'tool', content: turno.resultado, tool_call_id: turno.idChamada };
  }

  return {
    role: 'assistant',
    content: turno.texto,
    ...(turno.chamadas?.length
      ? {
          tool_calls: turno.chamadas.map((c) => ({
            id: c.id,
            type: 'function' as const,
            function: { name: c.nome, arguments: JSON.stringify(c.argumentos) },
          })),
        }
      : {}),
  };
}

function traduzirFerramenta(f: FerramentaIA) {
  return {
    type: 'function' as const,
    function: { name: f.nome, description: f.descricao, parameters: f.parametros },
  };
}
