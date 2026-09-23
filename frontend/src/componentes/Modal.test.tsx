// ============================================================
//  O contrato do modal
//
//  Modal mal feito é o defeito de acessibilidade mais comum que
//  existe: o foco fica solto atrás, o Esc não fecha, e quem usa
//  teclado fica preso. Aqui cada cláusula do contrato tem prova.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

function montar(props: Partial<Parameters<typeof Modal>[0]> = {}) {
  const aoFechar = vi.fn();

  const util = render(
    <>
      <button type="button">Abrir</button>
      <Modal aberto aoFechar={aoFechar} titulo="Cancelar a nota" {...props}>
        <p>Corpo do modal</p>
      </Modal>
    </>,
  );

  return { aoFechar, usuario: userEvent.setup(), ...util };
}

describe('O que aparece', () => {
  it('fechado, não mostra nada', () => {
    render(
      <Modal aberto={false} aoFechar={() => {}} titulo="Cancelar a nota">
        <p>Corpo do modal</p>
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('aberto, é um diálogo de verdade para o leitor de tela', () => {
    montar();

    const caixa = screen.getByRole('dialog');
    expect(caixa).toBeInTheDocument();
    // O título é ligado ao diálogo: é ele que o leitor de tela
    // anuncia ao entrar.
    expect(caixa).toHaveAccessibleName('Cancelar a nota');
  });

  it('a descrição também é anunciada', () => {
    montar({ descricao: 'Isto não pode ser desfeito.' });

    expect(screen.getByRole('dialog'))
      .toHaveAccessibleDescription('Isto não pode ser desfeito.');
  });

  it('é um <dialog>, não uma div fingindo ser janela', () => {
    montar();
    expect(screen.getByRole('dialog').tagName).toBe('DIALOG');
  });
});

describe('Fechar', () => {
  it('o botão de fechar tem nome, não só um X', () => {
    // "✕" sozinho não diz nada para quem usa leitor de tela.
    montar();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
  });

  it('clicar em fechar avisa quem abriu', async () => {
    const { aoFechar, usuario } = montar();

    await usuario.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('Esc fecha', async () => {
    const { aoFechar, usuario } = montar();

    await usuario.keyboard('{Escape}');

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});

describe('Alteração não salva', () => {
  it('Esc PERGUNTA antes de jogar fora o que foi preenchido', async () => {
    const perguntou = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { aoFechar, usuario } = montar({ temAlteracao: true });

    await usuario.keyboard('{Escape}');

    expect(perguntou).toHaveBeenCalled();
    expect(aoFechar).not.toHaveBeenCalled();
  });

  it('respondendo que sim, fecha', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { aoFechar, usuario } = montar({ temAlteracao: true });

    await usuario.keyboard('{Escape}');

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('sem alteração, não pergunta nada', async () => {
    const perguntou = vi.spyOn(window, 'confirm');
    const { usuario } = montar();

    await usuario.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(perguntou).not.toHaveBeenCalled();
  });
});

describe('O que está atrás', () => {
  it('não rola enquanto o modal está aberto', () => {
    // O <dialog> trava clique e tabulação, mas não a rolagem: sem
    // isto, rolar o modal no fim leva a página de trás junto.
    montar();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('volta a rolar depois de fechar', async () => {
    const { usuario } = montar();

    await usuario.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(document.body.style.overflow).toBe('');
  });
});

describe('As ações', () => {
  it('ficam no rodapé', () => {
    montar({ acoes: <button type="button">Confirmar</button> });

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });
});
