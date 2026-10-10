// ============================================================
//  Guardar segredo no banco sem guardar em texto puro
//
//  A chave do provedor de e-mail é o que permite mandar mensagem
//  EM NOME DA PORTO INC. Quem levar um backup do banco não pode
//  levar isso junto legível.
//
//  Isto NÃO é o mesmo que guardar senha. Senha a gente nunca
//  precisa de volta — guarda o resumo (Argon2id) e compara. A
//  chave do provedor precisa ser usada no envio, então tem de
//  voltar. Por isso cifra em vez de resumir.
//
//  DE ONDE VEM A CHAVE QUE CIFRA
//
//  Derivada do `JWT_SECRET`, que todo ambiente já tem — pedir uma
//  variável nova quebraria as instalações existentes no dia da
//  atualização, e segredo que a pessoa é obrigada a inventar na
//  pressa costuma virar "12345".
//
//  Derivada, não reusada: `hkdf` com um rótulo próprio produz uma
//  chave diferente da que assina os crachás. Se uma vazar, a
//  outra continua valendo.
//
//  AES-256-GCM porque ele autentica junto: se alguém editar o
//  texto cifrado direto no banco, a leitura falha em vez de
//  devolver lixo que o provedor recusaria sem explicar.
// ============================================================

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { ambiente } from '../config/ambiente.js';

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_IV = 12;
const ROTULO = 'portoink:segredo-de-integracao:v1';

/** A chave de cifra, derivada uma vez. */
function chave(): Buffer {
  return Buffer.from(
    hkdfSync('sha256', ambiente.JWT_SECRET, Buffer.alloc(0), ROTULO, 32),
  );
}

/**
 * Cifra um segredo para guardar no banco.
 *
 * O formato é `iv.conteudo.selo`, tudo em base64url e separado
 * por ponto — legível o bastante para alguém olhando o banco
 * entender que é um bloco cifrado, e não um valor corrompido.
 */
export function cifrar(texto: string): string {
  const iv = randomBytes(TAMANHO_IV);
  const cifra = createCipheriv(ALGORITMO, chave(), iv);

  const conteudo = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  const selo = cifra.getAuthTag();

  return [iv, conteudo, selo].map((b) => b.toString('base64url')).join('.');
}

/**
 * Devolve o segredo original, ou null se não der.
 *
 * Nunca lança: um segredo ilegível — porque o `JWT_SECRET` mudou,
 * porque alguém editou a linha, porque o backup veio de outro
 * ambiente — tem de virar "não configurado", e a tela pede para
 * cadastrar de novo. Explodir aqui derrubaria o envio inteiro por
 * causa de uma linha de configuração.
 */
export function decifrar(guardado: string): string | null {
  try {
    const [iv, conteudo, selo] = String(guardado).split('.');
    if (!iv || !conteudo || !selo) return null;

    const decifra = createDecipheriv(ALGORITMO, chave(), Buffer.from(iv, 'base64url'));
    decifra.setAuthTag(Buffer.from(selo, 'base64url'));

    return Buffer.concat([
      decifra.update(Buffer.from(conteudo, 'base64url')),
      decifra.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Como o segredo aparece na tela: nunca ele, só o fim.
 *
 * Mostrar os últimos caracteres serve para a pessoa reconhecer
 * QUAL chave está lá quando tiver duas contas no provedor — sem
 * entregar nada de útil para quem só está olhando a tela.
 */
export function mostrarFim(segredo: string): string {
  const texto = String(segredo ?? '');
  if (texto.length <= 4) return '••••';
  return '••••••••' + texto.slice(-4);
}
