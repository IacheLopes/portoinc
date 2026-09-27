// ============================================================
//  Testes do fiscal e contas a pagar
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  limparChave, calcularDigitoChave, chaveValida, extrairDaChave, formatarChave,
  conferirNotaContraPedido, gerarParcelas, descreverCondicao,
  situacaoVencimento, diasAte, descreverVencimento, formatarNumeroConta,
  lerXmlNotaFiscal,
  type NotaParaConferir, type PedidoParaConferir,
} from './fiscal.js';

/** Chave real em formato válido: 44 dígitos com verificador correto. */
const CHAVE = '35250912345678000199550010000001241000001242';

function nota(extra: Partial<NotaParaConferir> = {}): NotaParaConferir {
  return {
    numero: '124',
    serie: '1',
    chaveAcesso: CHAVE,
    cnpjFornecedor: '12345678000199',
    valorTotal: 1000,
    emitidaEm: new Date('2026-09-10T10:00:00Z'),
    ...extra,
  };
}

function pedido(extra: Partial<PedidoParaConferir> = {}): PedidoParaConferir {
  return {
    numeroFormatado: 'PC-00001',
    cnpjFornecedor: '12345678000199',
    valorTotal: 1000,
    jaLancado: 0,
    ...extra,
  };
}

describe('Chave de acesso', () => {
  it('limpa qualquer formatação', () => {
    assert.equal(limparChave('3525 0912 3456'), '352509123456');
    assert.equal(limparChave('3525.0912-3456'), '352509123456');
  });

  it('calcula o dígito verificador', () => {
    assert.equal(calcularDigitoChave(CHAVE.slice(0, 43)), 2);
  });

  it('aceita chave correta', () => {
    assert.equal(chaveValida(CHAVE), true);
    assert.equal(chaveValida(formatarChave(CHAVE)), true);
  });

  it('recusa chave com dígito errado', () => {
    assert.equal(chaveValida(CHAVE.slice(0, 43) + '0'), false);
  });

  it('recusa chave com tamanho errado', () => {
    assert.equal(chaveValida('123'), false);
    assert.equal(chaveValida(''), false);
    assert.equal(chaveValida(CHAVE + '9'), false);
  });

  it('abre a chave nos pedaços certos', () => {
    const d = extrairDaChave(CHAVE);

    assert.equal(d?.uf, '35');
    assert.equal(d?.anoMes, '2509');
    assert.equal(d?.cnpjEmitente, '12345678000199');
    assert.equal(d?.modelo, '55');
    assert.equal(Number(d?.numero), 124);
  });

  it('formata em grupos de quatro', () => {
    assert.equal(formatarChave(CHAVE).split(' ').length, 11);
  });
});

describe('Conferência contra o pedido', () => {
  it('nota que bate não gera pendência', () => {
    assert.deepEqual(conferirNotaContraPedido(nota(), pedido()), []);
  });

  it('acusa chave inválida', () => {
    const p = conferirNotaContraPedido(
      nota({ chaveAcesso: CHAVE.slice(0, 43) + '7' }),
      pedido(),
    );

    assert.ok(p.some((x) => x.includes('44 dígitos')));
  });

  it('a chave denuncia CNPJ diferente', () => {
    const p = conferirNotaContraPedido(nota({ cnpjFornecedor: '99999999000191' }), pedido());

    assert.ok(p.some((x) => x.includes('outro CNPJ')));
  });

  it('a chave denuncia número de nota trocado', () => {
    const p = conferirNotaContraPedido(nota({ numero: '999' }), pedido());

    assert.ok(p.some((x) => x.includes('nota 124')));
  });

  it('acusa nota acima do pedido', () => {
    const p = conferirNotaContraPedido(nota({ valorTotal: 1200 }), pedido());

    assert.ok(p.some((x) => x.includes('acima do que falta')));
  });

  it('nota menor é tratada como entrega parcial', () => {
    const p = conferirNotaContraPedido(nota({ valorTotal: 400 }), pedido());

    assert.ok(p.some((x) => x.includes('entrega parcial')));
  });

  it('segunda nota do mesmo pedido considera o que já foi lançado', () => {
    const p = conferirNotaContraPedido(
      nota({ valorTotal: 600 }),
      pedido({ jaLancado: 400 }),
    );

    assert.deepEqual(p, []);
  });

  it('nota sem pedido é sinalizada', () => {
    const p = conferirNotaContraPedido(nota(), null);

    assert.ok(p.some((x) => x.includes('sem pedido de compra')));
  });

  it('fornecedor diferente do pedido', () => {
    const p = conferirNotaContraPedido(
      nota({ chaveAcesso: null }),
      pedido({ cnpjFornecedor: '33000167000101' }),
    );

    assert.ok(p.some((x) => x.includes('fornecedor diferente')));
  });
});

