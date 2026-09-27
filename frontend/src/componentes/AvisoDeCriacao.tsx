// ============================================================
//  "Confira antes de salvar"
//
//  Pedido pelo dono na validação de 25/09/2026: um aviso no momento
//  de cadastrar, para a pessoa parar e conferir.
//
//  O motivo é concreto. Alguns campos são fáceis de digitar errado e
//  caros de corrigir depois:
//
//    · o código da família aparece em filtro e em relatório;
//    · o código e a unidade do material vão impressos no pedido de
//      compra e na nota fiscal;
//    · o CNPJ do fornecedor é o que liga a nota ao cadastro;
//    · o código da obra batiza o almoxarifado — e editar a obra
//      depois NÃO renomeia o almoxarifado, então a obra "OB-01" fica
//      com o estoque "OB-001-ALM" para sempre.
//
//  Por que amarelo e não vermelho
//
//  O dono pediu vermelho. Neste sistema o vermelho já quer dizer
//  "alguma coisa está errada agora": é a cor do erro do formulário,
//  da parcela vencida e do alarme de "modo de teste desligado".
//  Usar a mesma cor para um lembrete de rotina — que aparece toda vez
//  que alguém abre o cadastro, mesmo quando está tudo certo — ensina
//  a ignorar o vermelho, e aí ele deixa de servir quando for preciso.
//
//  O amarelo do sistema é forte: é o mesmo do aviso de trava do
//  WhatsApp. Se ainda assim for para ser vermelho, é trocar
//  `atencao` por `erro` nesta linha, e vale nos quatro cadastros.
// ============================================================

import type { ReactNode } from 'react';
import { Icone } from './Icone';

interface Props {
  /** O que a pessoa tem de conferir, em uma frase. */
  children: ReactNode;
  /**
   * A frase em negrito que abre o aviso.
   *
   * "Confira antes de salvar" serve para cadastro. A tela de
   * redefinir senha usa o mesmo formato para dizer outra coisa —
   * "Isto não tem volta" — e o título fixo ficava mentindo ali.
   */
  titulo?: string;
}

export function AvisoDeCriacao({ children, titulo = 'Confira antes de salvar.' }: Props) {
  return (
    <div className="aviso aviso--atencao aviso--de-criacao">
      <span className="aviso__icone" aria-hidden="true">
        <Icone nome="alerta" />
      </span>
      <div>
        <strong>{titulo}</strong>{' '}
        {children}
      </div>
    </div>
  );
}
