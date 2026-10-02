// ============================================================
//  Paginação nas dez listas que crescem
//
//  O defeito que originou isto: toda lista cortava num número
//  fixo (200, 300, 500) e devolvia o corte como se fosse tudo.
//  A linha 201 ficava no banco, sem aparecer em tela nenhuma, e
//  a tela ainda dizia "200 listadas".
//
//  Estes testes guardam duas coisas diferentes:
//
//  1. O CONTRATO. Toda rota paginada devolve total, pagina,
//     porPagina e paginas. Se alguém escrever uma lista nova e
//     esquecer o `camposDaPagina`, a tela não desenha barra
//     nenhuma — e o sistema volta a mentir em silêncio. O teste
//     bate em todas as dez, de uma vez.
//
//  2. A CONTA. O `total` vem de um `count` e as linhas vêm de um
//     `findMany`. São duas consultas: se o filtro de uma divergir
//     do da outra, a barra promete sete páginas e a sétima vem
//     vazia. Aqui a verificação é feita a fundo em duas tabelas
//     onde criar linha é barato, página por página, somando.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let familiaId = '';

/**
 * Quantas linhas criar.
 *
 * 23 com 10 por página dá três páginas, sendo a última
 * INCOMPLETA — é o caso que o arredondamento erra.
 */
const QUANTAS = 23;

/**
 * CNPJ de teste, com dígito verificador certo.
 *
 * O cadastro CONFERE o dígito — e deve conferir. Então o teste
 * não pode inventar quatorze números quaisquer: calcula o
 * verificador do mesmo jeito que a Receita, a partir de uma raiz
 * sequencial. Sem isso, os vinte e três cadastros voltariam 400 e
 * o teste passaria medindo lista vazia.
 */
function cnpjDeTeste(indice: number): string {
  const base = '1122233' + String(indice).padStart(2, '0') + '000';

  const digito = (parcial: string, pesoInicial: number): string => {
    let peso = pesoInicial;
    let soma = 0;

    for (const caractere of parcial) {
      soma += Number(caractere) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }

    const resto = soma % 11;
    return String(resto < 2 ? 0 : 11 - resto);
  };

  const primeiro = digito(base, 5);
  const segundo = digito(base + primeiro, 6);

  return base + primeiro + segundo;
}

before(async () => {
  await limparDados();
  await criarUsuarioTeste('admin-paginacao@teste.com.br', ['ADMINISTRADOR']);
  admin = await entrarComo('admin-paginacao@teste.com.br');

  const familia = await chamar('/api/familias', {
    metodo: 'POST',
    token: admin,
    corpo: { codigo: 'PAG', nome: 'Família da paginação' },
  });
  familiaId = familia.corpo.familia.id;

  for (let i = 1; i <= QUANTAS; i++) {
    const n = String(i).padStart(2, '0');

    const material = await chamar('/api/materiais', {
      metodo: 'POST',
      token: admin,
      corpo: {
        familiaId,
        codigoInterno: 'PAG-' + n,
        descricao: 'Material de teste ' + n,
        unidadeMedida: 'UN',
      },
    });
    assert.equal(material.status, 201, 'não criou o material ' + n + ': ' + material.corpo?.erro);

    const fornecedor = await chamar('/api/fornecedores', {
      metodo: 'POST',
      token: admin,
      corpo: {
        cnpj: cnpjDeTeste(i),
        razaoSocial: 'Fornecedor de teste ' + n + ' LTDA',
        familias: [familiaId],
      },
    });
    assert.equal(fornecedor.status, 201, 'não criou o fornecedor ' + n + ': ' + fornecedor.corpo?.erro);
  }
});

after(encerrar);

// ------------------------------------------------------------
//  1. O contrato, nas dez
// ------------------------------------------------------------

/**
 * As dez listas que crescem sem teto.
 *
 * As filas de trabalho ficaram DE FORA de propósito — a de
 * aprovação, os itens disponíveis para cotação, os pedidos
 * esperando entrega. Fila que cresce é fila parada: ali o número
 * grande é o problema a resolver, não uma lista a navegar. Elas
 * têm teto e não têm barra.
 */
