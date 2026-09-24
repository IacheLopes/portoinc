// ============================================================
//  Gráficos
//
//  Desenhados à mão, sem biblioteca. Três motivos:
//
//    1. Peso: o container tem 1 GB, e uma biblioteca de gráficos
//       traz muito mais do que precisamos.
//    2. Tema: aqui os gráficos usam os mesmos tokens de cor do
//       resto do sistema e acompanham o modo claro/escuro.
//    3. Acessibilidade: cada gráfico vem com uma TABELA
//       equivalente, escondida visualmente, para quem usa leitor
//       de tela. Gráfico bonito que exclui gente não serve.
//
//  As barras são HTML, não SVG. Motivo prático: SVG esticado com
//  "preserveAspectRatio: none" nunca alinha com um rótulo em
//  HTML embaixo — as barras ficavam fora do lugar. Em HTML, a
//  mesma grade vale para a barra e para o rótulo.
//
//  Toda barra, fatia e indicador mostra os números ao passar o
//  mouse (PC), ao tocar (celular) e ao chegar pelo teclado.
// ============================================================

import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode,
} from 'react';
import { dinheiro } from '../servicos/cadastros';
import { dinheiroCurto } from '../servicos/texto';
import { Icone } from './Icone';

const TONS = {
  erro: 'var(--erro-texto)',
  atencao: 'var(--atencao-texto)',
  info: 'var(--info-texto)',
  sucesso: 'var(--sucesso-texto)',
  /** Cinza, para "o resto": não compete com as cores que significam algo. */
  neutro: 'var(--neutro-400)',
} as const;

export type Tom = keyof typeof TONS;

// Dinheiro vem das funções oficiais. Este arquivo tinha as suas
// próprias, e a daqui não passava `maximumFractionDigits` — duas
// versões do mesmo número esperando divergir.

// ------------------------------------------------------------
//  A dica que aparece ao apontar
// ------------------------------------------------------------

export interface ConteudoDaDica {
  titulo: string;
  linhas: Array<{ rotulo: string; valor: string; tom?: Tom }>;
  rodape?: string;
}

interface DicaPosicionada extends ConteudoDaDica {
  /** Onde apontar, em coordenadas da JANELA. */
  x: number;
  y: number;
  /**
   * A faixa vertical do gráfico, também em coordenadas da janela.
   *
   * A dica fica dentro dela. Sem este limite, "acima do ponteiro"
   * vale sempre que couber na JANELA — e no alto de uma barra alta
   * isso é em cima do título do cartão, que foi o defeito apontado.
   */
  limite: { topo: number; base: number };
}

/**
 * Uma dica só por gráfico.
 *
 * Mouse: aparece ao entrar e acompanha o ponteiro.
 * Toque: aparece ao tocar e some ao tocar fora.
 * Teclado: aparece ao chegar no elemento com Tab.
 *
 * As coordenadas são da JANELA, e não da área do gráfico. A dica
 * era posicionada dentro da área, e a área vive dentro do cartão —
 * que recorta o que vaza pelo canto arredondado. Resultado: a dica
 * saía cortada pela borda de cima do cartão.
 */
