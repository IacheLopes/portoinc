// ============================================================
//  Testes da Etapa 10 - WhatsApp
//
//  O que mais importa aqui é a TRAVA: enquanto o modo de teste
//  estiver ligado, nenhuma mensagem pode sair para um número que
//  não esteja na lista de autorizados.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

function prazo(dias = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

let admin = '';
let comprador = '';
let solicitante = '';
let almoxarife = '';

const NUMERO = '5511987654321';

/** Tira todos os números da lista, para cada bloco começar limpo. */
async function limparLista() {
  const lista = await chamar('/api/whatsapp/autorizados', { token: admin });

  for (const a of lista.corpo.autorizados ?? []) {
    await chamar('/api/whatsapp/autorizados/' + a.id, { metodo: 'DELETE', token: admin });
  }
}

before(async () => {
  await limparDados();

  await criarUsuarioTeste('admin10@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('comprador10@teste.com.br', ['COMPRADOR']);
  await criarUsuarioTeste('solicitante10@teste.com.br', ['SOLICITANTE']);
  await criarUsuarioTeste('almox10@teste.com.br', ['ALMOXARIFE']);

  admin = await entrarComo('admin10@teste.com.br');
  comprador = await entrarComo('comprador10@teste.com.br');
  solicitante = await entrarComo('solicitante10@teste.com.br');
  almoxarife = await entrarComo('almox10@teste.com.br');

  await chamar('/api/whatsapp/conectar', { metodo: 'POST', token: admin });
});

after(encerrar);

describe('Situação da conexão', () => {
  it('mostra o adaptador e o modo de teste', async () => {
    const r = await chamar('/api/whatsapp/situacao', { token: admin });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.adaptador, 'mock');
    assert.equal(r.corpo.simulado, true);
    assert.equal(r.corpo.modoTeste, true, 'o modo de teste precisa vir LIGADO por padrão');
    assert.ok(typeof r.corpo.detalhe === 'string');
  });

  it('o simulado não tem QR Code', async () => {
    const r = await chamar('/api/whatsapp/qr', { token: admin });

    assert.equal(r.status, 404);
  });

  it('conectar e desconectar respondem', async () => {
    const conectou = await chamar('/api/whatsapp/conectar', { metodo: 'POST', token: admin });
    assert.equal(conectou.status, 200);
    assert.equal(conectou.corpo.estado, 'conectado');

    const desligou = await chamar('/api/whatsapp/desconectar', { metodo: 'POST', token: admin });
    assert.equal(desligou.status, 200);
    assert.equal(desligou.corpo.estado, 'desconectado');

    await chamar('/api/whatsapp/conectar', { metodo: 'POST', token: admin });
  });
});

describe('A trava da lista de autorizados', () => {
  it('BLOQUEIA número fora da lista', async () => {
    await limparLista();

    const r = await chamar('/api/whatsapp/testar', {
      metodo: 'POST', token: admin,
      corpo: { para: NUMERO, texto: 'mensagem que não deve sair' },
    });

    assert.equal(r.status, 403);
    assert.equal(r.corpo.bloqueado, true);
    assert.equal(r.corpo.sucesso, false);
    assert.match(r.corpo.mensagem, /não está na lista de autorizados/);
  });

  it('o bloqueio fica registrado no histórico', async () => {
    const r = await chamar('/api/whatsapp/historico', { token: admin });
    const bloqueada = r.corpo.mensagens.find(
      (m: { situacao: string }) => m.situacao === 'BLOQUEADA',
    );

    assert.ok(bloqueada, 'a tentativa bloqueada precisa aparecer no histórico');
    assert.equal(bloqueada.contexto, 'teste');
  });

  it('DEIXA passar depois de liberar', async () => {
    await limparLista();

    const liberou = await chamar('/api/whatsapp/autorizados', {
      metodo: 'POST', token: admin,
      corpo: { numero: NUMERO, nome: 'Celular de teste' },
    });
    assert.equal(liberou.status, 201);

    const r = await chamar('/api/whatsapp/testar', {
      metodo: 'POST', token: admin,
      corpo: { para: NUMERO, texto: 'agora pode' },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.sucesso, true);
    assert.equal(r.corpo.bloqueado, false);
  });

  it('BLOQUEIA de novo depois de tirar da lista', async () => {
    const lista = await chamar('/api/whatsapp/autorizados', { token: admin });
    const meu = lista.corpo.autorizados.find(
      (a: { numero: string }) => a.numero === NUMERO,
    );

    await chamar('/api/whatsapp/autorizados/' + meu.id, { metodo: 'DELETE', token: admin });

    const r = await chamar('/api/whatsapp/testar', {
      metodo: 'POST', token: admin,
      corpo: { para: NUMERO, texto: 'não pode mais' },
    });

    assert.equal(r.status, 403);
    assert.equal(r.corpo.bloqueado, true);
  });

  it('a lista aceita número formatado e guarda só os dígitos', async () => {
    await limparLista();

    const r = await chamar('/api/whatsapp/autorizados', {
      metodo: 'POST', token: admin,
      corpo: { numero: '+55 (11) 98765-4321', nome: 'Com formatação' },
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.autorizado.numero, NUMERO);
  });

  it('o mesmo número não entra duas vezes', async () => {
    const r = await chamar('/api/whatsapp/autorizados', {
      metodo: 'POST', token: admin,
      corpo: { numero: NUMERO, nome: 'Repetido' },
    });

    assert.equal(r.status, 409);
  });

  it('o número aparece MASCARADO na lista', async () => {
    const r = await chamar('/api/whatsapp/autorizados', { token: admin });
    const primeiro = r.corpo.autorizados[0];

    assert.match(primeiro.numeroMascarado, /•/);
    assert.notEqual(primeiro.numeroMascarado, primeiro.numero);
  });

  it('recusa número que não parece telefone', async () => {
    const r = await chamar('/api/whatsapp/autorizados', {
      metodo: 'POST', token: admin,
      corpo: { numero: '123456789012345678', nome: 'Inválido' },
    });

    assert.equal(r.status, 400);
  });
});

describe('Histórico', () => {
  it('guarda o que foi enviado, com quem enviou', async () => {
    await limparLista();
    await chamar('/api/whatsapp/autorizados', {
      metodo: 'POST', token: admin,
      corpo: { numero: NUMERO, nome: 'Celular de teste' },
    });

    await chamar('/api/whatsapp/testar', {
      metodo: 'POST', token: admin,
      corpo: { para: NUMERO, texto: 'mensagem para o histórico' },
    });

    const r = await chamar('/api/whatsapp/historico', { token: admin });
    const enviada = r.corpo.mensagens.find(
      (m: { situacao: string; texto: string }) =>
        m.situacao === 'ENVIADA' && m.texto.includes('histórico'),
    );

    assert.ok(enviada);
    assert.equal(enviada.adaptador, 'mock');
    assert.ok(enviada.enviadoPor);
    assert.match(enviada.numeroMascarado, /•/, 'o histórico nunca mostra o número inteiro');
  });
});

describe('Quem pode mexer', () => {
  it('só quem administra integrações vê a tela', async () => {
    for (const token of [comprador, solicitante, almoxarife]) {
      const r = await chamar('/api/whatsapp/situacao', { token });
      assert.equal(r.status, 403);
    }
  });

  it('comprador não libera número', async () => {
    const r = await chamar('/api/whatsapp/autorizados', {
      metodo: 'POST', token: comprador,
      corpo: { numero: '5511999999999', nome: 'Tentativa' },
    });

    assert.equal(r.status, 403);
  });

  it('comprador não vê o histórico', async () => {
    const r = await chamar('/api/whatsapp/historico', { token: comprador });

    assert.equal(r.status, 403);
  });
});

describe('Envio ligado ao fluxo de compras', () => {
  it('o almoxarife não manda pedido por WhatsApp', async () => {
    const r = await chamar('/api/pedidos/00000000-0000-4000-8000-000000000000/enviar-whatsapp', {
      metodo: 'POST', token: almoxarife,
    });

    assert.equal(r.status, 403);
  });

  it('pedido inexistente devolve 404, não erro técnico', async () => {
    const r = await chamar('/api/pedidos/00000000-0000-4000-8000-000000000000/enviar-whatsapp', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 404);
  });

  it('cotação inexistente devolve 404', async () => {
    const r = await chamar('/api/cotacoes/00000000-0000-4000-8000-000000000000/enviar-convites', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(r.status, 404);
  });
});

// ============================================================
//  Nenhuma mensagem sai por fora da porta única
// ============================================================

describe('A trava vale em TODOS os caminhos de envio', () => {
  /**
   * Monta uma cotação com fornecedor que tem WhatsApp e a abre.
   *
   * Abrir a cotação dispara o convite. Esse botão chamava o
   * adaptador direto e PULAVA a lista de autorizados: com o
   * WhatsApp ligado de verdade, a mensagem sairia para o número
   * cadastrado do fornecedor mesmo com o modo de teste ligado.
   */
  it('abrir a cotação NÃO envia para número fora da lista', async () => {
    const familia = await chamar('/api/familias', {
      metodo: 'POST', token: admin, corpo: { codigo: 'WPP', nome: 'Família do WhatsApp' },
    });
    const familiaId = familia.corpo.familia.id;

    const material = await chamar('/api/materiais', {
      metodo: 'POST', token: admin,
      corpo: {
        familiaId, codigoInterno: 'WPP-1',
        descricao: 'Material do teste de envio', unidadeMedida: 'UN',
      },
    });

    const fornecedor = await chamar('/api/fornecedores', {
      metodo: 'POST', token: admin,
      corpo: {
        razaoSocial: 'Fornecedor Com WhatsApp Ltda', cnpj: '05570714000159',
        // DDD 00 não existe: este número não chega em ninguém,
        // nem se toda a trava falhar.
        whatsapp: '550090000099',
        familias: [familiaId],
      },
    });

    const obra = await chamar('/api/obras', {
      metodo: 'POST', token: admin, corpo: { codigo: 'OB-WPP', nome: 'Obra do WhatsApp' },
    });

    const criada = await chamar('/api/solicitacoes', {
      metodo: 'POST', token: solicitante,
      corpo: {
        obraId: obra.corpo.obra.id,
        itens: [{
          materialId: material.corpo.material.id, quantidade: 5, valorEstimado: 10,
          especificacaoTecnica: 'Padrão.',
        }],
      },
    });
    const solicitacaoId = criada.corpo.solicitacao.id;

    await chamar('/api/solicitacoes/' + solicitacaoId + '/enviar', {
      metodo: 'POST', token: solicitante,
    });

    // Quem assina nesta faixa é o Gestor de obra — o admin deste
    // arquivo não tem esse papel, e a aprovação passaria batida.
    await criarUsuarioTeste('gestor10@teste.com.br', ['GESTOR_OBRA']);
    const gestor = await entrarComo('gestor10@teste.com.br');

    const decisao = await chamar('/api/aprovacoes/' + solicitacaoId + '/decidir', {
      metodo: 'POST', token: gestor, corpo: { decisao: 'APROVADA' },
    });
    assert.equal(decisao.status, 200, 'a solicitação precisa estar aprovada para virar cotação');

    const detalhe = await chamar('/api/solicitacoes/' + solicitacaoId, { token: solicitante });
    const itens = detalhe.corpo.solicitacao.itens.map((i: { id: string }) => i.id);

    const bid = await chamar('/api/cotacoes', {
      metodo: 'POST', token: comprador,
      corpo: { titulo: 'Pacote do teste de envio', prazoResposta: prazo(), itens },
    });
    const bidId = bid.corpo.cotacao.id;

    await chamar('/api/cotacoes/' + bidId + '/fornecedores', {
      metodo: 'POST', token: comprador,
      corpo: { fornecedores: [fornecedor.corpo.fornecedor.id] },
    });

    const aberta = await chamar('/api/cotacoes/' + bidId + '/abrir', {
      metodo: 'POST', token: comprador,
    });

    assert.equal(aberta.status, 200);
    assert.equal(aberta.corpo.avisos.length, 1);
    assert.equal(aberta.corpo.avisos[0].enviado, false, 'não pode ter saído');
    assert.equal(aberta.corpo.avisos[0].bloqueado, true, 'tem de ser BLOQUEADO pela trava');

    // E o bloqueio tem de estar no histórico: quem auditar precisa
    // ver que houve tentativa.
    const historico = await chamar('/api/whatsapp/historico', { token: admin });
    const registro = historico.corpo.mensagens.find(
      (m: { referencia: string | null }) => m.referencia === bid.corpo.cotacao.numeroFormatado,
    );

    assert.ok(registro, 'a tentativa precisa aparecer no histórico');
    assert.equal(registro.situacao, 'BLOQUEADA');
  });

  it('a rota antiga de teste também passa pela trava', async () => {
    // Ela nasceu quando só existia o simulador e chamava o
    // adaptador direto.
    const r = await chamar('/api/integracoes/whatsapp/testar', {
      metodo: 'POST', token: admin,
      corpo: { para: '550090000098', texto: 'nao deve sair' },
    });

    assert.equal(r.corpo.bloqueado, true);
    assert.equal(r.corpo.sucesso, false);
  });
});
