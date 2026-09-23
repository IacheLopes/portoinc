// ============================================================
//  ADAPTADOR SEFAZ (NF-e real) - AGUARDANDO CERTIFICADO
//
//  Estrutura pronta. Para ativar sao necessarios:
//    1. Certificado digital A1 do CNPJ da Porto Inc. (arquivo .pfx)
//    2. No .env:
//         SEFAZ_CERTIFICADO_CAMINHO=/app/certificados/empresa.pfx
//         SEFAZ_CERTIFICADO_SENHA=...
//         SEFAZ_CNPJ=...
//         SEFAZ_UF=SP
//    3. No .env: FISCAL_ADAPTER=sefaz
//
//  OBSERVACAO TECNICA IMPORTANTE:
//  Nao existe "baixar o PDF na Receita". O que se baixa e o XML
//  pelo servico NFeDistribuicaoDFe. O PDF (DANFE) e gerado por
//  nos a partir desse XML.
// ============================================================

import type { PortaFiscal, NotaFiscal } from './porta.js';

const NAO_ATIVADO =
  'Integracao com o SEFAZ ainda nao ativada: falta o certificado digital A1.';

export class AdaptadorFiscalSefaz implements PortaFiscal {
  readonly nome = 'sefaz';

  constructor(
    private readonly caminhoCertificado: string,
    private readonly senhaCertificado: string,
  ) {}

  disponivel(): boolean {
    return Boolean(this.caminhoCertificado && this.senhaCertificado);
  }

  async consultarPorChave(_chave: string): Promise<NotaFiscal | null> {
    throw new Error(NAO_ATIVADO);
  }

  async listarNotasRecebidas(_desde: Date): Promise<NotaFiscal[]> {
    throw new Error(NAO_ATIVADO);
  }
}
