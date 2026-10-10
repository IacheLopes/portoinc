// ============================================================
//  Detalhe do pedido de compra
//
//  padrao-ignora: sem-estados
//
//  A regra cobra Carregando, Erro e Vazio de toda tela com tabela.
//  Esta tem os dois primeiros e NÃO tem o terceiro, de propósito:
//  a tabela daqui lista os itens do pedido, e PEDIDO SEM ITEM NÃO
//  EXISTE.
//
//  Ele nasce em `rotas/equalizacao.ts`, de um Map agrupado por
//  fornecedor vencedor: a chave do fornecedor só passa a existir
//  quando um item é empurrado para ela. Fornecedor que não venceu
//  nada não ganha pedido nenhum.
//
//  Um estado vazio aqui seria código morto para um caso impossível
//  — e código morto ensina que a regra é burocracia.
//
//  Esta tela nunca existiu. Havia a lista e o PDF, e mais nada:
//  para ver o que tinha dentro de um pedido era preciso baixar o
//  arquivo. O dono reparou na validação de 27/09/2026 — "não
//  existe botão abrir para ver mais detalhes".
//
//  --- o que ela tem de diferente das irmãs ---
//
//  A solicitação responde "o que a obra precisa". A cotação
//  responde "quanto cobram". O pedido responde uma pergunta que
//  nenhuma das duas responde sozinha:
//
//      por que compramos ISTO, deste fornecedor, por este preço?
//
//  Por isso o bloco "De onde veio" existe e fica no alto: ele
//  mostra a corrente inteira — solicitação, cotação, pedido — com
//  os números clicáveis. É a única tela do sistema que fecha esse
//  caminho, e é onde a ousadia desta página foi gasta. O resto
//  veste exatamente o mesmo uniforme da tela de solicitação, para
//  as duas lerem como irmãs.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  buscarPedido, baixarPdfPedido, type Pedido,
} from '../../servicos/cotacoes';
import {
  marcarPedidoEnviado, ROTULO_SITUACAO_PEDIDO, COR_SITUACAO_PEDIDO,
  type SituacaoPedido,
} from '../../servicos/recebimentos';
import { enviarPedidoPorWhatsApp } from '../../servicos/whatsapp';
import { enviarPedidoPorEmail } from '../../servicos/email';
import { dataBr, dataHoraBr } from '../../servicos/solicitacoes';
import { dinheiro, quantidade as qtdBr } from '../../servicos/texto';
// As mesmas máscaras dos formulários, agora só para LER: CNPJ sem
// pontuação e telefone corrido são ilegíveis, e o pedido é o
// documento em que esses dois números mais importam.
import { mascaraCnpj, mascaraTelefone, parteNacional } from '../../servicos/mascaras';
import { ErroApi } from '../../servicos/api';
import { Indicador } from '../../componentes/Indicador';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';
import { ConfirmarEnvio } from '../../componentes/ConfirmarEnvio';
import { telefoneCompleto } from '../../servicos/mascaras';
import { buscarSituacao } from '../../servicos/whatsapp';

