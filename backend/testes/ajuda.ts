// ============================================================
//  Apoio para os testes de integração
//
//  Estes testes exercitam a API de verdade (rotas, validações,
//  permissões e banco), mas SEM abrir porta de rede: usamos o
//  app.inject() do Fastify, que chama a rota direto.
//
//  Rodam contra um banco separado (portoink_test), então nunca
//  tocam nos dados de desenvolvimento.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { criarApp } from '../src/app.js';
import { banco } from '../src/plugins/banco.js';
import { gerarHash } from '../src/servicos/senha.js';

export const SENHA_TESTE = 'Teste@2026';

let appCache: FastifyInstance | null = null;

export async function pegarApp(): Promise<FastifyInstance> {
  if (!appCache) {
    appCache = await criarApp();
    await appCache.ready();
  }
  return appCache;
}

export async function encerrar(): Promise<void> {
  if (appCache) await appCache.close();
  await banco.$disconnect();
}

/**
 * Trava de segurança.
 *
 * Os testes APAGAM tudo antes de rodar. Se alguém executar um
 * arquivo de teste sem as variáveis que apontam para o banco de
 * teste (por exemplo `npx tsx --test testes/x.test.ts` em vez de
 * `npm test`), o alvo vira o banco de desenvolvimento e o dia de
 * trabalho vai embora.
 *
 * Por isso conferimos o nome do banco antes de qualquer TRUNCATE.
 */
async function conferirBancoDeTeste(): Promise<void> {
  const [linha] = await banco.$queryRaw<Array<{ db: string }>>`
    SELECT current_database() AS db
  `;

  if (!linha?.db?.endsWith('_test')) {
    throw new Error(
      'RECUSADO: os testes apagam dados e este banco nao e de teste (' +
        (linha?.db ?? 'desconhecido') +
        '). Rode com "npm test", que aponta para o portoink_test.',
    );
  }
}

/**
 * Apaga os dados de teste, preservando o que vem das migrações
 * (funções, permissões e faixas de alçada padrão).
 */
export async function limparDados(): Promise<void> {
  await conferirBancoDeTeste();

  await banco.$executeRawUnsafe(`
    TRUNCATE TABLE
      -- O assistente do WhatsApp, acrescentado em 14/10/2026. Sem
      -- estas tres, um teste que cria grupo ou liga o cerebro
      -- deixa o rastro para o proximo — e o proximo quebra por
      -- chave repetida, sozinho, sem ninguem ter mexido nele.
      mensagens_whatsapp,
      grupos_whatsapp,
      configuracao_ia,
      lancamentos_financeiros,
      sessoes,
      usuarios_funcoes,
      usuarios,
      linhas_orcamento,
      almoxarifados,
      obras,
      materiais,
      fornecedores_familias,
      contatos_fornecedor,
      fornecedores,
      familias_material
    RESTART IDENTITY CASCADE
  `);
}

/** Cria um usuário com as funções indicadas e devolve o id. */
export async function criarUsuarioTeste(
  email: string,
  codigosFuncao: string[],
): Promise<string> {
  const funcoes = await banco.funcao.findMany({
    where: { codigo: { in: codigosFuncao } },
  });

  const usuario = await banco.usuario.create({
    data: {
      nome: 'Usuário ' + email,
      email,
      senhaHash: await gerarHash(SENHA_TESTE),
      ativo: true,
      funcoes: { create: funcoes.map((f) => ({ funcaoId: f.id })) },
    },
  });

  return usuario.id;
}

/**
 * Entra no sistema e devolve o crachá para usar nas chamadas.
 *
 * A senha é opcional porque quase toda conta de teste usa a
 * padrão. A exceção nasceu com a trava da senha provisória: ali
 * a conta entra com a senha que o administrador digitou, e
 * depois com a que ela mesma criou.
 */
export async function entrarComo(email: string, senha = SENHA_TESTE): Promise<string> {
  const app = await pegarApp();

  const resposta = await app.inject({
    method: 'POST',
    url: '/api/autenticacao/entrar',
    payload: { email, senha },
  });

  if (resposta.statusCode !== 200) {
    throw new Error('Falha ao entrar como ' + email + ': ' + resposta.body);
  }

  return resposta.json().token as string;
}

interface OpcoesChamada {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string;
  corpo?: unknown;
}

/** Atalho para chamar uma rota da API dentro do teste. */
export async function chamar(caminho: string, opcoes: OpcoesChamada = {}) {
  const app = await pegarApp();
  const { metodo = 'GET', token, corpo } = opcoes;

  const resposta = await app.inject({
    method: metodo,
    url: caminho,
    headers: token ? { authorization: 'Bearer ' + token } : {},
    payload: corpo as never,
  });

  // Nem toda resposta é JSON: o PDF, por exemplo, vem binário.
  let conteudo: unknown = null;

  if (resposta.body) {
    try {
      conteudo = JSON.parse(resposta.body);
    } catch {
      conteudo = resposta.body;
    }
  }

  return {
    status: resposta.statusCode,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    corpo: conteudo as any,
    tipo: String(resposta.headers['content-type'] ?? ''),
    tamanho: resposta.rawPayload?.length ?? 0,
    /** Bytes como vieram. PDF e Word não são texto. */
    bruto: resposta.rawPayload,
    anexo: String(resposta.headers['content-disposition'] ?? ''),
    cookies: resposta.cookies,
  };
}
