// ============================================================
//  Conferência da entrega
//
//  A tela que o almoxarife usa com o caminhão parado no portão.
//  Precisa ser rápida: pouco clique, números grandes e o saldo
//  sempre à vista.
//
//  Regra que orientou o desenho: o sistema nunca "chuta" que
//  chegou tudo. Quem diz o que entrou é a pessoa que contou.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  buscarPedidoParaConferir, registrarRecebimento, lerQuantidade,
  ROTULO_SITUACAO_PEDIDO, COR_SITUACAO_PEDIDO,
  type PedidoParaConferir, type SituacaoItemRecebido,
} from '../../servicos/recebimentos';
import { quantidade as qtdBr } from '../../servicos/cadastros';
import { dataBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Campo, Selecao } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';

/** O que o almoxarife preencheu em cada linha da tabela. */
interface Linha {
  recebida: string;
  devolvida: string;
  situacao: SituacaoItemRecebido;
  motivo: string;
}

const LINHA_VAZIA: Linha = { recebida: '', devolvida: '', situacao: 'CONFORME', motivo: '' };

const OPCOES_SITUACAO = [
  { valor: 'CONFORME', rotulo: 'Chegou certo' },
  { valor: 'COM_RESSALVA', rotulo: 'Aceito com ressalva' },
  { valor: 'DEVOLVIDO', rotulo: 'Devolvido' },
];

