// ============================================================
//  UMA de cada, para a tela não abrir vazia
//
//  Diferente do `seed-historico.ts`, que fabrica MESES de compras
//  para os relatórios terem curva. Este faz o contrário: cria o
//  mínimo para quem apresenta não encontrar tela em branco, e
//  deixa o resto para ser feito ao vivo.
//
//  Nasceu em 12/10/2026, para a apresentação ao cliente. O pedido
//  foi literal: "deixe 1 solicitação, 1 aprovação, 1 cotação já
//  prontas, o restante eu vou fazer".
//
//  O QUE ELE CRIA, nesta ordem e passando pela API — nunca
//  escrevendo no banco direto, para a numeração, a alçada e o
//  estoque saírem do mesmo lugar de sempre:
//
//    1. uma solicitação de compra, com 2 itens da mesma família;
//    2. as assinaturas que a alçada exigir, até ela ficar aprovada;
//    3. um pacote de cotação aberto, com 3 fornecedores convidados.
//
//  O QUE ELE NÃO FAZ, e isso é o ponto:
//
//    · não responde a cotação pelos fornecedores — a equalização
//      é o momento que mais impressiona, e quem apresenta quer
//      mostrá-la acontecendo;
//    · NÃO ENVIA NADA. Nenhum WhatsApp, nenhum e-mail. Convidar
//      fornecedor aqui é só registrar quem foi chamado; o envio
//      é outro botão, e ele continua sendo só de quem clica.
//
//  Rode com:  npm run seed:demonstracao
//
//  Recusa-se a rodar com cotação já no banco: duas iguais na
//  tela confundem quem apresenta.
// ============================================================

import { PrismaClient } from '@prisma/client';

const banco = new PrismaClient();
const BASE = process.env.API_URL ?? 'http://localhost:3000';
const SENHA = 'admin123';

const SOLICITANTE = 'neilma@portoinc.com.br';
const COMPRADOR = 'andre@portoinc.com.br';

//  A alçada decide quantas assinaturas são necessárias. Em vez de
//  adivinhar a faixa, oferecemos a cada aprovador e paramos quando
//  a solicitação sai da fila.
const APROVADORES = [
  'bras@portoinc.com.br',
  'engenheiro@portoinc.com.br',
  'washington@portoinc.com.br',
];

const tokens = new Map<string, string>();

async function entrar(email: string): Promise<string> {
  const guardado = tokens.get(email);
  if (guardado) return guardado;

  const r = await fetch(BASE + '/api/autenticacao/entrar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, senha: SENHA }),
  });

  if (!r.ok) throw new Error('Não consegui entrar como ' + email + ' (' + r.status + ')');

  const corpo = (await r.json()) as { token: string };
  tokens.set(email, corpo.token);
  return corpo.token;
}

async function chamar(
  caminho: string,
  opcoes: { metodo?: string; email?: string; corpo?: unknown } = {},
) {
  const cabecalhos: Record<string, string> = { 'content-type': 'application/json' };
  if (opcoes.email) cabecalhos.authorization = 'Bearer ' + (await entrar(opcoes.email));

  const r = await fetch(BASE + caminho, {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  });

  const texto = await r.text();
  //  `any` aqui e deliberado: e um script de semente que fala com
  //  a propria API e le campos variados. Tipar cada resposta seria
  //  reescrever o sistema inteiro em duplicata.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const corpo: any = texto ? JSON.parse(texto) : {};

  if (!r.ok) {
    throw new Error(
      'Falhou ' + (opcoes.metodo ?? 'GET') + ' ' + caminho + ' (' + r.status + '): ' +
      (corpo.erro ?? texto.slice(0, 200)),
    );
  }

  return corpo;
}

function emDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

