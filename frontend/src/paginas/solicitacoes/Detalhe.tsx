// ============================================================
//  Detalhe da solicitação
//
//  Mostra os itens, quem vai precisar aprovar e o histórico
//  completo do que aconteceu — a trilha que responde à pergunta
//  "quem mandou comprar isso?".
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  buscarSolicitacao, enviarSolicitacao, cancelarSolicitacao, baixarPdf,
  ROTULO_SITUACAO, COR_SITUACAO, dataBr, dataHoraBr,
  ROTULO_DECISAO,
  type Solicitacao, type SituacaoSolicitacao, type Decisao,
} from '../../servicos/solicitacoes';
import { dinheiro, quantidade as qtdBr } from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Cartao } from '../../componentes/Cartao';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro } from '../../componentes/Estado';
import { PainelDecisao } from '../../componentes/PainelDecisao';

export function DetalheSolicitacao() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const { usuario, pode } = useAutenticacao();

  const [dados, setDados] = useState<Solicitacao | null>(null);
  const [aprovacao, setAprovacao] = useState<{ explicacao: string } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [impedimentos, setImpedimentos] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await buscarSolicitacao(id);
      setDados(r.solicitacao);
      setAprovacao(r.aprovacao);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviar() {
    setErro(null);
    setImpedimentos([]);
    setAviso(null);
    setOcupado(true);

    try {
      const r = await enviarSolicitacao(id);
      setAviso('Enviada para aprovação. ' + r.aprovacao.explicacao);
      await carregar();
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setImpedimentos((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Não foi possível enviar.');
      }
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar() {
    setOcupado(true);
    try {
      await cancelarSolicitacao(id);
      navegar('/solicitacoes');
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível cancelar.');
      setOcupado(false);
    }
  }

  async function pdf() {
    if (!dados) return;
    setOcupado(true);
    try {
      await baixarPdf(id, dados.numeroFormatado);
    } catch {
      setErro('Não foi possível gerar o PDF.');
    } finally {
      setOcupado(false);
    }
  }

  if (carregando && !dados) return <Carregando mensagem="Carregando solicitação..." />;
  if (erro && !dados) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  if (!dados) return null;

  const souOAutor = dados.solicitante.id === usuario?.id;

  // Funcoes que EU tenho e que esta solicitacao exige, descontando
  // as que eu ja assinei.
  const jaAssineiCom = dados.aprovacoes
    .filter((a) => a.usuario === usuario?.nome)
    .map((a) => a.funcao);

  const minhasFuncoesUteis = (usuario?.funcoes ?? []).filter(
    (f) => dados.funcoesExigidas.includes(f),
  );

  const possoAssinar =
    dados.situacao === 'AGUARDANDO_APROVACAO' &&
    !souOAutor &&
    pode('solicitacoes.aprovar') &&
    minhasFuncoesUteis.length > jaAssineiCom.length;
  const situacao = dados.situacao as SituacaoSolicitacao;
  const ehRascunho = situacao === 'RASCUNHO' || situacao === 'EM_REVISAO';

  return (
    <>
      <section className="secao">
        <nav className="migalhas" aria-label="Você está em">
          <Link to="/solicitacoes">Solicitações</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{dados.numeroFormatado}</span>
        </nav>

        <div className="secao__cabecalho">
          <div className="em-obra__topo">
            <h1>{dados.numeroFormatado}</h1>
            <Selo tipo={COR_SITUACAO[situacao]}>{ROTULO_SITUACAO[situacao]}</Selo>
            {dados.itens.some((i) => i.primeiraCompra) && (
              <Selo tipo="atencao">Tem item nunca comprado</Selo>
            )}
          </div>
          <p className="secao__descricao">
            Aberta por <strong>{dados.solicitante.nome}</strong> em{' '}
            {dataHoraBr(dados.criadaEm)} · Obra {dados.obra.codigo} — {dados.obra.nome}
          </p>
        </div>

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <span aria-hidden="true">✓</span> {aviso}
          </p>
        )}

        {erro && (
          <div className="aviso aviso--erro" role="alert">
            <span className="aviso__icone" aria-hidden="true">
              ⚠
            </span>
            <div>
              <strong>{erro}</strong>
              {impedimentos.length > 0 && (
                <ul className="campo__erro-lista">
                  {impedimentos.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="grade">
          <Cartao
            titulo="Total estimado"
            valor={dinheiro(dados.totalEstimado)}
            detalhe={dados.itens.length + ' item(ns)'}
          />
          <Cartao
            titulo="Precisa até"
            valor={dataBr(dados.dataDesejada)}
            detalhe={dados.enviadaEm ? 'Enviada em ' + dataBr(dados.enviadaEm) : 'Ainda não enviada'}
          />
          <Cartao
            titulo="Quem aprova"
            valor={<span className="cartao__texto">{aprovacao?.explicacao ?? '—'}</span>}
            detalhe="Calculado pelo valor total e pelas faixas de alçada"
          />
        </div>

        {dados.justificativa && (
          <div className="cartao" style={{ marginTop: 'var(--esp-4)' }}>
            <h2 className="cartao__titulo">Justificativa</h2>
            <p>{dados.justificativa}</p>
          </div>
        )}

        {/* ---------------- Ações ---------------- */}
        <div className="barra-acoes" style={{ marginTop: 'var(--esp-4)' }}>
          {souOAutor && ehRascunho && (
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => void enviar()}
              disabled={ocupado}
            >
              {ocupado ? 'Enviando...' : 'Enviar para aprovação'}
            </button>
          )}

          <button
            type="button"
            className="botao botao--secundario"
            onClick={() => void pdf()}
            disabled={ocupado}
          >
            📄 Baixar PDF
          </button>

          {souOAutor && situacao !== 'CANCELADA' && situacao !== 'APROVADA' && situacao !== 'REPROVADA' && (
            <button
              type="button"
              className="botao botao--discreto"
              onClick={() => void cancelar()}
              disabled={ocupado}
            >
              Cancelar solicitação
            </button>
          )}
        </div>
      </section>

      {possoAssinar && (
        <section className="secao">
          <PainelDecisao
            solicitacaoId={id}
            estado={dados.estadoAprovacao}
            exigeTodas={dados.exigeTodas}
            funcoesExigidas={dados.funcoesExigidas}
            minhasFuncoesUteis={minhasFuncoesUteis.filter((f) => !jaAssineiCom.includes(f))}
            aoDecidir={async (mensagem) => {
              setAviso(mensagem);
              await carregar();
            }}
          />
        </section>
      )}

      {/* ---------------- Assinaturas ---------------- */}
      {dados.aprovacoes.length > 0 && (
        <section className="secao">
          <div className="secao__cabecalho">
            <h2>Assinaturas</h2>
            <p className="secao__descricao">{dados.estadoAprovacao.resumo}</p>
          </div>

          <div className="cartao cartao--tabela">
            <div className="tabela-area">
              <table className="tabela">
                <caption className="apenas-leitor-tela">Decisões registradas</caption>
                <thead>
                  <tr>
                    <th scope="col">Quem</th>
                    <th scope="col">Função</th>
                    <th scope="col">Decisão</th>
                    <th scope="col">Observação</th>
                    <th scope="col">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.aprovacoes.map((a) => (
                    <tr key={a.id}>
                      <th scope="row">{a.usuario}</th>
                      <td>{a.funcao}</td>
                      <td>
                        <Selo
                          tipo={
                            a.decisao === 'APROVADA'
                              ? 'sucesso'
                              : a.decisao === 'REPROVADA'
                                ? 'erro'
                                : 'atencao'
                          }
                        >
                          {ROTULO_DECISAO[a.decisao as Decisao]}
                        </Selo>
                      </td>
                      <td className="celula-texto">{a.observacao ?? '—'}</td>
                      <td>{dataHoraBr(a.criadaEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Itens ---------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Itens solicitados</h2>
        </div>

        <div className="cartao cartao--tabela">
          <div className="tabela-area">
            <table className="tabela">
              <caption className="apenas-leitor-tela">
                Itens da solicitação {dados.numeroFormatado}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Item</th>
                  <th scope="col">Un.</th>
                  <th scope="col" className="numero">Qtd.</th>
                  <th scope="col">Orçamento</th>
                  <th scope="col" className="numero">Total estimado</th>
                </tr>
              </thead>
              <tbody>
                {dados.itens.map((i) => (
                  <tr key={i.id}>
                    <th scope="row" className="mono">
                      {i.material.codigoInterno}
                    </th>
                    <td>
                      {i.material.descricao}
                      {i.descricaoComplementar && (
                        <small className="linha-extra">{i.descricaoComplementar}</small>
                      )}
                      {i.material.normaTecnica && (
                        <small className="linha-extra">Norma: {i.material.normaTecnica}</small>
                      )}
                      {i.primeiraCompra && (
                        <>
                          {' '}
                          <Selo tipo="atencao">Primeira compra</Selo>
                        </>
                      )}
                    </td>
                    <td className="mono">{i.unidadeMedida}</td>
                    <td className="numero">{qtdBr(i.quantidade)}</td>
                    <td>
                      {i.linhaOrcamento ? (
                        <span className="mono">{i.linhaOrcamento.codigo}</span>
                      ) : (
                        <Selo tipo="atencao">Sem vínculo</Selo>
                      )}
                    </td>
                    <td className="numero">
                      {i.valorEstimado !== null ? dinheiro(i.valorTotal) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={5}>
                    Total estimado
                  </th>
                  <td className="numero destaque">{dinheiro(dados.totalEstimado)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {dados.itens.some((i) => i.especificacaoTecnica) && (
          <div className="cartao" style={{ marginTop: 'var(--esp-4)' }}>
            <h2 className="cartao__titulo">Especificações técnicas</h2>
            {dados.itens
              .filter((i) => i.especificacaoTecnica)
              .map((i) => (
                <div key={i.id} className="especificacao">
                  <strong>
                    {i.material.codigoInterno} · {i.material.descricao}
                  </strong>
                  <p>{i.especificacaoTecnica}</p>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* ---------------- Histórico ---------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Histórico</h2>
          <p className="secao__descricao">
            Tudo que aconteceu com esta solicitação. Nunca é apagado.
          </p>
        </div>

        <ol className="linha-tempo">
          {dados.eventos.map((e) => (
            <li key={e.id} className="linha-tempo__item">
              <span className="linha-tempo__marca" aria-hidden="true" />
              <div>
                <p className="linha-tempo__texto">{e.descricao}</p>
                <p className="linha-tempo__meta">
                  {e.usuario} · {dataHoraBr(e.criadoEm)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
