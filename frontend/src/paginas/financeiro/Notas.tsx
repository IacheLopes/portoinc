// ============================================================
//  Notas fiscais
//
//  Dois caminhos para a mesma coisa:
//
//    1. Arrastar o XML que o fornecedor mandou por e-mail
//    2. Digitar os dados da nota
//
//  Os dois terminam no mesmo lançamento. Quando a SEFAZ for
//  ligada, ela vira só um terceiro caminho.
// ============================================================

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarNotas, listarPedidosParaNota, lerXml, lancarNota, gerarTitulos, cancelarNota,
  baixarEspelhoDaNota, listarArquivosDaNota, guardarArquivoDaNota,
  baixarArquivoGuardado, removerArquivoDaNota, lerArquivoEmBase64,
  ROTULO_NOTA, COR_NOTA, ROTULO_TIPO_ARQUIVO,
  type Nota, type PedidoParaNota, type ItemDaNota, type ArquivoDaNota,
} from '../../servicos/fiscal';
import { dinheiro, quantidade as qtdBr } from '../../servicos/cadastros';
import { dataBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, Selecao } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Modal } from '../../componentes/Modal';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NotasFiscais() {
  const { pode } = useAutenticacao();
  const podeGerenciar = pode('financeiro.gerenciar');
  const arquivo = useRef<HTMLInputElement>(null);

  const [notas, setNotas] = useState<Nota[]>([]);
  const [pedidos, setPedidos] = useState<PedidoParaNota[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Qual nota está esperando confirmação para ser cancelada.
  // Null = nenhuma, e o modal fica fechado.
  const [paraCancelar, setParaCancelar] = useState<Nota | null>(null);

  // Arquivamento: qual nota está com a gaveta aberta e o que há nela.
  const [gaveta, setGaveta] = useState<string | null>(null);
  const [arquivosDaNota, setArquivosDaNota] = useState<ArquivoDaNota[]>([]);
  const [carregandoArquivos, setCarregandoArquivos] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const escolherArquivo = useRef<HTMLInputElement>(null);

  // Formulário de lançamento.
  const [aberto, setAberto] = useState(false);
  const [numero, setNumero] = useState('');
  const [serie, setSerie] = useState('1');
  const [chave, setChave] = useState('');
  const [pedidoId, setPedidoId] = useState('');
  const [emitidaEm, setEmitidaEm] = useState(hojeIso());
  const [valorTotal, setValorTotal] = useState('');
  const [valorFrete, setValorFrete] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemDaNota[]>([]);
  const [doXml, setDoXml] = useState(false);
  /** Fornecedor identificado pelo CNPJ da nota, quando veio do XML. */
  const [fornecedorDoXml, setFornecedorDoXml] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [n, p] = await Promise.all([
        listarNotas(),
        podeGerenciar ? listarPedidosParaNota() : Promise.resolve({ pedidos: [] }),
      ]);
      setNotas(n.notas);
      setPedidos(p.pedidos);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar as notas.');
    } finally {
      setCarregando(false);
    }
  }, [podeGerenciar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function limparFormulario() {
    setNumero('');
    setSerie('1');
    setChave('');
    setPedidoId('');
    setEmitidaEm(hojeIso());
    setValorTotal('');
    setValorFrete('');
    setObservacoes('');
    setItens([]);
    setDoXml(false);
    setFornecedorDoXml(null);
  }

  /** Lê o arquivo XML e preenche o formulário. */
  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const escolhido = e.target.files?.[0];
    if (!escolhido) return;

    setOcupado(true);
    setErro(null);
    setAviso(null);

    try {
      const texto = await escolhido.text();
      const r = await lerXml(texto);

      setAberto(true);
      setDoXml(true);
      setNumero(r.nota.numero);
      setSerie(r.nota.serie);
      setChave(r.nota.chaveAcesso ?? '');
      setValorTotal(String(r.nota.valorTotal));
      setValorFrete(r.nota.valorFrete ? String(r.nota.valorFrete) : '');
      setItens(r.nota.itens);

      if (r.nota.emitidaEm) setEmitidaEm(r.nota.emitidaEm.slice(0, 10));

      // O CNPJ da nota diz de quem ela é: a lista de pedidos passa a
      // mostrar só os desse fornecedor. Menos chance de vincular a
      // nota ao pedido errado.
      setFornecedorDoXml(r.fornecedor?.id ?? null);

      // Fornecedor com um pedido só esperando nota: já escolhe.
      if (r.pedidosDoFornecedor.length === 1) setPedidoId(r.pedidosDoFornecedor[0].id);

      if (r.aviso) setErro(r.aviso);
      else if (r.chaveValida === false)
        setErro('Atenção: a chave de acesso do arquivo não passa na conferência dos 44 dígitos.');
      else setAviso('XML lido: confira os dados e escolha o pedido antes de lançar.');
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Não consegui ler esse arquivo.');
    } finally {
      setOcupado(false);
      if (arquivo.current) arquivo.current.value = '';
    }
  }

  async function lancar() {
    const pedido = pedidos.find((p) => p.id === pedidoId);

    if (!pedido) {
      setErro('Escolha o pedido de compra a que esta nota se refere.');
      return;
    }

    const total = Number(valorTotal.replace(',', '.'));
    if (!Number.isFinite(total) || total <= 0) {
      setErro('Informe o valor total da nota.');
      return;
    }

    setOcupado(true);
    setErro(null);

    try {
      const r = await lancarNota({
        numero: numero.trim(),
        serie: serie.trim() || '1',
        chaveAcesso: chave.replace(/\D/g, '') || undefined,
        fornecedorId: pedido.fornecedorId,
        pedidoId: pedido.id,
        emitidaEm: new Date(emitidaEm + 'T12:00:00').toISOString(),
        valorTotal: total,
        valorFrete: valorFrete ? Number(valorFrete.replace(',', '.')) : undefined,
        observacoes: observacoes.trim() || undefined,
        doXml,
        itens: itens.map((i) => ({
          codigo: i.codigo,
          descricao: i.descricao,
          gtin: i.gtin,
          unidade: i.unidade,
          quantidade: i.quantidade,
          valorUnitario: i.valorUnitario,
          valorTotal: i.valorTotal,
        })),
      });

      setAviso(r.mensagem);
      setAberto(false);
      limparFormulario();
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível lançar a nota.');
    } finally {
      setOcupado(false);
    }
  }

  async function gerar(nota: Nota) {
    setOcupado(true);
    setErro(null);

    try {
      const r = await gerarTitulos(nota.id);
      setAviso(r.mensagem);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível gerar as parcelas.');
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar(nota: Nota) {
    setOcupado(true);
    setErro(null);

    try {
      const r = await cancelarNota(nota.id);
      setAviso(r.mensagem);
      setParaCancelar(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível cancelar.');
    } finally {
      setOcupado(false);
    }
  }

  /** Abre (ou fecha) a gaveta de arquivos de uma nota. */
  async function abrirGaveta(id: string) {
    if (gaveta === id) {
      setGaveta(null);
      return;
    }

    setGaveta(id);
    setArquivosDaNota([]);
    setCarregandoArquivos(true);

    try {
      const r = await listarArquivosDaNota(id);
      setArquivosDaNota(r.arquivos);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao ler os arquivos da nota.');
    } finally {
      setCarregandoArquivos(false);
    }
  }

  async function baixarEspelho(n: Nota) {
    setBaixando(n.id);
    setErro(null);
    try {
      await baixarEspelhoDaNota(n.id, n.numero, n.serie);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível gerar o PDF da nota.');
    } finally {
      setBaixando(null);
    }
  }

  async function guardar(notaId: string, escolhido: File) {
    setOcupado(true);
    setErro(null);
    setAviso(null);

    try {
      const dados = await lerArquivoEmBase64(escolhido);
      const r = await guardarArquivoDaNota(notaId, dados);
      setAviso(r.mensagem);

      const lista = await listarArquivosDaNota(notaId);
      setArquivosDaNota(lista.arquivos);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível guardar o arquivo.');
    } finally {
      setOcupado(false);
      if (escolherArquivo.current) escolherArquivo.current.value = '';
    }
  }

  async function tirarDoArquivo(notaId: string, arquivoId: string) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await removerArquivoDaNota(arquivoId);
      setAviso(r.mensagem);

      const lista = await listarArquivosDaNota(notaId);
      setArquivosDaNota(lista.arquivos);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível remover o arquivo.');
    } finally {
      setOcupado(false);
    }
  }

  if (carregando && notas.length === 0) return <Carregando mensagem="Carregando notas..." />;
  if (erro && notas.length === 0 && !aberto) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  const pedidoEscolhido = pedidos.find((p) => p.id === pedidoId);

  const pedidosVisiveis = fornecedorDoXml
    ? pedidos.filter((p) => p.fornecedorId === fornecedorDoXml)
    : pedidos;

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Notas fiscais"
          descricao={
            <>
              A nota liga o pedido de compra ao dinheiro que vai sair. É dela que nascem as
            parcelas a pagar.
            </>
          }
        />

        {podeGerenciar && (
          <div className="barra-acoes">
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => {
                limparFormulario();
                setAberto(true);
              }}
            >
              Lançar nota
            </button>

            <label className="botao botao--secundario rotulo-arquivo">
              Importar XML
              <input
                ref={arquivo}
                type="file"
                accept=".xml,text/xml,application/xml"
                onChange={(e) => void aoEscolherArquivo(e)}
                className="apenas-leitor-tela"
              />
            </label>

            <Link to="/financeiro" className="botao botao--discreto">
              Ver contas a pagar
            </Link>
          </div>
        )}

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

      {podeGerenciar && (
        <Modal
          aberto={aberto}
          aoFechar={() => {
            setAberto(false);
            limparFormulario();
          }}
          titulo={doXml ? 'Conferir a nota lida do XML' : 'Lançar nota'}
          temAlteracao={Boolean(numero || valorTotal || pedidoId)}
          acoes={
            <>
              <button
                type="button"
                className="botao botao--discreto"
                onClick={() => {
                  setAberto(false);
                  limparFormulario();
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="botao botao--principal"
                onClick={() => void lancar()}
                disabled={ocupado}
              >
                {ocupado ? 'Lançando...' : 'Lançar nota'}
              </button>
            </>
          }
        >
          <div>
            <div className="secao__cabecalho">
              <p className="secao__descricao">
                {doXml
                  ? 'Os dados vieram do arquivo. Confira e escolha o pedido.'
                  : 'Digite os dados da nota que o fornecedor entregou.'}
              </p>
            </div>

            <Selecao
              rotulo="Pedido de compra"
              valor={pedidoId}
              aoMudar={setPedidoId}
              opcoes={pedidosVisiveis.map((p) => ({
                valor: p.id,
                rotulo:
                  p.numeroFormatado + ' · ' + p.fornecedor + ' · falta ' + dinheiro(p.falta),
              }))}
              vazio="Escolha o pedido"
              obrigatorio
              ajuda={
                pedidoEscolhido
                  ? 'Total do pedido ' +
                    dinheiro(pedidoEscolhido.valorTotal) +
                    ' · já lançado ' +
                    dinheiro(pedidoEscolhido.jaLancado) +
                    ' · pagamento: ' +
                    pedidoEscolhido.pagamento
                  : fornecedorDoXml
                    ? 'Mostrando só os pedidos do fornecedor que emitiu esta nota.'
                    : 'É por aqui que o sistema confere se a nota bate com a compra.'
              }
            />

            <div className="formulario__linha">
              <Campo rotulo="Número da nota" valor={numero} aoMudar={setNumero} obrigatorio />
              <Campo rotulo="Série" valor={serie} aoMudar={setSerie} semMarcaOpcional />
              <Campo
                rotulo="Emitida em"
                valor={emitidaEm}
                aoMudar={setEmitidaEm}
                tipo="date"
                obrigatorio
              />
            </div>

            <div className="formulario__linha">
              <Campo
                rotulo="Valor total"
                valor={valorTotal}
                aoMudar={setValorTotal}
                obrigatorio
                ajuda="O valor final da nota, com frete e impostos."
              />
              <Campo rotulo="Frete" valor={valorFrete} aoMudar={setValorFrete} />
            </div>

            <Campo
              rotulo="Chave de acesso"
              valor={chave}
              aoMudar={setChave}
              maximo={60}
              ajuda="Os 44 dígitos do DANFE. O sistema confere o dígito verificador, o CNPJ e o número da nota."
            />

            <Campo
              rotulo="Observações"
              valor={observacoes}
              aoMudar={setObservacoes}
              maximo={1000}
            />

            {itens.length > 0 && (
              <div className="tabela-area" style={{ marginTop: 'var(--esp-3)' }}>
                <table className="tabela">
                  <caption className="apenas-leitor-tela">Itens lidos do XML</caption>
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col" className="numero">Qtd.</th>
                      <th scope="col" className="numero">Unitário</th>
                      <th scope="col" className="numero">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((i, indice) => (
                      <tr key={indice}>
                        <th scope="row">
                          {i.codigo && <span className="mono">{i.codigo}</span>} {i.descricao}
                        </th>
                        <td className="numero">
                          {qtdBr(i.quantidade)} {i.unidade ?? ''}
                        </td>
                        <td className="numero">{dinheiro(i.valorUnitario)}</td>
                        <td className="numero">{dinheiro(i.valorTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </Modal>
      )}

      <section className="secao">
        {notas.length === 0 ? (
          <Vazio
            titulo="Nenhuma nota lançada"
            descricao="Importe o XML que o fornecedor mandou ou digite os dados da nota."
          />
        ) : (
          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Notas fiscais lançadas</caption>
                <thead>
                  <tr>
                    <th scope="col">Nota</th>
                    <th scope="col">Fornecedor</th>
                    <th scope="col">Pedido</th>
                    <th scope="col" className="numero">Valor</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Parcelas</th>
                    <th scope="col">Arquivo</th>
                    {podeGerenciar && (
                      <th scope="col">
                        <span className="apenas-leitor-tela">Ações</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {notas.map((n) => (
                    <Fragment key={n.id}>
                    <tr>
                      <th scope="row" className="mono">
                        {n.numero}/{n.serie}
                        <small className="linha-extra">
                          {dataBr(n.emitidaEm)}
                          {n.doXml ? ' · do XML' : ''}
                        </small>
                      </th>
                      <td>{n.fornecedor}</td>
                      <td className="mono">{n.pedido ?? '—'}</td>
                      <td className="numero destaque">{dinheiro(n.valorTotal)}</td>
                      <td>
                        <Selo tipo={COR_NOTA[n.situacao]}>{ROTULO_NOTA[n.situacao]}</Selo>
                        {n.divergencias.length > 0 && (
                          <ul className="campo__erro-lista">
                            {n.divergencias.map((d) => (
                              <li key={d}>{d}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="celula-texto">
                        {n.temTitulos ? (
                          <>
                            {n.quantidadeTitulos}x
                            <small className="linha-extra">{n.condicao}</small>
                          </>
                        ) : (
                          <small>não geradas</small>
                        )}
                      </td>
                      <td className="celula-acoes">
                        <div className="formulario__acoes">
                          <button
                            type="button"
                            className="botao botao--discreto"
                            onClick={() => void baixarEspelho(n)}
                            disabled={baixando === n.id}
                          >
                            {baixando === n.id ? 'Gerando...' : <><Icone nome="documento" /> PDF</>}
                          </button>

                          <button
                            type="button"
                            className="botao botao--discreto"
                            onClick={() => void abrirGaveta(n.id)}
                            aria-expanded={gaveta === n.id}
                            aria-controls={'arquivos-' + n.id}
                          >
                            <Icone nome="anexo" /> Arquivos
                          </button>
                        </div>
                      </td>

                      {podeGerenciar && (
                        <td className="celula-acoes">
                          <div className="formulario__acoes">
                            {!n.temTitulos && n.situacao !== 'CANCELADA' && (
                              <button
                                type="button"
                                className="botao botao--secundario"
                                onClick={() => void gerar(n)}
                                disabled={ocupado}
                              >
                                Gerar parcelas
                              </button>
                            )}
                            {n.situacao !== 'CANCELADA' && (
                              <button
                                type="button"
                                className="botao botao--discreto"
                                onClick={() => setParaCancelar(n)}
                                disabled={ocupado}
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* A gaveta abre embaixo da nota, sem tirar
                        ninguém da tela nem abrir janela por cima. */}
                    {gaveta === n.id && (
                      <tr id={'arquivos-' + n.id} className="linha-gaveta">
                        <td colSpan={podeGerenciar ? 8 : 7}>
                          {carregandoArquivos ? (
                            <p className="texto-fraco">Lendo os arquivos...</p>
                          ) : (
                            <>
                              {arquivosDaNota.length === 0 ? (
                                <p className="texto-fraco">
                                  Nada arquivado nesta nota ainda. O PDF ao lado é gerado a
                                  partir do que está lançado; aqui fica o arquivo que o
                                  fornecedor mandou.
                                </p>
                              ) : (
                                <ul className="lista-arquivos">
                                  {arquivosDaNota.map((a) => (
                                    <li key={a.id}>
                                      <span aria-hidden="true">
                                        <Icone nome={a.tipo === 'XML_NFE' ? 'pagina' : 'documento'} />
                                      </span>
                                      <span className="lista-arquivos__nome">
                                        <strong>{a.nomeOriginal}</strong>
                                        <small>
                                          {ROTULO_TIPO_ARQUIVO[a.tipo]} · {a.tamanhoLegivel} ·
                                          guardado por {a.enviadoPor}
                                        </small>
                                      </span>
                                      <button
                                        type="button"
                                        className="botao botao--discreto"
                                        onClick={() =>
                                          void baixarArquivoGuardado(a.id, a.nomeOriginal)
                                        }
                                      >
                                        Baixar
                                      </button>
                                      {podeGerenciar && (
                                        <button
                                          type="button"
                                          className="botao botao--discreto"
                                          onClick={() => void tirarDoArquivo(n.id, a.id)}
                                          disabled={ocupado}
                                        >
                                          Remover
                                        </button>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}

                              {podeGerenciar && (
                                <div className="campo">
                                  <label
                                    className="campo__rotulo"
                                    htmlFor={'subir-' + n.id}
                                  >
                                    Guardar o PDF ou o XML que o fornecedor mandou
                                  </label>
                                  <input
                                    id={'subir-' + n.id}
                                    ref={escolherArquivo}
                                    type="file"
                                    className="campo__entrada"
                                    accept=".pdf,.xml,application/pdf,text/xml"
                                    disabled={ocupado}
                                    onChange={(e) => {
                                      const escolhido = e.target.files?.[0];
                                      if (escolhido) void guardar(n.id, escolhido);
                                    }}
                                  />
                                  <p className="campo__ajuda">
                                    Só PDF e XML, até 5 MB. O arquivo fica guardado com a
                                    nota e pode ser baixado depois.
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          </Cartao>
        )}

        <Modal
          aberto={paraCancelar !== null}
          aoFechar={() => setParaCancelar(null)}
          titulo={'Cancelar a nota ' + (paraCancelar?.numero ?? '') + '?'}
          descricao="Cancelar uma nota fiscal não se desfaz. Ela some das contas a pagar e deixa de contar no orçamento da obra."
          acoes={
            <>
              <button
                type="button"
                className="botao botao--secundario"
                onClick={() => setParaCancelar(null)}
                disabled={ocupado}
              >
                Voltar sem cancelar
              </button>
              <button
                type="button"
                className="botao botao--perigo"
                onClick={() => paraCancelar && void cancelar(paraCancelar)}
                disabled={ocupado}
              >
                {ocupado ? 'Cancelando...' : 'Sim, cancelar a nota'}
              </button>
            </>
          }
        >
          <p>
            Fornecedor: <strong>{paraCancelar?.fornecedor}</strong>
            <br />
            Valor: <strong>{paraCancelar ? dinheiro(paraCancelar.valorTotal) : ''}</strong>
          </p>
        </Modal>

        <div className="aviso aviso--info" style={{ marginTop: 'var(--esp-4)' }}>
          <Icone nome="dica" className="aviso__icone" />
          <div>
            <strong>A nota se confere sozinha.</strong>
            <p>
              A chave de 44 dígitos carrega dentro dela o CNPJ de quem emitiu e o número da nota.
              O sistema abre a chave e compara com o que foi digitado e com o pedido — sem
              precisar consultar a SEFAZ. Quando a SEFAZ for ligada, ela vira só mais uma forma
              de trazer os mesmos dados.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
