// ============================================================
//  O botão de trocar o tema
//
//  O rótulo dele diz o que vai ACONTECER, não o estado atual.
//  Botão escrito "Tema claro" quando a tela já está clara deixa a
//  pessoa sem saber se clicar liga ou desliga.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BotaoTema } from './BotaoTema';
import { CHAVE_TEMA } from '../tema';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-tema');
});

describe('O que o botão oferece', () => {
  it('na tela clara, oferece o escuro', () => {
    render(<BotaoTema />);
    expect(screen.getByRole('button', { name: /tema escuro/i })).toBeInTheDocument();
  });

  it('na tela escura, oferece o claro', () => {
    window.localStorage.setItem(CHAVE_TEMA, 'escuro');
    render(<BotaoTema />);
    expect(screen.getByRole('button', { name: /tema claro/i })).toBeInTheDocument();
  });
});

describe('Trocar', () => {
  it('um clique escurece a página', async () => {
    const usuario = userEvent.setup();
    render(<BotaoTema />);

    await usuario.click(screen.getByRole('button', { name: /tema escuro/i }));

    expect(document.documentElement.getAttribute('data-tema')).toBe('escuro');
  });

  it('a escolha fica guardada para a próxima visita', async () => {
    const usuario = userEvent.setup();
    render(<BotaoTema />);

    await usuario.click(screen.getByRole('button', { name: /tema escuro/i }));

    expect(window.localStorage.getItem(CHAVE_TEMA)).toBe('escuro');
  });

  it('dois cliques voltam ao começo', async () => {
    const usuario = userEvent.setup();
    render(<BotaoTema />);

    await usuario.click(screen.getByRole('button', { name: /tema escuro/i }));
    await usuario.click(screen.getByRole('button', { name: /tema claro/i }));

    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
    expect(window.localStorage.getItem(CHAVE_TEMA)).toBe('claro');
  });
});

describe('Leitor de tela', () => {
  it('anuncia o estado, que o ícone sozinho não conta', async () => {
    const usuario = userEvent.setup();
    render(<BotaoTema />);

    const botao = screen.getByRole('button', { name: /tema escuro/i });
    expect(botao).toHaveAttribute('aria-pressed', 'false');

    await usuario.click(botao);

    expect(screen.getByRole('button', { name: /tema claro/i }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('é botão de verdade, não link', () => {
    // Ele age, não navega. Link que não leva a lugar nenhum engana
    // quem navega por teclado ou leitor de tela.
    render(<BotaoTema />);
    expect(screen.getByRole('button', { name: /tema/i }).tagName).toBe('BUTTON');
  });
});
