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
import {
  criarSolicitacao, editarSolicitacao, trocarItens,
  type ItemParaEnviar, type Solicitacao,
} from '../../servicos/solicitacoes';
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
  editando,
  aoSalvarEdicao,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /**
   * O rascunho que está sendo corrigido. Ausente = solicitação nova.
   *
   * O mesmo modal serve para os dois porque os campos são os mesmos.
   * Uma segunda tela de edição envelheceria em separado: quem
   * mexesse num campo aqui esqueceria de mexer lá, e as duas telas
   * passariam a pedir coisas diferentes para a mesma solicitação.
   */
  editando?: Solicitacao;
  /** Chamado depois de salvar a edição, para a tela recarregar. */
  aoSalvarEdicao?: () => Promise<void>;
}) {
  const idForm = useId();
  const navegar = useNavigate();

  const [obras, setObras] = useState<Obra[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [linhas, setLinhas] = useState<LinhaOrcamento[]>([]);
  /**
   * O orçamento da obra já foi buscado?
   *
   * Sem isto não dá para diferenciar "obra sem orçamento" de
   * "orçamento ainda carregando", e o aviso piscaria na tela toda
   * vez que alguém trocasse de obra.
   */
  const [orcamentoLido, setOrcamentoLido] = useState(false);
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

  /**
   * Traz o rascunho para dentro do formulário.
   *
   * Depois do catálogo carregar, e não antes: o item da lista guarda
   * o material COMPLETO (com a linha padrão e a família), e ele só
   * existe depois que `materiais` chegou. Sem esperar, a lista de
   * itens vinha pela metade e a pessoa perdia a linha de orçamento
   * ao salvar.
   */
  useEffect(() => {
    if (!editando || carregando) return;

    setObraId(editando.obra.id);
    setJustificativa(editando.justificativa ?? '');
    setObservacoes(editando.observacoes ?? '');
    setDataDesejada(editando.dataDesejada ? editando.dataDesejada.slice(0, 10) : '');

    setItens(
      editando.itens.map((i) => ({
        chave: chaveLocal(),
        // Pelo catálogo, que tem o material inteiro. O item da
        // solicitação carrega só um recorte dele.
        material: materiais.find((m) => m.id === i.material.id) ?? (i.material as Material),
        materialId: i.material.id,
        quantidade: i.quantidade,
        linhaOrcamentoId: i.linhaOrcamento?.id ?? null,
        descricaoComplementar: i.descricaoComplementar ?? undefined,
        especificacaoTecnica: i.especificacaoTecnica ?? undefined,
        valorEstimado: i.valorEstimado,
      })),
    );
  }, [editando, carregando, materiais]);

  // Ao escolher a obra, carregamos o orçamento dela.
  useEffect(() => {
    if (!obraId) {
      setLinhas([]);
      return;
    }

    let ativo = true;
    setOrcamentoLido(false);
    buscarObra(obraId)
      .then((r) => {
        if (!ativo) return;
        setLinhas(r.obra.linhas);
        setOrcamentoLido(true);
      })
      .catch(() => {
        if (ativo) setLinhas([]);
      });

    return () => {
      ativo = false;
    };
  }, [obraId]);

  const materialEscolhido = materiais.find((m) => m.id === materialId);
  const obraEscolhida = obras.find((o) => o.id === obraId);

  /**
   * A obra escolhida não tem NENHUMA linha de orçamento.
   *
   * Merece aviso de verdade, e não uma linha de ajuda miúda, porque
   * o estrago é silencioso e não tem volta: o item nasce sem vínculo
   * e nunca mais pode ser amarrado — nem corrigindo o rascunho
   * depois, porque a linha não existe para ser escolhida. A compra
   * some do relatório de orçado x realizado, e quem for ler o
   * relatório meses depois não tem como saber que faltou isto.
   *
   * O dono do sistema caiu exatamente nisto em 27/09/2026: criou a
   * solicitação antes de cadastrar o orçamento da obra, e a tela não
   * disse nada.
   */
  const obraSemOrcamento = Boolean(obraId) && orcamentoLido && linhas.length === 0;

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

    const paraEnviar = itens.map((i) => ({
      materialId: i.materialId,
      quantidade: i.quantidade,
      linhaOrcamentoId: i.linhaOrcamentoId,
      descricaoComplementar: i.descricaoComplementar,
      especificacaoTecnica: i.especificacaoTecnica,
      valorEstimado: i.valorEstimado,
    }));

    try {
      if (editando) {
        // Duas chamadas porque o servidor separa cabeçalho de itens.
        // O cabeçalho primeiro: se a obra mudou, os itens novos já
        // entram apontando para o orçamento da obra certa.
        await editarSolicitacao(editando.id, {
          obraId,
          justificativa: justificativa || undefined,
          observacoes: observacoes || undefined,
          dataDesejada: dataDesejada || undefined,
        });

        await trocarItens(editando.id, paraEnviar);
        await aoSalvarEdicao?.();
        aoFechar();
        return;
      }

      const r = await criarSolicitacao({
        obraId,
        justificativa: justificativa || undefined,
        observacoes: observacoes || undefined,
        dataDesejada: dataDesejada || undefined,
        itens: paraEnviar,
      });

      navegar('/solicitacoes/' + r.solicitacao.id);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setDetalhes((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro(
          editando
            ? 'Não foi possível salvar as alterações.'
            : 'Não foi possível criar a solicitação.',
        );
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
      titulo={editando ? 'Corrigir ' + editando.numeroFormatado : 'Nova solicitação de compra'}
      descricao={
        editando
          ? 'Ela continua como rascunho. Nada vai para aprovação até você enviar.'
          : 'Ela nasce como rascunho. Você revisa e só então envia para aprovação.'
      }
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
            {enviando
              ? 'Salvando...'
              : editando
                ? 'Salvar alterações'
                : 'Salvar como rascunho'}
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

        {obraSemOrcamento && (
          <div className="aviso aviso--atencao" role="status">
            <Icone nome="alerta" className="aviso__icone" />
            <div>
              <strong>
                A obra {obraEscolhida?.codigo} não tem orçamento cadastrado.
              </strong>
              <p>
                Os itens desta solicitação vão ficar <strong>sem vínculo</strong> com o
                orçamento, e <strong>isso não tem volta</strong>: a compra não aparecerá no
                relatório de orçado x realizado, nem depois que o orçamento for criado.
              </p>
              <p>
                Dá para seguir assim — só o relatório fica cego a esta compra. Para
                vincular, alguém com perfil de Administrador precisa cadastrar o
                orçamento em <strong>Cadastros → Obras</strong> antes de você salvar.
              </p>
            </div>
          </div>
        )}

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
                    obraSemOrcamento
                      ? 'Esta obra não tem orçamento cadastrado.'
                      : materialEscolhido.codigoLinhaPadrao
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
