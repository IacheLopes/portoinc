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

import type { PortaEmail } from './email/porta.js';
import { AdaptadorEmailMock } from './email/adaptador.mock.js';
import { AdaptadorEmailResend } from './email/adaptador.resend.js';

function montarWhatsApp(): PortaWhatsApp {
  switch (ambiente.WHATSAPP_ADAPTER) {
    case 'baileys':
      return new AdaptadorWhatsAppBaileys(
        process.env.WHATSAPP_SESSAO_DIR ?? "/app/sessao-whatsapp",
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
  if (ambiente.EMAIL_ADAPTER === 'resend') {
    return new AdaptadorEmailResend(
      ambiente.EMAIL_API_TOKEN ?? '',
      ambiente.EMAIL_REMETENTE ?? '',
    );
  }
  return new AdaptadorEmailMock();
}

export const integracoes = {
  whatsapp: montarWhatsApp(),
  fiscal: montarFiscal(),
  pagamento: montarPagamento(),
  email: montarEmail(),
};

/** Resumo do que esta ligado, mostrado na tela de status. */
export function resumoIntegracoes() {
  return [
    {
      area: 'WhatsApp',
      adaptador: integracoes.whatsapp.nome,
      simulado: integracoes.whatsapp.nome === 'mock',
      descricao: 'Avisos de cotação, aprovação e pedido',
    },
    {
      area: 'Fiscal (NF-e)',
      adaptador: integracoes.fiscal.nome,
      simulado: integracoes.fiscal.nome === 'mock',
      descricao: 'Conferência da nota contra o pedido',
    },
    {
      area: 'Pagamento',
      adaptador: integracoes.pagamento.nome,
      simulado: integracoes.pagamento.nome === 'mock',
      descricao: 'Envio da ordem para contas a pagar',
    },
    {
      area: 'E-mail',
      adaptador: integracoes.email.nome,
      simulado: integracoes.email.nome === 'mock',
      descricao: 'Convite de cotação e pedido enviados ao fornecedor',
    },
  ];
}
