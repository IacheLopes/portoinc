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

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

const TONS = {
  erro: 'var(--erro-texto)',
  atencao: 'var(--atencao-texto)',
  info: 'var(--info-texto)',
  sucesso: 'var(--sucesso-texto)',
  /** Cinza, para "o resto": não compete com as cores que significam algo. */
  neutro: 'var(--neutro-400)',
} as const;

export type Tom = keyof typeof TONS;

function dinheiroCurto(valor: number): string {
  if (Math.abs(valor) >= 1000000) return 'R$ ' + (valor / 1000000).toFixed(1).replace('.', ',') + 'M';
  if (Math.abs(valor) >= 1000) return 'R$ ' + (valor / 1000).toFixed(1).replace('.', ',') + 'k';
  return 'R$ ' + valor.toFixed(0);
}

function dinheiro(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ------------------------------------------------------------
//  A dica que aparece ao apontar
// ------------------------------------------------------------

export interface ConteudoDaDica {
  titulo: string;
  linhas: Array<{ rotulo: string; valor: string; tom?: Tom }>;
  rodape?: string;
}

interface DicaPosicionada extends ConteudoDaDica {
  x: number;
  y: number;
}

/**
 * Uma dica só por gráfico, posicionada dentro da área dele.
 *
 * Mouse: aparece ao entrar e acompanha o ponteiro.
 * Toque: aparece ao tocar e some ao tocar fora.
 * Teclado: aparece ao chegar no elemento com Tab.
 */
function useDica() {
  const area = useRef<HTMLDivElement>(null);
  const [dica, setDica] = useState<DicaPosicionada | null>(null);

  const esconder = useCallback(() => setDica(null), []);

  const mostrarNoPonto = useCallback(
    (e: { clientX: number; clientY: number }, conteudo: ConteudoDaDica) => {
      const caixa = area.current?.getBoundingClientRect();
      if (!caixa) return;

      setDica({ ...conteudo, x: e.clientX - caixa.left, y: e.clientY - caixa.top });
    },
    [],
  );

  /** Para o teclado: ancora no meio do elemento que recebeu foco. */
  const mostrarNoElemento = useCallback((alvo: Element, conteudo: ConteudoDaDica) => {
    const caixa = area.current?.getBoundingClientRect();
    const dele = alvo.getBoundingClientRect();
    if (!caixa) return;

    setDica({
      ...conteudo,
      x: dele.left - caixa.left + dele.width / 2,
      y: dele.top - caixa.top,
    });
  }, []);

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

function CamadaDaDica({ dica }: { dica: DicaPosicionada | null }) {
  if (!dica) return null;

  return (
    <div
      className="dica"
      style={{ left: dica.x, top: dica.y }}
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
//  Cartão de indicador, com explicação ao apontar
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
  /** O que o número significa, mostrado ao apontar. */
  explicacao: string;
  destaque?: Tom;
}) {
  const { area, dica, ligar } = useDica();

  return (
    <div className="indicador-area" ref={area}>
      <button
        type="button"
        className={'indicador-grafico' + (destaque ? ' indicador-grafico--' + destaque : '')}
        {...ligar({
          titulo: rotulo,
          linhas: [{ rotulo: 'Valor', valor }],
          rodape: explicacao,
        })}
      >
        <span className="indicador-grafico__rotulo">{rotulo}</span>
        <span className="indicador-grafico__valor">{valor}</span>
        <span className="indicador-grafico__detalhe">{detalhe}</span>
      </button>

      <CamadaDaDica dica={dica} />
    </div>
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

export function GraficoFluxo({
  colunas,
  titulo,
  destacar,
}: {
  colunas: ColunaDoFluxo[];
  titulo: string;
  destacar?: string;
}) {
  const { area, dica, ligar } = useDica();
  const maior = Math.max(...colunas.map((c) => c.total), 1);

  return (
    <figure className="gr">
      <figcaption className="gr__titulo">{titulo}</figcaption>

      <div className="gr__legenda">
        <span className="gr__chave"><i style={{ background: TONS.sucesso }} /> Pago</span>
        <span className="gr__chave"><i style={{ background: TONS.erro }} /> Vencido</span>
        <span className="gr__chave"><i style={{ background: TONS.atencao }} /> A vencer</span>
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
  return (
    <table className="apenas-leitor-tela">
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
  );
}
