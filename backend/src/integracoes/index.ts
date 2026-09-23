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

import type { PortaGtin } from './gtin/porta.js';
import { AdaptadorGtinMock } from './gtin/adaptador.mock.js';
import { AdaptadorGtinGs1 } from './gtin/adaptador.gs1.js';

import type { PortaPagamento } from './pagamento/porta.js';
import { AdaptadorPagamentoMock } from './pagamento/adaptador.mock.js';
import { AdaptadorPagamentoCnab } from './pagamento/adaptador.cnab.js';

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

function montarGtin(): PortaGtin {
  if (ambiente.GTIN_ADAPTER === 'gs1') {
    return new AdaptadorGtinGs1(ambiente.GS1_TOKEN ?? '');
  }
  return new AdaptadorGtinMock();
}

function montarPagamento(): PortaPagamento {
  if (ambiente.PAGAMENTO_ADAPTER === 'cnab') {
    return new AdaptadorPagamentoCnab(ambiente.BANCO_CODIGO ?? '');
  }
  return new AdaptadorPagamentoMock();
}

export const integracoes = {
  whatsapp: montarWhatsApp(),
  fiscal: montarFiscal(),
  gtin: montarGtin(),
  pagamento: montarPagamento(),
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
      area: 'Código de barras',
      adaptador: integracoes.gtin.nome,
      simulado: integracoes.gtin.nome === 'mock',
      descricao: 'Identificação do produto ao bipar',
    },
    {
      area: 'Pagamento',
      adaptador: integracoes.pagamento.nome,
      simulado: integracoes.pagamento.nome === 'mock',
      descricao: 'Envio da ordem para contas a pagar',
    },
  ];
}
