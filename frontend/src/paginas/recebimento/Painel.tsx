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
import { Cartao } from '../../componentes/Cartao';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';

export function PainelRecebimento() {
  const navegar = useNavigate();
  const campoBusca = useRef<HTMLInputElement>(null);

  const [numero, setNumero] = useState('');
  const [pedidos, setPedidos] = useState<PedidoAberto[]>([]);
  const [recebimentos, setRecebimentos] = useState<RecebimentoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [abertos, feitos] = await Promise.all([
        listarPedidosAbertos(),
        listarRecebimentos(),
      ]);
      setPedidos(abertos.pedidos);
      setRecebimentos(feitos.recebimentos.slice(0, 10));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

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
            />
            <p className="campo__ajuda">
              Pode digitar só o número (1), o número completo (PC-00001) ou usar o
              leitor de código de barras.
            </p>
          </div>

          <button type="submit" className="botao botao--principal">
            Abrir conferência
          </button>
        </form>
      </section>

      <section className="secao">
        <div className="grade">
          <Cartao
            titulo="Pedidos a receber"
            valor={String(pedidos.length)}
            detalhe="Aguardando entrega"
          />
          <Cartao
            titulo="Itens pendentes"
            valor={String(itensPendentes)}
            detalhe="Somando todos os pedidos"
          />
          <Cartao
            titulo="Entregas registradas"
            valor={String(recebimentos.length)}
            detalhe="Últimas conferências"
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
          <div className="cartao cartao--tabela">
            <div className="tabela-area">
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
                      <td>
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
            </div>
          </div>
        )}
      </section>

      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Últimas entregas conferidas</h2>
        </div>

        {recebimentos.length === 0 ? (
          <Vazio
            titulo="Nenhuma entrega registrada ainda"
            descricao="O histórico aparece aqui depois da primeira conferência."
          />
        ) : (
          <div className="cartao cartao--tabela">
            <div className="tabela-area">
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
            </div>
          </div>
        )}
      </section>
    </>
  );
}