export function DetalhePedido() {
  const { id = '' } = useParams();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Qual envio espera confirmação, e se o modo de teste vai barrar.
  const [confirmando, setConfirmando] = useState<'whatsapp' | 'email' | null>(null);
  const [modoTeste, setModoTeste] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await buscarPedido(id);
      setPedido(r.pedido);

      // Para o modal avisar, antes de mandar, que o modo de teste
      // vai bloquear. Falhar aqui não derruba a tela.
      try {
        const w = await buscarSituacao();
        setModoTeste(w.modoTeste);
      } catch {
        setModoTeste(true);
      }
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar o pedido.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function tentar(oque: () => Promise<string>) {
    setOcupado(true);
    setErro(null);
    try {
      setAviso(await oque());
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível concluir.');
    } finally {
      setOcupado(false);
    }
  }

  if (carregando && !pedido) return <Carregando mensagem="Carregando o pedido..." />;
  if (erro && !pedido) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  if (!pedido) return null;

  const situacao = pedido.situacao as SituacaoPedido;
  const ehRascunho = pedido.situacao === 'RASCUNHO';
  const fornecedor = pedido.fornecedor.nomeFantasia ?? pedido.fornecedor.razaoSocial;

  // O prazo que o fornecedor prometeu. Vem por item; o que vale
  // para a obra é o mais demorado — a entrega só está completa
  // quando o último chegar.
  const prazos = pedido.itens.map((i) => i.prazoEntregaDias).filter((p): p is number => p !== null);
  const prazoMaior = prazos.length > 0 ? Math.max(...prazos) : null;

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo={pedido.numeroFormatado}
          marcadores={
            <Selo tipo={COR_SITUACAO_PEDIDO[situacao] ?? 'info'}>
              {ROTULO_SITUACAO_PEDIDO[situacao] ?? pedido.situacao}
            </Selo>
          }
          descricao={
            <>
              Para <strong>{fornecedor}</strong> · emitido por {pedido.comprador} em{' '}
              {dataHoraBr(pedido.criadoEm)}
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
            <div><strong>{erro}</strong></div>
          </div>
        )}

        <div className="grade">
          {/* Os três em largura cheia no celular.

              Só os dois de baixo tinham `cheia`, e o total ficava
              sozinho em meia coluna ao lado de um vazio — fileira
              torta. No computador nada muda: a regra de largura
              cheia só existe abaixo de 640px. */}
          <Indicador
            titulo="Total do pedido"
            largura="cheia"
            valor={dinheiro(pedido.total)}
            detalhe={
              pedido.itens.length === 1 ? '1 item, com frete' : pedido.itens.length + ' itens, com frete'
            }
          />
          <Indicador
            titulo="Pagamento"
            largura="cheia"
            valor={pedido.pagamento}
            detalhe="Condição fechada na cotação"
          />
          <Indicador
            titulo="Entrega"
            largura="cheia"
            valor={
              prazoMaior === null
                ? 'Não informada'
                : prazoMaior === 1
                  ? 'Em 1 dia'
                  : 'Em ' + prazoMaior + ' dias'
            }
            detalhe={
              pedido.enviadoEm
                ? 'Contando do envio, em ' + dataBr(pedido.enviadoEm)
                : 'O prazo começa quando o pedido for enviado'
            }
          />
        </div>

        {/* ---------------- Ações ---------------- */}
        <div className="barra-acoes" style={{ marginTop: 'var(--esp-4)' }}>
          {ehRascunho && (
            <button
              type="button"
              className="botao botao--principal"
              disabled={ocupado}
              onClick={() =>
                void tentar(async () => {
                  await marcarPedidoEnviado(pedido.id);
                  return 'Pedido marcado como enviado. O almoxarifado já pode esperar a entrega.';
                })
              }
            >
              <Icone nome="enviado" /> Marcar como enviado
            </button>
          )}

          <button
            type="button"
            className="botao botao--secundario"
            disabled={ocupado}
            onClick={() =>
              void tentar(async () => {
                await baixarPdfPedido(pedido.id, pedido.numeroFormatado);
                return 'PDF gerado.';
              })
            }
          >
            <Icone nome="documento" /> Baixar o PDF
          </button>

          <button
            type="button"
            className="botao botao--secundario"
            disabled={ocupado}
            onClick={() => setConfirmando('whatsapp')}
          >
            <Icone nome="conversa" /> Mandar pelo WhatsApp
          </button>

          <button
            type="button"
            className="botao botao--secundario"
            disabled={ocupado}
            onClick={() => setConfirmando('email')}
          >
            <Icone nome="envelope" /> Mandar por e-mail
          </button>
        </div>
      </section>

      {/* ---------------- De onde veio ----------------

          A corrente da compra, com os números clicáveis. É a
          resposta a "por que compramos isto, deste fornecedor, por
          este preço" — e é a única tela que a fecha inteira. */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>De onde veio</h2>
          <p className="secao__descricao">
            O caminho que esta compra percorreu. Clique em qualquer número para voltar
            no tempo.
          </p>
        </div>

        <ol className="corrente">
          {pedido.solicitacoes.map((s) => (
            <li key={s.id} className="corrente__elo">
              <span className="corrente__etapa">Alguém pediu</span>
              <Link to={'/solicitacoes/' + s.id} className="corrente__numero">
                {s.numeroFormatado}
              </Link>
            </li>
          ))}

          <li className="corrente__elo">
            <span className="corrente__etapa">O mercado respondeu</span>
            <Link to={'/cotacoes/' + pedido.cotacao.id} className="corrente__numero">
              {pedido.cotacao.numeroFormatado}
            </Link>
            <span className="corrente__nota">{pedido.cotacao.titulo}</span>
          </li>

          <li className="corrente__elo corrente__elo--aqui">
            <span className="corrente__etapa">Fechamos com</span>
            <span className="corrente__numero">{fornecedor}</span>
            <span className="corrente__nota">
              {mascaraCnpj(pedido.fornecedor.cnpj)}
              {pedido.fornecedor.cidade && ' · ' + pedido.fornecedor.cidade}
              {pedido.fornecedor.uf && '/' + pedido.fornecedor.uf}
            </span>
          </li>
        </ol>
      </section>

      {/* ---------------- Itens ---------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Itens do pedido</h2>
          <p className="secao__descricao">
            Preços fechados na equalização. É contra esta lista que o almoxarife
            confere a entrega.
          </p>
        </div>

        <Cartao semEspaco>
          <TabelaArea>
            <table className="tabela">
              <caption className="apenas-leitor-tela">
                Itens do pedido {pedido.numeroFormatado}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Item</th>
                  <th scope="col">Un.</th>
                  <th scope="col" className="numero">Qtd.</th>
                  <th scope="col" className="numero">Unitário</th>
                  <th scope="col" className="numero">Total</th>
                </tr>
              </thead>
              <tbody>
                {pedido.itens.map((i) => (
                  <tr key={i.codigo + i.ordem}>
                    <th scope="row" className="mono">{i.codigo}</th>
                    <td>
                      {i.descricao}
                      {(i.marca || i.modelo) && (
                        <small className="linha-extra">
                          {[i.marca, i.modelo].filter(Boolean).join(' · ')}
                        </small>
                      )}
                      {i.normaTecnica && (
                        <small className="linha-extra">Norma: {i.normaTecnica}</small>
                      )}
                      <small className="linha-extra">
                        Obra {i.obra.codigo} — {i.obra.nome}
                      </small>
                    </td>
                    <td className="mono">{i.unidadeMedida}</td>
                    <td className="numero">{qtdBr(i.quantidade)}</td>
                    <td className="numero">{dinheiro(i.valorUnitario)}</td>
                    <td className="numero">{dinheiro(i.quantidade * i.valorUnitario)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={5}>Itens</th>
                  <td className="numero">{dinheiro(pedido.subtotal)}</td>
                </tr>
                {pedido.frete > 0 && (
                  <tr>
                    <th scope="row" colSpan={5}>Frete</th>
                    <td className="numero">{dinheiro(pedido.frete)}</td>
                  </tr>
                )}
                {pedido.outrosCustos > 0 && (
                  <tr>
                    <th scope="row" colSpan={5}>Outros custos</th>
                    <td className="numero">{dinheiro(pedido.outrosCustos)}</td>
                  </tr>
                )}
                <tr>
                  <th scope="row" colSpan={5}>Total do pedido</th>
                  <td className="numero destaque">{dinheiro(pedido.total)}</td>
                </tr>
              </tfoot>
            </table>
          </TabelaArea>
        </Cartao>

        {pedido.observacoes && (
          <Cartao titulo="Observações" className="respiro-acima">
            <p>{pedido.observacoes}</p>
          </Cartao>
        )}
      </section>

      {/* ---------------- Para quem vai ---------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Para quem vai</h2>
        </div>

        <Cartao>
          <dl className="dados">
            <div>
              <dt>Razão social</dt>
              <dd>{pedido.fornecedor.razaoSocial}</dd>
            </div>
            <div>
              <dt>CNPJ</dt>
              <dd className="mono">{mascaraCnpj(pedido.fornecedor.cnpj)}</dd>
            </div>
            {pedido.fornecedor.email && (
              <div>
                <dt>E-mail</dt>
                <dd>{pedido.fornecedor.email}</dd>
              </div>
            )}
            {pedido.fornecedor.telefone && (
              <div>
                <dt>WhatsApp</dt>
                <dd className="mono">{mascaraTelefone(parteNacional(pedido.fornecedor.telefone))}</dd>
              </div>
            )}
            <div>
              <dt>Enviado em</dt>
              <dd>{pedido.enviadoEm ? dataHoraBr(pedido.enviadoEm) : 'Ainda não enviado'}</dd>
            </div>
          </dl>
        </Cartao>
      </section>

      <ConfirmarEnvio
        aberto={confirmando !== null}
        aoFechar={() => setConfirmando(null)}
        aoConfirmar={() => {
          const canal = confirmando;
          setConfirmando(null);
          void tentar(async () => {
            const r = canal === 'whatsapp'
              ? await enviarPedidoPorWhatsApp(pedido.id)
              : await enviarPedidoPorEmail(pedido.id);
            return r.mensagem;
          });
        }}
        ocupado={ocupado}
        canal={confirmando ?? 'whatsapp'}
        oQue="pedido"
        referencia={pedido.numeroFormatado}
        modoTeste={modoTeste}
        anexo="PDF do pedido"
        destinos={[{
          nome: fornecedor,
          contato:
            confirmando === 'email'
              ? pedido.fornecedor.email
              : pedido.fornecedor.telefone
                ? telefoneCompleto(pedido.fornecedor.telefone)
                : null,
        }]}
      />
    </>
  );
}
