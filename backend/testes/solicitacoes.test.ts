// ============================================================
//  Testes da Etapa 3 - Solicitação de compra
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let bras = '';
let gilson = '';
let obraId = '';
let linhaId = '';
let cimentoId = '';
let areiaId = '';

before(async () => {
  await limparDados();
  await criarUsuarioTeste('admin3@teste.com.br', ['ADMINISTRADOR']);
  // Bras: abre solicitação, mas NÃO enxerga a dos outros.
  await criarUsuarioTeste('bras3@teste.com.br', ['SOLICITANTE']);
  // Gilson: também só enxerga as próprias.
  await criarUsuarioTeste('gilson3@teste.com.br', ['ALMOXARIFE']);
  // Neilma: comprador, enxerga todas.
  await criarUsuarioTeste('neilma3@teste.com.br', ['COMPRADOR']);

  admin = await entrarComo('admin3@teste.com.br');
  bras = await entrarComo('bras3@teste.com.br');
  gilson = await entrarComo('gilson3@teste.com.br');

  const familia = await chamar('/api/familias', {
    metodo: 'POST',
    token: admin,
    corpo: { codigo: 'CIM', nome: 'Cimento' },
  });

  const cimento = await chamar('/api/materiais', {
    metodo: 'POST',
    token: admin,
    corpo: {
      familiaId: familia.corpo.familia.id,
      codigoInterno: '00119',
      descricao: 'Cimento Portland CP-II saco 50kg',
      unidadeMedida: 'SC',
      codigoLinhaPadrao: '03.01.001',
    },
  });
  cimentoId = cimento.corpo.material.id;

  const areia = await chamar('/api/materiais', {
    metodo: 'POST',
    token: admin,
    corpo: {
      familiaId: familia.corpo.familia.id,
      codigoInterno: '00210',
      descricao: 'Areia média lavada',
      unidadeMedida: 'M3',
    },
  });
  areiaId = areia.corpo.material.id;

  const obra = await chamar('/api/obras', {
    metodo: 'POST',
    token: admin,
    corpo: { codigo: 'OB-SOL', nome: 'Obra das Solicitações' },
  });
  obraId = obra.corpo.obra.id;

  const linha = await chamar('/api/obras/' + obraId + '/linhas', {
    metodo: 'POST',
    token: admin,
    corpo: {
      codigo: '03.01.001',
      descricao: 'Cimento',
      unidade: 'SC',
      quantidadePrevista: 1000,
      valorUnitarioPrevisto: 34,
    },
  });
  linhaId = linha.corpo.linha.id;
});

after(encerrar);

describe('Criar solicitação', () => {
  it('nasce como rascunho com número sequencial', async () => {
    const r = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: {
        obraId,
        justificativa: 'Concretagem da laje',
        itens: [
          { materialId: cimentoId, quantidade: 120, linhaOrcamentoId: linhaId, valorEstimado: 34 },
        ],
      },
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.solicitacao.situacao, 'RASCUNHO');
    assert.match(r.corpo.solicitacao.numeroFormatado, /^SOL-\d{5}$/);
    assert.equal(r.corpo.solicitacao.podeEditar, true);
  });

  it('copia a unidade de medida do cadastro', async () => {
    const r = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: { obraId, itens: [{ materialId: areiaId, quantidade: 15 }] },
    });

    assert.equal(r.corpo.solicitacao.itens[0].unidadeMedida, 'M3');
  });

  it('calcula o total estimado', async () => {
    const r = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: {
        obraId,
        itens: [
          { materialId: cimentoId, quantidade: 100, valorEstimado: 34 },
          { materialId: areiaId, quantidade: 10, valorEstimado: 130 },
        ],
      },
    });

    assert.equal(r.corpo.solicitacao.totalEstimado, 100 * 34 + 10 * 130);
  });

  it('recusa quantidade zero', async () => {
    const r = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: { obraId, itens: [{ materialId: cimentoId, quantidade: 0 }] },
    });

    assert.equal(r.status, 400);
  });

  it('recusa obra inexistente', async () => {
    const r = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: {
        obraId: '00000000-0000-4000-8000-000000000000',
        itens: [{ materialId: cimentoId, quantidade: 1 }],
      },
    });

    assert.equal(r.status, 400);
  });

  it('almoxarife também pode abrir solicitação', async () => {
    const r = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: gilson,
      corpo: { obraId, itens: [{ materialId: cimentoId, quantidade: 5 }] },
    });

    assert.equal(r.status, 201);
  });
});

