// ============================================================
//  Testes da Etapa 4 - Aprovação
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar } from './ajuda.js';

let admin = '';
let solicitante = '';
let gestor = '';
let engenheiro = '';
let fundador = '';
let obraId = '';
let materialId = '';

/** Abre uma solicitação e envia, devolvendo o id. */
async function abrirEEnviar(valor: number, token = solicitante): Promise<string> {
  const criada = await chamar('/api/solicitacoes', {
    metodo: 'POST',
    token,
    corpo: {
      obraId,
      justificativa: 'Teste de alçada',
      itens: [
        {
          materialId,
          quantidade: 1,
          valorEstimado: valor,
          especificacaoTecnica: 'Especificação para liberar o envio.',
        },
      ],
    },
  });

  const id = criada.corpo.solicitacao.id;
  await chamar('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST', token });
  return id;
}

before(async () => {
  await limparDados();

  await criarUsuarioTeste('admin4@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('solicitante4@teste.com.br', ['SOLICITANTE']);
  await criarUsuarioTeste('gestor4@teste.com.br', ['GESTOR_OBRA']);
  await criarUsuarioTeste('engenheiro4@teste.com.br', ['ENGENHEIRO']);
  await criarUsuarioTeste('fundador4@teste.com.br', ['FUNDADOR']);
  // Alguém que acumula as DUAS funções exigidas na faixa média.
  await criarUsuarioTeste('acumula4@teste.com.br', ['GESTOR_OBRA', 'ENGENHEIRO']);
  await criarUsuarioTeste('almoxarife4@teste.com.br', ['ALMOXARIFE']);

  admin = await entrarComo('admin4@teste.com.br');
  solicitante = await entrarComo('solicitante4@teste.com.br');
  gestor = await entrarComo('gestor4@teste.com.br');
  engenheiro = await entrarComo('engenheiro4@teste.com.br');
  fundador = await entrarComo('fundador4@teste.com.br');

  const familia = await chamar('/api/familias', {
    metodo: 'POST',
    token: admin,
    corpo: { codigo: 'APR', nome: 'Família de aprovação' },
  });

  const material = await chamar('/api/materiais', {
    metodo: 'POST',
    token: admin,
    corpo: {
      familiaId: familia.corpo.familia.id,
      codigoInterno: 'APR001',
      descricao: 'Item para testes de aprovação',
      unidadeMedida: 'UN',
    },
  });
  materialId = material.corpo.material.id;

  const obra = await chamar('/api/obras', {
    metodo: 'POST',
    token: admin,
    corpo: { codigo: 'OB-APR', nome: 'Obra de aprovação' },
  });
  obraId = obra.corpo.obra.id;
});

after(encerrar);

describe('Fila de aprovação', () => {
  it('mostra ao gestor o que depende dele', async () => {
    await abrirEEnviar(800);

    const r = await chamar('/api/aprovacoes', { token: gestor });

    assert.equal(r.status, 200);
    assert.ok(r.corpo.fila.length > 0);
    assert.equal(r.corpo.fila[0].esperaMinhaAssinatura, true);
  });

  it('não mostra ao fundador o que é da faixa do gestor', async () => {
    const r = await chamar('/api/aprovacoes', { token: fundador });
    const daFaixaBaixa = r.corpo.fila.filter((s: { totalEstimado: number }) => s.totalEstimado < 2000);

    assert.equal(daFaixaBaixa.length, 0);
  });

  it('quem não aprova nem acessa a fila', async () => {
    const almoxarife = await entrarComo('almoxarife4@teste.com.br');
    const r = await chamar('/api/aprovacoes', { token: almoxarife });

    assert.equal(r.status, 403);
  });

  it('traz os dados necessários para decidir sem abrir a solicitação', async () => {
    const r = await chamar('/api/aprovacoes', { token: gestor });
    const item = r.corpo.fila[0];

    for (const campo of ['numeroFormatado', 'obra', 'solicitante', 'totalEstimado', 'estado']) {
      assert.ok(item[campo] !== undefined, 'faltou o campo ' + campo);
    }
  });
});

describe('Aprovação simples (basta uma assinatura)', () => {
  it('o gestor aprova e a solicitação fica APROVADA', async () => {
    const id = await abrirEEnviar(800);

    const r = await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'APROVADA' },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.situacao, 'APROVADA');
    assert.ok(r.corpo.mensagem.includes('liberada para cotação'));
  });

  it('a decisão some da fila depois de tomada', async () => {
    const id = await abrirEEnviar(900);
    await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'APROVADA' },
    });

    const fila = await chamar('/api/aprovacoes', { token: gestor });
    const aindaLa = fila.corpo.fila.find((s: { id: string }) => s.id === id);

    assert.equal(aindaLa, undefined);
  });

  it('não deixa decidir duas vezes', async () => {
    const id = await abrirEEnviar(700);
    await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'APROVADA' },
    });

    const segunda = await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'APROVADA' },
    });

    assert.equal(segunda.status, 403);
  });
});

