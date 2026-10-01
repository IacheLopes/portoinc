// ============================================================
//  Barra de páginas
//
//  Antes, toda lista do sistema parava em 200 e dizia "200
//  listadas", como se não houvesse mais. A linha 201 continuava
//  no banco sem aparecer em tela nenhuma.
//
//  A paginação consertou isso — e criou outro problema, que o
//  dono achou no primeiro uso: ele clicou em "2" e se perguntou
//  "será que eu mudei de página?".
//
//  O diagnóstico: a confirmação EXISTIA, mas no porão. O contador
//  ficava embaixo, junto dos botões; depois do clique a pessoa
//  continuava embaixo, olhando linhas que não pediu, com a
//  resposta fora de vista.
//
//  Por isso a barra se partiu em DUAS peças, cada uma onde serve:
//
//    <Conta/>    em cima da lista — é o que a pessoa lê ao
//                chegar, depois da tela rolar
//    <Paginacao/> embaixo — é onde a pessoa age, no fim da
//                leitura
//
//  Não é repetição: são trabalhos diferentes em lugares
//  diferentes.
// ============================================================

import { janelaDePaginas } from '../servicos/paginacao';
import { useTelaEstreita } from '../ganchos/telaEstreita';
import { Icone } from './Icone';

interface PropsConta {
  pagina: number;
  total: number;
  porPagina: number;
  oQue: string;
  oQuePlural: string;
  /** Buscando a página nova? */
  carregando?: boolean;
}

/**
 * Onde a pessoa está, em palavras.
 *
 * Fica acima da lista porque é lá que o olho cai depois de trocar
 * de página. E é uma propriedade do FILTRO somado à página — por
 * isso mora junto dos filtros, não no rodapé.
 */
export function ContaDaPagina({
  pagina, total, porPagina, oQue, oQuePlural, carregando,
}: PropsConta) {
  if (total === 0) return null;

  const primeiro = (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(pagina * porPagina, total);

  const texto = total === 1
    ? '1 ' + oQue
    : total <= porPagina
      ? total + ' ' + oQuePlural
      : 'Mostrando ' + primeiro + ' a ' + ultimo + ' de ' + total + ' ' + oQuePlural;

  return (
    // `aria-live`: quem usa leitor de tela ouve a mudança sem
    // precisar sair procurando o que mudou.
    <p className="conta-da-pagina" role="status" aria-live="polite">
      {carregando ? 'Buscando...' : texto}
    </p>
  );
}

interface Props {
  pagina: number;
  paginas: number;
  aoTrocar: (pagina: number) => void;
  /** Trava os botões enquanto a página nova não chega. */
  carregando?: boolean;
}

export function Paginacao({ pagina, paginas, aoTrocar, carregando }: Props) {
  // No celular a janela encolhe.
  //
  // Com as quatro setas mais os números, onze botões não cabem
  // numa linha de 420px — e quebrar em duas parte a sequência no
  // meio, que confunde mais do que ajuda. Sem vizinhas, a barra
  // fica com a primeira, a atual e a última, e cabe.
  const estreita = useTelaEstreita();

  if (paginas <= 1) return null;

  return (
    <nav className="paginacao" aria-label="Páginas da lista">
      {/* Ir ao começo e ao fim.
          O "1" e o último número já estão sempre na janela, então
          estes botões não abrem caminho novo — eles dão um lugar
          FIXO para clicar. Os números dançam de posição conforme
          a quantidade de dígitos; estes dois não saem do canto, e
          é isso que a mão aprende. */}
      <button
        type="button"
        className="paginacao__passo"
        onClick={() => aoTrocar(1)}
        disabled={pagina === 1 || carregando}
        aria-label="Primeira página"
      >
        <Icone nome="primeira" />
      </button>

      <button
        type="button"
        className="paginacao__passo"
        onClick={() => aoTrocar(pagina - 1)}
        disabled={pagina === 1 || carregando}
        aria-label="Página anterior"
      >
        <Icone nome="anterior" />
      </button>

      {janelaDePaginas(pagina, paginas, estreita ? 0 : 1).map((p, i) =>
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
            disabled={carregando}
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
        disabled={pagina === paginas || carregando}
        aria-label="Próxima página"
      >
        <Icone nome="proximo" />
      </button>

      <button
        type="button"
        className="paginacao__passo"
        onClick={() => aoTrocar(paginas)}
        disabled={pagina === paginas || carregando}
        aria-label="Última página"
      >
        <Icone nome="ultima" />
      </button>
    </nav>
  );
}
