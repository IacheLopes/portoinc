// ============================================================
//  Receitas e despesas
//
//  O que esta tela precisa acertar é a resposta à pergunta que o
//  financeiro não sabia dar: quanto a Porto Inc. tem.
//
//  Então os testes olham para três coisas:
//    1. o saldo aparece, e muda de tom quando fica negativo;
//    2. entrada e saída se distinguem na lista sem depender de cor;
//    3. quem só enxerga o financeiro não vê botão de mexer.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Lancamentos } from './Lancamentos';
import {
  listarLancamentos, buscarCaixa, criarLancamento,
  type Lancamento, type Caixa, type FatiaDeCategoria, type SemanaDoCaixa,
} from '../../servicos/lancamentos';

vi.mock('../../servicos/lancamentos', async (original) => ({
  ...(await original<typeof import('../../servicos/lancamentos')>()),
  listarLancamentos: vi.fn(),
  buscarCaixa: vi.fn(),
  criarLancamento: vi.fn(),
  realizarLancamento: vi.fn(),
  cancelarLancamento: vi.fn(),
  editarLancamento: vi.fn(),
}));

vi.mock('../../servicos/cadastros', async (original) => ({
  ...(await original<typeof import('../../servicos/cadastros')>()),
  listarObras: vi.fn(async () => ({
    obras: [{ id: 'o1', codigo: 'OB-01', nome: 'Residencial Aurora' }],
  })),
}));

let podeGerenciar = true;

vi.mock('../../contexto/Autenticacao', () => ({
  useAutenticacao: () => ({ pode: () => podeGerenciar }),
}));

function lancamento(ajustes: Partial<Lancamento> = {}): Lancamento {
  return {
    id: 'l1',
    numeroFormatado: 'LC-00001',
    tipo: 'RECEITA',
    descricao: 'Medição 3 — Residencial Aurora',
    valor: 185000,
    previstoPara: '2026-10-05T12:00:00.000Z',
    realizadoEm: '2026-10-05T12:00:00.000Z',
    situacao: 'REALIZADO',
    aberturaDeCaixa: false,
    categoria: 'Medição de obra',
    formaPagamento: 'Transferência',
    observacoes: null,
    obra: { id: 'o1', codigo: 'OB-01', nome: 'Residencial Aurora' },
    criadoPor: 'Neilma',
    criadoEm: '2026-10-05T12:00:00.000Z',
    ...ajustes,
  };
}

function caixa(ajustes: Partial<Caixa> = {}): Caixa {
  return {
    entrou: 185000,
    aberturaDeCaixa: 0,
    faturou: 185000,
    saiu: 42000,
    saldo: 143000,
    aReceber: 90000,
    aPagar: 31000,
    previsto: 202000,
    detalhe: {
      comprasPagas: 38800,
      despesasFeitas: 3200,
      comprasEmAberto: 29500,
      despesasPrevistas: 1500,
    },
    ...ajustes,
  };
}

/** As análises são opcionais: quase todo teste fala só da lista. */
interface Analises {
  deOndeVem?: FatiaDeCategoria[];
  paraOndeVai?: FatiaDeCategoria[];
  calendario?: SemanaDoCaixa[];
}

function montar(
  lista: Lancamento[],
  dinheiroEmCaixa = caixa(),
  analises: Analises = {},
) {
  vi.mocked(listarLancamentos).mockResolvedValue({
    lancamentos: lista,
    total: lista.length,
    pagina: 1,
    porPagina: 20,
    paginas: 1,
  });
  vi.mocked(buscarCaixa).mockResolvedValue({
    caixa: dinheiroEmCaixa,
    deOndeVem: analises.deOndeVem ?? [],
    paraOndeVai: analises.paraOndeVai ?? [],
    calendario: analises.calendario ?? [],
    semanas: 6,
    obraId: null,
  });

  return render(
    <MemoryRouter>
      <Lancamentos />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  podeGerenciar = true;
});

describe('O saldo', () => {
  it('mostra quanto entrou, quanto saiu e quanto sobrou', async () => {
    montar([lancamento()]);

    expect(await screen.findByText('R$ 143.000,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 185.000,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 42.000,00')).toBeInTheDocument();
  });

  it('separa as duas origens da saída, para o número não ficar misterioso', async () => {
    // Um "saiu" sozinho não diz se o problema é compra ou custo de
    // operação — e são dois assuntos com dois donos.
    montar([lancamento()]);

    expect(
      await screen.findByText(/Compras R\$ 38\.800,00 · avulsas R\$ 3\.200,00/),
    ).toBeInTheDocument();
  });

  it('avisa quando saiu mais do que entrou', async () => {
    montar([lancamento()], caixa({ entrou: 1000, saiu: 4000, saldo: -3000 }));

    expect(await screen.findByText('-R$ 3.000,00')).toBeInTheDocument();
    expect(screen.getByText('Saiu mais do que entrou')).toBeInTheDocument();
  });

  it('não finge entrada quando não há nenhuma', async () => {
    montar([], caixa({ entrou: 0, saiu: 0, saldo: 0, aReceber: 0, aPagar: 0, previsto: 0 }));

    expect(await screen.findByText('Nenhuma entrada registrada ainda')).toBeInTheDocument();
  });
});

