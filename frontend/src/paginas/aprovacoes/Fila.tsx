// ============================================================
//  Fila de aprovação
//
//  Mostra APENAS o que depende da sua assinatura agora. O que
//  você já assinou, ou o que espera outra função, não aparece.
//
//  Ordenada pela data em que o material é necessário: o que
//  aperta primeiro fica no topo.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarFilaAprovacao, nomeDaFuncao, dataBr, dataHoraBr, type ItemDaFila,
} from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Indicador } from '../../componentes/Indicador';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { plural, palavra, dinheiro } from '../../servicos/texto';

/** Quantos dias faltam até a data em que o material é necessário. */
function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(iso);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

function Prazo({ data }: { data: string | null }) {
  const dias = diasAte(data);

  if (dias === null) return <span className="texto-fraco">Sem prazo</span>;
  if (dias < 0) {
    return (
      <Selo tipo="erro">Atrasada há {plural(Math.abs(dias), 'dia', 'dias')}</Selo>
    );
  }
  if (dias === 0) return <Selo tipo="erro">É para hoje</Selo>;
  if (dias <= 7) {
    return (
      <Selo tipo="atencao">
        {palavra(dias, 'Falta', 'Faltam')} {plural(dias, 'dia', 'dias')}
      </Selo>
    );
  }

  return <span>{dataBr(data)}</span>;
}