describe('Parcelas', () => {
  const base = new Date('2026-09-10T12:00:00Z');

  it('sem condição nenhuma é à vista', () => {
    const p = gerarParcelas(1000, {}, base);

    assert.equal(p.length, 1);
    assert.equal(p[0].valor, 1000);
    assert.equal(p[0].vencimento.getTime(), base.getTime());
  });

  it('30% de entrada mais 3x a cada 30 dias', () => {
    const p = gerarParcelas(1000, {
      percentualEntrada: 30,
      quantidadeParcelas: 3,
      intervaloDias: 30,
    }, base);

    assert.equal(p.length, 4);
    assert.equal(p[0].valor, 300);
    assert.equal(p[1].valor, 233.33);
    assert.equal(p[2].valor, 233.33);
    // A última absorve o arredondamento.
    assert.equal(p[3].valor, 233.34);

    const soma = p.reduce((s, x) => s + x.valor, 0);
    assert.equal(Math.round(soma * 100) / 100, 1000);
  });

  it('a entrada vence na data base e as outras em intervalos', () => {
    const p = gerarParcelas(900, {
      percentualEntrada: 0,
      quantidadeParcelas: 3,
      intervaloDias: 30,
    }, base);

    assert.equal(p.length, 3);
    assert.equal(diasAte(p[0].vencimento, base), 30);
    assert.equal(diasAte(p[1].vencimento, base), 60);
    assert.equal(diasAte(p[2].vencimento, base), 90);
    assert.equal(p[0].valor, 300);
  });

  it('só entrada, sem parcelas', () => {
    const p = gerarParcelas(500, { percentualEntrada: 100 }, base);

    assert.equal(p.length, 1);
    assert.equal(p[0].valor, 500);
  });

  it('a soma sempre bate, mesmo com valor quebrado', () => {
    for (const total of [1000, 333.33, 1234.56, 99.99, 7]) {
      const p = gerarParcelas(total, {
        percentualEntrada: 30,
        quantidadeParcelas: 3,
        intervaloDias: 30,
      }, base);

      const soma = Math.round(p.reduce((s, x) => s + x.valor, 0) * 100) / 100;
      assert.equal(soma, Math.round(total * 100) / 100, 'total ' + total);
    }
  });

  it('valor zero não gera parcela', () => {
    assert.deepEqual(gerarParcelas(0, { quantidadeParcelas: 3 }, base), []);
  });

  it('descreve a condição em uma linha', () => {
    assert.equal(descreverCondicao({}), 'À vista');
    assert.equal(
      descreverCondicao({ percentualEntrada: 30, quantidadeParcelas: 3, intervaloDias: 30 }),
      '30% de entrada + 3x a cada 30 dias',
    );
    assert.equal(
      descreverCondicao({ quantidadeParcelas: 2, intervaloDias: 15 }),
      '2x a cada 15 dias',
    );
  });
});

describe('Vencimento', () => {
  // Com o Z, e não sem.
  //
  // "2026-09-22T15:00:00" sem fuso é lido como hora LOCAL, então o
  // mesmo teste media coisas diferentes no container (UTC) e na
  // máquina de quem desenvolve (São Paulo). Prova que muda de
  // resultado conforme onde roda não prova nada.
  //
  // 15:00 UTC é meio-dia em Brasília: dia 22 nos dois lugares.
  const hoje = new Date('2026-09-22T15:00:00Z');

  it('conta os dias pela casa do calendário', () => {
    // Vencimento é data-só: vem de um <input type="date">, que vira
    // meia-noite UTC. É assim que ele existe no banco.
    assert.equal(diasAte(new Date('2026-09-22'), hoje), 0);
    assert.equal(diasAte(new Date('2026-09-25'), hoje), 3);
    assert.equal(diasAte(new Date('2026-09-19'), hoje), -3);
  });

  it('às 22h de Brasília ainda é hoje, com o servidor em UTC', () => {
    // O DEFEITO, travado.
    //
    // 21/09 às 22h em São Paulo é 22/09 às 01h em UTC. O container
    // roda em UTC, e `hoje.getDate()` devolvia 22 — então a conta que
    // vencia no dia 22 aparecia como "vence hoje" quando ainda
    // faltava um dia inteiro. Alarme falso toda noite.
    const dezEDuasDaNoiteEmBrasilia = new Date('2026-09-22T01:00:00Z');

    assert.equal(
      descreverVencimento(new Date('2026-09-22'), dezEDuasDaNoiteEmBrasilia),
      'vence amanhã',
    );
    assert.equal(
      descreverVencimento(new Date('2026-09-21'), dezEDuasDaNoiteEmBrasilia),
      'vence hoje',
    );
    assert.equal(
      situacaoVencimento(new Date('2026-09-21'), 'ABERTA', dezEDuasDaNoiteEmBrasilia),
      'VENCE_HOJE',
    );
  });

  it('o mesmo instante dá o mesmo dia em qualquer fuso da máquina', () => {
    // Se alguém voltar a usar getDate() em vez do fuso declarado,
    // esta prova cai numa das duas máquinas — e é o que a gente quer:
    // que caia perto de quem mexeu, e não em produção.
    const meioDiaEmBrasilia = new Date('2026-09-22T15:00:00Z');
    const umaDaManhaEmBrasilia = new Date('2026-09-22T04:00:00Z');

    assert.equal(diasAte(new Date('2026-09-22'), meioDiaEmBrasilia), 0);
    assert.equal(diasAte(new Date('2026-09-22'), umaDaManhaEmBrasilia), 0);
  });

  it('classifica a parcela', () => {
    assert.equal(situacaoVencimento(new Date('2026-09-30'), 'ABERTA', hoje), 'A_VENCER');
    assert.equal(situacaoVencimento(new Date('2026-09-22'), 'ABERTA', hoje), 'VENCE_HOJE');
    assert.equal(situacaoVencimento(new Date('2026-09-10'), 'ABERTA', hoje), 'VENCIDA');
    assert.equal(situacaoVencimento(new Date('2026-09-10'), 'PAGA', hoje), 'PAGA');
    assert.equal(situacaoVencimento(new Date('2026-09-10'), 'CANCELADA', hoje), 'CANCELADA');
  });

  it('escreve em português', () => {
    assert.equal(descreverVencimento(new Date('2026-09-22'), hoje), 'vence hoje');
    assert.equal(descreverVencimento(new Date('2026-09-23'), hoje), 'vence amanhã');
    assert.equal(descreverVencimento(new Date('2026-09-21'), hoje), 'venceu ontem');
    assert.equal(descreverVencimento(new Date('2026-09-27'), hoje), 'vence em 5 dias');
    assert.equal(descreverVencimento(new Date('2026-09-19'), hoje), 'venceu há 3 dias');
  });

  it('numera as contas', () => {
    assert.equal(formatarNumeroConta(1), 'CP-00001');
    assert.equal(formatarNumeroConta(742), 'CP-00742');
  });
});

