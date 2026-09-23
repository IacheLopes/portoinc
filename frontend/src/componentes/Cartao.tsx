// ============================================================
//  Cartão
//
//  Uma peça, uma anatomia:
//
//    ┌──────────────────────────────────────────┐
//    │ Título da seção              [ações]     │  cabeçalho
//    ├──────────────────────────────────────────┤
//    │                                          │
//    │ o que o cartão carrega                   │  corpo
//    │                                          │
//    └──────────────────────────────────────────┘
//
//  Antes disto havia 29 arquivos desenhando cartão à mão, cada um
//  com a sua versão: uns com o título dentro, outros com o título
//  solto acima, espaçamentos diferentes. Cada tela envelhecia por
//  conta própria.
//
//  O título vem PARA DENTRO do cartão, que é o que as telas de
//  referência fazem. Título solto acima de uma caixa faz o olho
//  perguntar se ele pertence à caixa ou ao que vem depois.
// ============================================================

import type { ReactNode } from 'react';

interface Props {
  /** O título do cartão. Sem ele, o cartão não tem cabeçalho. */
  titulo?: ReactNode;
  /** Uma linha embaixo do título, explicando. */
  descricao?: ReactNode;
  /** Botões do cartão, à direita do título. */
  acoes?: ReactNode;
  /**
   * O corpo encosta na borda.
   *
   * É o caso da tabela: ela tem o próprio espaçamento por dentro, e
   * o do cartão em volta criaria uma moldura dupla.
   */
  semEspaco?: boolean;
  /** Classes extras da tela. Para caso raro, não para o comum. */
  className?: string;
  /**
   * O nível do título.
   *
   * O padrão é 3, porque o h1 é da tela e o h2 é da seção. Mas há
   * telas em que o cartão É a seção — em Famílias, "Nova família" é
   * irmão dos nomes das famílias, não filho deles. Ali ele é h2.
   *
   * Fixar o nível no componente deixava a escolha entre usar o
   * componente e manter a estrutura certa para leitor de tela.
   */
  nivel?: 2 | 3;
  children: ReactNode;
}

export function Cartao({
  titulo,
  descricao,
  acoes,
  semEspaco,
  className,
  nivel = 3,
  children,
}: Props) {
  const Titulo = nivel === 2 ? 'h2' : 'h3';
  // A classe `--peca` saiu no Design 6, quando a dívida de cartões
  // escritos à mão chegou a zero: ela existia só para desfazer, nos
  // cartões do componente, um espaçamento que a caixa carregava por
  // causa deles. Agora o espaçamento já nasce no corpo.
  const classes = [
    'cartao',
    semEspaco ? 'cartao--sem-espaco' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes}>
      {(titulo || acoes) && (
        <header className="cartao__cabecalho">
          <div className="cartao__texto">
            {/* h3 por padrão: o h1 é da tela e o h2 é da seção.
                Pular nível deixa buraco na estrutura para quem usa
                leitor de tela — por isso o nível é escolha de quem
                usa, e não uma regra fixa daqui. */}
            {titulo && <Titulo className="cartao__titulo">{titulo}</Titulo>}
            {descricao && <p className="cartao__descricao">{descricao}</p>}
          </div>

          {acoes && <div className="cartao__acoes">{acoes}</div>}
        </header>
      )}

      <div className="cartao__corpo">{children}</div>
    </section>
  );
}
