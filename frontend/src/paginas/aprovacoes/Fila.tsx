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
import { dinheiro } from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { Cartao } from '../../componentes/Cartao';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';

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
  if (dias < 0) return <Selo tipo="erro">Atrasada há {Math.abs(dias)} dia(s)</Selo>;
  if (dias === 0) return <Selo tipo="erro">É para hoje</Selo>;
  if (dias <= 7) return <Selo tipo="atencao">Faltam {dias} dia(s)</Selo>;

  return <span>{dataBr(data)}</span>;
}

export function FilaAprovacao() {
  const [fila, setFila] = useState<ItemDaFila[]>([]);
  const [minhasFuncoes, setMinhasFuncoes] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await listarFilaAprovacao();
      setFila(r.fila);
      setMinhasFuncoes(r.minhasFuncoes);
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
            <>
              O que depende da <strong>sua</strong> assinatura agora. Você está aprovando
            como{' '}
            <strong>
              {minhasFuncoes.map(nomeDaFuncao).join(' e ')}
            </strong>
            .
            </>
          }
        />

        <div className="grade">
          <Cartao
            titulo="Esperando você"
            valor={String(fila.length)}
            detalhe={fila.length === 1 ? 'solicitação' : 'solicitações'}
          />
          <Cartao
            titulo="Valor acumulado"
            valor={dinheiro(valorTotal)}
            detalhe="Soma do que está na sua fila"
          />
          <Cartao
            titulo="Prazo apertado"
            valor={String(urgentes)}
            detalhe="Vencem em até 7 dias"
          />
        </div>
      </section>

      <section className="secao">
        {fila.length === 0 ? (
          <Vazio
            titulo="Nada esperando por você"
            descricao="Quando alguém enviar uma solicitação que precise da sua assinatura, ela aparece aqui."
          />
        ) : (
          <div className="cartao cartao--tabela">
            <div className="tabela-area">
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
                        <Link
                          className="botao botao--principal botao--link-cheio"
                          to={'/solicitacoes/' + s.id}
                        >
                          Analisar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
