// ============================================================
//  Os números que as telas índice mostram nos cartões
//
//  Vêm do `/api/inicio`, que já os calculava para a tela inicial.
//
//  REAPROVEITAR, e não recontar, é o ponto. A etapa da tela
//  inicial achou três contas feitas em memória, e uma delas
//  mentia. A regra que saiu dali: cada número do sistema tem UM
//  lugar onde é calculado. Se o índice fizesse a própria conta,
//  um dia "3 vencidas" aqui e "4 vencidas" lá.
//
//  Falhar aqui não quebra nada: o cartão simplesmente aparece sem
//  número, e o link continua levando ao mesmo lugar.
// ============================================================

import { useEffect, useState } from 'react';
import { buscarInicio, type CartaoDoInicio } from '../servicos/inicio';

export interface ContagemDoCartao {
  valor: number;
  detalhe: string;
  tom: 'atencao' | 'erro' | undefined;
}

/**
 * Mapa de endereço → número, para casar com o `para` de cada cartão.
 *
 * A chave é o endereço SEM a query: o início manda
 * `/financeiro/contas?ver=vencidas`, e o cartão do índice aponta
 * para `/financeiro/contas`.
 */
export function useContagens(): Map<string, ContagemDoCartao> {
  const [mapa, setMapa] = useState<Map<string, ContagemDoCartao>>(new Map());

  useEffect(() => {
    let ativo = true;

    buscarInicio()
      .then((r) => {
        if (!ativo) return;

        const novo = new Map<string, ContagemDoCartao>();

        for (const c of [...r.urgentes, ...r.acompanhar] as CartaoDoInicio[]) {
          const endereco = c.para.split('?')[0];
          const atual = novo.get(endereco);

          // Dois cartões podem apontar para a mesma tela — contas
          // vencidas e contas vencendo em 7 dias, por exemplo. Fica
          // o que pede mais atenção; empatando, o de maior número.
          const peso = c.tom === 'erro' ? 2 : c.tom === 'atencao' ? 1 : 0;
          const pesoAtual = atual?.tom === 'erro' ? 2 : atual?.tom === 'atencao' ? 1 : 0;

          if (atual && (pesoAtual > peso || (pesoAtual === peso && atual.valor >= c.valor))) {
            continue;
          }

          novo.set(endereco, {
            valor: c.valor,
            detalhe: c.detalhe,
            tom: c.tom === 'neutro' ? undefined : c.tom,
          });
        }

        setMapa(novo);
      })
      .catch(() => {
        /* sem número: o cartão continua levando ao mesmo lugar */
      });

    return () => {
      ativo = false;
    };
  }, []);

  return mapa;
}