describe('Leitura do XML da nota', () => {
  const XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe versao="4.00" Id="NFe${CHAVE}">
      <ide>
        <cUF>35</cUF>
        <nNF>124</nNF>
        <serie>1</serie>
        <dhEmi>2026-09-10T10:30:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Marquilip Comercio e Representacao Ltda</xNome>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>CIM-50</cProd>
          <cEAN>7899888400575</cEAN>
          <xProd>Cimento Portland CP-II 50kg</xProd>
          <uCom>SC</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>33.4000</vUnCom>
          <vProd>334.00</vProd>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>ARE-01</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>Areia media lavada</xProd>
          <uCom>M3</uCom>
          <qCom>5.0000</qCom>
          <vUnCom>90.0000</vUnCom>
          <vProd>450.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vProd>784.00</vProd>
          <vFrete>120.00</vFrete>
          <vNF>904.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

  it('lê os dados da nota', () => {
    const n = lerXmlNotaFiscal(XML);

    assert.ok(n);
    assert.equal(n.chaveAcesso, CHAVE);
    assert.equal(n.numero, '124');
    assert.equal(n.serie, '1');
    assert.equal(n.cnpjEmitente, '12345678000199');
    assert.match(n.nomeEmitente ?? '', /Marquilip/);
    assert.equal(n.valorTotal, 904);
    assert.equal(n.valorProdutos, 784);
    assert.equal(n.valorFrete, 120);
  });

  it('lê os itens', () => {
    const n = lerXmlNotaFiscal(XML);

    assert.equal(n?.itens.length, 2);
    assert.equal(n?.itens[0].descricao, 'Cimento Portland CP-II 50kg');
    assert.equal(n?.itens[0].gtin, '7899888400575');
    assert.equal(n?.itens[0].quantidade, 10);
    assert.equal(n?.itens[0].valorUnitario, 33.4);
    assert.equal(n?.itens[1].gtin, null, '"SEM GTIN" não é código de barras');
  });

  it('a data vem do dhEmi', () => {
    const n = lerXmlNotaFiscal(XML);

    assert.equal(n?.emitidaEm?.getUTCFullYear(), 2026);
    assert.equal(n?.emitidaEm?.getUTCMonth(), 8); // setembro
  });

  it('funciona com namespace no nome das tags', () => {
    const comNs = XML.replace(/<(\/?)(nNF|serie|CNPJ|xProd)/g, '<$1ns2:$2');
    const n = lerXmlNotaFiscal(comNs);

    assert.equal(n?.numero, '124');
    assert.equal(n?.itens[0].descricao, 'Cimento Portland CP-II 50kg');
  });

  it('aceita CDATA na descrição', () => {
    const comCdata = XML.replace(
      '<xProd>Cimento Portland CP-II 50kg</xProd>',
      '<xProd><![CDATA[Cimento Portland CP-II 50kg]]></xProd>',
    );

    assert.equal(lerXmlNotaFiscal(comCdata)?.itens[0].descricao, 'Cimento Portland CP-II 50kg');
  });

  it('recusa arquivo que não é nota', () => {
    assert.equal(lerXmlNotaFiscal('<html><body>oi</body></html>'), null);
    assert.equal(lerXmlNotaFiscal(''), null);
  });

  it('recusa nota sem número', () => {
    const semNumero = XML.replace('<nNF>124</nNF>', '');

    assert.equal(lerXmlNotaFiscal(semNumero), null);
  });
});
