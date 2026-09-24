// ============================================================
//  Estoque do almoxarifado
//
//  Responde três perguntas, nessa ordem de importância:
//    1. Tem o material que eu preciso?
//    2. O que está acabando?
//    3. Quanto tem parado aqui em dinheiro?
//
//  A retirada acontece na própria tela, sem trocar de página:
//  quem está no almoxarifado não quer navegar, quer dar baixa.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  buscarEstoque, registrarMovimento, transferir, buscarReposicao,
  type Estoque, type LinhaEstoque, type ItemDeReposicao,
} from '../../servicos/estoque';
import { criarSolicitacao } from '../../servicos/solicitacoes';
import { dinheiro, quantidade as qtdBr } from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, Selecao } from '../../componentes/Campo';
import { Indicador } from '../../componentes/Indicador';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Modal } from '../../componentes/Modal';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';

type Acao = 'SAIDA' | 'ENTRADA' | 'AJUSTE' | 'TRANSFERENCIA';

const ROTULO_ACAO: Record<Acao, string> = {
  SAIDA: 'Retirar material',
  ENTRADA: 'Entrada avulsa',
  AJUSTE: 'Ajuste de inventário',
  TRANSFERENCIA: 'Transferir para outro almoxarifado',
};

export function PainelEstoque() {
  const { pode } = useAutenticacao();
  const navegar = useNavigate();
  const podeMovimentar = pode('estoque.movimentar');

  const [dados, setDados] = useState<Estoque | null>(null);
  const [almoxarifadoId, setAlmoxarifadoId] = useState('');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [impedimentos, setImpedimentos] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Painel de movimento (fica aberto sobre a linha escolhida).
  const [linhaAberta, setLinhaAberta] = useState<LinhaEstoque | null>(null);
  const [acao, setAcao] = useState<Acao>('SAIDA');
  const [valor, setValor] = useState('');
  const [destino, setDestino] = useState('');
  const [observacao, setObservacao] = useState('');
  const [precoEntrada, setPrecoEntrada] = useState('');
  const [destinoTransferencia, setDestinoTransferencia] = useState('');

  // Reposição.
  const [reposicao, setReposicao] = useState<ItemDeReposicao[] | null>(null);
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(
    async (alvo?: string, texto?: string) => {
      setCarregando(true);
      setErro(null);
      try {
        const r = await buscarEstoque(alvo ?? almoxarifadoId, texto ?? busca);
        setDados(r);
        if (r.almoxarifadoId) setAlmoxarifadoId(r.almoxarifadoId);
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar o estoque.');
      } finally {
        setCarregando(false);
      }
    },
    [almoxarifadoId, busca],
  );

  useEffect(() => {
    void carregar();
    // Só na primeira carga: as demais são disparadas pelos filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const almoxarifado = useMemo(
    () => dados?.almoxarifados.find((a) => a.id === almoxarifadoId) ?? null,
    [dados, almoxarifadoId],
  );

  /**
   * O que o sistema preencheu sozinho ao abrir.
   *
   * O modal pergunta antes de descartar o que foi preenchido, e para
   * isso precisa saber se foi a PESSOA que preencheu. Vários campos
   * já nascem escritos — o preço médio sempre, a quantidade no ajuste
   * — e comparar com "vazio" acusava mudança onde não houve nenhuma:
   * abrir "Contar" e apertar Esc perguntava "descartar o que você
   * digitou?" para quem não tinha digitado nada.
   *
   * Guardo o que foi posto, em vez de reescrever a regra do que é
   * posto. Regra escrita duas vezes é regra que vai divergir.
   */
  const comoAbriu = useRef({
    valor: '', destino: '', observacao: '', precoEntrada: '', destinoTransferencia: '',
  });

  function abrirPainel(linha: LinhaEstoque, qual: Acao) {
    const inicio = {
      valor: qual === 'AJUSTE' ? String(linha.quantidade) : '',
      destino: '',
      observacao: '',
      precoEntrada: linha.custoMedio ? String(linha.custoMedio) : '',
      destinoTransferencia:
        dados?.almoxarifados.find((a) => a.id !== almoxarifadoId)?.id ?? '',
    };

    setLinhaAberta(linha);
    setAcao(qual);
    setValor(inicio.valor);
    setDestino(inicio.destino);
    setObservacao(inicio.observacao);
    setPrecoEntrada(inicio.precoEntrada);
    setDestinoTransferencia(inicio.destinoTransferencia);
    comoAbriu.current = inicio;

    setErro(null);
    setImpedimentos([]);
    setAviso(null);
  }

  function fecharPainel() {
    setLinhaAberta(null);
  }

  /** A pessoa mexeu no formulário, ou está do jeito que abriu? */
  const mexeuNoMovimento =
    linhaAberta !== null &&
    (valor !== comoAbriu.current.valor ||
      destino !== comoAbriu.current.destino ||
      observacao !== comoAbriu.current.observacao ||
      precoEntrada !== comoAbriu.current.precoEntrada ||
      destinoTransferencia !== comoAbriu.current.destinoTransferencia);

  /**
   * O aviso de erro, escrito uma vez e usado em dois lugares.
   *
   * Ele precisa aparecer na página, para as falhas de carregamento,
   * e TAMBÉM dentro do modal — porque o da página fica atrás dele, e
   * quem tentou registrar um movimento que falhou não veria o motivo.
   */
  const avisoDeErro = erro ? (
    <div className="aviso aviso--erro" role="alert">
      <span className="aviso__icone" aria-hidden="true">⚠</span>
      <div>
        <strong>{erro}</strong>
        {impedimentos.length > 0 && (
          <ul className="campo__erro-lista">
            {impedimentos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  ) : null;

  async function confirmar() {
    if (!linhaAberta) return;

    const numero = Number(valor.replace(',', '.'));
    if (!Number.isFinite(numero)) {
      setErro('Escreva a quantidade usando só números.');
      return;
    }

    setOcupado(true);
    setErro(null);
    setImpedimentos([]);

    try {
      if (acao === 'TRANSFERENCIA') {
        const r = await transferir({
          materialId: linhaAberta.materialId,
          origemId: almoxarifadoId,
          destinoId: destinoTransferencia,
          quantidade: numero,
          observacao: observacao.trim() || undefined,
        });
        setAviso(r.mensagem);
      } else {
        const r = await registrarMovimento({
          almoxarifadoId,
          materialId: linhaAberta.materialId,
          tipo: acao,
          quantidade: numero,
          valorUnitario:
            acao === 'ENTRADA' && precoEntrada.trim()
              ? Number(precoEntrada.replace(',', '.'))
              : undefined,
          destino: destino.trim() || undefined,
          observacao: observacao.trim() || undefined,
        });
        setAviso(r.movimento.numeroFormatado + ' — ' + r.mensagem);
      }

      fecharPainel();
      await carregar();
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setImpedimentos((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Não foi possível registrar o movimento.');
      }
    } finally {
      setOcupado(false);
    }
  }

  async function verReposicao() {
    setErro(null);
    try {
      const r = await buscarReposicao(almoxarifadoId);
      setReposicao(r.itens);
      if (r.itens.length === 0) setAviso(r.mensagem);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao montar a reposição.');
    }
  }

  async function gerarSolicitacao() {
    if (!reposicao || reposicao.length === 0 || !almoxarifado?.obra) return;

    setGerando(true);
    setErro(null);

    try {
      const r = await criarSolicitacao({
        obraId: almoxarifado.obra.id,
        justificativa:
          'Reposição de estoque: material no ponto de pedido em ' + almoxarifado.nome + '.',
        itens: reposicao.map((i) => ({
          materialId: i.materialId,
          quantidade: i.quantidade,
          valorEstimado: i.valorEstimado ?? undefined,
          linhaOrcamentoId: i.linhaOrcamentoId ?? undefined,
          especificacaoTecnica: 'Reposição do mesmo material já usado na obra.',
        })),
      });

      navegar('/solicitacoes/' + r.solicitacao.id);
    } catch (e) {
      setErro(
        e instanceof ErroApi ? e.message : 'Não foi possível abrir a solicitação de reposição.',
      );
      setGerando(false);
    }
  }

  if (carregando && !dados) return <Carregando mensagem="Abrindo o almoxarifado..." />;
  if (erro && !dados) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  if (!dados) return null;

  const { linhas, resumo } = dados;
  const alertas = linhas.filter((l) => l.alerta !== '');

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Estoque"
          descricao={
            <>
              O que existe hoje em cada almoxarifado, quanto vale e o que está prestes a acabar.
            </>
          }
        />

        <div className="barra-acoes">
          <Selecao
            rotulo="Almoxarifado"
            valor={almoxarifadoId}
            aoMudar={(v) => {
              setAlmoxarifadoId(v);
              setReposicao(null);
              void carregar(v);
            }}
            opcoes={dados.almoxarifados.map((a) => ({
              valor: a.id,
              rotulo: a.nome + (a.central ? ' (central)' : ''),
            }))}
            semMarcaOpcional
          />

          <Campo
            rotulo="Procurar material"
            valor={busca}
            aoMudar={setBusca}
            tipo="search"
            exemplo="cimento, 00131..."
            semMarcaOpcional
          />

          <button
            type="button"
            className="botao botao--secundario"
            onClick={() => void carregar(almoxarifadoId, busca)}
          >
            Buscar
          </button>

          <Link to="/estoque/movimentos" className="botao botao--discreto">
            Ver extrato
          </Link>
        </div>

        {resumo && (
          <div className="grade">
            <Indicador titulo="Itens em estoque" valor={String(resumo.itens)} detalhe="Com ficha aberta" />
            <Indicador
              titulo="Valor parado"
              valor={dinheiro(resumo.valorTotal)}
              detalhe="Pelo custo médio"
            />
            <Indicador
              titulo="Abaixo do mínimo"
              valor={String(resumo.abaixoDoMinimo)}
              detalhe="Precisam de reposição"
            />
            <Indicador titulo="Zerados" valor={String(resumo.semSaldo)} detalhe="Sem nenhuma unidade" />
          </div>
        )}

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <span aria-hidden="true">✓</span> {aviso}
          </p>
        )}

        {avisoDeErro}
      </section>

      {alertas.length > 0 && (
        <section className="secao">
          <div className="aviso aviso--atencao">
            <span className="aviso__icone" aria-hidden="true">⚠</span>
            <div style={{ width: '100%' }}>
              <strong>
                {alertas.length === 1
                  ? '1 material chegou no ponto de pedido.'
                  : alertas.length + ' materiais chegaram no ponto de pedido.'}
              </strong>

              <ul className="lista-alertas">
                {alertas.slice(0, 6).map((l) => (
                  <li key={l.materialId}>
                    <span className="mono">{l.codigo}</span> {l.descricao} — {l.alerta}
                  </li>
                ))}
              </ul>

              <div className="formulario__acoes">
                {reposicao === null ? (
                  <button
                    type="button"
                    className="botao botao--secundario"
                    onClick={() => void verReposicao()}
                  >
                    Montar reposição
                  </button>
                ) : (
                  <button
                    type="button"
                    className="botao botao--principal"
                    onClick={() => void gerarSolicitacao()}
                    disabled={gerando || reposicao.length === 0 || !almoxarifado?.obra}
                  >
                    {gerando
                      ? 'Abrindo...'
                      : 'Abrir solicitação com ' +
                        reposicao.length +
                        (reposicao.length === 1 ? ' item' : ' itens')}
                  </button>
                )}
              </div>

              {reposicao !== null && reposicao.length > 0 && (
                <div className="tabela-area" style={{ marginTop: 'var(--esp-3)' }}>
                  <table className="tabela">
                    <caption className="apenas-leitor-tela">
                      Itens sugeridos para a solicitação de reposição
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Material</th>
                        <th scope="col" className="numero">Tem</th>
                        <th scope="col" className="numero">Mínimo</th>
                        <th scope="col" className="numero">Comprar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reposicao.map((i) => (
                        <tr key={i.materialId}>
                          <th scope="row">
                            <span className="mono">{i.codigo}</span> {i.descricao}
                          </th>
                          <td className="numero">{qtdBr(i.saldoAtual)}</td>
                          <td className="numero">{qtdBr(i.pontoPedido ?? 0)}</td>
                          <td className="numero destaque">
                            {qtdBr(i.quantidade)} {i.unidadeMedida}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {reposicao !== null && !almoxarifado?.obra && (
                <p>
                  Este almoxarifado não pertence a uma obra, então a solicitação precisa ser
                  aberta na tela de Solicitações, escolhendo a obra de destino.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="secao">
        {linhas.length === 0 ? (
          <Vazio
            titulo="Nada neste almoxarifado ainda"
            descricao="O saldo aparece assim que a primeira entrega for conferida no recebimento."
          />
        ) : (
          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Saldo por material</caption>
                <thead>
                  <tr>
                    <th scope="col">Material</th>
                    <th scope="col" className="numero">Saldo</th>
                    <th scope="col" className="numero">Mínimo</th>
                    <th scope="col" className="numero">Custo médio</th>
                    <th scope="col" className="numero">Valor parado</th>
                    {podeMovimentar && (
                      <th scope="col">
                        <span className="apenas-leitor-tela">Ações</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.materialId} className={l.alerta ? 'linha-atencao' : undefined}>
                      <th scope="row">
                        <span className="mono">{l.codigo}</span> {l.descricao}
                        <small className="linha-extra">{l.familia}</small>
                      </th>
                      <td className="numero destaque">
                        {qtdBr(l.quantidade)} {l.unidadeMedida}
                        {l.alerta && (
                          <small className="linha-extra">
                            <Selo tipo="atencao">Repor</Selo>
                          </small>
                        )}
                      </td>
                      <td className="numero">
                        {l.pontoPedido ? qtdBr(l.pontoPedido) : '—'}
                      </td>
                      <td className="numero">{l.custoMedio ? dinheiro(l.custoMedio) : '—'}</td>
                      <td className="numero">
                        {l.custoMedio ? dinheiro(l.custoMedio * l.quantidade) : '—'}
                      </td>
                      {podeMovimentar && (
                        <td className="celula-acoes">
                          <div className="formulario__acoes">
                            <button
                              type="button"
                              className="botao botao--discreto"
                              onClick={() => abrirPainel(l, 'SAIDA')}
                            >
                              Retirar
                            </button>
                            <button
                              type="button"
                              className="botao botao--discreto"
                              onClick={() => abrirPainel(l, 'AJUSTE')}
                            >
                              Contar
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          </Cartao>
        )}
      </section>

      {/* --------------------------------------------------
          Movimentar

          Modal, e não painel na página: o botão que abre isto
          mora nas linhas da tabela, e o painel nascia DEPOIS
          dela. Quem clicava numa linha do começo não via nada
          acontecer — o formulário abria fora da tela.

          Movimento de estoque muda saldo. É decisão que merece
          interromper, e o formulário cabe em poucos campos.
          -------------------------------------------------- */}
      <Modal
        aberto={linhaAberta !== null}
        aoFechar={fecharPainel}
        titulo={ROTULO_ACAO[acao]}
        descricao={
          linhaAberta
            ? linhaAberta.codigo + ' ' + linhaAberta.descricao + ' · saldo atual ' +
              qtdBr(linhaAberta.quantidade) + ' ' + linhaAberta.unidadeMedida
            : undefined
        }
        temAlteracao={mexeuNoMovimento}
        acoes={
          <>
            <button
              type="button"
              className="botao botao--secundario"
              onClick={fecharPainel}
              disabled={ocupado}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => void confirmar()}
              disabled={ocupado}
            >
              {ocupado ? 'Registrando...' : 'Registrar'}
            </button>
          </>
        }
      >
        {/* O aviso de erro da página fica ATRÁS do modal. */}
        {avisoDeErro}

        {linhaAberta && (
          <>
            <div className="opcoes">
              {(['SAIDA', 'ENTRADA', 'AJUSTE', 'TRANSFERENCIA'] as Acao[]).map((op) => (
                <label className="opcao" key={op}>
                  <input
                    type="radio"
                    name="acao-estoque"
                    checked={acao === op}
                    onChange={() => {
                      const novo = op === 'AJUSTE' ? String(linhaAberta.quantidade) : '';
                      setAcao(op);
                      setValor(novo);
                      // Quem escreveu foi o sistema, entao o ponto de
                      // partida se move junto.
                      comoAbriu.current = { ...comoAbriu.current, valor: novo };
                    }}
                  />
                  <span>{ROTULO_ACAO[op]}</span>
                </label>
              ))}
            </div>

            <div className="formulario__linha">
              <Campo
                rotulo={
                  acao === 'AJUSTE'
                    ? 'Quantidade contada na prateleira'
                    : 'Quantidade (' + linhaAberta.unidadeMedida + ')'
                }
                valor={valor}
                aoMudar={setValor}
                obrigatorio
                ajuda={
                  acao === 'AJUSTE'
                    ? 'Escreva o que você contou. O sistema calcula a diferença.'
                    : undefined
                }
              />

              {acao === 'SAIDA' && (
                <Campo
                  rotulo="Para quem / qual frente de serviço"
                  valor={destino}
                  aoMudar={setDestino}
                  obrigatorio
                  exemplo="Equipe da laje do 3º pavimento"
                />
              )}

              {acao === 'ENTRADA' && (
                <Campo
                  rotulo="Preço unitário"
                  valor={precoEntrada}
                  aoMudar={setPrecoEntrada}
                  ajuda="Entra na conta do custo médio."
                />
              )}

              {acao === 'TRANSFERENCIA' && (
                <Selecao
                  rotulo="Almoxarifado de destino"
                  valor={destinoTransferencia}
                  aoMudar={setDestinoTransferencia}
                  opcoes={dados.almoxarifados
                    .filter((a) => a.id !== almoxarifadoId)
                    .map((a) => ({ valor: a.id, rotulo: a.nome }))}
                  obrigatorio
                />
              )}
            </div>

            <Campo
              rotulo={acao === 'AJUSTE' ? 'O que a contagem encontrou' : 'Observação'}
              valor={observacao}
              aoMudar={setObservacao}
              obrigatorio={acao === 'AJUSTE'}
              semMarcaOpcional={acao === 'AJUSTE'}
              maximo={500}
              ajuda={
                acao === 'AJUSTE'
                  ? 'Ex.: três sacos endurecidos, descartados.'
                  : undefined
              }
            />
          </>
        )}
      </Modal>

      <div className="aviso aviso--info">
        <span className="aviso__icone" aria-hidden="true">💡</span>
        <div>
          <strong>Nada aqui é apagado.</strong>
          <p>
            Toda entrada, retirada e ajuste vira um movimento com número próprio. Se algo for
            registrado errado, o conserto é um novo movimento — é isso que permite explicar
            qualquer saldo meses depois. O histórico completo fica em{' '}
            <Link to="/estoque/movimentos">Ver extrato</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
