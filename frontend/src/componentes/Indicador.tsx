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

interface Props {
  titulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
}

export function Indicador({ titulo, valor, detalhe }: Props) {
  return (
    <article className="indicador">
      <h3 className="indicador__titulo">{titulo}</h3>
      <p className="indicador__valor">{valor}</p>
      {detalhe && <p className="indicador__rodape">{detalhe}</p>}
    </article>
  );
}
