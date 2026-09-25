// ============================================================
//  Corrigir o que já foi cadastrado
//
//  Pedido pelo dono durante a validação, logo depois de cadastrar a
//  primeira família: "deveríamos pôr um modal quando for adicionado
//  uma família ou materiais para editar, em caso da pessoa errar
//  alguma coisa".
//
//  O servidor aceitava `PATCH` desde sempre. Faltava a tela — e sem
//  ela um erro de digitação no código ficava para sempre, num campo
//  que aparece em filtro, em relatório e na tela de material.
//
//  O mesmo modal cria e corrige. Estes testes guardam o que separa
//  os dois modos.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Familias } from './Familias';
import { listarFamilias, criarFamilia, editarFamilia, type Familia } from '../../servicos/cadastros';

vi.mock('../../servicos/cadastros', async (original) => ({
  ...(await original<typeof import('../../servicos/cadastros')>()),
  listarFamilias: vi.fn(),
  criarFamilia: vi.fn(),
  editarFamilia: vi.fn(),
}));

vi.mock('../../contexto/Autenticacao', () => ({
  useAutenticacao: () => ({ pode: () => true }),
}));

function familia(ajustes: Partial<Familia> = {}): Familia {
  return {
    id: 'f1',
    codigo: 'CIM',
    nome: 'Cimento e argamassas',
    descricao: 'Cimento, cal, argamassa e rejunte',
    ativa: true,
    materiais: 3,
    fornecedores: 2,
    ...ajustes,
  };
}

function abrir() {
  return render(
    <MemoryRouter>
      <Familias />
    </MemoryRouter>,
  );
}

describe('Famílias — corrigir o que já existe', () => {
  beforeEach(() => {
    vi.mocked(listarFamilias).mockResolvedValue({ familias: [familia()] });
    vi.mocked(editarFamilia).mockResolvedValue({ familia: familia() });
    vi.mocked(criarFamilia).mockResolvedValue({ familia: familia() });
  });

  it('cada família cadastrada oferece Editar', async () => {
    abrir();
    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('o modal abre com o que já estava salvo', async () => {
    const usuario = userEvent.setup();
    abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Editar' }));

    // Sem isto a pessoa teria de redigitar tudo para corrigir uma letra.
    expect(screen.getByLabelText(/Código/)).toHaveValue('CIM');
    expect(screen.getByLabelText(/Nome/)).toHaveValue('Cimento e argamassas');
    expect(screen.getByRole('heading', { name: 'Editar família' })).toBeInTheDocument();
  });

  it('salvar manda PATCH para aquela família, e não cria outra', async () => {
    const usuario = userEvent.setup();
    abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Editar' }));

    const nome = screen.getByLabelText(/Nome/);
    await usuario.clear(nome);
    await usuario.type(nome, 'Cimento, cal e argamassas');

    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(editarFamilia).toHaveBeenCalledWith('f1', expect.objectContaining({
      codigo: 'CIM',
      nome: 'Cimento, cal e argamassas',
    }));
    // O perigo real: corrigir e acabar com duas famílias iguais.
    expect(criarFamilia).not.toHaveBeenCalled();
  });

  it('o botão de criar continua criando', async () => {
    const usuario = userEvent.setup();
    abrir();

    await usuario.click(await screen.findByRole('button', { name: '+ Nova família' }));

    expect(screen.getByRole('heading', { name: 'Nova família' })).toBeInTheDocument();
    // Nasce vazio: nada do que estava na tela antes pode vazar para cá.
    expect(screen.getByLabelText(/Código/)).toHaveValue('');
    expect(screen.getByLabelText(/Nome/)).toHaveValue('');
  });

  it('o cartão mostra o código e a contagem', async () => {
    abrir();
    const cartao = (await screen.findByText('Cimento e argamassas')).closest('section');

    expect(within(cartao as HTMLElement).getByText('CIM')).toBeInTheDocument();
  });
});
