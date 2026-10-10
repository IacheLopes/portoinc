// ============================================================
//  A MENSAGEM DE ERRO QUE CHEGA NA TELA
//
//  Este arquivo nasceu de um defeito real, em 10/10/2026.
//
//  O dono mandou a primeira mensagem de teste pelo WhatsApp e
//  voltou dizendo "não chegou nada". O sistema tinha feito o
//  certo — bloqueou, porque não havia número autorizado — e tinha
//  a frase pronta para explicar:
//
//    "O número 5583•••••48 não está na lista de autorizados.
//     Enquanto o envio estiver restrito, o sistema só envia para
//     os números que você liberar."
//
//  A tela mostrou "O servidor respondeu com erro 403.", porque o
//  cliente só lia o campo `erro` e as quatro rotas de envio
//  respondem no campo `mensagem`.
//
//  Uma frase boa, escrita com cuidado, morrendo a um `??` de
//  distância da pessoa que precisava dela.
// ============================================================

import { describe, it, expect, vi, afterEach } from 'vitest';
import { chamar, ErroApi } from './api';

/** Finge uma resposta do servidor. */
function responder(status: number, corpo: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => corpo,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('O erro que o servidor manda chega na tela', () => {
  it('lê o campo `erro`, que é o que 141 rotas usam', async () => {
    responder(409, { erro: 'Já existe um usuário com este e-mail.' });

    await expect(chamar('/api/usuarios', { metodo: 'POST', semRenovar: true }))
      .rejects.toThrow('Já existe um usuário com este e-mail.');
  });

  it('lê o campo `mensagem`, que é o que as rotas de ENVIO usam', async () => {
    //  O defeito: isto virava "O servidor respondeu com erro 403."
    responder(403, {
      sucesso: false,
      bloqueado: true,
      mensagem:
        'O número 5583•••••48 não está na lista de autorizados. '
        + 'Enquanto o envio estiver restrito, o sistema só envia para os '
        + 'números que você liberar.',
    });

    await expect(chamar('/api/whatsapp/testar', { metodo: 'POST', semRenovar: true }))
      .rejects.toThrow(/não está na lista de autorizados/);
  });

  it('com os dois campos, `erro` manda', async () => {
    responder(400, { erro: 'Dados inválidos', mensagem: 'outra coisa' });

    await expect(chamar('/api/qualquer', { semRenovar: true }))
      .rejects.toThrow('Dados inválidos');
  });

  it('sem nenhum dos dois, aí sim o código HTTP', async () => {
    //  É o último recurso, não o primeiro. Antes ele era o
    //  primeiro para toda rota de envio.
    responder(502, {});

    await expect(chamar('/api/qualquer', { semRenovar: true }))
      .rejects.toThrow('O servidor respondeu com erro 502.');
  });

  it('a lista de campos continua entrando junto', async () => {
    responder(400, {
      erro: 'Dados inválidos',
      detalhes: [{ campo: 'email', mensagem: 'E-mail: informe um e-mail válido' }],
    });

    try {
      await chamar('/api/usuarios', { metodo: 'POST', semRenovar: true });
      expect.unreachable('tinha de lançar');
    } catch (e) {
      expect(e).toBeInstanceOf(ErroApi);
      expect((e as ErroApi).message).toContain('Dados inválidos');
      expect((e as ErroApi).message).toContain('informe um e-mail válido');
      expect((e as ErroApi).status).toBe(400);
    }
  });
});
