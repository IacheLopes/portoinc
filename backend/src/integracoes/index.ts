// ============================================================
//  QUADRO DE TOMADAS
//
//  Aqui decidimos QUAL adaptador sera ligado em cada porta,
//  lendo o arquivo .env. Este e o unico lugar do sistema que
//  conhece os adaptadores concretos.
//
//  Para trocar uma integracao, muda-se UMA linha no .env
//  e reinicia o container. Nenhum outro arquivo precisa mudar.
// ============================================================

import { ambiente } from '../config/ambiente.js';
import { anotarEstado } from '../servicos/diario-whatsapp.js';

import type { PortaWhatsApp } from './whatsapp/porta.js';
import { AdaptadorWhatsAppMock } from './whatsapp/adaptador.mock.js';
import { AdaptadorWhatsAppBaileys } from './whatsapp/adaptador.baileys.js';
import { AdaptadorWhatsAppCloudApi } from './whatsapp/adaptador.cloud-api.js';

import type { PortaFiscal } from './fiscal/porta.js';
import { AdaptadorFiscalMock } from './fiscal/adaptador.mock.js';
import { AdaptadorFiscalSefaz } from './fiscal/adaptador.sefaz.js';

import type { PortaPagamento } from './pagamento/porta.js';
import { AdaptadorPagamentoMock } from './pagamento/adaptador.mock.js';
import { AdaptadorPagamentoCnab } from './pagamento/adaptador.cnab.js';

import type { PortaIA } from './ia/porta.js';
import { AdaptadorIaMock } from './ia/adaptador.mock.js';
import { AdaptadorIaGroq } from './ia/adaptador.groq.js';
import { AdaptadorIaConfiguravel } from './ia/adaptador.configuravel.js';

import type { PortaEmail } from './email/porta.js';
import { AdaptadorEmailMock } from './email/adaptador.mock.js';
import { AdaptadorEmailResend } from './email/adaptador.resend.js';
import { AdaptadorEmailConfiguravel } from './email/adaptador.configuravel.js';
import { AdaptadorEmailDesligado } from './email/adaptador.desligado.js';

function montarWhatsApp(): PortaWhatsApp {
  switch (ambiente.WHATSAPP_ADAPTER) {
    case 'baileys':
      //  O segundo argumento e o DIARIO: o adaptador avisa cada
      //  mudanca de estado, e aqui — o unico lugar que conhece os
      //  dois lados — isso vira linha no banco. Ver
      //  `servicos/diario-whatsapp.ts`.
      return new AdaptadorWhatsAppBaileys(
        process.env.WHATSAPP_SESSAO_DIR ?? "/app/sessao-whatsapp",
        (estado, detalhe, numero) => {
          void anotarEstado(estado, detalhe, numero);
        },
      );
    case 'cloud-api':
      return new AdaptadorWhatsAppCloudApi(
        ambiente.WHATSAPP_CLOUD_TOKEN ?? '',
        ambiente.WHATSAPP_CLOUD_PHONE_ID ?? '',
      );
    default:
      return new AdaptadorWhatsAppMock();
  }
}

function montarFiscal(): PortaFiscal {
  if (ambiente.FISCAL_ADAPTER === 'sefaz') {
    return new AdaptadorFiscalSefaz(
      ambiente.SEFAZ_CERTIFICADO_CAMINHO ?? '',
      ambiente.SEFAZ_CERTIFICADO_SENHA ?? '',
    );
  }
  return new AdaptadorFiscalMock();
}

function montarPagamento(): PortaPagamento {
  if (ambiente.PAGAMENTO_ADAPTER === 'cnab') {
    return new AdaptadorPagamentoCnab(ambiente.BANCO_CODIGO ?? '');
  }
  return new AdaptadorPagamentoMock();
}

