// ============================================================
//  O botão de baixar
//
//  Todo download do sistema passa por aqui. A regra combinada é
//  que o usuário SEMPRE escolhe entre PDF e Word — nada sai em
//  CSV, e nada baixa direto sem perguntar. Se alguém trocar isso
//  sem querer, o defeito não aparece na tela: aparece na mão de
//  quem recebe um arquivo que não consegue abrir.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BotaoBaixar } from './BotaoBaixar';

function montar(props: Partial<Parameters<typeof BotaoBaixar>[0]> = {}) {
  const aoEscolher = vi.fn();
  render(<BotaoBaixar aoEscolher={aoEscolher} descricao="lista de pedidos" {...props} />);
  return { aoEscolher, usuario: userEvent.setup() };
}

describe('escolha de formato', () => {
  it('oferece PDF e Word, e nada mais', async () => {
    const { usuario } = montar();

    await usuario.click(screen.getByRole('button', { name: /baixar/i }));

    const opcoes = screen.getAllByRole('menuitem');
    expect(opcoes).toHaveLength(2);
    expect(opcoes[0]).toHaveTextContent('PDF');
    expect(opcoes[1]).toHaveTextContent('Word');
  });

  it('não baixa nada antes de a pessoa escolher', async () => {
    const { aoEscolher, usuario } = montar();

    await usuario.click(screen.getByRole('button', { name: /baixar/i }));

    expect(aoEscolher).not.toHaveBeenCalled();
  });

  it('entrega o formato que foi escolhido', async () => {
    const { aoEscolher, usuario } = montar();

    await usuario.click(screen.getByRole('button', { name: /baixar/i }));
    await usuario.click(screen.getByRole('menuitem', { name: /word/i }));

    expect(aoEscolher).toHaveBeenCalledWith('docx');
  });

  it('fecha o menu depois de escolher', async () => {
    const { usuario } = montar();

    await usuario.click(screen.getByRole('button', { name: /baixar/i }));
    await usuario.click(screen.getByRole('menuitem', { name: /pdf/i }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('teclado e leitor de tela', () => {
  it('Esc fecha o menu e devolve o foco ao botão', async () => {
    // Quem navega por teclado não pode ficar sem saber onde está.
    const { usuario } = montar();
    const botao = screen.getByRole('button', { name: /baixar/i });

    await usuario.click(botao);
    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it('o menu diz o que está sendo baixado', async () => {
    const { usuario } = montar({ descricao: 'relatório de economia' });

    await usuario.click(screen.getByRole('button', { name: /baixar/i }));

    expect(screen.getByRole('menu')).toHaveAccessibleName('Formato: relatório de economia');
  });

  it('o botão anuncia que abre um menu e se ele está aberto', async () => {
    const { usuario } = montar();
    const botao = screen.getByRole('button', { name: /baixar/i });

    expect(botao).toHaveAttribute('aria-haspopup', 'menu');
    expect(botao).toHaveAttribute('aria-expanded', 'false');

    await usuario.click(botao);

    expect(botao).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('enquanto o arquivo está sendo gerado', () => {
  it('avisa e não deixa clicar de novo', () => {
    // Dois cliques = dois arquivos gerados, e o segundo não serve
    // para nada além de ocupar a máquina.
    montar({ ocupado: true });

    const botao = screen.getByRole('button', { name: /gerando/i });
    expect(botao).toBeDisabled();
  });
});
