// ============================================================
//  A lista de solicitações, e a barra de páginas nela
//
//  Esta tela é a referência das outras nove: o contador em cima,
//  a barra embaixo, o esmaecido na troca. Mesmo assim ela não
//  tinha teste nenhum — a barra de páginas inteira do sistema
//  nunca havia sido exercitada por um teste de tela.
//
//  O que está guardado aqui é o que o dono achou com o olho:
//
//  1. Clicar em "2" tem de MOSTRAR que algo aconteceu. A dúvida
//     dele foi literalmente "será que eu fui para a próxima
//     página?".
//  2. O número grande é o TOTAL, não o tamanho da página. A tela
//     dizia "200 solicitações listadas" havendo 347.
//  3. Trocar o filtro volta para a página 1 — senão a lista vem
//     vazia e parece que não existe nada naquela situação.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ListaSolicitacoes } from './Lista';
import { listarSolicitacoes, type Solicitacao } from '../../servicos/solicitacoes';

// ------------------------------------------------------------
//  O modal entra aqui como um pedaço de papel
//
//  A lista desenha <NovaSolicitacao/> dentro dela. Estes testes
//  não têm nada a ver com o modal — ele tem arquivo próprio —, e
//  carregá-lo de verdade aqui quebrava o arquivo do vizinho.
//
//  O motivo é o `isolate: false` do vitest.config: os arquivos de
//  teste dividem o mesmo cache de módulos. Quem carrega `./Nova`
//  primeiro fixa, para todos, a versão que ficou no cache — com os
//  forjados DAQUELE arquivo dentro. Rodando antes do Nova.test,
//  esta lista deixava lá um `./Nova` amarrado aos `vi.fn()` dela;
//  o Nova.test então pedia contas aos `vi.fn()` DELE, que ninguém
//  chamava, e nove testes falhavam com "0 chamadas" — às vezes,
//  conforme a ordem em que os arquivos caíam.
//
//  Igualar os forjados dos dois arquivos não resolve: cada arquivo
//  cria os seus, e o que vale é a identidade de cada função, não o
//  nome. Trocar o modal por um papel resolve, porque assim este
//  arquivo não carrega o módulo de verdade — e não há o que fixar.
//
//  A regra que sai disto: sem isolamento, dois arquivos de teste
//  não podem carregar a mesma árvore de módulos e os dois
//  forjarem pedaços dela. Um dos dois troca por papel.
//
//  (Isolar também resolveria, e custa o conjunto inteiro passar de
//  17 para 84 segundos — num container de 1 GB e um núcleo.)
// ------------------------------------------------------------
vi.mock('./Nova', () => ({
  NovaSolicitacao: () => null,
}));

vi.mock('../../servicos/solicitacoes', async (original) => ({
  ...(await original<typeof import('../../servicos/solicitacoes')>()),
  listarSolicitacoes: vi.fn(),
}));

vi.mock('../../contexto/Autenticacao', () => ({
  useAutenticacao: () => ({ usuario: { id: 'u1', nome: 'Neilma' }, pode: () => true }),
}));

const listar = vi.mocked(listarSolicitacoes);

function solicitacao(numero: number): Solicitacao {
  return {
    id: 's' + numero,
    numero,
    numeroFormatado: 'SOL-' + String(numero).padStart(5, '0'),
    situacao: 'EM_APROVACAO',
    obra: { id: 'o1', codigo: 'OB-01', nome: 'Residencial Aurora', cliente: null },
    solicitante: { id: 'u1', nome: 'Neilma', email: 'neilma@teste.com.br' },
    justificativa: null,
    observacoes: null,
    dataDesejada: '2026-10-20T12:00:00.000Z',
    criadaEm: '2026-10-01T12:00:00.000Z',
    enviadaEm: null,
    decididaEm: null,
    validadaEm: null,
    validadaPor: null,
    itens: [],
    totalEstimado: 1000,
    podeEditar: false,
    exigeTodas: false,
    funcoesExigidas: [],
    estadoAprovacao: {
      faltam: [], assinaram: [], reprovada: false, completa: false, resumo: '',
    },
    aprovacoes: [],
  } as unknown as Solicitacao;
}

/** A resposta do servidor: as linhas da página mais a conta. */
function pagina(numeros: number[], total: number, qual = 1) {
  return {
    solicitacoes: numeros.map(solicitacao),
    vendoTodas: true,
    total,
    pagina: qual,
    porPagina: 20,
    paginas: Math.max(1, Math.ceil(total / 20)),
  };
}

function montar() {
  render(
    <MemoryRouter>
      <ListaSolicitacoes />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

/** Os números que a barra de páginas oferece, na ordem. */
function botoesDaBarra() {
  const barra = screen.getByRole('navigation', { name: /páginas da lista/i });
  return within(barra)
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));
}

beforeEach(() => {
  listar.mockReset();
});

