// ============================================================
//  Selo de situação
//
//  Regra de acessibilidade: a cor NUNCA carrega a informação
//  sozinha. Sempre acompanha um ícone e um texto, para quem não
//  distingue cores e para leitores de tela.
// ============================================================

export type TipoSelo = 'sucesso' | 'atencao' | 'erro' | 'info';

const ICONES: Record<TipoSelo, string> = {
  sucesso: '✓',
  atencao: '⚠',
  erro: '✕',
  info: 'ℹ',
};

interface Props {
  tipo: TipoSelo;
  children: React.ReactNode;
}

export function Selo({ tipo, children }: Props) {
  return (
    <span className={'selo selo--' + tipo}>
      <span aria-hidden="true">{ICONES[tipo]}</span>
      {children}
    </span>
  );
}
