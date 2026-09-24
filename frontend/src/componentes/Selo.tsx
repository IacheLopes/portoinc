// ============================================================
//  Selo de situação
//
//  Regra de acessibilidade: a cor NUNCA carrega a informação
//  sozinha. Sempre acompanha um ícone e um texto, para quem não
//  distingue cores e para leitores de tela.
// ============================================================

export type TipoSelo = 'sucesso' | 'atencao' | 'erro' | 'info';

import { Icone, type NomeDoIcone } from './Icone';

const ICONES: Record<TipoSelo, NomeDoIcone> = {
  sucesso: 'certo',
  atencao: 'alerta',
  erro: 'errado',
  info: 'informacao',
};

interface Props {
  tipo: TipoSelo;
  children: React.ReactNode;
}

export function Selo({ tipo, children }: Props) {
  return (
    <span className={'selo selo--' + tipo}>
      <Icone nome={ICONES[tipo]} />
      {children}
    </span>
  );
}
