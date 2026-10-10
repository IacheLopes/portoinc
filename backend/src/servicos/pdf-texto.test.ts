// ============================================================
//  Testes do que o PDF consegue desenhar
//
//  Estes dois casos sairam errados em TODO PDF do sistema desde
//  que as frases nasceram, e nenhum teste ficou vermelho: a fonte
//  nao reclama de caractere que nao tem, ela desenha outro.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { textoDoPdf, paraOPdf } from './pdf-texto.js';

describe('Texto que o PDF consegue desenhar', () => {
  it('troca o menos matematico pelo hifen-menos', () => {
    // O DEFEITO: toda linha de saida do caixa saia '" R$ 1.500,00'.
    // O PDFKit escreve o byte alto do codigo — 0x2212 vira 0x22 —, e
    // 0x22 em WinAnsi e a aspa.
    assert.equal(textoDoPdf('− R$ 1.500,00'), '- R$ 1.500,00');
  });

  it('troca o triangulo de aviso por algo que se le', () => {
    // O DEFEITO: a legenda do relatorio de Fornecedores saia
    // "Participacao marcada com & passa de 40%". 0x26A0 -> 0x26.
    assert.equal(
      textoDoPdf('marcada com ⚠ passa de 40%'),
      'marcada com (!) passa de 40%',
    );
  });

  it('nao mexe no que a fonte ja desenha', () => {
    // Acento, cedilha e cifrao sao latin1. O travessao, as aspas
    // curvas e a bala estao nos 27 tipograficos do WinAnsi — e eram
    // o que eu quase "consertei" por ler o PDF como latin1.
    assert.equal(textoDoPdf('Participação'), 'Participação');
    assert.equal(textoDoPdf('R$ 1.234,56'), 'R$ 1.234,56');
    assert.equal(textoDoPdf('dependência — quando'), 'dependência — quando');
    assert.equal(textoDoPdf('“aspas” e • bala'), '“aspas” e • bala');
    assert.equal(textoDoPdf('até 1.000 €'), 'até 1.000 €');
  });

  it('o que nao cabe e nao tem troca vira interrogacao', () => {
    // Visivel de proposito. Um `?` numa descricao de material faz
    // alguem perguntar; o glifo errado nao faz ninguem perguntar.
    // Um emoji é UM ponto de código, mesmo ocupando dois no UTF-16:
    // a função percorre por ponto de código, então vira um `?` só.
    assert.equal(textoDoPdf('cimento \u{1f600}'), 'cimento ?');
    assert.equal(textoDoPdf('你好'), '??');
  });

  it('as setas viram seta de teclado', () => {
    assert.equal(textoDoPdf('antes → depois'), 'antes -> depois');
    assert.equal(textoDoPdf('volta ← atras'), 'volta <- atras');
  });
});

describe('Saneando a estrutura inteira', () => {
  it('desce em objeto, lista e objeto dentro de lista', () => {
    const limpo = paraOPdf({
      titulo: 'Caixa − outubro',
      linhas: [
        { valor: '− R$ 10,00', obs: null },
        { valor: '+ R$ 20,00', obs: 'ok ⚠' },
      ],
      total: 1234.5,
      vazio: undefined,
    });

    assert.deepEqual(limpo, {
      titulo: 'Caixa - outubro',
      linhas: [
        { valor: '- R$ 10,00', obs: null },
        { valor: '+ R$ 20,00', obs: 'ok (!)' },
      ],
      total: 1234.5,
      vazio: undefined,
    });
  });

  it('nao desmonta a data', () => {
    // Percorrer os campos de um Date devolve objeto vazio, e a data
    // do rodape desapareceria do arquivo.
    const d = new Date('2026-10-08T12:00:00Z');
    const limpo = paraOPdf({ quando: d });

    assert.ok(limpo.quando instanceof Date);
    assert.equal(limpo.quando.getTime(), d.getTime());
  });

  it('deixa numero, booleano e nulo em paz', () => {
    assert.deepEqual(
      paraOPdf({ n: 0, b: false, z: null }),
      { n: 0, b: false, z: null },
    );
  });
});