describe('Aprovação com DUAS assinaturas', () => {
  it('a primeira assinatura não conclui', async () => {
    const id = await abrirEEnviar(7500);

    const r = await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'APROVADA' },
    });

    assert.equal(r.corpo.situacao, 'AGUARDANDO_APROVACAO');
    assert.ok(r.corpo.mensagem.includes('1 de 2'));
    assert.deepEqual(r.corpo.estado.faltam, ['ENGENHEIRO']);
  });

  it('a segunda assinatura conclui', async () => {
    const id = await abrirEEnviar(7500);

    await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'APROVADA' },
    });

    const r = await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: engenheiro,
      corpo: { decisao: 'APROVADA' },
    });

    assert.equal(r.corpo.situacao, 'APROVADA');
    assert.equal(r.corpo.estado.completa, true);
  });

  it('depois da primeira assinatura, ela continua na fila do segundo', async () => {
    const id = await abrirEEnviar(8000);
    await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'APROVADA' },
    });

    const doEngenheiro = await chamar('/api/aprovacoes', { token: engenheiro });
    assert.ok(doEngenheiro.corpo.fila.some((s: { id: string }) => s.id === id));

    const doGestor = await chamar('/api/aprovacoes', { token: gestor });
    assert.ok(!doGestor.corpo.fila.some((s: { id: string }) => s.id === id));
  });

  it('uma reprovação encerra mesmo já tendo uma aprovação', async () => {
    const id = await abrirEEnviar(9000);

    await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'APROVADA' },
    });

    const r = await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: engenheiro,
      corpo: { decisao: 'REPROVADA', observacao: 'Fora do orçamento previsto.' },
    });

    assert.equal(r.corpo.situacao, 'REPROVADA');
  });

  it('quem acumula as duas funções assina duas vezes', async () => {
    const id = await abrirEEnviar(10000);
    const acumula = await entrarComo('acumula4@teste.com.br');

    const primeira = await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: acumula,
      corpo: { decisao: 'APROVADA', funcaoCodigo: 'GESTOR_OBRA' },
    });

    assert.equal(primeira.corpo.situacao, 'AGUARDANDO_APROVACAO');

    const segunda = await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: acumula,
      corpo: { decisao: 'APROVADA', funcaoCodigo: 'ENGENHEIRO' },
    });

    assert.equal(segunda.corpo.situacao, 'APROVADA');
  });
});

describe('Trava: ninguém aprova o próprio pedido', () => {
  it('o autor é bloqueado mesmo tendo a função exigida', async () => {
    // O gestor abre a própria solicitação.
    const id = await abrirEEnviar(800, gestor);

    const r = await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'APROVADA' },
    });

    assert.equal(r.status, 403);
    assert.ok(r.corpo.erro.includes('você mesmo abriu'));
  });

  it('e ela não aparece na fila dele', async () => {
    const id = await abrirEEnviar(850, gestor);
    const fila = await chamar('/api/aprovacoes', { token: gestor });

    assert.ok(!fila.corpo.fila.some((s: { id: string }) => s.id === id));
  });

  it('mas outro gestor poderia aprovar', async () => {
    const id = await abrirEEnviar(860, gestor);
    const acumula = await entrarComo('acumula4@teste.com.br');

    const r = await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: acumula,
      corpo: { decisao: 'APROVADA', funcaoCodigo: 'GESTOR_OBRA' },
    });

    assert.equal(r.status, 200);
  });
});

