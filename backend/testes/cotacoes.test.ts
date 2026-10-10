// ============================================================
//  Testes da Etapa 5 - Cotação e portal do fornecedor
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let comprador = '';
let solicitante = '';
let gestor = '';
let obraId = '';
let familiaEle = '';
let familiaCim = '';
let materialCabo = '';
let materialCimento = '';
let fornecedorEle = '';
let fornecedorCim = '';

/** Abre, envia e aprova uma solicitação; devolve os ids dos itens. */
async function solicitacaoAprovada(materiais: Array<{ id: string; qtd: number }>) {
  const criada = await chamar('/api/solicitacoes', {
    metodo: 'POST',
    token: solicitante,
    corpo: {
      obraId,
      dataDesejada: '2026-12-31',
      justificativa: 'Para cotação',
      itens: materiais.map((m) => ({
        materialId: m.id,
        quantidade: m.qtd,
        valorEstimado: 10,
        especificacaoTecnica: 'Conforme norma.',
      })),
    },
  });

  const id = criada.corpo.solicitacao.id;
  await chamar('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST', token: solicitante });

  await chamar('/api/aprovacoes/' + id + '/decidir', {
    metodo: 'POST',
    token: gestor,
    corpo: { decisao: 'APROVADA' },
  });

  const detalhe = await chamar('/api/solicitacoes/' + id, { token: solicitante });
  return detalhe.corpo.solicitacao.itens.map((i: { id: string }) => i.id);
}

before(async () => {
  await limparDados();

  await criarUsuarioTeste('admin5@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('comprador5@teste.com.br', ['COMPRADOR']);
  await criarUsuarioTeste('solicitante5@teste.com.br', ['SOLICITANTE']);
  await criarUsuarioTeste('gestor5@teste.com.br', ['GESTOR_OBRA']);

  admin = await entrarComo('admin5@teste.com.br');
  comprador = await entrarComo('comprador5@teste.com.br');
  solicitante = await entrarComo('solicitante5@teste.com.br');
  gestor = await entrarComo('gestor5@teste.com.br');

  const ele = await chamar('/api/familias', {
    metodo: 'POST', token: admin, corpo: { codigo: 'ELE', nome: 'Elétrica' },
  });
  familiaEle = ele.corpo.familia.id;

  const cim = await chamar('/api/familias', {
    metodo: 'POST', token: admin, corpo: { codigo: 'CIM', nome: 'Cimento' },
  });
  familiaCim = cim.corpo.familia.id;

  const cabo = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId: familiaEle, codigoInterno: 'C001',
      descricao: 'Cabo flexível 2,5mm2', unidadeMedida: 'RL',
    },
  });
  materialCabo = cabo.corpo.material.id;

  const cimento = await chamar('/api/materiais', {
    metodo: 'POST', token: admin,
    corpo: {
      familiaId: familiaCim, codigoInterno: 'M001',
      descricao: 'Cimento CP-II', unidadeMedida: 'SC',
    },
  });
  materialCimento = cimento.corpo.material.id;

  const f1 = await chamar('/api/fornecedores', {
    metodo: 'POST', token: admin,
    corpo: {
      razaoSocial: 'Eletrosul Ltda', cnpj: '05570714000159',
      whatsapp: '5511977776666', familias: [familiaEle],
    },
  });
  fornecedorEle = f1.corpo.fornecedor.id;

  const f2 = await chamar('/api/fornecedores', {
    metodo: 'POST', token: admin,
    corpo: {
      razaoSocial: 'Cimenteira Nacional Ltda', cnpj: '33000167000101',
      whatsapp: '5511966665555', familias: [familiaCim],
    },
  });
  fornecedorCim = f2.corpo.fornecedor.id;

  const obra = await chamar('/api/obras', {
    metodo: 'POST', token: admin, corpo: { codigo: 'OB-COT', nome: 'Obra de cotação' },
  });
  obraId = obra.corpo.obra.id;
});

after(encerrar);

/** Prazo padrão: daqui a 7 dias. */
function prazo(dias = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

describe('Itens disponíveis para cotar', () => {
  it('lista apenas itens de solicitações aprovadas', async () => {
    // Uma aprovada...
    await solicitacaoAprovada([{ id: materialCabo, qtd: 10 }]);

    // ...e uma que fica como rascunho.
    await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: solicitante,
      corpo: { obraId, itens: [{ materialId: materialCimento, quantidade: 5 }] },
    });

    const r = await chamar('/api/cotacoes/itens-disponiveis', { token: comprador });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.itens.length, 1);
    assert.equal(r.corpo.itens[0].material.codigoInterno, 'C001');
  });

  it('só o comprador acessa', async () => {
    const r = await chamar('/api/cotacoes/itens-disponiveis', { token: solicitante });
    assert.equal(r.status, 403);
  });
});

