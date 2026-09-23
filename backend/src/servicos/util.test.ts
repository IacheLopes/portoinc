// ============================================================
//  Testes das validações puras
//
//  Não tocam no banco nem na rede: rodam em milissegundos.
//  São a primeira linha de defesa contra dado ruim entrando
//  no sistema.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { cnpjValido, formatarCnpj, apenasDigitos } from './util.js';
import { gtinValido } from '../integracoes/gtin/porta.js';
import { validarForcaSenha } from './senha.js';
import { lerNumero, detectarSeparador, lerCsvOrcamento } from './orcamento.js';

describe('CNPJ', () => {
  it('aceita CNPJs reais', () => {
    // CNPJs públicos usados apenas como exemplo de dígito válido.
    assert.equal(cnpjValido('19.131.243/0001-97'), true);
    assert.equal(cnpjValido('33000167000101'), true);
    assert.equal(cnpjValido('05.570.714/0001-59'), true);
  });

  it('recusa quando o dígito verificador não bate', () => {
    assert.equal(cnpjValido('19.131.243/0001-98'), false);
    assert.equal(cnpjValido('33000167000102'), false);
  });

  it('recusa sequências repetidas, que passariam na conta', () => {
    assert.equal(cnpjValido('11111111111111'), false);
    assert.equal(cnpjValido('00000000000000'), false);
  });

  it('recusa quantidade errada de dígitos', () => {
    assert.equal(cnpjValido('1913124300019'), false);
    assert.equal(cnpjValido('191312430001977'), false);
    assert.equal(cnpjValido(''), false);
  });

  it('aceita com ou sem pontuação', () => {
    assert.equal(cnpjValido('19131243000197'), true);
    assert.equal(cnpjValido('19.131.243/0001-97'), true);
  });

  it('formata para exibição', () => {
    assert.equal(formatarCnpj('19131243000197'), '19.131.243/0001-97');
  });

  it('extrai só os dígitos', () => {
    assert.equal(apenasDigitos('19.131.243/0001-97'), '19131243000197');
    assert.equal(apenasDigitos('(11) 98888-7777'), '11988887777');
  });
});

describe('Código de barras (GTIN)', () => {
  it('aceita códigos válidos do catálogo da Porto Inc.', () => {
    assert.equal(gtinValido('7899888400575'), true);
    assert.equal(gtinValido('7896193243897'), true);
    assert.equal(gtinValido('7898494150676'), true);
  });

  it('recusa quando um dígito foi trocado', () => {
    assert.equal(gtinValido('7899888400576'), false);
    assert.equal(gtinValido('7899888400574'), false);
  });

  it('recusa comprimento inválido', () => {
    assert.equal(gtinValido('789988840057'), false); // 12 com dígito errado
    assert.equal(gtinValido('123'), false);
    assert.equal(gtinValido(''), false);
  });

  it('ignora pontuação e espaços', () => {
    assert.equal(gtinValido('7 899888 400575'), true);
  });
});

describe('Força da senha', () => {
  it('aprova senha longa com letra e número', () => {
    assert.deepEqual(validarForcaSenha('obradoporto2026'), []);
    assert.deepEqual(validarForcaSenha('Porto@2026'), []);
  });

  it('reprova senha curta', () => {
    const problemas = validarForcaSenha('Ab1');
    assert.ok(problemas.some((p) => p.includes('8 caracteres')));
  });

  it('reprova senha só com números', () => {
    const problemas = validarForcaSenha('123456789');
    assert.ok(problemas.some((p) => p.includes('letra')));
  });

  it('reprova senha só com letras', () => {
    const problemas = validarForcaSenha('apenasletras');
    assert.ok(problemas.some((p) => p.includes('número')));
  });
});

