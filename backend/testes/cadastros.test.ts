// ============================================================
//  Testes da Etapa 2 - Cadastros
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let familiaEletrica = '';
let familiaCimento = '';

before(async () => {
  await limparDados();
  await criarUsuarioTeste('admin2@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('solicitante2@teste.com.br', ['SOLICITANTE']);

  admin = await entrarComo('admin2@teste.com.br');

  const ele = await chamar('/api/familias', {
    metodo: 'POST',
    token: admin,
    corpo: { codigo: 'ELE', nome: 'Material elétrico' },
  });
  familiaEletrica = ele.corpo.familia.id;

  const cim = await chamar('/api/familias', {
    metodo: 'POST',
    token: admin,
    corpo: { codigo: 'CIM', nome: 'Cimento e argamassas' },
  });
  familiaCimento = cim.corpo.familia.id;
});

after(encerrar);

describe('Famílias', () => {
  it('cria e coloca o código em maiúsculas', async () => {
    const r = await chamar('/api/familias', {
      metodo: 'POST',
      token: admin,
      corpo: { codigo: 'hid', nome: 'Material hidráulico' },
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.familia.codigo, 'HID');
  });

  it('recusa código repetido', async () => {
    const r = await chamar('/api/familias', {
      metodo: 'POST',
      token: admin,
      corpo: { codigo: 'ELE', nome: 'Duplicada' },
    });

    assert.equal(r.status, 409);
  });

  it('solicitante pode consultar, mas não criar', async () => {
    const token = await entrarComo('solicitante2@teste.com.br');

    assert.equal((await chamar('/api/familias', { token })).status, 200);

    const criar = await chamar('/api/familias', {
      metodo: 'POST',
      token,
      corpo: { codigo: 'XYZ', nome: 'Não deveria entrar' },
    });
    assert.equal(criar.status, 403);
  });
});

describe('Materiais', () => {
  it('cadastra material com os três códigos separados', async () => {
    const r = await chamar('/api/materiais', {
      metodo: 'POST',
      token: admin,
      corpo: {
        familiaId: familiaCimento,
        codigoInterno: '00119',
        descricao: 'Cimento Portland CP-II-Z-32 saco 50kg',
        gtin: '7899888400575',
        normaTecnica: 'NBR 16697',
        unidadeMedida: 'SC',
        pontoPedido: 50,
        codigoLinhaPadrao: '03.01.001',
      },
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.material.codigoInterno, '00119');
    assert.equal(r.corpo.material.gtin, '7899888400575');
    assert.equal(r.corpo.material.normaTecnica, 'NBR 16697');
    assert.equal(r.corpo.material.pontoPedido, 50);
  });

  it('recusa código de barras com dígito verificador errado', async () => {
    const r = await chamar('/api/materiais', {
      metodo: 'POST',
      token: admin,
      corpo: {
        familiaId: familiaCimento,
        codigoInterno: '00999',
        descricao: 'Item com código errado',
        gtin: '7899888400576',
        unidadeMedida: 'UN',
      },
    });

    assert.equal(r.status, 400);
  });

  it('recusa código de barras já usado por outro item', async () => {
    const r = await chamar('/api/materiais', {
      metodo: 'POST',
      token: admin,
      corpo: {
        familiaId: familiaCimento,
        codigoInterno: '00120',
        descricao: 'Outro cimento',
        gtin: '7899888400575',
        unidadeMedida: 'SC',
      },
    });

    assert.equal(r.status, 409);
  });

  it('recusa código Porto repetido', async () => {
    const r = await chamar('/api/materiais', {
      metodo: 'POST',
      token: admin,
      corpo: {
        familiaId: familiaCimento,
        codigoInterno: '00119',
        descricao: 'Repetido',
        unidadeMedida: 'UN',
      },
    });

    assert.equal(r.status, 409);
  });

  it('recusa serviço com código de barras', async () => {
    const r = await chamar('/api/materiais', {
      metodo: 'POST',
      token: admin,
      corpo: {
        familiaId: familiaEletrica,
        codigoInterno: 'S9999',
        descricao: 'Serviço não tem código de barras',
        tipo: 'SERVICO',
        gtin: '7896193243897',
        unidadeMedida: 'UN',
      },
    });

    assert.equal(r.status, 400);
  });

  it('recusa unidade de medida inventada', async () => {
    const r = await chamar('/api/materiais', {
      metodo: 'POST',
      token: admin,
      corpo: {
        familiaId: familiaCimento,
        codigoInterno: '00121',
        descricao: 'Unidade estranha',
        unidadeMedida: 'BANANA',
      },
    });

    assert.equal(r.status, 400);
  });

  it('encontra o material ao bipar o código de barras', async () => {
    const r = await chamar('/api/materiais/gtin/7899888400575', { token: admin });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.encontrado, true);
    assert.equal(r.corpo.material.codigoInterno, '00119');
  });

  it('sugere cadastrar quando o código não está no catálogo', async () => {
    const r = await chamar('/api/materiais/gtin/7891000100103', { token: admin });

    assert.equal(r.status, 404);
    assert.equal(r.corpo.encontrado, false);
    assert.ok(r.corpo.sugestao.length > 0);
  });

  it('filtra por família', async () => {
    const r = await chamar('/api/materiais?familiaId=' + familiaCimento, { token: admin });

    assert.equal(r.status, 200);
    assert.ok(r.corpo.materiais.length > 0);
    assert.ok(r.corpo.materiais.every((m: { familia: { id: string } }) => m.familia.id === familiaCimento));
  });
});

describe('Fornecedores', () => {
  it('cadastra com as famílias que atende', async () => {
    const r = await chamar('/api/fornecedores', {
      metodo: 'POST',
      token: admin,
      corpo: {
        razaoSocial: 'Eletrosul Materiais Elétricos Ltda',
        nomeFantasia: 'Eletrosul',
        cnpj: '05570714000159',
        whatsapp: '5511977776666',
        familias: [familiaEletrica],
      },
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.fornecedor.cnpjFormatado, '05.570.714/0001-59');
    assert.equal(r.corpo.fornecedor.familias.length, 1);
  });

  it('recusa CNPJ inválido', async () => {
    const r = await chamar('/api/fornecedores', {
      metodo: 'POST',
      token: admin,
      corpo: { razaoSocial: 'Empresa Fantasma', cnpj: '11111111111111', familias: [] },
    });

    assert.equal(r.status, 400);
  });

  it('recusa CNPJ já cadastrado', async () => {
    const r = await chamar('/api/fornecedores', {
      metodo: 'POST',
      token: admin,
      corpo: { razaoSocial: 'Outro Nome', cnpj: '05.570.714/0001-59', familias: [] },
    });

    assert.equal(r.status, 409);
  });

  it('filtra por família: só quem vende aquilo aparece', async () => {
    await chamar('/api/fornecedores', {
      metodo: 'POST',
      token: admin,
      corpo: {
        razaoSocial: 'Cimenteira Nacional Ltda',
        cnpj: '33000167000101',
        familias: [familiaCimento],
      },
    });

    const eletrica = await chamar('/api/fornecedores?familiaId=' + familiaEletrica, {
      token: admin,
    });

    assert.equal(eletrica.corpo.fornecedores.length, 1);
    assert.equal(eletrica.corpo.fornecedores[0].nomeFantasia, 'Eletrosul');
  });

  it('a busca por nome filtra de verdade', async () => {
    // Já existe mais de um fornecedor cadastrado neste bloco.
    const todos = await chamar('/api/fornecedores', { token: admin });
    assert.ok(todos.corpo.fornecedores.length > 1, 'o teste precisa de mais de um fornecedor');

    const r = await chamar('/api/fornecedores?busca=Eletrosul', { token: admin });

    assert.equal(r.corpo.fornecedores.length, 1, 'a busca por nome tem de reduzir a lista');
    assert.equal(r.corpo.fornecedores[0].nomeFantasia, 'Eletrosul');
  });

  it('a busca não diferencia maiúscula de minúscula', async () => {
    const r = await chamar('/api/fornecedores?busca=eletro', { token: admin });

    assert.equal(r.corpo.fornecedores.length, 1);
  });

  it('busca por CNPJ continua funcionando, inteiro ou em pedaço', async () => {
    const inteiro = await chamar('/api/fornecedores?busca=05570714000159', { token: admin });
    const pedaco = await chamar('/api/fornecedores?busca=0557', { token: admin });

    assert.equal(inteiro.corpo.fornecedores.length, 1);
    assert.equal(inteiro.corpo.fornecedores[0].nomeFantasia, 'Eletrosul');
    assert.equal(pedaco.corpo.fornecedores.length, 1);
  });

  it('busca sem resultado devolve lista vazia, não a lista toda', async () => {
    // O defeito era este: texto sem dígito virava contains:'' no CNPJ,
    // que casa com todo mundo, e a busca devolvia tudo.
    const r = await chamar('/api/fornecedores?busca=NaoExisteEsseFornecedor', { token: admin });

    assert.equal(r.corpo.fornecedores.length, 0);
  });
});

describe('Obras e orçamento', () => {
  let obraId = '';

  it('cria a obra já com o almoxarifado dela', async () => {
    const r = await chamar('/api/obras', {
      metodo: 'POST',
      token: admin,
      corpo: { codigo: 'ob-teste', nome: 'Residencial de Teste', cidade: 'São Paulo', uf: 'SP' },
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.obra.codigo, 'OB-TESTE');
    assert.equal(r.corpo.obra.almoxarifados, 1, 'a obra deveria nascer com um almoxarifado');

    obraId = r.corpo.obra.id;
  });

  it('recusa UF inexistente', async () => {
    const r = await chamar('/api/obras', {
      metodo: 'POST',
      token: admin,
      corpo: { codigo: 'OB-XX', nome: 'Obra com UF errada', uf: 'XX' },
    });

    assert.equal(r.status, 400);
  });

  it('adiciona linha e calcula o total', async () => {
    await chamar('/api/obras/' + obraId + '/linhas', {
      metodo: 'POST',
      token: admin,
      corpo: {
        codigo: '03.01.001',
        descricao: 'Cimento Portland',
        unidade: 'SC',
        quantidadePrevista: 1200,
        valorUnitarioPrevisto: 34,
      },
    });

    const r = await chamar('/api/obras/' + obraId, { token: admin });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.obra.linhas.length, 1);
    assert.equal(r.corpo.obra.linhas[0].valorTotalPrevisto, 40800);
    assert.equal(r.corpo.obra.orcamentoTotal, 40800);
  });

  it('recusa linha com código repetido na mesma obra', async () => {
    const r = await chamar('/api/obras/' + obraId + '/linhas', {
      metodo: 'POST',
      token: admin,
      corpo: { codigo: '03.01.001', descricao: 'Repetida', unidade: 'SC' },
    });

    assert.equal(r.status, 409);
  });

  it('importa planilha aceitando formato brasileiro e acentos', async () => {
    const csv = [
      'codigo;descricao;unidade;quantidade;valor_unitario',
      '02.01.001;Fundação — estacas hélice contínua;M;450;1.250,00',
      '02.01.002;Blocos de coroamento;M3;38;890,50',
    ].join('\n');

    const r = await chamar('/api/obras/' + obraId + '/linhas/importar', {
      metodo: 'POST',
      token: admin,
      corpo: { csv },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.importadas, 2);
    assert.equal(r.corpo.totalDeProblemas, 0);

    const obra = await chamar('/api/obras/' + obraId, { token: admin });
    const fundacao = obra.corpo.obra.linhas.find(
      (l: { codigo: string }) => l.codigo === '02.01.001',
    );

    assert.equal(fundacao.descricao, 'Fundação — estacas hélice contínua');
    assert.equal(fundacao.valorUnitarioPrevisto, 1250);
    assert.equal(fundacao.valorTotalPrevisto, 562500);
  });

  it('reimportar a mesma planilha não duplica', async () => {
    const csv = [
      'codigo;descricao;unidade;quantidade;valor_unitario',
      '02.01.001;Fundação — estacas hélice contínua;M;450;1.250,00',
    ].join('\n');

    const r = await chamar('/api/obras/' + obraId + '/linhas/importar', {
      metodo: 'POST',
      token: admin,
      corpo: { csv },
    });

    assert.equal(r.corpo.importadas, 0);
    assert.equal(r.corpo.ignoradas, 1);
  });

  it('importa o que está certo e aponta o que está errado', async () => {
    const csv = [
      'codigo;descricao;unidade;quantidade;valor_unitario',
      '09.01.001;Linha boa;RL;45;390,00',
      ';Sem código;M2;10;10',
      '09.01.002;Valor inválido;M2;abc;xyz',
    ].join('\n');

    const r = await chamar('/api/obras/' + obraId + '/linhas/importar', {
      metodo: 'POST',
      token: admin,
      corpo: { csv },
    });

    assert.equal(r.corpo.importadas, 1);
    assert.equal(r.corpo.totalDeProblemas, 2);
  });
});

describe('Limites de alçada', () => {
  it('traz as três faixas padrão sem nenhum furo', async () => {
    const r = await chamar('/api/alcadas', { token: admin });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.regras.length, 3);
    assert.deepEqual(r.corpo.avisos, [], 'as faixas padrão não deveriam gerar aviso');
  });

  it('diz quem aprova cada valor', async () => {
    const casos = [
      { valor: 800, contem: 'Gestor de obra', todas: false },
      { valor: 7500, contem: 'Engenheiro', todas: true },
      { valor: 42000, contem: 'Fundador', todas: false },
    ];

    for (const caso of casos) {
      const r = await chamar('/api/alcadas/simular?valor=' + caso.valor, { token: admin });

      assert.equal(r.status, 200);
      assert.equal(r.corpo.encontrada, true, 'R$ ' + caso.valor + ' deveria ter faixa');
      assert.ok(
        r.corpo.explicacao.includes(caso.contem),
        'R$ ' + caso.valor + ' deveria envolver ' + caso.contem,
      );
      assert.equal(
        r.corpo.explicacao.includes('TODAS'),
        caso.todas,
        'R$ ' + caso.valor + ': regra de assinatura errada',
      );
    }
  });

  it('trata a fronteira exata entre faixas', async () => {
    const r = await chamar('/api/alcadas/simular?valor=2000', { token: admin });

    assert.equal(r.corpo.encontrada, true);
    // R$ 2.000,00 ainda é a primeira faixa; R$ 2.000,01 já é a segunda.
    assert.ok(!r.corpo.explicacao.includes('TODAS'));
  });

  it('recusa faixa com máximo menor que o mínimo', async () => {
    const funcoes = await chamar('/api/funcoes', { token: admin });

    const r = await chamar('/api/alcadas', {
      metodo: 'POST',
      token: admin,
      corpo: {
        descricao: 'Faixa invertida',
        valorMinimo: 10000,
        valorMaximo: 5000,
        funcoes: [funcoes.corpo.funcoes[0].id],
      },
    });

    assert.equal(r.status, 400);
  });

  it('exige pelo menos uma função aprovadora', async () => {
    const r = await chamar('/api/alcadas', {
      metodo: 'POST',
      token: admin,
      corpo: { descricao: 'Sem aprovador', valorMinimo: 0, valorMaximo: 100, funcoes: [] },
    });

    assert.equal(r.status, 400);
  });
});
