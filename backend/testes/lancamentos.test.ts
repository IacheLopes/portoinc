// ============================================================
//  Testes das receitas e despesas lançadas à mão
//
//  O lugar que ninguém achava na reunião de 08/10/2026: onde se
//  cadastra a receita da empresa e a despesa que não vem de compra.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
/** Tem financeiro.gerenciar: lança. */
let comprador = '';
/** Tem só financeiro.ver: olha e não mexe. */
let fundador = '';
/** Não tem nenhuma das duas: nem entra. */
let almoxarife = '';

let obraId = '';

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function emDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function lancar(corpo: Record<string, unknown>, token = comprador) {
  return chamar('/api/lancamentos', { metodo: 'POST', token, corpo });
}

before(async () => {
  await limparDados();

  await criarUsuarioTeste('admin.lc@portoinc.com.br', ['ADMINISTRADOR']);
  admin = await entrarComo('admin.lc@portoinc.com.br');

  await criarUsuarioTeste('comprador.lc@portoinc.com.br', ['COMPRADOR']);
  comprador = await entrarComo('comprador.lc@portoinc.com.br');

  await criarUsuarioTeste('fundador.lc@portoinc.com.br', ['FUNDADOR']);
  fundador = await entrarComo('fundador.lc@portoinc.com.br');

  await criarUsuarioTeste('almoxarife.lc@portoinc.com.br', ['ALMOXARIFE']);
  almoxarife = await entrarComo('almoxarife.lc@portoinc.com.br');

  const obra = await chamar('/api/obras', {
    metodo: 'POST', token: admin, corpo: { codigo: 'OB-LC', nome: 'Obra do caixa' },
  });
  obraId = obra.corpo.obra.id;
});

after(encerrar);

