// ============================================================
//  Testes das regras da cotação
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  podeIrPara, podeEditarBid, formatarNumeroBid, gerarToken,
  conferirAbertura, conferirLink, calcularTotais, descreverPagamento,
  STATUS_RECUSA,
} from './cotacao.js';

describe('Caminhos do pacote', () => {
  it('rascunho pode abrir ou cancelar', () => {
    assert.equal(podeIrPara('RASCUNHO', 'ABERTO'), true);
    assert.equal(podeIrPara('RASCUNHO', 'CANCELADO'), true);
  });

  it('rascunho NÃO pula direto para encerrado', () => {
    assert.equal(podeIrPara('RASCUNHO', 'ENCERRADO'), false);
  });

  it('encerrado pode reabrir numa última chamada', () => {
    assert.equal(podeIrPara('ENCERRADO', 'ABERTO'), true);
  });

  it('encerrado pode virar pedido de compra', () => {
    assert.equal(podeIrPara('ENCERRADO', 'CONCLUIDO'), true);
  });

  it('encerrado NÃO volta para rascunho', () => {
    assert.equal(podeIrPara('ENCERRADO', 'RASCUNHO'), false);
  });

  it('concluído é ponto final: os pedidos já existem', () => {
    for (const destino of ['RASCUNHO', 'ABERTO', 'ENCERRADO', 'CANCELADO'] as const) {
      assert.equal(podeIrPara('CONCLUIDO', destino), false);
    }
  });

  it('só rascunho aceita mudança', () => {
    assert.equal(podeEditarBid('RASCUNHO'), true);
    assert.equal(podeEditarBid('ABERTO'), false);
    assert.equal(podeEditarBid('ENCERRADO'), false);
  });
});

describe('Número do pacote', () => {
  it('preenche com zeros', () => {
    assert.equal(formatarNumeroBid(1), 'BID-00001');
    assert.equal(formatarNumeroBid(123), 'BID-00123');
  });
});

describe('Chave do link público', () => {
  it('é longa o bastante para não ser adivinhada', () => {
    const token = gerarToken();

    // 32 bytes em base64url dão 43 caracteres.
    assert.ok(token.length >= 43, 'token curto demais: ' + token.length);
  });

  it('não repete', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => gerarToken()));
    assert.equal(tokens.size, 500);
  });

  it('usa só caracteres seguros para URL', () => {
    for (let i = 0; i < 50; i++) {
      assert.match(gerarToken(), /^[A-Za-z0-9_-]+$/);
    }
  });
});

describe('Conferência antes de abrir', () => {
  const amanha = new Date(Date.now() + 86400000);
  const ontem = new Date(Date.now() - 86400000);

  it('libera quando está tudo certo', () => {
    const p = conferirAbertura({
      quantidadeItens: 3,
      quantidadeConvidados: 2,
      prazoResposta: amanha,
    });

    assert.deepEqual(p, []);
  });

  it('bloqueia pacote sem itens', () => {
    const p = conferirAbertura({
      quantidadeItens: 0,
      quantidadeConvidados: 2,
      prazoResposta: amanha,
    });

    assert.ok(p.some((x) => x.includes('item aprovado')));
  });

  it('bloqueia pacote sem fornecedor', () => {
    const p = conferirAbertura({
      quantidadeItens: 3,
      quantidadeConvidados: 0,
      prazoResposta: amanha,
    });

    assert.ok(p.some((x) => x.includes('fornecedor')));
  });

  it('bloqueia prazo no passado', () => {
    const p = conferirAbertura({
      quantidadeItens: 3,
      quantidadeConvidados: 2,
      prazoResposta: ontem,
    });

    assert.ok(p.some((x) => x.includes('futuro')));
  });
});

