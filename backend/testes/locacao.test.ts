// ============================================================
//  Testes da Etapa 12 - Locação de equipamentos
//
//  O que se testa aqui é a ligação: quem pode fazer o quê, o
//  que o sistema recusa, e se o número que sai na tela saiu
//  mesmo do contrato. As contas têm testes próprios em
//  src/servicos/locacao.test.ts.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let comprador = '';
let almoxarife = '';
let gestor = '';
let solicitante = '';

let obraId = '';
let outraObraId = '';
let fornecedorId = '';
let familiaId = '';
let equipamentoId = '';

/** Data de hoje mais (ou menos) N dias, como "2026-09-22". */
function emDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

interface Contrato {
  inicio?: number;
  previsao?: number;
  descricao?: string;
  quantidade?: number;
  unidadeMedida?: string;
  periodicidade?: 'DIARIA' | 'SEMANAL' | 'MENSAL';
  valorPeriodo?: number;
  obra?: string;
  token?: string;
}

async function contratar(c: Contrato = {}) {
  return chamar('/api/locacao', {
    metodo: 'POST',
    token: c.token ?? comprador,
    corpo: {
      fornecedorId,
      obraId: c.obra ?? obraId,
      descricao: c.descricao ?? 'Betoneira 400L',
      quantidade: c.quantidade ?? 1,
      unidadeMedida: c.unidadeMedida ?? 'DIA',
      periodicidade: c.periodicidade ?? 'DIARIA',
      valorPeriodo: c.valorPeriodo ?? 65,
      inicioEm: emDias(c.inicio ?? -5),
      previsaoDevolucao: emDias(c.previsao ?? 10),
    },
  });
}

/** Apaga os contratos entre um bloco e outro. */
async function limparContratos() {
  const { banco } = await import('../src/plugins/banco.js');
  await banco.contratoLocacao.deleteMany({});
}

before(async () => {
  await limparDados();

  await criarUsuarioTeste('admin12@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('comprador12@teste.com.br', ['COMPRADOR']);
  await criarUsuarioTeste('almox12@teste.com.br', ['ALMOXARIFE']);
  await criarUsuarioTeste('gestor12@teste.com.br', ['GESTOR_OBRA']);
  await criarUsuarioTeste('solicitante12@teste.com.br', ['SOLICITANTE']);

  admin = await entrarComo('admin12@teste.com.br');
  comprador = await entrarComo('comprador12@teste.com.br');
  almoxarife = await entrarComo('almox12@teste.com.br');
  gestor = await entrarComo('gestor12@teste.com.br');
  solicitante = await entrarComo('solicitante12@teste.com.br');

  const familia = await chamar('/api/familias', {
    metodo: 'POST', token: admin, corpo: { codigo: 'LOC', nome: 'Locação' },
  });
  familiaId = familia.corpo.familia.id;

  const equipamento = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId, codigoInterno: 'LOC-A', tipo: 'SERVICO',
      descricao: 'Locação de betoneira 400L', unidadeMedida: 'DIA',
    },
  });
  equipamentoId = equipamento.corpo.material.id;

  const f = await chamar('/api/fornecedores', {
    metodo: 'POST', token: admin,
    corpo: {
      razaoSocial: 'LocaMaq Locação Ltda', nomeFantasia: 'LocaMaq',
      cnpj: '02558157000162', whatsapp: '5511933332222', familias: [familiaId],
    },
  });
  fornecedorId = f.corpo.fornecedor.id;

  const obra = await chamar('/api/obras', {
    metodo: 'POST', token: admin, corpo: { codigo: 'OB-LOC', nome: 'Obra da locação' },
  });
  obraId = obra.corpo.obra.id;

  const outra = await chamar('/api/obras', {
    metodo: 'POST', token: admin, corpo: { codigo: 'OB-LOC2', nome: 'Outra obra' },
  });
  outraObraId = outra.corpo.obra.id;
});

after(encerrar);

