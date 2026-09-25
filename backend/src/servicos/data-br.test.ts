// ============================================================
//  O fuso tem de estar escrito no código, não no container
//
//  Este teste existe por causa de um defeito achado em 24/09/2026:
//  um pedido de compra tirado às 21h20 de Brasília saía datado do
//  dia SEGUINTE, porque o container roda em UTC e
//  `toLocaleString('pt-BR')` só escolhe o idioma — nunca o fuso.
//
//  As datas abaixo são de propósito depois das 21h de Brasília, que
//  é a faixa onde o defeito aparece. Durante o expediente ele some,
//  e foi por isso que ninguém viu por tanto tempo.
//
//  Se alguém tirar o `timeZone` do data-br.ts, estes testes caem.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { dataBr, dataHoraBr, geradoEm } from './data-br.js';

describe('Data e hora no fuso de Brasília', () => {
  it('21h20 de Brasília não vira o dia seguinte', () => {
    // 25/09 às 00:20 em UTC é 24/09 às 21:20 em São Paulo.
    const instante = new Date('2026-09-25T00:20:00.000Z');

    assert.equal(dataHoraBr(instante), '24/09/2026, 21:20');
    assert.equal(dataBr(instante), '24/09/2026');
  });

  it('meia-noite e dez de Brasília já é o dia novo', () => {
    // 25/09 às 03:10 em UTC é 25/09 às 00:10 em São Paulo.
    const instante = new Date('2026-09-25T03:10:00.000Z');

    assert.equal(dataHoraBr(instante), '25/09/2026, 00:10');
    assert.equal(dataBr(instante), '25/09/2026');
  });

  it('meio do expediente, onde o defeito não aparecia', () => {
    // 24/09 às 17:00 em UTC é 24/09 às 14:00 em São Paulo. Aqui o
    // dia bate nos dois fusos — por isso o erro passava despercebido.
    assert.equal(dataBr(new Date('2026-09-24T17:00:00.000Z')), '24/09/2026');
  });

  it('data que não existe vira travessão, e não "Invalid Date"', () => {
    assert.equal(dataBr(null), '—');
    assert.equal(dataBr(undefined), '—');
  });

  it('a frase do rodapé é a mesma em todo documento', () => {
    // Estava escrita de três jeitos em três arquivos. Agora sai daqui.
    assert.match(geradoEm(), /^Gerado pelo sistema em \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/);
  });
});
