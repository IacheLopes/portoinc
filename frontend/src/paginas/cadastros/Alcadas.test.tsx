// ============================================================
//  Corrigir uma faixa tem de mostrar o que já estava lá
//
//  Apontado pelo dono em 25/09/2026: "quando clico no botão editar
//  nas alçadas, as opções marcadas antes não são herdadas".
//
//  A causa era de uma letra: as caixas são marcadas comparando com o
//  `id` da função, e eu inicializava a seleção com o `codigo`
//  ("GESTOR_OBRA"). Nada casava.
//
//  E o estrago passava do visual: quem abrisse a faixa para corrigir
//  só a descrição encontraria todas as caixas vazias e, ao salvar,
//  apagaria os aprovadores — deixando uma faixa de alçada que
//  ninguém pode assinar. A compra travaria sem explicação.
//
//  É a segunda vez que erro o preenchimento de um formulário de
//  correção. Estes testes existem para essa classe de erro.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Alcadas } from './Alcadas';
import {
  listarAlcadas, criarAlcada, editarAlcada, simularAlcada, type RegraAlcada,
} from '../../servicos/cadastros';
import { listarFuncoes } from '../../servicos/api';

vi.mock('../../servicos/cadastros', async (original) => ({
  ...(await original<typeof import('../../servicos/cadastros')>()),
  listarAlcadas: vi.fn(),
  criarAlcada: vi.fn(),
  editarAlcada: vi.fn(),
  simularAlcada: vi.fn(),
}));

vi.mock('../../servicos/api', async (original) => ({
  ...(await original<typeof import('../../servicos/api')>()),
  listarFuncoes: vi.fn(),
}));

vi.mock('../../contexto/Autenticacao', () => ({
  useAutenticacao: () => ({ pode: () => true }),
}));

const GESTOR = { id: 'f-gestor', codigo: 'GESTOR_OBRA', nome: 'Gestor de obra' };
const ENGENHEIRO = { id: 'f-eng', codigo: 'ENGENHEIRO', nome: 'Engenheiro' };
const FUNDADOR = { id: 'f-fund', codigo: 'FUNDADOR', nome: 'Fundador' };

function faixa(ajustes: Partial<RegraAlcada> = {}): RegraAlcada {
  return {
    id: 'r1',
    descricao: 'Compras de valor médio',
    valorMinimo: 5000.01,
    valorMaximo: 50000,
    exigeTodas: true,
    ordem: 2,
    ativa: true,
    funcoes: [GESTOR, ENGENHEIRO],
    ...ajustes,
  };
}

function abrir() {
  return render(
    <MemoryRouter>
      <Alcadas />
    </MemoryRouter>,
  );
}

describe('Faixas de alçada — corrigir', () => {
  beforeEach(() => {
    vi.mocked(listarAlcadas).mockResolvedValue({ regras: [faixa()], avisos: [] });
    vi.mocked(listarFuncoes).mockResolvedValue({
      funcoes: [GESTOR, ENGENHEIRO, FUNDADOR].map((f) => ({
        ...f, descricao: null, sistema: false, usuarios: 0, permissoes: [],
      })),
    });
    vi.mocked(simularAlcada).mockResolvedValue({
      valor: 7500, encontrada: false, mensagem: 'sem faixa',
    } as never);
    vi.mocked(editarAlcada).mockResolvedValue({ regra: faixa() });
  });

  it('as funções que já assinavam vêm marcadas', async () => {
    const usuario = userEvent.setup();
    abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Editar' }));

    // O defeito: vinham todas desmarcadas, porque a comparação é por
    // id e a seleção nascia com o código.
    expect(screen.getByRole('checkbox', { name: 'Gestor de obra' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Engenheiro' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Fundador' })).not.toBeChecked();
  });

  it('o resto do formulário também vem preenchido', async () => {
    const usuario = userEvent.setup();
    abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Editar' }));

    expect(screen.getByLabelText(/Descrição/)).toHaveValue('Compras de valor médio');
    expect(screen.getByLabelText(/Valor mínimo/)).toHaveValue('R$ 5.000,01');
    expect(screen.getByLabelText(/Exigir a assinatura/)).toBeChecked();
  });

  it('faixa sem teto reabre com "faixa mais alta" marcado', async () => {
    // Sem isto, corrigir só a descrição de uma faixa sem teto poria
    // um teto nela sem ninguém pedir.
    vi.mocked(listarAlcadas).mockResolvedValue({
      regras: [faixa({ valorMaximo: null, descricao: 'Compras grandes' })],
      avisos: [],
    });

    const usuario = userEvent.setup();
    abrir();
    await usuario.click(await screen.findByRole('button', { name: 'Editar' }));

    expect(screen.getByLabelText(/faixa mais alta/)).toBeChecked();
  });

  it('salvar manda PATCH com os aprovadores intactos', async () => {
    const usuario = userEvent.setup();
    abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Editar' }));

    const descricao = screen.getByLabelText(/Descrição/);
    await usuario.clear(descricao);
    await usuario.type(descricao, 'Compras médias');

    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    // O perigo real: mexer na descrição e perder quem assina.
    expect(editarAlcada).toHaveBeenCalledWith('r1', expect.objectContaining({
      descricao: 'Compras médias',
      funcoes: expect.arrayContaining([GESTOR.id, ENGENHEIRO.id]),
    }));
    expect(criarAlcada).not.toHaveBeenCalled();
  });
});
