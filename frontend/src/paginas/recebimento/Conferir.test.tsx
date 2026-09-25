// ============================================================
//  Conferência da entrega
//
//  A tela é usada em pé, com o caminhão no portão. Os testes daqui
//  guardam o que foi consertado em 24/09/2026, depois que o dono
//  fotografou a tela no computador e no iPhone:
//
//    · duas navegações empilhadas dizendo a mesma coisa;
//    · o selo de situação caindo para baixo do título;
//    · sete colunas — três delas só de consulta — com o mesmo peso
//      da coluna onde se digita, o que no celular virava sete
//      blocos por item e mais de uma tela de rolagem;
//    · o texto de ajuda dentro do `.campo`, empurrando o botão
//      "Localizar" para 380px de distância do campo.
//
//  São defeitos de ESTRUTURA, e por isso dá para prendê-los aqui.
//  O que é de folha de estilo — largura, respiro, alinhamento — a
//  régua de tela mede; o jsdom não enxerga CSS.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConferirRecebimento } from './Conferir';
import {
  buscarPedidoParaConferir,
  type PedidoParaConferir,
  type ItemParaConferir,
} from '../../servicos/recebimentos';

vi.mock('../../servicos/recebimentos', async (original) => ({
  ...(await original<typeof import('../../servicos/recebimentos')>()),
  buscarPedidoParaConferir: vi.fn(),
  registrarRecebimento: vi.fn(),
}));

function item(ajustes: Partial<ItemParaConferir> = {}): ItemParaConferir {
  return {
    pedidoItemId: 'i1',
    ordem: 1,
    codigo: '00068',
    gtin: '7891234567895',
    descricao: 'Arame recozido n. 18 rolo 1kg',
    unidadeMedida: 'KG',
    quantidadePedida: 40,
    quantidadeJaRecebida: 36,
    saldo: 4,
    concluido: false,
    normaTecnica: 'NBR 5589',
    marca: 'Votoran',
    valorUnitario: 12.5,
    ...ajustes,
  };
}

function pedido(itens: ItemParaConferir[] = [item()]): PedidoParaConferir {
  return {
    pedido: {
      id: 'p1',
      numeroFormatado: 'PC-00001',
      situacao: 'RECEBIDO_PARCIAL',
      fornecedor: 'Marquilip',
      fornecedorCnpj: '00.000.000/0001-00',
      comprador: 'Neilma',
      origem: 'BID-00001 · Material de reposição',
      criadoEm: '2026-09-21T10:00:00.000Z',
      enviadoEm: '2026-09-21T14:00:00.000Z',
      obra: 'OB-001 — Residencial Porto Belo',
    },
    itens,
    tudoRecebido: false,
    almoxarifados: [
      { id: 'a1', codigo: 'ALM-01', nome: 'Almoxarifado Residencial Porto Belo', central: false },
    ],
  } as PedidoParaConferir;
}

function abrirTela() {
  return render(
    <MemoryRouter initialEntries={['/recebimento/PC-00001']}>
      <Routes>
        <Route path="/recebimento/:numero" element={<ConferirRecebimento />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Conferir recebimento', () => {
  beforeEach(() => {
    vi.mocked(buscarPedidoParaConferir).mockResolvedValue(pedido());
  });

  it('mostra UMA navegação, e não duas', async () => {
    abrirTela();
    await screen.findByRole('heading', { name: /Conferir PC-00001/ });

    // A tela escrevia a própria trilha logo acima do CabecalhoDePagina,
    // que já monta uma a partir de `navegacao.ts`. Resultado: duas
    // barras empilhadas, "Recebimento › PC-00001" e
    // "Início › Recebimento › Conferência".
    expect(screen.getAllByRole('navigation', { name: 'Você está em' })).toHaveLength(1);
  });

  it('o saldo traz a conta inteira ao lado de onde se digita', async () => {
    abrirTela();
    const linha = await screen.findByRole('row', { name: /Arame recozido/ });

    // "Pedido" e "Já recebido" eram duas colunas soltas. Viraram a
    // linha miúda embaixo do saldo — a conta toda num lugar só.
    expect(within(linha).getByText('4')).toBeInTheDocument();
    expect(within(linha).getByText(/Pedido 40 · Recebido 36/)).toBeInTheDocument();
  });

  it('a tabela tem cinco colunas, e não sete', async () => {
    abrirTela();
    await screen.findByRole('heading', { name: /Conferir PC-00001/ });

    // Sete colunas no computador viravam sete blocos por item no
    // celular: um item passava de uma tela inteira de rolagem.
    const colunas = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(colunas).toEqual([
      'Item',
      'Saldo',
      'Recebido agora',
      'Devolvido',
      'Como chegou',
    ]);
  });

  it('a ajuda continua ligada ao campo mesmo morando fora dele', async () => {
    abrirTela();
    const campo = await screen.findByLabelText(/Bipar ou digitar o código/);

    // A ajuda saiu de dentro do `.campo` para poder atravessar a
    // linha da grade — dentro dele, era ela que definia onde o botão
    // "Localizar" ficava, e ele ia parar ao lado do texto.
    //
    // Fora do `.campo` a ligação implícita se perde; o
    // `aria-describedby` é o que a devolve para quem usa leitor de
    // tela. Sem isto o conserto visual custaria acessibilidade.
    const ajuda = document.getElementById(campo.getAttribute('aria-describedby') ?? '');
    expect(ajuda).toHaveTextContent(/já preenche o saldo/);
  });

  it('o item que já chegou por inteiro mostra o selo, e não um campo aceso', async () => {
    vi.mocked(buscarPedidoParaConferir).mockResolvedValue(
      pedido([item({ quantidadeJaRecebida: 40, saldo: 0, concluido: true })]),
    );

    abrirTela();
    const linha = await screen.findByRole('row', { name: /Arame recozido/ });

    // O selo carrega o significado: cor sozinha nunca informa.
    expect(within(linha).getByText('Completo')).toBeInTheDocument();
    expect(within(linha).getByLabelText(/Quantidade recebida/)).toBeDisabled();
  });

  it('o selo de situação é irmão do título, não uma linha abaixo', async () => {
    abrirTela();
    const titulo = await screen.findByRole('heading', { name: /Conferir PC-00001/ });

    // `.cabecalho__titulo-com-selos` era usada aqui e nunca tinha sido
    // escrita no CSS: sem `display: flex` o <h1> tomava a linha inteira
    // e o selo desabava para baixo dele. O jsdom não lê folha de
    // estilo, mas garante o que ela precisa para funcionar — os dois
    // no mesmo pai.
    const caixa = titulo.parentElement;
    expect(caixa).toHaveClass('cabecalho__titulo-com-selos');
    expect(within(caixa as HTMLElement).getByText('Recebido em parte')).toBeInTheDocument();
  });
});
