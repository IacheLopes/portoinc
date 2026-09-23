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
  type CotacaoDoPortal, type ItemDoPortal,
} from '../servicos/cotacoes';
import { dinheiro, quantidade as qtdBr } from '../servicos/cadastros';
import { Carregando } from '../componentes/Estado';
import { Selo } from '../componentes/Selo';

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
    valorUnitario: m?.valorUnitario != null ? String(m.valorUnitario) : '',
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
  const [erroAbertura, setErroAbertura] = useState<string | null>(null);

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

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroAbertura(null);

    try {
      const r = await abrirPortal(token);
      setCotacao(r.cotacao);

      const iniciais: Record<string, RespostaItem> = {};
      for (const i of r.cotacao.itens) iniciais[i.id] = respostaInicial(i);
      setRespostas(iniciais);

      const c = r.cotacao.minhasCondicoes;
      setFrete(c.valorFrete != null ? String(c.valorFrete) : '');
      setOutros(c.outrosCustos != null ? String(c.outrosCustos) : '');
      setEntrada(c.percentualEntrada != null ? String(c.percentualEntrada) : '');
      setParcelas(c.quantidadeParcelas != null ? String(c.quantidadeParcelas) : '');
      setIntervalo(c.intervaloParcelasDias != null ? String(c.intervaloParcelasDias) : '');
      setObservacao(c.observacaoFornecedor ?? '');
    } catch (e) {
      setErroAbertura(e instanceof Error ? e.message : 'Não foi possível abrir a cotação.');
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
    if (!r?.disponivel || !r.valorUnitario) return soma;
    return soma + i.quantidade * Number(r.valorUnitario);
  }, 0);

  const total = subtotal + (Number(frete) || 0) + (Number(outros) || 0);

  const faltamPrecos = (cotacao?.itens ?? []).filter((i) => {
    const r = respostas[i.id];
    return r?.disponivel && !r.valorUnitario;
  }).length;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
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
            valorUnitario: x.disponivel && x.valorUnitario ? Number(x.valorUnitario) : null,
            marca: x.marca || undefined,
            modelo: x.modelo || undefined,
            prazoEntregaDias: x.prazoEntregaDias ? Number(x.prazoEntregaDias) : null,
            observacao: x.observacao || undefined,
          };
        }),
        valorFrete: frete ? Number(frete) : null,
        outrosCustos: outros ? Number(outros) : null,
        percentualEntrada: entrada ? Number(entrada) : null,
        quantidadeParcelas: parcelas ? Number(parcelas) : null,
        intervaloParcelasDias: intervalo ? Number(intervalo) : null,
        observacaoFornecedor: observacao || undefined,
      });

      setEnviado({ total: r.resumo.total, itens: r.resumo.itensCotados });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
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

  if (erroAbertura || !cotacao) {
    return (
      <div className="portal">
        <div className="portal__cartao">
          <MarcaPorto />
          <div className="aviso aviso--erro" role="alert">
            <span className="aviso__icone" aria-hidden="true">⚠</span>
            <div>
              <strong>{erroAbertura}</strong>
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
            <span className="portal__sucesso-icone" aria-hidden="true">✓</span>
            <h1>Cotação enviada!</h1>
            <p>
              Recebemos sua proposta de <strong>{dinheiro(enviado.total)}</strong> para{' '}
              {enviado.itens} item(ns).
            </p>
            <p className="portal__nota">
              O comprador da Porto Inc. vai analisar e entrar em contato. Você pode
              revisar sua resposta até <strong>{new Date(cotacao.prazoResposta).toLocaleDateString('pt-BR')}</strong>{' '}
              reabrindo este mesmo link.
            </p>
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => {
                setEnviado(null);
                setEnviando(false);
                void carregar();
              }}
            >
              Revisar minha resposta
            </button>
          </div>
        </div>
      </div>
    );
  }

  const prazoData = new Date(cotacao.prazoResposta);
  const diasRestantes = Math.ceil((prazoData.getTime() - Date.now()) / 86400000);

  return (
    <div className="portal">
      <form className="portal__cartao" onSubmit={enviar} noValidate>
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
              Responder até {prazoData.toLocaleDateString('pt-BR')}
            </p>
          </div>
        </header>

        {cotacao.jaRespondeu && (
          <div className="aviso aviso--info">
            <span className="aviso__icone" aria-hidden="true">ℹ</span>
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
            <span className="aviso__icone" aria-hidden="true">📋</span>
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

              <div className="item-cotacao__cabecalho">
                <div>
                  <p className="item-cotacao__codigo mono">{item.codigo}</p>
                  <p className="item-cotacao__descricao">{item.descricao}</p>
                  <p className="item-cotacao__quantidade">
                    <strong>{qtdBr(item.quantidade)} {item.unidadeMedida}</strong>
                  </p>
                </div>

                <label className="opcao opcao--sem-estoque">
                  <input
                    type="checkbox"
                    checked={!r.disponivel}
                    onChange={(e) => mudar(item.id, 'disponivel', !e.target.checked)}
                  />
                  <span>Não tenho este item</span>
                </label>
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

              {r.disponivel && (
                <div className="item-cotacao__campos">
                  <div className="campo">
                    <label className="campo__rotulo" htmlFor={'preco-' + item.id}>
                      Preço por {item.unidadeMedida} (R$)
                    </label>
                    <input
                      id={'preco-' + item.id}
                      type="number"
                      step="0.01"
                      min="0"
                      className="campo__entrada"
                      value={r.valorUnitario}
                      onChange={(e) => mudar(item.id, 'valorUnitario', e.target.value)}
                      aria-invalid={!r.valorUnitario}
                    />
                  </div>

                  <div className="campo">
                    <label className="campo__rotulo" htmlFor={'marca-' + item.id}>
                      Marca
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
                      Modelo
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
                      Entrega em (dias)
                    </label>
                    <input
                      id={'prazo-' + item.id}
                      type="number"
                      min="0"
                      className="campo__entrada"
                      value={r.prazoEntregaDias}
                      onChange={(e) => mudar(item.id, 'prazoEntregaDias', e.target.value)}
                    />
                  </div>

                  {r.valorUnitario && (
                    <p className="item-cotacao__total">
                      Total deste item:{' '}
                      <strong>{dinheiro(item.quantidade * Number(r.valorUnitario))}</strong>
                    </p>
                  )}
                </div>
              )}
            </fieldset>
          );
        })}

        {/* ---------------- Condições ---------------- */}
        <h2 className="portal__secao">Condições comerciais</h2>

        <div className="formulario__linha">
          <div className="campo">
            <label className="campo__rotulo" htmlFor="frete">
              Frete (R$)
            </label>
            <input
              id="frete"
              type="number"
              step="0.01"
              min="0"
              className="campo__entrada"
              value={frete}
              onChange={(e) => setFrete(e.target.value)}
            />
            <p className="campo__ajuda">Deixe vazio se a entrega for sem custo.</p>
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="outros">
              Outros custos (R$)
            </label>
            <input
              id="outros"
              type="number"
              step="0.01"
              min="0"
              className="campo__entrada"
              value={outros}
              onChange={(e) => setOutros(e.target.value)}
            />
          </div>
        </div>

        <div className="formulario__linha">
          <div className="campo">
            <label className="campo__rotulo" htmlFor="entrada">
              Entrada (%)
            </label>
            <input
              id="entrada"
              type="number"
              min="0"
              max="100"
              className="campo__entrada"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
            />
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="parcelas">
              Nº de parcelas
            </label>
            <input
              id="parcelas"
              type="number"
              min="1"
              className="campo__entrada"
              value={parcelas}
              onChange={(e) => setParcelas(e.target.value)}
            />
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="intervalo">
              Intervalo (dias)
            </label>
            <input
              id="intervalo"
              type="number"
              min="1"
              className="campo__entrada"
              value={intervalo}
              onChange={(e) => setIntervalo(e.target.value)}
            />
            <p className="campo__ajuda">Ex.: 30 para parcelas mensais.</p>
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

        {/* ---------------- Total e envio ---------------- */}
        <div className="portal__resumo">
          <dl className="dados">
            <div>
              <dt>Itens</dt>
              <dd>{dinheiro(subtotal)}</dd>
            </div>
            {Number(frete) > 0 && (
              <div>
                <dt>Frete</dt>
                <dd>{dinheiro(Number(frete))}</dd>
              </div>
            )}
            {Number(outros) > 0 && (
              <div>
                <dt>Outros</dt>
                <dd>{dinheiro(Number(outros))}</dd>
              </div>
            )}
          </dl>
          <p className="portal__total">
            Total da proposta: <strong>{dinheiro(total)}</strong>
          </p>
        </div>

        {faltamPrecos > 0 && (
          <div className="aviso aviso--atencao">
            <span className="aviso__icone" aria-hidden="true">⚠</span>
            <div>
              <strong>{faltamPrecos} item(ns) sem preço.</strong>
              <p>
                Informe o preço, ou marque <strong>"Não tenho este item"</strong> se você
                não trabalha com ele.
              </p>
            </div>
          </div>
        )}

        {erro && (
          <div className="aviso aviso--erro" role="alert">
            <span className="aviso__icone" aria-hidden="true">⚠</span>
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

        <button
          type="submit"
          className="botao botao--principal botao--largo"
          disabled={enviando || faltamPrecos > 0}
        >
          {enviando ? 'Enviando...' : cotacao.jaRespondeu ? 'Atualizar minha cotação' : 'Enviar cotação'}
        </button>

        <p className="portal__rodape">
          Porto Inc. · Este link é pessoal e vence em{' '}
          {prazoData.toLocaleDateString('pt-BR')}. Não compartilhe.
        </p>
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
