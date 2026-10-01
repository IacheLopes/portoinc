// ============================================================
//  Barra de páginas
//
//  Antes, toda lista do sistema parava em 200 e dizia "200
//  listadas", como se não houvesse mais. A linha 201 continuava
//  no banco sem aparecer em tela nenhuma.
//
//  Por isso esta barra tem DUAS partes, e a primeira importa mais
//  que a segunda:
//
//    1. A CONTA — "Mostrando 21 a 40 de 347". É ela que desfaz a
//       mentira. Mesmo com uma página só, ela aparece.
//    2. Os NÚMEROS — para andar.
//
//  A última página aparece sempre como número, não como seta de
//  "ir ao fim". Ver "250" conta o tamanho do conjunto; uma seta
//  não conta nada.
// ============================================================

import { janelaDePaginas } from '../servicos/paginacao';
import { Icone } from './Icone';

interface Props {
  pagina: number;
  paginas: number;
  total: number;
  porPagina: number;
  aoTrocar: (pagina: number) => void;
  /** O que está sendo contado: "solicitação", "material"... */
  oQue: string;
  oQuePlural: string;
}

export function Paginacao({
  pagina, paginas, total, porPagina, aoTrocar, oQue, oQuePlural,
}: Props) {
  if (total === 0) return null;

  const primeiro = (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(pagina * porPagina, total);

  const conta = total === 1
    ? '1 ' + oQue
    : total <= porPagina
      ? total + ' ' + oQuePlural
      : 'Mostrando ' + primeiro + ' a ' + ultimo + ' de ' + total + ' ' + oQuePlural;

  return (
    <nav className="paginacao" aria-label="Páginas da lista">
      <p className="paginacao__conta">{conta}</p>

      {paginas > 1 && (
        <div className="paginacao__passos">
          <button
            type="button"
            className="paginacao__passo"
            onClick={() => aoTrocar(pagina - 1)}
            disabled={pagina === 1}
            aria-label="Página anterior"
          >
            <Icone nome="anterior" />
          </button>

          {janelaDePaginas(pagina, paginas).map((p, i) =>
            p === null ? (
              <span key={'vao-' + i} className="paginacao__vao" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={'paginacao__numero' + (p === pagina ? ' paginacao__numero--aqui' : '')}
                onClick={() => aoTrocar(p)}
                aria-label={'Página ' + p}
                aria-current={p === pagina ? 'page' : undefined}
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            className="paginacao__passo"
            onClick={() => aoTrocar(pagina + 1)}
            disabled={pagina === paginas}
            aria-label="Próxima página"
          >
            <Icone nome="proximo" />
          </button>
        </div>
      )}
    </nav>
  );
}