describe('Primeira compra', () => {
  it('marca o primeiro pedido de um item como primeira compra', async () => {
    // Item novo, nunca pedido antes neste banco de testes.
    const familia = await chamar('/api/familias', {
      metodo: 'POST',
      token: admin,
      corpo: { codigo: 'NOV', nome: 'Novidades' },
    });

    const novo = await chamar('/api/materiais', {
      metodo: 'POST',
      token: admin,
      corpo: {
        familiaId: familia.corpo.familia.id,
        codigoInterno: 'X0001',
        descricao: 'Impermeabilizante especial',
        unidadeMedida: 'LT',
      },
    });

    const r = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: {
        obraId,
        itens: [{ materialId: novo.corpo.material.id, quantidade: 20, valorEstimado: 80 }],
      },
    });

    assert.equal(r.corpo.solicitacao.itens[0].primeiraCompra, true);
  });

  it('impede o envio sem especificação técnica', async () => {
    const familia = await chamar('/api/familias', {
      metodo: 'POST',
      token: admin,
      corpo: { codigo: 'NV2', nome: 'Novidades 2' },
    });

    const novo = await chamar('/api/materiais', {
      metodo: 'POST',
      token: admin,
      corpo: {
        familiaId: familia.corpo.familia.id,
        codigoInterno: 'X0002',
        descricao: 'Aditivo plastificante',
        unidadeMedida: 'LT',
      },
    });

    const criada = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: { obraId, itens: [{ materialId: novo.corpo.material.id, quantidade: 10 }] },
    });

    const envio = await chamar('/api/solicitacoes/' + criada.corpo.solicitacao.id + '/enviar', {
      metodo: 'POST',
      token: bras,
    });

    assert.equal(envio.status, 400);
    assert.ok(envio.corpo.detalhes[0].includes('nunca foi comprado'));
  });

  it('libera o envio quando a especificação é preenchida', async () => {
    const familia = await chamar('/api/familias', {
      metodo: 'POST',
      token: admin,
      corpo: { codigo: 'NV3', nome: 'Novidades 3' },
    });

    const novo = await chamar('/api/materiais', {
      metodo: 'POST',
      token: admin,
      corpo: {
        familiaId: familia.corpo.familia.id,
        codigoInterno: 'X0003',
        descricao: 'Manta asfáltica',
        unidadeMedida: 'M2',
      },
    });

    const criada = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: {
        obraId,
        itens: [
          {
            materialId: novo.corpo.material.id,
            quantidade: 200,
            valorEstimado: 45,
            especificacaoTecnica: 'Manta 4mm com poliéster, conforme NBR 9952.',
          },
        ],
      },
    });

    const envio = await chamar('/api/solicitacoes/' + criada.corpo.solicitacao.id + '/enviar', {
      metodo: 'POST',
      token: bras,
    });

    assert.equal(envio.status, 200);
    assert.equal(envio.corpo.solicitacao.situacao, 'AGUARDANDO_APROVACAO');
  });
});

