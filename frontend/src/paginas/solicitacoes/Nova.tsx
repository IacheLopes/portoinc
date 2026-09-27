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

// padrao-ignora: sem-estados — a lista de itens comeca vazia por
// definicao, e o vazio dela nao e um <Vazio> generico: e o aviso
// "Adicione pelo menos um item", que diz o que fazer. A tabela so
// aparece com itens (itens.length > 0), entao tela em branco sem
// explicacao nao acontece aqui.

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listarObras, buscarObra, listarMateriais, dinheiro,
  // Com nome proprio: a tela ja tem um estado chamado quantidade.
  quantidade as formatarQuantidade,
  type Obra, type LinhaOrcamento, type Material,
} from '../../servicos/cadastros';
import { criarSolicitacao, type ItemParaEnviar } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Campo, Selecao, ErroFormulario } from '../../componentes/Campo';
import { Carregando, Erro } from '../../componentes/Estado';
import { Icone } from '../../componentes/Icone';
import { chaveLocal } from '../../servicos/identificador';
import { Modal } from '../../componentes/Modal';
import { mascaraDinheiro, dinheiroCompleto, lerDinheiro } from '../../servicos/mascaras';

interface ItemNaTela extends Omit<ItemParaEnviar, 'valorEstimado'> {
  chave: string;
  material: Material;
  valorEstimado: number | null;
}

