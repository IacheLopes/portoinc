// ============================================================
//  Texto que sai na tela
//
//  Parece detalhe e não é: "1 parcela(s) em atraso" é a frase que
//  faz um sistema parecer inacabado.
// ============================================================

import { describe, it, expect } from 'vitest';
import { plural, contar, porcento, jurosAoMes, palavra, dinheiroCurto, faz } from './texto';

describe('plural', () => {
  it('no singular não sai "(s)"', () => {
    expect(plural(1, 'parcela', 'parcelas')).toBe('1 parcela');
  });

  it('no plural concorda', () => {
    expect(plural(3, 'parcela', 'parcelas')).toBe('3 parcelas');
  });

  it('poe o ponto do milhar, e nao o ponto do ingles', () => {
    // Colado cru, `plural(1234, ...)` escrevia "1234 notas", sem
    // separador; e com numero quebrado escreveria "1.5 dias", com o
    // ponto do ingles. So deu para consertar quando `quantidade`
    // veio morar neste arquivo.
    expect(plural(1234, 'nota', 'notas')).toBe('1.234 notas');
    expect(plural(1500000, 'parcela', 'parcelas')).toBe('1.500.000 parcelas');
    expect(plural(1.5, 'dia', 'dias')).toBe('1,5 dias');
  });

  it('zero vai para o plural, como se fala', () => {
    // "0 parcela" ninguém diz.
    expect(plural(0, 'parcela', 'parcelas')).toBe('0 parcelas');
  });

  it('dá conta do plural irregular, que um "s" no fim não daria', () => {
    expect(plural(2, 'solicitação', 'solicitações')).toBe('2 solicitações');
    expect(plural(1, 'função', 'funções')).toBe('1 função');
  });
});

describe('contar', () => {
  it('troca o zero por uma frase', () => {
    expect(contar(0, 'parcela', 'parcelas', 'Nada em atraso')).toBe('Nada em atraso');
  });

  it('com número, é o plural normal', () => {
    expect(contar(1, 'parcela', 'parcelas', 'Nada em atraso')).toBe('1 parcela');
    expect(contar(4, 'parcela', 'parcelas', 'Nada em atraso')).toBe('4 parcelas');
  });
});

describe('porcento', () => {
  it('escreve com vírgula, nunca com ponto', () => {
    // O DEFEITO: juntar número com texto em JavaScript usa o ponto
    // do inglês. O relatório de Fornecedores escrevia "37.8%" três
    // dedos ao lado de "R$ 3.000,00" — dois separadores decimais na
    // mesma tela, e o errado é o que ninguém questiona, porque
    // parece só um número.
    expect(porcento(37.8)).toBe('37,8%');
    expect(porcento(4.92)).toBe('4,9%');
  });

  it('não força casa decimal onde não tem', () => {
    expect(porcento(50)).toBe('50%');
    expect(porcento(0)).toBe('0%');
  });
});

describe('jurosAoMes', () => {
  it('força a casa decimal, para a lista virar escala', () => {
    // As taxas da equalização andam de meio em meio ponto. Sem a
    // casa forçada a lista sai "0,5% · 1% · 1,5% · 2%": metade com
    // vírgula e metade sem, e uma escala de passo fixo parece um
    // punhado de números soltos.
    expect(jurosAoMes(0.5)).toBe('0,5% ao mês');
    expect(jurosAoMes(1)).toBe('1,0% ao mês');
    expect(jurosAoMes(2)).toBe('2,0% ao mês');
  });

  it('é isso que a separa de porcento', () => {
    expect(porcento(2)).toBe('2%');
    expect(jurosAoMes(2)).toBe('2,0% ao mês');
  });
});

