// ============================================================
//  DATA SEM HORA: O DEFEITO QUE CUSTAVA UM DIA INTEIRO
//
//  Medido em 10/10/2026, no primeiro convite de cotação enviado
//  pelo WhatsApp: o comprador marcou prazo para 17/10 e o
//  fornecedor recebeu "responda até 16/10".
//
//  Estes testes FALHAM contra o código antigo. É isso que os
//  torna úteis.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dataBr, inicioDoDiaBr, fimDoDiaBr } from './data-br.js';

describe('O dia que a pessoa digitou é o dia que ela vê', () => {
  it('O DEFEITO: `new Date` sozinho atrasa um dia', () => {
    //  Isto é o que acontecia. Fica aqui como lembrete do porquê
    //  as outras funções existem — se um dia alguém "simplificar"
    //  voltando a usar `new Date` direto, este teste explica.
    assert.equal(dataBr(new Date('2026-10-17')), '16/10/2026');
  });

  it('o começo do dia 17 é lido como 17', () => {
    assert.equal(dataBr(inicioDoDiaBr('2026-10-17')), '17/10/2026');
  });

  it('o fim do dia 17 também é lido como 17', () => {
    assert.equal(dataBr(fimDoDiaBr('2026-10-17')), '17/10/2026');
  });

  it('vale para o ano inteiro, não só para outubro', () => {
    //  Um mês por vez, incluindo as bordas de mês e de ano.
    for (const dia of [
      '2026-01-01', '2026-02-28', '2026-03-31', '2026-06-15',
      '2026-10-17', '2026-11-28', '2026-12-31',
    ]) {
      const [ano, mes, d] = dia.split('-');
      const esperado = d + '/' + mes + '/' + ano;

      assert.equal(dataBr(inicioDoDiaBr(dia)), esperado, 'início de ' + dia);
      assert.equal(dataBr(fimDoDiaBr(dia)), esperado, 'fim de ' + dia);
    }
  });
});

describe('Começo e fim do dia são coisas diferentes', () => {
  it('o fim do dia é quase 24 horas depois do começo', () => {
    const DIA = 24 * 60 * 60 * 1000;
    const inicio = inicioDoDiaBr('2026-10-17').getTime();
    const fim = fimDoDiaBr('2026-10-17').getTime();

    assert.equal(fim - inicio, DIA - 1);
  });

  it('PRAZO usa o FIM: o link não pode morrer de manhã', () => {
    //  O prazo da cotação é também o vencimento do link do
    //  portal. Com o começo do dia, o fornecedor que abrisse o
    //  link às 10h do dia 17 o encontraria vencido — perdendo de
    //  verdade o último dia, não só no texto.
    const dezDaManha = new Date('2026-10-17T13:00:00.000Z'); // 10h em Brasília

    assert.ok(
      fimDoDiaBr('2026-10-17') > dezDaManha,
      'às 10h do dia 17 o prazo ainda tem de estar de pé',
    );
    assert.ok(
      inicioDoDiaBr('2026-10-17') < dezDaManha,
      'o começo do dia 17 já passou às 10h — por isso não serve de prazo',
    );
  });
});

describe('O que NÃO é data sem hora passa reto', () => {
  it('data com hora junto é respeitada', () => {
    //  Quem mandou a hora sabe a hora que quer.
    const comHora = '2026-10-17T15:30:00.000Z';
    assert.equal(inicioDoDiaBr(comHora).toISOString(), comHora);
    assert.equal(fimDoDiaBr(comHora).toISOString(), comHora);
  });

  it('Date que já veio pronto volta igual', () => {
    const d = new Date('2026-10-17T15:30:00.000Z');
    assert.equal(inicioDoDiaBr(d).getTime(), d.getTime());
    assert.equal(fimDoDiaBr(d).getTime(), d.getTime());
  });
});
