// ============================================================
//  As máscaras
//
//  O que mais importa aqui não é a pontuação bonita — é o telefone
//  guardado do jeito certo. O dono escreveu "(083) 99839-2849" ao
//  pedir a máscara, com o zero de discagem. Guardado assim, o número
//  vira 083... e o WhatsApp procura um contato que não existe.
//
//  Esse erro não apareceria em teste nenhum e nem na tela: apareceria
//  no dia de ligar a integração, meses depois, como "a mensagem não
//  chega para esse fornecedor".
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  soDigitos, mascaraCnpj, mascaraCpf, mascaraTelefone,
  parteNacional, telefoneParaGuardar, telefoneCompleto, mascaraChaveAcesso,
  mascaraDinheiro, dinheiroCompleto, lerDinheiro, dinheiroParaCampo,
} from './mascaras';

describe('CNPJ', () => {
  it('pontua conforme se digita', () => {
    expect(mascaraCnpj('19')).toBe('19');
    expect(mascaraCnpj('19131')).toBe('19.131');
    expect(mascaraCnpj('19131243')).toBe('19.131.243');
    expect(mascaraCnpj('191312430001')).toBe('19.131.243/0001');
    expect(mascaraCnpj('19131243000197')).toBe('19.131.243/0001-97');
  });

  it('para nos catorze dígitos', () => {
    // O que passa disso é tecla batida sem querer.
    expect(mascaraCnpj('1913124300019799999')).toBe('19.131.243/0001-97');
  });

  it('aceita o que já vem pontuado, sem duplicar ponto', () => {
    expect(mascaraCnpj('19.131.243/0001-97')).toBe('19.131.243/0001-97');
  });
});

describe('CPF', () => {
  it('pontua e para nos onze dígitos', () => {
    expect(mascaraCpf('12345678909')).toBe('123.456.789-09');
    expect(mascaraCpf('123456789099999')).toBe('123.456.789-09');
  });
});

describe('Telefone', () => {
  it('celular de nove dígitos', () => {
    expect(mascaraTelefone('83998392849')).toBe('(83) 99839-2849');
  });

  it('fixo de oito dígitos', () => {
    expect(mascaraTelefone('8332215566')).toBe('(83) 3221-5566');
  });

  it('o zero de discagem NÃO vira DDD de três dígitos', () => {
    // Foi como o dono escreveu ao pedir: "(083) 99839-2849".
    // O zero é prefixo de operadora — guardado, quebra o WhatsApp.
    expect(mascaraTelefone('083998392849')).not.toContain('(083)');
  });

  it('guarda com o 55 na frente', () => {
    expect(telefoneParaGuardar('(83) 99839-2849')).toBe('5583998392849');
  });

  it('não põe 55 em campo vazio', () => {
    // Senão um fornecedor sem telefone ficaria com "55" gravado, e a
    // integração tentaria mandar mensagem para o país inteiro.
    expect(telefoneParaGuardar('')).toBe('');
    expect(telefoneCompleto('')).toBe('');
  });

  it('não dobra o 55 ao reabrir um cadastro', () => {
    // O valor volta do banco já com o DDI. Sem esta proteção viraria
    // 555583998392849 a cada vez que alguém abrisse e salvasse.
    expect(telefoneParaGuardar('5583998392849')).toBe('5583998392849');
    expect(parteNacional('5583998392849')).toBe('83998392849');
  });

  it('mostra inteiro para tela e para documento', () => {
    expect(telefoneCompleto('5583998392849')).toBe('+55 (83) 99839-2849');
  });

  it('um DDD que começa com 55 continua inteiro', () => {
    // Não existe DDD 55 seguido de 10 dígitos, mas a regra tem de
    // olhar o TAMANHO e não só o começo. 5511944443333 tem 13 e é
    // DDI+DDD; 5591234567 tem 10 e é DDD 55 com fixo.
    expect(parteNacional('5532215566')).toBe('5532215566');
  });
});

describe('Chave de acesso da nota', () => {
  it('quebra em grupos de quatro', () => {
    const chave = '3'.repeat(44);
    const saida = mascaraChaveAcesso(chave);

    expect(saida.split(' ')).toHaveLength(11);
    expect(soDigitos(saida)).toBe(chave);
  });

  it('para nos 44 dígitos', () => {
    expect(soDigitos(mascaraChaveAcesso('9'.repeat(60)))).toHaveLength(44);
  });
});