export function FilaAprovacao() {
  const [fila, setFila] = useState<ItemDaFila[]>([]);
  const [minhasFuncoes, setMinhasFuncoes] = useState<string[]>([]);

  // Por que a fila está vazia. Ver o comentário na rota: "nada
  // esperando por você" é verdade para o gestor em dia, e engana o
  // administrador, que nunca verá nada aqui.
  const [assina, setAssina] = useState(true);
  const [esperandoOutros, setEsperandoOutros] = useState(0);
  const [papeisQueAssinam, setPapeisQueAssinam] = useState<string[]>([]);

  // Quem dá suporte vê a fila do SISTEMA, e não só a sua. Cada linha
  // precisa dizer de quem ela é, senão a tela promete uma ação que o
  // servidor vai recusar.
  const [enxergaTudo, setEnxergaTudo] = useState(false);
  const [minhasDeVerdade, setMinhasDeVerdade] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await listarFilaAprovacao();
      setFila(r.fila);
      setMinhasFuncoes(r.minhasFuncoes);
      setAssina(r.assinaAlgumaFaixa);
      setEsperandoOutros(r.esperandoOutros);
      setPapeisQueAssinam(r.papeisQueAssinam);
      setEnxergaTudo(r.enxergaTudo);
      setMinhasDeVerdade(r.minhasDeVerdade);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar a fila.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando && fila.length === 0) {
    return <Carregando mensagem="Carregando a sua fila..." />;
  }
  if (erro && fila.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  const valorTotal = fila.reduce((s, i) => s + i.totalEstimado, 0);
  const urgentes = fila.filter((i) => {
    const d = diasAte(i.dataDesejada);
    return d !== null && d <= 7;
  }).length;

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Aprovações"
          descricao={
            enxergaTudo ? (
              <>
                A fila do <strong>sistema inteiro</strong> — você enxerga tudo porque dá
                suporte. <strong>{minhasDeVerdade}</strong>{' '}
                {minhasDeVerdade === 1 ? 'depende' : 'dependem'} da sua assinatura; o resto
                está aqui só para consulta.
              </>
            ) : (
              <>
                O que depende da <strong>sua</strong> assinatura agora. Você está aprovando
                como{' '}
                <strong>{minhasFuncoes.map(nomeDaFuncao).join(' e ')}</strong>.
              </>
            )
          }
        />

        <div className="grade">
          {/* Para quem dá suporte a fila traz linhas que não são dele:
              o número tem de contar as SUAS, senão promete trabalho
              que não existe. */}
          <Indicador
            titulo="Esperando você"
            valor={String(enxergaTudo ? minhasDeVerdade : fila.length)}
            detalhe={
              enxergaTudo
                ? 'de ' + fila.length + ' na fila do sistema'
                : fila.length === 1 ? 'solicitação' : 'solicitações'
            }
          />
          <Indicador
            titulo="Valor acumulado"
            valor={dinheiro(valorTotal)}
            detalhe="Soma do que está na sua fila"
          />
          <Indicador
            titulo="Prazo apertado"
            valor={String(urgentes)}
            detalhe="Vencem em até 7 dias"
          />
        </div>
      </section>

      <section className="secao">
        {fila.length === 0 ? (
          /* A fila vazia tem TRÊS motivos diferentes, e dizer só
             "nada esperando" engana em dois deles.

             O administrador nunca verá nada aqui: ter a tela é
             permissão, assinar é estar numa faixa de alçada — e as
             faixas citam Gestor de obra, Engenheiro e Fundador. Ele
             lia "nada esperando" e entendia "o sistema está vazio",
             com três solicitações paradas na fila. */
          <Vazio
            titulo={assina ? 'Nada esperando por você' : 'Você não assina aprovações'}
            descricao={
              !assina
                ? 'Aprovar depende de estar numa faixa de valor, e as faixas de hoje são de '
                  + papeisQueAssinam.join(', ')
                  + '. A sua função dá acesso a esta tela, mas não à assinatura'
                  + (esperandoOutros > 0
                    ? ' — há ' + esperandoOutros + ' esperando essas pessoas.'
                    : '.')
                : esperandoOutros > 0
                  ? 'Nenhuma precisa da sua assinatura agora. Há ' + esperandoOutros
                    + ' na fila, esperando outras pessoas ou já assinadas por você.'
                  : 'Quando alguém enviar uma solicitação que precise da sua assinatura, ela aparece aqui.'
            }
          />
        ) : (
          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">
                  Solicitações aguardando a sua aprovação
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Número</th>
                    <th scope="col">Obra</th>
                    <th scope="col">Solicitante</th>
                    <th scope="col">Justificativa</th>
                    <th scope="col" className="numero">Valor</th>
                    <th scope="col">Precisa até</th>
                    <th scope="col">Assinaturas</th>
                    <th scope="col">
                      <span className="apenas-leitor-tela">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fila.map((s) => (
                    <tr key={s.id}>
                      <th scope="row" className="mono">
                        {s.numeroFormatado}
                        <small className="linha-extra">
                          enviada em {s.enviadaEm ? dataHoraBr(s.enviadaEm) : '—'}
                        </small>
                      </th>
                      <td>
                        {s.obra.codigo}
                        <small className="linha-extra">{s.obra.nome}</small>
                      </td>
                      <td>{s.solicitante.nome}</td>
                      <td className="celula-texto">
                        {s.justificativa ?? <span className="texto-fraco">Sem justificativa</span>}
                      </td>
                      <td className="numero">{dinheiro(s.totalEstimado)}</td>
                      <td>
                        <Prazo data={s.dataDesejada} />
                      </td>
                      <td>
                        {s.exigeTodas ? (
                          <Selo tipo="atencao">
                            {s.estado.assinaram.length} de {s.funcoesExigidas.length}
                          </Selo>
                        ) : (
                          <Selo tipo="info">Basta uma</Selo>
                        )}
                      </td>
                      <td>
                        {/* Linha que não é sua (só aparece para quem dá
                            suporte): abre para OLHAR, não para assinar.
                            O botão secundário e o texto dizem isso antes
                            do clique — prometer "Analisar" e o servidor
                            recusar depois seria pior. */}
                        <Link
                          className={
                            'botao botao--link-cheio '
                            + (s.esperaMinhaAssinatura ? 'botao--principal' : 'botao--secundario')
                          }
                          to={'/solicitacoes/' + s.id}
                          state={{ veioDe: '/aprovacoes' }}
                          title={s.motivoBloqueio ?? undefined}
                        >
                          {s.esperaMinhaAssinatura ? 'Analisar' : 'Ver'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          </Cartao>
        )}
      </section>
    </>
  );
}
