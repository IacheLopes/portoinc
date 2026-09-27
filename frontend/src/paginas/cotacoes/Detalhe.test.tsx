// ============================================================
//  O pacote de cotação, ainda em rascunho
//
//  O passo que vem PRIMEIRO é convidar os fornecedores; abrir a
//  cotação vem depois. A tela dizia o contrário com a hierarquia:
//
//    · "Abrir cotação e convidar"  — botão principal, azul, no topo
//    · "Adicionar 2 ao pacote"     — botão secundário, embaixo
//
//  O olho vai no azul. O dono do sistema marcou os dois
//  fornecedores, clicou em cima e levou "Convide pelo menos um
//  fornecedor" — uma recusa que parece mentira para quem acabou de
//  marcar dois. 27/09/2026.
//
//  E a palavra "convidar" queria dizer três coisas: o nome da
//  coluna, o botão que de fato convida, e o botão que não convida.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DetalheCotacao } from './Detalhe';
import {
  buscarCotacao, fornecedoresSugeridos, convidarFornecedores,
  type Cotacao, type FornecedorSugerido,
} from '../../servicos/cotacoes';

vi.mock('../../servicos/cotacoes', async (original) => ({
  ...(await original<typeof import('../../servicos/cotacoes')>()),
  buscarCotacao: vi.fn(),
  fornecedoresSugeridos: vi.fn(),
  convidarFornecedores: vi.fn(),
  abrirCotacao: vi.fn(),
}));

vi.mock('../../contexto/Autenticacao', () => ({
  useAutenticacao: () => ({ usuario: { id: 'u1', nome: 'Neilma' }, pode: () => true }),
}));

const buscar = vi.mocked(buscarCotacao);
const sugeridos = vi.mocked(fornecedoresSugeridos);
const convidar = vi.mocked(convidarFornecedores);

function fornecedor(id: string, nome: string, jaConvidado = false): FornecedorSugerido {
  return {
    id, razaoSocial: nome + ' Ltda', nomeFantasia: nome, cnpj: '47960950000121',
    whatsapp: '5511998565432', email: nome.toLowerCase() + '@teste.com.br',
    familias: [{ id: 'f1', codigo: 'CIM', nome: 'Cimento' }],
    cobertura: 2, jaConvidado,
  };
}

function cotacao(parte: Partial<Cotacao> = {}): Cotacao {
  return {
    id: 'b1', numero: 1, numeroFormatado: 'BID-00001',
    titulo: 'Laje 3º pavimento', situacao: 'RASCUNHO',
    comprador: { id: 'u1', nome: 'Neilma' },
    prazoResposta: '2026-10-06T00:00:00.000Z',
    observacoes: null,
    criadoEm: '2026-09-27T12:00:00.000Z',
    abertoEm: null, encerradoEm: null,
    itens: [], convidados: [],
    podeEditar: true, respostasRecebidas: 0,
    ...parte,
  } as Cotacao;
}

function montar() {
  render(
    <MemoryRouter initialEntries={['/cotacoes/b1']}>
      <Routes>
        <Route path="/cotacoes/:id" element={<DetalheCotacao />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  buscar.mockResolvedValue({ cotacao: cotacao() } as never);
  sugeridos.mockResolvedValue({
    fornecedores: [fornecedor('f1', 'Constrular'), fornecedor('f2', 'Marquilip')],
  } as never);
  convidar.mockResolvedValue({} as never);
});

describe('A ordem dos dois passos', () => {
  it('sem ninguém no pacote, não dá para abrir a cotação', async () => {
    montar();

    // Recusar DEPOIS do clique é pior que não deixar clicar: a
    // pessoa já fez o esforço e leva uma mensagem que soa errada.
    const abrir = await screen.findByRole('button', { name: /Abrir cotação/ });
    expect(abrir).toBeDisabled();
    expect(screen.getByText(/Convide pelo menos um fornecedor abaixo/)).toBeInTheDocument();
  });

  it('com fornecedor convidado, abrir libera', async () => {
    buscar.mockResolvedValue({
      cotacao: cotacao({
        convidados: [{ id: 'c1', fornecedor: { id: 'f1', nomeFantasia: 'Constrular' } }],
      } as Partial<Cotacao>),
    } as never);

    montar();

    await waitFor(async () =>
      expect(await screen.findByRole('button', { name: /Abrir cotação/ })).toBeEnabled(),
    );
  });

  it('o botão de abrir não promete convidar', async () => {
    // Dizia "Abrir cotação e convidar" e não convidava nada.
    montar();

    await screen.findByRole('button', { name: /Abrir cotação/ });
    expect(screen.queryByRole('button', { name: /Abrir cotação e convidar/ })).toBeNull();
  });
});

describe('O botão que realmente convida', () => {
  it('usa o verbo "convidar", igual ao resto da tela', async () => {
    // Chamava-se "Adicionar ao pacote" enquanto a coluna dos
    // checkboxes se chamava "Convidar". Dois nomes, uma ação.
    montar();

    expect(
      await screen.findByRole('button', { name: /Convidar 2 fornecedores/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar .* ao pacote/ })).toBeNull();
  });

  it('os sugeridos já vêm marcados: só falta apertar', async () => {
    // Isto é o que torna a confusão tão fácil de cair. Ao abrir a
    // tela os dois fornecedores JÁ estão marcados e o botão já diz
    // "Convidar 2" — parece tudo pronto. Quem não repara nele vai
    // no azul do topo e leva a recusa.
    montar();

    const caixas = await screen.findAllByRole('checkbox');
    expect(caixas.every((c) => (c as HTMLInputElement).checked)).toBe(true);
  });

  it('conta quantos estão marcados, no singular e no plural', async () => {
    montar();

    const caixas = await screen.findAllByRole('checkbox');

    await userEvent.click(caixas[1]);
    expect(screen.getByRole('button', { name: /Convidar 1 fornecedor$/ })).toBeInTheDocument();

    await userEvent.click(caixas[0]);
    expect(screen.getByRole('button', { name: /Convidar fornecedores$/ })).toBeInTheDocument();
  });

  it('desmarcando todos, ele fica desligado', async () => {
    montar();

    const caixas = await screen.findAllByRole('checkbox');
    await userEvent.click(caixas[0]);
    await userEvent.click(caixas[1]);

    expect(screen.getByRole('button', { name: /Convidar fornecedores$/ })).toBeDisabled();
    expect(screen.getByText(/Marque quem deve receber/)).toBeInTheDocument();
  });

  it('avisa que convidar ainda não envia nada', async () => {
    // "Convidar" pode soar como "mandar mensagem agora". Não é: o
    // envio é o passo seguinte, e com as integrações travadas nem
    // isso sai. Dizer isso aqui evita o susto.
    montar();

    await screen.findByRole('button', { name: /Convidar 2 fornecedores/ });
    expect(screen.getByText(/Nada é enviado agora/)).toBeInTheDocument();
  });

  it('convidar chama o servidor com quem está marcado', async () => {
    montar();

    await userEvent.click(await screen.findByRole('button', { name: /Convidar 2 fornecedores/ }));

    await waitFor(() => expect(convidar).toHaveBeenCalledWith('b1', ['f1', 'f2']));
  });
});
