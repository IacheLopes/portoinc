// ============================================================
//  Portal do fornecedor — TELA PÚBLICA
//
//  Esta é a única tela do sistema que não exige login, e a
//  única que gente de fora da Porto Inc. vai ver. Por isso ela
//  precisa se explicar sozinha: quem chega aqui nunca usou o
//  sistema e não vai receber treinamento.
//
//  padrao-ignora: sem-cabecalho — é do fornecedor, que não tem conta nem menu no sistema.
// ============================================================

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  abrirPortal, responderPortal,
  type CotacaoDoPortal, type ItemDoPortal, type RecusaDoPortal,
} from '../servicos/cotacoes';
import { dataBr, dataHoraBr } from '../servicos/solicitacoes';
import { Carregando } from '../componentes/Estado';
import { Modal } from '../componentes/Modal';
import { Selo } from '../componentes/Selo';
import { Icone } from '../componentes/Icone';
import { plural, dinheiro, porcento, quantidade as qtdBr } from '../servicos/texto';
import {
  mascaraDinheiro, dinheiroCompleto, lerDinheiro, dinheiroParaCampo,
} from '../servicos/mascaras';

interface RespostaItem {
  disponivel: boolean;
  valorUnitario: string;
  marca: string;
  modelo: string;
  prazoEntregaDias: string;
  observacao: string;
}

function respostaInicial(item: ItemDoPortal): RespostaItem {
  const m = item.minhaResposta;

  return {
    disponivel: m?.disponivel ?? true,
    // Com máscara: "R$ 51,00", e não "51". Quem digita preço o dia
    // inteiro lê o valor conferindo os pontos de milhar — sem eles,
    // R$ 5.100 e R$ 51.000 são a mesma mancha na tela.
    valorUnitario: dinheiroParaCampo(m?.valorUnitario),
    marca: m?.marca ?? item.marcaReferencia ?? '',
    modelo: m?.modelo ?? '',
    prazoEntregaDias: m?.prazoEntregaDias != null ? String(m.prazoEntregaDias) : '',
    observacao: m?.observacao ?? '',
  };
}