function useDica() {
  const area = useRef<HTMLDivElement>(null);
  const [dica, setDica] = useState<DicaPosicionada | null>(null);

  const esconder = useCallback(() => setDica(null), []);

  /** A faixa do gráfico, onde a dica pode morar. */
  const faixa = useCallback(() => {
    const c = area.current?.getBoundingClientRect();
    return c ? { topo: c.top, base: c.bottom } : { topo: 0, base: window.innerHeight };
  }, []);

  const mostrarNoPonto = useCallback(
    (e: { clientX: number; clientY: number }, conteudo: ConteudoDaDica) => {
      setDica({ ...conteudo, x: e.clientX, y: e.clientY, limite: faixa() });
    },
    [faixa],
  );

  /** Para o teclado: ancora no meio do elemento que recebeu foco. */
  const mostrarNoElemento = useCallback((alvo: Element, conteudo: ConteudoDaDica) => {
    const dele = alvo.getBoundingClientRect();
    setDica({ ...conteudo, x: dele.left + dele.width / 2, y: dele.top, limite: faixa() });
  }, [faixa]);

  // No celular, tocar fora fecha a dica.
  useEffect(() => {
    if (!dica) return;

    function aoTocarFora(e: PointerEvent) {
      if (!area.current?.contains(e.target as Node)) esconder();
    }

    document.addEventListener('pointerdown', aoTocarFora);
    return () => document.removeEventListener('pointerdown', aoTocarFora);
  }, [dica, esconder]);

  /** Liga os eventos num elemento que deve mostrar a dica. */
  const ligar = useCallback(
    (conteudo: ConteudoDaDica) => ({
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') mostrarNoPonto(e, conteudo);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') mostrarNoPonto(e, conteudo);
      },
      onPointerLeave: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') esconder();
      },
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') mostrarNoPonto(e, conteudo);
      },
      onFocus: (e: React.FocusEvent) => mostrarNoElemento(e.currentTarget, conteudo),
      onBlur: esconder,
    }),
    [mostrarNoPonto, mostrarNoElemento, esconder],
  );

  return { area, dica, ligar };
}

/** Respiro entre a dica e o ponteiro, e entre ela e a borda da tela. */
const FOLGA = 12;
const MARGEM = 8;

/**
 * A camada da dica.
 *
 * Ela se MEDE antes de se posicionar, em vez de chutar um tamanho:
 * a altura depende de quantas linhas o gráfico mandou, e a largura
 * do texto mais comprido. Com medida na mão:
 *
 *   - Horizontal: centrada no ponteiro, presa dentro da janela
 *   - Vertical: acima do ponteiro, e presa dentro da FAIXA do
 *     gráfico; se não couber acima, desce para baixo dele
 *
 * A faixa é o que a janela sozinha não resolvia. Apontando o topo
 * de uma barra alta, "acima do ponteiro" ainda cabia na janela — e
 * caía em cima do título do cartão. Foi o defeito apontado.
 *
 * A medição roda em `useLayoutEffect`, antes da pintura — senão o
 * primeiro quadro apareceria no lugar errado e piscaria.
 */
function CamadaDaDica({ dica }: { dica: DicaPosicionada | null }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [posto, setPosto] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!dica || !caixa.current) return;

    const r = caixa.current.getBoundingClientRect();

    const left = Math.max(
      MARGEM,
      Math.min(dica.x - r.width / 2, window.innerWidth - r.width - MARGEM),
    );

    // O teto e o chão: o que for mais apertado entre a faixa do
    // gráfico e a janela.
    const teto = Math.max(MARGEM, dica.limite.topo);
    const chao = Math.min(window.innerHeight - MARGEM, dica.limite.base);

    const acima = dica.y - r.height - FOLGA;
    const abaixo = dica.y + FOLGA;

    let top;
    if (acima >= teto) top = acima;
    else if (abaixo + r.height <= chao) top = abaixo;
    // Não cabe nem em cima nem embaixo: cola no teto. Acontece em
    // gráfico baixo, e é melhor que sair do cartão.
    else top = Math.max(MARGEM, Math.min(teto, window.innerHeight - r.height - MARGEM));

    setPosto({ left, top });
  }, [dica]);

  if (!dica) return null;

  return (
    <div
      ref={caixa}
      className="dica"
      // Antes de medir ela fica fora da tela: aparecer no lugar
      // errado por um quadro é pior do que aparecer um quadro depois.
      style={posto ? { left: posto.left, top: posto.top } : { left: -9999, top: -9999 }}
      role="status"
      aria-live="polite"
    >
      <strong className="dica__titulo">{dica.titulo}</strong>

      <ul className="dica__linhas">
        {dica.linhas.map((l) => (
          <li key={l.rotulo}>
            {l.tom && <i style={{ background: TONS[l.tom] }} aria-hidden="true" />}
            <span>{l.rotulo}</span>
            <strong>{l.valor}</strong>
          </li>
        ))}
      </ul>

      {dica.rodape && <small className="dica__rodape">{dica.rodape}</small>}
    </div>
  );
}

