// ============================================================
//  A hierarquia das telas
//
//  É daqui que saem as migalhas e o botão de Voltar. Errar aqui
//  manda a pessoa para o lugar errado — e ela nem desconfia, porque
//  o botão parece que funcionou.
// ============================================================

import { describe, it, expect } from 'vitest';
import { PAGINAS, casa, paginaDe, enderecoReal, trilhaDe, voltarDe } from './navegacao';

describe('Casar endereço com padrão', () => {
  it('endereço igual ao padrão casa', () => {
    expect(casa('/solicitacoes', '/solicitacoes')).toBe(true);
  });

  it('o coringa aceita qualquer pedaço', () => {
    expect(casa('/solicitacoes/:id', '/solicitacoes/abc-123')).toBe(true);
    expect(casa('/cotacoes/:id/equalizacao', '/cotacoes/xyz/equalizacao')).toBe(true);
  });

  it('número de pedaços diferente não casa', () => {
    expect(casa('/solicitacoes', '/solicitacoes/abc')).toBe(false);
    expect(casa('/solicitacoes/:id', '/solicitacoes')).toBe(false);
  });
});

describe('Achar a página', () => {
  it('o padrão SEM coringa ganha do padrão com coringa', () => {
    // Senão "/cotacoes/nova" vira "a cotação de id 'nova'", e a
    // migalha passa a dizer "Pacote de cotação" numa tela de criar.
    expect(paginaDe('/cotacoes/nova')?.titulo).toBe('Novo pacote');
    expect(paginaDe('/solicitacoes/nova')?.titulo).toBe('Nova solicitação');
  });

  it('id de verdade cai na tela de detalhe', () => {
    expect(paginaDe('/cotacoes/abc-123')?.titulo).toBe('Pacote de cotação');
  });

  it('endereço desconhecido devolve nada', () => {
    expect(paginaDe('/inventado')).toBeNull();
  });
});

describe('Trocar o coringa pelo valor de verdade', () => {
  it('a mãe de uma equalização aponta para AQUELA cotação', () => {
    // Sem isso o botão levaria para "/cotacoes/:id", com os
    // dois-pontos no meio do endereço.
    expect(enderecoReal('/cotacoes/:id', '/cotacoes/abc-123/equalizacao'))
      .toBe('/cotacoes/abc-123');
  });

  it('padrão sem coringa passa inteiro', () => {
    expect(enderecoReal('/cotacoes', '/cotacoes/abc-123')).toBe('/cotacoes');
  });
});

describe('A trilha', () => {
  it('começa no Início e termina na tela atual', () => {
    const trilha = trilhaDe('/cotacoes/abc-123/equalizacao');

    expect(trilha.map((p) => p.titulo)).toEqual([
      'Início', 'Cotações', 'Pacote de cotação', 'Equalização',
    ]);
  });

  it('cada degrau é um endereço que funciona', () => {
    const trilha = trilhaDe('/cotacoes/abc-123/equalizacao');

    expect(trilha.map((p) => p.para)).toEqual([
      '/', '/cotacoes', '/cotacoes/abc-123', '/cotacoes/abc-123/equalizacao',
    ]);
  });

  it('no Início a trilha é só ele', () => {
    expect(trilhaDe('/').map((p) => p.titulo)).toEqual(['Início']);
  });
});

describe('O botão de Voltar', () => {
  it('leva à tela-mãe, dizendo o nome dela', () => {
    expect(voltarDe('/solicitacoes/abc')).toEqual({
      titulo: 'Solicitações',
      para: '/solicitacoes',
    });
  });

  it('de uma equalização, volta para a cotação certa', () => {
    expect(voltarDe('/cotacoes/abc-123/equalizacao')).toEqual({
      titulo: 'Pacote de cotação',
      para: '/cotacoes/abc-123',
    });
  });

  it('no Início não há para onde voltar', () => {
    expect(voltarDe('/')).toBeNull();
  });
});

describe('A tabela de páginas', () => {
  it('toda página, menos o Início, tem mãe', () => {
    const orfas = PAGINAS.filter((p) => p.rota !== '/' && !p.mae).map((p) => p.rota);
    expect(orfas).toEqual([]);
  });

  it('toda mãe declarada existe na tabela', () => {
    // Mãe que não existe deixaria a tela sem Voltar, em silêncio.
    const perdidas = PAGINAS
      .filter((p) => p.mae && !PAGINAS.some((m) => m.rota === p.mae))
      .map((p) => p.rota + ' -> ' + p.mae);

    expect(perdidas).toEqual([]);
  });

  it('não há rota repetida', () => {
    const rotas = PAGINAS.map((p) => p.rota);
    expect(new Set(rotas).size).toBe(rotas.length);
  });

  it('toda trilha chega ao Início', () => {
    // Uma hierarquia circular travaria a tela num laço.
    for (const p of PAGINAS) {
      const exemplo = p.rota.replace(/:[^/]+/g, 'exemplo');
      const trilha = trilhaDe(exemplo);

      expect(trilha.length, p.rota).toBeGreaterThan(0);
      expect(trilha[0].titulo, p.rota).toBe('Início');
    }
  });
});
