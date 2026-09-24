// ============================================================
//  Um identificador para uso só na tela
//
//  Serve para dar chave a item de lista que ainda não foi salvo —
//  o `key` do React, e nada além disso. Nunca vai para o banco.
//
//  POR QUE NÃO `crypto.randomUUID()`
//
//  Ele só existe em CONTEXTO SEGURO: HTTPS, ou `localhost`. Servido
//  pelo IP da rede (http://192.168.1.109:5173), que é como o dono do
//  sistema testa no celular, `crypto.randomUUID` é `undefined`.
//
//  O efeito era brutal e escondido: clicar em "Adicionar item à
//  solicitação" estourava, o React desmontava a árvore inteira e a
//  tela ficava PRETA. No computador, em localhost, funcionava —
//  então o defeito só aparecia no telefone.
//
//  Achado em 2026-09-24. Valeria também em produção servida por
//  HTTP, e num navegador antigo.
// ============================================================

let contador = 0;

/**
 * Identificador único dentro desta aba, sem depender de API do
 * navegador que pode não existir.
 *
 * Não é um UUID e não precisa ser: ninguém guarda, ninguém compara
 * entre máquinas. Precisa apenas não repetir enquanto a tela vive.
 */
export function chaveLocal(prefixo = 'item'): string {
  contador += 1;
  return prefixo + '-' + Date.now().toString(36) + '-' + contador.toString(36);
}
