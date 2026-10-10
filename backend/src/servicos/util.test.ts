// ============================================================
//  Testes das validações puras
//
//  Não tocam no banco nem na rede: rodam em milissegundos.
//  São a primeira linha de defesa contra dado ruim entrando
//  no sistema.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  cnpjValido, formatarCnpj, apenasDigitos, gtinValido,
  reaisBr, quantidadeBr, porcentoBr, porcentoEmFrase, plural,
} from './util.js';
import { validarForcaSenha } from './senha.js';
import { lerNumero, detectarSeparador, lerCsvOrcamento } from './orcamento.js';

describe('CNPJ', () => {
  it('aceita CNPJs reais', () => {
    // CNPJs públicos usados apenas como exemplo de dígito válido.
    assert.equal(cnpjValido('19.131.243/0001-97'), true);
    assert.equal(cnpjValido('33000167000101'), true);
    assert.equal(cnpjValido('05.570.714/0001-59'), true);
  });

  it('recusa quando o dígito verificador não bate', () => {
    assert.equal(cnpjValido('19.131.243/0001-98'), false);
    assert.equal(cnpjValido('33000167000102'), false);
  });

  it('recusa sequências repetidas, que passariam na conta', () => {
    assert.equal(cnpjValido('11111111111111'), false);
    assert.equal(cnpjValido('00000000000000'), false);
  });

  it('recusa quantidade errada de dígitos', () => {
    assert.equal(cnpjValido('1913124300019'), false);
    assert.equal(cnpjValido('191312430001977'), false);
    assert.equal(cnpjValido(''), false);
  });

  it('aceita com ou sem pontuação', () => {
    assert.equal(cnpjValido('19131243000197'), true);
    assert.equal(cnpjValido('19.131.243/0001-97'), true);
  });

  it('formata para exibição', () => {
    assert.equal(formatarCnpj('19131243000197'), '19.131.243/0001-97');
  });

  it('extrai só os dígitos', () => {
    assert.equal(apenasDigitos('19.131.243/0001-97'), '19131243000197');
    assert.equal(apenasDigitos('(11) 98888-7777'), '11988887777');
  });
});

describe('Código de barras (GTIN)', () => {
  it('aceita códigos válidos do catálogo da Porto Inc.', () => {
    assert.equal(gtinValido('7899888400575'), true);
    assert.equal(gtinValido('7896193243897'), true);
    assert.equal(gtinValido('7898494150676'), true);
  });

  it('recusa quando um dígito foi trocado', () => {
    assert.equal(gtinValido('7899888400576'), false);
    assert.equal(gtinValido('7899888400574'), false);
  });

  it('recusa comprimento inválido', () => {
    assert.equal(gtinValido('789988840057'), false); // 12 com dígito errado
    assert.equal(gtinValido('123'), false);
    assert.equal(gtinValido(''), false);
  });

  it('ignora pontuação e espaços', () => {
    assert.equal(gtinValido('7 899888 400575'), true);
  });
});