/** Só a data, no formato que a rota aceita (AAAA-MM-DD). */
function diaEmDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function principal() {
  if (process.env.NODE_ENV === 'production') {
    console.log('  [demonstracao] Produção: nada foi criado.');
    return;
  }

  await chamar('/health');

  if ((await banco.bid.count()) > 0) {
    console.log('  [demonstracao] Já existe cotação no banco. Nada a fazer.');
    return;
  }

  // ---------- De onde sai a compra ----------
  const obra = await banco.obra.findFirst({
    where: { situacao: 'EM_ANDAMENTO' },
    orderBy: { codigo: 'asc' },
  });
  if (!obra) throw new Error('Nenhuma obra em andamento. Rode o seed de cadastros antes.');

  //  Uma família só, e com fornecedor que a atenda: o pacote de
  //  cotação agrupa por família, e família sem fornecedor deixa a
  //  tela de convite vazia — exatamente o que não pode acontecer
  //  no meio de uma apresentação.
  //  A FAMILIA COM MAIS FORNECEDORES, nao a primeira do alfabeto.
  //
  //  A equalizacao e a tela que mais impressiona, e ela so
  //  impressiona com concorrencia: duas colunas comparam, tres ja
  //  mostram o melhor preco pulando de fornecedor item a item.
  const candidatas = await banco.familiaMaterial.findMany({
    where: {
      materiais: { some: { tipo: 'MATERIAL' } },
      fornecedores: { some: {} },
    },
    include: { _count: { select: { fornecedores: true, materiais: true } } },
  });

  const familia = candidatas
    .filter((f) => f._count.materiais >= 2)
    .sort((a, b) => b._count.fornecedores - a._count.fornecedores)[0]
    ?? candidatas.sort((a, b) => b._count.fornecedores - a._count.fornecedores)[0];

  if (!familia) throw new Error('Nenhuma familia tem material e fornecedor ao mesmo tempo.');

  const materiais = await banco.material.findMany({
    where: { familiaId: familia.id, tipo: 'MATERIAL' },
    orderBy: { codigoInterno: 'asc' },
    take: 2,
  });

  const fornecedores = await banco.fornecedor.findMany({
    where: { familias: { some: { familiaId: familia.id } } },
    orderBy: { nomeFantasia: 'asc' },
    take: 3,
  });

  // ---------- 1. A solicitação ----------
  const criada = await chamar('/api/solicitacoes', {
    metodo: 'POST', email: SOLICITANTE,
    corpo: {
      obraId: obra.id,
      //  SEM PRAZO A SOLICITACAO NAO SAI DO RASCUNHO.
      //
      //  E regra do fluxo de compras, e ela existe porque e esse
      //  prazo que poe a solicitacao na frente da fila de quem
      //  assina. A rota aceita so a data, sem a hora.
      dataDesejada: diaEmDias(15),
      justificativa:
        'Reposição para a concretagem da semana. Material programado no cronograma da obra.',
      itens: materiais.map((m, i) => ({
        materialId: m.id,
        quantidade: i === 0 ? 300 : 150,
        valorEstimado: i === 0 ? 34 : 28,
        especificacaoTecnica: 'Conforme norma técnica do material.',
      })),
    },
  });

  const solicitacaoId = criada.solicitacao.id as string;
  console.log('  [demonstracao] Solicitação criada em ' + obra.nome + '.');

  await chamar('/api/solicitacoes/' + solicitacaoId + '/enviar', {
    metodo: 'POST', email: SOLICITANTE,
  });

  // ---------- 2. As assinaturas ----------
  let assinaturas = 0;

  for (const quem of APROVADORES) {
    const atual = await banco.solicitacao.findUnique({
      where: { id: solicitacaoId },
      select: { situacao: true },
    });
    if (atual?.situacao !== 'AGUARDANDO_APROVACAO') break;

    try {
      await chamar('/api/aprovacoes/' + solicitacaoId + '/decidir', {
        metodo: 'POST', email: quem,
        corpo: { decisao: 'APROVADA', observacao: 'Aprovado conforme planejamento da obra.' },
      });
      assinaturas += 1;
    } catch {
      //  Aprovador fora da faixa recebe 403. Não é erro: é a alçada
      //  funcionando. Seguimos para o próximo da lista.
    }
  }

  const depois = await banco.solicitacao.findUnique({
    where: { id: solicitacaoId },
    select: { situacao: true },
  });

  if (depois?.situacao !== 'APROVADA') {
    throw new Error('A solicitação parou em ' + depois?.situacao + ' e não virou cotação.');
  }

  console.log('  [demonstracao] Aprovada com ' + assinaturas + ' assinatura(s).');

  // ---------- 3. A cotação ----------
  const detalhe = await chamar('/api/solicitacoes/' + solicitacaoId, { email: SOLICITANTE });
  const idsDosItens = detalhe.solicitacao.itens.map((i: { id: string }) => i.id);

  const bid = await chamar('/api/cotacoes', {
    metodo: 'POST', email: COMPRADOR,
    corpo: {
      titulo: familia.nome + ' — ' + obra.nome,
      prazoResposta: emDias(7),
      itens: idsDosItens,
    },
  });

  const bidId = bid.cotacao.id as string;

  await chamar('/api/cotacoes/' + bidId + '/fornecedores', {
    metodo: 'POST', email: COMPRADOR,
    corpo: { fornecedores: fornecedores.map((f) => f.id) },
  });

  await chamar('/api/cotacoes/' + bidId + '/abrir', { metodo: 'POST', email: COMPRADOR });

  console.log(
    '  [demonstracao] Cotação aberta com ' + fornecedores.length + ' fornecedores: ' +
    fornecedores.map((f) => f.nomeFantasia).join(', ') + '.',
  );
  console.log('  [demonstracao] Nenhuma mensagem foi enviada.');
}

principal()
  .catch((e) => {
    console.error('  [demonstracao] Falhou: ' + (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => banco.$disconnect());
