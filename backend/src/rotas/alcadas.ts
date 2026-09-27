// ============================================================
//  Limites de alçada
//
//  Responde à pergunta central da aprovação: "quem precisa
//  assinar uma compra de R$ X?"
//
//  O BPMN da Porto Inc. deixou o limite como "A definir".
//  Por isso ele virou DADO configurável em tela, e não regra
//  escrita no código: a empresa muda sem programador.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { numero, erroDeValidacao, textoObrigatorio } from '../servicos/util.js';
import { reaisBr } from '../servicos/util.js';
import { explicarAprovacao } from '../servicos/solicitacao.js';

const esquemaRegra = z.object({
  descricao: textoObrigatorio(3, 'A descrição'),
  valorMinimo: z.coerce.number().min(0),
  valorMaximo: z.coerce.number().min(0).nullable().optional(),
  exigeTodas: z.boolean().default(false),
  ordem: z.coerce.number().int().default(0),
  funcoes: z.array(z.string().uuid()).min(1, 'Escolha pelo menos uma função aprovadora.'),
});

const INCLUIR = {
  funcoes: { include: { funcao: { select: { id: true, codigo: true, nome: true } } } },
} as const;

interface RegraDoBanco {
  id: string;
  descricao: string;
  valorMinimo: unknown;
  valorMaximo: unknown;
  exigeTodas: boolean;
  ordem: number;
  ativa: boolean;
  criadaEm: Date;
  funcoes: Array<{ funcao: { id: string; codigo: string; nome: string } }>;
}

function formatar(r: RegraDoBanco) {
  return {
    id: r.id,
    descricao: r.descricao,
    valorMinimo: numero(r.valorMinimo as never) ?? 0,
    valorMaximo: numero(r.valorMaximo as never),
    exigeTodas: r.exigeTodas,
    ordem: r.ordem,
    ativa: r.ativa,
    criadaEm: r.criadaEm,
    funcoes: r.funcoes.map((f) => f.funcao),
  };
}

/**
 * Procura buracos e sobreposições entre as faixas.
 *
 * Exportada para ter prova própria. O que ela devolve é TEXTO que a
 * pessoa lê para decidir quem vai assinar uma compra — e em
 * 25/09/2026 esse texto dizia o contrário do que o sistema fazia.
 * Comportamento tinha teste; a frase, não.
 */
export function conferirCobertura(
  faixas: Array<{ valorMinimo: number; valorMaximo: number | null; descricao: string }>,
): string[] {
  const avisos: string[] = [];
  const ordenadas = [...faixas].sort((a, b) => a.valorMinimo - b.valorMinimo);

  if (ordenadas.length === 0) return ['Nenhuma faixa ativa: nada poderá ser aprovado.'];

  if (ordenadas[0].valorMinimo > 0) {
    avisos.push(
      'Compras abaixo de ' + reaisBr(ordenadas[0].valorMinimo) +
      ' não caem em nenhuma faixa e ficariam sem aprovador.',
    );
  }

  for (let i = 0; i < ordenadas.length - 1; i++) {
    const atual = ordenadas[i];
    const proxima = ordenadas[i + 1];

    if (atual.valorMaximo === null) {
      avisos.push(
        'A faixa "' + atual.descricao + '" não tem teto, então as faixas acima dela nunca serão usadas.',
      );
      break;
    }

    // Encostadas e o certo agora: o teto de uma e o piso da outra.
    // So ha vao se a proxima comecar DEPOIS do teto da anterior.
    if (proxima.valorMinimo > atual.valorMaximo) {
      avisos.push(
        'Há um vão entre ' + reaisBr(atual.valorMaximo) +
        ' e ' + reaisBr(proxima.valorMinimo) + ': nada seria aprovado nessa faixa.',
      );
    }

    if (proxima.valorMinimo < atual.valorMaximo) {
      // "MAIOR", e não "menor", como este aviso dizia até 25/09/2026.
      //
      // Quem decide é `acharFaixa`, que ordena por mínimo decrescente
      // e fica com a primeira — a de maior mínimo. O aviso dizia o
      // contrário, e o erro não era só de redação: numa compra de
      // exatamente R$ 5.000, com faixas 0–5.000 e 5.000–50.000, ele
      // fazia a pessoa esperar UMA assinatura quando o sistema ia
      // exigir DUAS.
      //
      // A regra em si está certa: no encontro de duas faixas vale a
      // mais exigente. Quem estava errado era o texto.
      avisos.push(
        'As faixas "' + atual.descricao + '" e "' + proxima.descricao +
        '" se sobrepõem em ' + reaisBr(proxima.valorMinimo) +
        '. Nesse valor vale a faixa de MAIOR mínimo — "' + proxima.descricao +
        '". Para não deixar dúvida, comece a próxima faixa um centavo acima.',
      );
    }
  }

  if (ordenadas.at(-1)?.valorMaximo !== null) {
    avisos.push('Nenhuma faixa cobre valores muito altos: a última faixa deveria ficar sem teto.');
  }

  return avisos;
}

