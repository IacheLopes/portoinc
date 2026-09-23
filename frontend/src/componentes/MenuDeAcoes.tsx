// ============================================================
//  Menu de ações ("⋮")
//
//  Nas telas de referência esse menu aparece em todo cartão, e eu
//  tinha decidido NÃO copiar: menu que não faz nada é ruído.
//
//  Aqui ele ganhou trabalho de verdade, e a necessidade apareceu
//  medindo. A linha da tabela de Pedidos tinha até quatro botões —
//  PDF, Marcar como enviado, WhatsApp, E-mail. Com o texto podendo
//  quebrar, a coluna ficava serrilhada; sem poder quebrar, os
//  últimos botões saíam da tela.
//
//  A saída não é espremer: é escolher. A ação principal da linha
//  fica à vista, e o resto entra aqui.
// ============================================================

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface AcaoDoMenu {
  rotulo: string;
  /** Ícone à esquerda. Sempre acompanhado do texto, nunca sozinho. */
  icone?: ReactNode;
  aoEscolher: () => void;
  desabilitada?: boolean;
  /** Ação que não se desfaz: aparece em vermelho, no fim. */
  perigo?: boolean;
}

interface Props {
  acoes: AcaoDoMenu[];
  /**
   * O que este menu governa, para quem usa leitor de tela.
   * "Ações do pedido PC-00017" diz muito mais que "Ações".
   */
  descricao: string;
}

export function MenuDeAcoes({ acoes, descricao }: Props) {
  const [aberto, setAberto] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const idMenu = useId();

  // Fecha ao clicar fora e ao apertar Esc. Sem isso o menu fica
  // preso na tela cobrindo o que está embaixo.
  useEffect(() => {
    if (!aberto) return;

    function foraDaArea(e: PointerEvent) {
      if (area.current && !area.current.contains(e.target as Node)) setAberto(false);
    }

    function tecla(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;

      setAberto(false);
      // Devolve o foco ao botão: quem navega por teclado não pode
      // ficar sem saber onde está.
      gatilho.current?.focus();
    }

    document.addEventListener('pointerdown', foraDaArea);
    document.addEventListener('keydown', tecla);

    return () => {
      document.removeEventListener('pointerdown', foraDaArea);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  function escolher(acao: AcaoDoMenu) {
    setAberto(false);
    gatilho.current?.focus();
    acao.aoEscolher();
  }

  return (
    <div className="menu-acoes" ref={area}>
      <button
        type="button"
        ref={gatilho}
        className="botao botao--discreto menu-acoes__gatilho"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        /* O "⋮" não diz nada em voz alta: o nome vem daqui. */
        aria-label={descricao}
      >
        <span aria-hidden="true">⋮</span>
      </button>

      {aberto && (
        <div className="menu-acoes__lista" role="menu" id={idMenu} aria-label={descricao}>
          {acoes.map((acao) => (
            <button
              key={acao.rotulo}
              type="button"
              role="menuitem"
              className={'menu-acoes__item' + (acao.perigo ? ' menu-acoes__item--perigo' : '')}
              onClick={() => escolher(acao)}
              disabled={acao.desabilitada}
            >
              {acao.icone && (
                <span className="menu-acoes__icone" aria-hidden="true">
                  {acao.icone}
                </span>
              )}
              {acao.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
