// ============================================================
//  O diário da conexão do WhatsApp
//
//  Pedido dele em 10/10/2026, olhando a tela conectada:
//
//    "quero que nessa tela de conexão tenha mais detalhes, por
//     exemplo: hora que foi conectado, hora que foi desconectado,
//     status online/offline, se caiu"
//
//  O adaptador já sabia tudo isso no instante em que acontecia —
//  e esquecia no instante seguinte. Este arquivo é a memória.
//
//  DUAS COISAS QUE ELE EVITA
//
//  1. REPETIÇÃO. Uma reconexão que falha em laço passa pelos
//     mesmos dois estados muitas vezes por minuto. Estado igual
//     ao último não vira linha nova — vira só uma contagem. Sem
//     isso, um fim de semana de queda enche a tela de ruído e
//     esconde o que importa.
//
//  2. CRESCIMENTO SEM FIM. A tabela guarda as 200 mudanças mais
//     recentes. Diário de conexão é para responder "o que houve
//     ontem", não para auditoria de um ano.
// ============================================================

import { banco } from '../plugins/banco.js';

/** Quantas mudanças o diário guarda. */
const GUARDAR = 200;

/** Os estados que significam "está no ar agora". */
const NO_AR = new Set(['conectado']);

/** Os estados em que a conexão se perdeu sem ninguém mandar. */
const QUEDA = new Set(['reconectando', 'erro']);

/** Os estados em que a conexão terminou de propósito. */
const FIM = new Set(['desconectado', 'deslogado']);

export interface EventoDaConexao {
  id: string;
  estado: string;
  detalhe: string | null;
  numeroMascarado: string | null;
  quando: Date;
}

/**
 * A FILA, E POR QUE ELA PRECISA EXISTIR.
 *
 * O adaptador avisa sem esperar (`void`), porque gravar o diário
 * não pode atrasar a conexão. Só que uma conexão passa por três
 * estados em dois milissegundos, e três chamadas soltas correm
 * juntas: cada uma lê "qual foi o último?" ANTES de qualquer uma
 * gravar.
 *
 * Isso quebrava as duas coisas que esta função promete:
 *
 *   · a ORDEM — na primeira conexão de verdade, `iniciando` foi
 *     gravado 1ms DEPOIS de `autenticando`, que veio depois dele.
 *     O diário contava a história ao contrário;
 *   · a NÃO REPETIÇÃO — duas chamadas com o mesmo estado leem
 *     "último é outro" ao mesmo tempo, e as duas gravam.
 *
 * Encadear resolve as duas de uma vez, e continua sem fazer
 * ninguém esperar: quem chama solta e segue.
 */
let fila: Promise<void> = Promise.resolve();

/**
 * Registra uma mudança de estado.
 *
 * Nunca lança: o diário é observação, e observação que derruba o
 * observado é pior do que não observar. Se o banco estiver fora,
 * a conexão do WhatsApp segue a vida.
 */
export function anotarEstado(
  estado: string,
  detalhe: string | null,
  numeroMascarado: string | null,
): Promise<void> {
  fila = fila.then(() => gravar(estado, detalhe, numeroMascarado)).catch(() => {});
  return fila;
}

async function gravar(
  estado: string,
  detalhe: string | null,
  numeroMascarado: string | null,
): Promise<void> {
  try {
    const ultimo = await banco.eventoWhatsApp.findFirst({
      orderBy: { quando: 'desc' },
      select: { estado: true },
    });

    //  Estado igual ao último não vira linha nova. Ver (1) acima.
    if (ultimo?.estado === estado) return;

    await banco.eventoWhatsApp.create({
      data: { estado, detalhe, numeroMascarado },
    });

    await podar();
  } catch {
    // Silêncio de propósito. Ver o comentário da função.
  }
}

/** Mantém só as `GUARDAR` mudanças mais recentes. */
async function podar(): Promise<void> {
  const total = await banco.eventoWhatsApp.count();
  if (total <= GUARDAR) return;

  const corte = await banco.eventoWhatsApp.findMany({
    orderBy: { quando: 'desc' },
    skip: GUARDAR,
    select: { id: true },
  });

  if (corte.length > 0) {
    await banco.eventoWhatsApp.deleteMany({
      where: { id: { in: corte.map((e) => e.id) } },
    });
  }
}

