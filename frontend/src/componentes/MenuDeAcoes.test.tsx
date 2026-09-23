// ============================================================
//  O menu de ações
//
//  Ele guarda ações que saíram da vista. Se abrir mal, fechar mal,
//  ou não se anunciar, essas ações viram inacessíveis — pior do que
//  a fileira de botões que ele substituiu.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuDeAcoes } from './MenuDeAcoes';

function montar(acoes = 3) {
  const feito = vi.fn();

  const lista = [
    { rotulo: 'Baixar o PDF', icone: '📄', aoEscolher: () => feito('pdf') },
    { rotulo: 'Mandar pelo WhatsApp', icone: '💬', aoEscolher: () => feito('zap') },
    { rotulo: 'Mandar por e-mail', icone: '✉', aoEscolher: () => feito('email') },
  ].slice(0, acoes);

  render(<MenuDeAcoes acoes={lista} descricao="Ações do pedido PC-00017" />);

  return { feito, usuario: userEvent.setup() };
}

describe('Antes de abrir', () => {
  it('as ações ficam guardadas', () => {
    montar();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('o botão tem nome, que o "⋮" sozinho não dá', () => {
    // Quem usa leitor de tela ouviria "botão" e mais nada.
    montar();
    expect(screen.getByRole('button', { name: 'Ações do pedido PC-00017' })).toBeInTheDocument();
  });

  it('anuncia que abre um menu', () => {
    montar();

    const botao = screen.getByRole('button', { name: /ações do pedido/i });
    expect(botao).toHaveAttribute('aria-haspopup', 'menu');
    expect(botao).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Aberto', () => {
  it('mostra todas as ações', async () => {
    const { usuario } = montar();

    await usuario.click(screen.getByRole('button', { name: /ações do pedido/i }));

    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('cada ação diz o que faz, por extenso', async () => {
    // "PDF" sozinho não diz se baixa, gera ou imprime.
    const { usuario } = montar();

    await usuario.click(screen.getByRole('button', { name: /ações do pedido/i }));

    expect(screen.getByRole('menuitem', { name: /baixar o pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /mandar pelo whatsapp/i })).toBeInTheDocument();
  });

  it('o botão passa a anunciar que está aberto', async () => {
    const { usuario } = montar();

    const botao = screen.getByRole('button', { name: /ações do pedido/i });
    await usuario.click(botao);

    expect(botao).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Escolher', () => {
  it('chama a ação escolhida, e só ela', async () => {
    const { feito, usuario } = montar();

    await usuario.click(screen.getByRole('button', { name: /ações do pedido/i }));
    await usuario.click(screen.getByRole('menuitem', { name: /whatsapp/i }));

    expect(feito).toHaveBeenCalledTimes(1);
    expect(feito).toHaveBeenCalledWith('zap');
  });

  it('fecha depois de escolher', async () => {
    const { usuario } = montar();

    await usuario.click(screen.getByRole('button', { name: /ações do pedido/i }));
    await usuario.click(screen.getByRole('menuitem', { name: /pdf/i }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('ação desabilitada não dispara', async () => {
    const feito = vi.fn();
    const usuario = userEvent.setup();

    render(
      <MenuDeAcoes
        descricao="Ações"
        acoes={[{ rotulo: 'Gerando o PDF...', aoEscolher: feito, desabilitada: true }]}
      />,
    );

    await usuario.click(screen.getByRole('button', { name: 'Ações' }));
    await usuario.click(screen.getByRole('menuitem', { name: /gerando/i }));

    expect(feito).not.toHaveBeenCalled();
  });
});

describe('Fechar pelo teclado', () => {
  it('Esc fecha e devolve o foco ao botão', async () => {
    // Sem devolver o foco, quem navega por teclado volta para o
    // começo da página.
    const { usuario } = montar();

    const botao = screen.getByRole('button', { name: /ações do pedido/i });
    await usuario.click(botao);
    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });
});
