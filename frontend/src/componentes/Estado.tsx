// ============================================================
//  Estados de tela: carregando, erro e vazio
//
//  Todo lugar que busca dados precisa dos três. Tela em branco
//  sem explicação é a falha de usabilidade mais comum que existe:
//  o usuário não sabe se travou, se deu erro ou se não há dados.
// ============================================================

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
      <span className="estado__icone" aria-hidden="true">
        ⚠
      </span>
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
  descricao?: string;
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