describe('Dinheiro, quantidade e percentual', () => {
  // Estas tres funcoes formatam TUDO o que o backend escreve em
  // numero: 83 chamadas, em doze arquivos. Antes do dia 08/10/2026
  // cada arquivo tinha a sua copia — onze copias do dinheiro —, e
  // nenhuma tinha teste. Duas arredondavam diferente das outras.

  it('escreve real com duas casas, sempre', () => {
    assert.equal(reaisBr(0), 'R$ 0,00');
    assert.equal(reaisBr(1800), 'R$ 1.800,00');
    assert.equal(reaisBr(1234567.8), 'R$ 1.234.567,80');
    assert.equal(reaisBr(-250.5), '-R$ 250,50');
    assert.equal(reaisBr(-1234567.8), '-R$ 1.234.567,80');
  });

  it('arredonda o centavo em vez de mostrar o terceiro', () => {
    // ESTE ERA O DEFEITO. Duas copias — a do e-mail do fornecedor e a
    // da saida fiscal — pediam `minimumFractionDigits` e esqueciam o
    // `maximum`. O JavaScript entao mostra ate tres casas, e um preco
    // de media ponderada saia "R$ 1.234,567" para o fornecedor ler.
    assert.equal(reaisBr(1234.567), 'R$ 1.234,57');
    assert.equal(reaisBr(0.005), 'R$ 0,01');
    assert.equal(reaisBr(10 / 3), 'R$ 3,33');
  });

  it('poe o menos antes do simbolo, como a tela', () => {
    // A funcao montava o 'R$ ' a mao, o que prendia o sinal entre o
    // simbolo e o numero: "R$ -250,50". A tela usa `Intl` e sempre
    // escreveu "-R$ 250,50". A mesma linha de caixa saia diferente na
    // tabela e no PDF da tabela.
    assert.ok(reaisBr(-1).startsWith('-R$ '), 'o menos vem antes do R$');
    assert.ok(!reaisBr(-1).includes('R$ -'), 'e nunca depois');
  });

  it('nao escreve negativo que, arredondado, e zero', () => {
    // Subtrair dois valores de dois decimais devolve -4,5e-13 com
    // frequencia, e "-R$ 0,00" nao quer dizer nada para quem le.
    assert.equal(reaisBr(-0.004), 'R$ 0,00');
    assert.equal(reaisBr(-0), 'R$ 0,00');
    assert.equal(reaisBr(-(0.3 - 0.1 - 0.2)), 'R$ 0,00');
  });

  it('arredonda o meio centavo igual dos dois lados', () => {
    // `Math.round(-0.5)` devolve -0 no JavaScript. Arredondando o
    // valor COM sinal, meio centavo negativo virava zero enquanto o
    // positivo virava um centavo. Arredondar o modulo resolve.
    assert.equal(reaisBr(0.005), 'R$ 0,01');
    assert.equal(reaisBr(-0.005), '-R$ 0,01');
  });

  it('separa o R$ do numero com espaco comum, nao com o invisivel', () => {
    // `style: 'currency'` devolve ESPACO NAO SEPARAVEL (U+00A0) entre
    // o R$ e o numero. Na tela os dois sao identicos; para quem busca
    // "R$ 1.800" no log, nao. Duas copias usavam currency, nove
    // montavam o 'R$ ' a mao — e as duas familias nunca casavam.
    assert.equal(reaisBr(1800).charCodeAt(2), 32, 'tem de ser espaco comum');
    assert.ok(!reaisBr(1800).includes('\u00a0'));
  });

  it('escreve quantidade com quatro casas, e sem casa nenhuma quando e inteiro', () => {
    // Quantidade nao forca decimal: "10 sacos" e nao "10,0000 sacos".
    assert.equal(quantidadeBr(10), '10');
    assert.equal(quantidadeBr(0.5), '0,5');
    assert.equal(quantidadeBr(1234.5678), '1.234,5678');
    assert.equal(quantidadeBr(1.00005), '1,0001');
  });

  it('aceita menos casas onde a coluna e estreita', () => {
    // O relatorio em PDF pede duas: a coluna nao cabe quatro.
    assert.equal(quantidadeBr(1234.5678, 2), '1.234,57');
    assert.equal(quantidadeBr(4.5, 2), '4,5');
  });

  it('em FRASE, nao forca casa decimal', () => {
    // "50,0% de entrada" soa de robo. Numa COLUNA a casa fixa e que
    // faz a virgula cair sempre no mesmo lugar — sao duas
    // necessidades, e por isso sao duas funcoes.
    assert.equal(porcentoEmFrase(50), '50%');
    assert.equal(porcentoEmFrase(100), '100%');
    assert.equal(porcentoEmFrase(33.33), '33,33%');

    // O DEFEITO que ela mata: `percentualEntrada` aceita decimal
    // (z.coerce.number().min(0).max(100), sem travar inteiro), entao
    // o fornecedor pode digitar 33,33 no portal — e colar o numero
    // no texto escrevia "33.33% de entrada", com ponto.
    assert.ok(!porcentoEmFrase(33.33).includes('.'));
  });

  it('escreve percentual com uma casa FORCADA', () => {
    // A casa fixa existe para a virgula cair no mesmo lugar em toda a
    // coluna. Sem ela a coluna sai "5%", "5,2%", "4,9%" e o olho perde
    // a referencia ao descer.
    assert.equal(porcentoBr(5), '5,0%');
    assert.equal(porcentoBr(4.92), '4,9%');
    assert.equal(porcentoBr(0), '0,0%');
    assert.equal(porcentoBr(4900), '4.900,0%');
  });
});