function montarEmail(): PortaEmail {
  //  A RESERVA: o que o `.env` manda, como sempre mandou.
  //
  //  SEM CONFIGURACAO, O E-MAIL FICA DESLIGADO — nao simulado.
  //  Mudou em 15/10/2026. O simulado dizia "enviei" sem nada sair,
  //  e a tela ficava verde: alguem reiniciaria o sistema um dia
  //  achando que estava tudo de pe, e os convites de cotacao
  //  parariam de chegar sem ninguem perceber.
  //
  //  O `mock` continua existindo, mas so para as PROVAS, que
  //  precisam de um envio que sempre funciona. Ele so entra quando
  //  alguem escreve `EMAIL_ADAPTER=mock` de proposito.
  const reserva =
    ambiente.EMAIL_ADAPTER === 'resend'
      ? new AdaptadorEmailResend(
          ambiente.EMAIL_API_TOKEN ?? '',
          ambiente.EMAIL_REMETENTE ?? '',
        )
      : ambiente.EMAIL_ADAPTER === 'mock'
        ? new AdaptadorEmailMock()
        : new AdaptadorEmailDesligado();

  //  E por cima dela, o que a TELA configurar.
  //
  //  Esta ordem importa: quem ligou o e-mail pela tela mandou
  //  depois de quem escreveu no `.env`, e a decisao mais recente
  //  e a que vale. O `.env` continua funcionando para quem ja
  //  dependia dele — nada do que existe hoje quebra.
  return new AdaptadorEmailConfiguravel(reserva);
}

/**
 * A IA de reserva: o que o `.env` manda.
 *
 * Fica FORA da funcao de montagem para as provas conseguirem
 * alcanca-la. Uma prova de ponta a ponta precisa roteirizar o que
 * o modelo responde — senao ela testa a Groq, nao o nosso codigo,
 * e passa a depender de internet e de cota.
 */
const reservaDaIA: PortaIA =
  ambiente.IA_ADAPTER === 'groq' && ambiente.IA_API_TOKEN
    ? new AdaptadorIaGroq({
        token: ambiente.IA_API_TOKEN,
        modelo: ambiente.IA_MODELO,
      })
    : new AdaptadorIaMock();

/** O simulado, quando e ele que esta ligado. So as provas usam. */
export const iaSimulada: AdaptadorIaMock | null =
  reservaDaIA instanceof AdaptadorIaMock ? reservaDaIA : null;

function montarIA(): PortaIA {
  //  SEM CHAVE, SIMULADO. Nao e detalhe: o assistente de WhatsApp
  //  so existe quando ha chave, e uma instalacao nova nao tem
  //  nenhuma. Cair no simulado deixa o sistema subir inteiro e a
  //  tela dizer o que falta, em vez de quebrar na partida.
  //  E por cima da reserva, o que a AREA IA configurar. Mesma
  //  ordem do e-mail: quem mexeu na tela mexeu depois de quem
  //  escreveu no .env, e a decisao mais recente e a que vale.
  return new AdaptadorIaConfiguravel(reservaDaIA);
}

export const integracoes = {
  whatsapp: montarWhatsApp(),
  ia: montarIA(),
  fiscal: montarFiscal(),
  pagamento: montarPagamento(),
  email: montarEmail(),
};

/**
 * Resumo do que esta ligado, mostrado na tela de status.
 *
 * SAO TRES ESTADOS, nao dois. Ate 15/10/2026 havia so "simulado"
 * e "ativo", e o e-mail desligado aparecia como ATIVO — porque
 * nao era simulado. Verde na tela e nada saindo e a pior
 * combinacao possivel.
 *
 *   simulado  — finge que faz, para a estrutura poder ser testada
 *   desligado — nao finge nada: falta configurar
 *   ativo     — faz de verdade
 */
export function resumoIntegracoes() {
  return [
    {
      area: 'WhatsApp',
      adaptador: integracoes.whatsapp.nome,
      simulado: integracoes.whatsapp.nome === 'mock',
      pronto: integracoes.whatsapp.estado() === 'conectado',
      descricao: 'Avisos de cotação, aprovação e pedido',
    },
    {
      area: 'Assistente de IA',
      adaptador: integracoes.ia.nome,
      simulado: integracoes.ia.nome === 'mock',
      pronto: integracoes.ia.pronto(),
      descricao: 'Responde no WhatsApp com base no sistema',
    },
    {
      area: 'Fiscal (NF-e)',
      adaptador: integracoes.fiscal.nome,
      simulado: integracoes.fiscal.nome === 'mock',
      pronto: integracoes.fiscal.nome !== 'mock',
      descricao: 'Conferência da nota contra o pedido',
    },
    {
      area: 'Pagamento',
      adaptador: integracoes.pagamento.nome,
      simulado: integracoes.pagamento.nome === 'mock',
      pronto: integracoes.pagamento.nome !== 'mock',
      descricao: 'Envio da ordem para contas a pagar',
    },
    {
      area: 'E-mail',
      adaptador: integracoes.email.nome,
      simulado: integracoes.email.nome === 'mock',
      pronto: integracoes.email.pronto(),
      descricao: 'Convite de cotação e pedido enviados ao fornecedor',
    },
  ];
}