describe('Montar o pacote', () => {
  it('mantém a ordem em que o comprador escolheu os itens', async () => {
    // O banco devolve as linhas do "IN (...)" na ordem que quiser.
    // Se o sistema confiar nisso, o pacote sai embaralhado e o
    // fornecedor recebe os itens fora de sequência.
    const itens = await solicitacaoAprovada([
      { id: materialCimento, qtd: 7 },
      { id: materialCabo, qtd: 3 },
    ]);

    // Manda de propósito na ordem inversa da solicitação.
    const invertida = [...itens].reverse();

    const r = await chamar('/api/cotacoes', {
      metodo: 'POST',
      token: comprador,
      corpo: { titulo: 'Ordem dos itens', prazoResposta: prazo(), itens: invertida },
    });

    assert.equal(r.status, 201);

    // Mandei cimento depois do cabo; é assim que tem que voltar.
    const codigos = r.corpo.cotacao.itens.map(
      (i: { material: { codigoInterno: string } }) => i.material.codigoInterno,
    );

    assert.deepEqual(codigos, ['C001', 'M001']);

    // E a numeração interna acompanha a mesma sequência.
    assert.deepEqual(
      r.corpo.cotacao.itens.map((i: { ordem: number }) => i.ordem),
      [1, 2],
    );
  });

  it('cria como rascunho', async () => {
    const itens = await solicitacaoAprovada([{ id: materialCabo, qtd: 12 }]);

    const r = await chamar('/api/cotacoes', {
      metodo: 'POST',
      token: comprador,
      corpo: { titulo: 'Elétrica', prazoResposta: prazo(), itens },
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.cotacao.situacao, 'RASCUNHO');
    assert.match(r.corpo.cotacao.numeroFormatado, /^BID-\d{5}$/);
    assert.equal(r.corpo.cotacao.itens.length, 1);
  });

  it('recusa pacote sem nenhum item', async () => {
    // A tela já desabilita o botão, mas a regra tem de morar no
    // servidor. Em 27/09/2026 uma chamada direta criou um pacote
    // VAZIO, e ele virou lixo permanente: sem item não há família,
    // sem família não há fornecedor sugerido, sem fornecedor não
    // abre — e não existe rota para apagar cotação.
    const r = await chamar('/api/cotacoes', {
      metodo: 'POST',
      token: comprador,
      corpo: { titulo: 'Pacote vazio', prazoResposta: prazo(), itens: [] },
    });

    assert.equal(r.status, 400);
  });

  it('recusa pacote sem a lista de itens', async () => {
    // Sem o campo, e não com o campo vazio: era `.default([])`, que
    // transformava a ausência em lista vazia em silêncio.
    const r = await chamar('/api/cotacoes', {
      metodo: 'POST',
      token: comprador,
      corpo: { titulo: 'Sem lista', prazoResposta: prazo() },
    });

    assert.equal(r.status, 400);
  });

  it('o mesmo item não entra em dois pacotes', async () => {
    const itens = await solicitacaoAprovada([{ id: materialCabo, qtd: 5 }]);

    await chamar('/api/cotacoes', {
      metodo: 'POST', token: comprador,
      corpo: { titulo: 'Primeiro', prazoResposta: prazo(), itens },
    });

    const segunda = await chamar('/api/cotacoes', {
      metodo: 'POST', token: comprador,
      corpo: { titulo: 'Segundo', prazoResposta: prazo(), itens },
    });

    assert.equal(segunda.status, 400);
    assert.ok(segunda.corpo.detalhes[0].includes('já está em outro pacote'));
  });

  it('recusa item de solicitação não aprovada', async () => {
    const rascunho = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: solicitante,
      corpo: { obraId, itens: [{ materialId: materialCimento, quantidade: 3 }] },
    });

    const r = await chamar('/api/cotacoes', {
      metodo: 'POST',
      token: comprador,
      corpo: {
        titulo: 'Não deveria',
        prazoResposta: prazo(),
        itens: [rascunho.corpo.solicitacao.itens[0].id],
      },
    });

    assert.equal(r.status, 400);
  });
});

