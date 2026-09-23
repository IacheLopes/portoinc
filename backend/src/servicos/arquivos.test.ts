// ============================================================
//  A guarda de arquivos
//
//  O que dá para conferir sem tocar em disco nem em banco.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { caminhoCompleto, tipoAceito, nomeDoTipo, tamanhoLegivel, ErroDeArquivo } from './arquivos.js';

describe('Tipos aceitos', () => {
  it('aceita PDF e XML', () => {
    assert.equal(tipoAceito('application/pdf'), true);
    assert.equal(tipoAceito('text/xml'), true);
    assert.equal(tipoAceito('application/xml'), true);
  });

  it('recusa o resto', () => {
    // A nota fiscal é PDF ou XML. Aceitar qualquer coisa transforma
    // o arquivamento em depósito de arquivo executável.
    assert.equal(tipoAceito('application/x-msdownload'), false);
    assert.equal(tipoAceito('image/png'), false);
    assert.equal(tipoAceito(''), false);
  });

  it('diz o nome do tipo em português', () => {
    assert.equal(nomeDoTipo('application/pdf'), 'PDF');
    assert.equal(nomeDoTipo('text/xml'), 'XML');
  });
});

describe('Caminho do arquivo', () => {
  it('monta o caminho dentro da pasta de arquivos', () => {
    const caminho = caminhoCompleto('2026-09/abc123.pdf');

    assert.ok(caminho.includes('abc123.pdf'));
    assert.ok(caminho.includes('arquivos'));
  });

  it('RECUSA caminho que sai da pasta', () => {
    // Um ".." no caminho leria qualquer arquivo do container.
    assert.throws(() => caminhoCompleto('../../etc/passwd'), ErroDeArquivo);
    assert.throws(() => caminhoCompleto('2026-09/../../../segredo'), ErroDeArquivo);
  });

  it('caminho absoluto é dobrado para dentro da pasta, não escapa', () => {
    // Escrevi este teste esperando uma recusa e ele falhou: o
    // path.join trata a barra inicial como separador, então
    // "/etc/passwd" vira "<pasta>/etc/passwd". Continua dentro —
    // que é a garantia que importa. O teste registra isso para
    // ninguém "consertar" o join achando que está furado.
    const caminho = caminhoCompleto('/etc/passwd');

    assert.ok(caminho.includes('arquivos'));
    assert.ok(caminho.endsWith('passwd'));
    assert.ok(!caminho.startsWith('/etc'));
  });
});

describe('Tamanho legível', () => {
  it('escolhe a unidade que a pessoa lê', () => {
    assert.equal(tamanhoLegivel(512), '512 B');
    assert.equal(tamanhoLegivel(2048), '2 KB');
    assert.equal(tamanhoLegivel(3 * 1024 * 1024), '3.0 MB');
  });
});
