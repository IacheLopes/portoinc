// ============================================================
//  Cabeçalho de tela
//
//  A mesma estrutura em todas as telas:
//
//    Início › Cotações › Pacote        ← Voltar para Cotações
//    ─────────────────────────────────────────────────────────
//    Pacote de cotação BID-00002            [ações]
//    Material elétrico — 2º pavimento
//
//  Antes disto, 9 das 34 telas mostravam onde a pessoa estava e
//  só 2 tinham "Voltar" — no rodapé do formulário, não no topo.
//  Nas outras 25, quem entrava só saía pelo menu ou pelo botão do
//  navegador.
//
//  As migalhas e o Voltar saem de `navegacao.ts`, a mesma lista
//  que monta o menu. Tela nova = uma linha lá.
// ============================================================

import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { trilhaDe, voltarDe } from '../navegacao';

interface Props {
  /** O título da tela. Pode trazer dado — "Solicitação SOL-00018". */
  titulo: string;
  /**
   * Selos de situação, ao lado do título.
   *
   * Numa tela de detalhe a situação é parte da identidade do que se
   * está olhando: "SOL-00018, aguardando aprovação" é uma coisa só.
   * Jogada para outro canto da tela, ela vira informação solta.
   */
  marcadores?: ReactNode;
  /** Uma linha dizendo para que serve a tela. */
  descricao?: ReactNode;
  /** Botões da tela, à direita do título. */
  acoes?: ReactNode;
}

export function CabecalhoDePagina({ titulo, marcadores, descricao, acoes }: Props) {
  const local = useLocation();

  const trilha = trilhaDe(local.pathname);
  const voltar = voltarDe(local.pathname);

  return (
    <header className="cabecalho">
      {(trilha.length > 1 || voltar) && (
        <div className="cabecalho__caminho">
          {trilha.length > 1 && (
            <nav className="migalhas" aria-label="Você está em">
              {trilha.map((degrau, i) => {
                const ultimo = i === trilha.length - 1;

                return (
                  <span key={degrau.para} className="migalhas__degrau">
                    {i > 0 && (
                      <span className="migalhas__seta" aria-hidden="true">
                        ›
                      </span>
                    )}
                    {/* O último degrau é onde a pessoa está: não é
                        link, porque link que não leva a lugar nenhum
                        engana quem navega por teclado. */}
                    {ultimo ? (
                      <span aria-current="page">{degrau.titulo}</span>
                    ) : (
                      <Link to={degrau.para}>{degrau.titulo}</Link>
                    )}
                  </span>
                );
              })}
            </nav>
          )}

          {voltar && (
            /* O rótulo diz PARA ONDE vai, não só "voltar". Quem usa
               leitor de tela ouve o destino; quem enxerga também. */
            <Link to={voltar.para} className="cabecalho__voltar">
              <span aria-hidden="true">←</span> Voltar para {voltar.titulo}
            </Link>
          )}
        </div>
      )}

      <div className="cabecalho__linha">
        <div className="cabecalho__texto">
          {marcadores ? (
            <div className="cabecalho__titulo-com-selos">
              <h1>{titulo}</h1>
              {marcadores}
            </div>
          ) : (
            <h1>{titulo}</h1>
          )}

          {descricao && <p className="cabecalho__descricao">{descricao}</p>}
        </div>

        {acoes && <div className="cabecalho__acoes">{acoes}</div>}
      </div>
    </header>
  );
}
