// ============================================================
//  A tela onde o dinheiro é decidido
//
//  Primeiros testes desta tela, escritos em 10/10/2026 a partir de
//  dois defeitos que ele apontou usando o sistema de verdade:
//
//  1. OS BOTÕES ESTAVAM ACIMA DA TABELA. Num pacote grande a pessoa
//     escolhe item a item descendo, chega ao fim e teria de voltar
//     ao topo para guardar o que acabou de fazer.
//
//  2. A CONFIRMAÇÃO DO SALVAR APARECIA NO ALTO DA TELA, fora do
//     campo de visão de quem tinha acabado de clicar lá embaixo —
//     resposta que ninguém vê é resposta que não existe.
//
//  O que está provado aqui é o CICLO DA ESCOLHA: escolher, salvar,
//  e saber que salvou. Errar isso faz o comprador perder trabalho
//  feito, ou achar que perdeu.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Equalizacao } from './Equalizacao';
import { buscarEqualizacao, salvarEscolhas, type Equalizacao as Dados } from '../../servicos/cotacoes';

//  O crachá: `podeDecidir` esconde os botões de quem não gerencia
//  cotações, e sem o contexto o componente nem monta.
vi.mock('../../contexto/Autenticacao', () => ({
  useAutenticacao: () => ({ usuario: { id: 'u1', nome: 'Neilma' }, pode: () => true }),
}));

vi.mock('../../servicos/cotacoes', async (original) => ({
  ...(await original<typeof import('../../servicos/cotacoes')>()),
  buscarEqualizacao: vi.fn(),
  salvarEscolhas: vi.fn(),
}));

const buscar = vi.mocked(buscarEqualizacao);
const salvar = vi.mocked(salvarEscolhas);

/** Uma resposta de fornecedor para um item. */
function resposta(id: string, nome: string, valor: number, melhor: boolean) {
  return {
    bidFornecedorId: id,
    fornecedorNome: nome,
    disponivel: true,
    valorUnitario: valor,
    marca: null,
    modelo: null,
    prazoEntregaDias: null,
    observacao: null,
    total: valor * 10,
    ehMelhor: melhor,
    acimaEmPorcento: melhor ? 0 : 50,
  };
}

function dados(): Dados {
  return {
    cotacao: {
      id: 'bid-1',
      numeroFormatado: 'BID-00005',
      titulo: 'Cabo flexível — OB-001',
      situacao: 'ENCERRADO',
      rodada: 1,
      prazoResposta: '2099-12-31T00:00:00.000Z',
      totalConvidados: 2,
      totalResponderam: 2,
    },
    condicoes: [
      {
        bidFornecedorId: 'f1', fornecedor: 'Eletro Minas', frete: 0, outrosCustos: 0,
        pagamento: 'À vista', prazoMedioPagamento: null, observacao: null,
      },
      {
        bidFornecedorId: 'f2', fornecedor: 'Cimenteira', frete: 0, outrosCustos: 0,
        pagamento: 'À vista', prazoMedioPagamento: null, observacao: null,
      },
    ],
    comparativo: {
      linhas: [
        {
          bidItemId: 'i1',
          codigo: 'EL-0001',
          descricao: 'Cabo flexível 2,5mm',
          unidadeMedida: 'RL',
          quantidade: 10,
          melhorFornecedorId: 'f1',
          melhorValorUnitario: 15,
          melhorTotal: 150,
          amplitude: 350,
          respostas: [resposta('f1', 'Eletro Minas', 15, true), resposta('f2', 'Cimenteira', 50, false)],
        },
      ],
      fornecedores: [
        {
          bidFornecedorId: 'f1', fornecedorNome: 'Eletro Minas', totalSeFecharTudo: 150,
          cotouTudo: true, itensCotados: 1, itensIndisponiveis: 0, itensVencidos: 1,
          itensAtras: [], frete: 0, outrosCustos: 0,
        },
        {
          bidFornecedorId: 'f2', fornecedorNome: 'Cimenteira', totalSeFecharTudo: 500,
          cotouTudo: true, itensCotados: 1, itensIndisponiveis: 0, itensVencidos: 0,
          itensAtras: ['i1'], frete: 0, outrosCustos: 0,
        },
      ],
      melhorCombinacao: 150,
      somaDosItens: 150,
      freteDaCombinacao: 0,
      fornecedoresVencedores: 1,
      melhorFornecedorUnico: { nome: 'Eletro Minas', total: 150 },
      economiaAoMisturar: 0,
      itensSemCotacao: 0,
    },
    historico: [{ bidItemId: 'i1', ultimaCompra: null }],
    escolhas: {},
  };
}

