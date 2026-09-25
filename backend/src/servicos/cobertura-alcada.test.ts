// ============================================================
//  O aviso tem de dizer o que o sistema FAZ
//
//  Achado pelo dono em 25/09/2026, cadastrando as três faixas. O
//  aviso de sobreposição dizia:
//
//    "Valerá a de menor valor mínimo."
//
//  E a regra sempre foi o contrário: `acharFaixa` ordena por mínimo
//  decrescente e fica com a de MAIOR. O comportamento tinha teste
//  (`havendo sobreposição, vale a de maior mínimo`); a frase não.
//  Por isso a contradição sobreviveu.
//
//  E não era erro de redação. Com faixas 0–5.000 (gestor) e
//  5.000–50.000 (gestor E engenheiro), numa compra de exatamente
//  R$ 5.000 a pessoa lia o aviso, esperava UMA assinatura, e o
//  sistema exigia DUAS. Ela descobriria isso com o fornecedor
//  esperando resposta.
//
//  Estes testes cobrem o TEXTO — que é o que a pessoa usa para
//  decidir, e portanto é comportamento tanto quanto o código.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { conferirCobertura } from '../rotas/alcadas.js';

const BAIXO = { valorMinimo: 0, valorMaximo: 5000, descricao: 'Faixa de baixo' };
const CIMA = { valorMinimo: 5000, valorMaximo: null, descricao: 'Faixa de cima' };

describe('Conferência das faixas de alçada', () => {
  it('três faixas encaixadas não geram aviso nenhum', () => {
    const avisos = conferirCobertura([
      { valorMinimo: 0, valorMaximo: 5000, descricao: 'Dia a dia' },
      { valorMinimo: 5000.01, valorMaximo: 50000, descricao: 'Média' },
      { valorMinimo: 50000.01, valorMaximo: null, descricao: 'Grande' },
    ]);

    assert.deepEqual(avisos, [], 'faixas separadas por um centavo estão certas');
  });

  it('faixas encostadas avisam, e nomeiam a que REALMENTE vale', () => {
    const avisos = conferirCobertura([BAIXO, CIMA]);
    const sobreposicao = avisos.find((a) => a.includes('sobrep'));

    assert.ok(sobreposicao, 'mínimo igual ao máximo anterior é sobreposição');

    // O coração do conserto: a faixa citada tem de ser a de MAIOR
    // mínimo, que é a que `acharFaixa` escolhe.
    assert.match(sobreposicao, /MAIOR mínimo/);
    assert.match(sobreposicao, /Faixa de cima/);
    assert.ok(
      !/menor valor mínimo/.test(sobreposicao),
      'era o que o aviso dizia antes, e era o contrário do que o sistema faz',
    );
  });

  it('o aviso diz em que valor o encontro acontece, em real brasileiro', () => {
    // Sem o número, a pessoa não sabe onde conferir. E o número sai
    // como ela escreve: o aviso dizia "R$ 5000.00", ponto americano e
    // sem separador de milhar, num texto cujo único assunto é um valor.
    assert.match(conferirCobertura([BAIXO, CIMA])[0], /R\$ 5\.000,00/);
  });

  it('e ensina a saída: começar um centavo acima', () => {
    assert.match(conferirCobertura([BAIXO, CIMA])[0], /centavo/);
  });

  it('sem faixa nenhuma, nada é aprovado', () => {
    assert.deepEqual(conferirCobertura([]), ['Nenhuma faixa ativa: nada poderá ser aprovado.']);
  });

  it('vão entre faixas também avisa', () => {
    const avisos = conferirCobertura([
      { valorMinimo: 0, valorMaximo: 1000, descricao: 'Baixa' },
      { valorMinimo: 9000, valorMaximo: null, descricao: 'Alta' },
    ]);

    assert.ok(avisos.some((a) => a.includes('vão')), 'compras entre 1.000 e 9.000 ficariam órfãs');
  });

  it('faixa sem teto no meio esconde as de cima', () => {
    const avisos = conferirCobertura([
      { valorMinimo: 0, valorMaximo: null, descricao: 'Sem teto' },
      { valorMinimo: 5000, valorMaximo: null, descricao: 'Nunca usada' },
    ]);

    assert.ok(avisos.some((a) => a.includes('nunca serão usadas')));
  });

  it('a última faixa com teto deixa as compras grandes sem aprovador', () => {
    const avisos = conferirCobertura([{ valorMinimo: 0, valorMaximo: 5000, descricao: 'Única' }]);

    assert.ok(avisos.some((a) => a.includes('sem teto')));
  });
});
