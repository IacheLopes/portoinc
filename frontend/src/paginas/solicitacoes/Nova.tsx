// ============================================================
//  Abrir solicitação de compra
//
//  Primeira tela de trabalho do dia a dia. Precisa ser rápida
//  de preencher, inclusive no celular do canteiro de obras.
//
//  Atalho importante: ao escolher o item do catálogo, a unidade
//  de medida e a linha de orçamento já vêm preenchidas — dois
//  campos a menos para digitar em cada linha.
// ============================================================

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  listarObras, buscarObra, listarMateriais, dinheiro,
  type Obra, type LinhaOrcamento, type Material,
} from '../../servicos/cadastros';
import { criarSolicitacao, type ItemParaEnviar } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Campo, Selecao, ErroFormulario } from '../../componentes/Campo';
import { Carregando, Erro } from '../../componentes/Estado';
import { Selo } from '../../componentes/Selo';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';

interface ItemNaTela extends Omit<ItemParaEnviar, 'valorEstimado'> {
  chave: string;
  material: Material;
  valorEstimado: number | null;
}

export function NovaSolicitacao() {
  const navegar = useNavigate();

  const [obras, setObras] = useState<Obra[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [linhas, setLinhas] = useState<LinhaOrcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [obraId, setObraId] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [dataDesejada, setDataDesejada] = useState('');
  const [itens, setItens] = useState<ItemNaTela[]>([]);

  // Linha de montagem do próximo item
  const [materialId, setMaterialId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [linhaId, setLinhaId] = useState('');
  const [complemento, setComplemento] = useState('');
  const [especificacao, setEspecificacao] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');

  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const [o, m] = await Promise.all([listarObras(), listarMateriais()]);
      setObras(o.obras.filter((x) => x.ativa));
      setMateriais(m.materiais);
    } catch (e) {
      setErroCarga(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Ao escolher a obra, carregamos o orçamento dela.
  useEffect(() => {
    if (!obraId) {
      setLinhas([]);
      return;
    }

    let ativo = true;
    buscarObra(obraId)
      .then((r) => {
        if (ativo) setLinhas(r.obra.linhas);
      })
      .catch(() => {
        if (ativo) setLinhas([]);
      });

    return () => {
      ativo = false;
    };
  }, [obraId]);

  const materialEscolhido = materiais.find((m) => m.id === materialId);

  // Quando o item é escolhido, sugerimos a linha de orçamento dele.
  useEffect(() => {
    if (!materialEscolhido?.codigoLinhaPadrao) return;

    const sugerida = linhas.find((l) => l.codigo === materialEscolhido.codigoLinhaPadrao);
    if (sugerida) setLinhaId(sugerida.id);
  }, [materialEscolhido, linhas]);

  function adicionarItem() {
    if (!materialEscolhido || !quantidade) return;

    setItens((atual) => [
      ...atual,
      {
        chave: crypto.randomUUID(),
        material: materialEscolhido,
        materialId: materialEscolhido.id,
        quantidade: Number(quantidade),
        linhaOrcamentoId: linhaId || null,
        descricaoComplementar: complemento || undefined,
        especificacaoTecnica: especificacao || undefined,
        valorEstimado: valorEstimado ? Number(valorEstimado) : null,
      },
    ]);

    // Limpa a linha de montagem, pronta para o próximo item.
    setMaterialId('');
    setQuantidade('');
    setLinhaId('');
    setComplemento('');
    setEspecificacao('');
    setValorEstimado('');
  }

  function removerItem(chave: string) {
    setItens((atual) => atual.filter((i) => i.chave !== chave));
  }

  const total = itens.reduce((s, i) => s + i.quantidade * (i.valorEstimado ?? 0), 0);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setDetalhes([]);
    setEnviando(true);

    try {
      const r = await criarSolicitacao({
        obraId,
        justificativa: justificativa || undefined,
        observacoes: observacoes || undefined,
        dataDesejada: dataDesejada || undefined,
        itens: itens.map((i) => ({
          materialId: i.materialId,
          quantidade: i.quantidade,
          linhaOrcamentoId: i.linhaOrcamentoId,
          descricaoComplementar: i.descricaoComplementar,
          especificacaoTecnica: i.especificacaoTecnica,
          valorEstimado: i.valorEstimado,
        })),
      });

      navegar('/solicitacoes/' + r.solicitacao.id);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setDetalhes((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Não foi possível criar a solicitação.');
      }
      setEnviando(false);
    }
  }

  if (carregando) return <Carregando mensagem="Carregando obras e catálogo..." />;
  if (erroCarga) return <Erro mensagem={erroCarga} aoTentarNovamente={() => void carregar()} />;

  return (
    <form onSubmit={enviar} noValidate>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Nova solicitação de compra"
          descricao={
            <>
              Ela nasce como <strong>rascunho</strong>. Você pode revisar e só então
            enviar para aprovação.
            </>
          }
        />

        <div className="cartao formulario">
          <div className="formulario__linha">
            <Selecao
              rotulo="Obra"
              valor={obraId}
              aoMudar={setObraId}
              opcoes={obras.map((o) => ({ valor: o.id, rotulo: o.codigo + ' — ' + o.nome }))}
              vazio="Escolha a obra..."
              ajuda="Define para qual orçamento a compra será apontada."
              obrigatorio
            />
            <Campo
              rotulo="Precisa até"
              valor={dataDesejada}
              aoMudar={setDataDesejada}
              tipo="date"
              ajuda="Ajuda o comprador a priorizar."
            />
          </div>

          <Campo
            rotulo="Justificativa"
            valor={justificativa}
            aoMudar={setJustificativa}
            exemplo="Concretagem da laje do 3º pavimento"
            ajuda="Por que este material é necessário. Facilita muito a aprovação."
          />
        </div>
      </section>

      {/* ---------------- Montagem dos itens ---------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Itens</h2>
          <p className="secao__descricao">
            Escolha no catálogo. A unidade de medida e a linha de orçamento vêm
            preenchidas automaticamente.
          </p>
        </div>

        <div className="cartao formulario">
          <div className="formulario__linha">
            <Selecao
              rotulo="Item do catálogo"
              valor={materialId}
              aoMudar={setMaterialId}
              opcoes={materiais.map((m) => ({
                valor: m.id,
                rotulo: m.codigoInterno + ' — ' + m.descricao + ' (' + m.unidadeMedida + ')',
              }))}
              vazio="Escolha o material ou serviço..."
              semMarcaOpcional
            />
            <Campo
              rotulo={
                'Quantidade' + (materialEscolhido ? ' em ' + materialEscolhido.unidadeMedida : '')
              }
              valor={quantidade}
              aoMudar={setQuantidade}
              tipo="number"
              exemplo="120"
              desabilitado={!materialId}
              semMarcaOpcional
            />
          </div>

          {materialEscolhido && (
            <>
              <div className="formulario__linha">
                <Selecao
                  rotulo="Linha do orçamento"
                  valor={linhaId}
                  aoMudar={setLinhaId}
                  opcoes={linhas.map((l) => ({
                    valor: l.id,
                    rotulo: l.codigo + ' — ' + l.descricao,
                  }))}
                  vazio={obraId ? 'Sem vínculo com o orçamento' : 'Escolha a obra primeiro'}
                  ajuda={
                    materialEscolhido.codigoLinhaPadrao
                      ? 'Sugerida pelo cadastro: ' + materialEscolhido.codigoLinhaPadrao
                      : 'Este item não tem linha sugerida no cadastro.'
                  }
                  desabilitado={!obraId}
                />
                <Campo
                  rotulo="Valor unitário estimado (R$)"
                  valor={valorEstimado}
                  aoMudar={setValorEstimado}
                  tipo="number"
                  exemplo="34.00"
                  ajuda="Serve para calcular quem precisa aprovar."
                />
              </div>

              <Campo
                rotulo="Detalhes do pedido"
                valor={complemento}
                aoMudar={setComplemento}
                exemplo="Entregar no canteiro pela manhã"
                ajuda="Marca, dimensões, cor ou condição de entrega."
              />

              <div className="campo">
                <label className="campo__rotulo" htmlFor="especificacao">
                  Especificação técnica <span className="campo__opcional">(opcional)</span>
                </label>
                <textarea
                  id="especificacao"
                  className="campo__entrada campo__area campo__area--curta"
                  rows={3}
                  value={especificacao}
                  onChange={(e) => setEspecificacao(e.target.value)}
                  placeholder="Marca aceita, qualidade exigida, dimensões..."
                />
                <p className="campo__ajuda">
                  <strong>Obrigatória</strong> se for a primeira vez que a empresa compra
                  este item. Sem ela, o comprador não sabe o que cotar.
                </p>
              </div>
            </>
          )}

          <div className="formulario__acoes">
            <button
              type="button"
              className="botao botao--secundario"
              onClick={adicionarItem}
              disabled={!materialId || !quantidade || Number(quantidade) <= 0}
            >
              + Adicionar item à solicitação
            </button>
          </div>
        </div>
      </section>

      {/* ---------------- Itens já adicionados ---------------- */}
      {itens.length > 0 && (
        <section className="secao">
          <Cartao semEspaco>
            <div className="tabela-area">
              <table className="tabela">
                <caption className="apenas-leitor-tela">Itens desta solicitação</caption>
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Item</th>
                    <th scope="col">Un.</th>
                    <th scope="col" className="numero">Qtd.</th>
                    <th scope="col" className="numero">Valor estimado</th>
                    <th scope="col">
                      <span className="apenas-leitor-tela">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i) => (
                    <tr key={i.chave}>
                      <th scope="row" className="mono">
                        {i.material.codigoInterno}
                      </th>
                      <td>
                        {i.material.descricao}
                        {i.descricaoComplementar && (
                          <small className="linha-extra">{i.descricaoComplementar}</small>
                        )}
                      </td>
                      <td className="mono">{i.material.unidadeMedida}</td>
                      <td className="numero">{i.quantidade.toLocaleString('pt-BR')}</td>
                      <td className="numero">
                        {i.valorEstimado !== null
                          ? dinheiro(i.quantidade * i.valorEstimado)
                          : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="botao botao--discreto"
                          onClick={() => removerItem(i.chave)}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={4}>
                      Total estimado
                    </th>
                    <td className="numero destaque">{dinheiro(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Cartao>
        </section>
      )}

      <section className="secao">
        <div className="cartao formulario">
          <Campo
            rotulo="Observações gerais"
            valor={observacoes}
            aoMudar={setObservacoes}
            exemplo="Acesso ao canteiro apenas por caminhão pequeno"
          />

          {itens.length === 0 && (
            <div className="aviso aviso--atencao">
              <span className="aviso__icone" aria-hidden="true">
                ⚠
              </span>
              <div>
                <strong>Adicione pelo menos um item.</strong>
                <p>Uma solicitação sem itens não pode ser salva.</p>
              </div>
            </div>
          )}

          {erro && <ErroFormulario mensagem={erro} detalhes={detalhes} />}

          <div className="formulario__acoes">
            <button
              type="submit"
              className="botao botao--principal"
              disabled={enviando || !obraId || itens.length === 0}
            >
              {enviando ? 'Salvando...' : 'Salvar como rascunho'}
            </button>
            <Link to="/solicitacoes" className="botao botao--secundario botao--link-cheio">
              Cancelar
            </Link>
            <span className="formulario__nota">
              <Selo tipo="info">Nada é enviado para aprovação ainda</Selo>
            </span>
          </div>
        </div>
      </section>
    </form>
  );
}
