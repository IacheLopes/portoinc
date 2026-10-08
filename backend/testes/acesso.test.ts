// ============================================================
//  Testes da Etapa 1 - Acesso ao sistema
//
//  Estes testes existem para garantir que nenhuma mudança
//  futura abra uma porta que deveria estar fechada.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar, SENHA_TESTE,
} from './ajuda.js';

before(async () => {
  await limparDados();
  await criarUsuarioTeste('admin@teste.com.br', ['ADMINISTRADOR']);
  await criarUsuarioTeste('almoxarife@teste.com.br', ['ALMOXARIFE']);
  await criarUsuarioTeste('gestor@teste.com.br', ['GESTOR_OBRA', 'SOLICITANTE']);
});

after(encerrar);

describe('Entrada no sistema', () => {
  it('entra com dados corretos e recebe o crachá', async () => {
    const r = await chamar('/api/autenticacao/entrar', {
      metodo: 'POST',
      corpo: { email: 'admin@teste.com.br', senha: SENHA_TESTE },
    });

    assert.equal(r.status, 200);
    assert.ok(r.corpo.token, 'deveria vir um token');
    assert.equal(r.corpo.usuario.email, 'admin@teste.com.br');
    // A senha nunca pode aparecer na resposta.
    assert.equal(JSON.stringify(r.corpo).includes('senha'), false);
  });

  it('recusa senha errada', async () => {
    const r = await chamar('/api/autenticacao/entrar', {
      metodo: 'POST',
      corpo: { email: 'admin@teste.com.br', senha: 'errada' },
    });

    assert.equal(r.status, 401);
  });

  it('dá a MESMA resposta para e-mail inexistente', async () => {
    // Se a mensagem fosse diferente, um invasor descobriria
    // quais e-mails existem na empresa.
    const errada = await chamar('/api/autenticacao/entrar', {
      metodo: 'POST',
      corpo: { email: 'admin@teste.com.br', senha: 'errada' },
    });

    const inexistente = await chamar('/api/autenticacao/entrar', {
      metodo: 'POST',
      corpo: { email: 'ninguem@teste.com.br', senha: SENHA_TESTE },
    });

    assert.equal(errada.status, inexistente.status);
    assert.equal(errada.corpo.erro, inexistente.corpo.erro);
  });

  it('recusa e-mail mal formatado', async () => {
    const r = await chamar('/api/autenticacao/entrar', {
      metodo: 'POST',
      corpo: { email: 'nao-e-email', senha: SENHA_TESTE },
    });

    assert.equal(r.status, 400);
  });

  it('guarda a sessão num cookie protegido contra scripts', async () => {
    const r = await chamar('/api/autenticacao/entrar', {
      metodo: 'POST',
      corpo: { email: 'admin@teste.com.br', senha: SENHA_TESTE },
    });

    const cookie = r.cookies.find((c) => c.name === 'portoink_sessao');
    assert.ok(cookie, 'o cookie de sessão deveria existir');
    assert.equal(cookie?.httpOnly, true, 'JavaScript da página não pode lê-lo');
  });
});

describe('Rotas protegidas', () => {
  it('barra quem não entrou no sistema', async () => {
    for (const rota of ['/api/status', '/api/usuarios', '/api/obras', '/api/materiais']) {
      const r = await chamar(rota);
      assert.equal(r.status, 401, rota + ' deveria exigir login');
    }
  });

  it('barra crachá inventado', async () => {
    const r = await chamar('/api/status', { token: 'nao-e-um-token-de-verdade' });
    assert.equal(r.status, 401);
  });

  it('deixa passar quem entrou', async () => {
    // Era `/api/status` aqui. Deixou de servir em 08/10/2026,
    // quando o diagnóstico passou a ser só do desenvolvedor: o
    // administrador leva 403, e o teste mediria a permissão nova
    // em vez do crachá, que é o assunto deste bloco.
    const token = await entrarComo('admin@teste.com.br');
    const r = await chamar('/api/usuarios', { token });

    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.corpo.usuarios));
  });

  it('/health continua aberto, pois é o Docker que consulta', async () => {
    const r = await chamar('/health');
    assert.equal(r.status, 200);
  });
});

