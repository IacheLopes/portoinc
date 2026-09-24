// ============================================================
//  Mapa de equalização
//
//  A tela onde o dinheiro é decidido. Todos os fornecedores
//  lado a lado, item por item, com o melhor preço destacado.
//
//  O comprador escolhe item a item — não precisa ser tudo do
//  mesmo fornecedor, e o sistema mostra quanto isso rende.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  buscarEqualizacao, salvarEscolhas, ultimaChamada, gerarPedidos,
  ROTULO_SITUACAO_BID, COR_SITUACAO_BID,
  type Equalizacao as Dados,
} from '../../servicos/cotacoes';

import { dinheiro, quantidade as qtdBr } from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { Indicador } from '../../componentes/Indicador';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';

function daquiADias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function Equalizacao() {
  const { id = '' } = useParams();

  const [dados, setDados] = useState<Dados | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [impedimentos, setImpedimentos] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [painelChamada, setPainelChamada] = useState(false);
  const [novoPrazo, setNovoPrazo] = useState(daquiADias(3));
  const [recadoChamada, setRecadoChamada] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await buscarEqualizacao(id);
      setDados(r);
      setEscolhas(r.escolhas);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function escolher(bidItemId: string, bidFornecedorId: string) {
    setEscolhas((a) => {
      const novo = { ...a };
      if (novo[bidItemId] === bidFornecedorId) delete novo[bidItemId];
      else novo[bidItemId] = bidFornecedorId;
      return novo;
    });
  }

  function aceitarTodosOsMelhores() {
    if (!dados) return;

    const novo: Record<string, string> = {};
    for (const l of dados.comparativo.linhas) {
      if (l.melhorFornecedorId) novo[l.bidItemId] = l.melhorFornecedorId;
    }
    setEscolhas(novo);
  }

  async function salvar() {
    if (!dados) return;
    setOcupado(true);
    setErro(null);

    try {
      await salvarEscolhas(
        id,
        dados.comparativo.linhas.map((l) => ({
          bidItemId: l.bidItemId,
          bidFornecedorId: escolhas[l.bidItemId] ?? null,
        })),
      );
      setAviso('Escolhas salvas.');
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao salvar.');
    } finally {
      setOcupado(false);
    }
  }

  async function dispararUltimaChamada() {
    setOcupado(true);
    setErro(null);

    try {
      const r = await ultimaChamada(
        id,
        new Date(novoPrazo + 'T23:59:59').toISOString(),
        recadoChamada || undefined,
      );
      setAviso(r.mensagem);
      setPainelChamada(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha na última chamada.');
    } finally {
      setOcupado(false);
    }
  }

  async function fecharPedidos() {
    setOcupado(true);
    setErro(null);
    setImpedimentos([]);

    try {
      const r = await gerarPedidos(id);
      setAviso(
        r.mensagem + ' ' + r.pedidos.map((p) => p.numero + ' (' + p.fornecedor + ')').join(', '),
      );
      await carregar();
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setImpedimentos((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Falha ao gerar os pedidos.');
      }
    } finally {
      setOcupado(false);
    }
  }

  if (carregando && !dados) return <Carregando mensagem="Montando o comparativo..." />;
  if (erro && !dados) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  if (!dados) return null;

  const { comparativo: c, cotacao } = dados;
  const encerrado = cotacao.situacao === 'ENCERRADO';
  const concluido = cotacao.situacao === 'CONCLUIDO';

  // Total do que está escolhido agora.
  const totalEscolhido = c.linhas.reduce((soma, l) => {
    const f = escolhas[l.bidItemId];
    if (!f) return soma;
    const r = l.respostas.find((x) => x.bidFornecedorId === f);
    return soma + (r?.total ?? 0);
  }, 0);

  const fretesEscolhidos = [...new Set(Object.values(escolhas))].reduce((s, fid) => {
    const cond = dados.condicoes.find((x) => x.bidFornecedorId === fid);
    return s + (cond?.frete ?? 0) + (cond?.outrosCustos ?? 0);
  }, 0);

  const faltamEscolher = c.linhas.filter(
    (l) => l.melhorFornecedorId && !escolhas[l.bidItemId],
  ).length;

  if (c.fornecedores.length === 0) {
    return (
      <section className="secao">
        <Vazio
          titulo="Nenhum fornecedor respondeu ainda"
          descricao="O comparativo aparece assim que chegar a primeira cotação."
        />
      </section>
    );
  }

  return (
    <>
      <section className="secao">
        <nav className="migalhas" aria-label="Você está em">
          <Link to="/cotacoes">Cotações</Link>
          <span aria-hidden="true">›</span>
          <Link to={'/cotacoes/' + id}>{cotacao.numeroFormatado}</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">Equalização</span>
        </nav>

        <CabecalhoDePagina
          titulo="Equalização"
          marcadores={
            <>
              <Selo tipo={COR_SITUACAO_BID[cotacao.situacao]}>
                {ROTULO_SITUACAO_BID[cotacao.situacao]}
              </Selo>
              {cotacao.rodada > 1 && <Selo tipo="atencao">Rodada {cotacao.rodada}</Selo>}
            </>
          }
          descricao={
            <>
              {cotacao.numeroFormatado} · {cotacao.titulo} ·{' '}
            {cotacao.totalResponderam} de {cotacao.totalConvidados} fornecedores responderam
            </>
          }
        />

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <span aria-hidden="true">✓</span> {aviso}
          </p>
        )}

        {erro && (
          <div className="aviso aviso--erro" role="alert">
            <span className="aviso__icone" aria-hidden="true">⚠</span>
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
            titulo="Escolhendo item a item"
            valor={dinheiro(c.melhorCombinacao)}
            detalhe={
              c.fornecedoresVencedores +
              ' fornecedor(es) · frete somado ' +
              dinheiro(c.freteDaCombinacao)
            }
          />
          <Indicador
            titulo="Fechando com um só"
            valor={c.melhorFornecedorUnico ? dinheiro(c.melhorFornecedorUnico.total) : '—'}
            detalhe={
              c.melhorFornecedorUnico
                ? c.melhorFornecedorUnico.nome
                : 'Nenhum fornecedor cotou todos os itens'
            }
          />
          <Indicador
            titulo="Economia ao misturar"
            valor={dinheiro(c.economiaAoMisturar)}
            detalhe={
              c.economiaAoMisturar > 0
                ? 'Vale dividir entre fornecedores'
                : 'Não compensa dividir neste caso'
            }
          />
        </div>

        {c.itensSemCotacao > 0 && (
          <div className="aviso aviso--atencao" style={{ marginTop: 'var(--esp-4)' }}>
            <span className="aviso__icone" aria-hidden="true">⚠</span>
            <div>
              <strong>{c.itensSemCotacao} item(ns) sem nenhuma cotação.</strong>
              <p>
                Ninguém cotou, ou todos marcaram que não têm. Faça uma última chamada,
                convide outros fornecedores ou tire esses itens do pacote.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ---------------- Mapa comparativo ---------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Mapa comparativo</h2>
          <p className="secao__descricao">
            O melhor preço de cada item vem destacado. Clique numa célula para escolher
            aquele fornecedor para aquele item.
          </p>
        </div>

        {!concluido && (
          <div className="barra-acoes">
            <button
              type="button"
              className="botao botao--secundario"
              onClick={aceitarTodosOsMelhores}
            >
              ✓ Aceitar todos os melhores preços
            </button>
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => void salvar()}
              disabled={ocupado}
            >
              {ocupado ? 'Salvando...' : 'Salvar escolhas'}
            </button>
          </div>
        )}

        <Cartao semEspaco>
          {/* `rolar`: aqui a tabela e de COMPARACAO — a mesma linha em
                                varias colunas de fornecedor. Virar cartao desmonta
                                justamente o que a pessoa abriu a tela para ver. */}
                            <TabelaArea rolar>
            <table className="tabela mapa">
              <caption className="apenas-leitor-tela">
                Comparativo de preços por item e fornecedor
              </caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="numero">Qtd.</th>
                  {c.fornecedores.map((f) => (
                    <th key={f.bidFornecedorId} scope="col" className="numero">
                      {f.fornecedorNome}
                      <small className="linha-extra">
                        vence {f.itensVencidos} de {c.linhas.length}
                      </small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.linhas.map((l) => (
                  <tr key={l.bidItemId}>
                    <th scope="row">
                      <span className="mono">{l.codigo}</span>
                      <small className="linha-extra">{l.descricao}</small>
                    </th>
                    <td className="numero">
                      {qtdBr(l.quantidade)} {l.unidadeMedida}
                    </td>

                    {c.fornecedores.map((f) => {
                      const r = l.respostas.find((x) => x.bidFornecedorId === f.bidFornecedorId);
                      const escolhido = escolhas[l.bidItemId] === f.bidFornecedorId;

                      if (!r || !r.disponivel || r.total === null) {
                        return (
                          <td key={f.bidFornecedorId} className="numero celula-vazia">
                            {r && !r.disponivel ? 'não tem' : '—'}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={f.bidFornecedorId}
                          className={
                            'numero celula-preco' +
                            (r.ehMelhor ? ' celula-preco--melhor' : '') +
                            (escolhido ? ' celula-preco--escolhida' : '')
                          }
                        >
                          <button
                            type="button"
                            className="celula-botao"
                            onClick={() => escolher(l.bidItemId, f.bidFornecedorId)}
                            disabled={concluido}
                            aria-pressed={escolhido}
                            aria-label={
                              'Escolher ' + f.fornecedorNome + ' para ' + l.descricao +
                              ' por ' + dinheiro(r.total)
                            }
                          >
                            <span className="celula-valor">
                              {escolhido && <span aria-hidden="true">✓ </span>}
                              {dinheiro(r.total)}
                            </span>
                            <small className="celula-extra">
                              {r.ehMelhor
                                ? 'melhor preço'
                                : r.acimaEmPorcento !== null
                                  ? '+' + r.acimaEmPorcento + '%'
                                  : ''}
                              {r.prazoEntregaDias !== null && ' · ' + r.prazoEntregaDias + 'd'}
                            </small>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2}>
                    Frete e outros custos
                  </th>
                  {c.fornecedores.map((f) => (
                    <td key={f.bidFornecedorId} className="numero">
                      {dinheiro(f.frete + f.outrosCustos)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" colSpan={2}>
                    Total fechando tudo com um só
                  </th>
                  {c.fornecedores.map((f) => (
                    <td key={f.bidFornecedorId} className="numero destaque">
                      {f.totalSeFecharTudo === null ? (
                        <Selo tipo="atencao">Não cotou tudo</Selo>
                      ) : (
                        dinheiro(f.totalSeFecharTudo)
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </TabelaArea>
        </Cartao>
      </section>

      {/* ---------------- Condições comerciais ---------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Condições comerciais</h2>
          <p className="secao__descricao">
            Preço não é tudo: prazo de pagamento também pesa na decisão.
          </p>
        </div>

        <div className="grade grade--larga">
          {dados.condicoes.map((cond) => (
            <Cartao key={cond.bidFornecedorId} titulo={cond.fornecedor}>
              <dl className="dados">
                <div>
                  <dt>Pagamento</dt>
                  <dd>{cond.pagamento}</dd>
                </div>
                <div>
                  <dt>Frete</dt>
                  <dd>{dinheiro(cond.frete)}</dd>
                </div>
                {cond.outrosCustos > 0 && (
                  <div>
                    <dt>Outros</dt>
                    <dd>{dinheiro(cond.outrosCustos)}</dd>
                  </div>
                )}
              </dl>
              {cond.observacao && <p className="funcao__descricao">{cond.observacao}</p>}
            </Cartao>
          ))}
        </div>
      </section>

      {/* ---------------- Decisão ---------------- */}
      {!concluido && (
        <section className="secao">
          <Cartao className="painel-decisao">
            <h2 className="formulario__titulo">Fechar a compra</h2>

            <dl className="dados">
              <div>
                <dt>Escolhidos</dt>
                <dd>
                  <strong>
                    {Object.keys(escolhas).length} de {c.linhas.length}
                  </strong>{' '}
                  item(ns)
                  {faltamEscolher > 0 && (
                    <>
                      {' '}
                      <Selo tipo="atencao">faltam {faltamEscolher}</Selo>
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt>Itens</dt>
                <dd>{dinheiro(totalEscolhido)}</dd>
              </div>
              <div>
                <dt>Fretes</dt>
                <dd>{dinheiro(fretesEscolhidos)}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>
                  <strong>{dinheiro(totalEscolhido + fretesEscolhidos)}</strong>
                </dd>
              </div>
            </dl>

            {!encerrado && (
              <div className="aviso aviso--atencao">
                <span className="aviso__icone" aria-hidden="true">⚠</span>
                <div>
                  <strong>A cotação ainda está aberta.</strong>
                  <p>
                    Encerre em <Link to={'/cotacoes/' + id}>{cotacao.numeroFormatado}</Link>{' '}
                    antes de gerar os pedidos. Fornecedores ainda podem alterar as propostas.
                  </p>
                </div>
              </div>
            )}

            <div className="barra-acoes">
              <button
                type="button"
                className="botao botao--principal"
                onClick={() => void fecharPedidos()}
                disabled={ocupado || !encerrado || faltamEscolher > 0}
              >
                {ocupado ? 'Gerando...' : '📄 Gerar pedidos de compra'}
              </button>

              {encerrado && (
                <button
                  type="button"
                  className="botao botao--secundario"
                  onClick={() => setPainelChamada((v) => !v)}
                >
                  📢 Última chamada
                </button>
              )}
            </div>

            {painelChamada && (
              <div className="ultima-chamada">
                <h3 className="formulario__titulo">Última chamada</h3>

                <div className="aviso aviso--info">
                  <span className="aviso__icone" aria-hidden="true">🔒</span>
                  <div>
                    <strong>O preço do concorrente nunca é revelado.</strong>
                    <p>
                      Cada fornecedor recebe apenas a lista dos itens em que{' '}
                      <em>não</em> está na frente, e o convite para rever. Revelar valores
                      ensinaria o mercado a se alinhar — e a Porto Inc. pagaria mais caro
                      no médio prazo.
                    </p>
                  </div>
                </div>

                <div className="formulario__linha">
                  <div className="campo">
                    <label className="campo__rotulo" htmlFor="novo-prazo">
                      Novo prazo de resposta
                    </label>
                    <input
                      id="novo-prazo"
                      type="date"
                      className="campo__entrada"
                      value={novoPrazo}
                      onChange={(e) => setNovoPrazo(e.target.value)}
                    />
                  </div>
                  <div className="campo">
                    <label className="campo__rotulo" htmlFor="recado">
                      Recado <span className="campo__opcional">(opcional)</span>
                    </label>
                    <input
                      id="recado"
                      className="campo__entrada"
                      value={recadoChamada}
                      onChange={(e) => setRecadoChamada(e.target.value)}
                      placeholder="Precisamos fechar até sexta."
                    />
                  </div>
                </div>

                <div className="formulario__acoes">
                  <button
                    type="button"
                    className="botao botao--principal"
                    onClick={() => void dispararUltimaChamada()}
                    disabled={ocupado || !novoPrazo}
                  >
                    {ocupado ? 'Reabrindo...' : 'Reabrir e avisar os fornecedores'}
                  </button>
                  <button
                    type="button"
                    className="botao botao--secundario"
                    onClick={() => setPainelChamada(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </Cartao>
        </section>
      )}

      {concluido && (
        <section className="secao">
          <div className="aviso aviso--sucesso">
            <span className="aviso__icone" aria-hidden="true">✓</span>
            <div>
              <strong>Pedidos gerados.</strong>
              <p>
                Veja em <Link to="/pedidos">Pedidos de compra</Link>. A partir daqui, o
                próximo passo é o recebimento no almoxarifado.
              </p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
