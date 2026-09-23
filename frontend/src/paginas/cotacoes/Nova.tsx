// ============================================================
//  Montar um pacote de cotação
//
//  O comprador escolhe entre os itens APROVADOS que ainda não
//  entraram em nenhum pacote. Agrupá-los por família é o que
//  faz a cotação valer a pena: um pedido só, vários fornecedores.
// ============================================================

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  listarItensDisponiveis, criarCotacao, type ItemDisponivel,
} from '../../servicos/cotacoes';
import { dataBr } from '../../servicos/solicitacoes';
import { dinheiro, quantidade as qtdBr } from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { Campo, ErroFormulario } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';

/** Daqui a N dias, no formato que o campo de data aceita. */
function daquiADias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function NovaCotacao() {
  const navegar = useNavigate();

  const [itens, setItens] = useState<ItemDisponivel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [titulo, setTitulo] = useState('');
  const [prazo, setPrazo] = useState(daquiADias(7));
  const [observacoes, setObservacoes] = useState('');
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [familiaFiltro, setFamiliaFiltro] = useState('');

  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      setItens((await listarItensDisponiveis()).itens);
    } catch (e) {
      setErroCarga(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const familias = useMemo(() => {
    const mapa = new Map<string, { codigo: string; nome: string; total: number }>();

    for (const i of itens) {
      const atual = mapa.get(i.material.familia.id);
      mapa.set(i.material.familia.id, {
        codigo: i.material.familia.codigo,
        nome: i.material.familia.nome,
        total: (atual?.total ?? 0) + 1,
      });
    }

    return [...mapa.entries()].map(([id, dados]) => ({ id, ...dados }));
  }, [itens]);

  const visiveis = familiaFiltro
    ? itens.filter((i) => i.material.familia.id === familiaFiltro)
    : itens;

  const selecionados = itens.filter((i) => escolhidos.includes(i.id));

  const familiasSelecionadas = [
    ...new Set(selecionados.map((i) => i.material.familia.codigo)),
  ];

  const valorReferencia = selecionados.reduce(
    (s, i) => s + i.quantidade * (i.valorEstimado ?? 0),
    0,
  );

  function alternar(id: string) {
    setEscolhidos((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  function marcarTodosVisiveis() {
    const ids = visiveis.map((i) => i.id);
    const todosMarcados = ids.every((id) => escolhidos.includes(id));

    setEscolhidos((atual) =>
      todosMarcados
        ? atual.filter((id) => !ids.includes(id))
        : [...new Set([...atual, ...ids])],
    );
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setDetalhes([]);
    setEnviando(true);

    try {
      const r = await criarCotacao({
        titulo,
        prazoResposta: new Date(prazo + 'T23:59:59').toISOString(),
        observacoes: observacoes || undefined,
        itens: escolhidos,
      });

      navegar('/cotacoes/' + r.cotacao.id);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setDetalhes((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Não foi possível criar o pacote.');
      }
      setEnviando(false);
    }
  }

  if (carregando) return <Carregando mensagem="Carregando itens aprovados..." />;
  if (erroCarga) return <Erro mensagem={erroCarga} aoTentarNovamente={() => void carregar()} />;

  return (
    <form onSubmit={enviar} noValidate>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Novo pacote de cotação"
          descricao={
            <>
              Escolha os itens aprovados. Na próxima tela você convida os fornecedores.
            </>
          }
        />

        <div className="cartao formulario">
          <div className="formulario__linha">
            <Campo
              rotulo="Título do pacote"
              valor={titulo}
              aoMudar={setTitulo}
              exemplo="Material elétrico — 2º pavimento"
              ajuda="É o que o fornecedor vê no convite."
              obrigatorio
            />
            <Campo
              rotulo="Prazo para responder"
              valor={prazo}
              aoMudar={setPrazo}
              tipo="date"
              ajuda="Depois desta data o link do fornecedor para de funcionar."
              obrigatorio
            />
          </div>

          <Campo
            rotulo="Observações para o fornecedor"
            valor={observacoes}
            aoMudar={setObservacoes}
            exemplo="Entrega no canteiro. Informar prazo real de entrega."
          />
        </div>
      </section>

      {/* ---------------- Escolha dos itens ---------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Itens aprovados esperando cotação</h2>
          <p className="secao__descricao">
            Só aparecem itens de solicitações <strong>já aprovadas</strong> que ainda não
            entraram em nenhum pacote.
          </p>
        </div>

        {itens.length === 0 ? (
          <Vazio
            titulo="Nenhum item disponível"
            descricao="Tudo que foi aprovado já está em algum pacote de cotação."
          />
        ) : (
          <>
            <div className="barra-acoes">
              <div className="campo campo--inline campo--curto">
                <label className="apenas-leitor-tela" htmlFor="familia-bid">
                  Filtrar por família
                </label>
                <select
                  id="familia-bid"
                  className="campo__entrada"
                  value={familiaFiltro}
                  onChange={(e) => setFamiliaFiltro(e.target.value)}
                >
                  <option value="">Todas as famílias ({itens.length})</option>
                  {familias.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} ({f.total})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="botao botao--secundario"
                onClick={marcarTodosVisiveis}
              >
                Marcar/desmarcar visíveis
              </button>
            </div>

            <div className="aviso aviso--info">
              <span className="aviso__icone" aria-hidden="true">
                💡
              </span>
              <div>
                <strong>Agrupe por família.</strong>
                <p>
                  O sistema convida os fornecedores pelas famílias dos itens. Um pacote só
                  de elétrica vai só para quem vende elétrica — misturar famílias faz o
                  fornecedor receber itens que ele não atende.
                </p>
              </div>
            </div>

            <Cartao semEspaco>
              <div className="tabela-area">
                <table className="tabela">
                  <caption className="apenas-leitor-tela">
                    Itens aprovados disponíveis para cotação
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="apenas-leitor-tela">Escolher</span>
                      </th>
                      <th scope="col">Código</th>
                      <th scope="col">Item</th>
                      <th scope="col">Família</th>
                      <th scope="col" className="numero">Qtd.</th>
                      <th scope="col">Origem</th>
                      <th scope="col">Precisa até</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((i) => (
                      <tr key={i.id} className={escolhidos.includes(i.id) ? 'linha--marcada' : ''}>
                        <td>
                          <input
                            type="checkbox"
                            className="caixa"
                            checked={escolhidos.includes(i.id)}
                            onChange={() => alternar(i.id)}
                            aria-label={'Incluir ' + i.material.descricao}
                          />
                        </td>
                        <th scope="row" className="mono">
                          {i.material.codigoInterno}
                        </th>
                        <td>
                          {i.material.descricao}
                          {i.descricaoComplementar && (
                            <small className="linha-extra">{i.descricaoComplementar}</small>
                          )}
                          {i.primeiraCompra && (
                            <>
                              {' '}
                              <Selo tipo="atencao">Primeira compra</Selo>
                            </>
                          )}
                        </td>
                        <td>
                          <span className="etiqueta">{i.material.familia.codigo}</span>
                        </td>
                        <td className="numero">
                          {qtdBr(i.quantidade)} {i.unidadeMedida}
                        </td>
                        <td>
                          <span className="mono">{i.solicitacao.numeroFormatado}</span>
                          <small className="linha-extra">{i.solicitacao.obra.codigo}</small>
                        </td>
                        <td>{dataBr(i.solicitacao.dataDesejada)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Cartao>
          </>
        )}
      </section>

      {/* ---------------- Resumo e envio ---------------- */}
      <section className="secao">
        <div className="cartao formulario">
          <h2 className="formulario__titulo">Resumo do pacote</h2>

          <dl className="dados">
            <div>
              <dt>Itens</dt>
              <dd>
                <strong>{escolhidos.length}</strong> selecionado(s)
              </dd>
            </div>
            <div>
              <dt>Famílias</dt>
              <dd>
                {familiasSelecionadas.length === 0 ? (
                  '—'
                ) : (
                  <span className="etiquetas">
                    {familiasSelecionadas.map((f) => (
                      <span key={f} className="etiqueta">
                        {f}
                      </span>
                    ))}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>Referência</dt>
              <dd>
                {dinheiro(valorReferencia)}
                <small className="linha-extra">
                  Valor estimado nas solicitações, só para comparação
                </small>
              </dd>
            </div>
          </dl>

          {familiasSelecionadas.length > 2 && (
            <div className="aviso aviso--atencao">
              <span className="aviso__icone" aria-hidden="true">
                ⚠
              </span>
              <div>
                <strong>Você misturou {familiasSelecionadas.length} famílias.</strong>
                <p>
                  Funciona, mas alguns fornecedores vão receber itens que não atendem.
                  Considere fazer um pacote por família.
                </p>
              </div>
            </div>
          )}

          {erro && <ErroFormulario mensagem={erro} detalhes={detalhes} />}

          <div className="formulario__acoes">
            <button
              type="submit"
              className="botao botao--principal"
              disabled={enviando || !titulo || !prazo || escolhidos.length === 0}
            >
              {enviando ? 'Criando...' : 'Criar pacote e escolher fornecedores'}
            </button>
            <Link to="/cotacoes" className="botao botao--secundario botao--link-cheio">
              Cancelar
            </Link>
            <span className="formulario__nota">
              <Selo tipo="info">Nada é enviado a fornecedor ainda</Selo>
            </span>
          </div>
        </div>
      </section>
    </form>
  );
}