describe('Permissões', () => {
  it('almoxarife não vê a lista de usuários', async () => {
    const token = await entrarComo('almoxarife@teste.com.br');
    const r = await chamar('/api/usuarios', { token });

    assert.equal(r.status, 403);
    assert.ok(r.corpo.permissaoNecessaria.includes('usuarios.ver'));
  });

  it('almoxarife consulta material, que é função dele', async () => {
    const token = await entrarComo('almoxarife@teste.com.br');
    const r = await chamar('/api/materiais', { token });

    assert.equal(r.status, 200);
  });

  it('administrador vê tudo', async () => {
    const token = await entrarComo('admin@teste.com.br');

    for (const rota of ['/api/usuarios', '/api/obras', '/api/materiais', '/api/fornecedores']) {
      const r = await chamar(rota, { token });
      assert.equal(r.status, 200, rota + ' deveria estar liberada para o admin');
    }
  });

  it('soma as permissões de quem tem mais de uma função', async () => {
    const token = await entrarComo('gestor@teste.com.br');
    const r = await chamar('/api/autenticacao/eu', { token });

    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.usuario.funcoes.sort(), ['GESTOR_OBRA', 'SOLICITANTE']);
    // Vem do Gestor de obra:
    assert.ok(r.corpo.usuario.permissoes.includes('solicitacoes.aprovar'));
    // Vem do Solicitante:
    assert.ok(r.corpo.usuario.permissoes.includes('solicitacoes.criar'));
  });
});

// ------------------------------------------------------------
//  A tela de diagnóstico não é de quem usa o sistema
//
//  "Status do sistema" mostra memória da API, estado do banco e
//  QUAIS INTEGRAÇÕES AINDA SÃO SIMULADAS. Para o dono da obra ela
//  só denuncia o que é maquete — ele pediu, em 08/10/2026, que
//  ficasse só na conta de desenvolvimento: "as outras contas não
//  podem ver de maneira nenhuma".
//
//  Esconder do menu não bastava, e tirar a permissão do
//  ADMINISTRADOR também não: a conta de desenvolvimento é
//  administradora e perderia junto. A permissão mudou de casa,
//  para a função DESENVOLVEDOR, que não se atribui pela tela.
// ------------------------------------------------------------
describe('O diagnóstico do sistema é só do desenvolvedor', () => {
  it('o administrador NÃO enxerga o status do sistema', async () => {
    const token = await entrarComo('admin@teste.com.br');
    const eu = await chamar('/api/autenticacao/eu', { token });

    assert.ok(
      !eu.corpo.usuario.permissoes.includes('sistema.status'),
      'o administrador ainda tem sistema.status',
    );
  });

  it('a rota do status barra o administrador', async () => {
    // A permissão some do crachá, mas o que vale é a porta: se a
    // rota continuasse aberta, bastava digitar o endereço.
    const token = await entrarComo('admin@teste.com.br');
    const r = await chamar('/api/status', { token });

    assert.equal(r.status, 403, 'o administrador ainda entra na tela de diagnóstico');
  });

  it('a função do desenvolvedor não aparece na lista de funções', async () => {
    // Se aparecesse, o administrador se daria a função pela tela de
    // Usuários e veria tudo de novo.
    const token = await entrarComo('admin@teste.com.br');
    const r = await chamar('/api/funcoes', { token });

    const codigos = r.corpo.funcoes.map((f: { codigo: string }) => f.codigo);
    assert.ok(!codigos.includes('DESENVOLVEDOR'), 'a função apareceu na lista');
  });

  it('recusa dar a função do desenvolvedor, mesmo sabendo o id', async () => {
    // Esconder da lista não basta: a atribuição é por id, e quem
    // descobrisse o id se daria a função. Aqui o teste pega o id
    // direto do banco — como faria quem fosse procurar.
    const { banco } = await import('../src/plugins/banco.js');
    const dev = await banco.funcao.findUnique({ where: { codigo: 'DESENVOLVEDOR' } });
    assert.ok(dev, 'a função DESENVOLVEDOR precisa existir');

    const token = await entrarComo('admin@teste.com.br');

    const r = await chamar('/api/usuarios', {
      metodo: 'POST',
      token,
      corpo: {
        nome: 'Curioso',
        email: 'curioso@teste.com.br',
        senha: 'Provisoria123',
        funcoes: [dev.id],
      },
    });

    assert.equal(r.status, 403, 'deixou criar usuário com a função do desenvolvedor');
  });

  it('recusa também na edição de quem já existe', async () => {
    const { banco } = await import('../src/plugins/banco.js');
    const dev = await banco.funcao.findUnique({ where: { codigo: 'DESENVOLVEDOR' } });
    assert.ok(dev);

    const token = await entrarComo('admin@teste.com.br');
    const lista = await chamar('/api/usuarios', { token });
    const alvo = lista.corpo.usuarios.find(
      (u: { email: string }) => u.email !== 'admin@teste.com.br',
    );
    assert.ok(alvo, 'o teste precisa de outro usuário');

    const r = await chamar('/api/usuarios/' + alvo.id, {
      metodo: 'PATCH',
      token,
      corpo: { funcoes: [dev.id] },
    });

    assert.equal(r.status, 403, 'deixou dar a função do desenvolvedor na edição');
  });
});

