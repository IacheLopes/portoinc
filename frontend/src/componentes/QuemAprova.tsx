// ============================================================
//  Quem aprova
//
//  O terceiro cartão da fileira do topo. É um <Indicador> — o mesmo
//  componente de "Total estimado" e "Precisa até" —, e não uma
//  imitação dele. Toda a inteligência aqui é escolher as duas
//  frases que ele mostra.
//
//  --- as três versões anteriores, para não voltar a nenhuma ---
//
//  1ª: <Indicador> com a frase pronta do servidor dentro. A altura
//      de linha do indicador é a de um número de 2rem, e cada linha
//      da frase reservava 49,6px para 24,8px de texto. Parecia três
//      parágrafos soltos.
//
//  2ª: uma barra larga, sozinha, embaixo da fileira. Consertou o
//      espaçamento e estragou a página: uma faixa branca
//      atravessando 1130px para dizer duas linhas de coisa.
//
//  3ª: de volta à fileira, mas com uma LISTA de funções dentro —
//      uma linha por função, com marca e estado. Ficava 80px mais
//      alto que os vizinhos, e a grade estica todo mundo junto: os
//      dois cartões ao lado passaram a ter um vão morto embaixo do
//      número. O dono disse que tirava a elegância, e tirava mesmo.
//
//  --- por que esta cabe em três linhas ---
//
//  A lista respondia "qual é o estado de cada função". Só que a
//  pergunta de quem olha o topo da tela é outra: "quantas faltam, e
//  de quem". Isso cabe em um número e uma frase:
//
//      Quem aprova
//      1 de 2 assinaturas
//      Falta assinar: Engenheiro
//
//  Quem quiser o detalhe — quem assinou, quando, com que observação
//  — desce até a tabela de Assinaturas, que existe para isso e tem
//  espaço para isso.
//
//  O nome da faixa saiu junto. Era informação boa, mas custava a
//  quarta linha, que é exatamente o que estragava a fileira. Ela
//  continua no simulador de Cadastros > Limites de alçada.
// ============================================================

import { nomeDaFuncao, type ResumoDaAlcada, type Solicitacao } from '../servicos/solicitacoes';
import { Indicador } from './Indicador';

/** "a, b e c" — a última vem com a conjunção, como se fala. */
function juntar(nomes: string[], conjuncao: 'e' | 'ou'): string {
  if (nomes.length <= 1) return nomes[0] ?? '';

  return nomes.slice(0, -1).join(', ') + ' ' + conjuncao + ' ' + nomes[nomes.length - 1];
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

  // Nenhuma faixa cobre o valor: o problema é de configuração, não
  // desta compra, e a cor de atenção é o que diz isso de longe.
  if (codigos.length === 0) {
    return (
      <Indicador
        titulo="Quem aprova"
        largura="cheia"
        tom="atencao"
        valor="Sem faixa"
        detalhe={alcada?.explicacao ?? 'Não foi possível calcular.'}
      />
    );
  }

  const exigeTodas = enviada ? solicitacao.exigeTodas : (alcada?.exigeTodas ?? false);
  const nomePorCodigo = new Map(alcada?.funcoes.map((f) => [f.codigo, f.nome]) ?? []);
  const nomeDe = (codigo: string) => nomePorCodigo.get(codigo) ?? nomeDaFuncao(codigo);

  // Só contam as decisões das funções que ESTA solicitação exige.
  const relevantes = solicitacao.aprovacoes.filter((a) => codigos.includes(a.funcaoCodigo));
  const reprovou = relevantes.find((a) => a.decisao === 'REPROVADA');
  const devolveu = relevantes.find((a) => a.decisao === 'DEVOLVIDA');
  const assinaram = relevantes.filter((a) => a.decisao === 'APROVADA');

  if (reprovou) {
    return (
      <Indicador
        titulo="Quem aprova"
        largura="cheia"
        tom="erro"
        valor="Reprovada"
        detalhe={'Por ' + reprovou.usuario + ', ' + nomeDe(reprovou.funcaoCodigo)}
      />
    );
  }

  if (devolveu) {
    return (
      <Indicador
        titulo="Quem aprova"
        largura="cheia"
        tom="atencao"
        valor="Devolvida"
        detalhe={'Por ' + devolveu.usuario + ', ' + nomeDe(devolveu.funcaoCodigo)}
      />
    );
  }

  // Quantas assinaturas esta compra precisa ao todo. Com "basta uma",
  // é uma só — por mais funções que a faixa liste.
  const precisa = exigeTodas ? codigos.length : 1;
  const dadas = exigeTodas ? assinaram.length : Math.min(assinaram.length, 1);

  // Fechada: uma palavra, como "Reprovada" e "Devolvida". Em vez de
  // "1 de 1 assinatura", que é o que a conta daria com "basta uma".
  if (dadas >= precisa) {
    return (
      <Indicador
        titulo="Quem aprova"
        largura="cheia"
        valor="Assinada"
        detalhe={'Por ' + juntar(assinaram.map((a) => a.usuario), 'e')}
      />
    );
  }

  const plural = precisa === 1 ? 'assinatura' : 'assinaturas';
  const valor = dadas === 0 ? precisa + ' ' + plural : dadas + ' de ' + precisa + ' ' + plural;

  const faltam = codigos.filter((c) => !assinaram.some((a) => a.funcaoCodigo === c));
  const nomes = faltam.map(nomeDe);

  // Começou a assinar: o que importa é quem falta. Sem nenhuma
  // assinatura ainda, a conjunção carrega a regra inteira — "e" quer
  // dizer as duas, "ou" quer dizer qualquer uma delas.
  const detalhe =
    dadas > 0
      ? 'Falta assinar: ' + juntar(nomes, 'e')
      : juntar(nomes, exigeTodas ? 'e' : 'ou');

  return (
    <Indicador titulo="Quem aprova" largura="cheia" valor={valor} detalhe={detalhe} />
  );
}
