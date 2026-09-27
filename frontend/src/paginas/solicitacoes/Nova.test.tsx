// ============================================================
//  Abrir solicitação de compra
//
//  É a tela mais usada do sistema e a que mais dói errar: uma
//  solicitação duplicada vira cotação duplicada, pedido duplicado
//  e material chegando duas vezes na obra.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NovaSolicitacao } from './Nova';
import {
  listarObras, buscarObra, listarMateriais,
  type Obra, type ObraDetalhe, type Material,
} from '../../servicos/cadastros';
import { criarSolicitacao } from '../../servicos/solicitacoes';

vi.mock('../../servicos/cadastros', async (original) => ({
  ...(await original<typeof import('../../servicos/cadastros')>()),
  listarObras: vi.fn(),
  buscarObra: vi.fn(),
  listarMateriais: vi.fn(),
}));

vi.mock('../../servicos/solicitacoes', async (original) => ({
  ...(await original<typeof import('../../servicos/solicitacoes')>()),
  criarSolicitacao: vi.fn(),
}));

const OBRA: Obra = {
  id: 'o1', codigo: 'OB-01', nome: 'Residencial Aurora',
  cliente: null, endereco: null, cidade: null, uf: null,
  situacao: 'EM_ANDAMENTO', dataInicio: null, dataPrevisaoFim: null,
  ativa: true, linhas: 1, almoxarifados: 1,
};

const MATERIAL: Material = {
  id: 'm1', codigoInterno: 'CIM-001', descricao: 'Cimento Portland CP-II',
  tipo: 'MATERIAL', marca: null, gtin: null, normaTecnica: null,
  unidadeMedida: 'SC', pontoPedido: null, codigoLinhaPadrao: null,
  ativo: true, familia: { id: 'f1', codigo: '03', nome: 'Estrutura' },
};

const OBRA_DETALHE = { ...OBRA, linhas: [], almoxarifados: [] } as unknown as ObraDetalhe;

beforeEach(() => {
  vi.mocked(listarObras).mockReset().mockResolvedValue({ obras: [OBRA] });
  vi.mocked(listarMateriais).mockReset().mockResolvedValue({ materiais: [MATERIAL] });
  vi.mocked(buscarObra).mockReset().mockResolvedValue({ obra: OBRA_DETALHE });
  vi.mocked(criarSolicitacao).mockReset();
});