describe('Leitura de número da planilha', () => {
  it('entende o formato brasileiro', () => {
    assert.equal(lerNumero('1.250,00'), 1250);
    assert.equal(lerNumero('1.234.567,89'), 1234567.89);
    assert.equal(lerNumero('890,50'), 890.5);
  });

  it('entende o formato internacional', () => {
    assert.equal(lerNumero('1250.00'), 1250);
    assert.equal(lerNumero('34'), 34);
  });

  it('trata vazio como zero', () => {
    assert.equal(lerNumero(''), 0);
    assert.equal(lerNumero('   '), 0);
  });

  it('recusa texto e número negativo', () => {
    assert.equal(lerNumero('abc'), null);
    assert.equal(lerNumero('-50'), null);
    assert.equal(lerNumero('12abc'), null);
  });
});

describe('Separador do CSV', () => {
  it('detecta ponto e vírgula', () => {
    assert.equal(detectarSeparador('codigo;descricao;unidade'), ';');
  });

  it('detecta vírgula', () => {
    assert.equal(detectarSeparador('codigo,descricao,unidade'), ',');
  });

  it('na dúvida, usa vírgula', () => {
    assert.equal(detectarSeparador('codigo'), ',');
  });
});

describe('Importação de orçamento', () => {
  const CABECALHO = 'codigo;descricao;unidade;quantidade;valor_unitario';

  it('lê um arquivo correto', () => {
    const r = lerCsvOrcamento(
      [CABECALHO, '03.01.001;Cimento Portland;SC;1200;34,00', '03.02.001;Areia média;m3;180;130,00'].join('\n'),
    );

    assert.equal(r.problemas.length, 0);
    assert.equal(r.linhas.length, 2);
    assert.equal(r.linhas[0].codigo, '03.01.001');
    assert.equal(r.linhas[0].quantidadePrevista, 1200);
    assert.equal(r.linhas[0].valorUnitarioPrevisto, 34);
    // A unidade é padronizada em maiúscula.
    assert.equal(r.linhas[1].unidade, 'M3');
  });

  it('preserva acentos', () => {
    const r = lerCsvOrcamento(
      [CABECALHO, '02.01.001;Fundação — estacas hélice contínua;M;450;1.250,00'].join('\n'),
    );

    assert.equal(r.linhas[0].descricao, 'Fundação — estacas hélice contínua');
    assert.equal(r.linhas[0].valorUnitarioPrevisto, 1250);
  });

  it('não desiste do arquivo por causa de linha ruim', () => {
    const r = lerCsvOrcamento(
      [
        CABECALHO,
        '01.01.001;Linha boa;UN;10;5,00',
        ';Sem código;M2;10;10',
        '01.01.002;Valor inválido;M2;abc;xyz',
        '01.01.001;Código repetido;UN;1;1',
        '01.01.003;Só três colunas',
        '01.01.004;Outra linha boa;KG;20;7,50',
      ].join('\n'),
    );

    // As duas linhas boas entraram.
    assert.equal(r.linhas.length, 2);
    assert.equal(r.linhas[0].codigo, '01.01.001');
    assert.equal(r.linhas[1].codigo, '01.01.004');

    // E os quatro problemas foram descritos com o número da linha.
    assert.equal(r.problemas.length, 4);
    assert.ok(r.problemas[0].includes('Linha 3'));
    assert.ok(r.problemas[1].includes('Linha 4'));
    assert.ok(r.problemas[2].includes('Linha 5'));
    assert.ok(r.problemas[2].includes('repetido'));
    assert.ok(r.problemas[3].includes('Linha 6'));
  });

  it('aceita vírgula como separador de coluna', () => {
    const r = lerCsvOrcamento('codigo,descricao,unidade,qtd,valor\n01,Item,UN,5,10.50');

    assert.equal(r.linhas.length, 1);
    assert.equal(r.linhas[0].valorUnitarioPrevisto, 10.5);
  });

  it('avisa quando o arquivo só tem cabeçalho', () => {
    const r = lerCsvOrcamento(CABECALHO);
    assert.equal(r.linhas.length, 0);
    assert.equal(r.problemas.length, 1);
  });

  it('numera as linhas em sequência', () => {
    const r = lerCsvOrcamento(
      [CABECALHO, '01;A;UN;1;1', '02;B;UN;1;1', '03;C;UN;1;1'].join('\n'),
    );

    assert.deepEqual(r.linhas.map((l) => l.ordem), [1, 2, 3]);
  });
});
