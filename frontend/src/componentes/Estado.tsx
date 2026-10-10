// ============================================================
//  Estados de tela: carregando, erro e vazio
//
//  Todo lugar que busca dados precisa dos três. Tela em branco
//  sem explicação é a falha de usabilidade mais comum que existe:
//  o usuário não sabe se travou, se deu erro ou se não há dados.
// ============================================================

import type { ReactNode } from 'react';
import { Icone } from './Icone';

interface PropsCarregando {
  mensagem?: string;
}

export function Carregando({ mensagem = 'Carregando...' }: PropsCarregando) {
  return (
    // role="status" faz o leitor de tela anunciar sem roubar o foco.
    <div className="estado" role="status" aria-live="polite">
      <div className="girando" aria-hidden="true" />
      <p>{mensagem}</p>
    </div>
  );
}

interface PropsErro {
  mensagem: string;
  aoTentarNovamente?: () => void;
}

export function Erro({ mensagem, aoTentarNovamente }: PropsErro) {
  return (
    // role="alert" interrompe e anuncia na hora: é uma falha.
    <div className="estado estado--erro" role="alert">
      <Icone nome="alerta" className="estado__icone" />
      <p>{mensagem}</p>
      {aoTentarNovamente && (
        <button type="button" className="botao botao--secundario" onClick={aoTentarNovamente}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

interface PropsVazio {
  titulo: string;
  /**
   * Texto ou conteúdo.
   *
   * Era `string`, e por isso tela vazia nenhuma conseguia dar o
   * CAMINHO: "lance em Receitas e despesas" sem o link é uma
   * instrução para a pessoa procurar sozinha. `ReactNode` aceita
   * string igual — nenhuma chamada existente muda.
   */
  descricao?: ReactNode;
}

export function Vazio({ titulo, descricao }: PropsVazio) {
  return (
    <div className="estado">
      <span className="estado__icone" aria-hidden="true">
        —
      </span>
      <p>
        <strong>{titulo}</strong>
      </p>
      {descricao && <p>{descricao}</p>}
    </div>
  );
}
