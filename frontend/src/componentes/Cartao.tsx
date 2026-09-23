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
  children: ReactNode;
}

export function Cartao({
  titulo,
  descricao,
  acoes,
  semEspaco,
  className,
  children,
}: Props) {
  // `--peca` marca o cartão feito pelo componente: nele o
  // espaçamento é do corpo, não da caixa. A classe existe só
  // enquanto houver cartão escrito à mão contando com o
  // espaçamento na caixa — quando a dívida zerar, ela sai.
  const classes = [
    'cartao',
    'cartao--peca',
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
            {/* h3 e não h2: o h1 é da tela e o h2 é da seção. Pular
                nível deixa buraco na estrutura para quem usa leitor
                de tela. */}
            {titulo && <h3 className="cartao__titulo">{titulo}</h3>}
            {descricao && <p className="cartao__descricao">{descricao}</p>}
          </div>

          {acoes && <div className="cartao__acoes">{acoes}</div>}
        </header>
      )}

      <div className="cartao__corpo">{children}</div>
    </section>
  );
}