describe('Administração de usuários', () => {
  it('cadastra usuário e exige troca de senha no primeiro acesso', async () => {
    const token = await entrarComo('admin@teste.com.br');

    const funcoes = await chamar('/api/funcoes', { token });
    const solicitante = funcoes.corpo.funcoes.find(
      (f: { codigo: string }) => f.codigo === 'SOLICITANTE',
    );

    const r = await chamar('/api/usuarios', {
      metodo: 'POST',
      token,
      corpo: {
        nome: 'Pedreiro Novo',
        email: 'pedreiro@teste.com.br',
        senha: 'Provisoria123',
        funcoes: [solicitante.id],
      },
    });

    assert.equal(r.status, 201);
    assert.equal(r.corpo.usuario.precisaTrocarSenha, true);
    assert.equal(r.corpo.usuario.funcoes.length, 1);
  });

  it('recusa e-mail já cadastrado', async () => {
    const token = await entrarComo('admin@teste.com.br');
    const funcoes = await chamar('/api/funcoes', { token });

    const r = await chamar('/api/usuarios', {
      metodo: 'POST',
      token,
      corpo: {
        nome: 'Outro Qualquer',
        email: 'admin@teste.com.br',
        senha: 'Provisoria123',
        funcoes: [funcoes.corpo.funcoes[0].id],
      },
    });

    assert.equal(r.status, 409);
  });

  it('recusa senha fraca', async () => {
    const token = await entrarComo('admin@teste.com.br');
    const funcoes = await chamar('/api/funcoes', { token });

    const r = await chamar('/api/usuarios', {
      metodo: 'POST',
      token,
      corpo: {
        nome: 'Senha Fraca',
        email: 'fraca@teste.com.br',
        senha: '12345678',
        funcoes: [funcoes.corpo.funcoes[0].id],
      },
    });

    assert.equal(r.status, 400);
  });

  it('exige pelo menos uma função', async () => {
    const token = await entrarComo('admin@teste.com.br');

    const r = await chamar('/api/usuarios', {
      metodo: 'POST',
      token,
      corpo: {
        nome: 'Sem Funcao',
        email: 'semfuncao@teste.com.br',
        senha: 'Provisoria123',
        funcoes: [],
      },
    });

    assert.equal(r.status, 400);
  });

  it('impede o administrador de desativar a si mesmo', async () => {
    const token = await entrarComo('admin@teste.com.br');
    const eu = await chamar('/api/autenticacao/eu', { token });

    const r = await chamar('/api/usuarios/' + eu.corpo.usuario.id, {
      metodo: 'PATCH',
      token,
      corpo: { ativo: false },
    });

    assert.equal(r.status, 400);
    assert.ok(r.corpo.erro.includes('a si mesmo'));
  });

  it('desativar alguém derruba a sessão dele na hora', async () => {
    const token = await entrarComo('almoxarife@teste.com.br');

    // Confirma que o crachá funciona antes.
    assert.equal((await chamar('/api/materiais', { token })).status, 200);

    const admin = await entrarComo('admin@teste.com.br');
    const lista = await chamar('/api/usuarios', { token: admin });
    const alvo = lista.corpo.usuarios.find(
      (u: { email: string }) => u.email === 'almoxarife@teste.com.br',
    );

    await chamar('/api/usuarios/' + alvo.id, {
      metodo: 'PATCH',
      token: admin,
      corpo: { ativo: false },
    });

    // Agora o mesmo crachá não vale mais.
    const depois = await chamar('/api/materiais', { token });
    assert.equal(depois.status, 401);

    // Devolve o usuário ao estado ativo para os próximos testes.
    await chamar('/api/usuarios/' + alvo.id, {
      metodo: 'PATCH',
      token: admin,
      corpo: { ativo: true },
    });
  });
});
