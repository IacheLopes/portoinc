// ============================================================
//  A fila de aprovação
//
//  É a tela onde a alçada aparece para quem assina. Os erros
//  possíveis aqui são silenciosos e caros: mostrar "basta uma
//  assinatura" numa compra que exige duas, ou deixar a tela em
//  branco quando a API falha, sem dizer nada a ninguém.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FilaAprovacao } from './Fila';
import { listarFilaAprovacao, type ItemDaFila } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';

vi.mock('../../servicos/solicitacoes', async (original) => ({
  ...(await original<typeof import('../../servicos/solicitacoes')>()),
  listarFilaAprovacao: vi.fn(),
}));

const buscar = vi.mocked(listarFilaAprovacao);

/** Uma solicitação da fila, com o mínimo para a tela desenhar. */
function solicitacao(ajustes: Partial<ItemDaFila> = {}): ItemDaFila {
  return {
    id: 'a1',
    numeroFormatado: 'SC-2026-0001',
    obra: { id: 'o1', codigo: 'OB-01', nome: 'Residencial Aurora' },
    solicitante: { id: 'u1', nome: 'Neilma' },
    justificativa: 'Concretagem da laje',
    dataDesejada: null,
    enviadaEm: '2026-09-20T12:00:00.000Z',
    quantidadeItens: 3,
    totalEstimado: 1060,
    exigeTodas: false,
    funcoesExigidas: ['GESTOR_OBRA'],
    estado: {
      faltam: ['GESTOR_OBRA'],
      assinaram: [],
      reprovada: false,
      completa: false,
      resumo: 'Falta o gestor de obra',
    },
    esperaMinhaAssinatura: true,
    motivoBloqueio: null,
    ...ajustes,
  };
}

function montar() {
  render(
    <MemoryRouter>
      <FilaAprovacao />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  buscar.mockReset();
});

describe('a alçada aparece na tela', () => {
  it('compra pequena: uma assinatura basta', async () => {
    buscar.mockResolvedValue({
      fila: [solicitacao({ totalEstimado: 1060, exigeTodas: false })],
      minhasFuncoes: ['GESTOR_OBRA'],
    });

    montar();

    expect(await screen.findByText('Basta uma')).toBeInTheDocument();
  });

  it('compra da faixa do meio: mostra quantas das exigidas já assinaram', async () => {
    // R$ 6.600 exige gestor E engenheiro. Se esta contagem sair
    // errada, alguém aprova achando que liberou — e não liberou.
    buscar.mockResolvedValue({
      fila: [
        solicitacao({
          totalEstimado: 6600,
          exigeTodas: true,
          funcoesExigidas: ['GESTOR_OBRA', 'ENGENHEIRO'],
          estado: {
            faltam: ['ENGENHEIRO'],
            assinaram: ['GESTOR_OBRA'],
            reprovada: false,
            completa: false,
            resumo: 'Falta o engenheiro',
          },
        }),
      ],
      minhasFuncoes: ['ENGENHEIRO'],
    });

    montar();

    expect(await screen.findByText('1 de 2')).toBeInTheDocument();
    expect(screen.queryByText('Basta uma')).not.toBeInTheDocument();
  });
});

describe('os três estados de tela', () => {
  it('fila vazia: explica, em vez de deixar a tela em branco', async () => {
    buscar.mockResolvedValue({ fila: [], minhasFuncoes: ['GESTOR_OBRA'] });

    montar();

    expect(await screen.findByText('Nada esperando por você')).toBeInTheDocument();
  });

  it('API fora do ar: mostra o aviso e oferece tentar de novo', async () => {
    buscar.mockRejectedValue(new ErroApi('Não foi possível falar com o servidor.'));

    montar();

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('Não foi possível falar com o servidor.');
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it('enquanto carrega, avisa que está carregando', () => {
    buscar.mockReturnValue(new Promise(() => {}));

    montar();

    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i);
  });
});

describe('o resumo do topo', () => {
  it('conta como prazo apertado só o que vence em até 7 dias', async () => {
    const emDias = (d: number) =>
      new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

    buscar.mockResolvedValue({
      fila: [
        solicitacao({ id: 'a1', dataDesejada: emDias(3) }),
        solicitacao({ id: 'a2', dataDesejada: emDias(30) }),
        solicitacao({ id: 'a3', dataDesejada: null }),
      ],
      minhasFuncoes: ['GESTOR_OBRA'],
    });

    montar();

    const apertado = await screen.findByText('Prazo apertado');
    expect(apertado.closest('.cartao')).toHaveTextContent('1');
  });
});