describe('Fornecedores sugeridos pela família', () => {
  it('sugere só quem atende a família dos itens', async () => {
    const itens = await solicitacaoAprovada([{ id: materialCabo, qtd: 8 }]);

    const bid = await chamar('/api/cotacoes', {
      metodo: 'POST', token: comprador,
      corpo: { titulo: 'Só elétrica', prazoResposta: prazo(), itens },
    });

    const r = await chamar(
      '/api/cotacoes/' + bid.corpo.cotacao.id + '/fornecedores-sugeridos',
      { token: comprador },
    );

    assert.equal(r.status, 200);
    assert.equal(r.corpo.fornecedores.length, 1);
    assert.equal(r.corpo.fornecedores[0].id, fornecedorEle);
  });

  it('sugere os dois quando o pacote mistura famílias', async () => {
    const itens = await solicitacaoAprovada([
      { id: materialCabo, qtd: 3 },
      { id: materialCimento, qtd: 4 },
    ]);

    const bid = await chamar('/api/cotacoes', {
      metodo: 'POST', token: comprador,
      corpo: { titulo: 'Misto', prazoResposta: prazo(), itens },
    });

    const r = await chamar(
      '/api/cotacoes/' + bid.corpo.cotacao.id + '/fornecedores-sugeridos',
      { token: comprador },
    );

    assert.equal(r.corpo.fornecedores.length, 2);
  });
});