function montar() {
  render(
    <MemoryRouter initialEntries={['/cotacoes/bid-1/equalizacao']}>
      <Routes>
        <Route path="/cotacoes/:id/equalizacao" element={<Equalizacao />} />
      </Routes>
    </MemoryRouter>,
  );
}

const botaoSalvar = () => screen.getByRole('button', { name: /Salvar escolhas|Escolhas salvas/ });
const celula = () => screen.getByRole('button', { name: /Escolher Eletro Minas/ });

beforeEach(() => {
  vi.clearAllMocks();
  buscar.mockResolvedValue(dados());
  salvar.mockResolvedValue({ ok: true, registradas: 1 });
});

describe('Saber que salvou', () => {
  it('O BOTÃO VIRA A CONFIRMAÇÃO, e fica desligado', async () => {
    //  Ele clicava no fim de uma tabela longa e a confirmação
    //  aparecia no alto da tela, onde ninguém estava olhando.
    montar();

    await userEvent.click(await screen.findByRole('button', { name: /Escolher Eletro Minas/ }));
    await userEvent.click(botaoSalvar());

    await waitFor(() => expect(salvar).toHaveBeenCalled());

    const botao = await screen.findByRole('button', { name: /Escolhas salvas/ });
    expect(botao).toBeDisabled();
  });

  it('e a confirmação SE DESFAZ quando a escolha muda', async () => {
    //  É o que um aviso parado não faz: ele continuaria dizendo
    //  "salvas" depois de a pessoa mudar tudo.
    montar();

    await userEvent.click(await screen.findByRole('button', { name: /Escolher Eletro Minas/ }));
    await userEvent.click(botaoSalvar());
    await screen.findByRole('button', { name: /Escolhas salvas/ });

    await userEvent.click(celula());

    expect(screen.getByRole('button', { name: /Salvar escolhas/ })).toBeEnabled();
  });

  it('o atalho dos melhores preços também desfaz a confirmação', async () => {
    montar();

    await userEvent.click(await screen.findByRole('button', { name: /Escolher Eletro Minas/ }));
    await userEvent.click(botaoSalvar());
    await screen.findByRole('button', { name: /Escolhas salvas/ });

    await userEvent.click(screen.getByRole('button', { name: /Aceitar todos os melhores preços/ }));

    expect(screen.getByRole('button', { name: /Salvar escolhas/ })).toBeEnabled();
  });
});

describe('Onde ficam os botões', () => {
  it('VÊM DEPOIS DA TABELA, que é onde o trabalho termina', async () => {
    //  Estavam acima dela. Num pacote de quarenta linhas, a pessoa
    //  escolhe descendo e teria de voltar ao topo para guardar.
    montar();

    await screen.findByRole('button', { name: /Salvar escolhas/ });

    const tabela = document.querySelector('table.mapa');
    const barra = document.querySelector('.barra-acoes');

    expect(tabela).not.toBeNull();
    expect(barra).not.toBeNull();

    //  DOCUMENT_POSITION_FOLLOWING: a barra vem depois da tabela.
    const posicao = tabela!.compareDocumentPosition(barra!);
    expect(posicao & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
