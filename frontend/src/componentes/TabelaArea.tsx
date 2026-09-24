// ============================================================
//  A caixa da tabela
//
//  No computador ela é o que sempre foi: uma tabela que rola de
//  lado se precisar.
//
//  No CELULAR cada linha vira um cartão, com o nome da coluna ao
//  lado de cada valor. O motivo não é transbordo — a tabela já
//  rolava dentro da própria caixa. É que, rolando, o telefone
//  mostra **4 das 8 colunas** de Pedidos e esconde Total, Situação
//  e Ações sem avisar que existe mais coisa à direita.
//
//  De onde vêm os rótulos: do próprio `<thead>`, lidos aqui. A
//  alternativa seria escrever `data-rotulo="Fornecedor"` em cada
//  uma das centenas de células do sistema — e no dia em que um
//  cabeçalho mudasse, metade ficaria mentindo.
// ============================================================

import { useLayoutEffect, useRef, type ReactNode } from 'react';

interface Props {
  /**
   * Manter a tabela rolando de lado, sem virar cartão.
   *
   * Para tabela de COMPARAÇÃO, onde o trabalho é olhar a mesma
   * linha em várias colunas — a equalização de cotação. Ali, virar
   * cartão desmonta justamente o que a pessoa foi ver.
   */
  rolar?: boolean;
  children: ReactNode;
}

export function TabelaArea({ rolar, children }: Props) {
  const caixa = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (rolar || !caixa.current) return;

    const tabela = caixa.current.querySelector('table');
    if (!tabela) return;

    const cabecalhos = [...tabela.querySelectorAll('thead th')].map(
      (th) => th.textContent?.trim() ?? '',
    );

    for (const linha of tabela.querySelectorAll('tbody tr')) {
      // O índice conta TODAS as células, inclusive o `<th scope="row">`
      // da primeira coluna: é assim que ele casa com a ordem do
      // cabeçalho.
      [...linha.children].forEach((celula, i) => {
        const rotulo = cabecalhos[i];
        if (rotulo) celula.setAttribute('data-rotulo', rotulo);
        else celula.removeAttribute('data-rotulo');
      });
    }
  });

  return (
    <div ref={caixa} className={'tabela-area' + (rolar ? '' : ' tabela-area--cartoes')}>
      {children}
    </div>
  );
}
