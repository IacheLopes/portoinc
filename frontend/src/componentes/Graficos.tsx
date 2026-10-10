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
import { dinheiroCurto, porcento, dinheiro } from '../servicos/texto';
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

/**
 * Quanto o número grande precisa encolher para caber: 0, 1 ou 2.
 *
 * O MESMO NÚMERO NÃO CABE EM TODA EMPRESA. "R$ 640,30" tem 9
 * caracteres; "R$ 19.705.971,70" tem 16, e no cartão de indicador
 * ele quebrava em duas linhas — com o sinal de menos sozinho na
 * primeira, que é o jeito mais feio possível de mostrar um saldo
 * negativo. Visto em 08/10/2026, depois de um lançamento de
 * R$ 20 milhões.
 *
 * A conta já existia no miolo da rosca, escrita à mão lá dentro.
 * Agora é uma só, e cada lugar traduz o degrau na unidade dele —
 * token de tipografia no cartão, número de viewBox no SVG.
 *
 * OS CORTES FORAM MEDIDOS, nao chutados. Em pt-BR:
 *
 *     R$ 640,30             9
 *     R$ 96.500,00         12
 *     R$ 305.000,00        13   <- ainda cabe inteiro
 *     R$ 1.234.567,89      15   <- um degrau
 *     R$ 19.705.971,70     16   <- dois
 *     -R$ 19.705.971,70    17
 *
 * O sinal conta, porque ocupa lugar: e exatamente o caractere que
 * sobrava e era empurrado para a linha de cima.
 */
export function degrauDoNumero(texto: string): 0 | 1 | 2 {
  if (texto.length > 15) return 2;
  if (texto.length > 13) return 1;
  return 0;
}

/**
 * O degrau de uma FILEIRA de cartões, e não de um valor só.
 *
 * Cada cartão calculando o seu deixava "R$ 305.000,00" grande ao
 * lado de "-R$ 19.705.971,70" pequeno, na mesma fileira. Tamanho
 * diferente entre iguais diz "este importa mais" — e não é verdade:
 * um só tem menos dígitos.
 *
 * Quem manda é o mais comprido da fileira. Todos descem com ele.
 */
export function degrauDaFileira(...valores: string[]): 0 | 1 | 2 {
  return valores.reduce<0 | 1 | 2>(
    (maior, v) => (degrauDoNumero(v) > maior ? degrauDoNumero(v) : maior),
    0,
  );
}

/**
 * O percentual escrito, em português.
 *
 * DUAS COISAS, e as duas vieram de olhar a tela:
 *
 *  1. Fatia que existe nunca vira "0%". `Math.round` transforma
 *     0,016% em 0, e uma fatia de R$ 3.240,50 marcada "0%" diz que
 *     ela não existe — e ela existe; é só pequena ao lado de uma
 *     gigante.
 *
 *  2. O separador decimal é VÍRGULA. Juntar número com texto em
 *     JavaScript usa o ponto: a rosca de fornecedores mostrava
 *     "37.8%" numa tela que escreve "R$ 3.000,00" três dedos ao
 *     lado. Dois separadores na mesma linha, e o errado é o que
 *     ninguém questiona — parece só um número.
 */
