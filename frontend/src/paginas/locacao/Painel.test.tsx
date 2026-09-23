// ============================================================
//  Painel de locação
//
//  A locação é o único módulo em que o custo sobe sozinho: cada
//  dia parado no canteiro é mais uma diária. A tela existe para
//  que ninguém descubra isso só na fatura — então o que ela
//  precisa acertar é mostrar o atraso e o que ele está custando.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PainelLocacao } from './Painel';
import { buscarLocacoes, type Locacao, type PainelDeLocacao } from '../../servicos/locacao';

vi.mock('../../servicos/locacao', async (original) => ({
  ...(await original<typeof import('../../servicos/locacao')>()),
  buscarLocacoes: vi.fn(),
  listarItensComprados: vi.fn(),
}));

vi.mock('../../contexto/Autenticacao', () => ({
  useAutenticacao: () => ({ pode: () => true }),
}));

function contrato(ajustes: Partial<Locacao> = {}): Locacao {
  return {
    id: 'l1', numero: 1, numeroFormatado: 'LOC-00001',
    situacao: 'ATIVA', alerta: 'EM_DIA', alertaRotulo: 'Em dia',
    leitura: 'Dentro do prazo.',
    fornecedor: { id: 'f1', razaoSocial: 'Locadora Sul Ltda', nomeFantasia: 'Sul Máquinas' },
    obra: { id: 'o1', codigo: 'OB-01', nome: 'Residencial Aurora' },
    material: null, pedido: null,
    descricao: 'Betoneira 400L', identificacao: 'BT-77',
    quantidade: 1, unidadeMedida: 'UN',
    periodicidade: 'DIARIA', periodicidadeRotulo: 'Por dia', valorPeriodo: 120,
    inicioEm: '2026-09-01', previsaoDevolucao: '2026-09-30', devolvidoEm: null,
    diasDeUso: 22, periodosCobrados: 22, custoAcumulado: 2640, custoPrevisto: 3600,
    diasDeAtraso: 0, custoDoAtraso: 0,
    observacoes: null, motivo: null,
    responsavel: { id: 'u1', nome: 'Bras' }, devolvidoPor: null,
    criadoEm: '2026-09-01T10:00:00.000Z',
    ...ajustes,
  } as Locacao;
}

function painel(contratos: Locacao[], resumo: Partial<PainelDeLocacao['resumo']> = {}): PainelDeLocacao {
  return {
    contratos,
    obras: [{ id: 'o1', codigo: 'OB-01', nome: 'Residencial Aurora' }],
    resumo: {
      ativas: contratos.length, atrasadas: 0, vencendo: 0,
      custoEmAndamento: 0, desperdicio: 0, custoTotal: 0,
      ...resumo,
    },
  } as PainelDeLocacao;
}

/**
 * A célula de Atraso da linha de um contrato.
 *
 * Mirar na linha inteira não serve: "dia(s)" aparece também na coluna
 * de Devolução, e o teste acabava falando de outra coisa. Ordem das
 * colunas: Equipamento, Obra, Cobrança, Devolução, Já custou, Atraso,
 * Situação.
 */
function celulaDeAtraso(numeroDoContrato: string) {
  const linha = screen.getByRole('row', { name: new RegExp(numeroDoContrato) });
  return within(linha).getAllByRole('cell')[5];
}

function montar() {
  render(
    <MemoryRouter>
      <PainelLocacao />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

const ATRASADA = contrato({
  id: 'l2', numeroFormatado: 'LOC-00002', descricao: 'Andaime 10m',
  alerta: 'ATRASADA', alertaRotulo: 'Atrasada',
  diasDeAtraso: 6, custoDoAtraso: 720, custoAcumulado: 4320,
  leitura: 'Parada há 6 dias além do combinado.',
});

beforeEach(() => {
  vi.mocked(buscarLocacoes).mockReset();
});

describe('o que o atraso mostra', () => {
  it('contrato atrasado mostra quanto o atraso já custou e há quantos dias', async () => {
    vi.mocked(buscarLocacoes).mockResolvedValue(
      painel([ATRASADA], { atrasadas: 1, desperdicio: 720 }),
    );

    montar();

    await screen.findByText('LOC-00002');
    expect(celulaDeAtraso('LOC-00002')).toHaveTextContent('R$ 720,00');
    expect(celulaDeAtraso('LOC-00002')).toHaveTextContent('6 dia(s)');
  });

  it('contrato em dia não inventa custo de atraso: mostra um traço', async () => {
    vi.mocked(buscarLocacoes).mockResolvedValue(painel([contrato()]));

    montar();

    await screen.findByText('LOC-00001');
    expect(celulaDeAtraso('LOC-00001')).toHaveTextContent('—');
    expect(celulaDeAtraso('LOC-00001')).not.toHaveTextContent('dia(s)');
  });
});

describe('a lista "O que fazer agora"', () => {
  it('aparece quando há contrato atrasado, com a leitura em português', async () => {
    vi.mocked(buscarLocacoes).mockResolvedValue(
      painel([ATRASADA], { atrasadas: 1, desperdicio: 720 }),
    );

    montar();

    expect(await screen.findByText('O que fazer agora')).toBeInTheDocument();
    expect(screen.getByText(/Parada há 6 dias além do combinado/)).toBeInTheDocument();
  });

  it('não aparece quando está tudo em dia: nada a fazer, nada na tela', async () => {
    vi.mocked(buscarLocacoes).mockResolvedValue(painel([contrato()]));

    montar();

    expect(await screen.findByText('LOC-00001')).toBeInTheDocument();
    expect(screen.queryByText('O que fazer agora')).not.toBeInTheDocument();
  });
});

describe('download desta tela', () => {
  it('oferece PDF e Word, como todo download do sistema', async () => {
    vi.mocked(buscarLocacoes).mockResolvedValue(painel([contrato()]));

    const usuario = montar();

    await usuario.click(await screen.findByRole('button', { name: /baixar/i }));

    const opcoes = screen.getAllByRole('menuitem');
    expect(opcoes).toHaveLength(2);
    expect(opcoes.map((o) => o.textContent)).toEqual([
      expect.stringContaining('PDF'),
      expect.stringContaining('Word'),
    ]);
  });
});
