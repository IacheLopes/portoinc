// ============================================================
//  O modal de solicitação
//
//  Ele faz duas coisas: abrir solicitação nova e corrigir um
//  rascunho. As duas passam pelo mesmo formulário de propósito —
//  uma segunda tela só para editar envelheceria em separado.
//
//  O que está provado aqui saiu de defeito real, achado pelo dono
//  do sistema na validação de 27/09/2026:
//
//   · Corrigir rascunho não existia na tela. O servidor sabia
//     fazer desde a Etapa 3 e nenhum botão chamava. Um erro de
//     digitação obrigava a cancelar e refazer do zero.
//
//   · A obra sem orçamento não avisava nada. Os itens nasciam sem
//     vínculo, a compra sumia do relatório de orçado x realizado, e
//     isso NÃO TEM VOLTA — nem criando o orçamento depois.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NovaSolicitacao } from './Nova';
import { listarObras, buscarObra, listarMateriais } from '../../servicos/cadastros';
import { editarSolicitacao, trocarItens, type Solicitacao } from '../../servicos/solicitacoes';

vi.mock('../../servicos/cadastros', async (original) => ({
  ...(await original<typeof import('../../servicos/cadastros')>()),
  listarObras: vi.fn(),
  buscarObra: vi.fn(),
  listarMateriais: vi.fn(),
}));

vi.mock('../../servicos/solicitacoes', async (original) => ({
  ...(await original<typeof import('../../servicos/solicitacoes')>()),
  criarSolicitacao: vi.fn(),
  editarSolicitacao: vi.fn(),
  trocarItens: vi.fn(),
}));

const obras = vi.mocked(listarObras);
const obra = vi.mocked(buscarObra);
const materiais = vi.mocked(listarMateriais);
const editar = vi.mocked(editarSolicitacao);
const trocar = vi.mocked(trocarItens);

const OBRA = { id: 'ob1', codigo: 'OB-001', nome: 'Torre A', ativa: true };

const CIMENTO = {
  id: 'm1', codigoInterno: '00001', descricao: 'Cimento CP-II-Z-32',
  tipo: 'MATERIAL', marca: null, gtin: null, normaTecnica: null,
  unidadeMedida: 'SC', pontoPedido: null, codigoLinhaPadrao: null, ativo: true,
  familia: { id: 'f1', codigo: 'CIM', nome: 'Cimento' },
};

const LINHA = { id: 'l1', codigo: '03.01.001', descricao: 'Cimento Portland' };

/** Um rascunho pronto para ser corrigido. */
function rascunho(): Solicitacao {
  return {
    id: 's1',
    numeroFormatado: 'SOL-00007',
    situacao: 'RASCUNHO',
    obra: { id: 'ob1', codigo: 'OB-001', nome: 'Torre A', cliente: null },
    justificativa: 'Laje do 3º pavimento',
    observacoes: 'Portão 2',
    dataDesejada: '2026-10-10T00:00:00.000Z',
    totalEstimado: 520,
    funcoesExigidas: [],
    exigeTodas: false,
    aprovacoes: [],
    itens: [
      {
        id: 'i1', ordem: 1,
        material: CIMENTO,
        linhaOrcamento: LINHA,
        quantidade: 10,
        unidadeMedida: 'SC',
        descricaoComplementar: null,
        especificacaoTecnica: null,
        primeiraCompra: true,
        valorEstimado: 52,
        valorTotal: 520,
      },
    ],
  } as unknown as Solicitacao;
}

function montar(props: Partial<Parameters<typeof NovaSolicitacao>[0]> = {}) {
  render(
    <MemoryRouter>
      <NovaSolicitacao aberto aoFechar={() => {}} {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  obras.mockResolvedValue({ obras: [OBRA] } as never);
  materiais.mockResolvedValue({ materiais: [CIMENTO] } as never);
  obra.mockResolvedValue({ obra: { ...OBRA, linhas: [LINHA] } } as never);
  editar.mockResolvedValue({} as never);
  trocar.mockResolvedValue({} as never);
});

describe('Corrigir um rascunho', () => {
  it('abre com o que já estava preenchido', async () => {
    montar({ editando: rascunho() });

    expect(await screen.findByDisplayValue('Laje do 3º pavimento')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Portão 2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-10-10')).toBeInTheDocument();
  });

  it('traz os itens que já estavam na lista', async () => {
    montar({ editando: rascunho() });

    // Sem isto a correção apagaria os itens: o formulário abriria
    // vazio e o Salvar mandaria uma lista vazia para o servidor.
    expect(await screen.findByText(/Cimento CP-II-Z-32/)).toBeInTheDocument();
  });

  it('o título e o botão dizem que é correção, não criação', async () => {
    montar({ editando: rascunho() });

    expect(await screen.findByText(/Corrigir SOL-00007/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvar alterações/ })).toBeInTheDocument();
  });

  it('salva o cabeçalho e os itens, e avisa a tela', async () => {
    const aoSalvarEdicao = vi.fn().mockResolvedValue(undefined);
    montar({ editando: rascunho(), aoSalvarEdicao });

    await screen.findByDisplayValue('Laje do 3º pavimento');
    await userEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }));

    await waitFor(() => expect(editar).toHaveBeenCalledWith('s1', expect.objectContaining({
      obraId: 'ob1',
      justificativa: 'Laje do 3º pavimento',
    })));

    // O item volta COM a linha de orçamento. Perder isso aqui seria
    // reintroduzir o "Sem vínculo" pela porta dos fundos.
    expect(trocar).toHaveBeenCalledWith('s1', [
      expect.objectContaining({ materialId: 'm1', quantidade: 10, linhaOrcamentoId: 'l1' }),
    ]);

    expect(aoSalvarEdicao).toHaveBeenCalled();
  });

  it('sem rascunho, é criação: nada de "Corrigir"', async () => {
    montar();

    expect(await screen.findByText(/Nova solicitação de compra/)).toBeInTheDocument();
    expect(screen.queryByText(/Corrigir/)).not.toBeInTheDocument();
  });
});

describe('Obra sem orçamento', () => {
  it('avisa, e diz que não tem volta', async () => {
    obra.mockResolvedValue({ obra: { ...OBRA, linhas: [] } } as never);
    montar({ editando: rascunho() });

    expect(await screen.findByText(/não tem orçamento cadastrado/)).toBeInTheDocument();
    expect(screen.getByText(/não tem volta/)).toBeInTheDocument();
  });

  it('não avisa quando a obra TEM orçamento', async () => {
    montar({ editando: rascunho() });

    await screen.findByDisplayValue('Laje do 3º pavimento');
    expect(screen.queryByText(/não tem orçamento cadastrado/)).not.toBeInTheDocument();
  });

  it('não avisa antes de escolher a obra', async () => {
    montar();

    await screen.findByText(/Nova solicitação de compra/);
    expect(screen.queryByText(/não tem orçamento cadastrado/)).not.toBeInTheDocument();
  });

  it('avisar não impede salvar: é aviso, não trava', async () => {
    // Obra sem orçamento é um problema de cadastro, não desta
    // compra. Travar aqui deixaria a obra inteira parada.
    obra.mockResolvedValue({ obra: { ...OBRA, linhas: [] } } as never);
    montar({ editando: rascunho(), aoSalvarEdicao: vi.fn().mockResolvedValue(undefined) });

    await screen.findByText(/não tem orçamento cadastrado/);
    expect(screen.getByRole('button', { name: /Salvar alterações/ })).toBeEnabled();
  });
});