export function ConferirRecebimento() {
  const { numero = '' } = useParams();
  const campoCodigo = useRef<HTMLInputElement>(null);

  const [dados, setDados] = useState<PedidoParaConferir | null>(null);
  const [linhas, setLinhas] = useState<Record<string, Linha>>({});
  const [almoxarifadoId, setAlmoxarifadoId] = useState('');
  const [notaFiscal, setNotaFiscal] = useState('');
  const [serie, setSerie] = useState('');
  const [transportadora, setTransportadora] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [codigo, setCodigo] = useState('');
  const [destacado, setDestacado] = useState<string | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [impedimentos, setImpedimentos] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await buscarPedidoParaConferir(numero);
      setDados(r);
      setAlmoxarifadoId((atual) => atual || r.almoxarifados[0]?.id || '');

      const novas: Record<string, Linha> = {};
      for (const item of r.itens) novas[item.pedidoItemId] = { ...LINHA_VAZIA };
      setLinhas(novas);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao abrir o pedido.');
    } finally {
      setCarregando(false);
    }
  }, [numero]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function mudar(id: string, mudanca: Partial<Linha>) {
    setLinhas((a) => ({ ...a, [id]: { ...(a[id] ?? LINHA_VAZIA), ...mudanca } }));
  }

  /** Bipou ou digitou um código: acha a linha e joga o saldo nela. */
  function procurarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (!dados) return;

    const busca = codigo.trim();
    if (busca === '') return;

    const semZeros = busca.replace(/^0+/, '');
    const item = dados.itens.find(
      (i) =>
        (i.gtin && i.gtin === busca) ||
        i.codigo.toUpperCase() === busca.toUpperCase() ||
        i.codigo.replace(/^0+/, '').toUpperCase() === semZeros.toUpperCase(),
    );

    if (!item) {
      setErro('Esse código não está neste pedido. Confira se o material é do pedido certo.');
      setCodigo('');
      return;
    }

    if (item.concluido) {
      setErro(item.codigo + ' já foi recebido por inteiro.');
      setCodigo('');
      return;
    }

    setErro(null);
    mudar(item.pedidoItemId, { recebida: String(item.saldo) });
    setDestacado(item.pedidoItemId);
    setCodigo('');
    campoCodigo.current?.focus();
  }

  function receberTudo() {
    if (!dados) return;

    const novas: Record<string, Linha> = { ...linhas };
    for (const item of dados.itens) {
      if (item.concluido) continue;
      novas[item.pedidoItemId] = {
        ...(novas[item.pedidoItemId] ?? LINHA_VAZIA),
        recebida: String(item.saldo),
      };
    }
    setLinhas(novas);
  }

  function limpar() {
    if (!dados) return;
    const novas: Record<string, Linha> = {};
    for (const item of dados.itens) novas[item.pedidoItemId] = { ...LINHA_VAZIA };
    setLinhas(novas);
    setDestacado(null);
  }

  async function registrar() {
    if (!dados) return;

    setOcupado(true);
    setErro(null);
    setImpedimentos([]);

    try {
      const itens = dados.itens
        .map((item) => {
          const l = linhas[item.pedidoItemId] ?? LINHA_VAZIA;
          return {
            pedidoItemId: item.pedidoItemId,
            quantidadeRecebida: lerQuantidade(l.recebida),
            quantidadeDevolvida: lerQuantidade(l.devolvida),
            situacao: l.situacao,
            motivo: l.motivo.trim() || undefined,
          };
        })
        .filter((l) => l.quantidadeRecebida > 0 || l.quantidadeDevolvida > 0);

      if (itens.length === 0) {
        setErro('Informe o que chegou em pelo menos um item.');
        return;
      }

      if (itens.some((l) => Number.isNaN(l.quantidadeRecebida) || Number.isNaN(l.quantidadeDevolvida))) {
        setErro('Tem quantidade escrita de um jeito que não dá para entender. Use só números.');
        return;
      }

      const r = await registrarRecebimento({
        pedidoId: dados.pedido.id,
        almoxarifadoId,
        notaFiscal: notaFiscal.trim() || undefined,
        serieNotaFiscal: serie.trim() || undefined,
        transportadora: transportadora.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
        itens,
      });

      setAviso(r.recebimento.numeroFormatado + ' registrado. ' + r.mensagem);
      setNotaFiscal('');
      setSerie('');
      setTransportadora('');
      setObservacoes('');
      await carregar();
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setImpedimentos((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Falha ao registrar o recebimento.');
      }
    } finally {
      setOcupado(false);
    }
  }

  if (carregando && !dados) return <Carregando mensagem="Abrindo o pedido..." />;

  if (erro && !dados) {
    return (
      <section className="secao">
        <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />
      </section>
    );
  }

  if (!dados) return null;

  const { pedido, itens } = dados;

  // Quanto o almoxarife já marcou nesta conferência.
  const marcados = itens.filter((i) => {
    const l = linhas[i.pedidoItemId];
    return l && (lerQuantidade(l.recebida) > 0 || lerQuantidade(l.devolvida) > 0);
  }).length;

  return (
    <>
      <section className="secao">
        <nav className="migalhas" aria-label="Você está em">
          <Link to="/recebimento">Recebimento</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{pedido.numeroFormatado}</span>
        </nav>

        <CabecalhoDePagina
          titulo={'Conferir ' + pedido.numeroFormatado}
          marcadores={
            <Selo tipo={COR_SITUACAO_PEDIDO[pedido.situacao]}>
              {ROTULO_SITUACAO_PEDIDO[pedido.situacao]}
            </Selo>
          }
          descricao={
            <>
              {pedido.fornecedor} · {pedido.origem}
            {pedido.obra ? ' · ' + pedido.obra : ''}
            </>
          }
        />

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

        {dados.tudoRecebido ? (
          <Vazio
            titulo="Este pedido já foi recebido por inteiro"
            descricao="Não há saldo para conferir. Se chegou material a mais, fale com o comprador."
          />
        ) : (
          <form className="busca-pedido" onSubmit={procurarCodigo}>
            <div className="campo">
              <label className="campo__rotulo" htmlFor="codigo-item">
                Bipar ou digitar o código do material
              </label>
              <input
                id="codigo-item"
                ref={campoCodigo}
                className="campo__entrada campo__entrada--destaque"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Código de barras ou COD PORTO"
                autoComplete="off"
              />
              <p className="campo__ajuda">
                O sistema acha a linha e já preenche o saldo. Depois é só corrigir a
                quantidade, se tiver vindo menos.
              </p>
            </div>

            <button type="submit" className="botao botao--secundario">
              Localizar
            </button>
          </form>
        )}
      </section>

      <section className="secao">
        <div className="secao__cabecalho">
          <h2>O que chegou</h2>
          <p className="secao__descricao">
            <strong>Saldo</strong> é o que o fornecedor ainda deve. Deixe em branco o que
            não veio nesta entrega.
          </p>
        </div>

        <Cartao semEspaco>
          <TabelaArea>
            <table className="tabela tabela--conferencia">
              <caption className="apenas-leitor-tela">
                Itens do pedido, com saldo e quantidade recebida
              </caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="numero">Pedido</th>
                  <th scope="col" className="numero">Já recebido</th>
                  <th scope="col" className="numero">Saldo</th>
                  <th scope="col" className="numero">Recebido agora</th>
                  <th scope="col" className="numero">Devolvido</th>
                  <th scope="col">Como chegou</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => {
                  const l = linhas[item.pedidoItemId] ?? LINHA_VAZIA;
                  const precisaMotivo = l.situacao !== 'CONFORME';

                  return (
                    <tr
                      key={item.pedidoItemId}
                      className={
                        (item.concluido ? 'linha-concluida ' : '') +
                        (destacado === item.pedidoItemId ? 'linha-destacada' : '')
                      }
                    >
                      <th scope="row">
                        <span className="mono">{item.codigo}</span> {item.descricao}
                        <small className="linha-extra">
                          {item.marca ? 'Marca: ' + item.marca + ' · ' : ''}
                          {item.normaTecnica ? item.normaTecnica + ' · ' : ''}
                          {item.unidadeMedida}
                        </small>
                      </th>
                      <td className="numero">{qtdBr(item.quantidadePedida)}</td>
                      <td className="numero">{qtdBr(item.quantidadeJaRecebida)}</td>
                      <td className="numero destaque">
                        {item.concluido ? (
                          <Selo tipo="sucesso">Completo</Selo>
                        ) : (
                          qtdBr(item.saldo)
                        )}
                      </td>
                      <td className="numero">
                        <input
                          className="campo__entrada campo__entrada--celula"
                          type="text"
                          inputMode="decimal"
                          aria-label={'Quantidade recebida de ' + item.descricao}
                          value={l.recebida}
                          onChange={(e) => mudar(item.pedidoItemId, { recebida: e.target.value })}
                          disabled={item.concluido || ocupado}
                        />
                      </td>
                      <td className="numero">
                        <input
                          className="campo__entrada campo__entrada--celula"
                          type="text"
                          inputMode="decimal"
                          aria-label={'Quantidade devolvida de ' + item.descricao}
                          value={l.devolvida}
                          onChange={(e) => mudar(item.pedidoItemId, { devolvida: e.target.value })}
                          disabled={item.concluido || ocupado}
                        />
                      </td>
                      <td>
                        <select
                          className="campo__entrada"
                          aria-label={'Como chegou o item ' + item.descricao}
                          value={l.situacao}
                          onChange={(e) =>
                            mudar(item.pedidoItemId, {
                              situacao: e.target.value as SituacaoItemRecebido,
                            })
                          }
                          disabled={item.concluido || ocupado}
                        >
                          {OPCOES_SITUACAO.map((o) => (
                            <option key={o.valor} value={o.valor}>
                              {o.rotulo}
                            </option>
                          ))}
                        </select>

                        {precisaMotivo && (
                          <input
                            className="campo__entrada linha-motivo"
                            type="text"
                            aria-label={'Motivo da ocorrência em ' + item.descricao}
                            placeholder="Escreva o que houve"
                            value={l.motivo}
                            onChange={(e) => mudar(item.pedidoItemId, { motivo: e.target.value })}
                            disabled={ocupado}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TabelaArea>

          <div className="rodape-da-tabela">
            <p>
              <strong>{marcados}</strong> {marcados === 1 ? 'item marcado' : 'itens marcados'} nesta
              conferência.
            </p>
            <div className="formulario__acoes">
              <button
                type="button"
                className="botao botao--secundario"
                onClick={receberTudo}
                disabled={dados.tudoRecebido || ocupado}
              >
                Recebi tudo que falta
              </button>
              <button
                type="button"
                className="botao botao--discreto"
                onClick={limpar}
                disabled={ocupado}
              >
                Limpar
              </button>
            </div>
          </div>
        </Cartao>
      </section>

      {!dados.tudoRecebido && (
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Documento da entrega</h2>
          <p className="secao__descricao">
            A nota fiscal liga esta entrega à conta a pagar, na Etapa 9. Se ainda não veio,
            pode deixar em branco.
          </p>
        </div>

        <Cartao>
          <div className="formulario__linha">
            <Selecao
              rotulo="Entrou no almoxarifado"
              valor={almoxarifadoId}
              aoMudar={setAlmoxarifadoId}
              opcoes={dados.almoxarifados.map((a) => ({
                valor: a.id,
                rotulo: a.nome + (a.central ? ' (central)' : ''),
              }))}
              obrigatorio
            />
            <Campo rotulo="Nota fiscal" valor={notaFiscal} aoMudar={setNotaFiscal} maximo={60} />
            <Campo rotulo="Série" valor={serie} aoMudar={setSerie} maximo={10} />
            <Campo
              rotulo="Transportadora"
              valor={transportadora}
              aoMudar={setTransportadora}
              maximo={120}
            />
          </div>

          <Campo
            rotulo="Observações da entrega"
            valor={observacoes}
            aoMudar={setObservacoes}
            maximo={1000}
            ajuda="Ex.: motorista não esperou a conferência completa."
          />

          <div className="formulario__acoes formulario__acoes--fim">
            <Link to="/recebimento" className="botao botao--discreto">
              Voltar
            </Link>
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => void registrar()}
              disabled={ocupado || dados.tudoRecebido}
            >
              {ocupado ? 'Registrando...' : 'Registrar recebimento'}
            </button>
          </div>
        </Cartao>

        <div className="aviso aviso--info" style={{ marginTop: 'var(--esp-4)' }}>
          <span className="aviso__icone" aria-hidden="true">💡</span>
          <div>
            <strong>Material devolvido continua em aberto.</strong>
            <p>
              Se chegaram 10 sacos e 3 voltaram no caminhão, o sistema registra 7 de
              entrada e mantém 3 no saldo — o fornecedor continua devendo. O pedido só
              fecha quando tudo tiver chegado de verdade.
            </p>
          </div>
        </div>
      </section>
      )}

      {dados.tudoRecebido && (
        <section className="secao">
          <div className="formulario__acoes">
            <Link to="/recebimento" className="botao botao--principal">
              Voltar para o recebimento
            </Link>
          </div>
        </section>
      )}

      <p className="rodape-info">
        Pedido feito por {pedido.comprador} em {dataBr(pedido.criadoEm)}
        {pedido.enviadoEm ? ' · enviado ao fornecedor em ' + dataBr(pedido.enviadoEm) : ''}
      </p>
    </>
  );
}
