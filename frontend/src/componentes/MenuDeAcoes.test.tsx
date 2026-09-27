// ============================================================
//  O menu de ações
//
//  Ele guarda ações que saíram da vista. Se abrir mal, fechar mal,
//  ou não se anunciar, essas ações viram inacessíveis — pior do que
//  a fileira de botões que ele substituiu.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

describe('Escapar da caixa que corta', () => {
  it('o menu se posiciona pela JANELA, não pelo botão', async () => {
    // `.tabela-area` tem `overflow-x: auto` para a tabela rolar de
    // lado no celular, e o navegador converte o `overflow-y` para
    // `auto` junto — não existe rolar num eixo e transbordar no
    // outro. Com `position: absolute` o menu saía cortado pela
    // borda do cartão; o dono fotografou em 27/09/2026, com
    // "Baixar o PDF" inteiro e "Mandar pelo WhatsApp" pela metade.
    const { usuario } = montar();

    await usuario.click(screen.getByRole('button', { name: /ações do pedido/i }));

    const lista = screen.getByRole('menu');

    // O `position: fixed` mora no CSS, que o jsdom não carrega —
    // esse lado foi medido no navegador de verdade. O que se prova
    // AQUI é o que o componente calcula: a posição em coordenadas
    // da janela, medida do botão na hora de abrir. Sem esses dois
    // números, `fixed` jogaria o menu no canto da tela.
    expect(lista.style.top).not.toBe('');
    expect(lista.style.right).not.toBe('');
  });

  it('rolar a página fecha o menu', async () => {
    // Ele está preso à janela: ficaria parado no ar enquanto a
    // linha dele some para cima.
    const { usuario } = montar();

    await usuario.click(screen.getByRole('button', { name: /ações do pedido/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Dentro de `act`: o evento é disparado fora do React, e sem
    // isto a tela não chega a redesenhar antes da conferência.
    act(() => { window.dispatchEvent(new Event('scroll')); });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
