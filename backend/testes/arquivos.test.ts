// ============================================================
//  Arquivamento da nota fiscal
//
//  O fluxo de compras pede a nota "arquivada em PDF". São dois
//  caminhos:
//
//  - o fornecedor mandou o PDF ou o XML  -> guardamos o arquivo
//  - a nota foi digitada à mão           -> geramos o espelho
//
//  O que não pode acontecer em hipótese alguma é o arquivo voltar
//  diferente do que entrou: é documento fiscal.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let almoxarife = '';
let fornecedorId = '';
let notaId = '';

const CNPJ = '05570714000159';

/** Um PDF mínimo, mas PDF de verdade: começa com %PDF-. */
const PDF_FALSO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'latin1',
);

const XML_FALSO = Buffer.from(
  '<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe123"/></NFe></nfeProc>',
  'utf8',
);

function resumo(b: Buffer): string {
  return createHash('sha256').update(b).digest('hex');
}

before(async () => {
  await limparDados();

  await criarUsuarioTeste('admin-arq@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('almox-arq@teste.com.br', ['ALMOXARIFE']);

  admin = await entrarComo('admin-arq@teste.com.br');
  almoxarife = await entrarComo('almox-arq@teste.com.br');

  const familia = await chamar('/api/familias', {
    metodo: 'POST', token: admin,
    corpo: { codigo: 'ARQ', nome: 'Família do arquivamento' },
  });

  const f = await chamar('/api/fornecedores', {
    metodo: 'POST', token: admin,
    corpo: {
      razaoSocial: 'Fornecedor do Arquivo Ltda',
      cnpj: CNPJ,
      email: 'contato@fornecedorarquivo.com.br',
      familias: [familia.corpo.familia.id],
    },
  });
  fornecedorId = f.corpo.fornecedor.id;

  const nota = await chamar('/api/notas-fiscais', {
    metodo: 'POST', token: admin,
    corpo: {
      numero: '12345',
      serie: '1',
      fornecedorId,
      emitidaEm: new Date().toISOString(),
      valorTotal: 1500,
      valorProdutos: 1400,
      valorFrete: 100,
      itens: [
        {
          descricao: 'Cimento Portland CP-II',
          unidade: 'SC',
          quantidade: 40,
          valorUnitario: 35,
          valorTotal: 1400,
        },
      ],
    },
  });

  notaId = nota.corpo.nota.id;
});

after(encerrar);

describe('O espelho em PDF', () => {
  it('sai como PDF de verdade, para anexar e imprimir', async () => {
    const r = await chamar('/api/notas-fiscais/' + notaId + '/pdf', { token: admin });

    assert.equal(r.status, 200);
    assert.match(r.tipo, /application\/pdf/);
    assert.match(r.anexo, /\.pdf/);
    assert.equal(
      r.bruto.subarray(0, 5).toString('latin1'),
      '%PDF-',
      'o arquivo precisa começar com a assinatura de PDF',
    );
    assert.ok(r.tamanho > 900, 'PDF pequeno demais: provavelmente saiu vazio');
  });

  it('nota que não existe devolve 404', async () => {
    const r = await chamar(
      '/api/notas-fiscais/00000000-0000-0000-0000-000000000000/pdf',
      { token: admin },
    );

    assert.equal(r.status, 404);
  });

  it('quem não vê o financeiro não baixa a nota', async () => {
    const r = await chamar('/api/notas-fiscais/' + notaId + '/pdf', { token: almoxarife });
    assert.equal(r.status, 403);
  });
});

describe('Guardar o arquivo do fornecedor', () => {
  it('guarda o PDF e devolve a ficha', async () => {
    const r = await chamar('/api/notas-fiscais/' + notaId + '/arquivos', {
      metodo: 'POST', token: admin,
      corpo: {
        nomeArquivo: 'NF-12345.pdf',
        tipoMime: 'application/pdf',
        conteudoBase64: PDF_FALSO.toString('base64'),
      },
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.arquivo.tipo, 'PDF_NFE');
    assert.equal(r.corpo.arquivo.nomeOriginal, 'NF-12345.pdf');
    assert.equal(r.corpo.arquivo.tamanho, PDF_FALSO.length);
  });

  it('guarda o XML também', async () => {
    const r = await chamar('/api/notas-fiscais/' + notaId + '/arquivos', {
      metodo: 'POST', token: admin,
      corpo: {
        nomeArquivo: 'NF-12345.xml',
        tipoMime: 'text/xml',
        conteudoBase64: XML_FALSO.toString('base64'),
      },
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.arquivo.tipo, 'XML_NFE');
  });

  it('RECUSA o que não é nota fiscal', async () => {
    // O arquivamento não pode virar depósito de executável.
    const r = await chamar('/api/notas-fiscais/' + notaId + '/arquivos', {
      metodo: 'POST', token: admin,
      corpo: {
        nomeArquivo: 'coisa.exe',
        tipoMime: 'application/x-msdownload',
        conteudoBase64: Buffer.from('MZ programa').toString('base64'),
      },
    });

    assert.equal(r.status, 400);
    assert.match(r.corpo.erro, /PDF e XML/);
  });

  it('o arquivo aparece na lista da nota', async () => {
    const r = await chamar('/api/notas-fiscais/' + notaId + '/arquivos', { token: admin });

    assert.equal(r.status, 200);
    assert.ok(r.corpo.arquivos.length >= 2, 'era para ter o PDF e o XML');

    const nomes = r.corpo.arquivos.map((a: { nomeOriginal: string }) => a.nomeOriginal);
    assert.ok(nomes.includes('NF-12345.pdf'));
    assert.ok(nomes.includes('NF-12345.xml'));

    for (const a of r.corpo.arquivos) {
      assert.ok(a.tamanhoLegivel, 'a tela precisa do tamanho em algo legível');
      assert.ok(a.enviadoPor, 'documento fiscal guardado sem dono não serve');
    }
  });

  it('nota que não existe devolve 404', async () => {
    const r = await chamar(
      '/api/notas-fiscais/00000000-0000-0000-0000-000000000000/arquivos',
      {
        metodo: 'POST', token: admin,
        corpo: {
          nomeArquivo: 'x.pdf',
          tipoMime: 'application/pdf',
          conteudoBase64: PDF_FALSO.toString('base64'),
        },
      },
    );

    assert.equal(r.status, 404);
  });

  it('quem só VÊ o financeiro não guarda arquivo', async () => {
    const r = await chamar('/api/notas-fiscais/' + notaId + '/arquivos', {
      metodo: 'POST', token: almoxarife,
      corpo: {
        nomeArquivo: 'x.pdf',
        tipoMime: 'application/pdf',
        conteudoBase64: PDF_FALSO.toString('base64'),
      },
    });

    assert.equal(r.status, 403);
  });
});

describe('Ler o arquivo de volta', () => {
  it('volta BYTE A BYTE igual ao que entrou', async () => {
    // É documento fiscal: um byte diferente é outro documento.
    const lista = await chamar('/api/notas-fiscais/' + notaId + '/arquivos', { token: admin });
    const pdf = lista.corpo.arquivos.find(
      (a: { nomeOriginal: string }) => a.nomeOriginal === 'NF-12345.pdf',
    );

    const r = await chamar('/api/arquivos/' + pdf.id, { token: admin });

    assert.equal(r.status, 200);
    assert.match(r.tipo, /application\/pdf/);
    assert.equal(resumo(r.bruto), resumo(PDF_FALSO));
  });

  it('desce com o nome original, não com o nome de dentro do sistema', async () => {
    const lista = await chamar('/api/notas-fiscais/' + notaId + '/arquivos', { token: admin });
    const pdf = lista.corpo.arquivos.find(
      (a: { nomeOriginal: string }) => a.nomeOriginal === 'NF-12345.pdf',
    );

    const r = await chamar('/api/arquivos/' + pdf.id, { token: admin });

    assert.match(r.anexo, /NF-12345\.pdf/);
  });

  it('arquivo que não existe devolve 404', async () => {
    const r = await chamar(
      '/api/arquivos/00000000-0000-0000-0000-000000000000',
      { token: admin },
    );

    assert.equal(r.status, 404);
  });
});

describe('Tirar do arquivamento', () => {
  it('quem só vê não apaga', async () => {
    const lista = await chamar('/api/notas-fiscais/' + notaId + '/arquivos', { token: admin });
    const alvo = lista.corpo.arquivos[0];

    const r = await chamar('/api/arquivos/' + alvo.id, { metodo: 'DELETE', token: almoxarife });

    assert.equal(r.status, 403);
  });

  it('apaga e some da lista', async () => {
    const antes = await chamar('/api/notas-fiscais/' + notaId + '/arquivos', { token: admin });
    const alvo = antes.corpo.arquivos.find(
      (a: { nomeOriginal: string }) => a.nomeOriginal === 'NF-12345.xml',
    );

    const r = await chamar('/api/arquivos/' + alvo.id, { metodo: 'DELETE', token: admin });
    assert.equal(r.status, 200);

    const depois = await chamar('/api/notas-fiscais/' + notaId + '/arquivos', { token: admin });
    const nomes = depois.corpo.arquivos.map((a: { nomeOriginal: string }) => a.nomeOriginal);

    assert.ok(!nomes.includes('NF-12345.xml'));
  });

  it('apagar o que já não existe devolve 404', async () => {
    const r = await chamar(
      '/api/arquivos/00000000-0000-0000-0000-000000000000',
      { metodo: 'DELETE', token: admin },
    );

    assert.equal(r.status, 404);
  });
});
