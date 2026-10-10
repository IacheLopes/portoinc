// ============================================================
//  O COFRE DOS SEGREDOS DE INTEGRAÇÃO
//
//  A chave do provedor de e-mail permite mandar mensagem EM NOME
//  DA PORTO INC. Quem levar um backup do banco não pode levar
//  isso junto legível.
//
//  O que estes testes protegem:
//
//    1. O texto cifrado NÃO CONTÉM o segredo. Parece óbvio e é a
//       única coisa que realmente importa aqui.
//    2. Cifrar duas vezes dá resultados DIFERENTES. Sem isso,
//       duas empresas com a mesma chave teriam a mesma linha no
//       banco, e quem olhasse saberia disso.
//    3. Conteúdo adulterado NÃO volta como lixo: volta como null.
//    4. Decifrar nunca explode — segredo ilegível vira "não
//       configurado", e a tela pede para cadastrar de novo.
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cifrar, decifrar, mostrarFim } from './segredos.js';

const CHAVE = 're_AbCdEfGh_12345678901234567890';

describe('Cifrar e decifrar', () => {
  it('o que entra é o que volta', () => {
    assert.equal(decifrar(cifrar(CHAVE)), CHAVE);
  });

  it('o SEGREDO NÃO APARECE no texto cifrado', () => {
    //  É a única garantia que justifica o arquivo existir.
    const guardado = cifrar(CHAVE);

    assert.ok(!guardado.includes(CHAVE));
    assert.ok(!guardado.includes('AbCdEfGh'));
    assert.ok(!guardado.includes('12345678901234567890'));
  });

  it('cifrar duas vezes dá resultados diferentes', () => {
    //  O IV é sorteado a cada vez. Sem isso, duas instalações com
    //  a mesma chave teriam a MESMA linha no banco — e quem
    //  olhasse as duas saberia que são iguais sem decifrar nada.
    const a = cifrar(CHAVE);
    const b = cifrar(CHAVE);

    assert.notEqual(a, b);
    assert.equal(decifrar(a), CHAVE);
    assert.equal(decifrar(b), CHAVE);
  });

  it('texto adulterado volta NULL, não lixo', () => {
    //  AES-GCM autentica junto. Se alguém editar a linha direto no
    //  banco, a leitura falha — em vez de devolver bytes trocados
    //  que o provedor recusaria sem explicar o motivo.
    const guardado = cifrar(CHAVE);
    const [iv, conteudo, selo] = guardado.split('.');

    const mexido = [iv, conteudo.slice(0, -4) + 'AAAA', selo].join('.');
    assert.equal(decifrar(mexido), null);
  });

  it('selo trocado também volta NULL', () => {
    const guardado = cifrar(CHAVE);
    const [iv, conteudo] = guardado.split('.');

    assert.equal(decifrar([iv, conteudo, 'AAAAAAAAAAAAAAAAAAAAAA'].join('.')), null);
  });

  it('lixo qualquer não derruba o sistema', () => {
    //  Isto chega quando o JWT_SECRET muda ou o backup veio de
    //  outro ambiente. Tem de virar "não configurado", e não uma
    //  exceção que derruba o envio inteiro.
    for (const entrada of ['', 'nada', 'a.b.c', 'só.dois']) {
      assert.equal(decifrar(entrada), null);
    }
  });

  it('segredo com acento e emoji volta inteiro', () => {
    const esquisito = 'chave-com-açúcar-e-🔑';
    assert.equal(decifrar(cifrar(esquisito)), esquisito);
  });
});

describe('Como o segredo aparece na tela', () => {
  it('mostra só o fim, para reconhecer qual é', () => {
    //  Serve para a pessoa saber QUAL chave está lá quando tiver
    //  duas contas no provedor — sem entregar nada de útil.
    assert.equal(mostrarFim(CHAVE), '••••••••7890');
  });

  it('segredo curto não vira dica', () => {
    assert.equal(mostrarFim('abc'), '••••');
  });
});
