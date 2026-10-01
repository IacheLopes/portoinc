// ============================================================
//  Ícone
//
//  Substitui os 105 emojis que faziam papel de ícone no sistema.
//
//  Por que emoji não serve
//
//    - desenha diferente em cada sistema: 📁 no Windows não é o
//      mesmo 📁 do iPhone do Washington nem do Android do Gilson;
//    - não obedece cor nem peso — fica colorido no meio de um
//      texto cinza, e some num botão escuro;
//    - o leitor de tela fala "emoji de pasta de arquivos" no meio
//      da frase;
//    - não alinha com a linha de base do texto.
//
//  Estes são traçados, herdam `currentColor`, e têm o mesmo peso
//  de traço em todos. Um só arquivo, 24x24, sem dependência.
//
//  Acessibilidade: o ícone é SEMPRE decorativo (`aria-hidden`).
//  Quem carrega o significado é o texto ao lado. Ícone sozinho
//  num botão exige `aria-label` no botão — não aqui.
// ============================================================

import type { ReactNode } from 'react';

export type NomeDoIcone = keyof typeof CAMINHOS;

const CAMINHOS = {
  // --- avisos e estado -------------------------------------
  alerta: (
    <>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
      <path d="M12 9.5v4.2" />
      <path d="M12 16.8h.01" />
    </>
  ),
  informacao: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11.5v4.5" />
      <path d="M12 8h.01" />
    </>
  ),
  dica: (
    <>
      <path d="M9.5 18.5h5" />
      <path d="M10.5 21.5h3" />
      <path d="M12 2.5a6.2 6.2 0 0 0-3.6 11.2c.5.4.8.9.8 1.5v.3h5.6v-.3c0-.6.3-1.1.8-1.5A6.2 6.2 0 0 0 12 2.5Z" />
    </>
  ),
  aviso: (
    <>
      <path d="M3 10.5v3a1 1 0 0 0 1 1h2l6 3.8V5.7L6 9.5H4a1 1 0 0 0-1 1Z" />
      <path d="M16 9.2a3.4 3.4 0 0 1 0 5.6" />
      <path d="M18.8 6a7.2 7.2 0 0 1 0 12" />
    </>
  ),

  casa: (
    <>
      <path d="m3 10.5 9-7.5 9 7.5" />
      <path d="M5.5 9v11h13V9" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  anterior: <path d="m14.5 5-6.5 7 6.5 7" />,
  proximo: <path d="m9.5 5 6.5 7-6.5 7" />,
  // Seta dupla: ir direto para o começo ou para o fim de uma
  // lista. São as mesmas duas curvas de `anterior` e `proximo`,
  // repetidas com 5,5 de distância — mesma inclinação, mesma
  // espessura, para a dupla parecer irmã da simples ao lado.
  primeira: (
    <>
      <path d="m11 5-6.5 7 6.5 7" />
      <path d="m18 5-6.5 7 6.5 7" />
    </>
  ),
  ultima: (
    <>
      <path d="m6 5 6.5 7L6 19" />
      <path d="m13 5 6.5 7L13 19" />
    </>
  ),
  certo: <path d="m4.5 12.5 5 5 10-11" />,
  errado: <path d="M6 6l12 12M18 6 6 18" />,

  // --- documentos ------------------------------------------
  documento: (
    <>
      <path d="M14 2.8H7a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.8l-5-5Z" />
      <path d="M14 2.8v5h5" />
    </>
  ),
  pagina: (
    <>
      <path d="M14 2.8H7a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.8l-5-5Z" />
      <path d="M14 2.8v5h5" />
      <path d="M9 13h6M9 16.5h4" />
    </>
  ),
  prancheta: (
    <>
      <path d="M9 4H7a2 2 0 0 0-2 2v13.2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="2.5" width="6" height="3.2" rx="1" />
      <path d="M9 12h6M9 15.5h4" />
    </>
  ),
  escrever: (
    <>
      <path d="M4 20h4L19.6 8.4a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m14.6 5.4 4 4" />
    </>
  ),
  anexo: <path d="M20.5 11.6 12.4 19.7a5 5 0 0 1-7-7l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.8 1.8 0 0 1-2.6-2.6l7.4-7.4" />,
  arquivos: (
    <>
      <rect x="3" y="3.5" width="18" height="4.6" rx="1" />
      <path d="M5 8.1v10.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.1" />
      <path d="M10 12.5h4" />
    </>
  ),
  pasta: <path d="M3 6.5a2 2 0 0 1 2-2h3.6l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11Z" />,

  // --- comunicação -----------------------------------------
  conversa: <path d="M21 11.8a8.2 8.2 0 0 1-8.2 8.2H4l2.6-2.6A8.2 8.2 0 1 1 21 11.8Z" />,
  envelope: (
    <>
      <rect x="2.8" y="5" width="18.4" height="14" rx="2" />
      <path d="m3.2 7 8.8 5.8L20.8 7" />
    </>
  ),
  enviado: (
    <>
      <path d="M21 3 3 10.6l7 2.9 3 7L21 3Z" />
      <path d="m10 13.5 4.2-4.2" />
    </>
  ),
  entrada: (
    <>
      <path d="M12 3v11" />
      <path d="m7.2 9.8 4.8 4.8 4.8-4.8" />
      <path d="M4 18.5h16" />
    </>
  ),
  elo: (
    <>
      <path d="M10.2 13.2a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1.7 1.7" />
      <path d="M13.8 10.8a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1.7-1.7" />
    </>
  ),

  // --- obra e material -------------------------------------
  obra: (
    <>
      <path d="M3 21h18" />
      <path d="M6 21V8.2l7-3.7V21" />
      <path d="M13 12h5v9" />
      <path d="M9 11h.01M9 15h.01" />
    </>
  ),
  tijolo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 9.7h18M3 14.3h18M8.5 5v4.7M15 5v4.7M6 14.3V19M12 9.7v4.6M18 14.3V19" />
    </>
  ),
  caixa: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5" />
      <path d="M12 13v8" />
    </>
  ),
  caminhao: (
    <>
      <path d="M3 6.5h10.5V17H3z" />
      <path d="M13.5 9.5H17l3.5 3.5V17h-7" />
      <circle cx="7" cy="18.5" r="2" />
      <circle cx="17" cy="18.5" r="2" />
    </>
  ),
  maquina: (
    <>
      <circle cx="7" cy="17" r="3.2" />
      <circle cx="17.5" cy="17.8" r="2.4" />
      <path d="M7 13.8V6.5h5l2.2 5.2h3.6v5.6" />
    </>
  ),

  // --- dinheiro e análise ----------------------------------
  dinheiro: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  grafico: (
    <>
      <path d="M3 21h18" />
      <path d="M7 21v-6.5" />
      <path d="M12 21V6" />
      <path d="M17 21v-10" />
    </>
  ),
  balanca: (
    <>
      <path d="M12 3.5v17" />
      <path d="M6.5 20.5h11" />
      <path d="M3 7.5h18" />
      <path d="m6 7.5-3 6h6l-3-6Z" />
      <path d="m18 7.5-3 6h6l-3-6Z" />
    </>
  ),
  teste: (
    <>
      <path d="M9 2.8h6" />
      <path d="M10 2.8v6.4l-4.8 8.7A2 2 0 0 0 7 21h10a2 2 0 0 0 1.8-3.1L14 9.2V2.8" />
      <path d="M7.4 14.5h9.2" />
    </>
  ),

  // --- sistema ---------------------------------------------
  pessoas: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <path d="M15.8 5.2a3.4 3.4 0 0 1 0 5.6" />
      <path d="M17.6 14.6a6.2 6.2 0 0 1 3.6 5.4" />
    </>
  ),
  engrenagem: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.1 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.2-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </>
  ),
  cadeado: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.2v2.2M12 19.6v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.2 12h2.2M19.6 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </>
  ),
  lua: <path d="M20.2 14.8A8.6 8.6 0 0 1 9.2 3.8a8.6 8.6 0 1 0 11 11Z" />,
  voltar: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
} satisfies Record<string, ReactNode>;

interface Props {
  nome: NomeDoIcone;
  /** Tamanho em relação ao texto ao lado. O padrão acompanha a fonte. */
  className?: string;
}

export function Icone({ nome, className }: Props) {
  return (
    <svg
      className={'icone' + (className ? ' ' + className : '')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {CAMINHOS[nome]}
    </svg>
  );
}
