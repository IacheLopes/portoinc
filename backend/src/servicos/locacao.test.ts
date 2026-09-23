// ============================================================
//  Testes da locação de equipamentos
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  diasEntre, diasDeUso, periodosCobrados,
  custoAcumulado, custoPrevisto, diasDeAtraso, custoDoAtraso,
  alertaDe, lerContrato, resumirLocacoes,
  conferirContrato, conferirDevolucao, conferirCancelamento, formatarNumero,
  AVISAR_COM_ANTECEDENCIA,
  type ContratoParaConta,
} from './locacao.js';

function dia(iso: string): Date {
  return new Date(iso + 'T12:00:00');
}

function contrato(extra: Partial<ContratoParaConta> = {}): ContratoParaConta {
  return {
    quantidade: 1,
    periodicidade: 'DIARIA',
    valorPeriodo: 65,
    inicioEm: dia('2026-09-01'),
    previsaoDevolucao: dia('2026-09-10'),
    devolvidoEm: null,
    situacao: 'ATIVA',
    ...extra,
  };
}

describe('Dias de uso', () => {
  it('o primeiro dia conta', () => {
    // Pegar de manhã e devolver à tarde é uma diária, não zero.
    const c = contrato({ inicioEm: dia('2026-09-01'), devolvidoEm: dia('2026-09-01') });

    assert.equal(diasDeUso(c, dia('2026-09-01')), 1);
  });

  it('conta até a devolução quando já voltou', () => {
    const c = contrato({ devolvidoEm: dia('2026-09-05'), situacao: 'DEVOLVIDA' });

    // 01 a 05 = 5 dias
    assert.equal(diasDeUso(c, dia('2026-09-30')), 5, 'depois de devolver, o relógio para');
  });

  it('conta até hoje enquanto está na obra', () => {
    const c = contrato();

    assert.equal(diasDeUso(c, dia('2026-09-05')), 5);
    assert.equal(diasDeUso(c, dia('2026-09-20')), 20, 'o número sobe sozinho');
  });
});

describe('Quanto já custou', () => {
  it('diária: um período por dia', () => {
    const c = contrato({ valorPeriodo: 65 });

    assert.equal(periodosCobrados(c, dia('2026-09-05')), 5);
    assert.equal(custoAcumulado(c, dia('2026-09-05')), 325);
  });

  it('período começado é período cobrado', () => {
    // Ninguém aluga meia semana: 8 dias são 2 semanas.
    const c = contrato({ periodicidade: 'SEMANAL', valorPeriodo: 300 });

    assert.equal(periodosCobrados(c, dia('2026-09-07')), 1, '7 dias = 1 semana');
    assert.equal(periodosCobrados(c, dia('2026-09-08')), 2, '8 dias já são 2 semanas');
    assert.equal(custoAcumulado(c, dia('2026-09-08')), 600);
  });

  it('a quantidade multiplica', () => {
    // 400 metros de andaime a R$ 12 o metro por mês.
    const c = contrato({ quantidade: 400, periodicidade: 'MENSAL', valorPeriodo: 12 });

    assert.equal(custoAcumulado(c, dia('2026-09-10')), 4800);
  });

  it('contrato cancelado não custa nada', () => {
    const c = contrato({ situacao: 'CANCELADA' });

    assert.equal(periodosCobrados(c, dia('2026-09-30')), 0);
    assert.equal(custoAcumulado(c, dia('2026-09-30')), 0);
  });
});

