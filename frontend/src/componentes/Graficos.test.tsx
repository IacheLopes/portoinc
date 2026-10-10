// ============================================================
//  Gráfico de fluxo de caixa
//
//  O gráfico mostrava três barras — pago, vencido, a vencer — e as
//  três eram SAÍDA: quem olhava via a construtora só gastando.
//
//  Agora cada mês é um par: entra à esquerda, sai à direita. O que
//  precisa estar certo é a aritmética por trás do desenho, porque
//  barra torta é a mentira mais difícil de perceber.
// ============================================================

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import {
  GraficoFluxo, GraficoCalendario, degrauDoNumero, degrauDaFileira, percentualEscrito,
  type ColunaDoFluxo, type SemanaDoCalendario,
} from './Graficos';

function mes(ajustes: Partial<ColunaDoFluxo> = {}): ColunaDoFluxo {
  return {
    rotulo: 'out/26',
    aVencer: 0,
    vencido: 0,
    pago: 0,
    total: 0,
    ...ajustes,
  };
}

/** A tabela escondida que os leitores de tela leem no lugar do desenho. */
function tabela() {
  return screen.getByRole('table');
}

/**
 * A legenda, e só ela.
 *
 * "Pago" e "A receber" existem duas vezes na tela: na legenda e na
 * tabela equivalente. Procurar pela página inteira acha as duas e
 * o teste quebra sem que nada esteja errado.
 */
function legenda(container: HTMLElement) {
  const el = container.querySelector('.gr__legenda');
  if (!el) throw new Error('a legenda não foi desenhada');
  return within(el as HTMLElement);
}

function montar(colunas: ColunaDoFluxo[]) {
  return render(<GraficoFluxo colunas={colunas} titulo="Fluxo de caixa" />);
}

describe('Sem entrada lançada', () => {
  const soSaida = [mes({ pago: 1000, total: 1000 }), mes({ rotulo: 'nov/26', aVencer: 500, total: 500 })];

  it('o gráfico fica como sempre foi: três chaves, sem grupos', () => {
    const { container } = montar(soSaida);
    const chaves = legenda(container);

    expect(chaves.queryByText('Entra:')).not.toBeInTheDocument();
    expect(chaves.queryByText('Recebido')).not.toBeInTheDocument();
    expect(chaves.getByText('Pago')).toBeInTheDocument();
  });

  it('a tabela equivalente mantém as quatro colunas antigas', () => {
    montar(soSaida);

    const cabecalho = within(tabela()).getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalho).toEqual(['Mês', 'Pago', 'Vencido', 'A vencer']);
  });

  it('o número embaixo do mês continua sendo o total que sai', () => {
    montar(soSaida);

    expect(screen.getByText('R$ 1,0k')).toBeInTheDocument();
  });
});

