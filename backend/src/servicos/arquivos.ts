// ============================================================
//  Guarda de arquivos
//
//  O sistema não guardava arquivo nenhum, e o fluxo de compras
//  pede que a nota fiscal fique ARQUIVADA. Isto é o cofre.
//
//  O conteúdo vai para um volume do Docker; no banco fica só a
//  ficha. Binário dentro do banco incha a cópia de segurança e
//  deixa toda consulta mais lenta, sem devolver nada em troca.
// ============================================================

import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { banco } from '../plugins/banco.js';
import { ambiente } from '../config/ambiente.js';

export type TipoDeArquivo = 'XML_NFE' | 'PDF_NFE' | 'OUTRO';

/** O que aceitamos guardar, e como cada coisa se chama no disco. */
const TIPOS_ACEITOS: Record<string, { extensao: string; nome: string }> = {
  'application/pdf': { extensao: 'pdf', nome: 'PDF' },
  'text/xml': { extensao: 'xml', nome: 'XML' },
  'application/xml': { extensao: 'xml', nome: 'XML' },
};

/** 5 MB. Uma NF em PDF tem alguns KB; acima disso é outra coisa. */
export const TAMANHO_MAXIMO = 5 * 1024 * 1024;

export class ErroDeArquivo extends Error {}

export function tipoAceito(tipoMime: string): boolean {
  return tipoMime in TIPOS_ACEITOS;
}

export function nomeDoTipo(tipoMime: string): string {
  return TIPOS_ACEITOS[tipoMime]?.nome ?? 'arquivo';
}

/**
 * Onde o arquivo mora, a partir do caminho guardado no banco.
 *
 * Confere que o resultado continua DENTRO da pasta de arquivos.
 * Sem isso, um caminho com ".." no banco leria qualquer arquivo
 * do container — e o caminho vem de fora quando alguém envia.
 */
export function caminhoCompleto(caminhoRelativo: string): string {
  const base = resolve(ambiente.ARQUIVOS_DIR);
  const alvo = resolve(join(base, caminhoRelativo));

  if (alvo !== base && !alvo.startsWith(base + sep)) {
    throw new ErroDeArquivo('Caminho de arquivo fora da pasta permitida.');
  }

  return alvo;
}

/**
 * Guarda o conteúdo e registra a ficha.
 *
 * O nome no disco é sorteado, nunca o que veio de fora: nome de
 * arquivo enviado por terceiro é dado não confiável, e dois
 * fornecedores mandam "nota.pdf" na mesma semana.
 */
export async function guardarArquivo(dados: {
  conteudo: Buffer;
  nomeOriginal: string;
  tipoMime: string;
  tipo: TipoDeArquivo;
  notaFiscalId?: string | null;
  usuarioId: string;
}) {
  if (!tipoAceito(dados.tipoMime)) {
    throw new ErroDeArquivo(
      'Só aceitamos PDF e XML. Este arquivo é "' + dados.tipoMime + '".',
    );
  }

  if (dados.conteudo.length === 0) {
    throw new ErroDeArquivo('O arquivo está vazio.');
  }

  if (dados.conteudo.length > TAMANHO_MAXIMO) {
    throw new ErroDeArquivo(
      'O arquivo tem ' + (dados.conteudo.length / 1024 / 1024).toFixed(1) +
        ' MB. O limite é ' + TAMANHO_MAXIMO / 1024 / 1024 + ' MB.',
    );
  }

  const sha256 = createHash('sha256').update(dados.conteudo).digest('hex');
  const { extensao } = TIPOS_ACEITOS[dados.tipoMime];

  // Uma pasta por ano e mês: uma pasta com 50 mil arquivos fica
  // lenta de listar em qualquer sistema de arquivos.
  const agora = new Date();
  const pasta = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0');
  const caminho = pasta + '/' + sha256.slice(0, 32) + '.' + extensao;

  const destino = caminhoCompleto(caminho);
  await mkdir(join(resolve(ambiente.ARQUIVOS_DIR), pasta), { recursive: true });
  await writeFile(destino, dados.conteudo);

  // O mesmo arquivo enviado duas vezes tem o mesmo resumo e o
  // mesmo caminho: aproveitamos a ficha que já existe.
  const jaExiste = await banco.arquivo.findUnique({ where: { caminho } });
  if (jaExiste) return jaExiste;

  return banco.arquivo.create({
    data: {
      nomeOriginal: dados.nomeOriginal.slice(0, 180),
      tipoMime: dados.tipoMime,
      tamanho: dados.conteudo.length,
      tipo: dados.tipo,
      caminho,
      sha256,
      notaFiscalId: dados.notaFiscalId ?? null,
      enviadoPorId: dados.usuarioId,
    },
  });
}

/**
 * Lê o conteúdo de volta.
 *
 * Confere o resumo: arquivo trocado ou corrompido no disco vira
 * erro claro, em vez de um PDF que não abre e ninguém sabe por quê.
 */
export async function lerArquivo(id: string) {
  const ficha = await banco.arquivo.findUnique({ where: { id } });
  if (!ficha) return null;

  let conteudo: Buffer;
  try {
    conteudo = await readFile(caminhoCompleto(ficha.caminho));
  } catch {
    throw new ErroDeArquivo(
      'A ficha do arquivo existe, mas o conteúdo sumiu do disco. ' +
        'Isso acontece quando o volume de arquivos é apagado sem o banco.',
    );
  }

  const conferido = createHash('sha256').update(conteudo).digest('hex');
  if (conferido !== ficha.sha256) {
    throw new ErroDeArquivo('O arquivo no disco não confere com o que foi guardado.');
  }

  return { ficha, conteudo };
}

/** Tira a ficha e o conteúdo. */
export async function apagarArquivo(id: string) {
  const ficha = await banco.arquivo.findUnique({ where: { id } });
  if (!ficha) return false;

  // O conteúdo pode já ter sumido; isso não impede de limpar a ficha.
  await unlink(caminhoCompleto(ficha.caminho)).catch(() => {});
  await banco.arquivo.delete({ where: { id } });

  return true;
}

/** Tamanho em algo que uma pessoa lê. */
export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
