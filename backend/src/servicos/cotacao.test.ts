// ============================================================
//  Testes das regras da cotação
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  podeIrPara, podeEditarBid, formatarNumeroBid, gerarToken,
  conferirAbertura, conferirLink, calcularTotais, descreverPagamento,
  prazoMedioDePagamento,
  STATUS_RECUSA, MENSAGEM_RECUSA,
} from './cotacao.js';
//  Para provar que as duas descricoes da mesma condicao concordam.
import { descreverCondicao } from './fiscal.js';

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

    //  ERAM 43 CARACTERES, E VIRARAM 12, em 10/10/2026.
    //
    //  O link viaja pelo WhatsApp, e 43 caracteres só de chave
    //  faziam uma parede de letras embaixo de uma mensagem curta.
    //  O dono reclamou olhando a conversa no celular.
    //
    //  9 bytes = 72 bits. Adivinhar exige acertar entre 4,7
    //  sextilhões, e a rota do portal aceita 30 tentativas por 5
    //  minutos — o que torna a busca por tentativa impossível em
    //  qualquer prazo humano.
    //
    //  O piso fica em 12 e não em 43: encolher mais exigiria
    //  refazer esta conta.
    assert.ok(token.length >= 12, 'token curto demais: ' + token.length);
    assert.ok(token.length <= 16, 'token longo demais para caber no WhatsApp');
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

  it('TRAVA quem já respondeu nesta rodada', () => {
    //  Pedido dele em 10/10/2026, depois de testar com um celular
    //  de verdade: "após eu responder a cotação, se eu clicar no
    //  link novamente eu posso mudar as informações, isso não pode
    //  acontecer".
    const r = conferirLink({
      existe: true,
      situacaoBid: 'ABERTO',
      expiraEm: futuro,
      respondidoEm: new Date('2026-10-02T10:00:00Z'),
      rodadaRespondida: 1,
      rodadaAtual: 1,
      agora,
    });

    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.motivo, 'ja-respondido');
  });

  it('A ÚLTIMA CHAMADA DESTRAVA, porque a rodada virou', () => {
    //  Este é o teste que impede alguém de "simplificar" a trava
    //  para um booleano. A última chamada existe para pedir que o
    //  fornecedor REVEJA o preço, e ela manda link justamente para
    //  quem já respondeu. Trava cega mataria o recurso.
    const r = conferirLink({
      existe: true,
      situacaoBid: 'ABERTO',
      expiraEm: futuro,
      respondidoEm: new Date('2026-10-02T10:00:00Z'),
      rodadaRespondida: 1,
      rodadaAtual: 2,
      agora,
    });

    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.jaRespondeu, true);
  });

  it('convite antigo, sem rodada guardada, não trava', () => {
    //  Linha de antes da coluna existir. Travar por falta de dado
    //  deixaria um fornecedor sem poder responder, sem ninguém
    //  entender por quê.
    const r = conferirLink({
      existe: true,
      situacaoBid: 'ABERTO',
      expiraEm: futuro,
      respondidoEm: new Date('2026-10-02T10:00:00Z'),
      rodadaRespondida: null,
      rodadaAtual: 1,
      agora,
    });

    assert.equal(r.ok, true);
  });

  it('quem ainda não respondeu entra normalmente', () => {
    const r = conferirLink({
      existe: true,
      situacaoBid: 'ABERTO',
      expiraEm: futuro,
      rodadaAtual: 1,
      agora,
    });

    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.jaRespondeu, false);
  });

  it('cada recusa tem o código HTTP certo', () => {
    assert.equal(STATUS_RECUSA['nao-encontrado'], 404);
    assert.equal(STATUS_RECUSA.vencido, 410);
    assert.equal(STATUS_RECUSA['pacote-fechado'], 409);
    assert.equal(STATUS_RECUSA['ja-respondido'], 409);
  });

  it('a frase de "já enviou" AGRADECE, não repreende', () => {
    //  Quem reabre o link quase sempre está conferindo se deu
    //  certo. A frase é dele, palavra por palavra.
    assert.equal(
      MENSAGEM_RECUSA['ja-respondido'],
      'Você já enviou a sua cotação, muito obrigado!',
    );
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

  it('VAZIO É À VISTA, e o texto diz isso', () => {
    //  O portal manda o fornecedor deixar tudo vazio se for à
    //  vista, e `gerarParcelas` monta uma parcela só na data da
    //  nota. Dizer "Não informada" fazia o pedido parecer
    //  incompleto para quem o recebe em PDF.
    assert.equal(descreverPagamento(null, null, null), 'À vista');
    assert.equal(descreverPagamento(0, 0, null), 'À vista');
  });

  it('e combina com o que o financeiro já dizia', () => {
    //  `descreverCondicao`, em `fiscal.ts`, sempre devolveu "À
    //  vista" para a mesma entrada. Eram duas funções descrevendo a
    //  mesma coisa com palavras diferentes.
    assert.equal(
      descreverPagamento(null, null, null),
      descreverCondicao({ percentualEntrada: null, quantidadeParcelas: null, intervaloDias: null }),
    );
  });
});

describe('Prazo de pagamento vira dinheiro', () => {
  it('3x a cada 30 dias dá prazo médio de 60 dias', () => {
    // Vence em 30, 60 e 90 — a média é 60.
    assert.equal(prazoMedioDePagamento(null, 3, 30), 60);
  });

  it('a entrada puxa a média para baixo', () => {
    // 30% no dia 0, 35% no dia 30 e 35% no dia 60.
    assert.equal(prazoMedioDePagamento(30, 2, 30), 31.5);
  });

  it('pagar 100% de entrada é prazo zero', () => {
    assert.equal(prazoMedioDePagamento(100, null, null), 0);
  });

  it('parcelas sem intervalo não têm prazo calculável', () => {
    // Inventar 30 dias aqui seria colocar palavra na boca do
    // fornecedor, e a conta sairia na tela como se fosse dele.
    assert.equal(prazoMedioDePagamento(null, 3, null), null);
  });

  it('sem condição nenhuma, o prazo é ZERO: é à vista', () => {
    //  Era nulo, e virava "—" na tela ao lado de um "À vista" que a
    //  mesma tela já sabia escrever quando o prazo era zero.
    assert.equal(prazoMedioDePagamento(null, null, null), 0);
    assert.equal(prazoMedioDePagamento(0, 0, null), 0);
  });

  it('MAS OS OUTROS DOIS "NÃO SEI" CONTINUAM NULOS', () => {
    //  Este teste existe para impedir que alguém "simplifique"
    //  devolvendo zero sempre. São desconhecidos de verdade:
    //
    //    entrada sem parcelas   -> e os outros 70%, quando?
    //    parcelas sem intervalo -> a cada quantos dias?
    //
    //  Inventar 30 dias aqui seria pôr palavra na boca do
    //  fornecedor — e essa palavra vira conta a pagar.
    assert.equal(prazoMedioDePagamento(30, null, null), null, 'entrada sem parcelas');
    assert.equal(prazoMedioDePagamento(null, 3, null), null, 'parcelas sem intervalo');
  });
});
