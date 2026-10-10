// ============================================================
//  A tela inicial conta certo
//
//  Ela mostra nove cartões — "3 aprovações esperando você", "2
//  contas vencidas". Três deles eram contados trazendo linhas para
//  a memória e contando aqui:
//
//   · Aprovações, com um `take: 500`. Acima de 500 na fila, o
//     cartão contava 500 e mostrava como se fossem todas — um
//     número MENOR que o certo, e calado. Mesma doença das listas
//     que paravam em 200 e diziam que era tudo.
//
//   · Material no ponto de repor e Contas a pagar, sem limite
//     nenhum: o número saía certo e a tabela inteira era carregada
//     a cada abertura da tela que abre primeiro de manhã.
//
//  Os dois últimos foram para o banco. O primeiro ficou onde
//  estava, de propósito — "espera você" depende das regras de
//  alçada, e elas moram num lugar só —, e perdeu o teto.
//
//  O QUE ESTE ARQUIVO GUARDA, acima de tudo: a regra do ponto de
//  repor agora existe DUAS VEZES, uma em TypeScript
//  (`precisaComprar`) e outra em SQL. As duas são rodadas aqui
//  sobre os mesmos dados, e têm de dar o mesmo número.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';
import { banco } from '../src/plugins/banco.js';
import { inicioDoDiaBrMais } from '../src/servicos/fiscal.js';
import { precisaComprar } from '../src/servicos/estoque.js';

let admin = '';
let adminId = '';
let almoxarife = '';
let familiaId = '';
let almoxarifadoId = '';
let outroAlmoxarifado = '';

/** O valor de um cartão da tela inicial, pela chave. */
async function cartao(chave: string, token: string): Promise<number> {
  const r = await chamar('/api/inicio', { token });
  assert.equal(r.status, 200, '/api/inicio respondeu ' + r.status);

  const todos = [...r.corpo.urgentes, ...r.corpo.acompanhar];
  const achado = todos.find((c: { chave: string }) => c.chave === chave);

  assert.ok(achado, 'nao achei o cartao "' + chave + '" na tela inicial');
  return achado.valor as number;
}

/**
 * A MESMA conta, pelo caminho velho: trazer os saldos e filtrar com
 * `precisaComprar`, em TypeScript.
 *
 * É a régua contra a qual a consulta em SQL é medida. Se as duas
 * divergirem, uma das duas está errada — e é esta a única prova no
 * sistema que compara as duas.
 */
async function contarPelaRegraEmTypeScript(): Promise<number> {
  const saldos = await banco.saldoEstoque.findMany({
    where: { material: { pontoPedido: { not: null } } },
    select: {
      quantidade: true,
      material: { select: { pontoPedido: true } },
    },
  });

  return saldos.filter((s) => precisaComprar({
    materialId: '', codigo: '', descricao: '', unidadeMedida: '', custoMedio: null,
    quantidade: Number(s.quantidade),
    pontoPedido: s.material.pontoPedido === null ? null : Number(s.material.pontoPedido),
  })).length;
}

/**
 * Material com linha de saldo ZERADA: entra e sai tudo.
 *
 * Diferente de criar sem movimento nenhum — ali não existe linha de
 * saldo, e o alerta sai do saldo.
 */
async function zerado(codigo: string, pontoPedido: number) {
  const materialId = await comSaldo(codigo, 5, pontoPedido);

  const saida = await chamar('/api/estoque/movimentos', {
    metodo: 'POST',
    token: almoxarife,
    corpo: {
      almoxarifadoId,
      materialId,
      tipo: 'SAIDA',
      quantidade: 5,
      destino: 'Obra',
      observacao: 'Zerando para o teste.',
    },
  });
  assert.equal(saida.status, 200, 'nao zerou ' + codigo + ': ' + saida.corpo?.erro);

  return materialId;
}

