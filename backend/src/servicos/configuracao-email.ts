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

export type Provedor = 'RESEND' | 'SMTP';

export interface ConfiguracaoViva {
  provedor: Provedor;
  remetente: string;
  /** O segredo: token da API no Resend, senha no SMTP. */
  chave: string;
  /** Só no SMTP. */
  smtp: { host: string; porta: number; usuario: string } | null;
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

    const provedor: Provedor = linha.provedor === 'SMTP' ? 'SMTP' : 'RESEND';

    //  SMTP SEM SERVIDOR NÃO É CONFIGURAÇÃO, é configuração pela
    //  metade. Deixar passar faria o envio falhar na hora de
    //  mandar, longe da tela onde dá para consertar.
    if (provedor === 'SMTP' && (!linha.smtpHost || !linha.smtpPorta || !linha.smtpUsuario)) {
      emMemoria = null;
      return null;
    }

    emMemoria = {
      provedor,
      remetente: linha.remetente,
      chave,
      smtp:
        provedor === 'SMTP'
          ? {
              host: linha.smtpHost as string,
              porta: linha.smtpPorta as number,
              usuario: linha.smtpUsuario as string,
            }
          : null,
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
  provedor: Provedor;
  remetente: string | null;
  /** Só no SMTP, e sem a senha: ela nunca volta para a tela. */
  smtp: { host: string; porta: number; usuario: string } | null;
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
      provedor: 'RESEND',
      remetente: null,
      smtp: null,
      chaveParcial: null,
      confirmadoEm: null,
      atualizadoEm: null,
      atualizadoPor: null,
      ativo: false,
    };
  }

  const chave = decifrar(linha.chaveCifrada);

  const provedor: Provedor = linha.provedor === 'SMTP' ? 'SMTP' : 'RESEND';

  return {
    configurado: chave !== null,
    provedor,
    remetente: linha.remetente,
    smtp:
      provedor === 'SMTP' && linha.smtpHost && linha.smtpPorta && linha.smtpUsuario
        ? { host: linha.smtpHost, porta: linha.smtpPorta, usuario: linha.smtpUsuario }
        : null,
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
  provedor?: Provedor;
  remetente: string;
  chave: string;
  smtp?: { host: string; porta: number; usuario: string } | null;
  quem: string | null;
}): Promise<void> {
  const provedor: Provedor = dados.provedor ?? 'RESEND';

  const valores = {
    provedor,
    remetente: dados.remetente.trim(),
    chaveCifrada: cifrar(dados.chave.trim()),
    //  OS CAMPOS DO SMTP SÃO LIMPOS ao voltar para o Resend.
    //  Deixar sobra de uma configuração antiga faz a próxima
    //  pessoa depurar um servidor que ninguém mandou usar.
    smtpHost: provedor === 'SMTP' ? (dados.smtp?.host.trim() ?? null) : null,
    smtpPorta: provedor === 'SMTP' ? (dados.smtp?.porta ?? null) : null,
    smtpUsuario: provedor === 'SMTP' ? (dados.smtp?.usuario.trim() ?? null) : null,
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
