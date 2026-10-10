// ============================================================
//  A configuração de e-mail que vem da TELA, não do servidor
//
//  Pedido dele em 10/10/2026:
//
//    "o domínio vai vir quando formos lançar, mas a estrutura
//     tem que ficar pronta, pra só cadastrar o e-mail da Porto e
//     já funcionar"
//
//  Antes disto, ligar o e-mail era abrir o `.env` NO SERVIDOR,
//  escrever duas variáveis e reiniciar a API. No dia do
//  lançamento, alguém da AV2 Tech precisava estar presente.
//
//  POR QUE EXISTE UM CACHE AQUI
//
//  As integrações são montadas UMA VEZ, quando a API sobe
//  (`integracoes/index.ts`). O adaptador precisa responder
//  `pronto()` e `remetente()` sem esperar o banco — são chamados
//  no meio do desenho da tela de status.
//
//  O cache resolve isso e é atualizado em dois momentos: na
//  partida e a cada vez que alguém salva pela tela. Sem ele, ou
//  a porta inteira vira assíncrona (e contamina quem a usa), ou
//  "salvar e já funcionar" seria mentira e pediria reinício.
// ============================================================

import { banco } from '../plugins/banco.js';
import { cifrar, decifrar, mostrarFim } from './segredos.js';

export interface ConfiguracaoViva {
  remetente: string;
  chave: string;
  confirmadoEm: Date | null;
  atualizadoEm: Date;
}

/** O que está valendo agora. `null` = nada configurado pela tela. */
let emMemoria: ConfiguracaoViva | null = null;

/** Lê o banco e atualiza o cache. Chamado na partida e a cada salvamento. */
export async function recarregar(): Promise<ConfiguracaoViva | null> {
  try {
    const linha = await banco.configuracaoEmail.findUnique({ where: { id: 'unico' } });

    if (!linha || !linha.ativo) {
      emMemoria = null;
      return null;
    }

    const chave = decifrar(linha.chaveCifrada);

    //  Segredo ilegível vira "não configurado", não erro. Acontece
    //  quando o JWT_SECRET muda ou o backup veio de outro
    //  ambiente — e a tela pede para cadastrar de novo.
    if (!chave) {
      emMemoria = null;
      return null;
    }

    emMemoria = {
      remetente: linha.remetente,
      chave,
      confirmadoEm: linha.confirmadoEm,
      atualizadoEm: linha.atualizadoEm,
    };
    return emMemoria;
  } catch {
    //  Banco fora não pode derrubar a partida da API.
    emMemoria = null;
    return null;
  }
}

/** O que está valendo, sem ir ao banco. */
export function configuracaoAtual(): ConfiguracaoViva | null {
  return emMemoria;
}

export interface ResumoDaConfiguracao {
  configurado: boolean;
  remetente: string | null;
  /** Só o fim da chave, para reconhecer qual é. Nunca ela inteira. */
  chaveParcial: string | null;
  confirmadoEm: Date | null;
  atualizadoEm: Date | null;
  atualizadoPor: string | null;
  ativo: boolean;
}

/** O que a tela pode ver. A chave NUNCA volta inteira. */
export async function resumir(): Promise<ResumoDaConfiguracao> {
  const linha = await banco.configuracaoEmail.findUnique({ where: { id: 'unico' } });

  if (!linha) {
    return {
      configurado: false,
      remetente: null,
      chaveParcial: null,
      confirmadoEm: null,
      atualizadoEm: null,
      atualizadoPor: null,
      ativo: false,
    };
  }

  const chave = decifrar(linha.chaveCifrada);

  return {
    configurado: chave !== null,
    remetente: linha.remetente,
    chaveParcial: chave ? mostrarFim(chave) : null,
    confirmadoEm: linha.confirmadoEm,
    atualizadoEm: linha.atualizadoEm,
    atualizadoPor: linha.atualizadoPor,
    ativo: linha.ativo,
  };
}

/**
 * Guarda a configuração e passa a valer na hora.
 *
 * Não marca como confirmada: quem confirma é um envio que chegou.
 * Ver a rota, que manda um e-mail de teste logo em seguida.
 */
export async function guardar(dados: {
  remetente: string;
  chave: string;
  quem: string | null;
}): Promise<void> {
  const valores = {
    remetente: dados.remetente.trim(),
    chaveCifrada: cifrar(dados.chave.trim()),
    ativo: true,
    confirmadoEm: null,
    atualizadoPor: dados.quem,
  };

  await banco.configuracaoEmail.upsert({
    where: { id: 'unico' },
    create: { id: 'unico', ...valores },
    update: valores,
  });

  await recarregar();
}

/** Marca que um envio de verdade chegou. É o que vira "funcionando". */
export async function confirmar(): Promise<void> {
  await banco.configuracaoEmail
    .update({ where: { id: 'unico' }, data: { confirmadoEm: new Date() } })
    .catch(() => {
      /* sem configuração salva não há o que confirmar */
    });

  await recarregar();
}

/**
 * Desliga sem apagar.
 *
 * Serve para parar o envio num incidente e religar depois sem
 * redigitar a chave — que é quando ninguém lembra dela.
 */
export async function desligar(): Promise<void> {
  await banco.configuracaoEmail
    .update({ where: { id: 'unico' }, data: { ativo: false } })
    .catch(() => {
      /* nada configurado: já está desligado */
    });

  await recarregar();
}

/** Liga de novo o que foi desligado. */
export async function religar(): Promise<void> {
  await banco.configuracaoEmail
    .update({ where: { id: 'unico' }, data: { ativo: true } })
    .catch(() => {
      /* nada configurado: não há o que religar */
    });

  await recarregar();
}
