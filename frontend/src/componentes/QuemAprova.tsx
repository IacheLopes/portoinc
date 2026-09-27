// ============================================================
//  Quem aprova
//
//  O terceiro cartão da fileira do topo, ao lado de "Total
//  estimado" e "Precisa até". Responde a duas perguntas de uma vez:
//  quem assina esta compra, e o que já foi assinado.
//
//  --- A anatomia é a do indicador, de propósito ---
//
//  rótulo pequeno / um fato grande / rodapé miúdo. É a mesma dos
//  dois cartões ao lado, e é o que faz os três lerem como uma
//  fileira em vez de três coisas diferentes empurradas juntas.
//
//  O "fato grande" aqui é a REGRA — "Todas precisam assinar" —, que
//  ocupa o lugar do R$ 6.880,00 do vizinho. É o que a pessoa precisa
//  saber antes de olhar os nomes: se espera uma pessoa ou duas.
//
//  --- O que já foi tentado, para não voltar ---
//
//  1º: era um <Indicador> com uma frase pronta do servidor dentro.
//      A altura de linha do indicador é a de um número de 2rem, e
//      cada linha da frase reservava 49,6px para 24,8px de texto.
//      O dono fotografou: parecia três parágrafos soltos.
//
//  2º: virou uma barra larga, sozinha, embaixo da fileira. Consertou
//      o espaçamento e estragou a página — o dono disse, com razão,
//      que ficou pior: uma faixa branca atravessando a tela para
//      dizer duas linhas de coisa.
//
//  Agora está no lugar certo, com a forma dos vizinhos.
// ============================================================

import { nomeDaFuncao, type ResumoDaAlcada, type Solicitacao } from '../servicos/solicitacoes';
import { Icone } from './Icone';

/** O que aconteceu com uma função. */
type Estado = 'assinou' | 'reprovou' | 'devolveu' | 'aguardando';

const ROTULO: Record<Estado, string> = {
  assinou: 'assinou',
  reprovou: 'reprovou',
  devolveu: 'devolveu',
  aguardando: 'aguardando',
};

interface Linha {
  codigo: string;
  nome: string;
  estado: Estado;
  /** Quem assinou, quando já assinou. */
  quem: string | null;
}

interface Props {
  /** A alçada calculada pelo servidor para o valor de agora. */
  alcada: ResumoDaAlcada | null;
  solicitacao: Solicitacao;
}

export function QuemAprova({ alcada, solicitacao }: Props) {
  // Depois do envio vale a FOTOGRAFIA guardada na solicitação, e não
  // a alçada de hoje: se a empresa mexer nas faixas amanhã, o que já
  // está em aprovação continua com a regra de hoje. Antes do envio
  // essa fotografia ainda não existe, e aí vale a alçada de agora.
  const enviada = solicitacao.funcoesExigidas.length > 0;

  const codigos = enviada
    ? solicitacao.funcoesExigidas
    : alcada?.funcoes.map((f) => f.codigo) ?? [];

  const exigeTodas = enviada ? solicitacao.exigeTodas : (alcada?.exigeTodas ?? false);

  // Nome pelo cadastro quando ele veio; senão, pelo código.
  const nomePorCodigo = new Map(alcada?.funcoes.map((f) => [f.codigo, f.nome]) ?? []);

  const linhas: Linha[] = codigos.map((codigo) => {
    const decisao = solicitacao.aprovacoes.find((a) => a.funcaoCodigo === codigo);

    const estado: Estado = !decisao
      ? 'aguardando'
      : decisao.decisao === 'APROVADA'
        ? 'assinou'
        : decisao.decisao === 'REPROVADA'
          ? 'reprovou'
          : 'devolveu';

    return {
      codigo,
      nome: nomePorCodigo.get(codigo) ?? nomeDaFuncao(codigo),
      estado,
      quem: decisao ? decisao.usuario : null,
    };
  });

  // Nenhuma faixa cobre o valor: não há lista, e o problema é de
  // configuração — não desta compra.
  if (linhas.length === 0) {
    return (
      <article className="quem-aprova quem-aprova--sem-faixa">
        <h3 className="quem-aprova__titulo">Quem aprova</h3>
        <p className="quem-aprova__alerta">
          <Icone nome="alerta" />
          <span>{alcada?.explicacao ?? 'Não foi possível calcular.'}</span>
        </p>
      </article>
    );
  }

  // Com uma função só, "todas" e "basta uma" dizem a mesma coisa.
  const regra =
    linhas.length === 1
      ? 'Uma assinatura'
      : exigeTodas
        ? 'Todas precisam assinar'
        : 'Basta uma assinatura';

  return (
    <article className="quem-aprova">
      <h3 className="quem-aprova__titulo">Quem aprova</h3>
      <p className="quem-aprova__regra">{regra}</p>

      <ul className="quem-aprova__lista">
        {linhas.map((l) => (
          <li key={l.codigo} className={'quem-aprova__linha quem-aprova__linha--' + l.estado}>
            {/* A marca NUNCA informa sozinha: a palavra à direita diz
                o mesmo, para quem não distingue as cores e para quem
                ouve a tela.

                "Aguardando" vem vazio de propósito: o CSS desenha um
                anel oco ali. Não havia ícone de espera no conjunto, e
                pôr um "○" de teclado no meio de SVGs deixa uma marca
                de tamanho e peso diferentes das outras. */}
            <span className="quem-aprova__marca" aria-hidden="true">
              {l.estado === 'assinou' && <Icone nome="certo" />}
              {l.estado === 'reprovou' && <Icone nome="errado" />}
              {l.estado === 'devolveu' && <Icone nome="voltar" />}
            </span>

            <span className="quem-aprova__funcao">{l.nome}</span>

            <span className="quem-aprova__estado">
              {ROTULO[l.estado]}
              {l.quem && <small className="quem-aprova__quem">{l.quem}</small>}
            </span>
          </li>
        ))}
      </ul>

      {alcada?.faixa && (
        <p className="quem-aprova__criterio">Faixa &ldquo;{alcada.faixa}&rdquo;</p>
      )}
    </article>
  );
}
