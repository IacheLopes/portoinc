// ============================================================
//  Testes da Etapa 1 - Acesso ao sistema
//
//  Estes testes existem para garantir que nenhuma mudança
//  futura abra uma porta que deveria estar fechada.
// ============================================================

import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  limparDados, criarUsuarioTeste, entrarComo, chamar, encerrar, SENHA_TESTE, pegarApp,
} from './ajuda.js';
import { banco } from '../src/plugins/banco.js';

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

  it('o status não anuncia mais a integração de código de barras', async () => {
    // A tela de diagnóstico listava cinco integrações; a de código de
    // barras era a GS1, que saiu em 08/10/2026. Anunciar uma tomada
    // que não existe é prometer o que não se vai entregar.
    await criarUsuarioTeste('dev.gs1@teste.com.br', ['DESENVOLVEDOR']);
    const token = await entrarComo('dev.gs1@teste.com.br');

    const r = await chamar('/api/status', { token });
    assert.equal(r.status, 200);

    const areas = r.corpo.integracoes.map((i: { area: string }) => i.area);

    //  O "Assistente de IA" entrou em 14/10/2026. A lista continua
    //  sendo conferida INTEIRA, de proposito: o que esta tela
    //  promete e o que o sistema tem, e um nome a mais aqui sem
    //  tomada atras dele e a mesma mentira que a GS1 era.
    assert.deepEqual(areas, [
      'WhatsApp', 'Assistente de IA', 'Fiscal (NF-e)', 'Pagamento', 'E-mail',
    ]);
    assert.ok(!areas.includes('Código de barras'), 'a GS1 saiu em 08/10/2026');
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

  it('ignora senha mandada na criação, porque ela não existe mais ali', async () => {
    //  A ROTA DE CRIAR NÃO RECEBE SENHA DESDE 10/10/2026.
    //
    //  Quem cria a conta não escolhe a senha de ninguém: a resposta
    //  traz um LINK e a pessoa cria a dela. Uma senha mandada aqui
    //  é campo a mais, e o servidor a descarta — ela não vira a
    //  senha de ninguém.
    //
    //  A recusa de senha fraca continua existindo, no convite.
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

    assert.equal(r.status, 201);
    assert.ok(r.corpo.convite?.token, 'a criação tem de devolver o link');

    //  E a senha que veio junto não abre a conta.
    const app = await pegarApp();
    const tentativa = await app.inject({
      method: 'POST',
      url: '/api/autenticacao/entrar',
      payload: { email: 'fraca@teste.com.br', senha: '12345678' },
    });
    assert.equal(tentativa.statusCode, 401, 'a senha mandada na criação não pode valer');
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

describe('Renovar a sessão', () => {
  // SEM COOKIE NENHUM NÃO É FALHA, é "não há sessão para renovar".
  //
  // A tela chama esta rota ao abrir, para saber se dá para
  // reaproveitar a sessão. Respondendo 401, o navegador escrevia
  // "Failed to load resource: 401" em vermelho toda primeira visita
  // — achado pela varredura de 09/10/2026, nas sete contas.
  //
  // Medido: de 6 chamadas (navegador novo, login e cinco telas), só
  // a primeira levava 401.
  it('sem cookie responde 204, e não 401', async () => {
    const r = await chamar('/api/autenticacao/renovar', { metodo: 'POST' });

    assert.equal(r.status, 204, 'navegador que nunca entrou nao esta em falha');
    assert.equal(r.corpo, null, '204 nao leva corpo');
  });

  it('com cookie inválido responde 401, porque aí houve falha mesmo', async () => {
    const app = await pegarApp();

    const r = await app.inject({
      method: 'POST',
      url: '/api/autenticacao/renovar',
      cookies: { portoink_sessao: 'isto-nao-e-uma-chave-de-verdade' },
    });

    assert.equal(r.statusCode, 401, 'chave recusada E falha de autenticacao');
  });
});

// ============================================================
//  SENHA PROVISÓRIA NÃO ABRE O SISTEMA
//
//  A conta criada por outra pessoa nasce marcada, e a mensagem
//  da tela de redefinir promete: "a pessoa deverá criar uma nova
//  no próximo acesso".
//
//  Até 09/10/2026 a marca era escrita, enviada no login e
//  declarada no tipo do frontend — e nenhuma tela a lia. As sete
//  contas da simulação entraram direto no painel com a senha que
//  o administrador tinha digitado.
//
//  Estes testes existem para que isso não volte em silêncio.
// ============================================================
describe('O link que cria a senha', () => {
  //  ATE 10/10/2026 ISTO SE CHAMAVA "senha provisoria".
  //
  //  O administrador digitava uma senha, repassava, e a pessoa era
  //  obrigada a trocar. Funcionava — e durante o trajeto DUAS
  //  pessoas sabiam a senha de uma conta.
  //
  //  Hoje o sistema sorteia um link de uso unico. Estes testes
  //  cobrem o que ele tem de garantir: que a conta nasce sem senha
  //  utilizavel, que o link cria a senha, que ele morre depois de
  //  usado, e que redefinir derruba quem estava dentro.

  /** Guarda o que um passo deixa para o proximo. */
  const feito: { id?: string; token?: string } = {};

  it('a conta nasce SEM senha que alguem conheca', async () => {
    const token = await entrarComo('admin@teste.com.br');

    const r = await chamar('/api/usuarios', {
      metodo: 'POST',
      token,
      corpo: {
        nome: 'Recém-chegada',
        email: 'recem@teste.com.br',
        funcoes: (await chamar('/api/funcoes', { token })).corpo.funcoes
          .filter((f: { codigo: string }) => f.codigo === 'SOLICITANTE')
          .map((f: { id: string }) => f.id),
      },
    });

    assert.equal(r.status, 201);
    assert.ok(r.corpo.convite?.token, 'a criação tem de devolver o link');
    assert.ok(r.corpo.convite?.expiraEm, 'o link tem de dizer até quando vale');

    feito.id = r.corpo.usuario.id;
    feito.token = r.corpo.convite.token;
  });

  it('o convite diz de quem e, sem contar nada da empresa', async () => {
    const r = await chamar('/api/convite/' + feito.token);

    assert.equal(r.status, 200);
    assert.equal(r.corpo.email, 'recem@teste.com.br');
    assert.ok(r.corpo.nome, 'a pessoa precisa reconhecer que o link é dela');

    //  Nem função, nem permissão, nem id: quem tem o link ainda não
    //  é ninguém dentro do sistema.
    assert.deepEqual(Object.keys(r.corpo).sort(), ['email', 'nome']);
  });

  it('recusa senha fraca — a trava mudou de porta, nao sumiu', async () => {
    const r = await chamar('/api/convite/' + feito.token, {
      metodo: 'POST',
      corpo: { senha: '12345678' },
    });

    assert.equal(r.status, 400);
    assert.match(String(r.corpo.erro), /fraca/i);
  });

  it('criou a senha, e o sistema inteiro abre', async () => {
    const r = await chamar('/api/convite/' + feito.token, {
      metodo: 'POST',
      corpo: { senha: 'MinhaPropria@9' },
    });
    assert.equal(r.status, 200);

    const dela = await entrarComo('recem@teste.com.br', 'MinhaPropria@9');
    const obras = await chamar('/api/obras', { token: dela });
    assert.equal(obras.status, 200, 'depois de criar a senha, o sistema tem de abrir');
  });

  it('o link morre depois de usado', async () => {
    const r = await chamar('/api/convite/' + feito.token, {
      metodo: 'POST',
      corpo: { senha: 'OutraQualquer@7' },
    });

    assert.equal(r.status, 410);
    assert.equal(r.corpo.motivo, 'usado');

    //  E a senha criada no passo anterior continua valendo: o link
    //  gasto não pode ter trocado nada.
    const dela = await entrarComo('recem@teste.com.br', 'MinhaPropria@9');
    assert.ok(dela, 'a senha que ela criou tem de continuar valendo');
  });

  it('token inventado nao abre nada', async () => {
    const r = await chamar('/api/convite/nao-existe-este-token');

    assert.equal(r.status, 410);
    assert.equal(r.corpo.motivo, 'inexistente');
  });

  it('redefinir pelo administrador derruba a senha e devolve outro link', async () => {
    const dela = await entrarComo('recem@teste.com.br', 'MinhaPropria@9');
    const admin = await entrarComo('admin@teste.com.br');

    const r = await chamar('/api/usuarios/' + feito.id + '/senha', {
      metodo: 'POST',
      token: admin,
    });
    assert.equal(r.status, 200);
    assert.ok(r.corpo.convite?.token, 'redefinir tem de devolver um link novo');

    //  QUEM ESTAVA DENTRO SAI NA HORA — POR DUAS PORTAS.
    //
    //  `encerrarTodasSessoes` mata as sessões, então o crachá não
    //  renova mais. O crachá curto que ela já tinha na mão continua
    //  sendo lido até vencer, e aí quem barra é a marca de primeiro
    //  acesso, com 403. Os dois caminhos fecham o sistema; o teste
    //  aceita qualquer um dos dois e recusa o 200.
    const depois = await chamar('/api/obras', { token: dela });
    assert.ok(
      depois.status === 401 || depois.status === 403,
      'quem estava logado tem de cair — veio ' + depois.status,
    );

    //  E a senha antiga não entra mais.
    const app = await pegarApp();
    const tentativa = await app.inject({
      method: 'POST',
      url: '/api/autenticacao/entrar',
      payload: { email: 'recem@teste.com.br', senha: 'MinhaPropria@9' },
    });
    assert.equal(tentativa.statusCode, 401, 'a senha antiga não pode continuar valendo');

    //  Pelo link novo ela escolhe outra, e volta a entrar.
    const nova = await chamar('/api/convite/' + r.corpo.convite.token, {
      metodo: 'POST',
      corpo: { senha: 'DepoisDoReset@3' },
    });
    assert.equal(nova.status, 200);

    const voltou = await entrarComo('recem@teste.com.br', 'DepoisDoReset@3');
    const obras = await chamar('/api/obras', { token: voltou });
    assert.equal(obras.status, 200);
  });
});

// ------------------------------------------------------------
//  A trava do primeiro acesso
//
//  Ela continua de pé, e continua valendo: protege QUALQUER conta
//  marcada com `precisaTrocarSenha` cuja senha outra pessoa
//  conheça — uma importação, um seed de instalação, uma conta
//  criada antes de 10/10/2026.
//
//  O caminho normal hoje é o link, e por ele a marca nunca chega a
//  ser usada: a conta nasce sem senha que alguém saiba. Por isso o
//  teste MONTA a situação direto no banco, em vez de esperar que a
//  rota de criar a produza.
// ------------------------------------------------------------
describe('A trava do primeiro acesso', () => {
  const EMAIL = 'herdada@teste.com.br';

  it('com a marca ligada, o servidor recusa o resto do sistema', async () => {
    await criarUsuarioTeste(EMAIL, ['SOLICITANTE']);
    await banco.usuario.update({
      where: { email: EMAIL },
      data: { precisaTrocarSenha: true },
    });

    const token = await entrarComo(EMAIL);

    for (const rota of ['/api/obras', '/api/solicitacoes', '/api/fornecedores']) {
      const r = await chamar(rota, { token });
      assert.equal(r.status, 403, rota + ' deveria estar fechada');
      assert.equal(r.corpo.precisaTrocarSenha, true, rota + ' deveria dizer o motivo');
    }
  });

  it('mas deixa passar o que ela precisa para sair desse estado', async () => {
    const token = await entrarComo(EMAIL);

    const eu = await chamar('/api/autenticacao/eu', { token });
    assert.equal(eu.status, 200, 'ela precisa saber quem é');
    assert.equal(eu.corpo.usuario.precisaTrocarSenha, true);
  });

  it('trocou a senha, e o sistema inteiro abre', async () => {
    const token = await entrarComo(EMAIL);

    const troca = await chamar('/api/autenticacao/senha', {
      metodo: 'POST',
      token,
      corpo: { senhaAtual: SENHA_TESTE, senhaNova: 'MinhaPropria@9' },
    });
    assert.equal(troca.status, 200);

    //  Trocar derruba as sessões: o crachá de antes não vale mais.
    const novo = await entrarComo(EMAIL, 'MinhaPropria@9');
    const r = await chamar('/api/obras', { token: novo });
    assert.equal(r.status, 200, 'depois de criar a senha, o sistema tem de abrir');
  });
});

// ============================================================
//  CRIAR FUNÇÃO DENTRO DO SISTEMA
//
//  Está na primeira página do fluxo de compras da Porto Inc.,
//  como regra confirmada: "um usuário pode acumular mais de uma
//  função, E AS FUNÇÕES DEVEM SER CRIÁVEIS DENTRO DO SISTEMA".
//
//  A metade de cima existia desde a Etapa 1. A de baixo não:
//  havia rota para listar funções e nenhuma para criar, e a
//  permissão `funcoes.gerenciar` só servia para ler a lista.
//  Achado na análise de coerência de 09/10/2026.
// ============================================================
interface Funcao {
  id: string;
  codigo: string;
  permissoes: Array<{ codigo: string }>;
}

describe('Criar função', () => {
  let admin = '';
  let almoxarife = '';
  let permissoes: Array<{ id: string; codigo: string; nome: string }> = [];
  /** Como as funções estavam antes deste bloco mexer nelas. */
  let comoEstava: Array<{ id: string; codigo: string; permissoes: string[] }> = [];

  before(async () => {
    await criarUsuarioTeste('adm.fn@teste.com.br', ['ADMINISTRADOR']);
    admin = await entrarComo('adm.fn@teste.com.br');

    await criarUsuarioTeste('alm.fn@teste.com.br', ['ALMOXARIFE']);
    almoxarife = await entrarComo('alm.fn@teste.com.br');

    const r = await chamar('/api/permissoes', { token: admin });
    permissoes = r.corpo.permissoes;

    // O QUE ESTE BLOCO PEGAR EMPRESTADO, ELE DEVOLVE.
    //
    // As funções vêm de migração e a suíte inteira compartilha um
    // banco: `limparDados` não as toca, e os arquivos rodam em
    // sequência. A primeira versão daqui tirou permissões do
    // ALMOXARIFE e deixou a função nova de pé — e quatro testes
    // de OUTROS arquivos quebraram, porque o almoxarife deles
    // perdeu `materiais.ver`.
    //
    // Mesmo tropeço que o bloco de alçadas deu em 09/10/2026. Duas
    // vezes é padrão: teste que mexe em dado de migração devolve
    // antes de sair.
    const antes = await chamar('/api/funcoes', { token: admin });
    comoEstava = (antes.corpo.funcoes as Funcao[]).map((f) => ({
      id: f.id,
      codigo: f.codigo,
      permissoes: f.permissoes.map((p) => p.codigo),
    }));
  });

  after(async () => {
    const agora = await chamar('/api/funcoes', { token: admin });

    for (const f of agora.corpo.funcoes as Funcao[]) {
      const original = comoEstava.find((o) => o.id === f.id);

      // Nasceu aqui: sai.
      //
      // Pelo banco, e não pela rota: a rota recusa apagar função
      // com gente dentro — e com razão, porque sumir levaria junto
      // a resposta de "quem assinou isto?". Mas um destes testes
      // dá a função nova a alguém de propósito, e a limpeza
      // precisa passar por cima disso.
      if (!original) {
        await banco.usuarioFuncao.deleteMany({ where: { funcaoId: f.id } });
        await banco.funcaoPermissao.deleteMany({ where: { funcaoId: f.id } });
        await banco.funcao.delete({ where: { id: f.id } });
        continue;
      }

      // Mudou de permissões: volta ao que era.
      const mudou = original.permissoes.slice().sort().join()
        !== f.permissoes.map((p) => p.codigo).sort().join();

      if (mudou) {
        await chamar('/api/funcoes/' + f.id, {
          metodo: 'PATCH',
          token: admin,
          corpo: {
            permissoes: permissoes
              .filter((p) => original.permissoes.includes(p.codigo))
              .map((p) => p.id),
          },
        });
      }
    }
  });

  const idDe = (codigo: string) => permissoes.find((p) => p.codigo === codigo)!.id;

  it('só quem tem funcoes.gerenciar enxerga a lista de permissões', async () => {
    const r = await chamar('/api/permissoes', { token: almoxarife });
    assert.equal(r.status, 403);
  });

  it('o almoxarife não cria função', async () => {
    const r = await chamar('/api/funcoes', {
      metodo: 'POST',
      token: almoxarife,
      corpo: { codigo: 'ENCARREGADO', nome: 'Encarregado', permissoes: [idDe('estoque.ver')] },
    });

    assert.equal(r.status, 403);
  });

  it('o administrador cria, e a função já nasce com o que ela pode', async () => {
    const r = await chamar('/api/funcoes', {
      metodo: 'POST',
      token: admin,
      corpo: {
        codigo: 'ENCARREGADO',
        nome: 'Encarregado de obra',
        descricao: 'Vê o estoque da obra e abre solicitação.',
        permissoes: [idDe('estoque.ver'), idDe('solicitacoes.criar')],
      },
    });

    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(r.corpo.funcao.codigo, 'ENCARREGADO');
    assert.equal(r.corpo.funcao.sistema, false, 'função da empresa não é de sistema');
    assert.equal(r.corpo.funcao.permissoes.length, 2);
    assert.equal(r.corpo.funcao.usuarios, 0);
  });

  it('o código sobe para maiúscula e não se repete', async () => {
    const r = await chamar('/api/funcoes', {
      metodo: 'POST',
      token: admin,
      corpo: { codigo: 'encarregado', nome: 'Outro', permissoes: [idDe('estoque.ver')] },
    });

    assert.equal(r.status, 409);
  });

  it('função sem nenhuma permissão é um nome sem conteúdo', async () => {
    const r = await chamar('/api/funcoes', {
      metodo: 'POST',
      token: admin,
      corpo: { codigo: 'VAZIA', nome: 'Função vazia', permissoes: [] },
    });

    assert.equal(r.status, 400);
  });

  it('a permissão da tela de diagnóstico não é oferecida', async () => {
    // O guia de navegação promete que "Status do sistema" não
    // aparece para mais ninguém, nem para o administrador.
    assert.equal(
      permissoes.some((p) => p.codigo === 'sistema.status'), false,
      'sistema.status nao pode estar na lista de caixas',
    );
  });

  it('a pessoa criada com a função nova recebe o que a função dá', async () => {
    const lista = await chamar('/api/funcoes', { token: admin });
    const nova = (lista.corpo.funcoes as Array<{ id: string; codigo: string }>)
      .find((f) => f.codigo === 'ENCARREGADO')!;

    const criada = await chamar('/api/usuarios', {
      metodo: 'POST',
      token: admin,
      corpo: {
        nome: 'Encarregado Teste',
        email: 'encarregado@teste.com.br',
        senha: 'Provisoria@1',
        funcoes: [nova.id],
      },
    });

    assert.equal(criada.status, 201, JSON.stringify(criada.corpo));
    assert.deepEqual(
      criada.corpo.usuario.funcoes.map((f: { codigo: string }) => f.codigo),
      ['ENCARREGADO'],
    );
  });

  it('ajustar as permissões da função nova vale', async () => {
    const lista = await chamar('/api/funcoes', { token: admin });
    const nova = (lista.corpo.funcoes as Array<{ id: string; codigo: string }>)
      .find((f) => f.codigo === 'ENCARREGADO')!;

    const r = await chamar('/api/funcoes/' + nova.id, {
      metodo: 'PATCH',
      token: admin,
      corpo: { permissoes: [idDe('estoque.ver')] },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.funcao.permissoes.length, 1);
  });

  it('nas nove de fábrica, o nome e o código não mudam', async () => {
    const lista = await chamar('/api/funcoes', { token: admin });
    const almox = (lista.corpo.funcoes as Array<{ id: string; codigo: string }>)
      .find((f) => f.codigo === 'ALMOXARIFE')!;

    const r = await chamar('/api/funcoes/' + almox.id, {
      metodo: 'PATCH',
      token: admin,
      corpo: { nome: 'Almoxarife-chefe' },
    });

    assert.equal(r.status, 409);
    assert.ok((r.corpo.erro as string).includes('veio com o sistema'));
  });

  it('mas as permissões delas, sim', async () => {
    const lista = await chamar('/api/funcoes', { token: admin });
    const almox = (lista.corpo.funcoes as Array<{ id: string; codigo: string }>)
      .find((f) => f.codigo === 'ALMOXARIFE')!;

    const r = await chamar('/api/funcoes/' + almox.id, {
      metodo: 'PATCH',
      token: admin,
      corpo: { permissoes: [idDe('estoque.ver'), idDe('estoque.movimentar'), idDe('relatorios.ver')] },
    });

    assert.equal(r.status, 200);
    assert.equal(r.corpo.funcao.permissoes.length, 3);
  });

  // ----------------------------------------------------------
  //  A TRAVA QUE IMPEDE O SISTEMA DE SE TRANCAR POR FORA
  // ----------------------------------------------------------
  it('não deixa o administrador tirar a chave da casa de si mesmo', async () => {
    const lista = await chamar('/api/funcoes', { token: admin });
    const adm = (lista.corpo.funcoes as Array<{ id: string; codigo: string }>)
      .find((f) => f.codigo === 'ADMINISTRADOR')!;

    // Uma permissão inofensiva só: some `usuarios.gerenciar` e
    // `funcoes.gerenciar`, e ninguém mais cria conta nem função.
    const r = await chamar('/api/funcoes/' + adm.id, {
      metodo: 'PATCH',
      token: admin,
      corpo: { permissoes: [idDe('relatorios.ver')] },
    });

    assert.equal(r.status, 409);
    assert.ok((r.corpo.erro as string).includes('NINGUÉM'));
  });

  it('função de sistema não se apaga', async () => {
    const lista = await chamar('/api/funcoes', { token: admin });
    const almox = (lista.corpo.funcoes as Array<{ id: string; codigo: string }>)
      .find((f) => f.codigo === 'ALMOXARIFE')!;

    const r = await chamar('/api/funcoes/' + almox.id, { metodo: 'DELETE', token: admin });
    assert.equal(r.status, 409);
  });

  it('função com gente dentro também não', async () => {
    const lista = await chamar('/api/funcoes', { token: admin });
    const nova = (lista.corpo.funcoes as Array<{ id: string; codigo: string }>)
      .find((f) => f.codigo === 'ENCARREGADO')!;

    const r = await chamar('/api/funcoes/' + nova.id, { metodo: 'DELETE', token: admin });

    assert.equal(r.status, 409);
    assert.ok((r.corpo.erro as string).includes('pessoa'));
  });

  it('função nova e sem ninguém, sim', async () => {
    const criada = await chamar('/api/funcoes', {
      metodo: 'POST',
      token: admin,
      corpo: { codigo: 'PASSAGEIRA', nome: 'Passageira', permissoes: [idDe('relatorios.ver')] },
    });
    assert.equal(criada.status, 201);

    const r = await chamar('/api/funcoes/' + criada.corpo.funcao.id, {
      metodo: 'DELETE',
      token: admin,
    });

    assert.equal(r.status, 200);
  });
});
