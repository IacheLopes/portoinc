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
  /**
   * Onde desenhar a lista, em coordenadas da JANELA.
   *
   * Era `position: absolute` dentro do botão, e por isso a caixa da
   * tabela cortava o menu pela metade: `.tabela-area` tem
   * `overflow-x: auto` para a tabela rolar de lado no celular, e no
   * CSS não existe rolar num eixo e transbordar no outro — o
   * navegador converte o vertical para `auto` junto.
   *
   * O dono fotografou em 27/09/2026: "Baixar o PDF" inteiro e
   * "Mandar pelo WhatsApp" cortado na borda do cartão.
   *
   * `fixed` se posiciona pela janela e nenhum `overflow` de
   * ancestral o alcança.
   */
  const [lugar, setLugar] = useState<{ topo: number; direita: number } | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const idMenu = useId();

  /** Mede o botão e decide se o menu abre para baixo ou para cima. */
  function abrir() {
    const b = gatilho.current?.getBoundingClientRect();
    if (!b) return;

    // Altura estimada: 44px por item mais o respiro da caixa. Serve
    // só para saber se cabe embaixo; o desenho real vem do CSS.
    const altura = acoes.length * 44 + 16;
    const cabeEmbaixo = b.bottom + altura + 8 <= window.innerHeight;

    setLugar({
      topo: cabeEmbaixo ? b.bottom + 4 : Math.max(8, b.top - altura - 4),
      direita: Math.max(8, window.innerWidth - b.right),
    });
    setAberto(true);
  }

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

    // Rolou a página, o menu fecha.
    //
    // Ele está preso à JANELA agora, então ficaria parado no ar
    // enquanto a linha dele some para cima. Recalcular a cada
    // rolagem seria mais bonito e mais caro; um menu é coisa de
    // três segundos, e fechar é o que a pessoa esperava mesmo.
    // `capture` para pegar a rolagem de dentro da tabela também.
    const fechar = () => setAberto(false);

    document.addEventListener('pointerdown', foraDaArea);
    document.addEventListener('keydown', tecla);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);

    return () => {
      document.removeEventListener('pointerdown', foraDaArea);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
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
        onClick={() => (aberto ? setAberto(false) : abrir())}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        /* O "⋮" não diz nada em voz alta: o nome vem daqui. */
        aria-label={descricao}
      >
        <span aria-hidden="true">⋮</span>
      </button>

      {aberto && lugar && (
        <div
          className="menu-acoes__lista"
          role="menu"
          id={idMenu}
          aria-label={descricao}
          style={{ top: lugar.topo, right: lugar.direita }}
        >
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
