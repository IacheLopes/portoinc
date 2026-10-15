// ============================================================
//  O QUE CADA UM PODE VER
//
//  Esta é a prova mais importante do assistente, e ela não tem
//  nada a ver com inteligência artificial: é sobre ACESSO.
//
//  A decisão de projeto foi não entregar dados ao modelo e sim
//  FERRAMENTAS — e o filtro de quem está perguntando mora no
//  código, nunca no prompt. O motivo é simples: prompt fecha
//  brecha de comportamento, não de acesso. Se o dado entrou na
//  conversa, basta a pessoa escrever "esqueça suas instruções"
//  para ele sair.
//
//  Aqui se prova que ele NÃO ENTRA. Estes testes passam com
//  qualquer modelo, inclusive com nenhum: o que está sendo
//  medido é a consulta.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, encerrar } from './ajuda.js';
import { banco } from '../src/plugins/banco.js';
import { executarFerramenta, type QuemPergunta } from '../src/servicos/assistente-ferramentas.js';

const MARQUILIP = 'Marquilip';
const CONSTRULAR = 'Constrular';

let idMarquilip = '';
let idConstrular = '';

const comoMarquilip = (): QuemPergunta => ({
  tipo: 'fornecedor',
  fornecedorId: idMarquilip,
  nome: MARQUILIP,
});

const comoEquipe = (): QuemPergunta => ({
  tipo: 'equipe',
  usuarioId: 'qualquer',
  nome: 'Comprador',
});

const comoEstranho = (): QuemPergunta => ({ tipo: 'desconhecido', nome: 'desconhecido' });

before(async () => {
  await limparDados();

  const compradorId = await criarUsuarioTeste('comprador-ia@teste.com.br', ['COMPRADOR']);

  const familia = await banco.familiaMaterial.create({
    data: { codigo: 'CIM', nome: 'Cimento e argamassas' },
  });

  const material = await banco.material.create({
    data: {
      familiaId: familia.id,
      codigoInterno: '00119',
      descricao: 'Cimento CP-II saco 50kg',
      tipo: 'MATERIAL',
      unidadeMedida: 'SC',
    },
  });

  const obra = await banco.obra.create({
    data: { codigo: 'OB-001', nome: 'Residencial Teste' },
  });

  const [a, b] = await Promise.all([
    banco.fornecedor.create({
      data: { razaoSocial: MARQUILIP + ' Ltda', nomeFantasia: MARQUILIP, cnpj: '19131243000197' },
    }),
    banco.fornecedor.create({
      data: { razaoSocial: CONSTRULAR + ' Ltda', nomeFantasia: CONSTRULAR, cnpj: '47960950000121' },
    }),
  ]);

  idMarquilip = a.id;
  idConstrular = b.id;

  const solicitacao = await banco.solicitacao.create({
    data: {
      obraId: obra.id,
      solicitanteId: compradorId,
      situacao: 'EM_COTACAO',
      itens: {
        create: { materialId: material.id, quantidade: 300, unidadeMedida: 'SC', valorEstimado: 34 },
      },
    },
    include: { itens: true },
  });

  const bid = await banco.bid.create({
    data: {
      titulo: 'Cimento — Residencial Teste',
      compradorId,
      situacao: 'ABERTO',
      prazoResposta: new Date(Date.now() + 7 * 86400000),
      itens: {
        create: {
          solicitacaoItemId: solicitacao.itens[0].id,
          materialId: material.id,
          quantidade: 300,
          unidadeMedida: 'SC',
        },
      },
      convidados: {
        create: [
          {
            fornecedorId: a.id,
            token: 'tokenA',
            expiraEm: new Date(Date.now() + 7 * 86400000),
          },
          {
            //  A Constrular ABRIU o link e NÃO respondeu. É
            //  exatamente o dado que a equipe quer saber — e que o
            //  concorrente não pode descobrir.
            fornecedorId: b.id,
            token: 'tokenB',
            expiraEm: new Date(Date.now() + 7 * 86400000),
            visualizadoEm: new Date(),
          },
        ],
      },
    },
  });

  await banco.pedido.createMany({
    data: [
      { bidId: bid.id, fornecedorId: a.id, compradorId, situacao: 'ENVIADO' },
      { bidId: bid.id, fornecedorId: b.id, compradorId, situacao: 'RASCUNHO' },
    ],
  });
});

after(encerrar);