export function NovaSolicitacao({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const idForm = useId();
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
  /** Ligado quando alguém tenta salvar com um item ainda solto. */
  const [avisoDeItemSolto, setAvisoDeItemSolto] = useState(false);

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

  /**
   * Ha um item comecado que ainda nao entrou na lista?
   *
   * Qualquer campo da area de montagem preenchido conta. Era isto
   * que o Salvar ignorava: a pessoa digitava o segundo item inteiro,
   * clicava em Salvar, e ele sumia sem aviso.
   */
  const temItemComecado = Boolean(
    materialId || quantidade || linhaId || complemento || especificacao || valorEstimado,
  );

  /** O item comecado esta completo o bastante para entrar na lista? */
  const itemComecadoServe = Boolean(materialEscolhido && quantidade && Number(quantidade) > 0);

  function descartarItemComecado() {
    setMaterialId('');
    setQuantidade('');
    setLinhaId('');
    setComplemento('');
    setEspecificacao('');
    setValorEstimado('');
    setAvisoDeItemSolto(false);
  }

  function adicionarItem() {
    if (!materialEscolhido || !quantidade) return;

    setItens((atual) => [
      ...atual,
      {
        chave: chaveLocal(),
        material: materialEscolhido,
        materialId: materialEscolhido.id,
        quantidade: Number(quantidade),
        linhaOrcamentoId: linhaId || null,
        descricaoComplementar: complemento || undefined,
        especificacaoTecnica: especificacao || undefined,
        valorEstimado: lerDinheiro(valorEstimado),
      },
    ]);

    // Limpa a linha de montagem, pronta para o próximo item.
    setMaterialId('');
    setQuantidade('');
    setLinhaId('');
    setComplemento('');
    setEspecificacao('');
    setValorEstimado('');
    setAvisoDeItemSolto(false);
  }

  function removerItem(chave: string) {
    setItens((atual) => atual.filter((i) => i.chave !== chave));
  }

  const total = itens.reduce((s, i) => s + i.quantidade * (i.valorEstimado ?? 0), 0);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();

    // Um item comecado nao pode sumir por causa de um clique no botao
    // errado. O Salvar para aqui e pergunta o que fazer com ele.
    if (temItemComecado) {
      setAvisoDeItemSolto(true);
      return;
    }

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
    /* Formulario longo dentro de modal, por pedido do dono do
       sistema. O corpo rola por dentro e o rodape fica preso
       embaixo — ver `.modal__corpo` em global.css, que precisa de
       `flex: 1` e `min-height: 0` juntos para isso funcionar no
       celular.

       O botao de enviar mora no rodape, fora do <form>, e alcanca o
       formulario pelo atributo `form`. */
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova solicitação de compra"
      descricao="Ela nasce como rascunho. Você revisa e só então envia para aprovação."
      temAlteracao={Boolean(obraId || itens.length > 0 || justificativa)}
      acoes={
        <>
          <button type="button" className="botao botao--discreto" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="submit"
            form={idForm}
            className="botao botao--principal"
            disabled={enviando || !obraId || itens.length === 0}
          >
            {enviando ? 'Salvando...' : 'Salvar como rascunho'}
          </button>
        </>
      }
    >
      {/* ------------------------------------------------------
          Sem <Cartao> e sem <section className="secao"> aqui.

          O modal JÁ é uma caixa. Cartão dentro dele vira caixa
          dentro de caixa — e eram três, cada uma com moldura e
          espaçamento próprios. Dentro de um modal, um traço separa
          seção e custa 1px em vez de 40.

          A única moldura que sobrou é a da área de montagem, e ela
          está ali de propósito: é o que faz o olho entender que
          aquilo é um formulário à parte, que precisa ser confirmado.
          ------------------------------------------------------ */}
      <form id={idForm} onSubmit={enviar} noValidate>
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

        {/* ---------------- Itens ---------------- */}
        <h2 className="modal__secao">Itens</h2>

        {/* A lista vem ANTES da área de montagem.
            Antes era o contrário, e quem abria o modal via um
            formulário vazio de item sem entender que havia uma lista
            embaixo. Assim se vê o que já tem, e depois acrescenta. */}
        {itens.length === 0 ? (
          <p className="campo__ajuda">Nenhum item ainda. Escolha o primeiro abaixo.</p>
        ) : (
          <ul className="lista-de-itens">
            {itens.map((i) => (
              <li key={i.chave} className="item-pedido">
                <div className="item-pedido__texto">
                  <strong>
                    <span className="mono">{i.material.codigoInterno}</span>{' '}
                    {i.material.descricao}
                  </strong>
                  <small>
                    {formatarQuantidade(i.quantidade)} {i.material.unidadeMedida}
                    {i.valorEstimado !== null && ' × ' + dinheiro(i.valorEstimado)}
                    {i.descricaoComplementar && ' · ' + i.descricaoComplementar}
                  </small>
                </div>

                <span className="item-pedido__valor">
                  {i.valorEstimado !== null
                    ? dinheiro(i.quantidade * i.valorEstimado)
                    : '—'}
                </span>

                <button
                  type="button"
                  className="botao botao--discreto"
                  onClick={() => removerItem(i.chave)}
                  aria-label={'Remover ' + i.material.descricao}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ---------------- Área de montagem ---------------- */}
        <div className={'montagem' + (avisoDeItemSolto ? ' montagem--alerta' : '')}>
          <h3 className="montagem__titulo">Novo item</h3>

          {avisoDeItemSolto && (
            <div className="aviso aviso--atencao" role="alert">
              <Icone nome="alerta" className="aviso__icone" />
              <div>
                <strong>Este item ainda não está na lista.</strong>
                <p>
                  {itemComecadoServe
                    ? 'Ele não será salvo assim. Adicione à lista ou descarte.'
                    : 'Falta escolher o item e a quantidade. Complete e adicione, ou descarte.'}
                </p>
                <div className="formulario__acoes">
                  <button
                    type="button"
                    className="botao botao--principal"
                    onClick={adicionarItem}
                    disabled={!itemComecadoServe}
                  >
                    Adicionar à lista
                  </button>
                  <button
                    type="button"
                    className="botao botao--discreto"
                    onClick={descartarItemComecado}
                  >
                    Descartar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* O seletor sozinho na linha: o rótulo de um material é
              "00119 — Cimento Portland CP-II-Z-32 saco 50kg (SC)".
              Em meia largura ele vira reticências, e escolher às
              cegas num catálogo é como o item errado entra no
              pedido. */}
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

          {/* Quantidade e preço unitário andam juntos: são a mesma
              pergunta — quanto, e a quanto. */}
          <div className="formulario__linha">
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
            <Campo
              rotulo="Valor unitário (R$)"
              valor={valorEstimado}
              aoMudar={(v) => setValorEstimado(mascaraDinheiro(v))}
              aoSair={() => setValorEstimado(dinheiroCompleto(valorEstimado))}
              modoTeclado="decimal"
              exemplo="R$ 34,00"
              desabilitado={!materialId}
              ajuda="Serve para calcular quem precisa aprovar."
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

          {/* Some enquanto o aviso está na tela: ele já traz o mesmo
              botão, e dois "Adicionar à lista" a dez centímetros um do
              outro fazem a pessoa procurar a diferença entre eles. */}
          {!avisoDeItemSolto && (
            <div className="formulario__acoes formulario__acoes--fim">
              <button
                type="button"
                className="botao botao--secundario"
                onClick={adicionarItem}
                disabled={!itemComecadoServe}
              >
                Adicionar à lista
              </button>
            </div>
          )}
        </div>

        {itens.length > 0 && (
          <p className="total-da-solicitacao">
            <span>Total estimado</span>
            <strong>{dinheiro(total)}</strong>
          </p>
        )}

        {/* ---------------- Antes de salvar ---------------- */}
        <Campo
          rotulo="Observações gerais"
          valor={observacoes}
          aoMudar={setObservacoes}
          exemplo="Acesso ao canteiro apenas por caminhão pequeno"
          ajuda="Um recado para quem vai comprar. Vale para a solicitação inteira."
        />

        {itens.length === 0 && !temItemComecado && (
          <div className="aviso aviso--atencao">
            <Icone nome="alerta" className="aviso__icone" />
            <div>
              <strong>Adicione pelo menos um item.</strong>
              <p>Uma solicitação sem itens não pode ser salva.</p>
            </div>
          </div>
        )}

        {erro && <ErroFormulario mensagem={erro} detalhes={detalhes} />}
      </form>
    </Modal>
  );
}
