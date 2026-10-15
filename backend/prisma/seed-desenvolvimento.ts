// ============================================================
//  Contas de teste - APENAS DESENVOLVIMENTO
//
//  ATENÇÃO: este arquivo cria usuários com senha conhecida.
//  Ele se recusa a rodar quando NODE_ENV=production.
//
//  Na instalação real, o Administrador é criado pelo instalador
//  e obrigado a definir a própria senha no primeiro acesso.
// ============================================================

import { PrismaClient } from '@prisma/client';
import { hash, Algorithm } from '@node-rs/argon2';

const banco = new PrismaClient();

const SENHA_PADRAO = 'admin123';

/** Nomes reais citados na reunião: ajuda a testar pensando nas pessoas. */
const PESSOAS: Array<{
  nome: string;
  email: string;
  funcoes: string[];
  /** Senha só desta conta. Sem isto, vale a SENHA_PADRAO. */
  senha?: string;
}> = [
  {
    nome: 'Administrador do Sistema',
    email: 'admin@portoinc.com.br',
    funcoes: ['ADMINISTRADOR'],
  },
  {
    nome: 'Washington',
    email: 'washington@portoinc.com.br',
    funcoes: ['FUNDADOR'],
  },
  {
    nome: 'Andre',
    email: 'andre@portoinc.com.br',
    funcoes: ['COMPRADOR'],
  },
  {
    nome: 'Bras',
    email: 'bras@portoinc.com.br',
    // Exemplo de usuário com DUAS funções, como a reunião pediu.
    funcoes: ['GESTOR_OBRA', 'SOLICITANTE'],
  },
  {
    nome: 'Gilson',
    email: 'gilson@portoinc.com.br',
    funcoes: ['ALMOXARIFE'],
  },
  {
    nome: 'Neilma',
    email: 'neilma@portoinc.com.br',
    funcoes: ['COMPRADOR', 'SOLICITANTE'],
  },
  {
    nome: 'Engenheiro de Obra',
    email: 'engenheiro@portoinc.com.br',
    funcoes: ['ENGENHEIRO'],
  },

  // ----------------------------------------------------------
  //  A conta de desenvolvimento
  //
  //  Existe para ENXERGAR o sistema inteiro de uma vez, sem
  //  trocar de conta a cada tela. Carrega as SETE funções, e não
  //  só a de administrador — a diferença importa:
  //
  //    - "Administrador" dá acesso às TELAS;
  //    - assinar aprovação depende de estar numa FAIXA DE ALÇADA,
  //      e as faixas citam Gestor de obra, Engenheiro e Fundador.
  //
  //  Por isso o administrador via a fila de Aprovações vazia: ele
  //  tem a tela, mas não é signatário de nada. Com as sete de
  //  papel, o DEV vê a fila cheia — que é o ponto de uma conta de
  //  diagnóstico. Mais a de DESENVOLVEDOR, que abre "Status do
  //  sistema": são oito.
  //
  //  NÃO vai para produção: este arquivo inteiro se recusa a rodar
  //  quando NODE_ENV é 'production' (ver `principal()`).
  // ----------------------------------------------------------
  {
    nome: 'DEV-Porto',
    email: 'porto@dev.com',
    funcoes: [
      // DESENVOLVEDOR É O QUE ABRE "STATUS DO SISTEMA".
      //
      // Ele estava faltando, e o guia de navegação prometia o
      // contrário: "uma tela só existe nela". Numa instalação
      // nova a conta DEV abria a tela de acesso negado — e a tela
      // de Usuários recusa atribuir este papel de propósito, o
      // que deixava o sistema sem ninguém capaz de abri-la.
      //
      // Achado na simulação de entrega de 09/10/2026.
      'DESENVOLVEDOR',
      'ADMINISTRADOR',
      'FUNDADOR',
      'GESTOR_OBRA',
      'ENGENHEIRO',
      'COMPRADOR',
      'SOLICITANTE',
      'ALMOXARIFE',
    ],
  },
];

async function principal() {
  if (process.env.NODE_ENV === 'production') {
    console.log('  [seed] Ambiente de produção: contas de teste NÃO serão criadas.');
    return;
  }

  const embaralhar = (senha: string) =>
    hash(senha, {
      algorithm: Algorithm.Argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

  const senhaHash = await embaralhar(SENHA_PADRAO);

  const funcoes = await banco.funcao.findMany();
  const porCodigo = new Map(funcoes.map((f) => [f.codigo, f.id]));

  let criados = 0;
  let existentes = 0;

  for (const pessoa of PESSOAS) {
    const ja = await banco.usuario.findUnique({ where: { email: pessoa.email } });

    if (ja) {
      existentes++;
      continue;
    }

    const idsFuncoes = pessoa.funcoes
      .map((codigo) => porCodigo.get(codigo))
      .filter((id): id is string => Boolean(id));

    await banco.usuario.create({
      data: {
        nome: pessoa.nome,
        email: pessoa.email,
        senhaHash: pessoa.senha ? await embaralhar(pessoa.senha) : senhaHash,
        ativo: true,
        // Em teste não forçamos troca: atrapalharia a validação.
        precisaTrocarSenha: false,
        funcoes: { create: idsFuncoes.map((funcaoId) => ({ funcaoId })) },
      },
    });

    criados++;
  }

  console.log('');
  console.log('  [seed] Contas de teste: ' + criados + ' criadas, ' + existentes + ' já existiam.');
  if (criados > 0) {
    console.log('  [seed] Senha de todas: ' + SENHA_PADRAO);
  }
  console.log('');
}

principal()
  .catch((erro) => {
    console.error('  [seed] Falhou:', erro);
    process.exit(1);
  })
  .finally(() => banco.$disconnect());
