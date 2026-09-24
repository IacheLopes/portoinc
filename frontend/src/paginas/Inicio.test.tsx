// ============================================================
//  A tela inicial
//
//  É a primeira coisa que abre de manhã. Os erros possíveis aqui
//  são silenciosos: mostrar "tudo em dia" quando a chamada falhou,
//  ou deixar a tela em branco enquanto carrega. Nos dois casos a
//  pessoa vai embora achando que não há nada para fazer.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Inicio } from './Inicio';
import { buscarInicio, type ResumoDoInicio, type CartaoDoInicio } from '../servicos/inicio';
import { ErroApi } from '../servicos/api';

vi.mock('../servicos/inicio', async (original) => ({
  ...(await original<typeof import('../servicos/inicio')>()),
  buscarInicio: vi.fn(),
}));

// Quem entrou pode mudar de um teste para o outro: a tela se comporta
// de um jeito para pessoa da empresa e de outro para a conta que
// acumula todas as funcoes.
const quem = vi.hoisted(() => ({ nome: 'Neilma Souza', funcoes: ['ALMOXARIFE'] }));

vi.mock('../contexto/Autenticacao', () => ({
  useAutenticacao: () => ({
    usuario: {
      id: 'u1',
      nome: quem.nome,
      email: 'neilma@portoinc.com.br',
      precisaTrocarSenha: false,
      funcoes: quem.funcoes,
      permissoes: ['estoque.ver'],
    },
    pode: () => true,
  }),
}));

const buscar = vi.mocked(buscarInicio);

function cartao(extra: Partial<CartaoDoInicio> = {}): CartaoDoInicio {
  return {
    chave: 'contasVencidas',
    rotulo: 'Contas vencidas',
    valor: 3,
    detalhe: '3 parcelas passaram do vencimento',
    tom: 'erro',
    para: '/financeiro?ver=vencidas',
    ...extra,
  };
}

function resumo(extra: Partial<ResumoDoInicio> = {}): ResumoDoInicio {
  return { urgentes: [], acompanhar: [], ...extra };
}

function montar() {
  render(
    <MemoryRouter>
      <Inicio />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  buscar.mockReset();
});

describe('os três estados', () => {
  it('enquanto carrega, avisa que está carregando', () => {
    buscar.mockReturnValue(new Promise(() => {}));

    montar();

    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i);
  });

  it('API fora do ar: mostra o aviso e oferece tentar de novo', async () => {
    buscar.mockRejectedValue(new ErroApi('Não foi possível falar com o servidor.'));

    montar();

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('Não foi possível falar com o servidor.');
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it('nada urgente: diz que está tudo em dia, em vez de uma faixa vazia', async () => {
    buscar.mockResolvedValue(resumo({ acompanhar: [cartao({ valor: 0, tom: 'neutro' })] }));

    montar();

    expect(await screen.findByText('Nada esperando por você.')).toBeInTheDocument();
  });
});

describe('o que pede ação', () => {
  it('mostra o número e o que ele significa', async () => {
    buscar.mockResolvedValue(resumo({ urgentes: [cartao()] }));

    montar();

    expect(await screen.findByText('3 parcelas passaram do vencimento')).toBeInTheDocument();
    expect(screen.queryByText('Nada esperando por você.')).not.toBeInTheDocument();
  });

  it('o cartão inteiro leva até a tela do problema', async () => {
    // Um número que aponta um problema e não leva até ele obriga a
    // pessoa a procurar a tela certa sozinha.
    buscar.mockResolvedValue(resumo({ urgentes: [cartao()] }));

    montar();

    const link = await screen.findByRole('link', { name: /contas vencidas/i });
    expect(link).toHaveAttribute('href', '/financeiro?ver=vencidas');
  });

  it('o peso vem do servidor, e a tela não recalcula', async () => {
    // Se a tela decidisse sozinha o que é grave, ela e a fila de
    // aprovação poderiam discordar sobre o mesmo número.
    buscar.mockResolvedValue(resumo({ urgentes: [cartao({ tom: 'atencao' })] }));

    montar();

    const link = await screen.findByRole('link', { name: /contas vencidas/i });
    expect(link.className).toContain('indicador--atencao');
    expect(link.className).not.toContain('indicador--erro');
  });
});

describe('o aviso de andamento do projeto', () => {
  it('fica no fim, e não no lugar mais valioso da tela', async () => {
    buscar.mockResolvedValue(resumo({ urgentes: [cartao()] }));

    montar();

    const urgente = await screen.findByText('3 parcelas passaram do vencimento');
    const nota = screen.getByText(/modo de teste/i);

    // compareDocumentPosition: 4 = o segundo vem DEPOIS do primeiro.
    expect(urgente.compareDocumentPosition(nota) & 4).toBeTruthy();
  });
});

// ------------------------------------------------------------
//  A conta que enxerga tudo não é uma pessoa
//
//  Ela dizia "Bom dia, DEV-Porto" e "Você está no sistema como
//  administrador e fundador e gestor obra e...". Cumprimentava uma
//  conta de sistema como gente, e fazia parecer que existe alguém
//  com sete cargos. Pior: os números da tela são da empresa
//  inteira, e "O que precisa de VOCÊ" dava a entender que eram dela.
// ------------------------------------------------------------
describe('A conta de desenvolvimento se apresenta como tal', () => {
  const AS_SETE = [
    'ADMINISTRADOR', 'FUNDADOR', 'GESTOR_OBRA', 'ENGENHEIRO',
    'COMPRADOR', 'SOLICITANTE', 'ALMOXARIFE',
  ];

  afterEach(() => {
    quem.nome = 'Neilma Souza';
    quem.funcoes = ['ALMOXARIFE'];
  });

  it('troca a saudação pelo nome da conta', async () => {
    quem.nome = 'DEV-Porto';
    quem.funcoes = AS_SETE;
    buscar.mockResolvedValue({ urgentes: [], acompanhar: [] });

    montar();

    expect(await screen.findByText('Conta de Desenvolvedor')).toBeInTheDocument();
    expect(screen.queryByText(/Bom dia|Boa tarde|Boa noite/)).not.toBeInTheDocument();
  });

  it('avisa que os números são da empresa, não dela', async () => {
    quem.nome = 'DEV-Porto';
    quem.funcoes = AS_SETE;
    buscar.mockResolvedValue({ urgentes: [cartao()], acompanhar: [] });

    montar();

    expect(await screen.findByText(/da empresa inteira/)).toBeInTheDocument();
    expect(screen.getByText('O que precisa de alguém')).toBeInTheDocument();
  });

  it('para gente da empresa, continua cumprimentando', async () => {
    buscar.mockResolvedValue({ urgentes: [cartao()], acompanhar: [] });

    montar();

    expect(await screen.findByText(/Neilma/)).toBeInTheDocument();
    expect(screen.getByText('O que precisa de você')).toBeInTheDocument();
  });
});
