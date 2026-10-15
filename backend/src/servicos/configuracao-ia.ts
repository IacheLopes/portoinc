// ============================================================
//  O CÉREBRO, configurado pela tela
//
//  Mesmo desenho da configuração de e-mail, e pelo mesmo motivo:
//  ligar o assistente não pode exigir abrir o `.env` no servidor
//  e reiniciar a API.
//
//  POR QUE TEM CACHE AQUI
//
//  A porta da IA é montada UMA vez, quando a API sobe. O
//  atendimento precisa saber o nome do assistente e se ele
//  responde sozinho a cada mensagem que chega — e ir ao banco a
//  cada mensagem, num grupo movimentado, é desperdício. O cache
//  é atualizado na partida e a cada vez que alguém salva.
// ============================================================

import { banco } from '../plugins/banco.js';
import { cifrar, decifrar } from './segredos.js';

export interface CerebroVivo {
  /** O nome por que ele atende. É o gatilho no grupo. */
  nome: string;
  /** O que o dono escreveu para moldar o jeito dele. */
  instrucoes: string | null;
  modelo: string | null;
  chave: string | null;
  ativo: boolean;
  responderNoPrivado: boolean;
  exigirNomeEmGrupo: boolean;
  transcreverAudio: boolean;
  limitePorHora: number;
  confirmadoEm: Date | null;
  atualizadoEm: Date | null;
}

/**
 * O padrão de uma instalação nova.
 *
 * `ativo` nasce FALSO: nada responde antes de alguém ligar.
 *
 * NÃO HÁ MAIS MODO RASCUNHO. Ele existiu enquanto a regra da casa
 * era "nada sai sem alguém mandar", e virou armadilha: em
 * 14/10/2026 o assistente ficou no ar, pensando e mudo, porque
 * essa chave tinha ficado desligada de um conserto anterior.
 * Ligado é ligado.
 */
const PADRAO: CerebroVivo = {
  nome: 'Porto',
  instrucoes: null,
  modelo: null,
  chave: null,
  ativo: false,
  responderNoPrivado: true,
  exigirNomeEmGrupo: true,
  transcreverAudio: true,
  limitePorHora: 30,
  confirmadoEm: null,
  atualizadoEm: null,
};

let emMemoria: CerebroVivo = { ...PADRAO };

export function cerebro(): CerebroVivo {
  return emMemoria;
}

export async function recarregar(): Promise<CerebroVivo> {
  try {
    const linha = await banco.configuracaoIA.findUnique({ where: { id: 'unico' } });

    if (!linha) {
      emMemoria = { ...PADRAO };
      return emMemoria;
    }

    let chave: string | null = null;
    if (linha.chaveCifrada) {
      try {
        chave = decifrar(linha.chaveCifrada);
      } catch {
        //  Segredo ilegível vira "sem chave", não erro. Acontece
        //  quando o JWT_SECRET muda ou o backup veio de outra
        //  máquina — e a tela pede para cadastrar de novo.
        chave = null;
      }
    }

    emMemoria = {
      nome: linha.nome,
      instrucoes: linha.instrucoes,
      modelo: linha.modelo,
      chave,
      ativo: linha.ativo,
      responderNoPrivado: linha.responderNoPrivado,
      exigirNomeEmGrupo: linha.exigirNomeEmGrupo,
      transcreverAudio: linha.transcreverAudio,
      limitePorHora: linha.limitePorHora,
      confirmadoEm: linha.confirmadoEm,
      atualizadoEm: linha.atualizadoEm,
    };

    return emMemoria;
  } catch {
    //  Banco fora do ar na partida não pode impedir a API de
    //  subir: o resto da empresa trabalha sem o assistente.
    return emMemoria;
  }
}

export interface AjusteDoCerebro {
  nome?: string;
  instrucoes?: string | null;
  modelo?: string | null;
  chave?: string;
  ativo?: boolean;
  responderNoPrivado?: boolean;
  exigirNomeEmGrupo?: boolean;
  transcreverAudio?: boolean;
  limitePorHora?: number;
  confirmadoEm?: Date | null;
  quem?: string;
}

export async function salvar(ajuste: AjusteDoCerebro): Promise<CerebroVivo> {
  //  A CHAVE SÓ É REESCRITA QUANDO VEM UMA NOVA.
  //
  //  A tela devolve a chave mascarada ao carregar; se ela
  //  chegasse de volta como valor, salvar qualquer outro campo
  //  gravaria os pontinhos por cima do segredo e quebraria o
  //  envio em silêncio.
  const dados = {
    ...(ajuste.nome !== undefined ? { nome: ajuste.nome } : {}),
    ...(ajuste.instrucoes !== undefined ? { instrucoes: ajuste.instrucoes } : {}),
    ...(ajuste.modelo !== undefined ? { modelo: ajuste.modelo } : {}),
    ...(ajuste.chave ? { chaveCifrada: cifrar(ajuste.chave) } : {}),
    ...(ajuste.ativo !== undefined ? { ativo: ajuste.ativo } : {}),
    ...(ajuste.responderNoPrivado !== undefined ? { responderNoPrivado: ajuste.responderNoPrivado } : {}),
    ...(ajuste.exigirNomeEmGrupo !== undefined ? { exigirNomeEmGrupo: ajuste.exigirNomeEmGrupo } : {}),
    ...(ajuste.transcreverAudio !== undefined ? { transcreverAudio: ajuste.transcreverAudio } : {}),
    ...(ajuste.limitePorHora !== undefined ? { limitePorHora: ajuste.limitePorHora } : {}),
    ...(ajuste.confirmadoEm !== undefined ? { confirmadoEm: ajuste.confirmadoEm } : {}),
    ...(ajuste.quem !== undefined ? { atualizadoPor: ajuste.quem } : {}),
  };

  await banco.configuracaoIA.upsert({
    where: { id: 'unico' },
    create: { id: 'unico', ...dados },
    update: dados,
  });

  return recarregar();
}

/** Mostra que existe sem mostrar o que é. */
export function chaveMascarada(chave: string | null): string | null {
  if (!chave) return null;
  return '•'.repeat(8) + chave.slice(-4);
}