// ------------------------------------------------------------
//  Cartão de indicador, com explicação no "?"
//
//  A explicação ficava numa dica flutuante, que aparecia ao passar
//  o mouse e seguia o ponteiro. Três problemas, e o primeiro foi
//  apontado de fora:
//
//    1. Ela COBRIA o cartão vizinho. Medido: o cartão do meio do
//       Financeiro vai de 553 a 830px, o vizinho começa em 846, e a
//       dica tem até 280px centrados no ponteiro — com o mouse na
//       borda direita ela invadia 140px do vizinho e escondia o
//       número dele
//    2. Passar o mouse não existe no celular, e o sistema é usado
//       na obra
//    3. Hover é justamente o que a régua não consegue conferir
//
//  Agora é um botão "?" no canto, e a explicação abre DENTRO do
//  cartão. Não cobre nada, funciona no toque, funciona no teclado,
//  e é layout — que a régua mede.
// ------------------------------------------------------------

export function CartaoIndicador({
  rotulo,
  valor,
  detalhe,
  explicacao,
  destaque,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  /** O que o número significa. Abre dentro do cartão, no "?". */
  explicacao: string;
  destaque?: Tom;
}) {
  const [aberta, setAberta] = useState(false);
  const idExplicacao = useId();

  return (
    <article
      className={'indicador-grafico' + (destaque ? ' indicador-grafico--' + destaque : '')}
    >
      <span className="indicador-grafico__rotulo">{rotulo}</span>

      <button
        type="button"
        className="indicador-grafico__ajuda"
        aria-expanded={aberta}
        aria-controls={idExplicacao}
        aria-label={aberta ? 'Fechar a explicação de ' + rotulo : 'O que é ' + rotulo + '?'}
        onClick={() => setAberta((v) => !v)}
      >
        <span aria-hidden="true">{aberta ? '×' : '?'}</span>
      </button>

      <span className="indicador-grafico__valor">{valor}</span>
      <span className="indicador-grafico__detalhe">{detalhe}</span>

      {aberta && (
        <p className="indicador-grafico__explicacao" id={idExplicacao}>
          {explicacao}
        </p>
      )}
    </article>
  );
}

// ------------------------------------------------------------
//  Barras empilhadas por mês (fluxo de caixa)
// ------------------------------------------------------------

export interface ColunaDoFluxo {
  rotulo: string;
  aVencer: number;
  vencido: number;
  pago: number;
  total: number;
}

/**
 * O controle de período do gráfico.
 *
 * Fica dentro do cartão do gráfico, e não no topo da tela, porque ele
 * move SÓ esta janela: os indicadores, a rosca e os rankings continuam
 * falando de hoje.
 */
export interface PeriodoDoFluxo {
  /** Centro da janela, no formato AAAA-MM. */
  referencia: string;
  /** O mês de hoje, também AAAA-MM. Serve para saber quando oferecer o "Hoje". */
  hoje: string;
  aoMudar: (referencia: string) => void;
  carregando?: boolean;
}