// ============================================================
//  Quem pode o quê
// ============================================================

describe('Permissão', () => {
  it('quem não tem "locacao.ver" não entra', async () => {
    const r = await chamar('/api/locacao', { token: solicitante });

    assert.equal(r.status, 403);
  });

  it('almoxarife e gestor VEEM, mas não contratam', async () => {
    for (const [token, quem] of [[almoxarife, 'almoxarife'], [gestor, 'gestor']] as const) {
      const ve = await chamar('/api/locacao', { token });
      assert.equal(ve.status, 200, quem + ' deveria ver');

      const contrata = await contratar({ token });
      assert.equal(contrata.status, 403, quem + ' não deveria contratar');
    }
  });

  it('o comprador contrata', async () => {
    const r = await contratar();

    assert.equal(r.status, 201);
    await limparContratos();
  });

  it('sem entrar no sistema é negado', async () => {
    const r = await chamar('/api/locacao');

    assert.equal(r.status, 401);
  });
});

// ============================================================
//  Contratar
// ============================================================

describe('Contratar', () => {
  it('nasce ativa, numerada e com o responsável registrado', async () => {
    await limparContratos();
    const r = await contratar();

    assert.equal(r.status, 201);
    assert.match(r.corpo.contrato.numeroFormatado, /^LOC-\d{5}$/);
    assert.equal(r.corpo.contrato.situacao, 'ATIVA');
    assert.equal(r.corpo.contrato.responsavel.email ?? undefined, undefined);
    assert.ok(r.corpo.contrato.responsavel.nome.includes('comprador12'));
  });

  it('recusa devolução antes do início', async () => {
    const r = await contratar({ inicio: 10, previsao: 2 });

    assert.equal(r.status, 400);
    assert.match(r.corpo.erro, /antes do início/);
  });

  it('recusa quantidade e valor zerados', async () => {
    assert.equal((await contratar({ quantidade: 0 })).status, 400);
    assert.equal((await contratar({ valorPeriodo: 0 })).status, 400);
  });

  it('recusa obra e fornecedor que não existem', async () => {
    const semObra = await chamar('/api/locacao', {
      metodo: 'POST', token: comprador,
      corpo: {
        fornecedorId, obraId: '11111111-1111-4111-8111-111111111111',
        descricao: 'Betoneira', quantidade: 1, unidadeMedida: 'DIA',
        periodicidade: 'DIARIA', valorPeriodo: 65,
        inicioEm: emDias(0), previsaoDevolucao: emDias(5),
      },
    });

    assert.equal(semObra.status, 400);
    assert.match(semObra.corpo.erro, /Obra/);
  });

  it('locação de um dia só é aceita', async () => {
    const r = await contratar({ inicio: 0, previsao: 0 });

    assert.equal(r.status, 201, 'alugar e devolver no mesmo dia acontece');
  });
});

// ============================================================
//  O relógio correndo
// ============================================================

describe('Quanto já custou', () => {
  it('a diária conta desde o primeiro dia', async () => {
    await limparContratos();
    // Começou há 4 dias: hoje é o 5º dia.
    const r = await contratar({ inicio: -4, previsao: 10, valorPeriodo: 65 });

    assert.equal(r.corpo.contrato.diasDeUso, 5);
    assert.equal(r.corpo.contrato.custoAcumulado, 325);
  });

  it('período começado é período cobrado', async () => {
    await limparContratos();
    // 8 dias de uso num contrato semanal = 2 semanas.
    const r = await contratar({
      inicio: -7, previsao: 30, periodicidade: 'SEMANAL', valorPeriodo: 300,
    });

    assert.equal(r.corpo.contrato.diasDeUso, 8);
    assert.equal(r.corpo.contrato.periodosCobrados, 2);
    assert.equal(r.corpo.contrato.custoAcumulado, 600);
  });

  it('a quantidade multiplica', async () => {
    await limparContratos();
    const r = await contratar({
      quantidade: 400, unidadeMedida: 'M',
      periodicidade: 'MENSAL', valorPeriodo: 12,
      inicio: -10, previsao: 30,
    });

    assert.equal(r.corpo.contrato.custoAcumulado, 4800);
  });
});

