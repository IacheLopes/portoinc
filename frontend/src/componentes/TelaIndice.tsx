// ============================================================
//  Tela índice: a porta de um destino do menu
//
//  A barra lateral deixou de listar as 14 telas e passou a listar
//  quatro destinos. Cada destino abre aqui: uma grade de cartões,
//  um por tela, com o número do que está esperando dentro.
//
//  O NÚMERO É O QUE FAZ A PARADA VALER. Sem ele, o índice é um
//  corredor — uma tela a mais entre a pessoa e o trabalho dela.
//  Com ele, a pessoa já decide onde entrar: "Aprovações · 3
//  esperando você" responde antes de abrir.
//
//  Os números vêm do `/api/inicio`, que já os calculava para a
//  tela inicial. Não há consulta nova no servidor, e não há uma
//  segunda conta que possa divergir da primeira.
//
//  ESTE PADRÃO NÃO NASCEU AGORA: a tela de Cadastros já era assim,
//  escondendo cinco telas atrás de uma linha do menu, e nunca
//  ninguém reclamou. O que mudou foi aplicá-lo ao menu inteiro.
// ============================================================

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CabecalhoDePagina } from './CabecalhoDePagina';
import { Icone, type NomeDoIcone } from './Icone';

export interface CartaoDoIndice {
  titulo: string;
  descricao: string;
  para: string;
  icone: NomeDoIcone;
  /**
   * A posição na sequência, quando a lista for mesmo uma.
   *
   * Solicitação → aprovação → cotação → pedido é uma sequência, e o
   * número ajuda quem está aprendendo o fluxo. Recebimento, estoque
   * e locação acontecem em paralelo: numerar prometeria uma ordem
   * que não existe.
   */
  ordem?: number;
  /** A frase pronta do servidor: "3 esperando você", "12 em aberto". */
  detalhe?: string | null;
  /** Quando o número pede atenção, o cartão ganha a borda de alerta. */
  tom?: 'atencao' | 'erro';
}

export interface BlocoDoIndice {
  /** Opcional: só quando o índice tem mais de um assunto. */
  titulo?: string;
  nota?: ReactNode;
  cartoes: CartaoDoIndice[];
}

interface Props {
  titulo: string;
  descricao: ReactNode;
  blocos: BlocoDoIndice[];
  /** Mostrado quando a pessoa não pode ver nenhum cartão. */
  vazio?: string;
}

export function TelaIndice({ titulo, descricao, blocos, vazio }: Props) {
  const comCartoes = blocos.filter((b) => b.cartoes.length > 0);

  return (
    <section className="secao">
      <CabecalhoDePagina titulo={titulo} descricao={descricao} />

      {comCartoes.length === 0 && (
        <p className="texto-fraco">
          {vazio ?? 'Você não tem acesso a nada por aqui.'}
        </p>
      )}

      {comCartoes.map((bloco, i) => (
        <div className="indice__bloco" key={bloco.titulo ?? i}>
          {bloco.titulo && (
            <div className="secao__cabecalho">
              <h2>{bloco.titulo}</h2>
            </div>
          )}

          {bloco.nota && (
            <div className="aviso aviso--info">
              <Icone nome="dica" className="aviso__icone" />
              <div>{bloco.nota}</div>
            </div>
          )}

          {/* `grade--destaque`, e nao `grade` seca.

              A grade comum usa `auto-fit`, que apaga as colunas
              vazias e estica o que sobra: o bloco de 5 cadastros
              dava cartoes de 280px e o de 3 itens do sistema dava
              cartoes de 390px, na MESMA tela. Dois tamanhos lado a
              lado leem como desencontro.

              O `auto-fill` do `--destaque` guarda as colunas
              vazias, e a largura passa a ser a mesma em todos os
              blocos. A regra ja existia: nasceu em 28/09/2026,
              quando o cartao urgente sozinho virava uma faixa na
              tela de Inicio. */}
          <div className="grade grade--destaque">
            {bloco.cartoes.map((c) => (
              <Link
                key={c.para}
                to={c.para}
                className={
                  'cadastro-cartao' + (c.tom ? ' cadastro-cartao--' + c.tom : '')
                }
              >
                {c.ordem !== undefined && (
                  <span className="cadastro-cartao__ordem" aria-hidden="true">
                    {c.ordem}
                  </span>
                )}
                <Icone nome={c.icone} className="cadastro-cartao__icone" />
                <span className="cadastro-cartao__texto">
                  <strong>{c.titulo}</strong>
                  <small>{c.descricao}</small>
                  {c.detalhe && (
                    <span className="cadastro-cartao__contagem">{c.detalhe}</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