describe('o número que a tela mostra', () => {
  it('conta o que EXISTE, não o que chegou', async () => {
    // Vinte linhas em mão, trezentas e quarenta e sete no banco.
    listar.mockResolvedValue(pagina([1, 2, 3], 347));

    montar();

    // A frase que a tela dizia antes era "20 solicitações
    // listadas" — o tamanho do pacote que chegou.
    expect(await screen.findByText(/de 347 solicitações/)).toBeInTheDocument();
  });

  it('com uma página só, diz o número e não desenha barra', async () => {
    listar.mockResolvedValue(pagina([1, 2, 3], 3));

    montar();

    expect(await screen.findByText('3 solicitações')).toBeInTheDocument();
    // Barra com um botão só é moldura: não leva a lugar nenhum.
    expect(
      screen.queryByRole('navigation', { name: /páginas da lista/i }),
    ).not.toBeInTheDocument();
  });

  it('diz de onde a onde vai a página aberta', async () => {
    listar.mockResolvedValue(pagina([1, 2], 68));

    const usuario = montar();
    await screen.findByText(/de 68 solicitações/);

    listar.mockResolvedValue(pagina([21, 22], 68, 2));
    await usuario.click(screen.getByRole('button', { name: 'Página 2' }));

    expect(await screen.findByText('Mostrando 21 a 40 de 68 solicitações')).toBeInTheDocument();
  });
});

describe('a barra de páginas', () => {
  it('oferece começo, fim, anterior, próxima e os números', async () => {
    listar.mockResolvedValue(pagina([1], 200));

    montar();

    await screen.findByText(/de 200 solicitações/);

    // Dez páginas não cabem como dez botões, e não é para caber: a
    // janela mostra a atual, a vizinha e SEMPRE a última, com a
    // reticência marcando o que ficou no meio.
    //
    //   « ‹ [1] 2 … 10 › »
    expect(botoesDaBarra()).toEqual([
      'Primeira página',
      'Página anterior',
      'Página 1',
      'Página 2',
      'Página 10',
      'Próxima página',
      'Última página',
    ]);
  });

  it('na página 1 não dá para voltar', async () => {
    listar.mockResolvedValue(pagina([1], 200));

    montar();
    await screen.findByText(/de 200 solicitações/);

    expect(screen.getByRole('button', { name: 'Primeira página' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeEnabled();
  });

  it('clicar num número pede aquela página ao servidor', async () => {
    listar.mockResolvedValue(pagina([1], 200));

    const usuario = montar();
    await screen.findByText(/de 200 solicitações/);

    listar.mockResolvedValue(pagina([21], 200, 2));
    await usuario.click(screen.getByRole('button', { name: 'Página 2' }));

    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2 }));

    // Da página 2, a janela já oferece a 3 — ela anda com a pessoa.
    listar.mockResolvedValue(pagina([41], 200, 3));
    await usuario.click(screen.getByRole('button', { name: 'Página 3' }));

    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 3 }));
  });

  it('a última página é um número, e leva ao fim', async () => {
    listar.mockResolvedValue(pagina([1], 200));

    const usuario = montar();
    await screen.findByText(/de 200 solicitações/);

    // "10" aparece como NÚMERO, e não só como seta de "ir ao fim":
    // ver o número conta o tamanho do conjunto, uma seta não conta
    // nada.
    listar.mockResolvedValue(pagina([181], 200, 10));
    await usuario.click(screen.getByRole('button', { name: 'Página 10' }));

    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 10 }));
  });

  it('diz qual página está aberta, para quem usa leitor de tela', async () => {
    listar.mockResolvedValue(pagina([1], 200));

    const usuario = montar();
    await screen.findByText(/de 200 solicitações/);

    listar.mockResolvedValue(pagina([21], 200, 2));
    await usuario.click(screen.getByRole('button', { name: 'Página 2' }));

    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Página 1' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});

describe('trocar o filtro', () => {
  it('volta para a página 1', async () => {
    // A armadilha: na última página, filtrar e cair numa página
    // que não existe mais naquele filtro. A lista vem vazia e
    // parece que não há nada naquela situação.
    listar.mockResolvedValue(pagina([1], 200));

    const usuario = montar();
    await screen.findByText(/de 200 solicitações/);

    listar.mockResolvedValue(pagina([181], 200, 10));
    await usuario.click(screen.getByRole('button', { name: 'Última página' }));
    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 10 }));

    listar.mockResolvedValue(pagina([1], 12));
    await usuario.selectOptions(screen.getByLabelText('Situação'), 'RASCUNHO');

    expect(listar).toHaveBeenLastCalledWith({
      situacao: 'RASCUNHO',
      apenasMinhas: false,
      pagina: 1,
    });
  });

  it('pede a lista uma vez por filtro, não duas', async () => {
    // Se a volta para a página 1 fosse feita num efeito, filtrar
    // na página 10 sairia à rede duas vezes: uma com a 10 e outra
    // com a 1. Fora o desperdício, a resposta atrasada da primeira
    // pode chegar depois e pintar a página errada.
    listar.mockResolvedValue(pagina([1], 200));

    const usuario = montar();
    await screen.findByText(/de 200 solicitações/);

    listar.mockResolvedValue(pagina([181], 200, 10));
    await usuario.click(screen.getByRole('button', { name: 'Última página' }));

    listar.mockClear();
    listar.mockResolvedValue(pagina([1], 12));
    await usuario.selectOptions(screen.getByLabelText('Situação'), 'RASCUNHO');

    expect(listar).toHaveBeenCalledTimes(1);
  });
});
