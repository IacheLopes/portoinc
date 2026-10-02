// ============================================================
//  Painel do recebimento
//
//  A porta de entrada do almoxarifado. O caminhão chegou: o
//  almoxarife digita (ou bipa) o número do pedido e vai direto
//  para a conferência.
//
//  A lista de pedidos esperando entrega fica logo abaixo, para
//  quem não tem o número na mão.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  listarPedidosAbertos, listarRecebimentos,
  ROTULO_SITUACAO_PEDIDO, COR_SITUACAO_PEDIDO,
  type PedidoAberto, type RecebimentoResumo,
} from '../../servicos/recebimentos';
import { dataBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Indicador } from '../../componentes/Indicador';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Paginacao, ContaDaPagina } from '../../componentes/Paginacao';
import { usePagina } from '../../ganchos/pagina';

export function PainelRecebimento() {
  const navegar = useNavigate();
  const campoBusca = useRef<HTMLInputElement>(null);

  const [numero, setNumero] = useState('');
  const [pedidos, setPedidos] = useState<PedidoAberto[]>([]);
  const [recebimentos, setRecebimentos] = useState<RecebimentoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Esta tela nao tem filtro: a chave e fixa.
  const pag = usePagina('');

  const carregar = useCallback(async (pagina = 1) => {
    setCarregando(true);
    setErro(null);
    try {
      const [abertos, feitos] = await Promise.all([
        listarPedidosAbertos(),
        listarRecebimentos(pagina),
      ]);
      setPedidos(abertos.pedidos);
      // Aqui havia um `.slice(0, 10)`: a tela mostrava as dez
      // ultimas e o resto do historico nao tinha como ser visto
      // em lugar nenhum do sistema. Com a barra de paginas, as
      // dez primeiras continuam sendo as primeiras que aparecem —
      // a diferenca e que agora da para chegar na centesima.
      setRecebimentos(feitos.recebimentos);
      pag.chegou(feitos);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
      pag.falhou();
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void carregar(pag.pagina);
  }, [carregar, pag.pagina]);

  // O leitor de código de barras funciona como um teclado: ele
  // "digita" o número e dá Enter. Deixando o foco aqui, basta
  // apontar e apertar o gatilho.
  useEffect(() => {
    campoBusca.current?.focus();
  }, []);

  function abrir(e: React.FormEvent) {
    e.preventDefault();
    const texto = numero.trim();
    if (texto === '') return;
    navegar('/recebimento/' + encodeURIComponent(texto));
  }

  if (carregando && pedidos.length === 0) {
    return <Carregando mensagem="Carregando o almoxarifado..." />;
  }

  if (erro && pedidos.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  const itensPendentes = pedidos.reduce((s, p) => s + p.itensPendentes, 0);

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Recebimento"
          descricao={
            <>
              Chegou material? Comece pelo número do pedido que está na nota e no
            documento que o fornecedor recebeu.
            </>
          }
        />

        <form className="busca-pedido" onSubmit={abrir}>
          <div className="campo">
            <label className="campo__rotulo" htmlFor="numero-pedido">
              Número do pedido
            </label>
            <input
              id="numero-pedido"
              ref={campoBusca}
              className="campo__entrada campo__entrada--destaque"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="PC-00001"
              autoComplete="off"
              inputMode="text"
              aria-describedby="ajuda-numero"
            />
          </div>

          <button type="submit" className="botao botao--principal">
            Abrir conferência
          </button>

          {/* Fora do `.campo` para ocupar a linha inteira da grade.
              Dentro dele, era esta ajuda que definia onde o botão
              ficava — e o botão ia parar ao lado dela. */}
          <p className="campo__ajuda busca-pedido__ajuda" id="ajuda-numero">
            Pode digitar só o número (1), o número completo (PC-00001) ou usar o
            leitor de código de barras.
          </p>
        </form>
      </section>

      <section className="secao">
        <div className="grade">
          <Indicador
            titulo="Pedidos a receber"
            valor={String(pedidos.length)}
            detalhe="Aguardando entrega"
          />
          <Indicador
            titulo="Itens pendentes"
            valor={String(itensPendentes)}
            detalhe="Somando todos os pedidos"
          />
          {/* Este numero vinha de `recebimentos.length`, e a tela
              mostrava dez: ele dizia "10" para sempre, desde a
              decima entrega da empresa. Agora e a conta do banco. */}
          <Indicador
            titulo="Entregas registradas"
            valor={String(pag.dados.total)}
            detalhe="Desde o começo"
          />
        </div>
      </section>

      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Esperando entrega</h2>
        </div>

        {pedidos.length === 0 ? (
          <Vazio
            titulo="Nenhum pedido esperando material"
            descricao="Quando o comprador gerar um pedido de compra, ele aparece aqui."
          />
        ) : (
          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Pedidos aguardando entrega</caption>
                <thead>
                  <tr>
                    <th scope="col">Pedido</th>
                    <th scope="col">Fornecedor</th>
                    <th scope="col">Obra</th>
                    <th scope="col" className="numero">Itens a chegar</th>
                    <th scope="col">Situação</th>
                    <th scope="col">
                      <span className="apenas-leitor-tela">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className="mono">
                        {p.numeroFormatado}
                        <small className="linha-extra">{dataBr(p.criadoEm)}</small>
                      </th>
                      <td>{p.fornecedor}</td>
                      <td className="celula-texto">{p.obra ?? '—'}</td>
                      <td className="numero">
                        {p.itensPendentes} de {p.totalItens}
                      </td>
                      <td>
                        <Selo tipo={COR_SITUACAO_PEDIDO[p.situacao]}>
                          {ROTULO_SITUACAO_PEDIDO[p.situacao]}
                        </Selo>
                      </td>
                      {/* `celula-acoes`: no celular o botão ganha a
                          linha inteira, separado do resto por um traço —
                          como nas outras tabelas do sistema. */}
                      <td className="celula-acoes">
                        <Link
                          className="botao botao--discreto"
                          to={'/recebimento/' + p.numeroFormatado}
                        >
                          Conferir
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

      <section className="secao secao-com-ancora" ref={pag.topo}>
        <div className="secao__cabecalho">
          {/* Deixou de ser "Últimas": a lista inteira está aqui. */}
          <h2>Entregas conferidas</h2>
        </div>

        <ContaDaPagina
          pagina={pag.pagina}
          total={pag.dados.total}
          porPagina={pag.dados.porPagina}
          oQue="entrega"
          oQuePlural="entregas"
          carregando={pag.trocando}
        />

        {recebimentos.length === 0 ? (
          <Vazio
            titulo="Nenhuma entrega registrada ainda"
            descricao="O histórico aparece aqui depois da primeira conferência."
          />
        ) : (
          <Cartao
            semEspaco
            key={pag.pagina}
            className={pag.trocando ? 'lista-trocando' : 'lista-chegou'}
          >
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Entregas já conferidas</caption>
                <thead>
                  <tr>
                    <th scope="col">Recebimento</th>
                    <th scope="col">Pedido</th>
                    <th scope="col">Fornecedor</th>
                    <th scope="col">Nota fiscal</th>
                    <th scope="col">Conferido por</th>
                    <th scope="col">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {recebimentos.map((r) => (
                    <tr key={r.id}>
                      <th scope="row" className="mono">
                        {r.numeroFormatado}
                        <small className="linha-extra">{dataBr(r.recebidoEm)}</small>
                      </th>
                      <td className="mono">{r.pedido}</td>
                      <td>{r.fornecedor}</td>
                      <td className="mono">{r.notaFiscal ?? '—'}</td>
                      <td className="celula-texto">
                        {r.almoxarife}
                        <small className="linha-extra">{r.almoxarifado}</small>
                      </td>
                      <td>
                        {r.temRessalva ? (
                          <Selo tipo="atencao">Com ressalva</Selo>
                        ) : (
                          <Selo tipo="sucesso">Sem problema</Selo>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          </Cartao>
        )}

        <Paginacao
          pagina={pag.pagina}
          paginas={pag.dados.paginas}
          aoTrocar={pag.irPara}
          carregando={pag.trocando}
        />
      </section>
    </>
  );
}