describe('Dinheiro', () => {
  it('agrupa o milhar enquanto se digita', () => {
    expect(mascaraDinheiro('5000')).toBe('R$ 5.000');
    expect(mascaraDinheiro('50000')).toBe('R$ 50.000');
    expect(mascaraDinheiro('1234567')).toBe('R$ 1.234.567');
  });

  it('NÃO completa os centavos enquanto se digita', () => {
    // Completar antes faria "50" virar "R$ 50,00" no meio da
    // digitação de "5000", e a pessoa brigaria com o campo.
    expect(mascaraDinheiro('50')).toBe('R$ 50');
  });

  it('completa os centavos ao sair do campo', () => {
    expect(dinheiroCompleto('5000')).toBe('R$ 5.000,00');
    expect(dinheiroCompleto('5000,5')).toBe('R$ 5.000,50');
    expect(dinheiroCompleto('5000,50')).toBe('R$ 5.000,50');
    expect(dinheiroCompleto('1234567890')).toBe('R$ 1.234.567.890,00');
  });

  it('o ponto AGRUPA, e não separa centavos', () => {
    // Tentei duas vezes deixar o ponto servir de decimal, e as duas
    // quebraram — a segunda fazia apagar um dígito de "R$ 123.456"
    // devolver "R$ 123,45".
    //
    // "123.45" é ambíguo de verdade: pode ser centavo digitado no
    // teclado numérico, ou um dígito apagado de 123.456. Apagar
    // acontece o tempo todo; então o ponto agrupa, e quem quer
    // centavo usa a vírgula — e vê o resultado na hora.
    expect(dinheiroCompleto('5000.50')).toBe('R$ 500.050,00');
    expect(mascaraDinheiro('123.45')).toBe('R$ 12.345');
  });

  it('não aceita mais de duas casas', () => {
    expect(dinheiroCompleto('10,999')).toBe('R$ 10,99');
  });

  it('é idempotente: mascarar o que já está mascarado não muda', () => {
    // O campo remascara a cada tecla; sem isto os pontos se
    // multiplicariam a cada digitação.
    expect(mascaraDinheiro('R$ 5.000')).toBe('R$ 5.000');
    expect(dinheiroCompleto('R$ 5.000,00')).toBe('R$ 5.000,00');
  });

  it('lê de volta o número que vai para o servidor', () => {
    expect(lerDinheiro('R$ 5.000,00')).toBe(5000);
    expect(lerDinheiro('R$ 1.234.567,89')).toBe(1234567.89);
    expect(lerDinheiro('R$ 0,05')).toBe(0.05);
  });

  it('campo vazio é null, e não zero', () => {
    // Um valor não informado é diferente de um valor que é zero.
    // Frete em branco não é frete grátis — é frete que ninguém disse.
    expect(lerDinheiro('')).toBeNull();
    expect(lerDinheiro('R$ ')).toBeNull();
    expect(dinheiroCompleto('')).toBe('');
  });

  it('vai e volta sem perder valor', () => {
    for (const n of [0.05, 34, 5000, 1234567.89]) {
      expect(lerDinheiro(dinheiroParaCampo(n))).toBe(n);
    }
  });

  it('zero é zero, e não vazio', () => {
    expect(dinheiroParaCampo(0)).toBe('R$ 0,00');
    expect(lerDinheiro('R$ 0,00')).toBe(0);
  });
});

describe('Dinheiro: digitando tecla a tecla', () => {
  /** O que o campo faz de verdade: remascara o valor inteiro a cada tecla. */
  function digitar(teclas: string): string[] {
    let campo = '';
    const passos: string[] = [];

    for (const tecla of teclas) {
      campo = mascaraDinheiro(campo + tecla);
      passos.push(campo);
    }

    return passos;
  }

  it('o valor cresce a cada dígito, sem teto', () => {
    // Apontado pelo dono em 25/09/2026: "se eu digito mais numeros ele
    // vira R$ 1,00... e nao muda mais".
    //
    // No quinto dígito o campo travava em "R$ 1,23" e toda tecla
    // seguinte caía nos centavos, que são cortados em dois. Dava para
    // digitar no máximo mil e pouco — num sistema que compra material
    // de obra, onde pedido de R$ 200.000 é rotina.
    expect(digitar('1234567')).toEqual([
      'R$ 1',
      'R$ 12',
      'R$ 123',
      'R$ 1.234',
      'R$ 12.345',
      'R$ 123.456',
      'R$ 1.234.567',
    ]);
  });

  it('milhão e bilhão passam', () => {
    expect(mascaraDinheiro('1000000000')).toBe('R$ 1.000.000.000');
  });

  it('a vírgula continua abrindo os centavos', () => {
    expect(digitar('1234,56').at(-1)).toBe('R$ 1.234,56');
  });

  it('o terceiro centavo é ignorado, e não vira milhar', () => {
    // O perigo oposto: aceitar a terceira casa faria "R$ 5.000,50"
    // virar "R$ 5.000.500" com uma tecla a mais.
    expect(mascaraDinheiro('5000,509')).toBe('R$ 5.000,50');
  });

  it('apagar devolve exatamente o passo anterior', () => {
    // Apagar é o que mais se faz num campo de valor, e era onde as
    // duas tentativas anteriores quebravam.
    let campo = 'R$ 1.234.567';
    const voltando: string[] = [];

    for (let i = 0; i < 4; i += 1) {
      campo = mascaraDinheiro(campo.slice(0, -1));
      voltando.push(campo);
    }

    expect(voltando).toEqual(['R$ 123.456', 'R$ 12.345', 'R$ 1.234', 'R$ 123']);
  });
});
