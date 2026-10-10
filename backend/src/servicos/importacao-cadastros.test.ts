// ============================================================
//  A leitura das planilhas de catálogo
//
//  Planilha de obra real tem linha torta: campo em branco,
//  código repetido, CNPJ digitado errado. O que se cobra aqui
//  não é que o arquivo seja perfeito — é que o sistema diga QUAL
//  linha está errada e importe o resto.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { lerCsvMateriais, lerCsvFornecedores } from './importacao-cadastros.js';

describe('Planilha de materiais', () => {
  const cabecalho = 'familia;codigo;descricao;unidade;marca;norma;gtin;ponto;linha';

  it('lê uma planilha limpa', () => {
    const r = lerCsvMateriais([
      cabecalho,
      'ELE;EL-0001;Cabo flexivel 2,5mm;RL;Sil;NBR NM 247-3;;8;09.01.001',
      'HID;HD-0001;Tubo PVC 25mm;BR;Tigre;NBR 5648;;20;',
    ].join('\n'));

    assert.deepEqual(r.problemas, []);
    assert.equal(r.linhas.length, 2);
    assert.equal(r.linhas[0].codigoInterno, 'EL-0001');
    assert.equal(r.linhas[0].familiaCodigo, 'ELE');
    assert.equal(r.linhas[0].pontoPedido, 8);
    assert.equal(r.linhas[0].codigoLinhaPadrao, '09.01.001');
    assert.equal(r.linhas[1].codigoLinhaPadrao, null, 'coluna vazia vira nulo');
  });

  it('aceita vírgula como separador, como o orçamento', () => {
    const r = lerCsvMateriais([
      'familia,codigo,descricao,unidade',
      'ELE,EL-0002,Disjuntor 16A,UN',
    ].join('\n'));

    assert.deepEqual(r.problemas, []);
    assert.equal(r.linhas[0].descricao, 'Disjuntor 16A');
  });

  it('a unidade e a família sobem para maiúscula', () => {
    const r = lerCsvMateriais([cabecalho, 'ele;EL-0003;Fio;un'].join('\n'));

    assert.equal(r.linhas[0].unidadeMedida, 'UN');
    assert.equal(r.linhas[0].familiaCodigo, 'ELE');
  });

  it('nomeia a linha com campo em branco, e importa o resto', () => {
    const r = lerCsvMateriais([
      cabecalho,
      'ELE;EL-0004;Cabo;RL',
      'ELE;;Sem codigo;UN',
      'HID;HD-0002;Joelho;UN',
    ].join('\n'));

    assert.equal(r.linhas.length, 2, 'as duas boas entram');
    assert.equal(r.problemas.length, 1);
    assert.ok(r.problemas[0].includes('Linha 3'), 'diz QUAL linha');
    assert.ok(r.problemas[0].includes('em branco'));
  });

  it('recusa código repetido dentro do arquivo', () => {
    const r = lerCsvMateriais([
      cabecalho,
      'ELE;EL-0005;Cabo;RL',
      'ELE;EL-0005;Cabo de novo;RL',
    ].join('\n'));

    assert.equal(r.linhas.length, 1);
    assert.ok(r.problemas[0].includes('repetido'));
  });

  it('ponto de pedido escrito errado não vira zero calado', () => {
    // Zero quer dizer "não me avise". Virar zero em silêncio
    // desligaria o alerta de reposição sem ninguém pedir.
    const r = lerCsvMateriais([cabecalho, 'ELE;EL-0006;Cabo;RL;;;;mais ou menos 8;'].join('\n'));

    assert.equal(r.linhas.length, 0);
    assert.ok(r.problemas[0].includes('não é um número'));
  });

  it('arquivo só com cabeçalho é recusado inteiro', () => {
    const r = lerCsvMateriais(cabecalho);

    assert.equal(r.linhas.length, 0);
    assert.ok(r.problemas[0].includes('ao menos uma linha'));
  });
});

describe('Planilha de fornecedores', () => {
  const cabecalho = 'cnpj;razao;fantasia;email;whatsapp;cidade;uf;familias';

  it('lê uma planilha limpa', () => {
    const r = lerCsvFornecedores([
      cabecalho,
      '19.131.243/0001-97;Eletro Minas LTDA;Eletro Minas;v@em.com.br;(31) 98888-7777;BH;mg;ELE',
    ].join('\n'));

    assert.deepEqual(r.problemas, []);
    assert.equal(r.linhas[0].cnpj, '19131243000197', 'o CNPJ fica só com os dígitos');
    assert.equal(r.linhas[0].whatsapp, '31988887777');
    assert.equal(r.linhas[0].uf, 'MG');
    assert.deepEqual(r.linhas[0].familiasCodigos, ['ELE']);
  });

  it('aceita várias famílias separadas por barra', () => {
    const r = lerCsvFornecedores([
      cabecalho,
      '45.543.915/0001-81;Hidro Center;;;;;;ELE/HID',
    ].join('\n'));

    assert.deepEqual(r.linhas[0].familiasCodigos, ['ELE', 'HID']);
  });

  it('recusa CNPJ inválido nomeando a linha', () => {
    // É o CNPJ que liga a nota fiscal ao cadastro: errado aqui,
    // a nota do fornecedor não acha o dono dela.
    const r = lerCsvFornecedores([
      cabecalho,
      '11.111.111/1111-11;Empresa Fantasma;;;;;;ELE',
    ].join('\n'));

    assert.equal(r.linhas.length, 0);
    assert.ok(r.problemas[0].includes('Linha 2'));
    assert.ok(r.problemas[0].includes('não é válido'));
  });

  it('recusa fornecedor sem família, e diz por quê', () => {
    const r = lerCsvFornecedores([
      cabecalho,
      '19.131.243/0001-97;Eletro Minas LTDA;;;;;;',
    ].join('\n'));

    assert.equal(r.linhas.length, 0);
    assert.ok(r.problemas[0].includes('nunca é convidado'));
  });

  it('recusa CNPJ repetido dentro do arquivo', () => {
    const r = lerCsvFornecedores([
      cabecalho,
      '19.131.243/0001-97;Eletro Minas;;;;;;ELE',
      '19131243000197;Eletro Minas de novo;;;;;;HID',
    ].join('\n'));

    assert.equal(r.linhas.length, 1);
    assert.ok(r.problemas[0].includes('repetido'));
  });

  it('uma linha torta não derruba as boas', () => {
    const r = lerCsvFornecedores([
      cabecalho,
      '19.131.243/0001-97;Eletro Minas;;;;;;ELE',
      ';Sem CNPJ;;;;;;ELE',
      '45.543.915/0001-81;Hidro Center;;;;;;HID',
    ].join('\n'));

    assert.equal(r.linhas.length, 2);
    assert.equal(r.problemas.length, 1);
    assert.ok(r.problemas[0].includes('Linha 3'));
  });
});