describe('Validade do link do fornecedor', () => {
  const agora = new Date('2026-10-01T12:00:00Z');
  const futuro = new Date('2026-10-08T12:00:00Z');
  const passado = new Date('2026-09-25T12:00:00Z');

  it('aceita link válido de pacote aberto', () => {
    const r = conferirLink({
      existe: true,
      situacaoBid: 'ABERTO',
      expiraEm: futuro,
      respondidoEm: null,
      agora,
    });

    assert.equal(r.ok, true);
  });

  it('recusa link que não existe', () => {
    const r = conferirLink({ existe: false, agora });

    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.motivo, 'nao-encontrado');
  });

  it('recusa link vencido', () => {
    const r = conferirLink({
      existe: true,
      situacaoBid: 'ABERTO',
      expiraEm: passado,
      agora,
    });

    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.motivo, 'vencido');
  });

  it('recusa quando o pacote ainda é rascunho', () => {
    const r = conferirLink({
      existe: true,
      situacaoBid: 'RASCUNHO',
      expiraEm: futuro,
      agora,
    });

    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.motivo, 'pacote-fechado');
  });

  it('recusa quando o pacote foi encerrado', () => {
    const r = conferirLink({
      existe: true,
      situacaoBid: 'ENCERRADO',
      expiraEm: futuro,
      agora,
    });

    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.motivo, 'pacote-fechado');
  });

  it('permite rever a resposta enquanto o prazo corre', () => {
    const r = conferirLink({
      existe: true,
      situacaoBid: 'ABERTO',
      expiraEm: futuro,
      respondidoEm: new Date('2026-10-02T10:00:00Z'),
      permiteRevisao: true,
      agora,
    });

    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.jaRespondeu, true);
  });

  it('bloqueia a revisão quando ela não é permitida', () => {
    const r = conferirLink({
      existe: true,
      situacaoBid: 'ABERTO',
      expiraEm: futuro,
      respondidoEm: new Date('2026-10-02T10:00:00Z'),
      permiteRevisao: false,
      agora,
    });

    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.motivo, 'ja-respondido');
  });

  it('cada recusa tem o código HTTP certo', () => {
    assert.equal(STATUS_RECUSA['nao-encontrado'], 404);
    assert.equal(STATUS_RECUSA.vencido, 410);
    assert.equal(STATUS_RECUSA['pacote-fechado'], 409);
  });
});

describe('Totais da cotação', () => {
  const itens = [
    { disponivel: true, valorUnitario: 390, quantidade: 12 },
    { disponivel: true, valorUnitario: 98, quantidade: 15 },
    { disponivel: true, valorUnitario: 32, quantidade: 30 },
  ];

  it('soma quantidade × preço', () => {
    const t = calcularTotais(itens);

    assert.equal(t.subtotal, 12 * 390 + 15 * 98 + 30 * 32);
    assert.equal(t.itensCotados, 3);
  });

  it('acrescenta frete e outros custos', () => {
    const t = calcularTotais(itens, 200, 50);

    assert.equal(t.total, t.subtotal + 250);
    assert.equal(t.frete, 200);
  });

  it('item sem estoque não entra no total', () => {
    const t = calcularTotais([
      ...itens,
      { disponivel: false, valorUnitario: null, quantidade: 99 },
    ]);

    assert.equal(t.subtotal, 12 * 390 + 15 * 98 + 30 * 32);
    assert.equal(t.itensIndisponiveis, 1);
    assert.equal(t.itensCotados, 3);
  });

  it('reconhece cotação completa', () => {
    const t = calcularTotais(itens, 0, 0, 3);
    assert.equal(t.completa, true);
  });

  it('reconhece cotação incompleta', () => {
    const t = calcularTotais(itens.slice(0, 2), 0, 0, 3);
    assert.equal(t.completa, false);
  });
});

describe('Descrição do pagamento', () => {
  it('descreve entrada e parcelas', () => {
    assert.equal(
      descreverPagamento(30, 3, 30),
      '30% de entrada + 3x a cada 30 dias',
    );
  });

  it('descreve pagamento único', () => {
    assert.equal(descreverPagamento(null, 1, null), 'pagamento em 1 vez');
  });

  it('avisa quando não foi informado', () => {
    assert.equal(descreverPagamento(null, null, null), 'Não informada');
  });
});