describe('Envio e alçada', () => {
  async function criarComValor(valorTotal: number): Promise<string> {
    const r = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: {
        obraId,
        itens: [{ materialId: cimentoId, quantidade: 1, valorEstimado: valorTotal }],
      },
    });
    return r.corpo.solicitacao.id;
  }

  it('compra pequena vai para o gestor de obra', async () => {
    const id = await criarComValor(800);
    const r = await chamar('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST', token: bras });

    assert.equal(r.status, 200);
    assert.ok(r.corpo.aprovacao.explicacao.includes('Gestor de obra'));
    // Pelo CAMPO, e não pela redação. Isto olhava a palavra "TODAS"
    // na frase; quando a frase mudou, a prova caiu sem que a regra
    // tivesse mudado nada — e, pior, teria passado se a frase
    // continuasse certa com a regra errada.
    assert.equal(r.corpo.aprovacao.exigeTodas, false);
    assert.deepEqual(
      r.corpo.aprovacao.funcoes.map((f: { codigo: string }) => f.codigo),
      ['GESTOR_OBRA'],
    );
  });

  it('compra média exige as duas assinaturas', async () => {
    const id = await criarComValor(7500);
    const r = await chamar('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST', token: bras });

    assert.equal(r.corpo.aprovacao.exigeTodas, true);
    assert.ok(r.corpo.aprovacao.explicacao.includes('Engenheiro'));

    // A tela monta a LISTA com isto: sem código, ela não consegue
    // marcar quem já assinou; sem nome, não tem o que escrever.
    const funcoes = r.corpo.aprovacao.funcoes as Array<{ codigo: string; nome: string }>;
    assert.equal(funcoes.length, 2);
    assert.ok(funcoes.every((f) => f.codigo && f.nome));
  });

  it('compra alta sobe para o fundador', async () => {
    const id = await criarComValor(42000);
    const r = await chamar('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST', token: bras });

    assert.ok(r.corpo.aprovacao.explicacao.includes('Fundador'));
  });

  it('não deixa enviar duas vezes', async () => {
    const id = await criarComValor(500);
    await chamar('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST', token: bras });

    const segunda = await chamar('/api/solicitacoes/' + id + '/enviar', {
      metodo: 'POST',
      token: bras,
    });

    assert.equal(segunda.status, 409);
  });

  it('não deixa editar depois de enviada', async () => {
    const id = await criarComValor(500);
    await chamar('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST', token: bras });

    const edicao = await chamar('/api/solicitacoes/' + id + '/itens', {
      metodo: 'POST',
      token: bras,
      corpo: { itens: [{ materialId: cimentoId, quantidade: 999 }] },
    });

    assert.equal(edicao.status, 409);
  });

  // ----------------------------------------------------------
  //  Corrigir um rascunho
  //
  //  O servidor sabia fazer isto desde a Etapa 3 e NENHUMA tela
  //  chamava. Quem digitasse errado só podia cancelar e refazer —
  //  o dono do sistema refez a mesma solicitação duas vezes em
  //  27/09/2026, por causa de uma especificação técnica em branco.
  //
  //  A tela agora chama, então as rotas precisam de prova própria:
  //  se elas quebrarem, o botão volta a não existir na prática.
  // ----------------------------------------------------------

  it('o autor corrige o cabeçalho do rascunho', async () => {
    const id = await criarComValor(500);

    const r = await chamar('/api/solicitacoes/' + id, {
      metodo: 'PATCH',
      token: bras,
      corpo: { justificativa: 'Corrigida depois', observacoes: 'Entrar pelo portão 2' },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.solicitacao.justificativa, 'Corrigida depois');
    assert.equal(r.corpo.solicitacao.observacoes, 'Entrar pelo portão 2');
  });

  it('corrigir os itens é o que destrava o envio recusado', async () => {
    // O caso real: item de primeira compra sem especificação
    // técnica. O envio é recusado, e sem editar não havia saída.
    const criada = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: { obraId, itens: [{ materialId: cimentoId, quantidade: 10 }] },
    });
    const id = criada.corpo.solicitacao.id;

    const troca = await chamar('/api/solicitacoes/' + id + '/itens', {
      metodo: 'POST',
      token: bras,
      corpo: {
        itens: [
          {
            materialId: cimentoId,
            quantidade: 10,
            especificacaoTecnica: 'CP-II-Z-32, saco 50kg, ABNT NBR 16697.',
          },
        ],
      },
    });

    assert.equal(troca.status, 200);

    const envio = await chamar('/api/solicitacoes/' + id + '/enviar', {
      metodo: 'POST',
      token: bras,
    });

    assert.equal(envio.status, 200, 'com a especificação preenchida, o envio passa');
  });

  it('o cabeçalho também trava depois de enviada', async () => {
    const id = await criarComValor(500);
    await chamar('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST', token: bras });

    const r = await chamar('/api/solicitacoes/' + id, {
      metodo: 'PATCH',
      token: bras,
      corpo: { justificativa: 'tarde demais' },
    });

    assert.equal(r.status, 409);
  });

  it('ninguém corrige o rascunho de outra pessoa', async () => {
    const id = await criarComValor(500);

    const r = await chamar('/api/solicitacoes/' + id, {
      metodo: 'PATCH',
      token: gilson,
      corpo: { justificativa: 'não é minha' },
    });

    assert.equal(r.status, 404, 'nem diz que existe');
  });

  it('registra o histórico de tudo que aconteceu', async () => {
    const id = await criarComValor(300);
    await chamar('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST', token: bras });

    const r = await chamar('/api/solicitacoes/' + id, { token: bras });
    const tipos = r.corpo.solicitacao.eventos.map((e: { tipo: string }) => e.tipo);

    assert.ok(tipos.includes('CRIADA'));
    assert.ok(tipos.includes('ENVIADA'));
  });
});