describe('Concordancia de numero', () => {
  // O backend escrevia `n + ' dia(s)'` em doze frases, sete delas
  // dentro de PDF. O comentario de `rotas/relatorios.ts` ja dizia a
  // regra desde antes: "o (s) e a saida preguicosa de quem nao quis
  // contar: sobra escrito no papel que vai para a diretoria, e quando
  // o numero e 1 esta simplesmente errado".

  it('concorda no singular e no plural', () => {
    assert.equal(plural(1, 'dia', 'dias'), '1 dia');
    assert.equal(plural(3, 'dia', 'dias'), '3 dias');
  });

  it('zero vai para o plural, como se fala', () => {
    // "0 dia" ninguem diz.
    assert.equal(plural(0, 'dia', 'dias'), '0 dias');
  });

  it('da conta do plural irregular, que um "s" no fim nao daria', () => {
    assert.equal(plural(1, 'devolução', 'devoluções'), '1 devolução');
    assert.equal(plural(2, 'devolução', 'devoluções'), '2 devoluções');
    assert.equal(plural(2, 'item', 'itens'), '2 itens');
  });

  it('leva a frase inteira quando a concordancia passa do substantivo', () => {
    // Em portugues ela contamina o adjetivo e o verbo. Partir isso em
    // pedacos e remendar com `?:` no meio da frase e como nasce
    // "1 itens marcados".
    assert.equal(
      plural(1, 'item não recebeu', 'itens não receberam'),
      '1 item não recebeu',
    );
    assert.equal(
      plural(3, 'item não recebeu', 'itens não receberam'),
      '3 itens não receberam',
    );
    assert.equal(
      plural(1, 'item marcado como disponível está', 'itens marcados como disponíveis estão'),
      '1 item marcado como disponível está',
    );
  });

  it('poe o ponto do milhar, porque isto vai para dentro de PDF', () => {
    // Era `n + ' pedido(s)'`: concatenacao crua, sem separador.
    assert.equal(plural(1234, 'pedido', 'pedidos'), '1.234 pedidos');
  });

  it('aceita media, com as casas que o lugar pede', () => {
    // O tempo medio de uma solicitacao e o unico chamador que passa
    // numero quebrado. Sem as casas ele sairia arredondado.
    assert.equal(plural(4.53, 'dia', 'dias', 2), '4,53 dias');
    assert.equal(plural(1, 'dia', 'dias', 2), '1 dia');
  });

  it('o singular segue o numero ESCRITO, nao o calculado', () => {
    // 1,4 com zero casas sai escrito "1", e "1 dias" e exatamente o
    // defeito que esta funcao existe para matar.
    assert.equal(plural(1.4, 'dia', 'dias'), '1 dia');
    // E 1,04 com duas casas tambem sai "1".
    assert.equal(plural(1.004, 'dia', 'dias', 2), '1 dia');
    // Mas 1,5 com uma casa e plural, porque escrito ele nao e 1.
    assert.equal(plural(1.5, 'dia', 'dias', 1), '1,5 dias');
  });
});

describe('Força da senha', () => {
  it('aprova senha longa com letra e número', () => {
    assert.deepEqual(validarForcaSenha('obradoporto2026'), []);
    assert.deepEqual(validarForcaSenha('Porto@2026'), []);
  });

  it('reprova senha curta', () => {
    const problemas = validarForcaSenha('Ab1');
    assert.ok(problemas.some((p) => p.includes('8 caracteres')));
  });

  it('reprova senha só com números', () => {
    const problemas = validarForcaSenha('123456789');
    assert.ok(problemas.some((p) => p.includes('letra')));
  });

  it('reprova senha só com letras', () => {
    const problemas = validarForcaSenha('apenasletras');
    assert.ok(problemas.some((p) => p.includes('número')));
  });
});

