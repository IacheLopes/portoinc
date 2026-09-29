// ============================================================
//  Detalhe do pacote de cotação
//
//  Duas fases bem diferentes na mesma tela:
//   - RASCUNHO: escolher fornecedores e abrir
//   - ABERTO:   acompanhar quem viu e quem já respondeu
// ============================================================

// padrao-ignora: sem-estados — cada lista trata o proprio vazio no
// lugar dela: os itens sugeridos tem ramo proprio quando nao ha
// nenhum, e a lista de convidados so aparece depois que alguem foi
// convidado. Nao ha caminho que leve a uma tabela em branco.

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  buscarCotacao, fornecedoresSugeridos, convidarFornecedores, removerConvite,
  abrirCotacao, encerrarCotacao,
  ROTULO_SITUACAO_BID, COR_SITUACAO_BID,
  type Cotacao, type FornecedorSugerido,
} from '../../servicos/cotacoes';
import { dataBr, dataHoraBr } from '../../servicos/solicitacoes';
import { dinheiro, quantidade as qtdBr } from '../../servicos/cadastros';
import { enviarConvites } from '../../servicos/whatsapp';
import { convidarPorEmail } from '../../servicos/email';
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

export function DetalheCotacao() {
  const { id = '' } = useParams();

  const [dados, setDados] = useState<Cotacao | null>(null);
  const [sugeridos, setSugeridos] = useState<FornecedorSugerido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [impedimentos, setImpedimentos] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null);

  // Qual envio está esperando confirmação. Nulo: nenhum.
  const [confirmando, setConfirmando] = useState<'whatsapp' | 'email' | null>(null);
  // Se o modo de teste está ligado, o modal avisa ANTES de mandar.
  const [modoTeste, setModoTeste] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await buscarCotacao(id);
      setDados(r.cotacao);

      // Se o modo de teste está ligado, o modal de confirmação
      // avisa antes de mandar. Falhar aqui não pode derrubar a
      // tela: é enfeite informativo, não o conteúdo dela.
      try {
        const w = await buscarSituacao();
        setModoTeste(w.modoTeste);
      } catch {
        setModoTeste(true);
      }

      if (r.cotacao.situacao === 'RASCUNHO') {
        const s = await fornecedoresSugeridos(id);
        setSugeridos(s.fornecedores);
        // Já vêm pré-marcados os que ainda não foram convidados:
        // o caminho comum é convidar todos da família.
        setMarcados(s.fornecedores.filter((f) => !f.jaConvidado).map((f) => f.id));
      }
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function convidar() {
    setOcupado(true);
    setErro(null);
    try {
      const r = await convidarFornecedores(id, marcados);
      setAviso(r.convidados + ' fornecedor(es) adicionado(s) ao pacote.');
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao convidar.');
    } finally {
      setOcupado(false);
    }
  }

  async function remover(conviteId: string) {
    setOcupado(true);
    try {
      await removerConvite(id, conviteId);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao remover.');
    } finally {
      setOcupado(false);
    }
  }

  async function abrir() {
    setOcupado(true);
    setErro(null);
    setImpedimentos([]);
    try {
      const r = await abrirCotacao(id);
      setAviso(r.mensagem);
      await carregar();
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setImpedimentos((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Falha ao abrir o pacote.');
      }
    } finally {
      setOcupado(false);
    }
  }

  async function encerrar() {
    setOcupado(true);
    try {
      const r = await encerrarCotacao(id);
      setAviso(r.mensagem);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao encerrar.');
    } finally {
      setOcupado(false);
    }
  }

  async function copiarLink(token: string) {
    const url = window.location.origin + '/portal/' + token;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiado(token);
      setTimeout(() => setLinkCopiado(null), 2500);
    } catch {
      setErro('Não foi possível copiar. Copie o link manualmente: ' + url);
    }
  }

  /**
   * Manda o link do portal para cada fornecedor convidado.
   *
   * Os dois canais levam o mesmo link. Fornecedor sem o contato
   * daquele canal é pulado com aviso, não trava o envio dos outros.
   */
  async function mandarConvites(canal: 'whatsapp' | 'email') {
    setConfirmando(null);
    setOcupado(true);
    setErro(null);

    try {
      const r = canal === 'whatsapp' ? await enviarConvites(id) : await convidarPorEmail(id);
      setAviso(r.mensagem);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível enviar os convites.');
    } finally {
      setOcupado(false);
    }
  }

  if (carregando && !dados) return <Carregando mensagem="Carregando pacote..." />;
  if (erro && !dados) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  if (!dados) return null;

  const ehRascunho = dados.situacao === 'RASCUNHO';
  const aberto = dados.situacao === 'ABERTO';
  /** Ninguém no pacote ainda: não há cotação para abrir. */
  const semConvidados = dados.convidados.length === 0;

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo={dados.numeroFormatado}
          marcadores={
            <Selo tipo={COR_SITUACAO_BID[dados.situacao]}>
              {ROTULO_SITUACAO_BID[dados.situacao]}
            </Selo>
          }
          descricao={
            <>
              {dados.titulo} · comprador {dados.comprador.nome}
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
          <Indicador titulo="Itens" valor={String(dados.itens.length)} detalhe="No pacote" />
          <Indicador
            titulo="Prazo de resposta"
            valor={dataBr(dados.prazoResposta)}
            detalhe={aberto ? 'Links ativos até esta data' : 'Ainda não enviado'}
          />
          <Indicador
            titulo="Respostas"
            valor={dados.respostasRecebidas + ' de ' + dados.convidados.length}
            detalhe="Fornecedores que já cotaram"
          />
        </div>

        <div className="barra-acoes" style={{ marginTop: 'var(--esp-4)' }}>
          {/* "Abrir cotação", e não "Abrir cotação e convidar".

              Ele não convida: exige que os fornecedores JÁ estejam
              no pacote. Prometer no rótulo uma coisa que o botão não
              faz é o que levava a pessoa a clicar aqui primeiro e
              tomar uma recusa.

              E fica desligado enquanto não houver ninguém convidado,
              com o motivo escrito ao lado — recusar depois do clique
              é pior que não deixar clicar. */}
          {ehRascunho && (
            <>
              <button
                type="button"
                className="botao botao--principal"
                onClick={() => void abrir()}
                disabled={ocupado || semConvidados}
              >
                {ocupado ? 'Abrindo...' : <><Icone nome="cadeado" /> Abrir cotação</>}
              </button>

              {semConvidados && (
                <p className="campo__ajuda">
                  Convide pelo menos um fornecedor abaixo para poder abrir.
                </p>
              )}
            </>
          )}

          {aberto && (
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => void encerrar()}
              disabled={ocupado}
            >
              Encerrar cotação
            </button>
          )}

          {dados.respostasRecebidas > 0 && (
            <Link
              to={'/cotacoes/' + id + '/equalizacao'}
              className={
                'botao botao--link-cheio ' +
                (dados.situacao === 'ENCERRADO' ? 'botao--principal' : 'botao--secundario')
              }
            >
              <Icone nome="grafico" /> Equalizar e escolher
            </Link>
          )}

          {aberto && (
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => setConfirmando('whatsapp')}
              disabled={ocupado}
            >
              <Icone nome="conversa" /> Convidar pelo WhatsApp
            </button>
          )}

          {aberto && (
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => setConfirmando('email')}
              disabled={ocupado}
            >
              <Icone nome="envelope" /> Convidar por e-mail
            </button>
          )}

          <button
            type="button"
            className="botao botao--discreto"
            onClick={() => void carregar()}
            disabled={ocupado}
          >
            Atualizar
          </button>
        </div>
      </section>

      {/* ---------------- Escolha de fornecedores (rascunho) ---------------- */}
      {ehRascunho && (
        <section className="secao">
          <div className="secao__cabecalho">
            <h2>Fornecedores sugeridos</h2>
            <p className="secao__descricao">
              O sistema listou quem atende as <strong>famílias dos itens</strong> deste
              pacote. É exatamente o que o fluxo da Porto Inc. pede: um BID de elétrica
              só vai para quem vende elétrica.
            </p>
          </div>

          {sugeridos.length === 0 ? (
            <div className="aviso aviso--atencao">
              <Icone nome="alerta" className="aviso__icone" />
              <div>
                <strong>Nenhum fornecedor atende as famílias deste pacote.</strong>
                <p>
                  Vá em <Link to="/cadastros/fornecedores">Cadastros → Fornecedores</Link> e
                  marque as famílias que cada um atende.
                </p>
              </div>
            </div>
          ) : (
            <>
              <Cartao semEspaco>
                <TabelaArea>
                  <table className="tabela">
                    <caption className="apenas-leitor-tela">
                      Fornecedores que atendem as famílias do pacote
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">
                          <span className="apenas-leitor-tela">Convidar</span>
                        </th>
                        <th scope="col">Fornecedor</th>
                        <th scope="col">Atende</th>
                        <th scope="col">WhatsApp</th>
                        <th scope="col">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sugeridos.map((f) => (
                        <tr key={f.id} className={marcados.includes(f.id) ? 'linha--marcada' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              className="caixa"
                              checked={marcados.includes(f.id) || f.jaConvidado}
                              disabled={f.jaConvidado}
                              onChange={() =>
                                setMarcados((a) =>
                                  a.includes(f.id) ? a.filter((x) => x !== f.id) : [...a, f.id],
                                )
                              }
                              aria-label={'Convidar ' + f.razaoSocial}
                            />
                          </td>
                          <th scope="row">
                            {f.nomeFantasia ?? f.razaoSocial}
                            <small className="linha-extra">{f.razaoSocial}</small>
                          </th>
                          <td>
                            <span className="etiquetas">
                              {f.familias.map((x) => (
                                <span key={x.id} className="etiqueta">
                                  {x.codigo}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className="mono">
                            {f.whatsapp ?? <span className="texto-fraco">—</span>}
                          </td>
                          <td>
                            {f.jaConvidado ? (
                              <Selo tipo="sucesso">Já convidado</Selo>
                            ) : (
                              <Selo tipo="info">Disponível</Selo>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TabelaArea>
              </Cartao>

              {/* PRINCIPAL, e não secundário.

                  Este é o primeiro passo do fluxo, e estava em botão
                  secundário embaixo da tabela, enquanto o segundo
                  passo ("Abrir cotação") estava em botão principal
                  azul lá em cima. O olho vai no azul: o dono marcou
                  os dois fornecedores, clicou em cima e levou
                  "Convide pelo menos um fornecedor" — uma recusa que
                  parece mentira para quem acabou de marcar dois.

                  E o verbo agora é o mesmo do começo ao fim:
                  "Convidar" na coluna, "Convidar" no botão. Dizia
                  "Adicionar ao pacote", enquanto o botão de cima
                  dizia "e convidar" sem convidar nada. */}
              <div className="barra-acoes" style={{ marginTop: 'var(--esp-3)' }}>
                <button
                  type="button"
                  className="botao botao--principal"
                  onClick={() => void convidar()}
                  disabled={ocupado || marcados.length === 0}
                >
                  <Icone nome="enviado" />{' '}
                  {marcados.length === 0
                    ? 'Convidar fornecedores'
                    : marcados.length === 1
                      ? 'Convidar 1 fornecedor'
                      : 'Convidar ' + marcados.length + ' fornecedores'}
                </button>

                <p className="campo__ajuda">
                  {marcados.length === 0
                    ? 'Marque quem deve receber o pedido de cotação.'
                    : 'Nada é enviado agora. Eles entram no pacote, e o envio é o passo seguinte.'}
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {/* ---------------- Convidados ---------------- */}
      {dados.convidados.length > 0 && (
        <section className="secao">
          <div className="secao__cabecalho">
            <h2>Convidados</h2>
            <p className="secao__descricao">
              {aberto
                ? 'Cada um recebeu um link próprio, que vence junto com o prazo.'
                : 'Os links só passam a valer quando você abrir a cotação.'}
            </p>
          </div>

          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Fornecedores convidados</caption>
                <thead>
                  <tr>
                    <th scope="col">Fornecedor</th>
                    <th scope="col">Abriu o link</th>
                    <th scope="col">Respondeu</th>
                    <th scope="col" className="numero">Total cotado</th>
                    <th scope="col">Pagamento</th>
                    <th scope="col">
                      <span className="apenas-leitor-tela">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dados.convidados.map((c) => (
                    <tr key={c.id}>
                      <th scope="row">
                        {c.fornecedor.nomeFantasia ?? c.fornecedor.razaoSocial}
                        <small className="linha-extra mono">{c.fornecedor.cnpj}</small>
                      </th>
                      <td>
                        {c.visualizadoEm ? (
                          dataHoraBr(c.visualizadoEm)
                        ) : (
                          <span className="texto-fraco">Ainda não</span>
                        )}
                      </td>
                      <td>
                        {c.respondeu ? (
                          <Selo tipo="sucesso">{dataHoraBr(c.respondidoEm!)}</Selo>
                        ) : (
                          <Selo tipo="atencao">Aguardando</Selo>
                        )}
                      </td>
                      <td className="numero">
                        {c.totais && c.respondeu ? (
                          <>
                            {dinheiro(c.totais.total)}
                            {c.totais.itensIndisponiveis > 0 && (
                              <small className="linha-extra">
                                {c.totais.itensIndisponiveis} sem estoque
                              </small>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{c.respondeu ? c.pagamento : '—'}</td>
                      <td>
                        {aberto && c.token && (
                          <button
                            type="button"
                            className="botao botao--discreto"
                            onClick={() => void copiarLink(c.token!)}
                          >
                            {linkCopiado === c.token ? <><Icone nome="certo" /> Copiado</> : <><Icone nome="elo" /> Copiar link</>}
                          </button>
                        )}
                        {ehRascunho && (
                          <button
                            type="button"
                            className="botao botao--discreto"
                            onClick={() => void remover(c.id)}
                            disabled={ocupado}
                          >
                            Remover
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          </Cartao>

          {aberto && (
            <div className="aviso aviso--info" style={{ marginTop: 'var(--esp-3)' }}>
              <Icone nome="cadeado" className="aviso__icone" />
              <div>
                <strong>Sobre os links.</strong>
                <p>
                  Cada link é único, entra sem senha e vence em{' '}
                  {dataBr(dados.prazoResposta)}. O fornecedor enxerga apenas o próprio
                  pacote — <strong>nunca</strong> o preço ou o nome dos concorrentes.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ---------------- Itens ---------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Itens do pacote</h2>
        </div>

        <Cartao semEspaco>
          <TabelaArea>
            <table className="tabela">
              <caption className="apenas-leitor-tela">Itens a cotar</caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Item</th>
                  <th scope="col">Un.</th>
                  <th scope="col" className="numero">Qtd.</th>
                  <th scope="col">Origem</th>
                  <th scope="col" className="numero">Respostas</th>
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
                    </td>
                    <td className="mono">{i.unidadeMedida}</td>
                    <td className="numero">{qtdBr(i.quantidade)}</td>
                    <td>
                      <span className="mono">{i.origem.solicitacao}</span>
                      <small className="linha-extra">{i.origem.obra.codigo}</small>
                    </td>
                    <td className="numero">{i.respostas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaArea>
        </Cartao>
      </section>

      {/* A confirmação vive fora das seções: ela interrompe a tela
          inteira, não um pedaço dela. */}
      <ConfirmarEnvio
        aberto={confirmando !== null}
        aoFechar={() => setConfirmando(null)}
        aoConfirmar={() => confirmando && void mandarConvites(confirmando)}
        ocupado={ocupado}
        canal={confirmando ?? 'whatsapp'}
        oQue="convite"
        referencia={dados.numeroFormatado}
        modoTeste={modoTeste}
        destinos={dados.convidados.map((c) => ({
          nome: c.fornecedor.nomeFantasia ?? c.fornecedor.razaoSocial,
          contato:
            confirmando === 'email'
              ? c.fornecedor.email
              : c.fornecedor.whatsapp
                ? telefoneCompleto(c.fornecedor.whatsapp)
                : null,
        }))}
      />
    </>
  );
}