describe('Lançar receita', () => {
  it('grava a medição recebida e devolve o número', async () => {
    const r = await lancar({
      tipo: 'RECEITA',
      descricao: 'Medição 3 — Residencial Porto Belo',
      valor: 185000,
      previstoPara: hoje(),
      obraId,
      categoria: 'Medição de obra',
      jaAconteceu: true,
    });

    assert.equal(r.status, 201);
    assert.match(r.corpo.lancamento.numeroFormatado, /^LC-\d{5}$/);
    assert.equal(r.corpo.lancamento.tipo, 'RECEITA');
    assert.equal(r.corpo.lancamento.valor, 185000);
    assert.equal(r.corpo.lancamento.situacao, 'REALIZADO');
    assert.equal(r.corpo.lancamento.obra.codigo, 'OB-LC');
  });

  it('aceita receita da EMPRESA, sem obra', async () => {
    // O aporte do sócio não é de obra nenhuma. Exigir obra
    // obrigaria a inventar uma, e a Porto Inc. acabaria com uma
    // obra chamada "Geral" só para fechar o formulário.
    const r = await lancar({
      tipo: 'RECEITA',
      descricao: 'Aporte dos sócios',
      valor: 400000,
      previstoPara: hoje(),
      jaAconteceu: true,
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.lancamento.obra, null);
  });

  it('nasce PREVISTO quando o dinheiro ainda não andou', async () => {
    const r = await lancar({
      tipo: 'RECEITA',
      descricao: 'Medição 4 — prevista',
      valor: 90000,
      previstoPara: emDias(30),
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.lancamento.situacao, 'PREVISTO');
    assert.equal(r.corpo.lancamento.realizadoEm, null);
  });
});

describe('Lançar despesa que não vem de compra', () => {
  it('grava o combustível, sem nota de fornecedor atrás', async () => {
    const r = await lancar({
      tipo: 'DESPESA',
      descricao: 'Combustível da frota — outubro',
      valor: 3200,
      previstoPara: hoje(),
      categoria: 'Frota',
      formaPagamento: 'Cartão',
      jaAconteceu: true,
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.lancamento.tipo, 'DESPESA');
    assert.equal(r.corpo.lancamento.categoria, 'Frota');
  });
});

describe('O que o formulário recusa', () => {
  it('recusa valor zero ou negativo', async () => {
    for (const valor of [0, -500]) {
      const r = await lancar({
        tipo: 'DESPESA', descricao: 'Tentativa inválida', valor, previstoPara: hoje(),
      });
      assert.equal(r.status, 400, 'valor ' + valor + ' deveria ser recusado');
    }
  });

  it('recusa descrição curta: "x" não diz o que é o dinheiro', async () => {
    const r = await lancar({
      tipo: 'RECEITA', descricao: 'x', valor: 100, previstoPara: hoje(),
    });

    assert.equal(r.status, 400);
  });

  it('recusa tipo que não existe', async () => {
    const r = await lancar({
      tipo: 'ESTORNO', descricao: 'Tipo inventado', valor: 100, previstoPara: hoje(),
    });

    assert.equal(r.status, 400);
  });

  it('recusa data impossível', async () => {
    const r = await lancar({
      tipo: 'RECEITA', descricao: 'Data torta', valor: 100, previstoPara: '2026-13-45',
    });

    assert.equal(r.status, 400);
  });

  it('recusa obra que não existe', async () => {
    const r = await lancar({
      tipo: 'RECEITA',
      descricao: 'Obra fantasma',
      valor: 100,
      previstoPara: hoje(),
      obraId: '00000000-0000-4000-8000-000000000000',
    });

    assert.equal(r.status, 404);
  });
});

describe('Quem pode mexer', () => {
  it('quem só enxerga o financeiro não lança', async () => {
    const r = await lancar(
      { tipo: 'RECEITA', descricao: 'Tentativa do fundador', valor: 100, previstoPara: hoje() },
      fundador,
    );

    assert.equal(r.status, 403);
  });

  it('quem não é do financeiro nem vê a lista', async () => {
    const r = await chamar('/api/lancamentos', { token: almoxarife });
    assert.equal(r.status, 403);
  });

  it('quem só enxerga o financeiro VÊ a lista e o caixa', async () => {
    const lista = await chamar('/api/lancamentos', { token: fundador });
    const caixa = await chamar('/api/lancamentos/caixa', { token: fundador });

    assert.equal(lista.status, 200);
    assert.equal(caixa.status, 200);
  });

  it('sem crachá, nada', async () => {
    const r = await chamar('/api/lancamentos');
    assert.equal(r.status, 401);
  });
});

describe('A lista', () => {
  it('vem paginada, com o total de verdade', async () => {
    const r = await chamar('/api/lancamentos?porPagina=2', { token: comprador });

    // Sem número fixo: contar o que as suítes acima criaram daria
    // um teste que quebra quando se acrescenta um caso lá em cima.
    // O que importa é a relação — o total é MAIOR que a página.
    assert.equal(r.status, 200);
    assert.equal(r.corpo.lancamentos.length, 2, 'a página respeita o tamanho pedido');
    assert.ok(r.corpo.total > 2, 'o total conta tudo, não só a página');
    assert.equal(r.corpo.porPagina, 2);
    assert.equal(r.corpo.paginas, Math.ceil(r.corpo.total / 2));
  });

  it('o filtro vale para a conta E para as linhas', async () => {
    // O defeito que a etapa de paginação encontrou em dez telas:
    // contar tudo e listar filtrado promete páginas vazias.
    const r = await chamar('/api/lancamentos?tipo=RECEITA&porPagina=100', { token: comprador });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.total, r.corpo.lancamentos.length);
    assert.ok(r.corpo.lancamentos.every((l: { tipo: string }) => l.tipo === 'RECEITA'));
  });

  it('filtra por obra', async () => {
    const r = await chamar('/api/lancamentos?obraId=' + obraId, { token: comprador });

    assert.equal(r.status, 200);
    assert.ok(r.corpo.lancamentos.length >= 1);
    assert.ok(r.corpo.lancamentos.every((l: { obra: { id: string } }) => l.obra.id === obraId));
  });
});

describe('Corrigir, realizar e cancelar', () => {
  async function umPrevisto() {
    const r = await lancar({
      tipo: 'DESPESA',
      descricao: 'Aluguel do container',
      valor: 1500,
      previstoPara: emDias(10),
    });
    return r.corpo.lancamento.id as string;
  }

  it('corrige o valor digitado errado', async () => {
    const id = await umPrevisto();

    const r = await chamar('/api/lancamentos/' + id, {
      metodo: 'PATCH', token: comprador, corpo: { valor: 1800 },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.lancamento.valor, 1800);
    assert.equal(r.corpo.lancamento.descricao, 'Aluguel do container', 'o resto não muda');
  });

  it('marca como realizado e grava a data', async () => {
    const id = await umPrevisto();

    const r = await chamar('/api/lancamentos/' + id + '/realizar', {
      metodo: 'POST', token: comprador, corpo: { realizadoEm: hoje() },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.lancamento.situacao, 'REALIZADO');
    assert.ok(r.corpo.lancamento.realizadoEm);
    assert.equal(r.corpo.mensagem, 'Saída registrada.');
  });

  it('não marca duas vezes', async () => {
    const id = await umPrevisto();

    await chamar('/api/lancamentos/' + id + '/realizar', { metodo: 'POST', token: comprador });
    const segunda = await chamar('/api/lancamentos/' + id + '/realizar', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(segunda.status, 409);
  });

  it('cancelar exige motivo, e o motivo fica escrito', async () => {
    const id = await umPrevisto();

    const sem = await chamar('/api/lancamentos/' + id + '/cancelar', {
      metodo: 'POST', token: comprador, corpo: {},
    });
    assert.equal(sem.status, 400);

    const com = await chamar('/api/lancamentos/' + id + '/cancelar', {
      metodo: 'POST', token: comprador, corpo: { motivo: 'Contrato de locação encerrado.' },
    });

    assert.equal(com.status, 200);
    assert.equal(com.corpo.lancamento.situacao, 'CANCELADO');
    assert.match(com.corpo.lancamento.observacoes, /Contrato de locação encerrado/);
  });

  it('cancelado não se corrige nem se realiza', async () => {
    const id = await umPrevisto();
    await chamar('/api/lancamentos/' + id + '/cancelar', {
      metodo: 'POST', token: comprador, corpo: { motivo: 'Lançado em duplicidade.' },
    });

    const corrigir = await chamar('/api/lancamentos/' + id, {
      metodo: 'PATCH', token: comprador, corpo: { valor: 1 },
    });
    const realizar = await chamar('/api/lancamentos/' + id + '/realizar', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(corrigir.status, 409);
    assert.equal(realizar.status, 409);
  });

  it('não some da lista depois de cancelado', async () => {
    // Lançamento é dinheiro: quem auditar daqui a um ano precisa
    // ver que existiu e foi cancelado, não um buraco na numeração.
    const id = await umPrevisto();
    await chamar('/api/lancamentos/' + id + '/cancelar', {
      metodo: 'POST', token: comprador, corpo: { motivo: 'Teste de trilha.' },
    });

    const r = await chamar('/api/lancamentos?situacao=CANCELADO&porPagina=100', {
      token: comprador,
    });

    assert.ok(r.corpo.lancamentos.some((l: { id: string }) => l.id === id));
  });

  it('o que não existe dá 404, não 500', async () => {
    const r = await chamar('/api/lancamentos/00000000-0000-4000-8000-000000000000', {
      metodo: 'PATCH', token: comprador, corpo: { valor: 10 },
    });

    assert.equal(r.status, 404);
  });
});

describe('O fluxo do painel enxerga os lançamentos', () => {
  it('a receita recebida vira entrada no mês', async () => {
    await limparDados();

    await criarUsuarioTeste('fluxo.lc@portoinc.com.br', ['COMPRADOR']);
    const token = await entrarComo('fluxo.lc@portoinc.com.br');

    await lancar({
      tipo: 'RECEITA', descricao: 'Medição recebida', valor: 80000,
      previstoPara: hoje(), jaAconteceu: true,
    }, token);
    await lancar({
      tipo: 'DESPESA', descricao: 'Combustível', valor: 1200,
      previstoPara: hoje(), jaAconteceu: true,
    }, token);

    const r = await chamar('/api/financeiro/painel', { token });
    assert.equal(r.status, 200);

    const chave = new Date().toISOString().slice(0, 7);
    const mes = r.corpo.fluxo.find((m: { chave: string }) => m.chave === chave);

    assert.ok(mes, 'o mês de hoje está na janela de doze meses');
    assert.equal(mes.entrada, 80000);
    // A despesa avulsa cai na MESMA barra das parcelas pagas: do
    // ponto de vista do caixa, as duas são dinheiro que saiu no mês.
    assert.equal(mes.pago, 1200);
  });

  it('a receita prevista fica em "a receber", fora da entrada', async () => {
    await limparDados();

    await criarUsuarioTeste('fluxo2.lc@portoinc.com.br', ['COMPRADOR']);
    const token = await entrarComo('fluxo2.lc@portoinc.com.br');

    await lancar({
      tipo: 'RECEITA', descricao: 'Medição prometida', valor: 40000,
      previstoPara: hoje(),
    }, token);

    const r = await chamar('/api/financeiro/painel', { token });
    const chave = new Date().toISOString().slice(0, 7);
    const mes = r.corpo.fluxo.find((m: { chave: string }) => m.chave === chave);

    assert.equal(mes.entrada, 0);
    assert.equal(mes.aReceber, 40000);
  });

  it('a rota do período devolve entrada também', async () => {
    // Duas rotas montam o fluxo — o painel e a do período. Se só uma
    // soma os lançamentos, andar um mês e voltar apaga a entrada.
    const chave = new Date().toISOString().slice(0, 7);
    const token = await entrarComo('fluxo2.lc@portoinc.com.br');

    const r = await chamar('/api/financeiro/fluxo?referencia=' + chave, { token });
    assert.equal(r.status, 200);

    const mes = r.corpo.fluxo.find((m: { chave: string }) => m.chave === chave);
    assert.equal(mes.aReceber, 40000);
  });
});

describe('O caixa', () => {
  it('fecha a conta: entrou menos saiu', async () => {
    await limparDados();

    await criarUsuarioTeste('caixa.lc@portoinc.com.br', ['COMPRADOR']);
    const token = await entrarComo('caixa.lc@portoinc.com.br');

    await lancar({
      tipo: 'RECEITA', descricao: 'Medição recebida', valor: 100000,
      previstoPara: hoje(), jaAconteceu: true,
    }, token);
    await lancar({
      tipo: 'DESPESA', descricao: 'Diária de retroescavadeira', valor: 2500,
      previstoPara: hoje(), jaAconteceu: true,
    }, token);
    await lancar({
      tipo: 'RECEITA', descricao: 'Medição futura', valor: 50000,
      previstoPara: emDias(30),
    }, token);
    await lancar({
      tipo: 'DESPESA', descricao: 'Aluguel previsto', valor: 1500,
      previstoPara: emDias(15),
    }, token);

    const r = await chamar('/api/lancamentos/caixa', { token });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.caixa.entrou, 100000);
    assert.equal(r.corpo.caixa.saiu, 2500);
    assert.equal(r.corpo.caixa.saldo, 97500);
    assert.equal(r.corpo.caixa.aReceber, 50000);
    assert.equal(r.corpo.caixa.aPagar, 1500);
    assert.equal(r.corpo.caixa.previsto, 146000);
  });
});

describe('As análises do caixa', () => {
  let token = '';

  before(async () => {
    await limparDados();
    await criarUsuarioTeste('analise.lc@portoinc.com.br', ['COMPRADOR']);
    token = await entrarComo('analise.lc@portoinc.com.br');

    await lancar({
      tipo: 'RECEITA', descricao: 'Medição 7', valor: 90000,
      previstoPara: hoje(), categoria: 'Medição de obra', jaAconteceu: true,
    }, token);
    await lancar({
      tipo: 'RECEITA', descricao: 'Aporte', valor: 30000,
      previstoPara: hoje(), categoria: 'Aporte', jaAconteceu: true,
    }, token);
    await lancar({
      tipo: 'DESPESA', descricao: 'Combustível', valor: 3000,
      previstoPara: hoje(), categoria: 'Frota', jaAconteceu: true,
    }, token);
    await lancar({
      tipo: 'DESPESA', descricao: 'Taxa', valor: 1000,
      previstoPara: hoje(), categoria: 'Taxas', jaAconteceu: true,
    }, token);
    // Previsto: entra no calendário, NÃO entra nas categorias.
    await lancar({
      tipo: 'DESPESA', descricao: 'Aluguel do mês que vem', valor: 50000,
      previstoPara: emDias(10), categoria: 'Canteiro',
    }, token);
  });

  it('separa de onde vem de para onde vai, com percentual', async () => {
    const r = await chamar('/api/lancamentos/caixa', { token });

    assert.equal(r.status, 200);
    assert.deepEqual(
      r.corpo.deOndeVem.map((f: { nome: string; valor: number; percentual: number }) =>
        [f.nome, f.valor, f.percentual]),
      [['Medição de obra', 90000, 75], ['Aporte', 30000, 25]],
    );
    assert.deepEqual(
      r.corpo.paraOndeVai.map((f: { nome: string }) => f.nome),
      ['Frota', 'Taxas'],
    );
  });

  it('a categoria do que ainda NÃO aconteceu fica de fora', async () => {
    // O aluguel de R$ 50.000 é previsto. Entrando na rosca, ele diria
    // que a empresa gasta 92% com canteiro — gastando R$ 0 com ele.
    const r = await chamar('/api/lancamentos/caixa', { token });

    assert.ok(
      !r.corpo.paraOndeVai.some((f: { nome: string }) => f.nome === 'Canteiro'),
      'o previsto entrou na conta do que já saiu',
    );
  });

  it('o calendário mostra o previsto na semana dele', async () => {
    const r = await chamar('/api/lancamentos/caixa', { token });

    assert.equal(r.corpo.semanas, 6);
    assert.equal(r.corpo.calendario.length, 6);

    const totalSai = r.corpo.calendario.reduce(
      (s: number, x: { sai: number }) => s + x.sai, 0,
    );
    assert.equal(totalSai, 50000, 'o aluguel previsto, e só ele');
  });

  it('o saldo do calendário parte do saldo de hoje', async () => {
    const r = await chamar('/api/lancamentos/caixa', { token });

    // Entrou 120.000, saiu 4.000 -> saldo 116.000. O aluguel de
    // 50.000 cai daqui a 10 dias, então o último saldo é 66.000.
    assert.equal(r.corpo.caixa.saldo, 116000);
    assert.equal(r.corpo.calendario[5].saldoProjetado, 66000);
  });
});

describe('Baixar a lista', () => {
  let token = '';

  before(async () => {
    token = await entrarComo('analise.lc@portoinc.com.br');
  });

  it('sai em PDF e em Word, e nunca em CSV', async () => {
    const pdf = await chamar('/api/lancamentos/exportar?formato=pdf', { token });
    const docx = await chamar('/api/lancamentos/exportar?formato=docx', { token });
    const csv = await chamar('/api/lancamentos/exportar?formato=csv', { token });

    assert.equal(pdf.status, 200);
    assert.match(pdf.tipo, /application\/pdf/);
    assert.match(pdf.anexo, /receitas-e-despesas\.pdf/);

    assert.equal(docx.status, 200);
    assert.match(docx.tipo, /wordprocessingml/);

    assert.equal(csv.status, 400, 'CSV não é formato desta casa');
  });

  it('o arquivo RESPEITA o filtro da tela', async () => {
    // Quem filtrou "só saídas" e recebe um papel com as entradas
    // juntas só descobre depois de imprimir.
    const tudo = await chamar('/api/lancamentos/exportar?formato=pdf', { token });
    const soSaidas = await chamar('/api/lancamentos/exportar?formato=pdf&tipo=DESPESA', { token });

    assert.equal(soSaidas.status, 200);
    assert.ok(
      soSaidas.tamanho < tudo.tamanho,
      'o arquivo filtrado veio do mesmo tamanho do completo',
    );
  });

  it('sem crachá, não baixa', async () => {
    const r = await chamar('/api/lancamentos/exportar?formato=pdf');
    assert.equal(r.status, 401);
  });
});

// ------------------------------------------------------------
//  Quem mexeu no dinheiro
//
//  O plano de arquitetura pede auditoria de "toda aprovação,
//  alteração de preço e movimento de estoque". A solicitação tinha
//  a dela; o dinheiro lançado à mão, não.
// ------------------------------------------------------------
describe('A trilha do lançamento', () => {
  let token = '';
  let id = '';

  before(async () => {
    await limparDados();
    await criarUsuarioTeste('trilha.lc@portoinc.com.br', ['COMPRADOR']);
    token = await entrarComo('trilha.lc@portoinc.com.br');

    const r = await lancar({
      tipo: 'RECEITA',
      descricao: 'Medição para auditar',
      valor: 10000,
      previstoPara: hoje(),
      categoria: 'Medição de obra',
    }, token);

    id = r.corpo.lancamento.id;
  });

  it('o nascimento fica registrado, com quem lançou', async () => {
    const r = await chamar('/api/lancamentos/' + id + '/eventos', { token });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.eventos.length, 1);
    assert.equal(r.corpo.eventos[0].tipo, 'CRIADO');
    assert.match(r.corpo.eventos[0].descricao, /Entrada de R\$\s10\.000,00/);
    assert.match(r.corpo.eventos[0].quem, /trilha\.lc/);
  });

  it('a correção guarda o ANTES e o DEPOIS', async () => {
    // É a linha que responde à pergunta de auditoria. Sem ela,
    // trocar uma entrada por uma saída mexe o dobro no saldo e não
    // deixa rastro nenhum.
    await chamar('/api/lancamentos/' + id, {
      metodo: 'PATCH', token, corpo: { valor: 25000, tipo: 'DESPESA' },
    });

    const r = await chamar('/api/lancamentos/' + id + '/eventos', { token });
    const correcao = r.corpo.eventos.find((e: { tipo: string }) => e.tipo === 'CORRIGIDO');

    assert.ok(correcao, 'a correção não foi registrada');
    assert.match(correcao.descricao, /Valor: R\$\s10\.000,00 → R\$\s25\.000,00/);
    assert.match(correcao.descricao, /Tipo: Entrada → Saída/);
  });

  it('SÓ o que mudou de verdade entra na trilha', async () => {
    // Trilha cheia de linha sem novidade é trilha que ninguém lê, e
    // trilha que ninguém lê não audita nada.
    const antes = await chamar('/api/lancamentos/' + id + '/eventos', { token });

    // Manda o mesmo valor que já está lá.
    await chamar('/api/lancamentos/' + id, {
      metodo: 'PATCH', token, corpo: { valor: 25000 },
    });

    const depois = await chamar('/api/lancamentos/' + id + '/eventos', { token });
    assert.equal(depois.corpo.eventos.length, antes.corpo.eventos.length);
  });

  it('realizar e cancelar também ficam', async () => {
    await chamar('/api/lancamentos/' + id + '/realizar', {
      metodo: 'POST', token, corpo: { realizadoEm: hoje() },
    });
    await chamar('/api/lancamentos/' + id + '/cancelar', {
      metodo: 'POST', token, corpo: { motivo: 'Lançado em duplicidade.' },
    });

    const r = await chamar('/api/lancamentos/' + id + '/eventos', { token });
    const tipos = r.corpo.eventos.map((e: { tipo: string }) => e.tipo);

    assert.deepEqual(tipos, ['CRIADO', 'CORRIGIDO', 'REALIZADO', 'CANCELADO']);
    assert.match(r.corpo.eventos[3].descricao, /duplicidade/);
  });

  it('a trilha sai em ordem, da mais velha para a mais nova', async () => {
    const r = await chamar('/api/lancamentos/' + id + '/eventos', { token });
    const datas = r.corpo.eventos.map((e: { quando: string }) => e.quando);

    assert.deepEqual(datas, [...datas].sort());
  });

  it('lançamento que não existe dá 404', async () => {
    const r = await chamar(
      '/api/lancamentos/00000000-0000-4000-8000-000000000000/eventos',
      { token },
    );

    assert.equal(r.status, 404);
  });
});

// ------------------------------------------------------------
//  Campo opcional que dá para APAGAR
// ------------------------------------------------------------
describe('Apagar um campo opcional', () => {
  let token = '';
  let id = '';

  before(async () => {
    await limparDados();
    await criarUsuarioTeste('limpar.lc@portoinc.com.br', ['COMPRADOR']);
    token = await entrarComo('limpar.lc@portoinc.com.br');

    const r = await lancar({
      tipo: 'DESPESA',
      descricao: 'Com categoria errada',
      valor: 500,
      previstoPara: hoje(),
      categoria: 'Frota',
      formaPagamento: 'PIX',
    }, token);

    id = r.corpo.lancamento.id;
  });

  it('campo em branco APAGA o que estava lá', async () => {
    // Antes, os três — ausente, vazio e nulo — viravam `undefined`, e
    // `undefined` diz ao Prisma "não mexa". Quem digitou errado ficava
    // com o erro para sempre, e limpar o campo não dava erro nenhum:
    // simplesmente não fazia nada.
    const r = await chamar('/api/lancamentos/' + id, {
      metodo: 'PATCH', token, corpo: { categoria: '' },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.lancamento.categoria, null);
  });

  it('campo AUSENTE continua sem ser tocado', async () => {
    // A outra metade da regra, e a que não pode quebrar: um PATCH que
    // manda só o valor não pode limpar o resto do cadastro.
    const r = await chamar('/api/lancamentos/' + id, {
      metodo: 'PATCH', token, corpo: { valor: 900 },
    });

    assert.equal(r.corpo.lancamento.valor, 900);
    assert.equal(r.corpo.lancamento.formaPagamento, 'PIX', 'apagou o que não foi mandado');
  });
});

// ============================================================
//  VOLTAR PARA PREVISTO
//
//  A caixa "O dinheiro já entrou" nasce marcada, e só existe na
//  criação. Quem marcou sem querer não tinha caminho de volta:
//  cancelar e lançar de novo deixa dois números no extrato, um
//  deles riscado — caro demais para um erro de clique.
// ============================================================
describe('Voltar para previsto', () => {
  // CRACHÁ PRÓPRIO.
  //
  // Algum teste acima deste encerra as sessões (trocar senha e
  // desativar usuário fazem isso, e os dois estão certos). Os
  // crachás tirados no `before` do arquivo já não valem aqui, e o
  // sintoma é um 401 que parece defeito da rota nova.
  let token = '';

  before(async () => {
    // Conta propria, como os outros blocos do fim do arquivo:
    // as contas do `before` geral ja nao valem aqui — trocar
    // senha e desativar usuario encerram sessoes, e os dois
    // acontecem nos testes acima.
    await criarUsuarioTeste('volta.lc@portoinc.com.br', ['COMPRADOR']);
    token = await entrarComo('volta.lc@portoinc.com.br');
  });

  it('desfaz o "já aconteceu" e zera a data de realização', async () => {
    const criado = await lancar({
      tipo: 'RECEITA',
      descricao: 'Medição que ainda não caiu',
      valor: 50000,
      previstoPara: emDias(30),
      jaAconteceu: true,
    }, token);

    assert.equal(criado.status, 201, JSON.stringify(criado.corpo));
    assert.equal(criado.corpo.lancamento.situacao, 'REALIZADO');
    const id = criado.corpo.lancamento.id;

    const volta = await chamar('/api/lancamentos/' + id + '/voltar-para-previsto', {
      metodo: 'POST',
      token,
    });

    assert.equal(volta.status, 200);
    assert.equal(volta.corpo.lancamento.situacao, 'PREVISTO');
    assert.equal(volta.corpo.lancamento.realizadoEm, null);
  });

  it('fica no histórico: desfazer não é apagar', async () => {
    const criado = await lancar({
      tipo: 'DESPESA',
      descricao: 'Aluguel marcado por engano',
      valor: 8500,
      previstoPara: emDias(10),
      jaAconteceu: true,
    }, token);
    const id = criado.corpo.lancamento.id;

    await chamar('/api/lancamentos/' + id + '/voltar-para-previsto', {
      metodo: 'POST',
      token,
    });

    const eventos = await chamar('/api/lancamentos/' + id + '/eventos', { token });
    const tipos = (eventos.corpo.eventos as Array<{ tipo: string }>).map((e) => e.tipo);

    assert.ok(tipos.includes('VOLTOU_PARA_PREVISTO'), 'a volta tem de ficar registrada');
  });

  it('não volta o que já está previsto', async () => {
    const criado = await lancar({
      tipo: 'RECEITA',
      descricao: 'Já nasceu previsto',
      valor: 1000,
      previstoPara: emDias(15),
      jaAconteceu: false,
    }, token);

    const r = await chamar(
      '/api/lancamentos/' + criado.corpo.lancamento.id + '/voltar-para-previsto',
      { metodo: 'POST', token },
    );

    assert.equal(r.status, 409);
  });

  it('não volta o que foi cancelado', async () => {
    const criado = await lancar({
      tipo: 'DESPESA',
      descricao: 'Para cancelar',
      valor: 300,
      previstoPara: emDias(12),
      jaAconteceu: true,
    }, token);
    const id = criado.corpo.lancamento.id;

    await chamar('/api/lancamentos/' + id + '/cancelar', {
      metodo: 'POST',
      token,
      corpo: { motivo: 'Lançado em duplicidade' },
    });

    const r = await chamar('/api/lancamentos/' + id + '/voltar-para-previsto', {
      metodo: 'POST',
      token,
    });

    assert.equal(r.status, 409);
  });
});
