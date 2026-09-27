// ============================================================
//  A senha provisória
//
//  Ela vive pouco — só até a pessoa entrar — mas durante esse tempo
//  é a chave da conta de alguém. Se todas saírem iguais, a "senha
//  provisória" vira a senha da empresa inteira.
// ============================================================

import { describe, it, expect } from 'vitest';
import { senhaSorteada } from './senhaSorteada';

describe('Senha provisória sorteada', () => {
  it('tem catorze caracteres', () => {
    expect(senhaSorteada()).toHaveLength(14);
  });

  it('passa na exigência do servidor: letra e número', () => {
    // O servidor recusa senha fraca. Sortear uma que ele recusa faria
    // o botão falhar na cara de quem clicou, sem explicação.
    for (let i = 0; i < 50; i += 1) {
      const senha = senhaSorteada();

      expect(senha, senha).toMatch(/[A-Za-z]/);
      expect(senha, senha).toMatch(/[0-9]/);
    }
  });

  it('nunca repete', () => {
    const vistas = new Set(Array.from({ length: 200 }, () => senhaSorteada()));

    expect(vistas.size).toBe(200);
  });

  it('não usa caractere que se confunde ao ditar', () => {
    // A senha vai ser lida em voz alta no telefone ou copiada de um
    // print. O que é 0 e o que é O? l ou 1? Um caractere ambíguo
    // custa uma segunda ligação.
    for (let i = 0; i < 100; i += 1) {
      expect(senhaSorteada()).not.toMatch(/[0O1lI5S8B]/);
    }
  });

  it('não começa sempre com o mesmo tipo de caractere', () => {
    // Sem embaralhar, o primeiro seria sempre letra e o segundo
    // sempre número — padrão é o contrário de aleatório.
    const primeiros = new Set(
      Array.from({ length: 60 }, () => {
        const c = senhaSorteada()[0];

        return /[A-Za-z]/.test(c) ? 'letra' : /[0-9]/.test(c) ? 'numero' : 'simbolo';
      }),
    );

    expect(primeiros.size).toBeGreaterThan(1);
  });
});