describe('Abrir o pacote', () => {
  async function pacotePronto() {
    const itens = await solicitacaoAprovada([{ id: materialCabo, qtd: 6 }]);

    const bid = await chamar('/api/cotacoes', {
      metodo: 'POST', token: comprador,
      corpo: { titulo: 'Para abrir', prazoResposta: prazo(), itens },
    });

    const id = bid.corpo.cotacao.id;

    await chamar('/api/cotacoes/' + id + '/fornecedores', {
      metodo: 'POST', token: comprador, corpo: { fornecedores: [fornecedorEle] },
    });

    return id;
  }

  it('bloqueia pacote sem fornecedor', async () => {
    const itens = await solicitacaoAprovada([{ id: materialCabo, qtd: 2 }]);

    const bid = await chamar('/api/cotacoes', {
      metodo: 'POST', token: comprador,
      corpo: { titulo: 'Sem convidados', prazoResposta: prazo(), itens },
    });

    const r = await chamar('/api/cotacoes/' + bid.corpo.cotacao.id + '/abrir', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 400);
    assert.ok(r.corpo.detalhes.some((d: string) => d.includes('fornecedor')));
  });

  it('abre e gera um link por fornecedor', async () => {
    const id = await pacotePronto();

    const r = await chamar('/api/cotacoes/' + id + '/abrir', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.cotacao.situacao, 'ABERTO');
    assert.equal(r.corpo.cotacao.convidados.length, 1);
    //  12 caracteres desde 10/10/2026 — eram 43. O link viaja
    //  pelo WhatsApp e a chave longa fazia uma parede de letras
    //  embaixo da mensagem. A conta de segurança está em
    //  `servicos/cotacao.ts`.
    assert.ok(r.corpo.cotacao.convidados[0].token.length >= 12);
  });

  it('marca a solicitação de origem como Em cotação', async () => {
    const id = await pacotePronto();
    await chamar('/api/cotacoes/' + id + '/abrir', { metodo: 'POST', token: comprador });

    const emCotacao = await chamar('/api/solicitacoes?situacao=EM_COTACAO', {
      token: comprador,
    });

    assert.ok(emCotacao.corpo.solicitacoes.length > 0);
  });

  it('não deixa trocar convidados depois de aberto', async () => {
    const id = await pacotePronto();
    await chamar('/api/cotacoes/' + id + '/abrir', { metodo: 'POST', token: comprador });

    const r = await chamar('/api/cotacoes/' + id + '/fornecedores', {
      metodo: 'POST', token: comprador, corpo: { fornecedores: [fornecedorCim] },
    });

    assert.equal(r.status, 409);
  });

  it('não abre duas vezes', async () => {
    const id = await pacotePronto();
    await chamar('/api/cotacoes/' + id + '/abrir', { metodo: 'POST', token: comprador });

    const segunda = await chamar('/api/cotacoes/' + id + '/abrir', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(segunda.status, 409);
  });
});

describe('Portal do fornecedor', () => {
  let token = '';
  let bidId = '';
  let itensDoPacote: Array<{ id: string }> = [];
  let donoDoLink = '';
  let concorrente = { nome: '', cnpj: '', token: '' };

  before(async () => {
    const itens = await solicitacaoAprovada([
      { id: materialCabo, qtd: 12 },
      { id: materialCimento, qtd: 20 },
    ]);

    const bid = await chamar('/api/cotacoes', {
      metodo: 'POST', token: comprador,
      corpo: { titulo: 'Pacote do portal', prazoResposta: prazo(), itens },
    });

    bidId = bid.corpo.cotacao.id;

    await chamar('/api/cotacoes/' + bidId + '/fornecedores', {
      metodo: 'POST', token: comprador,
      corpo: { fornecedores: [fornecedorEle, fornecedorCim] },
    });

    const aberto = await chamar('/api/cotacoes/' + bidId + '/abrir', {
      metodo: 'POST', token: comprador,
    });

    const meu = aberto.corpo.cotacao.convidados[0];
    const outro = aberto.corpo.cotacao.convidados[1];

    token = meu.token;
    donoDoLink = meu.fornecedor.razaoSocial;
    concorrente = { nome: outro.fornecedor.razaoSocial, cnpj: outro.fornecedor.cnpj, token: outro.token };
    itensDoPacote = aberto.corpo.cotacao.itens;
  });

  it('abre SEM login', async () => {
    const r = await chamar('/api/portal/' + token);

    assert.equal(r.status, 200);
    assert.equal(r.corpo.cotacao.itens.length, 2);
  });

  it('mostra apenas o fornecedor destinatário', async () => {
    const r = await chamar('/api/portal/' + token);

    assert.equal(r.corpo.cotacao.fornecedor.razaoSocial, donoDoLink);
  });

  it('NÃO vaza nada do concorrente', async () => {
    const r = await chamar('/api/portal/' + token);
    const texto = JSON.stringify(r.corpo);

    // Nada do OUTRO fornecedor pode aparecer nesta resposta.
    assert.ok(!texto.includes(concorrente.nome), 'vazou o nome do concorrente');
    assert.ok(!texto.includes(concorrente.cnpj), 'vazou o CNPJ do concorrente');
    assert.ok(!texto.includes(concorrente.token), 'vazou o link do concorrente');
    assert.ok(!texto.includes('convidados'), 'vazou a lista de convidados');
    assert.ok(!texto.includes('valorUnitario":'), 'não deve trazer preço de ninguém antes de responder');
  });

  it('o link de um fornecedor não serve para ver a resposta do outro', async () => {
    // O concorrente responde primeiro...
    await chamar('/api/portal/' + concorrente.token, {
      metodo: 'POST',
      corpo: {
        itens: itensDoPacote.map((i) => ({
          bidItemId: i.id, disponivel: true, valorUnitario: 777,
        })),
      },
    });

    // ...e o outro abre o próprio link.
    const r = await chamar('/api/portal/' + token);

    assert.ok(!JSON.stringify(r.corpo).includes('777'), 'vazou o preço do concorrente');
  });

  it('registra a primeira visualização', async () => {
    await chamar('/api/portal/' + token);

    const bid = await chamar('/api/cotacoes/' + bidId, { token: comprador });
    const convite = bid.corpo.cotacao.convidados.find(
      (c: { token: string }) => c.token === token,
    );

    assert.ok(convite.visualizadoEm, 'deveria registrar quando o fornecedor abriu');
  });

  it('recusa link inventado com 404', async () => {
    const r = await chamar('/api/portal/token-que-nao-existe');
    assert.equal(r.status, 404);
  });

  it('aceita a resposta e devolve o total', async () => {
    const r = await chamar('/api/portal/' + token, {
      metodo: 'POST',
      corpo: {
        itens: itensDoPacote.map((i) => ({
          bidItemId: i.id,
          disponivel: true,
          valorUnitario: 100,
          marca: 'Sil',
          prazoEntregaDias: 7,
        })),
        valorFrete: 150,
        percentualEntrada: 30,
        quantidadeParcelas: 3,
        intervaloParcelasDias: 30,
      },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.resumo.itensCotados, 2);
    // 12 × 100 + 20 × 100 + 150 de frete
    assert.equal(r.corpo.resumo.total, 12 * 100 + 20 * 100 + 150);
    assert.ok(r.corpo.resumo.pagamento.includes('30%'));
  });

  it('recusa 100% de entrada COM parcelas', async () => {
    // O sistema guardou "100% de entrada + 5x a cada 30 dias" de um
    // fornecedor de verdade. As duas coisas não existem juntas, e o
    // prazo médio de pagamento — que compara as propostas — lia
    // aquilo como "à vista", engolindo as cinco parcelas caladamente.
    const r = await chamar('/api/portal/' + token, {
      metodo: 'POST',
      corpo: {
        itens: itensDoPacote.map((i) => ({
          bidItemId: i.id, disponivel: true, valorUnitario: 100,
        })),
        percentualEntrada: 100,
        quantidadeParcelas: 5,
        intervaloParcelasDias: 30,
      },
    });

    assert.equal(r.status, 400);
    assert.match(JSON.stringify(r.corpo), /100% de entrada não há parcelas/);
  });

  it('aceita 100% de entrada sozinho: é pagamento à vista', async () => {
    const r = await chamar('/api/portal/' + token, {
      metodo: 'POST',
      corpo: {
        itens: itensDoPacote.map((i) => ({
          bidItemId: i.id, disponivel: true, valorUnitario: 100,
        })),
        percentualEntrada: 100,
      },
    });

    assert.equal(r.status, 200);
  });

  it('aceita "não tenho este item"', async () => {
    const r = await chamar('/api/portal/' + token, {
      metodo: 'POST',
      corpo: {
        itens: [
          { bidItemId: itensDoPacote[0].id, disponivel: true, valorUnitario: 200 },
          { bidItemId: itensDoPacote[1].id, disponivel: false },
        ],
      },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.resumo.itensIndisponiveis, 1);
    assert.equal(r.corpo.resumo.itensCotados, 1);
  });

  it('recusa item disponível sem preço', async () => {
    const r = await chamar('/api/portal/' + token, {
      metodo: 'POST',
      corpo: { itens: [{ bidItemId: itensDoPacote[0].id, disponivel: true }] },
    });

    assert.equal(r.status, 400);
    assert.ok(r.corpo.erro.includes('preço'));
  });

  it('recusa item de outra cotação', async () => {
    const r = await chamar('/api/portal/' + token, {
      metodo: 'POST',
      corpo: {
        itens: [
          {
            bidItemId: '00000000-0000-4000-8000-000000000000',
            disponivel: true,
            valorUnitario: 1,
          },
        ],
      },
    });

    assert.equal(r.status, 400);
    assert.ok(r.corpo.erro.includes('não pertence'));
  });

  it('permite revisar enquanto o prazo corre', async () => {
    await chamar('/api/portal/' + token, {
      metodo: 'POST',
      corpo: {
        itens: itensDoPacote.map((i) => ({
          bidItemId: i.id, disponivel: true, valorUnitario: 50,
        })),
      },
    });

    const revisao = await chamar('/api/portal/' + token, {
      metodo: 'POST',
      corpo: {
        itens: itensDoPacote.map((i) => ({
          bidItemId: i.id, disponivel: true, valorUnitario: 45,
        })),
      },
    });

    assert.equal(revisao.status, 200);
    // Vale a última: 12 × 45 + 20 × 45
    assert.equal(revisao.corpo.resumo.subtotal, 32 * 45);
  });

  it('o comprador enxerga o total de cada fornecedor', async () => {
    const bid = await chamar('/api/cotacoes/' + bidId, { token: comprador });
    const respondeu = bid.corpo.cotacao.convidados.filter(
      (c: { respondeu: boolean }) => c.respondeu,
    );

    assert.ok(respondeu.length > 0);
    assert.ok(respondeu[0].totais.total > 0);
  });

  it('o link para de funcionar quando o pacote é encerrado', async () => {
    await chamar('/api/cotacoes/' + bidId + '/encerrar', {
      metodo: 'POST', token: comprador,
    });

    const r = await chamar('/api/portal/' + token);

    assert.equal(r.status, 409);
    assert.ok(r.corpo.erro.includes('não está mais aberta'));
  });
});

describe('Link com prazo vencido', () => {
  it('recusa com 410 quando o prazo passou', async () => {
    const itens = await solicitacaoAprovada([{ id: materialCabo, qtd: 4 }]);

    // Prazo de 1 dia, que vamos empurrar para o passado.
    const bid = await chamar('/api/cotacoes', {
      metodo: 'POST', token: comprador,
      corpo: { titulo: 'Vai vencer', prazoResposta: prazo(1), itens },
    });

    const id = bid.corpo.cotacao.id;

    await chamar('/api/cotacoes/' + id + '/fornecedores', {
      metodo: 'POST', token: comprador, corpo: { fornecedores: [fornecedorEle] },
    });

    const aberto = await chamar('/api/cotacoes/' + id + '/abrir', {
      metodo: 'POST', token: comprador,
    });

    const { banco } = await import('../src/plugins/banco.js');

    await banco.bidFornecedor.updateMany({
      where: { bidId: id },
      data: { expiraEm: new Date(Date.now() - 86400000) },
    });

    const r = await chamar('/api/portal/' + aberto.corpo.cotacao.convidados[0].token);

    assert.equal(r.status, 410);
    assert.ok(r.corpo.erro.includes('prazo'));
  });
});
