// ============================================================
//  Locação de equipamentos
//
//  A tela responde, nesta ordem:
//
//    1. Tem equipamento parado custando dinheiro? → atrasadas
//    2. O que vence nos próximos dias?            → vencendo
//    3. Quanto a locação já está custando?        → em andamento
//    4. O que exatamente está alugado?            → tabela
//
//  O número que mais importa não é "quantas locações existem",
//  é "quanto o atraso já custou". Por isso ele é um cartão
//  próprio, em vermelho, e não uma coluna escondida na tabela.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import {
  buscarLocacoes, contratarLocacao, devolverLocacao, cancelarLocacao,
  listarItensComprados, exportarLocacoes,
  ROTULO_PERIODICIDADE, COR_ALERTA, FILTROS_DE_ALERTA,
  type PainelDeLocacao, type Locacao, type ItemComprado, type Periodicidade,
} from '../../servicos/locacao';
import { listarFornecedores, dinheiro, type Fornecedor } from '../../servicos/cadastros';
import { dataBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, Selecao } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { CartaoIndicador } from '../../componentes/Graficos';
import { BotaoBaixar, type FormatoDeArquivo } from '../../componentes/BotaoBaixar';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';

const UNIDADES = ['DIA', 'SEMANA', 'MES', 'UN', 'M', 'M2', 'M3'];

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emDiasIso(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function PainelLocacao() {
  const { pode } = useAutenticacao();
  const podeGerenciar = pode('locacao.gerenciar');

  const [dados, setDados] = useState<PainelDeLocacao | null>(null);
  const [obraId, setObraId] = useState('');
  const [alerta, setAlerta] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [baixando, setBaixando] = useState(false);

  // --- Contratar ---
  const [contratando, setContratando] = useState(false);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [comprados, setComprados] = useState<ItemComprado[]>([]);
  const [origem, setOrigem] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [obraDoContrato, setObraDoContrato] = useState('');
  const [descricao, setDescricao] = useState('');
  const [identificacao, setIdentificacao] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [unidade, setUnidade] = useState('DIA');
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>('DIARIA');
  const [valorPeriodo, setValorPeriodo] = useState('');
  const [inicioEm, setInicioEm] = useState(hojeIso());
  const [previsao, setPrevisao] = useState(emDiasIso(30));

  // --- Devolver e cancelar ---
  const [devolvendo, setDevolvendo] = useState<Locacao | null>(null);
  const [dataDevolucao, setDataDevolucao] = useState(hojeIso());
  const [motivo, setMotivo] = useState('');
  const [cancelando, setCancelando] = useState<Locacao | null>(null);

  const carregar = useCallback(async (obra = obraId, filtro = alerta) => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await buscarLocacoes({
        obraId: obra || undefined,
        alerta: filtro || undefined,
      }));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar as locações.');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function abrirContrato() {
    setContratando(true);
    setErro(null);
    try {
      const [f, c] = await Promise.all([listarFornecedores(), listarItensComprados()]);
      setFornecedores(f.fornecedores);
      setComprados(c.itens);
    } catch {
      // O formulário continua servindo para contrato avulso.
      setComprados([]);
    }
  }

  /** Escolher um item já comprado preenche o resto do formulário. */
  function usarItemComprado(pedidoItemId: string) {
    setOrigem(pedidoItemId);

    const item = comprados.find((i) => i.pedidoItemId === pedidoItemId);
    if (!item) return;

    setFornecedorId(item.fornecedor.id);
    setObraDoContrato(item.obra.id);
    setDescricao(item.material.descricao);
    setQuantidade(String(item.quantidade));
    setUnidade(item.unidadeMedida);
    setValorPeriodo(String(item.valorUnitario));
    setInicioEm(item.saiuEm.slice(0, 10));
  }

  function limparFormulario() {
    setContratando(false);
    setOrigem('');
    setFornecedorId('');
    setObraDoContrato('');
    setDescricao('');
    setIdentificacao('');
    setQuantidade('1');
    setUnidade('DIA');
    setPeriodicidade('DIARIA');
    setValorPeriodo('');
    setInicioEm(hojeIso());
    setPrevisao(emDiasIso(30));
  }

  async function confirmarContrato() {
    setOcupado(true);
    setErro(null);
    try {
      const r = await contratarLocacao({
        fornecedorId,
        obraId: obraDoContrato,
        pedidoItemId: origem || null,
        materialId: comprados.find((i) => i.pedidoItemId === origem)?.material.id ?? null,
        descricao,
        identificacao: identificacao || undefined,
        quantidade: Number(quantidade),
        unidadeMedida: unidade,
        periodicidade,
        valorPeriodo: Number(valorPeriodo),
        inicioEm,
        previsaoDevolucao: previsao,
      });

      setAviso('Locação ' + r.contrato.numeroFormatado + ' registrada.');
      limparFormulario();
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao registrar a locação.');
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarDevolucao() {
    if (!devolvendo) return;

    setOcupado(true);
    setErro(null);
    try {
      const r = await devolverLocacao(devolvendo.id, {
        devolvidoEm: dataDevolucao,
        motivo: motivo || undefined,
      });

      setAviso(devolvendo.numeroFormatado + ': ' + r.mensagem);
      setDevolvendo(null);
      setMotivo('');
      setDataDevolucao(hojeIso());
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao registrar a devolução.');
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarCancelamento() {
    if (!cancelando) return;

    setOcupado(true);
    setErro(null);
    try {
      await cancelarLocacao(cancelando.id, motivo);
      setAviso(cancelando.numeroFormatado + ' cancelada.');
      setCancelando(null);
      setMotivo('');
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao cancelar.');
    } finally {
      setOcupado(false);
    }
  }

  async function baixar(formato: FormatoDeArquivo) {
    setBaixando(true);
    try {
      await exportarLocacoes(formato, {
        obraId: obraId || undefined,
        alerta: alerta || undefined,
      });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao gerar o arquivo.');
    } finally {
      setBaixando(false);
    }
  }

  if (carregando && !dados) return <Carregando mensagem="Conferindo o que está alugado..." />;
  if (erro && !dados) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  if (!dados) return null;

  const { resumo, contratos } = dados;

  return (
    <section className="secao">
      <CabecalhoDePagina
          titulo="Locação de equipamentos"
          descricao={
            <>
              Equipamento alugado tem relógio correndo: o custo sobe sozinho enquanto
          ele não volta. Esta tela mostra o que está parado além do combinado.
            </>
          }
        />

      {aviso && (
        <p className="aviso aviso--sucesso" role="status">
          <span aria-hidden="true">✓</span> {aviso}
        </p>
      )}

      {erro && (
        <p className="aviso aviso--erro" role="alert">
          <span aria-hidden="true">⚠</span> {erro}
        </p>
      )}

      {resumo.atrasadas > 0 && (
        <div className="aviso aviso--erro">
          <span className="aviso__icone" aria-hidden="true">⚠</span>
          <div>
            <strong>
              {resumo.atrasadas} equipamento(s) parado(s) além do combinado.
            </strong>
            <p>
              O atraso já custou <strong>{dinheiro(resumo.desperdicio)}</strong>. Cada
              dia a mais continua contando.
            </p>
          </div>
        </div>
      )}

      <div className="barra-acoes">
        <Selecao
          rotulo="Obra"
          valor={obraId}
          aoMudar={(v) => { setObraId(v); void carregar(v, alerta); }}
          semMarcaOpcional
          vazio="Todas as obras"
          opcoes={dados.obras.map((o) => ({ valor: o.id, rotulo: o.codigo + ' — ' + o.nome }))}
        />

        <Selecao
          rotulo="Situação"
          valor={alerta}
          aoMudar={(v) => { setAlerta(v); void carregar(obraId, v); }}
          semMarcaOpcional
          opcoes={FILTROS_DE_ALERTA.map((f) => ({ valor: f.valor, rotulo: f.rotulo }))}
        />

        {podeGerenciar && !contratando && (
          <button
            type="button"
            className="botao botao--principal"
            onClick={() => void abrirContrato()}
          >
            + Nova locação
          </button>
        )}

        <BotaoBaixar
          aoEscolher={(f) => void baixar(f)}
          ocupado={baixando}
          descricao="locação de equipamentos"
        />
      </div>

      <div className="painel-relatorio">
        <CartaoIndicador
          rotulo="Atrasadas"
          valor={String(resumo.atrasadas)}
          detalhe={
            resumo.atrasadas === 0
              ? 'Nada parado além do prazo'
              : 'Passaram da data combinada'
          }
          explicacao="Equipamento que já deveria ter voltado e continua no canteiro. Cada dia a mais é mais uma diária."
          destaque={resumo.atrasadas > 0 ? 'erro' : 'sucesso'}
        />

        <CartaoIndicador
          rotulo="Custo do atraso"
          valor={dinheiro(resumo.desperdicio)}
          detalhe="O que se paga a mais"
          explicacao="Quanto já se pagou além do que custaria se tudo tivesse voltado na data combinada. É o dinheiro que dá para economizar."
          destaque={resumo.desperdicio > 0 ? 'erro' : 'sucesso'}
        />

        <CartaoIndicador
          rotulo="Vencendo"
          valor={String(resumo.vencendo)}
          detalhe="Vencem hoje ou em breve"
          explicacao="Aviso com antecedência: entre pedir a retirada e o fornecedor aparecer costuma passar alguns dias, e cada um é mais uma diária."
          destaque={resumo.vencendo > 0 ? 'atencao' : undefined}
        />

        <CartaoIndicador
          rotulo="Em andamento"
          valor={dinheiro(resumo.custoEmAndamento)}
          detalhe={resumo.ativas + ' locação(ões) ativa(s)'}
          explicacao="Quanto os equipamentos que ainda estão na obra já custaram até hoje. Este número sobe sozinho."
          destaque="info"
        />
      </div>

      {/* ------------------------------------------------------
          Contratar
          ------------------------------------------------------ */}
      {contratando && (
        <div className="cartao painel-movimento">
          <div className="secao__cabecalho">
            <h2>Nova locação</h2>
            <p className="secao__descricao">
              Se o equipamento veio de um pedido de compra, escolha-o abaixo e o
              resto se preenche sozinho.
            </p>
          </div>

          {comprados.length > 0 && (
            <Selecao
              rotulo="Veio de um pedido?"
              valor={origem}
              aoMudar={usarItemComprado}
              vazio="Não — locação avulsa"
              ajuda="Só aparecem itens de locação já comprados que ainda não viraram contrato."
              opcoes={comprados.map((i) => ({
                valor: i.pedidoItemId,
                rotulo: 'PC-' + String(i.pedidoNumero).padStart(5, '0') + ' · ' +
                  i.material.descricao + ' · ' + i.obra.codigo,
              }))}
            />
          )}

          <div className="formulario__linha">
            <Selecao
              rotulo="Fornecedor"
              valor={fornecedorId}
              aoMudar={setFornecedorId}
              obrigatorio
              vazio="Escolha..."
              opcoes={fornecedores.map((f) => ({
                valor: f.id,
                rotulo: f.nomeFantasia ?? f.razaoSocial,
              }))}
            />
            <Selecao
              rotulo="Obra"
              valor={obraDoContrato}
              aoMudar={setObraDoContrato}
              obrigatorio
              vazio="Escolha..."
              opcoes={dados.obras.map((o) => ({
                valor: o.id,
                rotulo: o.codigo + ' — ' + o.nome,
              }))}
            />
          </div>

          <div className="formulario__linha">
            <Campo
              rotulo="Equipamento"
              valor={descricao}
              aoMudar={setDescricao}
              obrigatorio
              exemplo="Betoneira 400L"
            />
            <Campo
              rotulo="Identificação"
              valor={identificacao}
              aoMudar={setIdentificacao}
              ajuda="Placa, número de série ou patrimônio."
              exemplo="BET-014"
            />
          </div>

          <div className="formulario__linha">
            <Campo
              rotulo="Quantidade"
              valor={quantidade}
              aoMudar={setQuantidade}
              obrigatorio
              semMarcaOpcional
            />
            <Selecao
              rotulo="Unidade"
              valor={unidade}
              aoMudar={setUnidade}
              obrigatorio
              opcoes={UNIDADES.map((u) => ({ valor: u, rotulo: u }))}
            />
            <Selecao
              rotulo="Cobrança"
              valor={periodicidade}
              aoMudar={(v) => setPeriodicidade(v as Periodicidade)}
              obrigatorio
              opcoes={(['DIARIA', 'SEMANAL', 'MENSAL'] as Periodicidade[]).map((p) => ({
                valor: p,
                rotulo: ROTULO_PERIODICIDADE[p],
              }))}
            />
            <Campo
              rotulo="Valor do período"
              valor={valorPeriodo}
              aoMudar={setValorPeriodo}
              obrigatorio
              ajuda="Quanto o fornecedor cobra por dia, semana ou mês."
              exemplo="65"
            />
          </div>

          <div className="formulario__linha">
            <Campo
              rotulo="Início"
              valor={inicioEm}
              aoMudar={setInicioEm}
              tipo="date"
              obrigatorio
            />
            <Campo
              rotulo="Devolução prevista"
              valor={previsao}
              aoMudar={setPrevisao}
              tipo="date"
              obrigatorio
              ajuda="É esta data que dispara o aviso. Sem ela não há como avisar nada."
            />
          </div>

          <div className="formulario__acoes formulario__acoes--fim">
            <button type="button" className="botao botao--discreto" onClick={limparFormulario}>
              Cancelar
            </button>
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => void confirmarContrato()}
              disabled={ocupado || !fornecedorId || !obraDoContrato || !descricao || !valorPeriodo}
            >
              {ocupado ? 'Registrando...' : 'Registrar locação'}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------
          Devolver
          ------------------------------------------------------ */}
      {devolvendo && (
        <div className="cartao painel-movimento">
          <div className="secao__cabecalho">
            <h2>Devolver {devolvendo.numeroFormatado}</h2>
            <p className="secao__descricao">
              {devolvendo.descricao} · {devolvendo.obra.codigo} ·{' '}
              previsto para {dataBr(devolvendo.previsaoDevolucao)}
            </p>
          </div>

          <div className="formulario__linha">
            <Campo
              rotulo="Devolvido em"
              valor={dataDevolucao}
              aoMudar={setDataDevolucao}
              tipo="date"
              obrigatorio
              ajuda="É esta data que encerra a contagem das diárias."
            />
            <Campo
              rotulo="Observação"
              valor={motivo}
              aoMudar={setMotivo}
              exemplo="Retirado pelo fornecedor"
            />
          </div>

          <div className="formulario__acoes formulario__acoes--fim">
            <button
              type="button"
              className="botao botao--discreto"
              onClick={() => { setDevolvendo(null); setMotivo(''); }}
            >
              Voltar
            </button>
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => void confirmarDevolucao()}
              disabled={ocupado}
            >
              {ocupado ? 'Registrando...' : 'Confirmar devolução'}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------
          Cancelar
          ------------------------------------------------------ */}
      {cancelando && (
        <div className="cartao painel-movimento">
          <div className="secao__cabecalho">
            <h2>Cancelar {cancelando.numeroFormatado}</h2>
            <p className="secao__descricao">
              Cancelar é para contrato que não chegou a existir de verdade. O que já
              aconteceu deve ser registrado como devolução.
            </p>
          </div>

          <Campo
            rotulo="Por que está cancelando?"
            valor={motivo}
            aoMudar={setMotivo}
            obrigatorio
            exemplo="Equipamento nunca foi entregue"
          />

          <div className="formulario__acoes formulario__acoes--fim">
            <button
              type="button"
              className="botao botao--discreto"
              onClick={() => { setCancelando(null); setMotivo(''); }}
            >
              Voltar
            </button>
            <button
              type="button"
              className="botao botao--perigo"
              onClick={() => void confirmarCancelamento()}
              disabled={ocupado || motivo.trim().length < 3}
            >
              {ocupado ? 'Cancelando...' : 'Cancelar locação'}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------
          A lista
          ------------------------------------------------------ */}
      {contratos.length === 0 ? (
        <Vazio
          titulo={alerta ? 'Nenhuma locação nesta situação' : 'Nenhuma locação registrada'}
          descricao={
            alerta
              ? 'Troque o filtro de situação para ver as demais.'
              : podeGerenciar
                ? 'Use "+ Nova locação" para registrar um equipamento alugado.'
                : 'Quando o comprador registrar uma locação, ela aparece aqui.'
          }
        />
      ) : (
        <div className="tabela-area">
          <table className="tabela">
            <caption className="apenas-leitor-tela">
              Equipamentos alugados, com o que já custaram e quando precisam voltar.
            </caption>
            <thead>
              <tr>
                <th scope="col">Contrato</th>
                <th scope="col">Equipamento</th>
                <th scope="col">Obra</th>
                <th scope="col">Cobrança</th>
                <th scope="col">Devolução</th>
                <th scope="col" className="celula-valor">Já custou</th>
                <th scope="col" className="celula-valor">Atraso</th>
                <th scope="col">Situação</th>
                {podeGerenciar && <th scope="col">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id} className={c.alerta === 'ATRASADA' ? 'linha-vencida' : undefined}>
                  <th scope="row" className="celula-texto">
                    <span className="mono">{c.numeroFormatado}</span>
                    {c.pedido && (
                      <span className="celula-extra">
                        de PC-{String(c.pedido.numero).padStart(5, '0')}
                      </span>
                    )}
                  </th>

                  <td className="celula-texto">
                    {c.descricao}
                    <span className="celula-extra">
                      {c.quantidade} {c.unidadeMedida}
                      {c.identificacao && ' · ' + c.identificacao}
                    </span>
                  </td>

                  <td className="celula-texto">
                    {c.obra.codigo}
                    <span className="celula-extra">
                      {c.fornecedor.nomeFantasia ?? c.fornecedor.razaoSocial}
                    </span>
                  </td>

                  <td className="celula-texto">
                    {dinheiro(c.valorPeriodo)}
                    <span className="celula-extra">{c.periodicidadeRotulo}</span>
                  </td>

                  <td className="celula-texto">
                    {dataBr(c.previsaoDevolucao)}
                    <span className="celula-extra">
                      {c.devolvidoEm ? 'voltou ' + dataBr(c.devolvidoEm) : c.diasDeUso + ' dia(s)'}
                    </span>
                  </td>

                  <td className="celula-valor">
                    {dinheiro(c.custoAcumulado)}
                    <span className="celula-extra">{c.periodosCobrados} período(s)</span>
                  </td>

                  <td className={'celula-valor' + (c.custoDoAtraso > 0 ? ' valor-negativo' : '')}>
                    {c.diasDeAtraso > 0 ? dinheiro(c.custoDoAtraso) : '—'}
                    {c.diasDeAtraso > 0 && (
                      <span className="celula-extra">{c.diasDeAtraso} dia(s)</span>
                    )}
                  </td>

                  <td>
                    <Selo tipo={COR_ALERTA[c.alerta]}>{c.alertaRotulo}</Selo>
                  </td>

                  {podeGerenciar && (
                    <td>
                      {c.situacao === 'ATIVA' ? (
                        <div className="acoes-linha">
                          <button
                            type="button"
                            className="botao botao--secundario"
                            onClick={() => {
                              setDevolvendo(c);
                              setCancelando(null);
                              setMotivo('');
                              setDataDevolucao(hojeIso());
                            }}
                          >
                            Devolver
                          </button>
                          <button
                            type="button"
                            className="botao botao--link"
                            onClick={() => {
                              setCancelando(c);
                              setDevolvendo(null);
                              setMotivo('');
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <span className="texto-fraco">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {contratos.some((c) => c.alerta === 'ATRASADA' || c.alerta === 'PERTO') && (
        <div className="lista-alertas">
          <h2 className="secao__subtitulo">O que fazer agora</h2>
          <ul>
            {contratos
              .filter((c) => c.alerta === 'ATRASADA' || c.alerta === 'PERTO' || c.alerta === 'VENCE_HOJE')
              .map((c) => (
                <li key={c.id}>
                  <strong>{c.numeroFormatado} · {c.descricao}</strong> ({c.obra.codigo}) — {c.leitura}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
