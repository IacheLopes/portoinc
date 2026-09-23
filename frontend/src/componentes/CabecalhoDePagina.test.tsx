// ============================================================
//  O cabeçalho de tela
//
//  Ele decide para onde o Voltar leva em 30 telas. Errar aqui manda
//  a pessoa para o lugar errado, e ela nem desconfia — o botão
//  parece que funcionou.
// ============================================================

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CabecalhoDePagina } from './CabecalhoDePagina';

function montar(endereco: string, props: Parameters<typeof CabecalhoDePagina>[0]) {
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <CabecalhoDePagina {...props} />
    </MemoryRouter>,
  );
}

describe('O título', () => {
  it('é o único h1 da tela', () => {
    montar('/solicitacoes', { titulo: 'Solicitações de compra' });

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent('Solicitações de compra');
  });

  it('a descrição aparece quando existe', () => {
    montar('/solicitacoes', {
      titulo: 'Solicitações',
      descricao: 'Você enxerga as solicitações de toda a empresa.',
    });

    expect(screen.getByText(/toda a empresa/)).toBeInTheDocument();
  });

  it('os selos de situação ficam junto do título', () => {
    // "SOL-00018, aguardando aprovação" é uma coisa só. O selo
    // longe do título vira informação solta.
    montar('/solicitacoes/abc', {
      titulo: 'SOL-00018',
      marcadores: <span>Aguardando aprovação</span>,
    });

    expect(screen.getByText('Aguardando aprovação')).toBeInTheDocument();
  });
});

describe('O botão de Voltar', () => {
  it('diz PARA ONDE vai, não só "voltar"', () => {
    // Quem usa leitor de tela ouve o destino; quem enxerga também.
    montar('/solicitacoes/abc', { titulo: 'SOL-00018' });

    const voltar = screen.getByRole('link', { name: /voltar para solicitações/i });
    expect(voltar).toHaveAttribute('href', '/solicitacoes');
  });

  it('numa tela de segundo nível, volta para a tela certa daquele item', () => {
    montar('/cotacoes/abc-123/equalizacao', { titulo: 'Equalização' });

    expect(screen.getByRole('link', { name: /voltar para pacote de cotação/i }))
      .toHaveAttribute('href', '/cotacoes/abc-123');
  });

  it('no Início não aparece: não há para onde voltar', () => {
    montar('/', { titulo: 'Boa tarde' });

    expect(screen.queryByRole('link', { name: /voltar/i })).not.toBeInTheDocument();
  });
});

describe('As migalhas', () => {
  it('mostram o caminho inteiro, do Início até aqui', () => {
    montar('/cotacoes/abc-123/equalizacao', { titulo: 'Equalização' });

    const caminho = screen.getByRole('navigation', { name: /você está em/i });
    expect(caminho).toHaveTextContent('Início');
    expect(caminho).toHaveTextContent('Cotações');
    expect(caminho).toHaveTextContent('Equalização');
  });

  it('os degraus do meio são links que funcionam', () => {
    montar('/cotacoes/abc-123/equalizacao', { titulo: 'Equalização' });

    expect(screen.getByRole('link', { name: 'Cotações' })).toHaveAttribute('href', '/cotacoes');
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/');
  });

  it('o último degrau NÃO é link', () => {
    // Link que não leva a lugar nenhum engana quem navega por
    // teclado: a pessoa aperta Enter e nada acontece.
    montar('/solicitacoes', { titulo: 'Solicitações' });

    const atual = screen.getByText('Solicitações', { selector: '[aria-current="page"]' });
    expect(atual.tagName).not.toBe('A');
  });

  it('no Início não há caminho para mostrar', () => {
    montar('/', { titulo: 'Boa tarde' });

    expect(screen.queryByRole('navigation', { name: /você está em/i })).not.toBeInTheDocument();
  });
});

describe('As ações', () => {
  it('ficam no cabeçalho, ao lado do título', () => {
    montar('/solicitacoes', {
      titulo: 'Solicitações',
      acoes: <button type="button">+ Nova solicitação</button>,
    });

    expect(screen.getByRole('button', { name: /nova solicitação/i })).toBeInTheDocument();
  });
});