describe('Atraso', () => {
  it('no prazo não tem atraso nem custo extra', () => {
    const c = contrato({ devolvidoEm: dia('2026-09-08'), situacao: 'DEVOLVIDA' });

    assert.equal(diasDeAtraso(c, dia('2026-09-20')), 0);
    assert.equal(custoDoAtraso(c, dia('2026-09-20')), 0);
  });

  it('devolver no dia combinado ainda é no prazo', () => {
    const c = contrato({ devolvidoEm: dia('2026-09-10'), situacao: 'DEVOLVIDA' });

    assert.equal(diasDeAtraso(c, dia('2026-09-20')), 0);
  });

  it('mede o atraso e o que ele custou', () => {
    // Combinado até 10/09, voltou em 15/09: 5 diárias a mais.
    const c = contrato({ devolvidoEm: dia('2026-09-15'), situacao: 'DEVOLVIDA' });

    assert.equal(diasDeAtraso(c, dia('2026-09-20')), 5);
    assert.equal(custoPrevisto(c), 650, '10 dias a R$ 65');
    assert.equal(custoAcumulado(c, dia('2026-09-20')), 975, '15 dias a R$ 65');
    assert.equal(custoDoAtraso(c, dia('2026-09-20')), 325);
  });

  it('equipamento parado acumula atraso sozinho', () => {
    const c = contrato();

    assert.equal(custoDoAtraso(c, dia('2026-09-12')), 130, '2 dias parados');
    assert.equal(custoDoAtraso(c, dia('2026-09-22')), 780, '12 dias parados');
  });
});

describe('O alerta', () => {
  it('em dia quando falta bastante', () => {
    assert.equal(alertaDe(contrato(), dia('2026-09-01')), 'EM_DIA');
  });

  it('avisa ANTES de vencer', () => {
    const c = contrato();

    // Avisar só no dia não ajuda: o fornecedor leva dias para retirar.
    assert.equal(alertaDe(c, dia('2026-09-06')), 'EM_DIA', '4 dias ainda é longe');
    assert.equal(alertaDe(c, dia('2026-09-07')), 'PERTO', '3 dias já avisa');
    assert.equal(alertaDe(c, dia('2026-09-09')), 'PERTO');
  });

  it('a antecedência do aviso é a combinada', () => {
    const c = contrato();
    const limite = new Date(c.previsaoDevolucao);
    limite.setDate(limite.getDate() - AVISAR_COM_ANTECEDENCIA);

    assert.equal(alertaDe(c, limite), 'PERTO');
  });

  it('vence hoje é um estado próprio', () => {
    assert.equal(alertaDe(contrato(), dia('2026-09-10')), 'VENCE_HOJE');
  });

  it('passou do dia vira atraso', () => {
    assert.equal(alertaDe(contrato(), dia('2026-09-11')), 'ATRASADA');
  });

  it('devolvida e cancelada não alertam mais', () => {
    assert.equal(
      alertaDe(contrato({ situacao: 'DEVOLVIDA', devolvidoEm: dia('2026-09-20') }), dia('2026-09-30')),
      'DEVOLVIDA',
      'devolvida com atraso não fica alertando para sempre',
    );
    assert.equal(alertaDe(contrato({ situacao: 'CANCELADA' }), dia('2026-09-30')), 'CANCELADA');
  });
});

describe('A frase do contrato', () => {
  it('atrasada diz quanto o atraso custou', () => {
    const frase = lerContrato(contrato(), dia('2026-09-22'));

    assert.match(frase, /12 dia\(s\) além do combinado/);
    assert.match(frase, /R\$ 780,00/, 'o valor é o que faz alguém agir');
  });

  it('perto do fim pede providência', () => {
    assert.match(lerContrato(contrato(), dia('2026-09-08')), /Vence em 2 dia\(s\)/);
  });

  it('devolvida no prazo não acusa ninguém', () => {
    const c = contrato({ devolvidoEm: dia('2026-09-09'), situacao: 'DEVOLVIDA' });

    assert.match(lerContrato(c, dia('2026-09-30')), /Devolvida no prazo/);
  });

  it('devolvida com atraso registra o que custou', () => {
    const c = contrato({ devolvidoEm: dia('2026-09-13'), situacao: 'DEVOLVIDA' });

    assert.match(lerContrato(c, dia('2026-09-30')), /3 dia\(s\) de atraso/);
    assert.match(lerContrato(c, dia('2026-09-30')), /R\$ 195,00/);
  });
});

