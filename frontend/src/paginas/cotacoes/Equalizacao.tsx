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
  ganhoDoPrazo, TAXAS_DE_CUSTO_DO_DINHEIRO, ONDE_GUARDA_A_TAXA,
  ROTULO_SITUACAO_BID, COR_SITUACAO_BID,
  type Equalizacao as Dados,
} from '../../servicos/cotacoes';
import { dataBr } from '../../servicos/solicitacoes';
import {
  dias as diasBr, jurosAoMes, plural, palavra, porcento, dinheiro, quantidade as qtdBr,
} from '../../servicos/texto';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Selecao } from '../../componentes/Campo';
import { Indicador } from '../../componentes/Indicador';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';

function daquiADias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function Equalizacao() {
  const { id = '' } = useParams();

  // Quem tem so `cotacoes.ver` — o engenheiro — LE o mapa para
  // conferir se o que foi cotado atende a especificacao, mas nao
  // escolhe vencedor nem fecha a compra. O servidor recusaria de
  // qualquer jeito; esconder o botao evita o clique frustrado.
  const { pode } = useAutenticacao();
  const podeDecidir = pode('cotacoes.gerenciar');

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

  // A taxa fica no navegador de quem compra: é a mesma em toda
  // cotação, e ninguém quer escolher de novo a cada tela.
  const [taxa, setTaxa] = useState(() => {
    try {
      const guardada = localStorage.getItem(ONDE_GUARDA_A_TAXA);
      return guardada && TAXAS_DE_CUSTO_DO_DINHEIRO.includes(Number(guardada)) ? guardada : '0';
    } catch {
      return '0';
    }
  });

  function guardarTaxa(nova: string) {
    setTaxa(nova);
    try {
      localStorage.setItem(ONDE_GUARDA_A_TAXA, nova);
    } catch {
      // Navegador sem armazenamento: a escolha vale só nesta visita.
    }
  }

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
            titulo="Escolhendo item a item"
            valor={dinheiro(c.melhorCombinacao)}
            detalhe={
              plural(c.fornecedoresVencedores, 'fornecedor', 'fornecedores') +
              ' · frete somado ' +
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
            <Icone nome="alerta" className="aviso__icone" />
            <div>
              <strong>
                {plural(c.itensSemCotacao, 'item', 'itens')} sem nenhuma cotação.
              </strong>
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

        {!concluido && podeDecidir && (
          <div className="barra-acoes">
            <button
              type="button"
              className="botao botao--secundario"
              onClick={aceitarTodosOsMelhores}
            >
              <Icone nome="certo" /> Aceitar todos os melhores preços
            </button>
            {/* SECUNDÁRIO, e isso é decisão, não descuido.

                A tela tinha TRÊS botões azuis — salvar, gerar pedidos
                e reabrir — e três chamadas principais não chamam
                nada: o olho não sabe qual é a saída.

                No fluxo de compras da Porto Inc., o passo da
                equalização termina em PEDIDO. Guardar escolhas
                preserva o trabalho e não avança o processo; quem
                avança é "Gerar pedidos de compra", e esse ficou com o
                azul. */}
            <button
              type="button"
              className="botao botao--secundario"
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
                      {/* "Da última vez pagamos X" — a pergunta
                          número um de quem compra, na hora de
                          decidir e não num relatório depois. */}
                      {(() => {
                        const h = dados.historico?.find((x) => x.bidItemId === l.bidItemId);
                        if (!h?.ultimaCompra) return null;

                        return (
                          <small className="linha-extra linha-extra--historico">
                            Última compra: {dinheiro(h.ultimaCompra.valorUnitario)} em{' '}
                            {dataBr(h.ultimaCompra.quando)}
                          </small>
                        );
                      })()}
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
                              {escolhido && <Icone nome="certo" />}
                              {dinheiro(r.total)}
                            </span>
                            <small className="celula-extra">
                              {r.ehMelhor
                                ? 'melhor preço'
                                : r.acimaEmPorcento !== null
                                  // O NÚMERO VAI PELA `porcento`, não colado
                                  // com `+ '%'`. Juntar número com texto em
                                  // JavaScript usa o ponto do inglês: aqui
                                  // saía "+7.8%" ao lado de "R$ 339,50", dois
                                  // separadores decimais na mesma linha.
                                  //
                                  // É a tela que a anotação do Iache pede
                                  // nominalmente — "mostrar onde cada
                                  // fornecedor chegou no preço melhor" — e o
                                  // "+7,8%" é a frase que responde isso.
                                  ? '+' + porcento(r.acimaEmPorcento)
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

        <div className="barra-acoes">
          <Selecao
            rotulo="Custo do dinheiro"
            valor={taxa}
            aoMudar={guardarTaxa}
            semMarcaOpcional
            opcoes={TAXAS_DE_CUSTO_DO_DINHEIRO.map((t) => ({
              valor: String(t),
              rotulo: t === 0 ? 'Não considerar' : jurosAoMes(t),
            }))}
          />
        </div>

        <div className="grade grade--larga">
          {dados.condicoes.map((cond) => {
            const resumo = c.fornecedores.find(
              (f) => f.bidFornecedorId === cond.bidFornecedorId,
            );
            const total = resumo?.totalSeFecharTudo ?? null;
            const ganho = ganhoDoPrazo(total, cond.prazoMedioPagamento, Number(taxa));

            return (
              <Cartao key={cond.bidFornecedorId} titulo={cond.fornecedor}>
                <dl className="dados">
                  <div>
                    <dt>Pagamento</dt>
                    <dd>{cond.pagamento}</dd>
                  </div>
                  <div>
                    <dt>Prazo médio</dt>
                    <dd>
                      {cond.prazoMedioPagamento === null
                        ? '—'
                        : cond.prazoMedioPagamento === 0
                          ? 'À vista'
                          : diasBr(cond.prazoMedioPagamento)}
                    </dd>
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
                  {/* Só aparece quando a empresa disse quanto custa o
                      dinheiro dela. Sem taxa não há o que converter. */}
                  {ganho > 0 && total !== null && (
                    <div>
                      <dt>Equivale à vista a</dt>
                      <dd>
                        <strong>{dinheiro(total - ganho)}</strong>
                        <span className="dado__extra">
                          {dinheiro(ganho)} a menos que {dinheiro(total)}, pelo prazo
                        </span>
                      </dd>
                    </div>
                  )}
                </dl>
                {cond.observacao && <p className="funcao__descricao">{cond.observacao}</p>}
              </Cartao>
            );
          })}
        </div>

        {Number(taxa) > 0 && (
          <p className="texto-fraco">
            O "equivale à vista" desconta {jurosAoMes(Number(taxa))} sobre o prazo médio
            de cada proposta. Serve para comparar: quem paga depois usa o caixa da
            construtora até lá. Só vale para quem cotou o pacote inteiro.
          </p>
        )}
      </section>

      {/* ---------------- Decisão ---------------- */}
      {!concluido && podeDecidir && (
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
                  {palavra(c.linhas.length, 'item', 'itens')}
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
                <Icone nome="alerta" className="aviso__icone" />
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
                {ocupado ? 'Gerando...' : <><Icone nome="documento" /> Gerar pedidos de compra</>}
              </button>

              {encerrado && (
                <button
                  type="button"
                  className="botao botao--secundario"
                  onClick={() => setPainelChamada((v) => !v)}
                >
                  <Icone nome="aviso" /> Última chamada
                </button>
              )}
            </div>

            {painelChamada && (
              <div className="ultima-chamada">
                <h3 className="formulario__titulo">Última chamada</h3>

                <div className="aviso aviso--info">
                  <Icone nome="cadeado" className="aviso__icone" />
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

                {/* QUEM VAI RECEBER, ANTES DO BOTÃO.
                    Nos outros envios isto é um modal. Aqui não:
                    este painel JÁ é a parada consciente — tem
                    prazo e recado para preencher. Pôr um modal em
                    cima dele seriam dois "tem certeza?" seguidos,
                    que é como se ensina alguém a parar de ler. */}
                <ul className="destinos">
                  {dados.condicoes.map((cond) => (
                    <li key={cond.bidFornecedorId} className="destinos__linha">
                      <span className="destinos__nome">{cond.fornecedor}</span>
                      <span className="destinos__contato">
                        só os itens em que não está na frente
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="formulario__acoes">
                  {/* Reabrir anda para TRÁS no fluxo: devolve a cotação
                      aos fornecedores. Azul convidaria a clicar. */}
                  <button
                    type="button"
                    className="botao botao--secundario"
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
            <Icone nome="certo" className="aviso__icone" />
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
