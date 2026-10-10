// ============================================================
//  O link que a pessoa usa para criar a senha dela
//
//  Aparece em dois momentos — ao cadastrar alguém e ao redefinir
//  a senha de alguém — e nos dois o trabalho é o mesmo: mostrar
//  o link, deixar copiar num clique, e dizer até quando vale.
//
//  O LINK FICA VISÍVEL, E NÃO ESCONDIDO ATRÁS DO BOTÃO
//
//  `navigator.clipboard` não existe fora de HTTPS em alguns
//  navegadores, e falha calada. Com o endereço na tela, quem não
//  conseguir copiar pelo botão seleciona com o dedo e copia à
//  mão — em vez de ficar olhando um botão que não faz nada.
//
//  Ele aparece UMA VEZ. Recarregar a tela não traz de volta: o
//  token não fica guardado em lugar nenhum, só o resumo dele.
//  Quem perder o link gera outro em "Redefinir senha".
// ============================================================

import { useState } from 'react';
import { Icone } from './Icone';
import { enderecoDoConvite } from '../servicos/convite';
import { dataBr } from '../servicos/solicitacoes';

interface Props {
  /** O segredo que veio na resposta do servidor. */
  token: string;
  /** Quando o link para de valer, em ISO. */
  expiraEm: string;
  /** Para quem é o link, em uma frase: "Passe para Maria". */
  chamada: string;
}

export function LinkDeSenha({ token, expiraEm, chamada }: Props) {
  const [copiado, setCopiado] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const url = enderecoDoConvite(token);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setFalhou(false);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setFalhou(true);
    }
  }

  return (
    <div className="aviso aviso--sucesso link-de-senha" role="status">
      <Icone nome="elo" className="aviso__icone" />
      <div>
        <strong>{chamada}</strong>
        <p>
          Ele cria a própria senha por aqui. O link vale até{' '}
          <strong>{dataBr(expiraEm)}</strong> e funciona uma vez só.
        </p>

        <p className="link-de-senha__endereco">
          <code>{url}</code>
        </p>

        <p>
          <button type="button" className="botao botao--secundario" onClick={() => void copiar()}>
            {copiado ? (
              <>
                <Icone nome="certo" /> Copiado
              </>
            ) : (
              <>
                <Icone nome="elo" /> Copiar link
              </>
            )}
          </button>
        </p>

        {falhou && (
          <p className="campo__erro" role="alert">
            <Icone nome="alerta" /> O navegador não deixou copiar sozinho. Selecione o
            endereço acima e copie à mão.
          </p>
        )}
      </div>
    </div>
  );
}