describe('Com entrada lançada', () => {
  const comEntrada = [
    mes({ rotulo: 'set/26', entrada: 305000, aReceber: 0, pago: 9400, total: 9400 }),
    mes({ rotulo: 'out/26', entrada: 0, aReceber: 96500, aVencer: 6900, total: 6900 }),
  ];

  it('a legenda separa o que entra do que sai', () => {
    const { container } = montar(comEntrada);
    const chaves = legenda(container);

    expect(chaves.getByText('Entra:')).toBeInTheDocument();
    expect(chaves.getByText('Sai:')).toBeInTheDocument();
    expect(chaves.getByText('Recebido')).toBeInTheDocument();
    expect(chaves.getByText('A receber')).toBeInTheDocument();
  });

  it('o número embaixo do mês é o SALDO, não só a saída', () => {
    // Era o defeito: embaixo de uma barra azul de R$ 305 mil
    // aparecia "R$ 9,4k", que era só o que tinha saído.
    montar(comEntrada);

    expect(screen.getByText('+R$ 295,6k')).toBeInTheDocument();
    expect(screen.getByText('+R$ 89,6k')).toBeInTheDocument();
  });

  it('o mês em que saiu mais do que entrou mostra o sinal de menos', () => {
    montar([mes({ entrada: 1000, pago: 4000, total: 4000 })]);

    expect(screen.getByText('−R$ 3,0k')).toBeInTheDocument();
  });

  it('a escala conta os DOIS lados', () => {
    // Com a escala só da saída, uma medição de R$ 305.000 contra um
    // mês de R$ 9.400 de parcela sairia pelo teto do cartão: a barra
    // seria calculada em mais de 3000% da altura.
    const { container } = montar(comEntrada);

    const alturas = [...container.querySelectorAll('.fluxo__pedaco')].map((e) =>
      Number.parseFloat((e as HTMLElement).style.height),
    );

    expect(alturas.length).toBeGreaterThan(0);
    for (const altura of alturas) {
      expect(altura).toBeLessThanOrEqual(100);
    }
    // A maior das barras encosta no topo, e é a entrada de setembro.
    expect(Math.max(...alturas)).toBe(100);
  });

  it('a barra de entrada vem ANTES da de saída em cada mês', () => {
    // A direção é contada pela posição, não pela cor: as três cores
    // do gráfico já significam o estado do que sai.
    const { container } = montar([comEntrada[0]]);

    const pilhas = container.querySelectorAll('.fluxo__barras--par .fluxo__pilha');
    expect(pilhas).toHaveLength(2);
    expect(pilhas[0].querySelector('.fluxo__pedaco')).not.toBeNull();
  });

  it('o previsto a receber é listrado, não apenas mais claro', () => {
    // Cor sozinha deixaria de fora quem não a distingue.
    const { container } = montar([comEntrada[1]]);

    expect(container.querySelector('.fluxo__pedaco--promessa')).not.toBeNull();
  });

  it('a tabela equivalente ganha as duas colunas da entrada', () => {
    montar(comEntrada);

    const cabecalho = within(tabela()).getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalho).toEqual(['Mês', 'Recebido', 'A receber', 'Pago', 'Vencido', 'A vencer']);
  });

  it('o rótulo de leitor de tela diz os dois lados', () => {
    montar([comEntrada[0]]);

    // `\s` e não um espaço: o pt-BR põe espaço FIXO depois do "R$",
    // e um espaço comum na busca não casa com ele.
    expect(
      screen.getByRole('button', {
        name: /set\/26: entra R\$\s305\.000,00, sai R\$\s9\.400,00/,
      }),
    ).toBeInTheDocument();
  });

  it('mês sem nada continua sendo "sem movimento"', () => {
    montar([mes({ rotulo: 'jan/27' }), comEntrada[0]]);

    expect(
      screen.getByRole('button', { name: 'jan/27: sem movimento' }),
    ).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
//  O número grande cabendo, e o percentual honesto
//
//  Os dois nasceram do mesmo dia: um lançamento de R$ 20 milhões
//  quebrou o cartão em duas linhas e fez quatro fatias de verdade
//  aparecerem como "0%".
// ------------------------------------------------------------
describe('O número grande', () => {
  it('não encolhe enquanto cabe', () => {
    expect(degrauDoNumero('R$ 640,30')).toBe(0);
    expect(degrauDoNumero('R$ 3.240,50')).toBe(0);
    expect(degrauDoNumero('R$ 305.000,00')).toBe(0);
  });

  it('encolhe um degrau na casa dos milhões', () => {
    expect(degrauDoNumero('R$ 1.234.567,89')).toBe(1);
  });

  it('encolhe dois na casa das dezenas de milhões', () => {
    // Era aqui que o cartão quebrava: "-R$ 19.705.971,70" não cabia
    // e o navegador punha o sinal sozinho na primeira linha.
    expect(degrauDoNumero('-R$ 19.705.971,70')).toBe(2);
    expect(degrauDoNumero('R$ 20.006.951,70')).toBe(2);
  });

  it('conta o sinal, porque ele ocupa lugar', () => {
    // Era o sinal que sobrava e era empurrado para a linha de cima.
    expect(degrauDoNumero('R$ 305.000,00')).toBe(0);
    expect(degrauDoNumero('-R$ 305.000,00')).toBe(1);
  });
});

describe('A fileira de cartões', () => {
  it('todos descem pelo mais comprido', () => {
    // Cada cartão encolhendo sozinho deixava "R$ 305.000,00" grande
    // ao lado de "-R$ 19.705.971,70" pequeno, na mesma fileira — e
    // tamanho diferente entre iguais o olho lê como importância.
    expect(
      degrauDaFileira('R$ 305.000,00', '-R$ 19.705.971,70', 'R$ 640,30'),
    ).toBe(2);
  });

  it('fileira de números curtos não encolhe nada', () => {
    expect(degrauDaFileira('R$ 640,30', 'R$ 3.240,50', '12 dias')).toBe(0);
  });

  it('fileira vazia não quebra', () => {
    expect(degrauDaFileira()).toBe(0);
  });
});

describe('O percentual da fatia', () => {
  it('fatia que existe NUNCA lê 0%', () => {
    // R$ 3.240,50 ao lado de R$ 20 milhões arredonda para zero. Dizer
    // "0%" afirma que a fatia não existe — e ela existe.
    expect(percentualEscrito(0, 3240.5)).toBe('<1%');
  });

  it('zero de verdade continua 0%', () => {
    expect(percentualEscrito(0, 0)).toBe('0%');
  });

  it('o resto passa direto', () => {
    expect(percentualEscrito(61, 185000)).toBe('61%');
    expect(percentualEscrito(100, 20000000)).toBe('100%');
  });
});

// ------------------------------------------------------------
//  O calendário avisa a coisa certa
// ------------------------------------------------------------
describe('O aviso do caixa', () => {
  function semana(ajustes: Partial<SemanaDoCalendario> = {}): SemanaDoCalendario {
    return {
      chave: '2026-10-05',
      rotulo: '5 a 11/out',
      entra: 0,
      sai: 0,
      saldoProjetado: 1000,
      ...ajustes,
    };
  }

  it('cala a boca quando o caixa fecha todas as semanas', () => {
    render(
      <GraficoCalendario
        semanas={[semana(), semana({ chave: '2026-10-12', saldoProjetado: 2000 })]}
        titulo="O que vem pela frente"
      />,
    );

    expect(screen.queryByText(/O caixa/)).not.toBeInTheDocument();
  });

  it('avisa que VAI furar quando hoje ainda está no azul', () => {
    render(
      <GraficoCalendario
        semanas={[
          semana({ saldoProjetado: 500, sai: 100 }),
          semana({ chave: '2026-10-12', saldoProjetado: -4000, sai: 4500 }),
        ]}
        titulo="O que vem pela frente"
      />,
    );

    expect(screen.getByText(/O caixa não fecha em alguma semana/)).toBeInTheDocument();
  });

  it('avisa que JÁ ESTÁ negativo, e é outra frase', () => {
    // "O saldo fica negativo antes do fim do período" é uma previsão.
    // Dita para quem já está devendo hoje, soa como se houvesse tempo
    // de reagir — e não há.
    render(
      <GraficoCalendario
        semanas={[
          semana({ saldoProjetado: -19705971.7 }),
          semana({ chave: '2026-10-12', saldoProjetado: -19705971.7 }),
        ]}
        titulo="O que vem pela frente"
      />,
    );

    expect(screen.getByText(/O caixa já está negativo/)).toBeInTheDocument();
    expect(screen.queryByText(/não fecha em alguma semana/)).not.toBeInTheDocument();
  });

  it('a escala é do movimento, não do saldo', () => {
    // O saldo pode ser cem vezes maior que o que anda numa semana.
    // Medindo as barras por ele, toda semana viraria um fio no chão.
    const { container } = render(
      <GraficoCalendario
        semanas={[
          semana({ entra: 1000, saldoProjetado: 900000 }),
          semana({ chave: '2026-10-12', sai: 500, saldoProjetado: 899500 }),
        ]}
        titulo="O que vem pela frente"
      />,
    );

    const alturas = [...container.querySelectorAll('.fluxo__pedaco')].map((e) =>
      Number.parseFloat((e as HTMLElement).style.height),
    );

    expect(alturas).toHaveLength(2);
    expect(Math.max(...alturas)).toBe(100);
  });
});
