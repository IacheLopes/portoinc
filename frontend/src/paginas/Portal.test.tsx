// ============================================================
//  O portal do fornecedor
//
//  A única tela pública do sistema, e a única que gente de fora
//  da Porto Inc. vê — provavelmente no celular, no meio do
//  expediente, sem treinamento. Se ela não for óbvia, o
//  fornecedor não responde, e sem resposta não há cotação.
//
//  O que está provado aqui é a MÁQUINA DO DINHEIRO. O campo de
//  preço era `type="number"` cru: quem digitava 5100 via "5100" e
//  não tinha como perceber que queria dizer R$ 51,00. Com a
//  máscara, o que a pessoa lê é "R$ 5.100,00" — e o que vai para
//  o servidor continua sendo número.
//
//  É o caminho de ida e volta que precisa de prova: máscara na
//  tela, número no envio. Errar aqui manda preço errado para uma
//  proposta comercial.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Portal } from './Portal';
import { abrirPortal, responderPortal, type CotacaoDoPortal } from '../servicos/cotacoes';

vi.mock('../servicos/cotacoes', async (original) => ({
  ...(await original<typeof import('../servicos/cotacoes')>()),
  abrirPortal: vi.fn(),
  responderPortal: vi.fn(),
}));

const abrir = vi.mocked(abrirPortal);
const responder = vi.mocked(responderPortal);

function item(id: string, codigo: string, descricao: string, quantidade: number) {
  return {
    id, codigo, descricao, quantidade,
    marcaReferencia: null, normaTecnica: null, especificacao: null, detalhes: null,
    unidadeMedida: 'SC',
    minhaResposta: null,
  };
}

function cotacao(parte: Partial<CotacaoDoPortal> = {}): CotacaoDoPortal {
  return {
    numeroFormatado: 'BID-00001',
    titulo: 'Laje 3º pavimento',
    observacoes: null,
    // Bem no futuro: o prazo não pode vencer e quebrar o teste
    // meses depois de escrito.
    prazoResposta: '2099-12-31T00:00:00.000Z',
    fornecedor: { razaoSocial: 'Constrular Ltda', nomeFantasia: 'Constrular', cnpj: '47960950000121' },
    jaRespondeu: false,
    respondidoEm: null,
    itens: [item('i1', '00001', 'Cimento CP-II-Z-32', 100)],
    minhasCondicoes: {
      valorFrete: null, outrosCustos: null, percentualEntrada: null,
      quantidadeParcelas: null, intervaloParcelasDias: null, observacaoFornecedor: null,
    },
    ...parte,
  } as CotacaoDoPortal;
}

function montar() {
  render(
    <MemoryRouter initialEntries={['/portal/abc']}>
      <Routes>
        <Route path="/portal/:token" element={<Portal />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Espera o portal carregar. A tela busca a cotação ao abrir. */
const acharPreco = () => screen.findByLabelText(/Seu preço por SC/);
/** Depois de carregado, para conferir o valor. */
const preco = () => screen.getByLabelText(/Seu preço por SC/);

beforeEach(() => {
  vi.clearAllMocks();
  abrir.mockResolvedValue({ cotacao: cotacao() } as never);
  responder.mockResolvedValue({ ok: true, total: 0 } as never);
});

describe('A máscara de dinheiro', () => {
  it('escreve os pontos de milhar enquanto a pessoa digita', async () => {
    montar();

    await userEvent.type(await acharPreco(), '510000');

    // 5.100,00 e 510.000 são a mesma mancha na tela sem os pontos.
    expect(preco()).toHaveValue('510.000');
  });

  it('a vírgula abre os centavos; o ponto é só milhar', async () => {
    montar();

    await userEvent.type(await acharPreco(), '51,5');
    expect(preco()).toHaveValue('51,5');
  });

  it('ao sair do campo, completa os centavos', async () => {
    montar();

    await userEvent.type(await acharPreco(), '51');
    await userEvent.tab();

    expect(preco()).toHaveValue('51,00');
  });

  it('a conta do item aparece em português, viva', async () => {
    montar();

    await userEvent.type(await acharPreco(), '51,00');

    // É o que separa orçamento de formulário: o vendedor vê o que
    // está oferecendo antes de enviar.
    //
    // Dentro da linha do item, e não em qualquer lugar da página: o
    // mesmo valor aparece no resumo do fim, e uma busca solta
    // passaria mesmo se a conta do item sumisse.
    const conta = document.querySelector('.item-cotacao__conta') as HTMLElement;
    expect(conta).toHaveTextContent('100 SC × R$ 51,00 =');
    expect(within(conta).getByText('R$ 5.100,00')).toBeInTheDocument();
  });

  it('sem preço, a conta convida em vez de mostrar R$ 0,00', async () => {
    montar();

    expect(await screen.findByText(/A conta aparece aqui/)).toBeInTheDocument();
  });
});

describe('O que vai para o servidor', () => {
  it('é NÚMERO, não o texto com R$ e pontos', async () => {
    montar();

    await userEvent.type(await acharPreco(), '510000');
    await userEvent.type(screen.getByLabelText(/^Frete/), '250');
    await userEvent.click(screen.getByRole('button', { name: /Enviar cotação/ }));

    await waitFor(() => expect(responder).toHaveBeenCalled());

    const [, corpo] = responder.mock.calls[0];
    expect(corpo.itens[0].valorUnitario).toBe(510000);
    expect(corpo.valorFrete).toBe(250);
  });

  it('item recusado vai sem preço, e não com zero', async () => {
    montar();

    await userEvent.type(await acharPreco(), '51');
    await userEvent.click(screen.getByLabelText(/Não trabalho com este item/));
    await userEvent.click(screen.getByRole('button', { name: /Enviar cotação/ }));

    await waitFor(() => expect(responder).toHaveBeenCalled());

    const [, corpo] = responder.mock.calls[0];
    expect(corpo.itens[0].disponivel).toBe(false);
    expect(corpo.itens[0].valorUnitario).toBeNull();
  });
});

describe('A barra que não sai da tela', () => {
  it('soma itens e frete, e acompanha a digitação', async () => {
    montar();

    await userEvent.type(await acharPreco(), '51,00');
    await userEvent.type(screen.getByLabelText(/^Frete/), '250');

    const barra = document.querySelector('.portal__barra') as HTMLElement;
    expect(within(barra).getByText('R$ 5.350,00')).toBeInTheDocument();
  });

  it('trava o envio enquanto faltar preço, e diz quantos', async () => {
    abrir.mockResolvedValue({
      cotacao: cotacao({
        itens: [
          item('i1', '00001', 'Cimento', 100),
          item('i2', '00002', 'Argamassa', 60),
        ],
      }),
    } as never);

    montar();

    expect(await screen.findByText(/Faltam os preços de 2 itens/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar cotação/ })).toBeDisabled();
  });

  it('recusar o item conta como respondido, e libera o envio', async () => {
    // Quem não trabalha com um item não pode ficar preso na tela.
    montar();

    await userEvent.click(await screen.findByLabelText(/Não trabalho com este item/));

    expect(screen.getByRole('button', { name: /Enviar cotação/ })).toBeEnabled();
  });
});