/**
 * O BURACO QUE SÓ O RETORNO CONSEGUE TAPAR.
 *
 * Quando a API é desligada ou reiniciada, o adaptador não muda de
 * estado: o processo simplesmente morre. Não há instante nenhum
 * em que ele possa escrever "caí". O diário ficava com a última
 * linha dizendo "conectado" e a conexão, na vida real, no chão.
 *
 * Descobri isto medindo: reiniciei a API quatro vezes durante a
 * construção desta própria tela e o diário continuou com três
 * linhas, todas da primeira conexão.
 *
 * A saída é olhar para trás na PARTIDA. Se a última linha diz que
 * estava no ar e o adaptador acabou de nascer desconectado, então
 * a conexão terminou junto com o processo anterior — e é isso que
 * fica registrado, com essas palavras.
 *
 * A hora anotada é a da partida, não a da queda: ninguém sabe a
 * hora exata em que o processo morreu. Dizer "o sistema voltou às
 * 15:33 e a conexão não veio junto" é verdade; cravar o minuto da
 * queda seria invenção.
 */
export async function conferirPartida(estadoAtual: string): Promise<void> {
  try {
    const ultimo = await banco.eventoWhatsApp.findFirst({
      orderBy: { quando: 'desc' },
      select: { estado: true },
    });

    if (!ultimo) return;
    if (!NO_AR.has(ultimo.estado)) return;
    if (NO_AR.has(estadoAtual)) return;

    await banco.eventoWhatsApp.create({
      data: {
        estado: 'desconectado',
        detalhe:
          'O sistema foi reiniciado e a conexão caiu junto. '
          + 'A sessão continua salva: clique em Conectar para voltar, sem QR novo.',
      },
    });
  } catch {
    // Mesma regra do resto do diário: nunca atrapalhar a partida.
  }
}

/** As últimas mudanças, da mais nova para a mais velha. */
export function listarEventos(quantos = 20): Promise<EventoDaConexao[]> {
  return banco.eventoWhatsApp.findMany({
    orderBy: { quando: 'desc' },
    take: Math.min(Math.max(quantos, 1), GUARDAR),
  });
}

export interface ResumoDaConexao {
  /** Quando a conexão ATUAL começou. Nulo se não está no ar. */
  noArDesde: Date | null;
  /** Quando esteve no ar pela última vez, mesmo que já tenha saído. */
  ultimaVezNoAr: Date | null;
  /** A última vez que a conexão caiu sozinha. */
  ultimaQueda: { quando: Date; detalhe: string | null } | null;
  /** A última vez que alguém encerrou de propósito. */
  ultimoFim: { quando: Date; detalhe: string | null } | null;
  /** Quantas vezes caiu nas últimas 24 horas. */
  quedasEm24h: number;
}

/**
 * O resumo que a tela mostra em cima.
 *
 * `noArDesde` é o começo da conexão ATUAL, não a última vez que
 * alguém conectou: se caiu e voltou, o relógio recomeça. É o que
 * responde "há quanto tempo está de pé AGORA", que é a pergunta
 * de quem olha a tela.
 */
export async function resumirConexao(estadoAtual: string): Promise<ResumoDaConexao> {
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [ultimoNoAr, ultimaQueda, ultimoFim, quedasEm24h] = await Promise.all([
    banco.eventoWhatsApp.findFirst({
      where: { estado: { in: [...NO_AR] } },
      orderBy: { quando: 'desc' },
    }),
    banco.eventoWhatsApp.findFirst({
      where: { estado: { in: [...QUEDA] } },
      orderBy: { quando: 'desc' },
    }),
    banco.eventoWhatsApp.findFirst({
      where: { estado: { in: [...FIM] } },
      orderBy: { quando: 'desc' },
    }),
    banco.eventoWhatsApp.count({
      where: { estado: { in: [...QUEDA] }, quando: { gte: ontem } },
    }),
  ]);

  return {
    noArDesde: NO_AR.has(estadoAtual) ? (ultimoNoAr?.quando ?? null) : null,
    ultimaVezNoAr: ultimoNoAr?.quando ?? null,
    ultimaQueda: ultimaQueda
      ? { quando: ultimaQueda.quando, detalhe: ultimaQueda.detalhe }
      : null,
    ultimoFim: ultimoFim ? { quando: ultimoFim.quando, detalhe: ultimoFim.detalhe } : null,
    quedasEm24h,
  };
}