/** Cria um material com ponto de pedido e põe saldo nele. */
async function comSaldo(
  codigo: string,
  quantidade: number,
  pontoPedido: number | null,
  onde = almoxarifadoId,
) {
  const m = await chamar('/api/materiais', {
    metodo: 'POST',
    token: admin,
    corpo: {
      familiaId,
      codigoInterno: codigo,
      descricao: 'Material ' + codigo,
      unidadeMedida: 'SC',
      ...(pontoPedido === null ? {} : { pontoPedido }),
    },
  });

  assert.equal(m.status, 201, 'nao criou ' + codigo + ': ' + m.corpo?.erro);
  const materialId = m.corpo.material.id as string;

  if (quantidade > 0) {
    const mov = await chamar('/api/estoque/movimentos', {
      metodo: 'POST',
      token: almoxarife,
      corpo: {
        almoxarifadoId: onde,
        materialId,
        tipo: 'ENTRADA',
        quantidade,
        valorUnitario: 10,
        observacao: 'Saldo do teste.',
      },
    });
    assert.equal(mov.status, 200, 'nao movimentou ' + codigo + ': ' + mov.corpo?.erro);
  }

  return materialId;
}

before(async () => {
  await limparDados();

  adminId = await criarUsuarioTeste('admin-inicio@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('almox-inicio@teste.com.br', ['ALMOXARIFE']);

  admin = await entrarComo('admin-inicio@teste.com.br');
  almoxarife = await entrarComo('almox-inicio@teste.com.br');

  const familia = await chamar('/api/familias', {
    metodo: 'POST',
    token: admin,
    corpo: { codigo: 'INI', nome: 'Família da tela inicial' },
  });
  familiaId = familia.corpo.familia.id;

  // O almoxarifado nasce junto com a obra, um para cada. Para ter
  // dois, criam-se duas obras.
  await chamar('/api/obras', {
    metodo: 'POST', token: admin,
    corpo: { codigo: 'OB-INI', nome: 'Obra da tela inicial' },
  });
  await chamar('/api/obras', {
    metodo: 'POST', token: admin,
    corpo: { codigo: 'OB-INI-2', nome: 'Segunda obra da tela inicial' },
  });

  const almoxarifados = await chamar('/api/almoxarifados', { token: admin });
  const lista = almoxarifados.corpo.almoxarifados ?? [];

  const achar = (codigoDaObra: string) =>
    lista.find((x: { obra: { codigo: string } | null }) => x.obra?.codigo === codigoDaObra)?.id ?? '';

  almoxarifadoId = achar('OB-INI');
  outroAlmoxarifado = achar('OB-INI-2');

  if (!almoxarifadoId || !outroAlmoxarifado) {
    throw new Error('os almoxarifados das obras de teste nao foram criados');
  }
});

after(encerrar);

describe('Material no ponto de repor: SQL e TypeScript têm de concordar', () => {
  it('os casos de borda dão o mesmo número pelos dois caminhos', async () => {
    // Os casos que separam as duas implementações:
    await comSaldo('INI-ABAIXO', 2, 10);     // bem abaixo        -> conta
    await comSaldo('INI-EXATO', 10, 10);     // exatamente igual  -> conta
    await comSaldo('INI-ACIMA', 11, 10);     // um acima          -> não
    await zerado('INI-ZERADO', 10);          // entrou e saiu tudo -> conta
    await comSaldo('INI-PP-ZERO', 0, 0);     // ponto de pedido 0 -> não
    await comSaldo('INI-SEM-PP', 1, null);   // sem ponto de pedido -> não entra

    const pelaTela = await cartao('materiaisAbaixoDoMinimo', almoxarife);
    const pelaRegra = await contarPelaRegraEmTypeScript();

    assert.equal(
      pelaTela,
      pelaRegra,
      'o SQL do ponto de repor divergiu de precisaComprar: ' +
        pelaTela + ' contra ' + pelaRegra,
    );

    // Abaixo, exato e zerado.
    assert.equal(pelaTela, 3);
  });

  it('material que nunca teve movimento não entra no alerta', async () => {
    // Comportamento de hoje, igual antes e depois de a conta ir
    // para o banco — e vale saber: o alerta sai do SALDO, e saldo
    // só existe depois do primeiro movimento. Um item cadastrado
    // com ponto de pedido 50 e nunca comprado não aparece como
    // "no ponto de repor", porque não há linha de saldo nenhuma.
    //
    // Discutível? É. Mas é outra conversa: mudar isso é mudar o que
    // o cartão significa.
    const antes = await cartao('materiaisAbaixoDoMinimo', almoxarife);

    await comSaldo('INI-NUNCA-MOVEU', 0, 50);

    assert.equal(await cartao('materiaisAbaixoDoMinimo', almoxarife), antes);
  });

  it('"ponto de pedido zero" não é alerta, é "não controlo este item"', async () => {
    // O item INI-PP-ZERO tem saldo 0 e ponto de pedido 0. Um `<=`
    // ingênuo no SQL o contaria; `precisaComprar` recusa, porque
    // ponto de pedido zero quer dizer que ninguém definiu mínimo.
    const antes = await cartao('materiaisAbaixoDoMinimo', almoxarife);

    await comSaldo('INI-PP-ZERO-2', 0, 0);

    assert.equal(await cartao('materiaisAbaixoDoMinimo', almoxarife), antes);
  });

  it('conta SALDOS, e o mesmo material em dois lugares conta dois', async () => {
    // Comportamento de hoje, mantido de propósito ao mover a conta
    // para o banco: o cartão conta saldos no vermelho, não materiais
    // distintos. Mudar isso é mudar o que o cartão significa.
    const antes = await cartao('materiaisAbaixoDoMinimo', almoxarife);

    const id = await comSaldo('INI-DOIS-LUGARES', 1, 50);
    await chamar('/api/estoque/movimentos', {
      metodo: 'POST',
      token: almoxarife,
      corpo: {
        almoxarifadoId: outroAlmoxarifado,
        materialId: id,
        tipo: 'ENTRADA',
        quantidade: 1,
        valorUnitario: 10,
        observacao: 'Saldo no segundo almoxarifado.',
      },
    });

    assert.equal(await cartao('materiaisAbaixoDoMinimo', almoxarife), antes + 2);
    assert.equal(await contarPelaRegraEmTypeScript(), antes + 2);
  });
});

describe('Contas a pagar: a fronteira da data é a do Brasil', () => {
  let notaId = '';
  let fornecedorId = '';
  let quantas = 0;

  /**
   * Uma parcela em aberto vencendo daqui a `dias` dias.
   *
   * Parcela nasce de nota fiscal — a relação é obrigatória, e é o
   * que impede conta a pagar aparecer do nada no sistema. O teste
   * lança UMA nota e pendura todas as parcelas nela; o que ele mede
   * é a fronteira das datas, não o caminho da nota.
   */
  async function parcela(dias: number) {
    if (!notaId) {
      const f = await chamar('/api/fornecedores', {
        metodo: 'POST',
        token: admin,
        // Com familia: sem nenhuma o cadastro recusa, porque
        // fornecedor sem familia nunca e convidado a cotar.
        corpo: {
          cnpj: '05570714000159',
          razaoSocial: 'Fornecedor da tela inicial LTDA',
          familias: [familiaId],
        },
      });
      assert.equal(f.status, 201, 'nao criou o fornecedor: ' + f.corpo?.erro);
      fornecedorId = f.corpo.fornecedor.id;

      const nota = await banco.notaFiscal.create({
        data: {
          numero: '900',
          fornecedorId,
          lancadaPorId: adminId,
          emitidaEm: new Date(),
          valorTotal: 1000,
        },
      });
      notaId = nota.id;
    }

    // O DIA BRASILEIRO, E NÃO O DO RELÓGIO DO CONTÊINER.
    //
    // Isto aqui dizia "meio-dia UTC: longe das duas bordas do dia,
    // para o teste medir a regra e não o fuso de quem roda" — e
    // contava os dias a partir de `new Date()`, que no contêiner
    // responde em UTC.
    //
    // Depois das 21h de São Paulo o dia UTC já virou. Aí `parcela(0)`
    // caía AMANHÃ no Brasil, `parcela(-1)` caía hoje, e o teste
    // enxergava uma vencida onde esperava duas.
    //
    // Ou seja: O TESTE DA REGRA DE FUSO FALHAVA POR FUSO, toda noite
    // entre 21h e meia-noite. Achado em 08/10/2026, às 21h11.
    //
    // A âncora passou a ser a mesma que o código de produção usa:
    // `inicioDoDiaBrMais`, que devolve a meia-noite do dia
    // brasileiro. O meio-dia continua ali para ficar longe das duas
    // bordas.
    const quando = inicioDoDiaBrMais(dias);
    quando.setUTCHours(12, 0, 0, 0);

    quantas += 1;

    await banco.contaPagar.create({
      data: {
        notaFiscalId: notaId,
        fornecedorId,
        parcela: quantas,
        totalParcelas: 99,
        valor: 100,
        vencimento: quando,
        situacao: 'ABERTA',
      },
    });
  }

  it('separa vencidas, vencendo e as de depois', async () => {
    await parcela(-3);   // venceu
    await parcela(-1);   // venceu
    await parcela(0);    // vence hoje  -> vencendo
    await parcela(7);    // sétimo dia  -> vencendo
    await parcela(8);    // oitavo dia  -> nenhum dos dois
    await parcela(40);   // longe       -> nenhum dos dois

    assert.equal(await cartao('contasVencidas', admin), 2);
    assert.equal(await cartao('contasVencendoEm7Dias', admin), 2);
  });

  it('a conta paga sai dos dois cartões', async () => {
    const antes = await cartao('contasVencidas', admin);

    const vencida = await banco.contaPagar.findFirst({
      where: { situacao: 'ABERTA', vencimento: { lt: new Date() } },
    });
    assert.ok(vencida, 'o teste precisa de uma parcela vencida');

    await banco.contaPagar.update({
      where: { id: vencida.id },
      data: { situacao: 'PAGA' },
    });

    assert.equal(await cartao('contasVencidas', admin), antes - 1);
  });
});

describe('Aprovações esperando a minha assinatura', () => {
  it('não conta o que eu mesmo abri', async () => {
    // A trava mais importante da alçada: ninguém aprova o próprio
    // pedido. Ela já valia; o que mudou é que agora as minhas nem
    // saem do banco, em vez de virem e serem descartadas aqui.
    //
    // O gestor abre a própria solicitação e a envia: ela fica
    // aguardando a assinatura DELE, pela faixa — e mesmo assim não
    // pode aparecer no cartão dele.
    await criarUsuarioTeste('gestor-inicio@teste.com.br', ['GESTOR_OBRA']);
    const gestor = await entrarComo('gestor-inicio@teste.com.br');

    const antes = await cartao('aprovacoesEsperando', gestor);

    const obras = await chamar('/api/obras', { token: admin });
    const obraId = obras.corpo.obras.find(
      (o: { codigo: string }) => o.codigo === 'OB-INI',
    ).id;

    const material = await comSaldo('INI-APROV', 0, null);

    const nova = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: gestor,
      corpo: {
        obraId,
        dataDesejada: '2026-12-31',
        justificativa: 'Solicitacao do proprio gestor',
        itens: [{ materialId: material, quantidade: 1, valorEstimado: 500 }],
      },
    });
    assert.equal(nova.status, 201, 'nao criou a solicitacao: ' + nova.corpo?.erro);

    await chamar('/api/solicitacoes/' + nova.corpo.solicitacao.id + '/enviar', {
      metodo: 'POST',
      token: gestor,
    });

    assert.equal(
      await cartao('aprovacoesEsperando', gestor),
      antes,
      'o cartao contou a solicitacao que o proprio gestor abriu',
    );
  });
});
