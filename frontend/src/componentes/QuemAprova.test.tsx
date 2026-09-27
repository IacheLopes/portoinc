// ============================================================
//  A caixa "Quem aprova"
//
//  É a resposta a "quantas assinaturas faltam, e de quem". Se ela
//  mentir, a pessoa envia achando que falta uma quando faltam duas —
//  ou fica cobrando alguém que já assinou.
//
//  Três coisas aqui não são detalhe:
//
//   · Depois do envio vale a FOTOGRAFIA guardada na solicitação, e
//     não a alçada de hoje. Se a empresa mexer nas faixas amanhã, o
//     que já está em aprovação continua com a regra de ontem.
//
//   · O estado casa pelo CÓDIGO da função. Casava pelo nome, e nome
//     nunca bate com código: ninguém aparecia como tendo assinado.
//
//   · Com "basta uma", a conta é 1 — por mais funções que a faixa
//     liste. Contar as funções ali diria que faltam três assinaturas
//     quando falta uma.
// ============================================================

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
  return {
    id: funcaoCodigo + decisao, decisao, observacao: null, usuario,
    funcaoCodigo, funcao: funcaoCodigo, criadaEm: '2026-09-27T12:00:00.000Z',
  };
}

function montar(alcada: ResumoDaAlcada | null, s: Solicitacao) {
  // O <Indicador> vira <Link> quando recebe destino. Aqui não recebe,
  // mas o Router evita que uma mudança lá quebre isto sem aviso.
  render(
    <MemoryRouter>
      <QuemAprova alcada={alcada} solicitacao={s} />
    </MemoryRouter>,
  );
}

describe('Antes de enviar', () => {
  it('diz quantas assinaturas e de quem', () => {
    montar(ALCADA, solicitacao());

    expect(screen.getByText('2 assinaturas')).toBeInTheDocument();
    expect(screen.getByText('Gestor de obra e Engenheiro')).toBeInTheDocument();
  });

  it('"e" quer dizer as duas; "ou" quer dizer qualquer uma', () => {
    // A conjunção É a regra. Trocar uma pela outra inverte o
    // significado sem mudar mais nada na frase.
    montar({ ...ALCADA, exigeTodas: false }, solicitacao());

    expect(screen.getByText('1 assinatura')).toBeInTheDocument();
    expect(screen.getByText('Gestor de obra ou Engenheiro')).toBeInTheDocument();
  });

  it('com "basta uma", a conta é 1 e não o tanto de funções', () => {
    montar(
      {
        ...ALCADA,
        exigeTodas: false,
        funcoes: [
          { codigo: 'GESTOR_OBRA', nome: 'Gestor de obra' },
          { codigo: 'ENGENHEIRO', nome: 'Engenheiro' },
          { codigo: 'FUNDADOR', nome: 'Fundador' },
        ],
      },
      solicitacao(),
    );

    expect(screen.getByText('1 assinatura')).toBeInTheDocument();
    expect(screen.queryByText('3 assinaturas')).not.toBeInTheDocument();
  });

  it('uma função só fala no singular', () => {
    montar(
      { ...ALCADA, funcoes: [{ codigo: 'GESTOR_OBRA', nome: 'Gestor de obra' }] },
      solicitacao(),
    );

    expect(screen.getByText('1 assinatura')).toBeInTheDocument();
    expect(screen.getByText('Gestor de obra')).toBeInTheDocument();
  });
});

describe('Enquanto assinam', () => {
  const enviada = (aprovacoes: ReturnType<typeof assinatura>[]) =>
    solicitacao({
      exigeTodas: true,
      funcoesExigidas: ['GESTOR_OBRA', 'ENGENHEIRO'],
      enviadaEm: '2026-09-27T12:00:00.000Z',
      aprovacoes,
    });

  it('conta o que já foi e nomeia quem falta', () => {
    montar(ALCADA, enviada([assinatura('GESTOR_OBRA', 'Marcos Teste')]));

    expect(screen.getByText('1 de 2 assinaturas')).toBeInTheDocument();
    expect(screen.getByText('Falta assinar: Engenheiro')).toBeInTheDocument();
  });

  it('quem já assinou não aparece como faltando', () => {
    montar(ALCADA, enviada([assinatura('GESTOR_OBRA', 'Marcos Teste')]));

    expect(screen.queryByText(/Falta assinar:.*Gestor de obra/)).not.toBeInTheDocument();
  });

  it('assinada por todos vira uma palavra, e diz por quem', () => {
    montar(
      ALCADA,
      enviada([
        assinatura('GESTOR_OBRA', 'Marcos Teste'),
        assinatura('ENGENHEIRO', 'Ana Teste'),
      ]),
    );

    expect(screen.getByText('Assinada')).toBeInTheDocument();
    expect(screen.getByText('Por Marcos Teste e Ana Teste')).toBeInTheDocument();
  });

  it('reprovar não é o mesmo que faltar assinatura', () => {
    montar(ALCADA, enviada([assinatura('ENGENHEIRO', 'Ana Teste', 'REPROVADA')]));

    expect(screen.getByText('Reprovada')).toBeInTheDocument();
    expect(screen.getByText('Por Ana Teste, Engenheiro')).toBeInTheDocument();
  });

  it('devolver para revisão também tem nome próprio', () => {
    montar(ALCADA, enviada([assinatura('GESTOR_OBRA', 'Marcos Teste', 'DEVOLVIDA')]));

    expect(screen.getByText('Devolvida')).toBeInTheDocument();
    expect(screen.getByText('Por Marcos Teste, Gestor de obra')).toBeInTheDocument();
  });

  it('vale a fotografia do envio, e não a alçada de hoje', () => {
    // A empresa mexeu nas faixas depois do envio: agora a compra
    // pediria só o Fundador. O que está em aprovação não muda.
    montar(
      {
        faixa: 'Faixa nova',
        exigeTodas: false,
        funcoes: [{ codigo: 'FUNDADOR', nome: 'Fundador' }],
        explicacao: 'Precisa de 1 assinatura: Fundador.',
      },
      enviada([]),
    );

    expect(screen.getByText('2 assinaturas')).toBeInTheDocument();
    expect(screen.getByText('Gestor de obra e Engenheiro')).toBeInTheDocument();
  });

  it('função que saiu da faixa ainda sai com nome legível', () => {
    // A fotografia guarda códigos. Se o código não está mais na
    // faixa, o nome tem de sair de algum lugar.
    montar({ faixa: null, exigeTodas: true, funcoes: [], explicacao: '' }, enviada([]));

    expect(screen.getByText('Gestor de obra e Engenheiro')).toBeInTheDocument();
    expect(screen.queryByText(/GESTOR_OBRA/)).not.toBeInTheDocument();
  });

  it('decisão de função que a faixa não exige não entra na conta', () => {
    // O DEV tem as sete funções. Se ele assinar como Comprador, a
    // conta de "1 de 2" não pode andar.
    montar(ALCADA, enviada([assinatura('COMPRADOR', 'DEV-Porto')]));

    expect(screen.getByText('2 assinaturas')).toBeInTheDocument();
  });
});

describe('Quando nenhuma faixa cobre o valor', () => {
  it('avisa, em vez de mostrar um número inventado', () => {
    montar(
      {
        faixa: null,
        exigeTodas: false,
        funcoes: [],
        explicacao: 'Nenhuma faixa de alçada cobre este valor. Avise o administrador.',
      },
      solicitacao(),
    );

    expect(screen.getByText('Sem faixa')).toBeInTheDocument();
    expect(screen.getByText(/Avise o administrador/)).toBeInTheDocument();
  });
});
