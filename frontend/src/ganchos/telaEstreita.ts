import { useEffect, useState } from 'react';

// ============================================================
//  A tela é estreita?
//
//  Quase tudo que muda no celular muda por CSS, e é assim que
//  tem de ser. Este gancho existe para o caso em que CSS não
//  resolve: quando o COMPONENTE precisa gerar menos coisa, não
//  só mostrar menos.
//
//  O caso que o trouxe: a barra de páginas. Com muitas páginas
//  ela monta até onze botões, e num celular isso quebra em duas
//  linhas partindo a sequência no meio — "« ‹ 1 … 6" em cima e
//  "7 8 … 250 › »" embaixo. Esconder botão por CSS não serve:
//  quais esconder depende de onde a pessoa está.
//
//  A resposta é montar menos números desde o começo.
// ============================================================

/** O mesmo 640px em que a casa troca tabela por cartão. */
const ESTREITA = '(max-width: 640px)';

export function useTelaEstreita(): boolean {
  const [estreita, setEstreita] = useState(
    // Começa já com a resposta certa: iniciar em `false` e
    // corrigir depois faria a barra piscar na primeira pintura.
    () => typeof window !== 'undefined' && window.matchMedia(ESTREITA).matches,
  );

  useEffect(() => {
    const consulta = window.matchMedia(ESTREITA);
    const aoMudar = (e: MediaQueryListEvent) => setEstreita(e.matches);

    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, []);

  return estreita;
}
