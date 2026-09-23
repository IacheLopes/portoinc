// ============================================================
//  Botão de baixar, com escolha do formato
//
//  Todo download de tabela do sistema passa por aqui, para que
//  a escolha seja sempre a mesma e apareça sempre no mesmo
//  lugar. Dois formatos, e o menu diz para que serve cada um —
//  "PDF ou Word" sozinho não ajuda quem nunca pensou nisso.
// ============================================================

import { useEffect, useId, useRef, useState } from 'react';

export type FormatoDeArquivo = 'pdf' | 'docx';

const OPCOES: Array<{
  formato: FormatoDeArquivo;
  rotulo: string;
  paraQue: string;
  icone: string;
}> = [
  {
    formato: 'pdf',
    rotulo: 'PDF',
    paraQue: 'Para imprimir, assinar ou anexar num e-mail',
    icone: '📄',
  },
  {
    formato: 'docx',
    rotulo: 'Word (.docx)',
    paraQue: 'Para abrir no Word e mexer no texto',
    icone: '📝',
  },
];

export function BotaoBaixar({
  aoEscolher,
  ocupado,
  rotulo = 'Baixar',
  descricao,
}: {
  aoEscolher: (formato: FormatoDeArquivo) => void;
  ocupado?: boolean;
  rotulo?: string;
  /** O que está sendo baixado, para quem usa leitor de tela. */
  descricao: string;
}) {
  const [aberto, setAberto] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const idMenu = useId();

  // Fecha ao clicar fora e ao apertar Esc. Sem isso o menu fica
  // preso na tela e cobre o que está embaixo.
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

  function escolher(formato: FormatoDeArquivo) {
    setAberto(false);
    gatilho.current?.focus();
    aoEscolher(formato);
  }

  return (
    <div className="baixar" ref={area}>
      <button
        type="button"
        ref={gatilho}
        className="botao botao--secundario"
        onClick={() => setAberto((v) => !v)}
        disabled={ocupado}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
      >
        <span aria-hidden="true">↓</span> {ocupado ? 'Gerando...' : rotulo}
        <span className="baixar__seta" aria-hidden="true">▾</span>
      </button>

      {aberto && (
        <div className="baixar__menu" role="menu" id={idMenu} aria-label={'Formato: ' + descricao}>
          {OPCOES.map((o) => (
            <button
              key={o.formato}
              type="button"
              role="menuitem"
              className="baixar__opcao"
              onClick={() => escolher(o.formato)}
            >
              <span className="baixar__icone" aria-hidden="true">{o.icone}</span>
              <span className="baixar__texto">
                <strong>{o.rotulo}</strong>
                <small>{o.paraQue}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