describe('Devolução para revisão', () => {
  it('exige explicar o motivo', async () => {
    const id = await abrirEEnviar(800);

    const r = await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'DEVOLVIDA' },
    });

    assert.equal(r.status, 400);
    assert.ok(r.corpo.erro.includes('precisa ser corrigido'));
  });

  it('com motivo, devolve e libera a edição', async () => {
    const id = await abrirEEnviar(800);

    const r = await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'DEVOLVIDA', observacao: 'Informe a marca do material.' },
    });

    assert.equal(r.corpo.situacao, 'EM_REVISAO');

    const depois = await chamar('/api/solicitacoes/' + id, { token: solicitante });
    assert.equal(depois.corpo.solicitacao.podeEditar, true);
  });

  it('o solicitante corrige e reenvia', async () => {
    const id = await abrirEEnviar(800);

    await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'DEVOLVIDA', observacao: 'Faltou justificativa.' },
    });

    const reenvio = await chamar('/api/solicitacoes/' + id + '/enviar', {
      metodo: 'POST',
      token: solicitante,
    });

    assert.equal(reenvio.status, 200);
    assert.equal(reenvio.corpo.solicitacao.situacao, 'AGUARDANDO_APROVACAO');
  });

  it('o reenvio zera as assinaturas antigas', async () => {
    const id = await abrirEEnviar(7500);

    // Gestor aprova...
    await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'APROVADA' },
    });

    // ...mas o engenheiro devolve.
    await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: engenheiro,
      corpo: { decisao: 'DEVOLVIDA', observacao: 'Quantidade parece errada.' },
    });

    await chamar('/api/solicitacoes/' + id + '/enviar', { metodo: 'POST', token: solicitante });

    const depois = await chamar('/api/solicitacoes/' + id, { token: solicitante });

    // A aprovação anterior do gestor não vale mais: ela foi dada
    // sobre um conteúdo que pode ter mudado.
    assert.equal(depois.corpo.solicitacao.aprovacoes.length, 0);
    assert.equal(depois.corpo.solicitacao.estadoAprovacao.assinaram.length, 0);
  });
});

describe('Histórico da decisão', () => {
  it('registra quem decidiu, com qual função e a observação', async () => {
    const id = await abrirEEnviar(800);

    await chamar('/api/aprovacoes/' + id + '/decidir', {
      metodo: 'POST',
      token: gestor,
      corpo: { decisao: 'APROVADA', observacao: 'Compra urgente, liberada.' },
    });

    const r = await chamar('/api/solicitacoes/' + id, { token: solicitante });

    const assinatura = r.corpo.solicitacao.aprovacoes[0];
    assert.equal(assinatura.decisao, 'APROVADA');
    assert.equal(assinatura.funcao, 'Gestor de obra');
    assert.equal(assinatura.observacao, 'Compra urgente, liberada.');

    const evento = r.corpo.solicitacao.eventos.find(
      (e: { tipo: string }) => e.tipo === 'APROVADA',
    );
    assert.ok(evento, 'deveria haver um evento de aprovação no histórico');
    assert.ok(evento.descricao.includes('Gestor de obra'));
  });
});

describe('Envio sem faixa de alçada', () => {
  it('bloqueia quando nenhuma faixa cobre o valor', async () => {
    // Desativa todas as faixas para simular configuração incompleta.
    const faixas = await chamar('/api/alcadas', { token: admin });

    for (const f of faixas.corpo.regras) {
      await chamar('/api/alcadas/' + f.id, {
        metodo: 'PATCH',
        token: admin,
        corpo: { ativa: false },
      });
    }

    const criada = await chamar('/api/solicitacoes', {
      metodo: 'POST',
      token: solicitante,
      corpo: {
        obraId,
        itens: [
          {
            materialId,
            quantidade: 1,
            valorEstimado: 500,
            especificacaoTecnica: 'Qualquer coisa.',
          },
        ],
      },
    });

    const r = await chamar('/api/solicitacoes/' + criada.corpo.solicitacao.id + '/enviar', {
      metodo: 'POST',
      token: solicitante,
    });

    assert.equal(r.status, 400);
    assert.ok(r.corpo.erro.includes('Nenhuma faixa'));

    // Devolve as faixas ao estado original.
    for (const f of faixas.corpo.regras) {
      await chamar('/api/alcadas/' + f.id, {
        metodo: 'PATCH',
        token: admin,
        corpo: { ativa: true },
      });
    }
  });
});