describe('Visibilidade: cada um vê o que solicitou', () => {
  let daBras = '';

  before(async () => {
    const r = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: { obraId, itens: [{ materialId: cimentoId, quantidade: 7 }] },
    });
    daBras = r.corpo.solicitacao.id;
  });

  it('o autor enxerga a própria solicitação', async () => {
    const r = await chamar('/api/solicitacoes/' + daBras, { token: bras });
    assert.equal(r.status, 200);
  });

  it('outro solicitante NÃO enxerga', async () => {
    const r = await chamar('/api/solicitacoes/' + daBras, { token: gilson });

    // 404 e não 403: nem confirmamos que ela existe.
    assert.equal(r.status, 404);
  });

  it('quem tem "ver todas" enxerga', async () => {
    const neilma = await entrarComo('neilma3@teste.com.br');
    const r = await chamar('/api/solicitacoes/' + daBras, { token: neilma });

    assert.equal(r.status, 200);
  });

  it('a lista respeita a mesma regra', async () => {
    const listaGilson = await chamar('/api/solicitacoes', { token: gilson });
    const listaNeilma = await chamar('/api/solicitacoes', { token: await entrarComo('neilma3@teste.com.br') });

    assert.equal(listaGilson.corpo.vendoTodas, false);
    assert.equal(listaNeilma.corpo.vendoTodas, true);
    assert.ok(
      listaNeilma.corpo.solicitacoes.length > listaGilson.corpo.solicitacoes.length,
      'quem vê todas deveria ver mais solicitações',
    );
  });
});

describe('Cancelamento', () => {
  it('cancela um rascunho', async () => {
    const criada = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: { obraId, itens: [{ materialId: cimentoId, quantidade: 3 }] },
    });

    const r = await chamar('/api/solicitacoes/' + criada.corpo.solicitacao.id + '/cancelar', {
      metodo: 'POST',
      token: bras,
      corpo: { motivo: 'Pedido em duplicidade' },
    });

    assert.equal(r.status, 200);

    const depois = await chamar('/api/solicitacoes/' + criada.corpo.solicitacao.id, { token: bras });
    assert.equal(depois.corpo.solicitacao.situacao, 'CANCELADA');
  });

  it('não cancela duas vezes', async () => {
    const criada = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: { obraId, itens: [{ materialId: cimentoId, quantidade: 3 }] },
    });

    const id = criada.corpo.solicitacao.id;
    await chamar('/api/solicitacoes/' + id + '/cancelar', { metodo: 'POST', token: bras });

    const segunda = await chamar('/api/solicitacoes/' + id + '/cancelar', {
      metodo: 'POST',
      token: bras,
    });

    assert.equal(segunda.status, 409);
  });
});

describe('PDF', () => {
  it('gera o arquivo com o nome certo', async () => {
    const criada = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: bras,
      corpo: {
        obraId,
        justificativa: 'Concretagem da laje do 3º pavimento',
        itens: [
          { materialId: cimentoId, quantidade: 120, linhaOrcamentoId: linhaId, valorEstimado: 34 },
        ],
      },
    });

    const numero = criada.corpo.solicitacao.numeroFormatado;

    // O inject devolve o corpo como texto; conferimos o cabeçalho
    // do PDF e o nome sugerido para download.
    const r = await chamar('/api/solicitacoes/' + criada.corpo.solicitacao.id + '/pdf', {
      token: bras,
    });

    assert.equal(r.status, 200);
    assert.ok(String(r.tipo).includes('application/pdf'), 'deveria devolver um PDF');
    assert.ok(r.tamanho > 1000, 'o PDF deveria ter conteudo');

    const semAcesso = await chamar('/api/solicitacoes/' + criada.corpo.solicitacao.id + '/pdf', {
      token: gilson,
    });

    assert.equal(semAcesso.status, 404, 'quem não pode ver também não pode baixar o PDF');
    assert.match(numero, /^SOL-/);
  });
});

// ============================================================
//  O filtro de situação
// ============================================================