// ============================================================
//  O alerta
// ============================================================

describe('O alerta de equipamento parado', () => {
  it('em dia, perto e atrasada', async () => {
    await limparContratos();

    const emDia = await contratar({ inicio: -1, previsao: 30 });
    const perto = await contratar({ inicio: -1, previsao: 2 });
    const atrasada = await contratar({ inicio: -20, previsao: -8 });

    assert.equal(emDia.corpo.contrato.alerta, 'EM_DIA');
    assert.equal(perto.corpo.contrato.alerta, 'PERTO');
    assert.equal(atrasada.corpo.contrato.alerta, 'ATRASADA');
  });

  it('a atrasada diz quanto o atraso custou', async () => {
    await limparContratos();
    // Combinado até 8 dias atrás, ainda parada: 8 diárias a mais.
    const r = await contratar({ inicio: -20, previsao: -8, valorPeriodo: 65 });

    assert.equal(r.corpo.contrato.diasDeAtraso, 8);
    assert.equal(r.corpo.contrato.custoDoAtraso, 520);
    assert.match(r.corpo.contrato.leitura, /R\$ 520,00/);
  });

  it('o painel separa atrasada de vencendo', async () => {
    await limparContratos();
    await contratar({ inicio: -20, previsao: -8 });
    await contratar({ inicio: -1, previsao: 2 });
    await contratar({ inicio: -1, previsao: 30 });

    const r = await chamar('/api/locacao', { token: admin });

    assert.equal(r.corpo.resumo.ativas, 3);
    assert.equal(r.corpo.resumo.atrasadas, 1);
    assert.equal(r.corpo.resumo.vencendo, 1);
    assert.equal(r.corpo.resumo.desperdicio, 520);
  });

  it('dá para filtrar só o que está atrasado', async () => {
    const r = await chamar('/api/locacao?alerta=ATRASADA', { token: admin });

    assert.equal(r.corpo.contratos.length, 1);
    assert.equal(r.corpo.contratos[0].alerta, 'ATRASADA');
  });

  it('o filtro de obra separa os contratos', async () => {
    await limparContratos();
    await contratar({ obra: obraId });
    await contratar({ obra: outraObraId });

    const todas = await chamar('/api/locacao', { token: admin });
    const so = await chamar('/api/locacao?obraId=' + outraObraId, { token: admin });

    assert.equal(todas.corpo.contratos.length, 2);
    assert.equal(so.corpo.contratos.length, 1);
  });
});

// ============================================================
//  Devolver e cancelar
// ============================================================

