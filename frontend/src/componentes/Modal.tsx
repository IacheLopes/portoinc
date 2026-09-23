// ============================================================
//  Modal
//
//  Modal serve para INTERROMPER. Se não há motivo para interromper,
//  ele atrapalha — por isso a lista do que entra e do que não entra
//  está escrita no documento de design, e não fica a cargo de cada
//  tela decidir.
//
//  É um <dialog> de verdade, não uma div fingindo ser janela. O
//  navegador já dá de graça o que quase todo mundo erra ao escrever
//  do zero:
//
//    - o foco fica preso dentro enquanto está aberto
//    - o que está atrás não recebe clique nem tabulação
//    - Esc fecha
//    - o fundo escurecido vem junto (::backdrop)
//
//  O que o navegador NÃO faz, e está aqui:
//
//    - devolver o foco ao botão que abriu
//    - travar a rolagem do que está atrás
//    - perguntar antes de descartar o que foi preenchido
// ============================================================

import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  aberto: boolean;
  /** Chamado quando o modal deve fechar, por qualquer caminho. */
  aoFechar: () => void;
  titulo: string;
  /** Uma linha embaixo do título, dizendo o que está em jogo. */
  descricao?: ReactNode;
  /** Os botões do rodapé. O que confirma vem por último, à direita. */
  acoes?: ReactNode;
  /**
   * Há coisa preenchida e não salva?
   *
   * Com isto ligado, Esc e clique fora perguntam antes de jogar fora
   * o que a pessoa digitou.
   */
  temAlteracao?: boolean;
  children?: ReactNode;
}

export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  acoes,
  temAlteracao,
  children,
}: Props) {
  const caixa = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idDescricao = useId();

  // Quem tinha o foco antes de abrir. O navegador nem sempre devolve
  // sozinho, e sem isso quem navega por teclado volta para o começo
  // da página depois de fechar.
  const focoAnterior = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;

    if (aberto && !el.open) {
      focoAnterior.current = document.activeElement as HTMLElement | null;
      el.showModal();

      // O <dialog> trava clique e tabulação, mas não a ROLAGEM do que
      // está atrás: sem isto, rolar o modal no fim leva a página de
      // trás junto.
      document.body.style.overflow = 'hidden';
    }

    if (!aberto && el.open) {
      el.close();
    }
  }, [aberto]);

  // Devolve a rolagem quando o modal sai da tela por qualquer motivo,
  // inclusive se a tela inteira for desmontada com ele aberto.
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  function fechar() {
    if (temAlteracao) {
      const certeza = window.confirm(
        'Você preencheu coisas que ainda não foram salvas. Fechar mesmo assim?',
      );
      if (!certeza) return;
    }

    document.body.style.overflow = '';
    focoAnterior.current?.focus();
    aoFechar();
  }

  return (
    <dialog
      ref={caixa}
      className="modal"
      aria-labelledby={idTitulo}
      aria-describedby={descricao ? idDescricao : undefined}
      /* Esc dispara `cancel`. Interceptamos para passar pela mesma
         pergunta do botão de fechar — senão Esc joga fora o que foi
         digitado sem avisar. */
      onCancel={(e) => {
        e.preventDefault();
        fechar();
      }}
      /* Clique no fundo escurecido conta como fechar. O alvo do
         clique é o próprio <dialog> só quando ele cai fora da caixa
         de conteúdo. */
      onClick={(e) => {
        if (e.target === caixa.current) fechar();
      }}
    >
      <div className="modal__caixa">
        <header className="modal__cabecalho">
          <div>
            <h2 id={idTitulo} className="modal__titulo">
              {titulo}
            </h2>
            {descricao && (
              <p id={idDescricao} className="modal__descricao">
                {descricao}
              </p>
            )}
          </div>

          <button
            type="button"
            className="modal__fechar"
            onClick={fechar}
            aria-label="Fechar"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        {children && <div className="modal__corpo">{children}</div>}

        {acoes && <footer className="modal__acoes">{acoes}</footer>}
      </div>
    </dialog>
  );
}