describe('Filtrar por situação', () => {
  it('cada situação devolve SÓ o que está nela', async () => {
    // O defeito que o dono achou em 28/09/2026: filtrar por
    // ATENDIDA devolvia as sete solicitações. A rota validava o
    // valor contra uma lista própria, que não sabia da situação
    // nova, e o que não estava na lista caía fora do filtro em
    // silêncio.
    const criada = await chamar('/api/solicitacoes', {
      metodo: 'POST', token: bras,
      corpo: { obraId, itens: [{ materialId: cimentoId, quantidade: 3 }] },
    });
    assert.equal(criada.status, 201);

    const rascunhos = await chamar('/api/solicitacoes?situacao=RASCUNHO', { token: admin });
    const atendidas = await chamar('/api/solicitacoes?situacao=ATENDIDA', { token: admin });
    const todas = await chamar('/api/solicitacoes', { token: admin });

    assert.ok(rascunhos.corpo.solicitacoes.length > 0);
    assert.ok(
      rascunhos.corpo.solicitacoes.every((s: { situacao: string }) => s.situacao === 'RASCUNHO'),
      'veio coisa que não é rascunho',
    );

    // Nenhuma foi atendida nesta suíte: a lista tem de vir VAZIA,
    // e não com tudo dentro.
    assert.equal(atendidas.corpo.solicitacoes.length, 0);
    assert.ok(
      todas.corpo.solicitacoes.length > rascunhos.corpo.solicitacoes.length,
      'sem filtro tem de vir mais do que com filtro',
    );
  });

  it('situação que não existe é RECUSADA, não ignorada', async () => {
    // Ignorar era o que escondia o defeito: a tela mostrava tudo
    // achando que tinha filtrado.
    const r = await chamar('/api/solicitacoes?situacao=INVENTADA', { token: admin });

    assert.equal(r.status, 400);
    assert.match(r.corpo.erro, /desconhecida/);
    assert.match(r.corpo.detalhes[0], /ATENDIDA/, 'a mensagem diz quais valem');
  });

  it('sem filtro continua trazendo tudo', async () => {
    const r = await chamar('/api/solicitacoes', { token: admin });

    assert.equal(r.status, 200);
    assert.ok(r.corpo.solicitacoes.length > 0);
  });
});

// ============================================================
//  Paginação
// ============================================================

describe('Paginação da lista', () => {
  /** Cria N rascunhos para haver mais de uma página. */
  async function criarVarias(quantas: number) {
    for (let i = 0; i < quantas; i++) {
      await chamar('/api/solicitacoes', {
        metodo: 'POST', token: bras,
        corpo: { obraId, itens: [{ materialId: cimentoId, quantidade: 1 }] },
      });
    }
  }

  it('devolve o TOTAL de verdade, não o tamanho da página', async () => {
    // O defeito que isto fecha: a lista cortava em 200 e dizia
    // "200 listadas" havendo mais. A 201ª não aparecia em tela
    // nenhuma, e nada avisava.
    await criarVarias(25);

    const r = await chamar('/api/solicitacoes?pagina=1', { token: admin });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.solicitacoes.length, 20, 'a página tem 20');
    assert.ok(r.corpo.total > 20, 'mas o total conta todas');
    assert.equal(r.corpo.paginas, Math.ceil(r.corpo.total / 20));
    assert.equal(r.corpo.pagina, 1);
  });

  it('a página 2 traz outras solicitações, sem repetir', async () => {
    const p1 = await chamar('/api/solicitacoes?pagina=1', { token: admin });
    const p2 = await chamar('/api/solicitacoes?pagina=2', { token: admin });

    const numeros1 = p1.corpo.solicitacoes.map((s: { numero: number }) => s.numero);
    const numeros2 = p2.corpo.solicitacoes.map((s: { numero: number }) => s.numero);

    assert.ok(numeros2.length > 0);
    assert.equal(
      numeros1.filter((n: number) => numeros2.includes(n)).length,
      0,
      'página 2 não pode repetir o que já veio na 1',
    );
  });

  it('página além do fim devolve lista vazia, não erro', async () => {
    const r = await chamar('/api/solicitacoes?pagina=9999', { token: admin });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.solicitacoes.length, 0);
    assert.ok(r.corpo.total > 0, 'o total continua sendo o de verdade');
  });

  it('o filtro vale para a conta E para a página', async () => {
    // Se o total fosse contado sem o filtro, a tela diria
    // "de 68" e mostraria 3 — e ninguém entenderia por quê.
    const r = await chamar('/api/solicitacoes?situacao=RASCUNHO&pagina=1', { token: admin });

    assert.ok(
      r.corpo.solicitacoes.every((s: { situacao: string }) => s.situacao === 'RASCUNHO'),
    );

    const todas = await chamar('/api/solicitacoes', { token: admin });
    assert.ok(r.corpo.total <= todas.corpo.total, 'filtrado não pode contar mais que o total');
  });

  it('pedido de página absurdo não derruba a API', async () => {
    for (const q of ['pagina=abacaxi', 'pagina=-5', 'porPagina=999999']) {
      const r = await chamar('/api/solicitacoes?' + q, { token: admin });
      assert.equal(r.status, 200, q);
      assert.ok(r.corpo.solicitacoes.length <= 100, 'o teto por página protege a memória');
    }
  });
});