/** Anda `passos` meses a partir de um AAAA-MM, virando o ano sozinho. */
export function andarMeses(referencia: string, passos: number): string {
  const [ano, mes] = referencia.split('-').map(Number);
  const d = new Date(ano, mes - 1 + passos, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function GraficoFluxo({
  colunas,
  titulo,
  destacar,
  periodo,
}: {
  colunas: ColunaDoFluxo[];
  titulo: string;
  destacar?: string;
  periodo?: PeriodoDoFluxo;
}) {
  const { area, dica, ligar } = useDica();
  const maior = Math.max(...colunas.map((c) => c.total), 1);

  return (
    <figure className="gr">
      <figcaption className="gr__titulo">{titulo}</figcaption>

      {/* Legenda e período dividem a MESMA fileira: são os dois
          controles do gráfico, e empilhados viravam duas tiras de
          coisas pequenas entre o título e as barras. No celular a
          fileira quebra sozinha. */}
      <div className="gr__controles">
        <div className="gr__legenda">
          <span className="gr__chave"><i style={{ background: TONS.sucesso }} /> Pago</span>
          <span className="gr__chave"><i style={{ background: TONS.erro }} /> Vencido</span>
          <span className="gr__chave"><i style={{ background: TONS.atencao }} /> A vencer</span>
        </div>

        {periodo && (
        <div className="fluxo__periodo">
          {/* Meia janela por toque: andando 12 de uma vez, nenhum mês
              da tela anterior continua à vista e some a referência. */}
          <button
            type="button"
            className="botao botao--secundario fluxo__passo"
            aria-label="Seis meses para trás"
            onClick={() => periodo.aoMudar(andarMeses(periodo.referencia, -6))}
          >
            <Icone nome="anterior" />
          </button>

          {/* `type="month"` é nativo: no iPhone abre a rodinha do iOS e
              no computador o calendário do navegador. Um seletor próprio
              seria mais código e pior em ambos. */}
          <label className="fluxo__periodo-campo">
            <span className="apenas-leitor-tela">Mês no centro do gráfico</span>
            <input
              type="month"
              className="campo__entrada"
              value={periodo.referencia}
              onChange={(e) => e.target.value && periodo.aoMudar(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="botao botao--secundario fluxo__passo"
            aria-label="Seis meses para frente"
            onClick={() => periodo.aoMudar(andarMeses(periodo.referencia, 6))}
          >
            <Icone nome="proximo" />
          </button>

          {/* Só aparece quando há para onde voltar: botão que não faz
              nada ensina a ignorar os que fazem. */}
          {periodo.referencia !== periodo.hoje && (
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => periodo.aoMudar(periodo.hoje)}
            >
              Hoje
            </button>
          )}

          <span className="fluxo__periodo-estado" role="status">
            {periodo.carregando ? 'Carregando...' : ''}
          </span>
        </div>
        )}
      </div>

      <div className="fluxo" ref={area}>
        {/* Linhas de apoio: dão noção de escala sem poluir. */}
        <div className="fluxo__guias" aria-hidden="true">
          <span /><span /><span /><span />
        </div>

        <ol className="fluxo__colunas">
          {colunas.map((c, i) => {
            const vazio = c.total <= 0;
            const eHoje = c.rotulo === destacar;

            const conteudo: ConteudoDaDica = {
              titulo: c.rotulo + (eHoje ? ' · mês atual' : ''),
              linhas: vazio
                ? [{ rotulo: 'Sem movimento', valor: '—' }]
                : [
                    ...(c.pago > 0
                      ? [{ rotulo: 'Pago', valor: dinheiro(c.pago), tom: 'sucesso' as Tom }]
                      : []),
                    ...(c.vencido > 0
                      ? [{ rotulo: 'Vencido', valor: dinheiro(c.vencido), tom: 'erro' as Tom }]
                      : []),
                    ...(c.aVencer > 0
                      ? [{ rotulo: 'A vencer', valor: dinheiro(c.aVencer), tom: 'atencao' as Tom }]
                      : []),
                    { rotulo: 'Total do mês', valor: dinheiro(c.total) },
                  ],
            };

            return (
              <li key={c.rotulo} className={'fluxo__mes' + (eHoje ? ' fluxo__mes--hoje' : '')}>
                <button
                  type="button"
                  className="fluxo__alvo"
                  aria-label={
                    c.rotulo + ': ' + (vazio ? 'sem movimento' : 'total ' + dinheiro(c.total))
                  }
                  {...ligar(conteudo)}
                >
                  <span className="fluxo__pilha" style={{ ['--atraso' as string]: i * 45 + 'ms' }}>
                    {c.aVencer > 0 && (
                      <span
                        className="fluxo__pedaco"
                        style={{
                          height: (c.aVencer / maior) * 100 + '%',
                          background: TONS.atencao,
                        }}
                      />
                    )}
                    {c.vencido > 0 && (
                      <span
                        className="fluxo__pedaco"
                        style={{
                          height: (c.vencido / maior) * 100 + '%',
                          background: TONS.erro,
                        }}
                      />
                    )}
                    {c.pago > 0 && (
                      <span
                        className="fluxo__pedaco"
                        style={{
                          height: (c.pago / maior) * 100 + '%',
                          background: TONS.sucesso,
                        }}
                      />
                    )}
                  </span>

                  <span className="fluxo__rotulo">
                    {c.rotulo}
                    <small>{vazio ? '—' : dinheiroCurto(c.total)}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <CamadaDaDica dica={dica} />
      </div>

      <TabelaEquivalente
        titulo={titulo}
        colunas={['Mês', 'Pago', 'Vencido', 'A vencer']}
        linhas={colunas.map((c) => [
          c.rotulo,
          dinheiro(c.pago),
          dinheiro(c.vencido),
          dinheiro(c.aVencer),
        ])}
      />
    </figure>
  );
}

// ------------------------------------------------------------
//  Rosca (composição da carteira)
// ------------------------------------------------------------

export interface FatiaDoGrafico {
  rotulo: string;
  valor: number;
  percentual: number;
  tom: Tom;
}

export function GraficoRosca({
  fatias,
  titulo,
  centroRotulo,
  centroValor,
  rotuloFatia = 'Faixa',
}: {
  fatias: FatiaDoGrafico[];
  titulo: string;
  centroRotulo: string;
  centroValor: string;
  /** Como se chama cada fatia, na tabela para leitor de tela. */
  rotuloFatia?: string;
}) {
  const { area, dica, ligar } = useDica();

  const RAIO = 42;
  const VOLTA = 2 * Math.PI * RAIO;
  const total = fatias.reduce((s, f) => s + f.valor, 0);

  // O valor do meio encolhe quando o número é comprido. Sem isso,
  // "R$ 1.234.567,89" encosta no anel dos dois lados.
  const tamanhoDoValor =
    centroValor.length > 13 ? 7.5 : centroValor.length > 10 ? 9 : 11;

  let percorrido = 0;
  const desenhadas = fatias.map((f) => {
    const pedaco = total > 0 ? (f.valor / total) * VOLTA : 0;
    const inicio = percorrido;
    percorrido += pedaco;
    return { ...f, pedaco, inicio };
  });

  function dicaDaFatia(f: FatiaDoGrafico): ConteudoDaDica {
    return {
      titulo: f.rotulo,
      linhas: [
        { rotulo: 'Valor', valor: dinheiro(f.valor), tom: f.tom },
        { rotulo: 'Participação', valor: f.percentual + '%' },
      ],
    };
  }

  return (
    <figure className="gr">
      <figcaption className="gr__titulo">{titulo}</figcaption>

      <div className="rosca-area" ref={area}>
        <svg viewBox="0 0 120 120" className="rosca">
          <circle cx="60" cy="60" r={RAIO} className="rosca__trilho" />

          {desenhadas.map((f, i) => (
            <circle
              key={f.rotulo}
              cx="60"
              cy="60"
              r={RAIO}
              className="rosca__fatia"
              stroke={TONS[f.tom]}
              strokeDasharray={f.pedaco + ' ' + (VOLTA - f.pedaco)}
              strokeDashoffset={-f.inicio}
              style={{ ['--atraso' as string]: i * 120 + 'ms', ['--volta' as string]: VOLTA }}
              {...ligar(dicaDaFatia(f))}
            />
          ))}

          <text
            x="60"
            y="58"
            className="rosca__valor"
            style={{ fontSize: tamanhoDoValor + 'px' }}
          >
            {centroValor}
          </text>
          <text x="60" y="70" className="rosca__rotulo">{centroRotulo}</text>
        </svg>

        <ul className="rosca__lista">
          {fatias.map((f) => (
            <li key={f.rotulo}>
              <button type="button" className="rosca__item" {...ligar(dicaDaFatia(f))}>
                <i style={{ background: TONS[f.tom] }} aria-hidden="true" />
                <span>{f.rotulo}</span>
                <strong>{dinheiro(f.valor)}</strong>
                <small>{f.percentual}%</small>
              </button>
            </li>
          ))}
        </ul>

        <CamadaDaDica dica={dica} />
      </div>

      <TabelaEquivalente
        titulo={titulo}
        colunas={[rotuloFatia, 'Valor', 'Participação']}
        linhas={fatias.map((f) => [f.rotulo, dinheiro(f.valor), f.percentual + '%'])}
      />
    </figure>
  );
}

// ------------------------------------------------------------
//  Barras horizontais (rankings)
// ------------------------------------------------------------

export interface LinhaDoRanking {
  nome: string;
  aberto: number;
  pago: number;
  total: number;
}

export function GraficoRanking({
  linhas,
  titulo,
  vazio,
  unico,
  rotuloValor = 'Total',
}: {
  linhas: LinhaDoRanking[];
  titulo: string;
  vazio: string;
  /**
   * Quando o ranking soma UM valor só, sem a divisão entre o que
   * está em aberto e o que já foi pago. Nesse caso não há legenda
   * a mostrar: duas chaves de cor para uma barra só confundem.
   */
  unico?: boolean;
  /** Como se chama o que está sendo somado. */
  rotuloValor?: string;
}) {
  const { area, dica, ligar } = useDica();
  const maior = Math.max(...linhas.map((l) => l.total), 1);

  if (linhas.length === 0) {
    return (
      <figure className="gr">
        <figcaption className="gr__titulo">{titulo}</figcaption>
        <p className="texto-fraco">{vazio}</p>
      </figure>
    );
  }

  return (
    <figure className="gr">
      <figcaption className="gr__titulo">{titulo}</figcaption>

      {!unico && (
        <div className="gr__legenda">
          <span className="gr__chave"><i style={{ background: TONS.atencao }} /> Em aberto</span>
          <span className="gr__chave"><i style={{ background: TONS.sucesso }} /> Já pago</span>
        </div>
      )}

      <div className="ranking" ref={area}>
        <ol className="ranking__linhas">
          {linhas.map((l, i) => (
            <li key={l.nome}>
              <button
                type="button"
                className="ranking__alvo"
                style={{ ['--atraso' as string]: i * 70 + 'ms' }}
                aria-label={l.nome + ': ' + rotuloValor.toLowerCase() + ' ' + dinheiro(l.total)}
                {...ligar({
                  titulo: l.nome,
                  linhas: unico
                    ? [{ rotulo: rotuloValor, valor: dinheiro(l.total) }]
                    : [
                        { rotulo: 'Em aberto', valor: dinheiro(l.aberto), tom: 'atencao' },
                        { rotulo: 'Já pago', valor: dinheiro(l.pago), tom: 'sucesso' },
                        { rotulo: 'Total', valor: dinheiro(l.total) },
                      ],
                  rodape: Math.round((l.total / maior) * 100) + '% do maior da lista',
                })}
              >
                <span className="ranking__nome">{l.nome}</span>
                <span className="ranking__valor">{dinheiro(l.total)}</span>

                <span className="ranking__trilho">
                  {unico ? (
                    <span
                      className="ranking__barra"
                      style={{ width: (l.total / maior) * 100 + '%', background: TONS.info }}
                    />
                  ) : (
                    <>
                      <span
                        className="ranking__barra"
                        style={{ width: (l.aberto / maior) * 100 + '%', background: TONS.atencao }}
                      />
                      <span
                        className="ranking__barra"
                        style={{ width: (l.pago / maior) * 100 + '%', background: TONS.sucesso }}
                      />
                    </>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <CamadaDaDica dica={dica} />
      </div>

      <TabelaEquivalente
        titulo={titulo}
        colunas={unico ? ['Nome', rotuloValor] : ['Nome', 'Em aberto', 'Pago', 'Total']}
        linhas={linhas.map((l) =>
          unico
            ? [l.nome, dinheiro(l.total)]
            : [l.nome, dinheiro(l.aberto), dinheiro(l.pago), dinheiro(l.total)],
        )}
      />
    </figure>
  );
}

// ------------------------------------------------------------
//  Medidor (percentual)
// ------------------------------------------------------------

export function Medidor({
  titulo,
  percentual,
  detalhe,
  explicacao,
  tom,
}: {
  titulo: string;
  percentual: number;
  detalhe: string;
  explicacao: string;
  tom: Tom;
}) {
  const { area, dica, ligar } = useDica();

  const RAIO = 40;
  const VOLTA = Math.PI * RAIO;
  const preenchido = (Math.min(100, Math.max(0, percentual)) / 100) * VOLTA;

  return (
    <figure className="gr">
      <figcaption className="gr__titulo">{titulo}</figcaption>

      <div className="medidor" ref={area}>
        <button
          type="button"
          className="medidor__alvo"
          aria-label={titulo + ': ' + percentual + '%'}
          {...ligar({
            titulo,
            linhas: [
              { rotulo: 'No prazo', valor: percentual + '%', tom },
              { rotulo: 'Em atraso', valor: 100 - percentual + '%' },
            ],
            rodape: explicacao,
          })}
        >
          <svg viewBox="0 0 100 58" className="medidor__desenho" aria-hidden="true">
            <path d="M 10 50 A 40 40 0 0 1 90 50" className="medidor__trilho" />
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              className="medidor__valor"
              stroke={TONS[tom]}
              strokeDasharray={preenchido + ' ' + VOLTA}
              style={{ ['--volta' as string]: VOLTA }}
            />
            <text x="50" y="46" className="medidor__numero">{percentual}%</text>
          </svg>
        </button>

        <p className="medidor__detalhe">{detalhe}</p>

        <CamadaDaDica dica={dica} />
      </div>
    </figure>
  );
}

// ------------------------------------------------------------
//  A tabela que o leitor de tela lê no lugar do desenho
// ------------------------------------------------------------

function TabelaEquivalente({
  titulo,
  colunas,
  linhas,
}: {
  titulo: string;
  colunas: string[];
  linhas: ReactNode[][];
}) {
  // A classe de esconder vai num <div>, e NAO no <table>.
  //
  // `.apenas-leitor-tela` encolhe a caixa para 1px e recorta o resto.
  // Num `<table>` isso nao funciona: a largura minima do conteudo
  // vence o `width: 1px`, e a tabela fica com a largura real —
  // invisivel, mas empurrando a pagina. Media em 2026-09-24: 574px
  // numa tela de 393. O celular disfarcava encolhendo a pagina
  // inteira para caber, e o usuario via a pagina pequena com faixa
  // vazia do lado ao afastar o zoom.
  //
  // Um <div> obedece `width: 1px` e recorta a tabela de dentro.
  return (
    <div className="apenas-leitor-tela">
      <table>
      <caption>{titulo}</caption>
      <thead>
        <tr>
          {colunas.map((c) => (
            <th scope="col" key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, i) => (
          <tr key={i}>
            {linha.map((celula, j) =>
              j === 0 ? (
                <th scope="row" key={j}>{celula}</th>
              ) : (
                <td key={j}>{celula}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
      </table>
    </div>
  );
}