const LISTAS = [
  { rota: '/api/solicitacoes', chave: 'solicitacoes' },
  { rota: '/api/pedidos', chave: 'pedidos' },
  { rota: '/api/cotacoes', chave: 'cotacoes' },
  { rota: '/api/materiais', chave: 'materiais' },
  { rota: '/api/fornecedores', chave: 'fornecedores' },
  { rota: '/api/estoque/movimentos', chave: 'movimentos' },
  { rota: '/api/notas-fiscais', chave: 'notas' },
  { rota: '/api/contas-pagar', chave: 'titulos' },
  { rota: '/api/recebimentos', chave: 'recebimentos' },
  { rota: '/api/locacao', chave: 'contratos' },
];

describe('Toda lista que cresce devolve a conta da página', () => {
  for (const lista of LISTAS) {
    it(lista.rota + ' diz quantas existem, não quantas vieram', async () => {
      const r = await chamar(lista.rota + '?porPagina=5', { token: admin });

      assert.equal(r.status, 200, lista.rota + ' respondeu ' + r.status);

      assert.ok(
        Array.isArray(r.corpo[lista.chave]),
        lista.rota + ' deveria devolver a lista em "' + lista.chave + '"',
      );

      assert.equal(typeof r.corpo.total, 'number', 'falta o total em ' + lista.rota);
      assert.equal(r.corpo.pagina, 1);
      assert.equal(r.corpo.porPagina, 5);
      assert.equal(typeof r.corpo.paginas, 'number', 'falta o paginas em ' + lista.rota);

      // Lista vazia é UMA página vazia, não zero páginas: a tela
      // precisa de um lugar para dizer "nada aqui ainda".
      assert.ok(r.corpo.paginas >= 1, lista.rota + ' prometeu menos de uma página');

      // A página nunca traz mais do que foi pedido.
      assert.ok(
        r.corpo[lista.chave].length <= 5,
        lista.rota + ' trouxe ' + r.corpo[lista.chave].length + ' linhas com porPagina=5',
      );

      // E a conta de páginas tem de fechar com o total.
      assert.equal(r.corpo.paginas, Math.max(1, Math.ceil(r.corpo.total / 5)));
    });
  }
});

// ------------------------------------------------------------
//  2. A conta, a fundo
// ------------------------------------------------------------

/** Junta todas as páginas e devolve os ids, na ordem. */
async function percorrerTudo(rota: string, chave: string, porPagina: number) {
  const primeira = await chamar(
    rota + (rota.includes('?') ? '&' : '?') + 'porPagina=' + porPagina,
    { token: admin },
  );

  const ids: string[] = primeira.corpo[chave].map((x: { id: string }) => x.id);

  for (let p = 2; p <= primeira.corpo.paginas; p++) {
    const r = await chamar(
      rota + (rota.includes('?') ? '&' : '?') + 'porPagina=' + porPagina + '&pagina=' + p,
      { token: admin },
    );
    ids.push(...r.corpo[chave].map((x: { id: string }) => x.id));
  }

  return { ids, total: primeira.corpo.total, paginas: primeira.corpo.paginas };
}

for (const caso of [
  { nome: 'Materiais', rota: '/api/materiais', chave: 'materiais' },
  { nome: 'Fornecedores', rota: '/api/fornecedores', chave: 'fornecedores' },
]) {
  describe(caso.nome + ': as páginas somam o total', () => {
    it('três páginas de 10 entregam as ' + QUANTAS + ', sem repetir e sem perder', async () => {
      const { ids, total, paginas } = await percorrerTudo(caso.rota, caso.chave, 10);

      assert.equal(total, QUANTAS, 'o total não é o total de verdade');
      assert.equal(paginas, 3);
      assert.equal(ids.length, QUANTAS, 'somando as páginas não dá o total');

      // Repetição aqui significaria ordenação instável: duas
      // linhas empatadas trocando de lugar entre uma consulta e a
      // seguinte fazem uma aparecer duas vezes e outra nunca.
      assert.equal(new Set(ids).size, QUANTAS, 'alguma linha apareceu em duas páginas');
    });

    it('a última página vem incompleta, com o resto exato', async () => {
      const r = await chamar(caso.rota + '?porPagina=10&pagina=3', { token: admin });

      assert.equal(r.corpo[caso.chave].length, 3);
    });

    it('página além do fim vem vazia, e não quebra', async () => {
      const r = await chamar(caso.rota + '?porPagina=10&pagina=99', { token: admin });

      assert.equal(r.status, 200);
      assert.equal(r.corpo[caso.chave].length, 0);
      // O total continua verdadeiro: é o que deixa a tela dizer
      // "a página 99 não existe, há 3" em vez de "não há nada".
      assert.equal(r.corpo.total, QUANTAS);
    });

    it('pedido inválido cai na página 1 em vez de dar erro', async () => {
      for (const sujeira of ['pagina=0', 'pagina=-5', 'pagina=abc', 'pagina=']) {
        const r = await chamar(caso.rota + '?porPagina=10&' + sujeira, { token: admin });

        assert.equal(r.status, 200, sujeira + ' deu ' + r.status);
        assert.equal(r.corpo.pagina, 1, sujeira + ' não caiu na página 1');
      }
    });

    it('porPagina gigante bate no teto de 100', async () => {
      const r = await chamar(caso.rota + '?porPagina=999999', { token: admin });

      assert.equal(r.corpo.porPagina, 100);
    });
  });
}

