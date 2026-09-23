// ============================================================
//  O único lugar que escreve no estoque
//
//  Tanto o recebimento (entrada automática) quanto a tela de
//  estoque (retirada, ajuste, transferência) passam por aqui.
//  Manter uma porta só evita o pior defeito possível num
//  almoxarifado: dois caminhos calculando saldo de formas
//  diferentes.
// ============================================================

import type { Prisma } from '@prisma/client';
import { numero } from './util.js';
import { aplicarMovimento, type TipoMovimento } from './estoque.js';

/** O cliente do Prisma dentro de uma transação. */
type Transacao = Prisma.TransactionClient;

export interface DadosDoMovimento {
  almoxarifadoId: string;
  materialId: string;
  usuarioId: string;
  tipo: TipoMovimento;
  /** No ajuste vem com sinal; nos demais, sempre positiva. */
  quantidade: number;
  valorUnitario?: number | null;
  recebimentoItemId?: string | null;
  destino?: string | null;
  observacao?: string | null;
}

export interface MovimentoGravado {
  id: string;
  numero: number;
  saldoDepois: number;
}

/**
 * Grava um movimento e atualiza a fotografia do saldo.
 *
 * Precisa rodar dentro de uma transação: ler o saldo, calcular e
 * gravar são três passos que não podem ser separados, senão duas
 * retiradas ao mesmo tempo podem gravar o mesmo saldo final.
 */
export async function movimentar(
  tx: Transacao,
  dados: DadosDoMovimento,
): Promise<MovimentoGravado> {
  const saldo = await tx.saldoEstoque.findUnique({
    where: {
      almoxarifadoId_materialId: {
        almoxarifadoId: dados.almoxarifadoId,
        materialId: dados.materialId,
      },
    },
  });

  const estadoAtual = {
    quantidade: numero(saldo?.quantidade) ?? 0,
    custoMedio: numero(saldo?.custoMedio) ?? null,
  };

  const novo = aplicarMovimento(
    estadoAtual,
    dados.tipo,
    dados.quantidade,
    dados.valorUnitario ?? null,
  );

  const movimento = await tx.movimentoEstoque.create({
    data: {
      almoxarifadoId: dados.almoxarifadoId,
      materialId: dados.materialId,
      usuarioId: dados.usuarioId,
      tipo: dados.tipo,
      quantidade: dados.quantidade,
      saldoDepois: novo.quantidade,
      valorUnitario: dados.valorUnitario ?? null,
      recebimentoItemId: dados.recebimentoItemId ?? null,
      destino: dados.destino ?? null,
      observacao: dados.observacao ?? null,
    },
    select: { id: true, numero: true },
  });

  await tx.saldoEstoque.upsert({
    where: {
      almoxarifadoId_materialId: {
        almoxarifadoId: dados.almoxarifadoId,
        materialId: dados.materialId,
      },
    },
    create: {
      almoxarifadoId: dados.almoxarifadoId,
      materialId: dados.materialId,
      quantidade: novo.quantidade,
      custoMedio: novo.custoMedio,
    },
    update: {
      quantidade: novo.quantidade,
      custoMedio: novo.custoMedio,
    },
  });

  return { id: movimento.id, numero: movimento.numero, saldoDepois: novo.quantidade };
}

/**
 * Repete a transação quando o banco recusa por conflito.
 *
 * O saldo é lido e gravado dentro de uma transação Serializable,
 * que é o nível mais rígido: se dois movimentos do mesmo material
 * acontecem no mesmo instante, o Postgres cancela um dos dois em
 * vez de gravar saldo errado.
 *
 * O cancelado não é um erro do usuário — é só "tente de novo".
 * Por isso o sistema tenta sozinho, em vez de mostrar uma falha
 * para quem só quis dar baixa em três sacos de cimento.
 */
export async function comRepeticao<T>(
  executar: () => Promise<T>,
  tentativas = 3,
): Promise<T> {
  let ultimoErro: unknown;

  for (let i = 0; i < tentativas; i++) {
    try {
      return await executar();
    } catch (erro) {
      if (!ehConflitoDeTransacao(erro)) throw erro;

      ultimoErro = erro;
      // Espera um pouquinho crescente para os dois não voltarem
      // a colidir no mesmo milissegundo.
      await new Promise((seguir) => setTimeout(seguir, 25 * (i + 1)));
    }
  }

  throw ultimoErro;
}

/** P2034 é o código do Prisma para conflito/deadlock de transação. */
function ehConflitoDeTransacao(erro: unknown): boolean {
  const codigo = (erro as { code?: string })?.code;
  return codigo === 'P2034' || codigo === '40001' || codigo === '40P01';
}

/** O saldo de um material num almoxarifado, agora. */
export async function saldoDe(
  tx: Transacao,
  almoxarifadoId: string,
  materialId: string,
): Promise<number> {
  const saldo = await tx.saldoEstoque.findUnique({
    where: { almoxarifadoId_materialId: { almoxarifadoId, materialId } },
  });

  return numero(saldo?.quantidade) ?? 0;
}