describe('Leitura de número da planilha', () => {
  it('entende o formato brasileiro', () => {
    assert.equal(lerNumero('1.250,00'), 1250);
    assert.equal(lerNumero('1.234.567,89'), 1234567.89);
    assert.equal(lerNumero('890,50'), 890.5);
  });

  it('entende o formato internacional', () => {
    assert.equal(lerNumero('1250.00'), 1250);
    assert.equal(lerNumero('34'), 34);
  });

  it('trata vazio como zero', () => {
    assert.equal(lerNumero(''), 0);
    assert.equal(lerNumero('   '), 0);
  });

  it('recusa texto e número negativo', () => {
    assert.equal(lerNumero('abc'), null);
    assert.equal(lerNumero('-50'), null);
    assert.equal(lerNumero('12abc'), null);
  });
});

describe('Separador do CSV', () => {
  it('detecta ponto e vírgula', () => {
    assert.equal(detectarSeparador('codigo;descricao;unidade'), ';');
  });

  it('detecta vírgula', () => {
    assert.equal(detectarSeparador('codigo,descricao,unidade'), ',');
  });

  it('na dúvida, usa vírgula', () => {
    assert.equal(detectarSeparador('codigo'), ',');
  });
});

describe('Importação de orçamento', () => {
  const CABECALHO = 'codigo;descricao;unidade;quantidade;valor_unitario';

  it('lê um arquivo correto', () => {
    const r = lerCsvOrcamento(
      [CABECALHO, '03.01.001;Cimento Portland;SC;1200;34,00', '03.02.001;Areia média;m3;180;130,00'].join('\n'),
    );

    assert.equal(r.problemas.length, 0);
    assert.equal(r.linhas.length, 2);
    assert.equal(r.linhas[0].codigo, '03.01.001');
    assert.equal(r.linhas[0].quantidadePrevista, 1200);
    assert.equal(r.linhas[0].valorUnitarioPrevisto, 34);
    // A unidade é padronizada em maiúscula.
    assert.equal(r.linhas[1].unidade, 'M3');
  });

  it('preserva acentos', () => {
    const r = lerCsvOrcamento(
      [CABECALHO, '02.01.001;Fundação — estacas hélice contínua;M;450;1.250,00'].join('\n'),
    );

    assert.equal(r.linhas[0].descricao, 'Fundação — estacas hélice contínua');
    assert.equal(r.linhas[0].valorUnitarioPrevisto, 1250);
  });

  it('não desiste do arquivo por causa de linha ruim', () => {
    const r = lerCsvOrcamento(
      [
        CABECALHO,
        '01.01.001;Linha boa;UN;10;5,00',
        ';Sem código;M2;10;10',
        '01.01.002;Valor inválido;M2;abc;xyz',
        '01.01.001;Código repetido;UN;1;1',
        '01.01.003;Só três colunas',
        '01.01.004;Outra linha boa;KG;20;7,50',
      ].join('\n'),
    );

    // As duas linhas boas entraram.
    assert.equal(r.linhas.length, 2);
    assert.equal(r.linhas[0].codigo, '01.01.001');
    assert.equal(r.linhas[1].codigo, '01.01.004');

    // E os quatro problemas foram descritos com o número da linha.
    assert.equal(r.problemas.length, 4);
    assert.ok(r.problemas[0].includes('Linha 3'));
    assert.ok(r.problemas[1].includes('Linha 4'));
    assert.ok(r.problemas[2].includes('Linha 5'));
    assert.ok(r.problemas[2].includes('repetido'));
    assert.ok(r.problemas[3].includes('Linha 6'));
  });

  it('aceita vírgula como separador de coluna', () => {
    const r = lerCsvOrcamento('codigo,descricao,unidade,qtd,valor\n01,Item,UN,5,10.50');

    assert.equal(r.linhas.length, 1);
    assert.equal(r.linhas[0].valorUnitarioPrevisto, 10.5);
  });

  it('avisa quando o arquivo só tem cabeçalho', () => {
    const r = lerCsvOrcamento(CABECALHO);
    assert.equal(r.linhas.length, 0);
    assert.equal(r.problemas.length, 1);
  });

  it('numera as linhas em sequência', () => {
    const r = lerCsvOrcamento(
      [CABECALHO, '01;A;UN;1;1', '02;B;UN;1;1', '03;C;UN;1;1'].join('\n'),
    );

    assert.deepEqual(r.linhas.map((l) => l.ordem), [1, 2, 3]);
  });
});
