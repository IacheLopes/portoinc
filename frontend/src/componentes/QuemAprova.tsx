// ============================================================
//  Quem aprova
//
//  A lista de funções que precisam assinar esta compra, com o
//  estado de cada uma.
//
//  Era um <Indicador> — o componente de NÚMERO — carregando uma
//  frase pronta do servidor. Três defeitos vinham daí, e o dono
//  fotografou os três em 27/09/2026:
//
//   1. O buraco entre as linhas. O indicador reserva altura para
//      número grande: 2rem × 1,55 = 49,6px por linha. A frase usa
//      1rem × 1,55 = 24,8px. Sobrava o dobro em cada linha, e a
//      frase parecia três parágrafos soltos. Encolher a letra do
//      <span> não resolve: quem manda na altura da linha é o bloco
//      de fora, não o texto de dentro.
//
//   2. A letra apertada. O indicador aperta -0,02em, que é certo
//      para "R$ 6.880,00" e errado para frase.
//
//   3. A caixa não aprendia nada. Depois que o gestor assinasse,
//      ela continuaria dizendo exatamente a mesma coisa; para saber
//      em que pé estava, era preciso rolar até a tabela de
//      Assinaturas, lá embaixo.
//
//  Agora é lista. Cada função é uma linha com o seu estado, e a
//  regra ("as duas assinam" ou "basta uma") virou a etiqueta do
//  canto — deixou de ser frase.
// ============================================================

import { nomeDaFuncao, dataBr, type ResumoDaAlcada, type Solicitacao } from '../servicos/solicitacoes';
import { dinheiro } from '../servicos/cadastros';
import { Selo } from './Selo';
import { Icone } from './Icone';

/** O que aconteceu com uma função. */
type Estado = 'assinou' | 'reprovou' | 'devolveu' | 'aguardando';

const ROTULO: Record<Estado, string> = {
  assinou: 'assinou',
  reprovou: 'reprovou',
  devolveu: 'devolveu para revisão',
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
  // Depois do envio vale a FOTOGRAFIA guardada na solicitação: se a
  // empresa mexer nas faixas amanhã, o que já está em aprovação
  // continua com a regra de hoje. Antes do envio, essa fotografia
  // ainda não existe, e aí vale a alçada calculada agora.
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

  // Nenhuma faixa cobre o valor: não há lista para mostrar, e o
  // problema é de configuração, não desta compra.
  if (linhas.length === 0) {
    return (
      <section className="quem-aprova quem-aprova--sem-faixa" aria-labelledby="quem-aprova-titulo">
        <h2 className="quem-aprova__titulo" id="quem-aprova-titulo">
          Quem aprova
        </h2>
        <p className="quem-aprova__vazio">
          <Icone nome="alerta" /> {alcada?.explicacao ?? 'Não foi possível calcular.'}
        </p>
      </section>
    );
  }

  return (
    <section className="quem-aprova" aria-labelledby="quem-aprova-titulo">
      <div className="quem-aprova__cabecalho">
        <h2 className="quem-aprova__titulo" id="quem-aprova-titulo">
          Quem aprova
        </h2>
        {/* `info` nos dois, e não `atencao` em um deles: precisar de
            duas assinaturas não é um problema, é a regra da faixa. O
            triângulo do `atencao` fazia a caixa parecer um alarme
            numa solicitação em que não havia nada de errado. */}
        <Selo tipo="info">
          {exigeTodas ? 'Todas precisam assinar' : 'Basta uma assinatura'}
        </Selo>
      </div>

      <ul className="quem-aprova__lista">
        {linhas.map((l) => (
          <li key={l.codigo} className={'quem-aprova__linha quem-aprova__linha--' + l.estado}>
            {/* A marca NUNCA informa sozinha: a palavra ao lado diz
                a mesma coisa, para quem não distingue as cores e
                para quem ouve a tela. */}
            <span className="quem-aprova__marca" aria-hidden="true">
              {l.estado === 'assinou' ? (
                <Icone nome="certo" />
              ) : l.estado === 'aguardando' ? (
                '○'
              ) : (
                <Icone nome="alerta" />
              )}
            </span>

            <span className="quem-aprova__funcao">{l.nome}</span>

            <span className="quem-aprova__estado">
              {ROTULO[l.estado]}
              {l.quem && <span className="quem-aprova__quem">{l.quem}</span>}
            </span>
          </li>
        ))}
      </ul>

      <p className="quem-aprova__criterio">
        Pelo valor de <strong>{dinheiro(solicitacao.totalEstimado)}</strong>
        {alcada?.faixa && <> — faixa &ldquo;{alcada.faixa}&rdquo;</>}.
        {enviada && solicitacao.enviadaEm && (
          <> Congelado no envio, em {dataBr(solicitacao.enviadaEm)}.</>
        )}
      </p>
    </section>
  );
}