describe('palavra', () => {
  it('devolve só a palavra que concorda', () => {
    expect(palavra(1, 'usuário', 'usuários')).toBe('usuário');
    expect(palavra(3, 'usuário', 'usuários')).toBe('usuários');
    expect(palavra(0, 'usuário', 'usuários')).toBe('usuários');
  });

  it('serve quando o número está em outro elemento', () => {
    // `<strong>{n}</strong> usuários` põe negrito só no número. Usar
    // `plural` ali engrossaria a palavra também, mudando o desenho da
    // tela para consertar a gramática.
    expect(palavra(1, 'permissão', 'permissões')).toBe('permissão');
    expect(palavra(2, 'permissão', 'permissões')).toBe('permissões');
  });

  it('serve quando o verbo vem antes do número', () => {
    // "Falta 1 dia" e "Faltam 2 dias": o verbo concorda e aparece
    // primeiro, onde `plural` não alcança.
    expect(palavra(1, 'Falta', 'Faltam') + ' ' + plural(1, 'dia', 'dias'))
      .toBe('Falta 1 dia');
    expect(palavra(2, 'Falta', 'Faltam') + ' ' + plural(2, 'dia', 'dias'))
      .toBe('Faltam 2 dias');
  });

  it('nos outros casos quem serve é plural, com uma chamada', () => {
    expect(plural(1, 'item', 'itens')).toBe('1 item');
    expect(plural(3, 'item', 'itens')).toBe('3 itens');
  });
});

describe('dinheiroCurto', () => {
  it('abrevia em mil, milhão e bilhão', () => {
    expect(dinheiroCurto(999)).toBe('R$ 999');
    expect(dinheiroCurto(1500)).toBe('R$ 1,5k');
    expect(dinheiroCurto(20000000)).toBe('R$ 20,0M');
    expect(dinheiroCurto(1000000000)).toBe('R$ 1,0B');
    expect(dinheiroCurto(15000000000)).toBe('R$ 15,0B');
  });

  it('põe o menos antes do símbolo, como o resto do sistema', () => {
    // Montando o 'R$ ' à mão, o sinal ficava preso no meio:
    // "R$ -20,0M". O eixo do gráfico era o último lugar a discordar.
    expect(dinheiroCurto(-20000000)).toBe('-R$ 20,0M');
    expect(dinheiroCurto(-1500)).toBe('-R$ 1,5k');
    expect(dinheiroCurto(-999)).toBe('-R$ 999');
  });

  it('acima de bilhão o eixo volta a crescer, e está combinado', () => {
    // A casa dos bilhões é o teto acertado. Um trilhão lê-se como
    // mil bilhões, com o ponto de milhar no lugar.
    expect(dinheiroCurto(1000000000000)).toBe('R$ 1.000,0B');
  });
});

// ------------------------------------------------------------
//  "Há quanto tempo", em português de gente
//
//  Nasceu para o diário da conexão do WhatsApp. "Conectado às
//  12:27" responde QUANDO; quem olha a tela quer saber HÁ QUANTO
//  TEMPO, e sem isso fica fazendo conta de cabeça.
// ------------------------------------------------------------
describe('faz', () => {
  /** Um instante a N segundos atrás. */
  function atras(segundos: number): Date {
    return new Date(Date.now() - segundos * 1000);
  }

  it('sem data, não inventa', () => {
    expect(faz(null)).toBe('—');
    expect(faz(undefined)).toBe('—');
  });

  it('abaixo de um minuto não conta segundo', () => {
    // "há 7 segundos" é precisão que ninguém pediu e que fica
    // velha enquanto a pessoa lê.
    expect(faz(atras(5))).toBe('há segundos');
    expect(faz(atras(59))).toBe('há segundos');
  });

  it('minutos, horas e dias, com o plural certo', () => {
    expect(faz(atras(60))).toBe('há 1 minuto');
    expect(faz(atras(60 * 2))).toBe('há 2 minutos');
    expect(faz(atras(60 * 60))).toBe('há 1 hora');
    expect(faz(atras(60 * 60 * 5))).toBe('há 5 horas');
    expect(faz(atras(60 * 60 * 24))).toBe('há 1 dia');
    expect(faz(atras(60 * 60 * 24 * 3))).toBe('há 3 dias');
  });

  it('data no futuro vira "agora", e não "há -2 minutos"', () => {
    // O relógio do servidor e o do navegador não batem no
    // milissegundo. Sem esta guarda, um evento recém-gravado
    // aparece com tempo negativo.
    expect(faz(new Date(Date.now() + 5000))).toBe('agora');
  });

  it('aceita texto ISO, que é como o servidor manda', () => {
    expect(faz(atras(120).toISOString())).toBe('há 2 minutos');
  });
});