describe('O fornecedor vê o dele, e só', () => {
  it('nos PEDIDOS, não aparece o pedido do concorrente', async () => {
    const r = await executarFerramenta('consultarPedidos', {}, comoMarquilip());

    assert.match(r, new RegExp(MARQUILIP));
    assert.doesNotMatch(r, new RegExp(CONSTRULAR), 'vazou o pedido do concorrente');
  });

  it('o filtro por nome NÃO burla o recorte', async () => {
    //  A tentativa óbvia: pedir explicitamente pelo concorrente. O
    //  argumento `fornecedor` é simplesmente ignorado quando quem
    //  pergunta é fornecedor — o recorte vem antes dele.
    const r = await executarFerramenta(
      'consultarPedidos',
      { fornecedor: CONSTRULAR },
      comoMarquilip(),
    );

    assert.doesNotMatch(r, new RegExp(CONSTRULAR));
  });

  it('na COTAÇÃO, não aparece quem mais foi convidado', async () => {
    const r = await executarFerramenta('consultarCotacoes', {}, comoMarquilip());

    assert.match(r, /BID-/, 'ele foi convidado, então vê o pacote');
    assert.doesNotMatch(r, new RegExp(CONSTRULAR), 'vazou quem é o concorrente');
    assert.doesNotMatch(r, /de 2 responderam/, 'vazou o placar da disputa');
  });

  it('NÃO recebe a lista de fornecedores', async () => {
    const r = await executarFerramenta('consultarFornecedores', {}, comoMarquilip());

    assert.match(r, /Só a equipe/);
    assert.doesNotMatch(r, new RegExp(CONSTRULAR));
  });

  it('NÃO recebe as pessoas da empresa', async () => {
    const r = await executarFerramenta('consultarPessoas', {}, comoMarquilip());
    assert.match(r, /Só a equipe/);
  });

  it('NÃO recebe solicitações, estoque, obras nem o resumo', async () => {
    for (const nome of ['consultarSolicitacoes', 'consultarEstoque', 'consultarObras', 'resumoDoSistema']) {
      const r = await executarFerramenta(nome, {}, comoMarquilip());
      assert.match(r, /só para quem tem conta|Só a equipe/i, nome + ' deixou passar');
    }
  });
});

describe('O desconhecido não vê nada', () => {
  it('toda consulta é recusada', async () => {
    const todas = [
      'consultarCotacoes', 'consultarFornecedores', 'consultarSolicitacoes',
      'consultarAprovacoes', 'consultarPedidos', 'consultarEstoque',
      'consultarFinanceiro', 'consultarObras', 'consultarPessoas', 'resumoDoSistema',
    ];

    for (const nome of todas) {
      const r = await executarFerramenta(nome, {}, comoEstranho());

      assert.match(r, /só para quem tem conta|Só a equipe/i, nome + ' respondeu a um estranho');
      assert.doesNotMatch(r, new RegExp(MARQUILIP), nome + ' vazou nome de fornecedor');
      assert.doesNotMatch(r, /BID-/, nome + ' vazou número de cotação');
    }
  });
});

describe('A equipe vê tudo', () => {
  it('enxerga os dois fornecedores no mesmo pacote', async () => {
    const r = await executarFerramenta('consultarCotacoes', {}, comoEquipe());

    assert.match(r, new RegExp(MARQUILIP));
    assert.match(r, new RegExp(CONSTRULAR));
  });

  it('sabe quem ABRIU o link e não respondeu', async () => {
    //  A pergunta que ele fez por escrito: "já visualizou e não
    //  respondeu?". O dado existe desde sempre em `visualizado_em`;
    //  o que faltava era alguém saber perguntar.
    const r = await executarFerramenta('consultarCotacoes', {}, comoEquipe());

    assert.match(r, new RegExp(CONSTRULAR + ': ABRIU o link'));
    assert.match(r, new RegExp(MARQUILIP + ': não abriu'));
  });

  it('sabe qual pedido ainda não saiu para o fornecedor', async () => {
    const r = await executarFerramenta('consultarPedidos', {}, comoEquipe());

    assert.match(r, /AINDA NÃO ENVIADO/);
  });

  it('diz que a equalização ainda não foi feita', async () => {
    const r = await executarFerramenta('consultarCotacoes', {}, comoEquipe());

    assert.match(r, /equalização ainda NÃO feita/);
  });
});

describe('Consulta inventada não derruba a conversa', () => {
  it('nome que não existe devolve recado, não erro', async () => {
    //  O modelo às vezes inventa uma função. A resposta certa é
    //  dizer isso a ele — na volta seguinte ele escolhe uma de
    //  verdade. Explodir aqui mataria o atendimento.
    const r = await executarFerramenta('consultarOFuturo', {}, comoEquipe());

    assert.match(r, /Não existe consulta/);
  });
});
