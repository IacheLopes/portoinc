// ============================================================
//  O histórico de tudo que o sistema mandou para fora
//
//  Pedido dele em 10/10/2026:
//
//    "coloca em outra aba dentro de comunicações, algo como
//     histórico de mensagens enviadas. Com filtro de dias, anos,
//     paginação... como uma forma de prova que a mensagem foi
//     enviada."
//
//  A palavra que importa é PROVA. O convite de cotação e o pedido
//  de compra saem do sistema e viram compromisso com um
//  fornecedor; quando ele diz "não recebi nada", alguém precisa
//  poder responder com data e hora.
//
//  A tela de cotação hoje não responde isso: ela mostra se o
//  fornecedor ABRIU o link e se RESPONDEU, mas "ainda não
//  visualizou" quer dizer tanto "não abriu" quanto "nunca
//  chegou". Este histórico é o único lugar que separa as duas.
//
//  OS DOIS CANAIS NUMA LISTA SÓ
//
//  WhatsApp e e-mail levam o MESMO convite e o MESMO pedido, e as
//  duas tabelas têm quase a mesma forma. Separar em duas telas
//  obrigaria quem procura "o BID-00005 saiu?" a perguntar duas
//  vezes e juntar de cabeça.
// ============================================================

import { banco } from '../plugins/banco.js';
import { mascarar } from '../integracoes/whatsapp/adaptador.baileys.js';
import { mascararEmail } from './email.js';

export type Canal = 'whatsapp' | 'email';
export type SituacaoEnvio = 'ENVIADA' | 'FALHOU' | 'BLOQUEADA';

export interface ItemDoHistorico {
  id: string;
  canal: Canal;
  /** Para quem foi, sempre mascarado. */
  para: string;
  /** O nome de quem recebeu, quando o envio nasceu de um cadastro. */
  destino: string | null;
  /** O que foi dito: o texto no WhatsApp, o assunto no e-mail. */
  resumo: string;
  temAnexo: boolean;
  situacao: SituacaoEnvio;
  erro: string | null;
  /** De onde partiu: "cotacao", "pedido", "teste". */
  contexto: string | null;
  /** O documento de origem: "BID-00002", "PC-00001". */
  referencia: string | null;
  quem: string | null;
  quando: Date;
}

export interface Filtro {
  canal?: Canal | 'todos';
  situacao?: SituacaoEnvio | 'todas';
  /** Só o que saiu nos últimos N dias. */
  dias?: number;
  /** Busca no destino, na referência e no resumo. */
  termo?: string;
  pagina?: number;
  porPagina?: number;
}

export interface PaginaDoHistorico {
  itens: ItemDoHistorico[];
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
}

const POR_PAGINA_PADRAO = 20;
const POR_PAGINA_MAXIMO = 100;

/**
 * Busca as duas tabelas e devolve UMA página da lista junta.
 *
 * PAGINAR DUAS TABELAS DE UMA VEZ tem uma armadilha: não dá para
 * pedir "a página 3" de cada uma e juntar — a terceira página do
 * WhatsApp e a terceira do e-mail não formam a terceira da lista
 * misturada.
 *
 * O jeito correto é pedir, de cada tabela, tudo o que PODERIA
 * aparecer até o fim da página pedida (`skip + take`), juntar,
 * ordenar por data e só então recortar. No pior caso, uma das
 * tabelas contribui com todas as linhas, e esse "pior caso" é
 * exatamente o que `skip + take` cobre.
 */
export async function buscarHistorico(filtro: Filtro = {}): Promise<PaginaDoHistorico> {
  const pagina = Math.max(1, Math.floor(filtro.pagina ?? 1));
  const porPagina = Math.min(
    Math.max(1, Math.floor(filtro.porPagina ?? POR_PAGINA_PADRAO)),
    POR_PAGINA_MAXIMO,
  );

  const desde =
    filtro.dias && filtro.dias > 0
      ? new Date(Date.now() - filtro.dias * 24 * 60 * 60 * 1000)
      : undefined;

  const situacao = filtro.situacao && filtro.situacao !== 'todas' ? filtro.situacao : undefined;
  const termo = filtro.termo?.trim();

  const comum = {
    ...(desde ? { criadoEm: { gte: desde } } : {}),
    ...(situacao ? { situacao } : {}),
  };

  //  A busca por texto olha o que a pessoa consegue lembrar: o
  //  nome de quem recebeu e o número do documento. O corpo da
  //  mensagem não entra — ninguém procura por "Segue em anexo".
  const buscaWhats = termo
    ? {
        OR: [
          { destino: { contains: termo, mode: 'insensitive' as const } },
          { referencia: { contains: termo, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const buscaEmail = termo
    ? {
        OR: [
          { destino: { contains: termo, mode: 'insensitive' as const } },
          { referencia: { contains: termo, mode: 'insensitive' as const } },
          { assunto: { contains: termo, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const querWhats = filtro.canal !== 'email';
  const querEmail = filtro.canal !== 'whatsapp';

  const ate = pagina * porPagina;

  const [whats, emails, totalWhats, totalEmails] = await Promise.all([
    querWhats
      ? banco.mensagemEnviada.findMany({
          where: { ...comum, ...buscaWhats },
          include: { enviadoPor: { select: { nome: true } } },
          orderBy: { criadoEm: 'desc' },
          take: ate,
        })
      : [],
    querEmail
      ? banco.emailEnviado.findMany({
          where: { ...comum, ...buscaEmail },
          include: { enviadoPor: { select: { nome: true } } },
          orderBy: { criadoEm: 'desc' },
          take: ate,
        })
      : [],
    querWhats ? banco.mensagemEnviada.count({ where: { ...comum, ...buscaWhats } }) : 0,
    querEmail ? banco.emailEnviado.count({ where: { ...comum, ...buscaEmail } }) : 0,
  ]);

  const juntos: ItemDoHistorico[] = [
    ...whats.map((m) => ({
      id: m.id,
      canal: 'whatsapp' as const,
      para: mascarar(m.numero),
      destino: m.destino,
      resumo: m.texto,
      temAnexo: m.temAnexo,
      situacao: m.situacao as SituacaoEnvio,
      erro: m.erro,
      contexto: m.contexto,
      referencia: m.referencia,
      quem: m.enviadoPor?.nome ?? null,
      quando: m.criadoEm,
    })),
    ...emails.map((m) => ({
      id: m.id,
      canal: 'email' as const,
      para: mascararEmail(m.para),
      destino: m.destino,
      resumo: m.assunto,
      temAnexo: m.temAnexo,
      situacao: m.situacao as SituacaoEnvio,
      erro: m.erro,
      contexto: m.contexto,
      referencia: m.referencia,
      quem: m.enviadoPor?.nome ?? null,
      quando: m.criadoEm,
    })),
  ].sort((a, b) => b.quando.getTime() - a.quando.getTime());

  const total = totalWhats + totalEmails;
  const inicio = (pagina - 1) * porPagina;

  return {
    itens: juntos.slice(inicio, inicio + porPagina),
    total,
    pagina,
    porPagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}
