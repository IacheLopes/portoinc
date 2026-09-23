// ============================================================
//  Botão de trocar o tema
//
//  Fica no rodapé do menu, junto das outras coisas que são "suas"
//  e não do trabalho — trocar senha, versão do sistema.
//
//  O rótulo diz o que vai ACONTECER ("Tema escuro"), não o estado
//  atual. Botão que anuncia o estado deixa a pessoa na dúvida se
//  clicar liga ou desliga.
// ============================================================

import { useEffect, useState } from 'react';
import { lerTema, aplicarTema, guardarTema, outroTema, type Tema } from '../tema';

export function BotaoTema() {
  const [tema, setTema] = useState<Tema>(() => lerTema());

  // Mantém a página em dia com o estado, inclusive quando o tema
  // vem guardado de uma visita anterior.
  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  function trocar() {
    const novo = outroTema(tema);
    setTema(novo);
    guardarTema(novo);
  }

  const proximo = outroTema(tema);

  return (
    <button
      type="button"
      className="menu__item menu__item--secundario"
      onClick={trocar}
      /* Diz o estado para quem usa leitor de tela, que não enxerga
         o ícone. */
      aria-pressed={tema === 'escuro'}
    >
      <span className="menu__icone" aria-hidden="true">
        {proximo === 'escuro' ? '🌙' : '☀'}
      </span>
      {proximo === 'escuro' ? 'Tema escuro' : 'Tema claro'}
    </button>
  );
}