export function percentualEscrito(percentual: number, valor: number): string {
  if (percentual === 0 && valor > 0) return '<1%';

  // `porcento` e a casa oficial do percentual em pt-BR, desde o
  // Design 4. Eu escrevi a conta de novo aqui e o `padrao.mjs`
  // pegou — a mesma duplicacao que ja tinha acontecido com a funcao
  // de dinheiro, no backend, no mesmo dia.
  return porcento(percentual);
}

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
  degrau,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  /** O que o número significa. Abre dentro do cartão, no "?". */
  explicacao: string;
  destaque?: Tom;
  /**
   * O degrau de encolhimento da FILEIRA inteira.
   *
   * Sem ele, cada cartão encolhe sozinho e a fileira fica com
   * tamanhos diferentes — que o olho lê como hierarquia. Quem tem
   * vizinhos passa o degrau da fileira; quem está sozinho não
   * precisa.
   */
  degrau?: 0 | 1 | 2;
}) {
  const [aberta, setAberta] = useState(false);
  const idExplicacao = useId();

  const TAMANHO = ['var(--txt-2xl)', 'var(--txt-xl)', 'var(--txt-lg)'];

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

      <span
        className="indicador-grafico__valor"
        style={{ fontSize: TAMANHO[degrau ?? degrauDoNumero(valor)] }}
      >
        {valor}
      </span>
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
  /** A soma das tres acima. E a altura da barra de SAIDA. */
  total: number;
  /**
   * Receita que caiu no mes, e a prevista que ainda nao caiu.
   *
   * Opcionais porque nem todo chamador manda: so o financeiro soma
   * os lancamentos a mao. Sem elas, o grafico desenha so a saida,
   * como sempre desenhou.
   */
  entrada?: number;
  aReceber?: number;
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

/** "+" ou "−" na frente do saldo do mês. Zero não leva sinal. */
function sinal(valor: number): string {
  if (valor > 0) return '+';
  if (valor < 0) return '−';
  return '';
}

/** A cor do saldo do mês. O sinal acima já diz o mesmo sem cor. */
function sinalDoSaldo(valor: number): string | undefined {
  if (valor > 0) return 'fluxo__saldo fluxo__saldo--sobrou';
  if (valor < 0) return 'fluxo__saldo fluxo__saldo--faltou';
  return undefined;
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

  // A ESCALA PRECISA VER OS DOIS LADOS.
  //
  // Enquanto so havia saida, o maior total mandava. Com a entrada
  // do lado, uma medicao de R$ 185.000 contra um mes de R$ 3.000 de
  // parcela sairia pelo teto do cartao — a barra calculada em 6000%
  // da altura.
  const maior = Math.max(
    ...colunas.map((c) => Math.max(c.total, (c.entrada ?? 0) + (c.aReceber ?? 0))),
    1,
  );

  // So desenha a coluna da entrada quando ha entrada em algum mes.
  // Numa instalacao que ainda nao lancou receita nenhuma, uma
  // coluna vazia ao lado de cada barra seria so ruido.
  const temEntrada = colunas.some((c) => (c.entrada ?? 0) + (c.aReceber ?? 0) > 0);

  return (
    <figure className="gr">
      <figcaption className="gr__titulo">{titulo}</figcaption>

      {/* Legenda e período dividem a MESMA fileira: são os dois
          controles do gráfico, e empilhados viravam duas tiras de
          coisas pequenas entre o título e as barras. No celular a
          fileira quebra sozinha. */}
      <div className="gr__controles">
        {/* A legenda separa ENTRA de SAI.

            QUEM CONTA A DIRECAO E A POSICAO, NAO A COR.

            As tres cores deste grafico ja estao gastas com o ESTADO
            do dinheiro que sai: pago, vencido, a vencer. Pintar a
            entrada de verde faria o verde significar duas coisas
            opostas no mesmo desenho — dinheiro que saiu e dinheiro
            que entrou.

            Entao a entrada fica na barra da ESQUERDA de cada par, com
            a cor que sobrou (azul), e a legenda nomeia os dois grupos.
            As cores da saida continuam exatamente como foram
            aprovadas, e a rosca ao lado nao precisa mudar nada.

            Cinco chaves em fila viravam uma sopa; agrupadas, a
            primeira palavra ja diz o lado. */}
        <div className="gr__legenda">
          {temEntrada && (
            <>
              <span className="gr__chave gr__chave--grupo">Entra:</span>
              <span className="gr__chave"><i style={{ background: TONS.info }} /> Recebido</span>
              <span className="gr__chave"><i className="gr__promessa" /> A receber</span>
              <span className="gr__chave gr__chave--grupo">Sai:</span>
            </>
          )}
          <span className="gr__chave"><i style={{ background: TONS.sucesso }} /> Pago</span>
          <span className="gr__chave"><i style={{ background: TONS.erro }} /> Vencido</span>
          <span className="gr__chave"><i style={{ background: TONS.atencao }} /> A vencer</span>
        </div>

        {periodo && (
        <div className="fluxo__periodo">
          {/* UM mês por toque.

              Começou com seis, e seis é o tamanho de um salto, não de
              um passo: quem clica a seta quer o mês vizinho. Para ir
              longe existe o seletor ao lado, que salta direto. */}
          <button
            type="button"
            className="botao botao--secundario fluxo__passo"
            aria-label="Mês anterior"
            onClick={() => periodo.aoMudar(andarMeses(periodo.referencia, -1))}
          >
            <Icone nome="anterior" />
          </button>

          {/* `type="month"` é nativo: no iPhone abre a rodinha do iOS e
              no computador o calendário do navegador. Um seletor próprio
              seria mais código e pior em ambos. */}
          <label className="fluxo__periodo-campo">
            <span className="apenas-leitor-tela">Mês no centro do gráfico</span>
            {/* `max`: o calendário do próprio sistema operacional já
                fecha os meses futuros, então a regra não depende de
                o usuário obedecer a seta desligada. */}
            <input
              type="month"
              className="campo__entrada"
              max={periodo.hoje}
              value={periodo.referencia}
              onChange={(e) => e.target.value && periodo.aoMudar(e.target.value)}
            />
          </label>

          {/* Para na frente do mês atual.

              O mês que vem ainda não aconteceu: avançar para ele só
              mostraria colunas vazias e daria a impressão de que o
              sistema perdeu dado. Só há para onde avançar depois de
              ter voltado — e o limite é sempre hoje.

              `AAAA-MM` compara como texto na ordem certa, então o
              teste é uma comparação simples. */}
          <button
            type="button"
            className="botao botao--secundario fluxo__passo"
            aria-label="Próximo mês"
            disabled={periodo.referencia >= periodo.hoje}
            onClick={() => periodo.aoMudar(andarMeses(periodo.referencia, 1))}
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
            const entrada = c.entrada ?? 0;
            const aReceber = c.aReceber ?? 0;
            const entra = entrada + aReceber;
            const vazio = c.total <= 0 && entra <= 0;
            const eHoje = c.rotulo === destacar;

            const conteudo: ConteudoDaDica = {
              titulo: c.rotulo + (eHoje ? ' · mês atual' : ''),
              linhas: vazio
                ? [{ rotulo: 'Sem movimento', valor: '—' }]
                : [
                    ...(entrada > 0
                      ? [{ rotulo: 'Recebido', valor: dinheiro(entrada), tom: 'info' as Tom }]
                      : []),
                    ...(aReceber > 0
                      ? [{ rotulo: 'A receber', valor: dinheiro(aReceber), tom: 'info' as Tom }]
                      : []),
                    ...(c.pago > 0
                      ? [{ rotulo: 'Pago', valor: dinheiro(c.pago), tom: 'sucesso' as Tom }]
                      : []),
                    ...(c.vencido > 0
                      ? [{ rotulo: 'Vencido', valor: dinheiro(c.vencido), tom: 'erro' as Tom }]
                      : []),
                    ...(c.aVencer > 0
                      ? [{ rotulo: 'A vencer', valor: dinheiro(c.aVencer), tom: 'atencao' as Tom }]
                      : []),
                    // "Sai no mês", e não "Total do mês": com as duas
                    // direções na mesma dica, "total" nao diz de qual.
                    {
                      rotulo: temEntrada ? 'Sai no mês' : 'Total do mês',
                      valor: dinheiro(c.total),
                    },
                  ],
            };

            return (
              <li key={c.rotulo} className={'fluxo__mes' + (eHoje ? ' fluxo__mes--hoje' : '')}>
                <button
                  type="button"
                  className="fluxo__alvo"
                  aria-label={
                    c.rotulo + ': ' +
                    (vazio
                      ? 'sem movimento'
                      : temEntrada
                        ? 'entra ' + dinheiro(entra) + ', sai ' + dinheiro(c.total)
                        : 'total ' + dinheiro(c.total))
                  }
                  {...ligar(conteudo)}
                >
                  <span
                    className={'fluxo__barras' + (temEntrada ? ' fluxo__barras--par' : '')}
                    style={{ ['--atraso' as string]: i * 45 + 'ms' }}
                  >
                    {/* ENTRA: a barra da esquerda.

                        A prevista fica em cima da recebida, listrada:
                        promessa e dinheiro nao tem a mesma altura de
                        certeza, e a textura diz isso sem depender da
                        cor. */}
                    {temEntrada && (
                      <span className="fluxo__pilha">
                        {aReceber > 0 && (
                          <span
                            className="fluxo__pedaco fluxo__pedaco--promessa"
                            style={{ height: (aReceber / maior) * 100 + '%' }}
                          />
                        )}
                        {entrada > 0 && (
                          <span
                            className="fluxo__pedaco"
                            style={{
                              height: (entrada / maior) * 100 + '%',
                              background: TONS.info,
                            }}
                          />
                        )}
                      </span>
                    )}

                    {/* SAI: a pilha de sempre, com as cores de sempre. */}
                    <span className="fluxo__pilha">
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
                  </span>

                  {/* O número embaixo é o SALDO do mês, não a saída.

                      Enquanto só havia saída, o total dela era o
                      número óbvio. Com a entrada ao lado, o mesmo
                      número passou a mentir: embaixo de uma barra azul
                      de R$ 305 mil aparecia "R$ 9,4k", que era só o
                      que saiu.

                      As duas barras já mostram os dois lados; o
                      número diz o resultado. */}
                  <span className="fluxo__rotulo">
                    {c.rotulo}
                    <small className={temEntrada && !vazio ? sinalDoSaldo(entra - c.total) : undefined}>
                      {vazio
                        ? '—'
                        : temEntrada
                          ? sinal(entra - c.total) + dinheiroCurto(Math.abs(entra - c.total))
                          : dinheiroCurto(c.total)}
                    </small>
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
        colunas={
          temEntrada
            ? ['Mês', 'Recebido', 'A receber', 'Pago', 'Vencido', 'A vencer']
            : ['Mês', 'Pago', 'Vencido', 'A vencer']
        }
        linhas={colunas.map((c) =>
          temEntrada
            ? [
                c.rotulo,
                dinheiro(c.entrada ?? 0),
                dinheiro(c.aReceber ?? 0),
                dinheiro(c.pago),
                dinheiro(c.vencido),
                dinheiro(c.aVencer),
              ]
            : [c.rotulo, dinheiro(c.pago), dinheiro(c.vencido), dinheiro(c.aVencer)],
        )}
      />
    </figure>
  );
}

// ------------------------------------------------------------
//  O que vem pela frente
//
//  O cartão "Se tudo acontecer" dá o total e NÃO diz quando. Com
//  R$ 96 mil a receber e R$ 5 mil a pagar o saldo final é bom — e
//  ainda assim pode faltar dinheiro no dia 17, se o que entra só
//  entra no dia 26.
//
//  É a pergunta de caixa de verdade, e ela é sobre ORDEM.
//
//  COMPONENTE PRÓPRIO, E NÃO O `GraficoFluxo` COM OUTROS RÓTULOS.
//  Aquele fala de meses e de três estados de saída (pago, vencido,
//  a vencer); este fala de semanas e de duas direções. Forçar um a
//  ser o outro encheria os dois de condicionais, e a primeira
//  mudança num quebraria o outro.
//
//  O que os dois DIVIDEM é o CSS: as mesmas classes `.fluxo*`, as
//  mesmas barras pareadas, a mesma dica. O desenho é o mesmo; o
//  assunto é que não é.
// ------------------------------------------------------------

export interface SemanaDoCalendario {
  chave: string;
  rotulo: string;
  entra: number;
  sai: number;
  saldoProjetado: number;
}

export function GraficoCalendario({
  semanas,
  titulo,
  descricao,
}: {
  semanas: SemanaDoCalendario[];
  titulo: string;
  descricao?: string;
}) {
  const { area, dica, ligar } = useDica();

  // A ESCALA É DO MOVIMENTO, NÃO DO SALDO.
  //
  // O saldo pode ser cem vezes maior que o que entra e sai numa
  // semana. Medindo as barras por ele, toda semana viraria um fio
  // rente ao chão. As barras mostram o movimento; o saldo vem
  // escrito embaixo, que é onde ele se lê melhor de qualquer jeito.
  const maior = Math.max(...semanas.map((s) => Math.max(s.entra, s.sai)), 1);

  // JA ESTA no vermelho, ou VAI FICAR? Sao avisos diferentes.
  //
  // "O saldo fica negativo antes do fim do periodo" e uma previsao.
  // Dita para quem ja esta devendo hoje, ela soa como se houvesse
  // tempo de reagir — e nao ha: o buraco e agora.
  const jaNegativo = semanas.length > 0 && semanas[0].saldoProjetado < 0;
  const furou = semanas.some((s) => s.saldoProjetado < 0);

  return (
    <figure className="gr">
      <figcaption className="gr__titulo">{titulo}</figcaption>

      <div className="gr__controles">
        <div className="gr__legenda">
          <span className="gr__chave"><i style={{ background: TONS.info }} /> Entra</span>
          <span className="gr__chave"><i style={{ background: TONS.atencao }} /> Sai</span>
          {descricao && <span className="gr__chave gr__chave--nota">{descricao}</span>}
        </div>
      </div>

      {/* O aviso vem ANTES do desenho.

          Quem abre a tela e vai embora em cinco segundos precisa
          sair sabendo disto. Esperar que a pessoa leia o número
          vermelho embaixo da terceira barra é apostar na atenção
          dela. */}
      {furou && (
        <p className="aviso aviso--atencao" role="status">
          <Icone nome="alerta" className="aviso__icone" />
          <span>
            {jaNegativo ? (
              <>
                <strong>O caixa já está negativo.</strong> Saiu mais do que entrou, e o que
                está previsto não cobre a diferença dentro deste período.
              </>
            ) : (
              <>
                <strong>O caixa não fecha em alguma semana.</strong> Se tudo acontecer na
                data prevista, o saldo fica negativo antes do fim do período.
              </>
            )}
          </span>
        </p>
      )}

      <div className="fluxo" ref={area}>
        <div className="fluxo__guias" aria-hidden="true">
          <span /><span /><span /><span />
        </div>

        <ol className="fluxo__colunas">
          {semanas.map((s, i) => {
            const parado = s.entra <= 0 && s.sai <= 0;

            const conteudo: ConteudoDaDica = {
              titulo: s.rotulo,
              linhas: [
                ...(s.entra > 0
                  ? [{ rotulo: 'Entra', valor: dinheiro(s.entra), tom: 'info' as Tom }]
                  : []),
                ...(s.sai > 0
                  ? [{ rotulo: 'Sai', valor: dinheiro(s.sai), tom: 'atencao' as Tom }]
                  : []),
                ...(parado ? [{ rotulo: 'Nada previsto', valor: '—' }] : []),
                {
                  rotulo: 'Saldo no fim da semana',
                  valor: dinheiro(s.saldoProjetado),
                  tom: (s.saldoProjetado < 0 ? 'erro' : 'sucesso') as Tom,
                },
              ],
            };

            return (
              <li key={s.chave} className="fluxo__mes">
                <button
                  type="button"
                  className="fluxo__alvo"
                  aria-label={
                    s.rotulo + ': ' +
                    (parado ? 'nada previsto' : 'entra ' + dinheiro(s.entra) + ', sai ' + dinheiro(s.sai)) +
                    '. Saldo no fim da semana: ' + dinheiro(s.saldoProjetado)
                  }
                  {...ligar(conteudo)}
                >
                  <span
                    className="fluxo__barras fluxo__barras--par"
                    style={{ ['--atraso' as string]: i * 45 + 'ms' }}
                  >
                    <span className="fluxo__pilha">
                      {s.entra > 0 && (
                        <span
                          className="fluxo__pedaco"
                          style={{ height: (s.entra / maior) * 100 + '%', background: TONS.info }}
                        />
                      )}
                    </span>
                    <span className="fluxo__pilha">
                      {s.sai > 0 && (
                        <span
                          className="fluxo__pedaco"
                          style={{ height: (s.sai / maior) * 100 + '%', background: TONS.atencao }}
                        />
                      )}
                    </span>
                  </span>

                  <span className="fluxo__rotulo">
                    {s.rotulo}
                    <small
                      className={
                        'fluxo__saldo fluxo__saldo--' +
                        (s.saldoProjetado < 0 ? 'faltou' : 'sobrou')
                      }
                    >
                      {dinheiroCurto(s.saldoProjetado)}
                    </small>
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
        colunas={['Semana', 'Entra', 'Sai', 'Saldo no fim']}
        linhas={semanas.map((s) => [
          s.rotulo,
          dinheiro(s.entra),
          dinheiro(s.sai),
          dinheiro(s.saldoProjetado),
        ])}
      />
    </figure>
  );
}

// ------------------------------------------------------------
//  Rosca (composição da carteira)
// ------------------------------------------------------------

/**
 * Seis cores que NÃO significam nada.
 *
 * Os `TONS` significam: vermelho é problema, verde é certo. Servem
 * para ESTADO. Numa rosca que divide o gasto por categoria —
 * Frota, Canteiro, Taxas — não há estado nenhum: pintar "Frota"
 * de vermelho diria que há algo errado com a frota, e não há.
 *
 * Estas existem só para distinguir uma fatia da outra. Ficam em
 * `tokens.css`, com as duas versões de tema.
 */
export const CORES_DE_CATEGORIA = [
  'var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)',
  'var(--cat-4)', 'var(--cat-5)', 'var(--cat-6)',
];

export interface FatiaDoGrafico {
  rotulo: string;
  valor: number;
  percentual: number;
  tom: Tom;
  /**
   * Cor crua, quando a fatia não tem estado.
   *
   * Vence o `tom`. A composição da carteira continua usando o tom,
   * porque ali vermelho É vencida; a rosca de categorias usa esta.
   */
  cor?: string;
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
  //
  // A regra dos degraus é a MESMA do cartão de indicador; aqui ela
  // só é traduzida para a unidade do viewBox do SVG.
  const tamanhoDoValor = [11, 9, 7.5][degrauDoNumero(centroValor)];

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
        { rotulo: 'Participação', valor: percentualEscrito(f.percentual, f.valor) },
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
              stroke={f.cor ?? TONS[f.tom]}
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
                <i style={{ background: f.cor ?? TONS[f.tom] }} aria-hidden="true" />
                <span>{f.rotulo}</span>
                <strong>{dinheiro(f.valor)}</strong>
                <small>{percentualEscrito(f.percentual, f.valor)}</small>
              </button>
            </li>
          ))}
        </ul>

        <CamadaDaDica dica={dica} />
      </div>

      <TabelaEquivalente
        titulo={titulo}
        colunas={[rotuloFatia, 'Valor', 'Participação']}
        linhas={fatias.map((f) => [
          f.rotulo, dinheiro(f.valor), percentualEscrito(f.percentual, f.valor),
        ])}
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

/**
 * Quantas barras o gráfico mostra.
 *
 * O NÚMERO EXISTE PARA OS BLOCOS PAREAREM.
 *
 * Os cartões de meia fileira ficam dois a dois, e a altura de cada
 * um é escrava de quantas linhas ele tem — que ninguém escolhe, é
 * quantos itens o banco devolveu. Medido em 05/10/2026: cada barra
 * ocupa ~64px, cada linha da legenda da rosca ~44px.
 *
 * Dava isto, com a rosca de um lado e o ranking do outro:
 *
 *   Consumo          3 famílias (278px)  x  6 itens (457px)
 *   Financeiro       4 credores (363px)  x  2 obras (236px)
 *
 * Cento e setenta e nove pixels de degrau entre dois blocos que
 * deviam ser um par. Palavras do dono: "ou os blocos estão
 * pequenos em relação aos outros, ou grandes e com espaço em
 * branco que torna feio".
 *
 * Quatro foi escolhido medindo: a rosca mostra no máximo 4 fatias
 * mais "Outros", e 4 barras dão 330px contra os 323px dela. Os
 * dois blocos passam a nascer do mesmo tamanho.
 *
 * ESTICAR OS CARTÕES NÃO SERVE: era o que havia antes, e produzia
 * justamente a caixa com vazio dentro. Ver a seção 42.6 do manual.
 *
 * O teto mora AQUI, e não em cada tela, porque padronizar escrito
 * em cinco lugares dura até alguém escrever o sexto.
 */
const BARRAS_NO_GRAFICO = 4;

export function GraficoRanking({
  linhas,
  titulo,
  vazio,
  unico,
  rotuloValor = 'Total',
  formatar = dinheiro,
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
  /**
   * Como escrever o valor. Por padrão, dinheiro.
   *
   * O ranking nasceu medindo reais, e por isso formatava reais à
   * mão. Quando ele passou a medir pontualidade de fornecedor — um
   * percentual — "R$ 94,00" era o tipo de erro que ninguém
   * questiona, porque parece um número certo.
   */
  formatar?: (valor: number) => string;
  /** Como se chama o que está sendo somado. */
  rotuloValor?: string;
}) {
  const { area, dica, ligar } = useDica();

  // A régua da barra é o MAIOR DA LISTA INTEIRA, e não o maior dos
  // quatro que aparecem: cortar e depois reescalar faria a quarta
  // barra crescer só por ter sumido a primeira.
  const maior = Math.max(...linhas.map((l) => l.total), 1);

  const mostradas = linhas.slice(0, BARRAS_NO_GRAFICO);
  const escondidas = linhas.length - mostradas.length;

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
          {mostradas.map((l, i) => (
            <li key={l.nome}>
              <button
                type="button"
                className="ranking__alvo"
                style={{ ['--atraso' as string]: i * 70 + 'ms' }}
                aria-label={l.nome + ': ' + rotuloValor.toLowerCase() + ' ' + formatar(l.total)}
                {...ligar({
                  titulo: l.nome,
                  linhas: unico
                    ? [{ rotulo: rotuloValor, valor: formatar(l.total) }]
                    : [
                        { rotulo: 'Em aberto', valor: formatar(l.aberto), tom: 'atencao' },
                        { rotulo: 'Já pago', valor: formatar(l.pago), tom: 'sucesso' },
                        { rotulo: 'Total', valor: formatar(l.total) },
                      ],
                  rodape: porcento(Math.round((l.total / maior) * 100)) + ' do maior da lista',
                })}
              >
                <span className="ranking__nome">{l.nome}</span>
                <span className="ranking__valor">{formatar(l.total)}</span>

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

        {/* O que ficou de fora.

            Sem esta linha o gráfico cortaria em silêncio — e
            silêncio sobre o que não está na tela é o defeito que
            este sistema passou um mês caçando.

            "Os 4 maiores de 6", e não "e mais 2 na lista completa":
            a segunda promete uma lista que nem toda tela tem. Nos
            Relatórios a tabela vem logo abaixo; no Financeiro, não.
            Esta frase é verdadeira nas duas, e usa a fórmula que as
            listas paginadas já usam — "mostrando x de y". */}
        {escondidas > 0 && (
          <p className="ranking__resto">
            Os {mostradas.length} maiores de {linhas.length}
          </p>
        )}

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
          aria-label={titulo + ': ' + porcento(percentual)}
          {...ligar({
            titulo,
            linhas: [
              { rotulo: 'No prazo', valor: porcento(percentual), tom },
              { rotulo: 'Em atraso', valor: porcento(100 - percentual) },
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