describe('Devolver', () => {
  it('registra quem devolveu e para o relógio', async () => {
    await limparContratos();
    const criada = await contratar({ inicio: -10, previsao: 10, valorPeriodo: 65 });
    const id = criada.corpo.contrato.id;

    const r = await chamar('/api/locacao/' + id + '/devolver', {
      metodo: 'POST', token: comprador, corpo: { motivo: 'Fornecedor retirou.' },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.contrato.situacao, 'DEVOLVIDA');
    assert.equal(r.corpo.contrato.alerta, 'DEVOLVIDA');
    assert.ok(r.corpo.contrato.devolvidoPor.nome.includes('comprador12'));
    assert.match(r.corpo.mensagem, /no prazo/);

    // 11 dias de uso a R$ 65
    assert.equal(r.corpo.contrato.custoAcumulado, 715);
  });

  it('devolução atrasada avisa quantos dias', async () => {
    await limparContratos();
    const criada = await contratar({ inicio: -20, previsao: -8 });

    const r = await chamar('/api/locacao/' + criada.corpo.contrato.id + '/devolver', {
      metodo: 'POST', token: comprador, corpo: {},
    });

    assert.match(r.corpo.mensagem, /8 dia\(s\) de atraso/);
    assert.equal(r.corpo.contrato.custoDoAtraso, 520);
  });

  it('não devolve duas vezes', async () => {
    await limparContratos();
    const criada = await contratar();
    const id = criada.corpo.contrato.id;

    await chamar('/api/locacao/' + id + '/devolver', { metodo: 'POST', token: comprador, corpo: {} });
    const denovo = await chamar('/api/locacao/' + id + '/devolver', {
      metodo: 'POST', token: comprador, corpo: {},
    });

    assert.equal(denovo.status, 409);
    assert.match(denovo.corpo.erro, /já foi devolvida/);
  });

  it('não cancela o que já voltou', async () => {
    await limparContratos();
    const criada = await contratar();
    const id = criada.corpo.contrato.id;

    await chamar('/api/locacao/' + id + '/devolver', { metodo: 'POST', token: comprador, corpo: {} });
    const r = await chamar('/api/locacao/' + id + '/cancelar', {
      metodo: 'POST', token: comprador, corpo: { motivo: 'tentativa indevida' },
    });

    assert.equal(r.status, 409);
    assert.match(r.corpo.erro, /não se apaga/);
  });

  it('cancelar exige motivo', async () => {
    await limparContratos();
    const criada = await contratar();

    const semMotivo = await chamar('/api/locacao/' + criada.corpo.contrato.id + '/cancelar', {
      metodo: 'POST', token: comprador, corpo: {},
    });

    assert.equal(semMotivo.status, 400);
  });

  it('contrato cancelado não custa nada e sai do resumo', async () => {
    await limparContratos();
    const criada = await contratar({ inicio: -30, previsao: -10 });

    const r = await chamar('/api/locacao/' + criada.corpo.contrato.id + '/cancelar', {
      metodo: 'POST', token: comprador, corpo: { motivo: 'Equipamento nunca chegou.' },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.contrato.custoAcumulado, 0);

    const painel = await chamar('/api/locacao', { token: admin });
    assert.equal(painel.corpo.resumo.ativas, 0);
    assert.equal(painel.corpo.resumo.custoTotal, 0);
  });

  it('locação que não existe devolve 404', async () => {
    const r = await chamar('/api/locacao/11111111-1111-4111-8111-111111111111', { token: admin });

    assert.equal(r.status, 404);
  });
});

// ============================================================
//  A ponte com a compra
// ============================================================

describe('Itens de locação já comprados', () => {
  it('a rota não é confundida com um id de contrato', async () => {
    const r = await chamar('/api/locacao/pedidos-disponiveis', { token: comprador });

    assert.equal(r.status, 200, '"/pedidos-disponiveis" não pode cair no "/:id"');
    assert.ok(Array.isArray(r.corpo.itens));
  });

  it('só quem gerencia enxerga a ponte', async () => {
    const r = await chamar('/api/locacao/pedidos-disponiveis', { token: almoxarife });

    assert.equal(r.status, 403);
  });
});

// ============================================================
//  Baixar
// ============================================================

describe('Baixar a locação', () => {
  it('sai em PDF e em Word', async () => {
    await limparContratos();
    await contratar();

    const pdf = await chamar('/api/locacao?formato=pdf', { token: admin });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.tipo, 'application/pdf');
    assert.equal(pdf.bruto.subarray(0, 4).toString('latin1'), '%PDF');

    const docx = await chamar('/api/locacao?formato=docx', { token: admin });
    assert.equal(docx.status, 200);
    assert.match(docx.tipo, /wordprocessingml/);
    assert.equal(docx.bruto.subarray(0, 2).toString('latin1'), 'PK');
  });

  it('formato que não existe é recusado', async () => {
    const r = await chamar('/api/locacao?formato=csv', { token: admin });

    assert.equal(r.status, 400);
    assert.match(r.corpo.erro, /pdf/);
  });
});
