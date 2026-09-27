// ============================================================
//  Detalhe da solicitação
//
//  Mostra os itens, quem vai precisar aprovar e o histórico
//  completo do que aconteceu — a trilha que responde à pergunta
//  "quem mandou comprar isso?".
// ============================================================

// padrao-ignora: sem-estados — as duas tabelas nunca aparecem
// vazias. A de itens: solicitacao sem item nao pode ser salva. A de
// assinaturas: a secao inteira so existe quando ha assinatura
// (dados.aprovacoes.length > 0). Um <Vazio> ali seria um aviso
// sobre algo que a pessoa nem sabe que existe.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  buscarSolicitacao, enviarSolicitacao, cancelarSolicitacao, baixarPdf,
  ROTULO_SITUACAO, COR_SITUACAO, dataBr, dataHoraBr,
  ROTULO_DECISAO,
  type Solicitacao, type SituacaoSolicitacao, type Decisao, type ResumoDaAlcada,
} from '../../servicos/solicitacoes';
import { dinheiro, quantidade as qtdBr } from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Indicador } from '../../componentes/Indicador';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro } from '../../componentes/Estado';
import { PainelDecisao } from '../../componentes/PainelDecisao';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { QuemAprova } from '../../componentes/QuemAprova';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';

export function DetalheSolicitacao() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const { usuario, pode } = useAutenticacao();

  const [dados, setDados] = useState<Solicitacao | null>(null);
  const [aprovacao, setAprovacao] = useState<ResumoDaAlcada | null>(null);
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
  // Pelo CÓDIGO. Comparava pelo nome ("Gestor de obra") com uma
  // lista de códigos ("GESTOR_OBRA"), então não descontava nada:
  // quem tinha duas das funções exigidas era convidado a assinar
  // outra vez com a que já tinha assinado.
  const jaAssineiCom = dados.aprovacoes
    .filter((a) => a.usuario === usuario?.nome)
    .map((a) => a.funcaoCodigo);

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
        <CabecalhoDePagina
          titulo={dados.numeroFormatado}
          marcadores={
            <>
              <Selo tipo={COR_SITUACAO[situacao]}>{ROTULO_SITUACAO[situacao]}</Selo>
              {dados.itens.some((i) => i.primeiraCompra) && (
                <Selo tipo="atencao">Tem item nunca comprado</Selo>
              )}
            </>
          }
          descricao={
            <>
              Aberta por <strong>{dados.solicitante.nome}</strong> em{' '}
            {dataHoraBr(dados.criadaEm)} · Obra {dados.obra.codigo} — {dados.obra.nome}
            </>
          }
        />

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <Icone nome="certo" /> {aviso}
          </p>
        )}

        {erro && (
          <div className="aviso aviso--erro" role="alert">
            <Icone nome="alerta" className="aviso__icone" />
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
          <Indicador
            titulo="Total estimado"
            valor={dinheiro(dados.totalEstimado)}
            detalhe={dados.itens.length === 1 ? '1 item' : dados.itens.length + ' itens'}
          />
          <Indicador
            titulo="Precisa até"
            valor={dataBr(dados.dataDesejada)}
            detalhe={dados.enviadaEm ? 'Enviada em ' + dataBr(dados.enviadaEm) : 'Ainda não enviada'}
          />

          {/* O terceiro da fileira. Não é <Indicador> — aquele
              reserva altura de linha de número, e aqui vai uma
              lista —, mas veste a mesma caixa e a mesma anatomia,
              senão a fileira racha. */}
          <QuemAprova alcada={aprovacao} solicitacao={dados} />
        </div>

        {dados.justificativa && (
          <Cartao titulo="Justificativa" className="respiro-acima">
            <p>{dados.justificativa}</p>
          </Cartao>
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
            <Icone nome="documento" /> Baixar PDF
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

          <Cartao semEspaco>
            <TabelaArea>
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
            </TabelaArea>
          </Cartao>
        </section>
      )}

      {/* ---------------- Itens ---------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Itens solicitados</h2>
        </div>

        <Cartao semEspaco>
          <TabelaArea>
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
          </TabelaArea>
        </Cartao>

        {dados.itens.some((i) => i.especificacaoTecnica) && (
          <Cartao titulo="Especificações técnicas" className="respiro-acima">
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
          </Cartao>
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