describe('A lista', () => {
  it('distingue entrada de saída sem depender da cor', async () => {
    // Quem não distingue as cores tem de conseguir ler a mesma
    // informação: o sinal vem no texto do valor, e a linha extra
    // sob o número diz "entrada" ou "saída".
    montar([
      lancamento(),
      lancamento({
        id: 'l2',
        numeroFormatado: 'LC-00002',
        tipo: 'DESPESA',
        descricao: 'Combustível da frota',
        valor: 3200,
        categoria: 'Frota',
      }),
    ]);

    // Dentro da LINHA, e não na página toda: o rodapé da lista
    // também soma a página, e com uma receita só os dois números
    // são iguais — a busca solta acharia os dois.
    const entrada = (await screen.findByText('LC-00001')).closest('tr')!;
    const saida = screen.getByText('LC-00002').closest('tr')!;

    expect(within(entrada).getByText('+ R$ 185.000,00')).toBeInTheDocument();
    expect(within(saida).getByText('− R$ 3.200,00')).toBeInTheDocument();

    expect(within(entrada).getByText(/entrada/)).toBeInTheDocument();
    expect(within(saida).getByText(/saída · Frota/)).toBeInTheDocument();
  });

  it('o rótulo da situação fala a língua do tipo', async () => {
    // "Realizado" obrigaria a traduzir de cabeça: para a receita o
    // dinheiro CAIU, para a despesa ele SAIU.
    montar([
      lancamento({ situacao: 'PREVISTO', realizadoEm: null }),
      lancamento({
        id: 'l2', numeroFormatado: 'LC-00002', tipo: 'DESPESA',
        situacao: 'PREVISTO', realizadoEm: null, descricao: 'Aluguel do container',
      }),
    ]);

    expect(await screen.findByText('A receber')).toBeInTheDocument();
    expect(screen.getByText('A pagar')).toBeInTheDocument();
  });

  it('diz "Empresa" no que não é de obra', async () => {
    // O aporte dos sócios não é de obra nenhuma, e a célula vazia
    // pareceria dado que faltou carregar.
    montar([lancamento({ obra: null, descricao: 'Aporte dos sócios' })]);

    expect(await screen.findByText('Empresa')).toBeInTheDocument();
    expect(screen.getByText('não é de obra')).toBeInTheDocument();
  });

  it('a data de cima é a mesma por que a lista se ordena', async () => {
    // Previsto para 05/10, pago em 20/10: a coluna mostra 05/10 — que
    // é por onde a lista ordena — e diz embaixo quando o dinheiro
    // andou. Mostrando 20/10 em cima, a coluna pareceria fora de
    // ordem sem que nada estivesse errado.
    montar([
      lancamento({
        previstoPara: '2026-10-05T12:00:00.000Z',
        realizadoEm: '2026-10-20T12:00:00.000Z',
      }),
    ]);

    expect(await screen.findByText('05/10/2026')).toBeInTheDocument();
    expect(screen.getByText('aconteceu 20/10/2026')).toBeInTheDocument();
  });

  it('não repete a data quando o dinheiro andou no mesmo dia', async () => {
    montar([lancamento()]);

    expect(await screen.findByText('aconteceu')).toBeInTheDocument();
  });

  it('o cancelado continua na lista', async () => {
    montar([lancamento({ situacao: 'CANCELADO', realizadoEm: null })]);

    expect(await screen.findByText('LC-00001')).toBeInTheDocument();
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
  });

  it('convida a lançar quando não há nada', async () => {
    montar([]);

    expect(await screen.findByText('Nenhum lançamento por aqui')).toBeInTheDocument();
  });
});

describe('Quem pode mexer', () => {
  it('quem gerencia tem os dois botões de lançar', async () => {
    montar([lancamento()]);

    expect(await screen.findByRole('button', { name: /Lançar entrada/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lançar saída/ })).toBeInTheDocument();
  });

  it('quem só enxerga não vê botão de lançar nem menu de ações', async () => {
    podeGerenciar = false;
    montar([lancamento()]);

    expect(await screen.findByText('LC-00001')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lançar entrada/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ações do lançamento/ })).not.toBeInTheDocument();
  });
});

describe('Lançar', () => {
  it('manda o valor em número, não o texto com máscara', async () => {
    vi.mocked(criarLancamento).mockResolvedValue({
      lancamento: lancamento({ numeroFormatado: 'LC-00009', valor: 1234.56 }),
    });

    montar([lancamento()]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole('button', { name: /Lançar entrada/ }));

    await usuario.type(await screen.findByLabelText(/Descrição/), 'Medição 4');
    await usuario.type(screen.getByLabelText(/Valor/), '1234,56');
    await usuario.click(screen.getByRole('button', { name: 'Lançar' }));

    expect(criarLancamento).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'RECEITA', valor: 1234.56, descricao: 'Medição 4' }),
    );
  });

  it('recusa valor zero antes de chamar o servidor', async () => {
    montar([lancamento()]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole('button', { name: /Lançar saída/ }));
    await usuario.type(await screen.findByLabelText(/Descrição/), 'Tentativa');
    await usuario.type(screen.getByLabelText(/Valor/), '0');
    await usuario.click(screen.getByRole('button', { name: 'Lançar' }));

    expect(criarLancamento).not.toHaveBeenCalled();
    expect(screen.getByText('Informe um valor maior que zero.')).toBeInTheDocument();
  });

  it('o botão de saída abre o formulário já como saída', async () => {
    montar([lancamento()]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole('button', { name: /Lançar saída/ }));

    expect(
      await screen.findByText(/Despesa que não vem de compra/),
    ).toBeInTheDocument();
  });
});