describe('Resumo do painel', () => {
  it('separa o que está atrasado do que está vencendo', () => {
    const r = resumirLocacoes([
      contrato({ previsaoDevolucao: dia('2026-09-05') }),           // atrasada
      contrato({ previsaoDevolucao: dia('2026-09-11') }),           // vence em 1 dia
      contrato({ previsaoDevolucao: dia('2026-09-30') }),           // em dia
      contrato({ situacao: 'DEVOLVIDA', devolvidoEm: dia('2026-09-08') }),
      contrato({ situacao: 'CANCELADA' }),
    ], dia('2026-09-10'));

    assert.equal(r.ativas, 3, 'devolvida e cancelada não estão ativas');
    assert.equal(r.atrasadas, 1);
    assert.equal(r.vencendo, 1);
  });

  it('soma o desperdício só do que está parado', () => {
    const r = resumirLocacoes([
      contrato({ previsaoDevolucao: dia('2026-09-05') }),
      contrato({ previsaoDevolucao: dia('2026-09-30') }),
    ], dia('2026-09-10'));

    // 5 dias de atraso a R$ 65
    assert.equal(r.desperdicio, 325);
  });

  it('o custo total ignora o cancelado', () => {
    const r = resumirLocacoes([
      contrato({ situacao: 'DEVOLVIDA', devolvidoEm: dia('2026-09-05') }),
      contrato({ situacao: 'CANCELADA' }),
    ], dia('2026-09-10'));

    assert.equal(r.custoTotal, 325, 'contrato cancelado não entra no total');
  });

  it('sem contrato nenhum não quebra', () => {
    const r = resumirLocacoes([], dia('2026-09-10'));

    assert.equal(r.ativas, 0);
    assert.equal(r.custoTotal, 0);
    assert.equal(r.desperdicio, 0);
  });
});

describe('O que o sistema recusa', () => {
  it('devolução antes do início não existe', () => {
    const r = conferirContrato({
      inicioEm: dia('2026-09-10'),
      previsaoDevolucao: dia('2026-09-05'),
      valorPeriodo: 65,
      quantidade: 1,
    });

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.erro : '', /antes do início/);
  });

  it('quantidade e valor precisam ser maiores que zero', () => {
    const base = {
      inicioEm: dia('2026-09-01'),
      previsaoDevolucao: dia('2026-09-10'),
      valorPeriodo: 65,
      quantidade: 1,
    };

    assert.equal(conferirContrato({ ...base, quantidade: 0 }).ok, false);
    assert.equal(conferirContrato({ ...base, valorPeriodo: 0 }).ok, false);
    assert.equal(conferirContrato(base).ok, true);
  });

  it('locação de um dia só é válida', () => {
    const r = conferirContrato({
      inicioEm: dia('2026-09-01'),
      previsaoDevolucao: dia('2026-09-01'),
      valorPeriodo: 65,
      quantidade: 1,
    });

    assert.equal(r.ok, true, 'alugar e devolver no mesmo dia acontece');
  });

  it('não devolve duas vezes', () => {
    const r = conferirDevolucao(
      { situacao: 'DEVOLVIDA', inicioEm: dia('2026-09-01') },
      dia('2026-09-10'),
    );

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.erro : '', /já foi devolvida/);
  });

  it('não devolve o que foi cancelado', () => {
    const r = conferirDevolucao(
      { situacao: 'CANCELADA', inicioEm: dia('2026-09-01') },
      dia('2026-09-10'),
    );

    assert.equal(r.ok, false);
  });

  it('não cancela o que já voltou', () => {
    const r = conferirCancelamento({ situacao: 'DEVOLVIDA' });

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.erro : '', /não se apaga/);
  });

  it('cancelar uma locação ativa pode', () => {
    assert.equal(conferirCancelamento({ situacao: 'ATIVA' }).ok, true);
  });
});

describe('Número do contrato', () => {
  it('vira LOC com cinco dígitos', () => {
    assert.equal(formatarNumero(1), 'LOC-00001');
    assert.equal(formatarNumero(42), 'LOC-00042');
  });
});

describe('Dias entre datas', () => {
  it('ignora a hora', () => {
    assert.equal(
      diasEntre(new Date('2026-09-01T23:00:00'), new Date('2026-09-05T01:00:00')),
      4,
    );
  });
});
