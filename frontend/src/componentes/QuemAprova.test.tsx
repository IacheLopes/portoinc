// ============================================================
//  A caixa "Quem aprova"
//
//  É a resposta a "quem precisa assinar esta compra, e em que pé
//  estamos". Se ela mentir, a pessoa envia achando que falta uma
//  assinatura quando faltam duas — ou fica esperando uma que já foi
//  dada.
//
//  Duas coisas aqui não são detalhe:
//
//   · Depois do envio vale a FOTOGRAFIA guardada na solicitação, e
//     não a alçada de hoje. Se a empresa mexer nas faixas amanhã, o
//     que já está em aprovação continua com a regra de ontem.
//
//   · O estado de cada função casa pelo CÓDIGO. Casava pelo nome, e
//     nome nunca bate com código: ninguém aparecia como tendo
//     assinado.
// ============================================================

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QuemAprova } from './QuemAprova';
import type { ResumoDaAlcada, Solicitacao } from '../servicos/solicitacoes';

const ALCADA: ResumoDaAlcada = {
  faixa: 'Compras de valor médio',
  exigeTodas: true,
  funcoes: [
    { codigo: 'GESTOR_OBRA', nome: 'Gestor de obra' },
    { codigo: 'ENGENHEIRO', nome: 'Engenheiro' },
  ],
  explicacao: 'Precisa de 2 assinaturas: Gestor de obra e Engenheiro.',
};

/** O mínimo que o componente lê. O resto da solicitação não importa. */
function solicitacao(parte: Partial<Solicitacao> = {}): Solicitacao {
  return {
    totalEstimado: 6880,
    exigeTodas: false,
    funcoesExigidas: [],
    enviadaEm: null,
    aprovacoes: [],
    ...parte,
  } as unknown as Solicitacao;
}

function assinatura(funcaoCodigo: string, usuario: string, decisao = 'APROVADA') {
  return { id: funcaoCodigo, decisao, observacao: null, usuario, funcaoCodigo,
    funcao: funcaoCodigo, criadaEm: '2026-09-27T12:00:00.000Z' };
}

/** A linha da lista em que aparece o nome desta função. */
function linhaDe(nome: string) {
  return screen.getByText(nome).closest('li') as HTMLElement;
}

describe('Antes de enviar', () => {
  it('mostra as funções que vão precisar assinar', () => {
    render(<QuemAprova alcada={ALCADA} solicitacao={solicitacao()} />);

    expect(screen.getByText('Gestor de obra')).toBeInTheDocument();
    expect(screen.getByText('Engenheiro')).toBeInTheDocument();
  });

  it('todas ainda estão aguardando', () => {
    render(<QuemAprova alcada={ALCADA} solicitacao={solicitacao()} />);

    expect(screen.getAllByText('aguardando')).toHaveLength(2);
  });

  it('diz a regra sem escrever uma frase', () => {
    render(<QuemAprova alcada={ALCADA} solicitacao={solicitacao()} />);

    expect(screen.getByText('Todas precisam assinar')).toBeInTheDocument();
  });

  it('"basta uma" não vira "todas"', () => {
    render(
      <QuemAprova
        alcada={{ ...ALCADA, exigeTodas: false }}
        solicitacao={solicitacao()}
      />,
    );

    expect(screen.getByText('Basta uma assinatura')).toBeInTheDocument();
  });

  it('diz por qual valor e por qual faixa, e não só "pelas faixas"', () => {
    render(<QuemAprova alcada={ALCADA} solicitacao={solicitacao()} />);

    // Se a alçada calcular errado, é aqui que a pessoa percebe.
    expect(screen.getByText(/R\$ 6\.880,00/)).toBeInTheDocument();
    expect(screen.getByText(/Compras de valor médio/)).toBeInTheDocument();
  });
});

describe('Depois de enviar', () => {
  const enviada = solicitacao({
    exigeTodas: true,
    funcoesExigidas: ['GESTOR_OBRA', 'ENGENHEIRO'],
    enviadaEm: '2026-09-27T12:00:00.000Z',
    aprovacoes: [assinatura('GESTOR_OBRA', 'Marcos Teste')],
  });

  it('risca quem já assinou e diz quem foi', () => {
    render(<QuemAprova alcada={ALCADA} solicitacao={enviada} />);

    const gestor = linhaDe('Gestor de obra');
    expect(within(gestor).getByText('assinou')).toBeInTheDocument();
    expect(within(gestor).getByText('Marcos Teste')).toBeInTheDocument();
  });

  it('quem falta continua aguardando', () => {
    render(<QuemAprova alcada={ALCADA} solicitacao={enviada} />);

    expect(within(linhaDe('Engenheiro')).getByText('aguardando')).toBeInTheDocument();
  });

  it('a marca de assinado nunca vai sozinha: a palavra está escrita', () => {
    // Quem não distingue cor, e quem ouve a tela, precisa da palavra.
    render(<QuemAprova alcada={ALCADA} solicitacao={enviada} />);

    expect(within(linhaDe('Gestor de obra')).getByText('assinou')).toBeVisible();
  });

  it('reprovar aparece como reprovar, não como assinar', () => {
    render(
      <QuemAprova
        alcada={ALCADA}
        solicitacao={solicitacao({
          exigeTodas: true,
          funcoesExigidas: ['GESTOR_OBRA', 'ENGENHEIRO'],
          aprovacoes: [assinatura('ENGENHEIRO', 'Ana Teste', 'REPROVADA')],
        })}
      />,
    );

    expect(within(linhaDe('Engenheiro')).getByText('reprovou')).toBeInTheDocument();
  });

  it('vale a fotografia do envio, e não a alçada de hoje', () => {
    // A empresa mexeu nas faixas depois do envio: agora a compra
    // pediria só o Fundador. O que está em aprovação não muda.
    render(
      <QuemAprova
        alcada={{
          faixa: 'Faixa nova',
          exigeTodas: false,
          funcoes: [{ codigo: 'FUNDADOR', nome: 'Fundador' }],
          explicacao: 'Precisa de 1 assinatura: Fundador.',
        }}
        solicitacao={enviada}
      />,
    );

    expect(screen.getByText('Gestor de obra')).toBeInTheDocument();
    expect(screen.getByText('Engenheiro')).toBeInTheDocument();
    expect(screen.queryByText('Fundador')).not.toBeInTheDocument();
    expect(screen.getByText('Todas precisam assinar')).toBeInTheDocument();
  });

  it('nome de função sem cadastro na alçada ainda sai legível', () => {
    // A fotografia guarda códigos. Se a faixa mudou e o código não
    // está mais nela, o nome tem de sair de algum lugar.
    render(
      <QuemAprova
        alcada={{ faixa: null, exigeTodas: true, funcoes: [], explicacao: '' }}
        solicitacao={solicitacao({
          exigeTodas: true,
          funcoesExigidas: ['GESTOR_OBRA'],
          enviadaEm: '2026-09-27T12:00:00.000Z',
        })}
      />,
    );

    expect(screen.getByText('Gestor de obra')).toBeInTheDocument();
    expect(screen.queryByText('GESTOR_OBRA')).not.toBeInTheDocument();
  });
});

describe('Quando nenhuma faixa cobre o valor', () => {
  it('avisa em vez de mostrar uma lista vazia', () => {
    render(
      <QuemAprova
        alcada={{
          faixa: null,
          exigeTodas: false,
          funcoes: [],
          explicacao: 'Nenhuma faixa de alçada cobre este valor. Avise o administrador.',
        }}
        solicitacao={solicitacao()}
      />,
    );

    expect(screen.getByText(/Avise o administrador/)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
