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

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Cartao } from '../../componentes/Cartao';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';

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

  function abrirPainel(linha: LinhaEstoque, qual: Acao) {
    setLinhaAberta(linha);
    setAcao(qual);
    setValor(qual === 'AJUSTE' ? String(linha.quantidade) : '');
    setDestino('');
    setObservacao('');
    setPrecoEntrada(linha.custoMedio ? String(linha.custoMedio) : '');
    setDestinoTransferencia(
      dados?.almoxarifados.find((a) => a.id !== almoxarifadoId)?.id ?? '',
    );
    setErro(null);
    setImpedimentos([]);
    setAviso(null);
  }

  function fecharPainel() {
    setLinhaAberta(null);
  }

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
        <div className="secao__cabecalho">
          <h1>Estoque</h1>
          <p className="secao__descricao">
            O que existe hoje em cada almoxarifado, quanto vale e o que está prestes a acabar.
          </p>
        </div>

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
            <Cartao titulo="Itens em estoque" valor={String(resumo.itens)} detalhe="Com ficha aberta" />
            <Cartao
              titulo="Valor parado"
              valor={dinheiro(resumo.valorTotal)}
              detalhe="Pelo custo médio"
            />
            <Cartao
              titulo="Abaixo do mínimo"
              valor={String(resumo.abaixoDoMinimo)}
              detalhe="Precisam de reposição"
            />
            <Cartao titulo="Zerados" valor={String(resumo.semSaldo)} detalhe="Sem nenhuma unidade" />
          </div>
        )}

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
                  {impedimentos.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
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
          <div className="cartao cartao--tabela">
            <div className="tabela-area">
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
                        <td>
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
            </div>
          </div>
        )}
      </section>

      {linhaAberta && (
        <section className="secao" aria-live="polite">
          <div className="cartao painel-movimento">
            <div className="secao__cabecalho">
              <h2>{ROTULO_ACAO[acao]}</h2>
              <p className="secao__descricao">
                <span className="mono">{linhaAberta.codigo}</span> {linhaAberta.descricao} · saldo
                atual {qtdBr(linhaAberta.quantidade)} {linhaAberta.unidadeMedida}
              </p>
            </div>

            <div className="opcoes">
              {(['SAIDA', 'ENTRADA', 'AJUSTE', 'TRANSFERENCIA'] as Acao[]).map((op) => (
                <label className="opcao" key={op}>
                  <input
                    type="radio"
                    name="acao-estoque"
                    checked={acao === op}
                    onChange={() => {
                      setAcao(op);
                      setValor(op === 'AJUSTE' ? String(linhaAberta.quantidade) : '');
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

            <div className="formulario__acoes formulario__acoes--fim">
              <button type="button" className="botao botao--discreto" onClick={fecharPainel}>
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
            </div>
          </div>
        </section>
      )}

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