// ------------------------------------------------------------
//  4. Os números do alto da tela não seguem a página
// ------------------------------------------------------------

describe('Os resumos das telas são contados no banco', () => {
  it('/api/pedidos devolve o resumo, e ele não encolhe com a página', async () => {
    const inteiro = await chamar('/api/pedidos?porPagina=100', { token: admin });
    const cortado = await chamar('/api/pedidos?porPagina=1', { token: admin });

    assert.equal(inteiro.status, 200);
    assert.ok(cortado.corpo.resumo, 'falta o resumo em /api/pedidos');

    // Pedir uma linha por página não pode mudar nenhum dos três.
    assert.deepEqual(cortado.corpo.resumo, inteiro.corpo.resumo);

    assert.equal(cortado.corpo.resumo.pedidos, cortado.corpo.total);
    assert.equal(typeof cortado.corpo.resumo.valorTotal, 'number');
    assert.equal(typeof cortado.corpo.resumo.fornecedores, 'number');
  });

  it('/api/cotacoes devolve o resumo, e ele não encolhe com a página', async () => {
    const inteiro = await chamar('/api/cotacoes?porPagina=100', { token: admin });
    const cortado = await chamar('/api/cotacoes?porPagina=1', { token: admin });

    assert.ok(cortado.corpo.resumo, 'falta o resumo em /api/cotacoes');
    assert.deepEqual(cortado.corpo.resumo, inteiro.corpo.resumo);
  });

  it('o resumo das cotações não segue o filtro da lista', async () => {
    // De propósito: "pacotes abertos" é o estado do trabalho em
    // andamento, e continua valendo enquanto a pessoa olha as
    // canceladas do ano passado.
    const todas = await chamar('/api/cotacoes', { token: admin });
    const canceladas = await chamar('/api/cotacoes?situacao=CANCELADO', { token: admin });

    assert.deepEqual(canceladas.corpo.resumo, todas.corpo.resumo);
  });

  // A ARITMÉTICA da soma é provada em equalizacao.test.ts, que tem
  // pedidos de verdade. Aqui o banco só tem materiais e
  // fornecedores: uma prova de soma daria zero contra zero, e
  // passaria para sempre sem medir coisa alguma.
});

// ------------------------------------------------------------
//  3. O filtro vale para a conta também
// ------------------------------------------------------------

describe('O filtro conta junto', () => {
  it('buscar reduz o total, não só a página', async () => {
    // "teste 1" casa com 10 a 19 — dez dos vinte e três. ("teste
    // 01" não casa: o zero fica no meio.)
    const r = await chamar('/api/materiais?busca=teste%201&porPagina=5', { token: admin });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.total, 10, 'o total ignorou a busca');
    assert.equal(r.corpo.paginas, 2);
    assert.equal(r.corpo.materiais.length, 5);
  });

  it('busca que não acha nada devolve zero e uma página', async () => {
    const r = await chamar('/api/materiais?busca=zzzznaoexiste', { token: admin });

    assert.equal(r.corpo.total, 0);
    assert.equal(r.corpo.paginas, 1);
    assert.equal(r.corpo.materiais.length, 0);
  });

  it('o filtro de fornecedores por família conta certo', async () => {
    const r = await chamar('/api/fornecedores?familiaId=' + familiaId + '&porPagina=10', {
      token: admin,
    });

    assert.equal(r.corpo.total, QUANTAS);
  });
});
