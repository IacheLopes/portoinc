// ============================================================
//  Indicador
//
//  Um número que vale por si: rótulo, valor e uma linha de
//  contexto. O agrupamento é o que aplica a PROXIMIDADE — o olho
//  entende que os três pertencem ao mesmo assunto.
//
//  Chamava-se `Cartao` até o Design 2. O nome mudou porque cartão
//  passou a ser a CAIXA que embrulha qualquer conteúdo, e um número
//  solto dentro de uma caixa não é a mesma coisa que a caixa.
//
//  Para o indicador com gráfico ao lado, ver `CartaoIndicador` em
//  Graficos.tsx: aquele mostra também como o número chegou ali.
// ============================================================

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * O peso do número.
 *
 * `erro` é prazo já perdido, `atencao` é o que vence se ninguém
 * agir, `neutro` é acompanhamento. Quem decide isto é o servidor,
 * não a tela — assim duas telas não discordam sobre o mesmo número.
 */
export type TomDoIndicador = 'neutro' | 'atencao' | 'erro';

interface Props {
  titulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  /**
   * Para onde o número leva.
   *
   * Informado, o cartão inteiro vira link — não um "ver mais" no
   * canto. Um número que aponta um problema e não leva até ele
   * obriga a pessoa a procurar a tela certa sozinha.
   */
  para?: string;
  tom?: TomDoIndicador;
}

export function Indicador({ titulo, valor, detalhe, para, tom = 'neutro' }: Props) {
  const classes = 'indicador'
    + (tom !== 'neutro' ? ' indicador--' + tom : '')
    + (para ? ' indicador--clicavel' : '');

  const miolo = (
    <>
      <h3 className="indicador__titulo">{titulo}</h3>
      <p className="indicador__valor">{valor}</p>
      {detalhe && <p className="indicador__rodape">{detalhe}</p>}
    </>
  );

  // Link em volta de tudo, e não um `<article>` com link dentro:
  // assim o alvo de toque é o cartão inteiro, e o leitor de tela
  // anuncia rótulo, número e contexto como um item só.
  if (para) {
    return (
      <Link to={para} className={classes}>
        {miolo}
      </Link>
    );
  }

  return <article className={classes}>{miolo}</article>;
}