export async function rotasAlcadas(app: FastifyInstance) {
  // --------------------------------------------------------
  //  Listar faixas
  // --------------------------------------------------------
  app.get('/api/alcadas', { preHandler: app.exigirPermissao('alcadas.gerenciar', 'solicitacoes.aprovar') }, async () => {
    const regras = await banco.regraAlcada.findMany({
      include: INCLUIR,
      orderBy: [{ ordem: 'asc' }, { valorMinimo: 'asc' }],
    });

    const formatadas = regras.map(formatar);

    return {
      regras: formatadas,
      avisos: conferirCobertura(
        formatadas
          .filter((r) => r.ativa)
          .map((r) => ({
            valorMinimo: r.valorMinimo,
            valorMaximo: r.valorMaximo,
            descricao: r.descricao,
          })),
      ),
    };
  });

  // --------------------------------------------------------
  //  Simular: quem aprova uma compra de R$ X?
  //
  //  Vale mais que qualquer explicação: a pessoa digita o valor
  //  e vê na hora quem vai precisar assinar.
  // --------------------------------------------------------
  app.get('/api/alcadas/simular', { preHandler: app.exigirPermissao('alcadas.gerenciar', 'solicitacoes.aprovar') }, async (req, res) => {
    const consulta = z
      .object({ valor: z.coerce.number().min(0) })
      .safeParse(req.query);

    if (!consulta.success) {
      return res.status(400).send({ erro: 'Informe um valor. Ex: /api/alcadas/simular?valor=5000' });
    }

    const { valor } = consulta.data;

    const regra = await banco.regraAlcada.findFirst({
      where: {
        ativa: true,
        valorMinimo: { lte: valor },
        // `gt`, e nao `gte`: o teto nao entra na faixa. Tem de casar
        // com `acharFaixa`, senao o simulador prometeria um aprovador
        // e a solicitacao exigiria outro.
        OR: [{ valorMaximo: null }, { valorMaximo: { gt: valor } }],
      },
      include: INCLUIR,
      orderBy: { valorMinimo: 'desc' },
    });

    if (!regra) {
      return {
        valor,
        encontrada: false,
        mensagem:
          'Nenhuma faixa cobre este valor. Ajuste os limites em Cadastros > Limites de alçada.',
      };
    }

    // A frase sai do MESMO lugar que a da solicitação. Estava
    // escrita duas vezes, e o simulador ia acabar dizendo uma coisa
    // e a solicitação outra na hora em que alguém mexesse em uma só.
    const regraFormatada = formatar(regra);

    return {
      valor,
      encontrada: true,
      regra: regraFormatada,
      explicacao: explicarAprovacao(regraFormatada),
    };
  });

  // --------------------------------------------------------
  //  Criar faixa
  // --------------------------------------------------------
  app.post('/api/alcadas', { preHandler: app.exigirPermissao('alcadas.gerenciar') }, async (req, res) => {
    const dados = esquemaRegra.safeParse(req.body);
    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    if (
      dados.data.valorMaximo !== null &&
      dados.data.valorMaximo !== undefined &&
      dados.data.valorMaximo <= dados.data.valorMinimo
    ) {
      return res.status(400).send({ erro: 'O valor máximo precisa ser maior que o mínimo.' });
    }

    const { funcoes, ...resto } = dados.data;

    const regra = await banco.regraAlcada.create({
      data: {
        ...resto,
        valorMaximo: resto.valorMaximo ?? null,
        funcoes: { create: funcoes.map((funcaoId) => ({ funcaoId })) },
      },
      include: INCLUIR,
    });

    return res.status(201).send({ regra: formatar(regra) });
  });

  // --------------------------------------------------------
  //  Editar faixa
  // --------------------------------------------------------
  app.patch('/api/alcadas/:id', { preHandler: app.exigirPermissao('alcadas.gerenciar') }, async (req, res) => {
    const { id } = req.params as { id: string };
    const dados = esquemaRegra.partial().extend({ ativa: z.boolean().optional() }).safeParse(req.body);
    if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

    if (!(await banco.regraAlcada.findUnique({ where: { id } }))) {
      return res.status(404).send({ erro: 'Faixa não encontrada.' });
    }

    const { funcoes, ...resto } = dados.data;

    const regra = await banco.regraAlcada.update({
      where: { id },
      data: {
        ...resto,
        ...(funcoes
          ? { funcoes: { deleteMany: {}, create: funcoes.map((funcaoId) => ({ funcaoId })) } }
          : {}),
      },
      include: INCLUIR,
    });

    return { regra: formatar(regra) };
  });
}
