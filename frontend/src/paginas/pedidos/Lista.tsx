// ============================================================
//  Pedidos de compra
//
//  O documento final da compra. É pelo número dele que o
//  almoxarife vai conferir o recebimento na Etapa 7.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { Indicador } from '../../componentes/Indicador';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { Paginacao, ContaDaPagina } from '../../componentes/Paginacao';
import { usePagina } from '../../ganchos/pagina';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { MenuDeAcoes } from '../../componentes/MenuDeAcoes';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';

export function ListaPedidos() {
  const [pedidos, setPedidos] = useState<PedidoResumo[]>([]);
  // Os três números do alto. Vêm contados no banco.
  const [resumo, setResumo] = useState({ pedidos: 0, valorTotal: 0, fornecedores: 0 });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [zap, setZap] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Esta tela nao tem filtro: a chave e fixa.
  const pag = usePagina('');

  const carregar = useCallback(async (pagina = 1) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await listarPedidos(pagina);
      setPedidos(r.pedidos);
      setResumo(r.resumo);
      pag.chegou(r);
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

        {/* Os três saíam de contar o array que a tela tinha em
            mão. Com vinte por página, "Soma de todos" mostraria a
            soma de vinte — e com a cara de total da empresa. Agora
            os três são contados no banco. */}
        <div className="grade">
          <Indicador titulo="Pedidos" valor={String(resumo.pedidos)} detalhe="Emitidos" />
          <Indicador
            titulo="Valor total"
            valor={dinheiro(resumo.valorTotal)}
            detalhe="Soma de todos"
          />
          <Indicador
            titulo="Fornecedores"
            valor={String(resumo.fornecedores)}
            detalhe="Distintos"
          />
        </div>

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <Icone nome="certo" /> {aviso}
          </p>
        )}

        {erro && (
          <p className="aviso aviso--erro" role="alert">
            <Icone nome="alerta" /> {erro}
          </p>
        )}
      </section>

      <section className="secao secao-com-ancora" ref={pag.topo}>
        <ContaDaPagina
          pagina={pag.pagina}
          total={pag.dados.total}
          porPagina={pag.dados.porPagina}
          oQue="pedido"
          oQuePlural="pedidos"
          carregando={pag.trocando}
        />

        {pedidos.length === 0 ? (
          <Vazio
            titulo="Nenhum pedido de compra"
            descricao="Os pedidos aparecem depois que você escolhe os vencedores na equalização."
          />
        ) : (
          /* A descrição dizia "N pedido(s) · R$ X no total", e as
             duas contas saíam do array da página. As duas agora
             estão nos indicadores acima, contadas no banco — repetir
             aqui só daria dois lugares para divergirem. */
          <Cartao
            titulo="Pedidos emitidos"
            semEspaco
            key={pag.pagina}
            className={pag.trocando ? 'lista-trocando' : 'lista-chegou'}
          >
            <TabelaArea>
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
                      <td className="celula-acoes">
                        <div className="formulario__acoes">
                          {/* Abrir vem PRIMEIRO.

                              A tela de detalhe não existia — havia a
                              lista e o PDF, e mais nada. Para ver o
                              que tinha dentro de um pedido era
                              preciso baixar o arquivo. O dono
                              reparou em 27/09/2026. */}
                          <Link
                            to={'/pedidos/' + p.id}
                            className="botao botao--discreto botao--link"
                          >
                            Abrir
                          </Link>

                          {/* A ação que faz o pedido ANDAR fica à vista.
                              O resto é apoio e vai para o menu. */}
                          {p.situacao === 'RASCUNHO' && (
                            <button
                              type="button"
                              className="botao botao--secundario"
                              onClick={() => void enviar(p)}
                              disabled={enviando === p.id}
                            >
                              {enviando === p.id ? 'Marcando...' : 'Marcar como enviado'}
                            </button>
                          )}

                          <MenuDeAcoes
                            descricao={'Ações do pedido ' + p.numeroFormatado}
                            acoes={[
                              {
                                rotulo: baixando === p.id ? 'Gerando o PDF...' : 'Baixar o PDF',
                                icone: <Icone nome="documento" />,
                                aoEscolher: () => void pdf(p),
                                desabilitada: baixando === p.id,
                              },
                              {
                                rotulo: 'Mandar pelo WhatsApp',
                                icone: <Icone nome="conversa" />,
                                aoEscolher: () => void mandar(p, 'whatsapp'),
                                desabilitada: zap !== null,
                              },
                              {
                                rotulo: 'Mandar por e-mail',
                                icone: <Icone nome="envelope" />,
                                aoEscolher: () => void mandar(p, 'email'),
                                desabilitada: zap !== null,
                              },
                            ]}
                          />
                        </div>
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

        <div className="aviso aviso--info" style={{ marginTop: 'var(--esp-4)' }}>
          <Icone nome="dica" className="aviso__icone" />
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