export function Portal() {
  const { token = '' } = useParams();

  const [cotacao, setCotacao] = useState<CotacaoDoPortal | null>(null);
  const [carregando, setCarregando] = useState(true);
  //  A RECUSA INTEIRA, e não só a frase dela: a tela muda conforme
  //  o motivo — "já enviou" é um agradecimento em verde, as outras
  //  três são erro —, e ela traz o comprovante do que foi enviado.
  const [recusa, setRecusa] = useState<RecusaDoPortal | null>(null);

  const [respostas, setRespostas] = useState<Record<string, RespostaItem>>({});
  const [frete, setFrete] = useState('');
  const [outros, setOutros] = useState('');
  const [entrada, setEntrada] = useState('');
  const [parcelas, setParcelas] = useState('');
  const [intervalo, setIntervalo] = useState('');
  const [observacao, setObservacao] = useState('');

  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<{ total: number; itens: number } | null>(null);
  //  A parada antes de enviar. Ver o porquê junto do modal, no fim
  //  do formulário.
  const [confirmando, setConfirmando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setRecusa(null);

    try {
      const r = await abrirPortal(token);
      setCotacao(r.cotacao);

      const iniciais: Record<string, RespostaItem> = {};
      for (const i of r.cotacao.itens) iniciais[i.id] = respostaInicial(i);
      setRespostas(iniciais);

      const c = r.cotacao.minhasCondicoes;
      setFrete(dinheiroParaCampo(c.valorFrete));
      setOutros(dinheiroParaCampo(c.outrosCustos));
      setEntrada(c.percentualEntrada != null ? String(c.percentualEntrada) : '');
      setParcelas(c.quantidadeParcelas != null ? String(c.quantidadeParcelas) : '');
      setIntervalo(c.intervaloParcelasDias != null ? String(c.intervaloParcelasDias) : '');
      setObservacao(c.observacaoFornecedor ?? '');
    } catch (e) {
      setRecusa(
        e instanceof Error
          ? (e as RecusaDoPortal)
          : (new Error('Não foi possível abrir a cotação.') as RecusaDoPortal),
      );
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function mudar(itemId: string, campo: keyof RespostaItem, valor: string | boolean) {
    setRespostas((a) => ({ ...a, [itemId]: { ...a[itemId], [campo]: valor } }));
  }

  const subtotal = (cotacao?.itens ?? []).reduce((soma, i) => {
    const r = respostas[i.id];
    if (!r?.disponivel) return soma;
    return soma + i.quantidade * (lerDinheiro(r.valorUnitario) ?? 0);
  }, 0);

  const total = subtotal + (lerDinheiro(frete) ?? 0) + (lerDinheiro(outros) ?? 0);

  const faltamPrecos = (cotacao?.itens ?? []).filter((i) => {
    const r = respostas[i.id];
    return r?.disponivel && lerDinheiro(r.valorUnitario) === null;
  }).length;

  /**
   * O SUBMIT NÃO ENVIA MAIS: ele abre a conferência.
   *
   * Continua sendo submit de verdade, e não um `onClick`, porque é
   * ele que dá o Enter no teclado e a validação do navegador de
   * graça.
   */
  function pedirConfirmacao(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setDetalhes([]);
    setConfirmando(true);
  }

  async function enviar() {
    setErro(null);
    setDetalhes([]);
    setEnviando(true);

    try {
      const r = await responderPortal(token, {
        itens: (cotacao?.itens ?? []).map((i) => {
          const x = respostas[i.id];
          return {
            bidItemId: i.id,
            disponivel: x.disponivel,
            valorUnitario: x.disponivel ? lerDinheiro(x.valorUnitario) : null,
            marca: x.marca || undefined,
            modelo: x.modelo || undefined,
            prazoEntregaDias: x.prazoEntregaDias ? Number(x.prazoEntregaDias) : null,
            observacao: x.observacao || undefined,
          };
        }),
        valorFrete: lerDinheiro(frete),
        outrosCustos: lerDinheiro(outros),
        percentualEntrada: entrada ? Number(entrada) : null,
        quantidadeParcelas: parcelas ? Number(parcelas) : null,
        intervaloParcelasDias: intervalo ? Number(intervalo) : null,
        observacaoFornecedor: observacao || undefined,
      });

      setConfirmando(false);
      setEnviado({ total: r.resumo.total, itens: r.resumo.itensCotados });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      //  O MODAL FECHA PARA O ERRO APARECER. Ele fica no
      //  formulário, e erro atrás de janela é erro que ninguém lê.
      setConfirmando(false);
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar.');
      setDetalhes((e as Error & { detalhes?: string[] }).detalhes ?? []);
      setEnviando(false);
    }
  }

  // ---------------- Estados de tela ----------------
  if (carregando) {
    return (
      <div className="portal">
        <Carregando mensagem="Abrindo a cotação..." />
      </div>
    );
  }

  /* ---------------- JÁ ENVIOU: AGRADECIMENTO, NÃO ERRO ----------------

     Esta tela existe porque a cotação enviada passou a ser final.
     Antes, reabrir o link trazia o formulário preenchido de volta.

     Ela NÃO usa a caixa vermelha das outras recusas, e isso não é
     capricho: quem reabre este link quase sempre está conferindo
     se deu certo. Receber um alerta vermelho em resposta a um
     acerto ensina a pessoa a desconfiar de uma tela que está certa.

     E o comprovante não é enfeite. Sem ele a pessoa lê "você já
     enviou" e continua sem saber O QUE enviou — que é exatamente
     a dúvida que faz o fornecedor ligar para o comprador. */
  if (recusa?.motivo === 'ja-respondido' && recusa.resumo) {
    const r = recusa.resumo;

    return (
      <div className="portal">
        <div className="portal__cartao">
          <MarcaPorto />

          <div className="portal__sucesso">
            <Icone nome="certo" className="portal__sucesso-icone" />
            <h1>{recusa.message}</h1>
            {recusa.cotacao && <p>{recusa.cotacao.titulo}</p>}
          </div>

          <div className="portal__resumo">
            <dl className="dados">
              {r.respondidoEm && (
                <div>
                  {/* "Enviada", e não "Enviada em": a coluna do rótulo
                      tem 70px neste bloco, e as duas palavras
                      quebravam em duas linhas ao lado de uma data de
                      uma linha só. */}
                  <dt>Enviada</dt>
                  <dd>{dataHoraBr(r.respondidoEm)}</dd>
                </div>
              )}
              <div>
                <dt>Itens</dt>
                <dd>
                  {r.itensCotados} cotados
                  {r.itensIndisponiveis > 0 &&
                    ', ' + r.itensIndisponiveis + ' que você não tem'}
                </dd>
              </div>
              {r.frete > 0 && (
                <div>
                  <dt>Frete</dt>
                  <dd>{dinheiro(r.frete)}</dd>
                </div>
              )}
              {r.outros > 0 && (
                <div>
                  <dt>Outros</dt>
                  <dd>{dinheiro(r.outros)}</dd>
                </div>
              )}
              {/* Sempre aparece. Antes era escondida quando vinha
                  "Não informada" — uma linha dizendo que não havia
                  linha. Agora o servidor devolve "À vista" quando o
                  fornecedor deixa os campos vazios, que é o que o
                  próprio portal combinou com ele, e aí a linha
                  informa de verdade. */}
              {r.pagamento && (
                <div>
                  <dt>Pagamento</dt>
                  <dd>{r.pagamento}</dd>
                </div>
              )}
              <div className="portal__resumo-soma">
                <dt>Total</dt>
                <dd>{dinheiro(r.total)}</dd>
              </div>
            </dl>
          </div>

          <p className="portal__rodape">
            O comprador da Porto Inc. está analisando as propostas. Se precisar
            corrigir alguma coisa, fale com ele — ele pode reabrir a cotação
            para você.
          </p>
        </div>
      </div>
    );
  }

  if (recusa || !cotacao) {
    return (
      <div className="portal">
        <div className="portal__cartao">
          <MarcaPorto />
          <div className="aviso aviso--erro" role="alert">
            <Icone nome="alerta" className="aviso__icone" />
            <div>
              <strong>{recusa?.message ?? 'Não foi possível abrir a cotação.'}</strong>
              <p>
                Se você acha que isso é um engano, entre em contato com o comprador da
                Porto Inc. que lhe enviou este link.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="portal">
        <div className="portal__cartao">
          <MarcaPorto />
          <div className="portal__sucesso">
            <Icone nome="certo" className="portal__sucesso-icone" />
            <h1>Cotação enviada!</h1>
            <p>
              Recebemos sua proposta de <strong>{dinheiro(enviado.total)}</strong> para{' '}
              {plural(enviado.itens, 'item', 'itens')}.
            </p>
            {/* A PROMESSA DE REVISAR SAIU DAQUI.
                Dizia "você pode revisar sua resposta até <data>
                reabrindo este mesmo link", e tinha um botão
                "Revisar minha resposta". Desde que a cotação
                enviada é final, o link recusaria a pessoa no
                clique seguinte — e promessa desmentida pelo
                próprio sistema é pior que regra apertada. */}
            <p className="portal__nota">
              O comprador da Porto Inc. vai analisar e entrar em contato. Sua
              proposta está fechada: se precisar corrigir alguma coisa, fale com
              ele — ele pode reabrir a cotação para você.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const prazoData = new Date(cotacao.prazoResposta);
  const diasRestantes = Math.ceil((prazoData.getTime() - Date.now()) / 86400000);

  return (
    <div className="portal">
      <form className="portal__cartao" onSubmit={pedirConfirmacao} noValidate>
        <MarcaPorto />

        <header className="portal__topo">
          <div>
            <p className="portal__etiqueta">Pedido de cotação {cotacao.numeroFormatado}</p>
            <h1>{cotacao.titulo}</h1>
            <p className="portal__sub">
              Para <strong>{cotacao.fornecedor.nomeFantasia ?? cotacao.fornecedor.razaoSocial}</strong>
            </p>
          </div>

          <div className="portal__prazo">
            <Selo tipo={diasRestantes <= 2 ? 'erro' : diasRestantes <= 5 ? 'atencao' : 'info'}>
              {diasRestantes <= 0
                ? 'Último dia'
                : diasRestantes === 1
                  ? 'Falta 1 dia'
                  : 'Faltam ' + diasRestantes + ' dias'}
            </Selo>
            <p className="portal__nota">
              Responder até {dataBr(prazoData.toISOString())}
            </p>
          </div>
        </header>

        {cotacao.jaRespondeu && (
          <div className="aviso aviso--info">
            <Icone nome="informacao" className="aviso__icone" />
            <div>
              <strong>Você já respondeu esta cotação.</strong>
              <p>
                Os campos estão preenchidos com o que você enviou. Altere o que precisar
                e envie de novo — vale a última resposta.
              </p>
            </div>
          </div>
        )}

        {cotacao.observacoes && (
          <div className="aviso aviso--info">
            <Icone nome="prancheta" className="aviso__icone" />
            <div>
              <strong>Observações da Porto Inc.</strong>
              <p>{cotacao.observacoes}</p>
            </div>
          </div>
        )}

        {/* ---------------- Itens ---------------- */}
        <h2 className="portal__secao">
          Itens para cotar <span className="portal__contagem">{cotacao.itens.length}</span>
        </h2>

        {cotacao.itens.map((item, indice) => {
          const r = respostas[item.id];
          if (!r) return null;

          return (
            <fieldset key={item.id} className={'item-cotacao' + (r.disponivel ? '' : ' item-cotacao--sem')}>
              <legend className="apenas-leitor-tela">
                Item {indice + 1}: {item.descricao}
              </legend>

              {/* O PEDIDO: só leitura. É o que a Porto Inc. quer.
                  Separado do que o fornecedor responde por um traço,
                  para os dois lados nunca se confundirem. */}
              <div className="item-cotacao__cabecalho">
                <p className="item-cotacao__ordem">
                  {indice + 1} de {cotacao.itens.length}
                  <span className="item-cotacao__codigo mono">{item.codigo}</span>
                </p>
                <p className="item-cotacao__descricao">{item.descricao}</p>
                <p className="item-cotacao__quantidade">
                  {qtdBr(item.quantidade)} {item.unidadeMedida}
                </p>
              </div>

              {(item.especificacao || item.detalhes || item.normaTecnica) && (
                <div className="item-cotacao__especificacao">
                  {item.normaTecnica && (
                    <p>
                      <strong>Norma exigida:</strong> {item.normaTecnica}
                    </p>
                  )}
                  {item.detalhes && <p>{item.detalhes}</p>}
                  {item.especificacao && <p>{item.especificacao}</p>}
                </div>
              )}

              {r.disponivel ? (
                <div className="item-cotacao__resposta">
                  {/* O CAMPO GRANDE.
                      Ele carrega sozinho o motivo desta tela existir.
                      Antes era um <input type="number"> do mesmo
                      tamanho da marca e do modelo, e a tela inteira
                      parecia um questionário: quatro perguntas de
                      igual peso, quando só uma importa de verdade.

                      `inputmode="decimal"` abre o teclado numérico do
                      celular; `type="number"` abriria também, mas
                      recusa a máscara — o "R$" e os pontos fazem o
                      campo virar inválido e o valor some. */}
                  <label className="campo-preco" htmlFor={'preco-' + item.id}>
                    <span className="campo-preco__rotulo">
                      Seu preço por {item.unidadeMedida}
                    </span>
                    <span className="campo-preco__caixa">
                      <span className="campo-preco__moeda" aria-hidden="true">R$</span>
                      <input
                        id={'preco-' + item.id}
                        inputMode="decimal"
                        className="campo-preco__entrada"
                        placeholder="0,00"
                        value={r.valorUnitario.replace(/^R\$\s*/, '')}
                        onChange={(e) => mudar(item.id, 'valorUnitario', mascaraDinheiro(e.target.value))}
                        onBlur={() => mudar(item.id, 'valorUnitario', dinheiroCompleto(r.valorUnitario))}
                        aria-describedby={'conta-' + item.id}
                      />
                    </span>
                  </label>

                  {/* A conta em voz alta, viva.
                      É o que transforma o formulário em orçamento: o
                      vendedor vê o que está oferecendo enquanto
                      digita, e erro de casa decimal salta aos olhos. */}
                  <p className="item-cotacao__conta" id={'conta-' + item.id}>
                    {lerDinheiro(r.valorUnitario) === null ? (
                      <span className="item-cotacao__conta-vazia">
                        Informe o preço de uma unidade. A conta aparece aqui.
                      </span>
                    ) : (
                      <>
                        {qtdBr(item.quantidade)} {item.unidadeMedida} ×{' '}
                        {dinheiro(lerDinheiro(r.valorUnitario) ?? 0)} ={' '}
                        <strong>
                          {dinheiro(item.quantidade * (lerDinheiro(r.valorUnitario) ?? 0))}
                        </strong>
                      </>
                    )}
                  </p>

                  {/* Miúdos: ajudam o comprador, não travam ninguém. */}
                  <div className="item-cotacao__miudos">
                    <div className="campo">
                      <label className="campo__rotulo" htmlFor={'marca-' + item.id}>
                        Marca <span className="campo__opcional">(opcional)</span>
                      </label>
                      <input
                        id={'marca-' + item.id}
                        className="campo__entrada"
                        value={r.marca}
                        onChange={(e) => mudar(item.id, 'marca', e.target.value)}
                      />
                    </div>

                    <div className="campo">
                      <label className="campo__rotulo" htmlFor={'modelo-' + item.id}>
                        Modelo <span className="campo__opcional">(opcional)</span>
                      </label>
                      <input
                        id={'modelo-' + item.id}
                        className="campo__entrada"
                        value={r.modelo}
                        onChange={(e) => mudar(item.id, 'modelo', e.target.value)}
                      />
                    </div>

                    <div className="campo">
                      <label className="campo__rotulo" htmlFor={'prazo-' + item.id}>
                        Entrega em <span className="campo__opcional">(dias)</span>
                      </label>
                      <input
                        id={'prazo-' + item.id}
                        type="number"
                        min="0"
                        inputMode="numeric"
                        className="campo__entrada"
                        value={r.prazoEntregaDias}
                        onChange={(e) => mudar(item.id, 'prazoEntregaDias', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* A saída fica no FIM e em voz baixa. No topo, ela
                      competia com o preço pela atenção — e a resposta
                      comum é o preço, não a recusa. */}
                  <label className="opcao opcao--sem-estoque">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => mudar(item.id, 'disponivel', false)}
                    />
                    <span>Não trabalho com este item</span>
                  </label>
                </div>
              ) : (
                <div className="item-cotacao__recusado">
                  <p>Você marcou que não trabalha com este item.</p>
                  <button
                    type="button"
                    className="botao botao--discreto"
                    onClick={() => mudar(item.id, 'disponivel', true)}
                  >
                    Voltar a cotar
                  </button>
                </div>
              )}
            </fieldset>
          );
        })}

        {/* ---------------- Condições ---------------- */}
        <h2 className="portal__secao">Condições comerciais</h2>

        {/* Eram cinco campos numéricos nus em duas fileiras: frete,
            outros, entrada, parcelas, intervalo. A parte mais densa
            da página, e a menos importante. Agora são DUAS perguntas
            em português, cada uma com os seus campos dentro. */}
        <div className="pergunta">
          <p className="pergunta__titulo">Você cobra frete?</p>

          <div className="formulario__linha">
            <div className="campo">
              <label className="campo__rotulo" htmlFor="frete">
                Frete <span className="campo__opcional">(deixe vazio se for grátis)</span>
              </label>
              <input
                id="frete"
                inputMode="decimal"
                className="campo__entrada"
                placeholder="R$ 0,00"
                value={frete}
                onChange={(e) => setFrete(mascaraDinheiro(e.target.value))}
                onBlur={() => setFrete(dinheiroCompleto(frete))}
              />
            </div>

            <div className="campo">
              <label className="campo__rotulo" htmlFor="outros">
                Outros custos <span className="campo__opcional">(opcional)</span>
              </label>
              <input
                id="outros"
                inputMode="decimal"
                className="campo__entrada"
                placeholder="R$ 0,00"
                value={outros}
                onChange={(e) => setOutros(mascaraDinheiro(e.target.value))}
                onBlur={() => setOutros(dinheiroCompleto(outros))}
              />
            </div>
          </div>
        </div>

        <div className="pergunta">
          <p className="pergunta__titulo">Como você quer receber?</p>
          <p className="pergunta__ajuda">
            Deixe tudo vazio se for à vista.
          </p>

          <div className="formulario__linha">
            <div className="campo">
              <label className="campo__rotulo" htmlFor="entrada">
                Entrada <span className="campo__opcional">(%)</span>
              </label>
              <input
                id="entrada"
                type="number"
                min="0"
                max="100"
                inputMode="numeric"
                className="campo__entrada"
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
              />
            </div>

            <div className="campo">
              <label className="campo__rotulo" htmlFor="parcelas">
                Parcelas
              </label>
              <input
                id="parcelas"
                type="number"
                min="1"
                inputMode="numeric"
                className="campo__entrada"
                value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
              />
            </div>

            <div className="campo">
              <label className="campo__rotulo" htmlFor="intervalo">
                A cada <span className="campo__opcional">(dias)</span>
              </label>
              <input
                id="intervalo"
                type="number"
                min="1"
                inputMode="numeric"
                className="campo__entrada"
                placeholder="30"
                value={intervalo}
                onChange={(e) => setIntervalo(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="campo">
          <label className="campo__rotulo" htmlFor="obs">
            Observações
          </label>
          <textarea
            id="obs"
            className="campo__entrada campo__area campo__area--curta"
            rows={3}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Validade da proposta, condições de entrega..."
          />
        </div>

        {/* ---------------- Total ---------------- */}
        <div className="portal__resumo">
          <dl className="dados">
            <div>
              <dt>Itens</dt>
              <dd>{dinheiro(subtotal)}</dd>
            </div>
            {(lerDinheiro(frete) ?? 0) > 0 && (
              <div>
                <dt>Frete</dt>
                <dd>{dinheiro(lerDinheiro(frete) ?? 0)}</dd>
              </div>
            )}
            {(lerDinheiro(outros) ?? 0) > 0 && (
              <div>
                <dt>Outros</dt>
                <dd>{dinheiro(lerDinheiro(outros) ?? 0)}</dd>
              </div>
            )}
            {/* A soma fecha a própria lista, em vez de repetir
                "Total da proposta" 60px acima da barra fixa, que já
                diz isso. Aqui a pergunta é outra: DE ONDE veio o
                total. */}
            <div className="portal__resumo-soma">
              <dt>Total</dt>
              <dd>{dinheiro(total)}</dd>
            </div>
          </dl>
        </div>

        {erro && (
          <div className="aviso aviso--erro" role="alert">
            <Icone nome="alerta" className="aviso__icone" />
            <div>
              <strong>{erro}</strong>
              {detalhes.length > 0 && (
                <ul className="campo__erro-lista">
                  {detalhes.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <p className="portal__rodape">
          Porto Inc. · Este link é pessoal e vence em{' '}
          {dataBr(prazoData.toISOString())}. Não compartilhe.
        </p>

        {/* ---------------- A barra que não sai da tela ----------------

            No celular, o total e o botão ficavam no fim de uma página
            de rolagem longa: o vendedor digitava preço sem ver o que
            estava oferecendo, e só descobria o total depois de rolar
            tudo. Preso embaixo, o número acompanha cada tecla — que é
            como se monta um orçamento, não um formulário.

            É também onde o "falta preço" aparece agora, no lugar do
            aviso que ficava perdido no meio da página. */}
        <div className="portal__barra">
          <div className="portal__barra-conta">
            <span className="portal__barra-rotulo">Total da proposta</span>
            <strong className="portal__barra-valor">{dinheiro(total)}</strong>
          </div>

          <button
            type="submit"
            className="botao botao--principal"
            disabled={enviando || faltamPrecos > 0}
          >
            {enviando
              ? 'Enviando...'
              : cotacao.jaRespondeu
                ? 'Atualizar minha cotação'
                : 'Enviar cotação'}
          </button>

          {faltamPrecos > 0 && (
            <p className="portal__barra-pendencia" role="status">
              <Icone nome="alerta" />
              {faltamPrecos === 1
                ? 'Falta o preço de 1 item'
                : 'Faltam os preços de ' + faltamPrecos + ' itens'}
            </p>
          )}
        </div>

        {/* ---------------- A conferência antes de enviar ----------------

            MODAL QUE SÓ PERGUNTA "TEM CERTEZA?" É QUEBRA-MOLAS: em
            três dias a pessoa aprende a clicar em "Sim" sem ler, e
            aí ele atrasa o trabalho sem proteger de nada. Por isso
            a pergunta está no TÍTULO, e o corpo é a única coisa que
            dá para conferir — o que ela digitou.

            É a mesma regra do `ConfirmarEnvio`, a janela que o
            comprador vê antes de mandar o convite. Aqui o papel se
            inverte: do outro lado está o vendedor, e o que ele
            arrisca é um dígito.

            IDEIA DELE, em 10/10/2026, e melhor que as três que eu
            tinha proposto. As minhas remediavam DEPOIS — carência
            de quinze minutos, botão de pedir correção ao comprador.
            Esta previne antes, que é o único momento em que sai de
            graça: a cotação enviada é final. */}
        <Modal
          aberto={confirmando}
          aoFechar={() => setConfirmando(false)}
          titulo={
            cotacao.jaRespondeu ? 'Confira antes de atualizar' : 'Confira antes de enviar'
          }
          descricao="Depois de enviar, esta cotação não aceita mais mudanças."
          acoes={
            <>
              <button
                type="button"
                className="botao botao--secundario"
                onClick={() => setConfirmando(false)}
                disabled={enviando}
              >
                Voltar e corrigir
              </button>
              <button
                type="button"
                className="botao botao--principal"
                onClick={() => void enviar()}
                disabled={enviando}
              >
                {enviando
                  ? 'Enviando...'
                  : cotacao.jaRespondeu
                    ? 'Confirmar e atualizar'
                    : 'Confirmar e enviar'}
              </button>
            </>
          }
        >
          <ul className="portal__conferencia">
            {cotacao.itens.map((item) => {
              const r = respostas[item.id];
              const unitario = lerDinheiro(r?.valorUnitario ?? '') ?? 0;

              return (
                <li key={item.id}>
                  <span className="portal__conferencia-item">
                    {item.descricao}
                    <span className="portal__conferencia-qtd">
                      {qtdBr(item.quantidade)} {item.unidadeMedida}
                      {r?.disponivel && ' × ' + dinheiro(unitario)}
                    </span>
                  </span>
                  <span
                    className={
                      'portal__conferencia-valor' +
                      (r?.disponivel ? '' : ' portal__conferencia-valor--fora')
                    }
                  >
                    {r?.disponivel
                      ? dinheiro(item.quantidade * unitario)
                      : 'não tenho'}
                  </span>
                </li>
              );
            })}
          </ul>

          <dl className="dados">
            {(lerDinheiro(frete) ?? 0) > 0 && (
              <div>
                <dt>Frete</dt>
                <dd>{dinheiro(lerDinheiro(frete) ?? 0)}</dd>
              </div>
            )}
            {(lerDinheiro(outros) ?? 0) > 0 && (
              <div>
                <dt>Outros</dt>
                <dd>{dinheiro(lerDinheiro(outros) ?? 0)}</dd>
              </div>
            )}
            {(entrada || parcelas) && (
              <div>
                <dt>Pagamento</dt>
                <dd>
                  {[
                    //  `porcento` e não `entrada + '%'`: número colado
                    //  em texto no JavaScript sai com o ponto do
                    //  inglês, e aqui ele fica ao lado de "R$ 10.020,00".
                    entrada && 'entrada de ' + porcento(Number(entrada)),
                    parcelas &&
                      parcelas +
                        'x' +
                        (intervalo ? ' a cada ' + plural(Number(intervalo), 'dia', 'dias') : ''),
                  ]
                    .filter(Boolean)
                    .join(' + ')}
                </dd>
              </div>
            )}
            <div className="portal__resumo-soma">
              <dt>Total</dt>
              <dd>{dinheiro(total)}</dd>
            </div>
          </dl>
        </Modal>
      </form>
    </div>
  );
}

function MarcaPorto() {
  return (
    <div className="portal__marca">
      Porto Inc<span className="portal__ponto">.</span>
    </div>
  );
}