function montar() {
  render(
    <MemoryRouter>
      <NovaSolicitacao aberto aoFechar={() => {}} />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

/** Preenche o mínimo para a solicitação poder ser salva. */
async function preencher(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.selectOptions(await screen.findByLabelText(/obra/i), 'o1');
  await usuario.selectOptions(screen.getByLabelText(/item do catálogo/i), 'm1');
  await usuario.type(screen.getByLabelText(/quantidade/i), '10');
  // O botão chamava-se "+ Adicionar item à solicitação". Encurtou para
  // "Adicionar à lista" em 27/09/2026: o que se adiciona já está dito no
  // título da caixa ("Novo item"), e o botão passou a dizer PARA ONDE vai.
  await usuario.click(screen.getByRole('button', { name: /adicionar à lista/i }));
}

describe('o que impede de salvar', () => {
  it('sem obra e sem item, o botão de salvar fica travado', async () => {
    montar();

    const salvar = await screen.findByRole('button', { name: /salvar como rascunho/i });
    expect(salvar).toBeDisabled();
  });

  it('só com a obra escolhida ainda não dá para salvar: falta o item', async () => {
    const usuario = montar();

    await usuario.selectOptions(await screen.findByLabelText(/obra/i), 'o1');

    expect(screen.getByRole('button', { name: /salvar como rascunho/i })).toBeDisabled();
  });

  it('com obra e um item, libera', async () => {
    const usuario = montar();
    await preencher(usuario);

    expect(screen.getByRole('button', { name: /salvar como rascunho/i })).toBeEnabled();
  });
});

describe('clicar duas vezes', () => {
  it('não cria duas solicitações', async () => {
    // O clique duplo no canteiro de obras não é hipótese: é rotina.
    let liberar = () => {};
    vi.mocked(criarSolicitacao).mockReturnValue(
      new Promise((ok) => {
        liberar = () => ok({ solicitacao: { id: 'nova' } } as never);
      }),
    );

    const usuario = montar();
    await preencher(usuario);

    const salvar = screen.getByRole('button', { name: /salvar como rascunho/i });
    await usuario.click(salvar);

    // Enquanto salva, o botão avisa e não aceita outro clique.
    await waitFor(() => expect(screen.getByRole('button', { name: /salvando/i })).toBeDisabled());
    await usuario.click(screen.getByRole('button', { name: /salvando/i }));

    expect(criarSolicitacao).toHaveBeenCalledTimes(1);

    liberar();
  });
});

describe('quando a API recusa', () => {
  it('mostra o motivo e destrava o botão para tentar de novo', async () => {
    const { ErroApi } = await import('../../servicos/api');
    vi.mocked(criarSolicitacao).mockRejectedValue(
      new ErroApi('A obra não tem orçamento cadastrado.'),
    );

    const usuario = montar();
    await preencher(usuario);
    await usuario.click(screen.getByRole('button', { name: /salvar como rascunho/i }));

    expect(await screen.findByText('A obra não tem orçamento cadastrado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar como rascunho/i })).toBeEnabled();
  });
});

// ============================================================
//  O item digitado não pode sumir
//
//  Achado pelo dono em 27/09/2026, montando a primeira solicitação
//  de verdade. Ele pediu dois itens — cimento e argamassa — e o
//  total deu R$ 5.200 em vez de R$ 6.880.
//
//  A argamassa estava digitada na área de montagem, mas ele clicou
//  em Salvar sem clicar em "Adicionar à lista" antes. O formulário
//  salvou com um item e jogou fora o outro, em silêncio.
//
//  Perda de dado — e do tipo que passa despercebida: a solicitação
//  é criada, parece certa, e o material que falta só aparece quando
//  não chega na obra.
//
//  Nenhuma régua pega isto: não é aparência, é fluxo.
// ============================================================
describe('item começado e não adicionado', () => {
  /** Preenche a área de montagem SEM clicar em "Adicionar à lista". */
  async function comItemSolto(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.selectOptions(await screen.findByLabelText(/obra/i), 'o1');
    await usuario.selectOptions(screen.getByLabelText(/item do catálogo/i), 'm1');
    await usuario.type(screen.getByLabelText(/quantidade/i), '60');
  }

  it('o Salvar para, em vez de jogar fora', async () => {
    const usuario = montar();
    await preencher(usuario);
    await comItemSolto(usuario);

    await usuario.click(screen.getByRole('button', { name: /salvar como rascunho/i }));

    expect(criarSolicitacao).not.toHaveBeenCalled();
    expect(await screen.findByText(/ainda não está na lista/i)).toBeInTheDocument();
  });

  it('dá as duas saídas: adicionar ou descartar', async () => {
    const usuario = montar();
    await preencher(usuario);
    await comItemSolto(usuario);
    await usuario.click(screen.getByRole('button', { name: /salvar como rascunho/i }));

    // Nada é decidido pelo sistema: quem escolhe é quem digitou.
    expect(screen.getByRole('button', { name: /adicionar à lista/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /descartar/i })).toBeEnabled();
  });

  it('adicionando pelo aviso, os DOIS itens são salvos', async () => {
    vi.mocked(criarSolicitacao).mockResolvedValue({
      solicitacao: { id: 's1' },
    } as never);

    const usuario = montar();
    await preencher(usuario);
    await comItemSolto(usuario);
    await usuario.click(screen.getByRole('button', { name: /salvar como rascunho/i }));

    await usuario.click(screen.getByRole('button', { name: /adicionar à lista/i }));

    await usuario.click(screen.getByRole('button', { name: /salvar como rascunho/i }));

    await waitFor(() => expect(criarSolicitacao).toHaveBeenCalled());

    // É esta a prova: R$ 6.880 em vez de R$ 5.200.
    const enviado = vi.mocked(criarSolicitacao).mock.calls[0][0];
    expect(enviado.itens).toHaveLength(2);
  });

  it('descartando, salva só o que estava na lista', async () => {
    vi.mocked(criarSolicitacao).mockResolvedValue({
      solicitacao: { id: 's1' },
    } as never);

    const usuario = montar();
    await preencher(usuario);
    await comItemSolto(usuario);
    await usuario.click(screen.getByRole('button', { name: /salvar como rascunho/i }));
    await usuario.click(screen.getByRole('button', { name: /descartar/i }));

    await usuario.click(screen.getByRole('button', { name: /salvar como rascunho/i }));

    await waitFor(() => expect(criarSolicitacao).toHaveBeenCalled());
    expect(vi.mocked(criarSolicitacao).mock.calls[0][0].itens).toHaveLength(1);
  });
});
