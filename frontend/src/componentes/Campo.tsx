// ============================================================
//  Campos de formulário
//
//  Um componente só para rótulo + campo + ajuda + erro. Garante
//  que TODO campo do sistema tenha rótulo ligado corretamente
//  (exigência de acessibilidade) e o mesmo espaçamento.
// ============================================================

import { useId, type ReactNode } from 'react';

/**
 * Quanto o campo recebe.
 *
 * A largura segue o CONTEÚDO, não a coluna em que o campo caiu.
 * Um campo de 969px para receber "PC-00001" faz a pessoa procurar
 * onde escrever, e sugere que cabe muito mais do que cabe.
 *
 *   curta  — número, quantidade, data, código: até uns 12 dígitos
 *   media  — nome, e-mail, uma linha de texto curta
 *   cheia  — texto livre, que usa o espaço que tiver
 */
export type LarguraDoCampo = 'curta' | 'media' | 'cheia';

interface Base {
  rotulo: string;
  largura?: LarguraDoCampo;
  /** Esconde a marca "(opcional)" em campos que são exigidos
   *  por uma ação da tela, mas não pelo envio do formulário. */
  semMarcaOpcional?: boolean;
  ajuda?: ReactNode;
  erro?: string;
  obrigatorio?: boolean;
  desabilitado?: boolean;
}

interface PropsTexto extends Base {
  valor: string;
  aoMudar: (valor: string) => void;
  tipo?: 'text' | 'email' | 'number' | 'date' | 'search' | 'tel';
  exemplo?: string;
  maximo?: number;
  /**
   * Chamado quando a pessoa aperta Enter no campo.
   *
   * Existe por causa das buscas: apertar Enter para buscar é o
   * reflexo de todo mundo. Sem isto aqui, as telas de busca
   * montavam o input na mão e acabavam sem rótulo visível.
   */
  aoConfirmar?: () => void;
}

export function Campo({
  rotulo, valor, aoMudar, tipo = 'text', ajuda, erro,
  exemplo, obrigatorio, desabilitado, maximo, semMarcaOpcional, aoConfirmar,
  largura,
}: PropsTexto) {
  const id = useId();
  const idAjuda = id + '-ajuda';

  // Data e número já vêm curtos sem ninguém pedir: "dd/mm/aaaa" e
  // "120" têm tamanho conhecido, e deixar que cada tela lembre de
  // declarar isso é garantir que metade vai esquecer.
  const tamanho = largura ?? (tipo === 'date' || tipo === 'number' ? 'curta' : 'cheia');

  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={id}>
        {rotulo}
        {!obrigatorio && !semMarcaOpcional && (
          <span className="campo__opcional"> (opcional)</span>
        )}
      </label>

      <input
        id={id}
        type={tipo}
        className={'campo__entrada' + (tamanho !== 'cheia' ? ' campo__entrada--' + tamanho : '')}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onKeyDown={
          aoConfirmar
            ? (e) => {
                if (e.key === 'Enter') {
                  // Dentro de um formulário, Enter já envia. Aqui o
                  // campo é de busca e vive fora de formulário, então
                  // precisamos agir nós.
                  e.preventDefault();
                  aoConfirmar();
                }
              }
            : undefined
        }
        placeholder={exemplo}
        maxLength={maximo}
        required={obrigatorio}
        disabled={desabilitado}
        aria-invalid={Boolean(erro)}
        aria-describedby={ajuda || erro ? idAjuda : undefined}
      />

      {erro ? (
        <p className="campo__erro" id={idAjuda} role="alert">
          <span aria-hidden="true">⚠</span> {erro}
        </p>
      ) : (
        ajuda && (
          <p className="campo__ajuda" id={idAjuda}>
            {ajuda}
          </p>
        )
      )}
    </div>
  );
}

interface PropsSelecao extends Base {
  valor: string;
  aoMudar: (valor: string) => void;
  opcoes: Array<{ valor: string; rotulo: string }>;
  vazio?: string;
}

export function Selecao({
  rotulo, valor, aoMudar, opcoes, vazio, ajuda, erro, obrigatorio, desabilitado, semMarcaOpcional,
}: PropsSelecao) {
  const id = useId();
  const idAjuda = id + '-ajuda';

  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={id}>
        {rotulo}
        {!obrigatorio && !semMarcaOpcional && (
          <span className="campo__opcional"> (opcional)</span>
        )}
      </label>

      <select
        id={id}
        className="campo__entrada"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        required={obrigatorio}
        disabled={desabilitado}
        aria-invalid={Boolean(erro)}
        aria-describedby={ajuda || erro ? idAjuda : undefined}
      >
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>

      {erro ? (
        <p className="campo__erro" id={idAjuda} role="alert">
          <span aria-hidden="true">⚠</span> {erro}
        </p>
      ) : (
        ajuda && (
          <p className="campo__ajuda" id={idAjuda}>
            {ajuda}
          </p>
        )
      )}
    </div>
  );
}

/** Mostra a mensagem de erro que veio da API, com os detalhes. */
export function ErroFormulario({
  mensagem,
  detalhes = [],
}: {
  mensagem: string;
  detalhes?: string[];
}) {
  return (
    <div className="campo__erro" role="alert">
      <span aria-hidden="true">⚠</span> {mensagem}
      {detalhes.length > 0 && (
        <ul className="campo__erro-lista">
          {detalhes.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
