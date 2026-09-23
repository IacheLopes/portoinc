// ============================================================
//  Pedidos de compra
//
//  O documento final da compra. É pelo número dele que o
//  almoxarife vai conferir o recebimento na Etapa 7.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { listarPedidos, baixarPdfPedido, type PedidoResumo } from '../../servicos/cotacoes';
import {
  marcarPedidoEnviado, ROTULO_SITUACAO_PEDIDO, COR_SITUACAO_PEDIDO,
  type SituacaoPedido,
} from '../../servicos/recebimentos';
import { dataBr } from '../../servicos/solicitacoes';
import { dinheiro } from '../../servicos/cadastros';
import { enviarPedidoPorWhatsApp } from '../../servicos/whatsapp';
import { enviarPedidoPorEmail } from '../../servicos/email';
import { ErroApi } from '../../servicos/api';
import { Cartao } from '../../componentes/Cartao';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';

export function ListaPedidos() {
  const [pedidos, setPedidos] = useState<PedidoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [zap, setZap] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPedidos((await listarPedidos()).pedidos);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function pdf(p: PedidoResumo) {
    setBaixando(p.id);
    try {
      await baixarPdfPedido(p.id, p.numeroFormatado);
    } catch {
      setErro('Não foi possível gerar o PDF.');
    } finally {
      setBaixando(null);
    }
  }

  async function enviar(p: PedidoResumo) {
    setEnviando(p.id);
    setErro(null);
    try {
      const r = await marcarPedidoEnviado(p.id);
      setAviso(r.mensagem);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível marcar como enviado.');
    } finally {
      setEnviando(null);
    }
  }

  /**
   * Manda o PDF do pedido para o fornecedor.
   *
   * Os dois canais do fluxo de compras — WhatsApp e e-mail — levam
   * o mesmo PDF e tiram o pedido do rascunho do mesmo jeito. Quem
   * escolhe é quem está mandando: nem todo fornecedor lê os dois.
   */
  async function mandar(p: PedidoResumo, canal: 'whatsapp' | 'email') {
    setZap(p.id + ':' + canal);
    setErro(null);
    setAviso(null);

    try {
      const r = canal === 'whatsapp'
        ? await enviarPedidoPorWhatsApp(p.id)
        : await enviarPedidoPorEmail(p.id);

      setAviso(r.mensagem);
      await carregar();
    } catch (e) {
      setErro(
        e instanceof ErroApi
          ? e.message
          : 'Não foi possível enviar por ' + (canal === 'whatsapp' ? 'WhatsApp' : 'e-mail') + '.',
      );
    } finally {
      setZap(null);
    }
  }

  if (carregando && pedidos.length === 0) return <Carregando mensagem="Carregando pedidos..." />;
  if (erro && pedidos.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  const total = pedidos.reduce((s, p) => s + p.total, 0);

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Pedidos de compra"
          descricao={
            <>
              O documento final da compra, gerado a partir da equalização. É pelo número
            dele que o almoxarife confere o recebimento.
            </>
          }
        />

        <div className="grade">
          <Cartao titulo="Pedidos" valor={String(pedidos.length)} detalhe="Emitidos" />
          <Cartao titulo="Valor total" valor={dinheiro(total)} detalhe="Soma de todos" />
          <Cartao
            titulo="Fornecedores"
            valor={String(new Set(pedidos.map((p) => p.fornecedor)).size)}
            detalhe="Distintos"
          />
        </div>

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <span aria-hidden="true">✓</span> {aviso}
          </p>
        )}

        {erro && (
          <p className="aviso aviso--erro" role="alert">
            <span aria-hidden="true">⚠</span> {erro}
          </p>
        )}
      </section>

      <section className="secao">
        {pedidos.length === 0 ? (
          <Vazio
            titulo="Nenhum pedido de compra"
            descricao="Os pedidos aparecem depois que você escolhe os vencedores na equalização."
          />
        ) : (
          <div className="cartao cartao--tabela">
            <div className="tabela-area">
              <table className="tabela">
                <caption className="apenas-leitor-tela">Pedidos de compra emitidos</caption>
                <thead>
                  <tr>
                    <th scope="col">Número</th>
                    <th scope="col">Fornecedor</th>
                    <th scope="col">Origem</th>
                    <th scope="col" className="numero">Itens</th>
                    <th scope="col" className="numero">Total</th>
                    <th scope="col">Pagamento</th>
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
                      <td className="celula-texto">{p.origem}</td>
                      <td className="numero">{p.quantidadeItens}</td>
                      <td className="numero destaque">{dinheiro(p.total)}</td>
                      <td className="celula-texto">{p.pagamento}</td>
                      <td>
                        <Selo tipo={COR_SITUACAO_PEDIDO[p.situacao as SituacaoPedido] ?? 'info'}>
                          {ROTULO_SITUACAO_PEDIDO[p.situacao as SituacaoPedido] ?? p.situacao}
                        </Selo>
                      </td>
                      <td>
                        <div className="formulario__acoes">
                          <button
                            type="button"
                            className="botao botao--discreto"
                            onClick={() => void pdf(p)}
                            disabled={baixando === p.id}
                          >
                            {baixando === p.id ? 'Gerando...' : '📄 PDF'}
                          </button>

                          {p.situacao === 'RASCUNHO' && (
                            <button
                              type="button"
                              className="botao botao--discreto"
                              onClick={() => void enviar(p)}
                              disabled={enviando === p.id}
                            >
                              {enviando === p.id ? 'Marcando...' : 'Marcar como enviado'}
                            </button>
                          )}

                          <button
                            type="button"
                            className="botao botao--secundario"
                            onClick={() => void mandar(p, 'whatsapp')}
                            disabled={zap !== null}
                          >
                            {zap === p.id + ':whatsapp' ? 'Enviando...' : '💬 WhatsApp'}
                          </button>

                          <button
                            type="button"
                            className="botao botao--secundario"
                            onClick={() => void mandar(p, 'email')}
                            disabled={zap !== null}
                          >
                            {zap === p.id + ':email' ? 'Enviando...' : '✉ E-mail'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="aviso aviso--info" style={{ marginTop: 'var(--esp-4)' }}>
          <span className="aviso__icone" aria-hidden="true">💡</span>
          <div>
            <strong>O número do pedido é a chave do recebimento.</strong>
            <p>
              Ele sai em destaque no PDF, com o pedido para o fornecedor informá-lo na
              nota fiscal. Depois de mandar o PDF ao fornecedor, use{' '}
              <strong>Marcar como enviado</strong>: é assim que o almoxarifado sabe o que
              esperar. Quando o material chegar, a conferência é feita por esse mesmo
              número, em <strong>Recebimento</strong>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
