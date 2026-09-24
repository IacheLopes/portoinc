// ============================================================
//  Painel financeiro
//
//  A tela responde, nesta ordem:
//
//    1. Tenho problema AGORA?      → vencidas
//    2. Tenho problema ESTA SEMANA? → vence em 7 dias
//    3. Quanto devo no total?       → em aberto
//    4. Como está o caixa nos próximos meses? → fluxo
//    5. Para quem devo e por qual obra?       → rankings
//    6. Quais parcelas exatamente?            → tabela
//
//  Os gráficos vêm ANTES da tabela porque respondem a perguntas
//  de gestão. A tabela é para quando você já sabe o que procura.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buscarPainel, listarTitulos, pagarTitulo, exportarContas,
  ROTULO_TITULO, COR_TITULO,
  type PainelFinanceiro as Dados, type Titulo,
} from '../../servicos/fiscal';
import { dinheiro } from '../../servicos/cadastros';
import { dataBr } from '../../servicos/solicitacoes';
import { plural, contar } from '../../servicos/texto';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, Selecao } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import {
  CartaoIndicador, GraficoFluxo, GraficoRosca, GraficoRanking, Medidor,
} from '../../componentes/Graficos';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { BotaoBaixar, type FormatoDeArquivo } from '../../componentes/BotaoBaixar';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { Modal } from '../../componentes/Modal';
import { TabelaArea } from '../../componentes/TabelaArea';

const FILTROS = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'vencidas', rotulo: 'Vencidas' },
  { valor: 'semana', rotulo: 'Vencem em 7 dias' },
];

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "set/26" do mês corrente, para destacar a coluna certa. */
function mesDeHoje(): string {
  const d = new Date();
  return MESES[d.getMonth()] + '/' + String(d.getFullYear()).slice(-2);
}

export function PainelFinanceiro() {
  const { pode } = useAutenticacao();
  const podeGerenciar = pode('financeiro.gerenciar');

  const [dados, setDados] = useState<Dados | null>(null);
  const [titulos, setTitulos] = useState<Titulo[]>([]);
  const [quando, setQuando] = useState('');
  const [situacao, setSituacao] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [pagando, setPagando] = useState<Titulo | null>(null);
  const [dataPagamento, setDataPagamento] = useState(hojeIso());
  const [forma, setForma] = useState('');
  const [valorPago, setValorPago] = useState('');

  const carregar = useCallback(
    async (filtroQuando = quando, filtroSituacao = situacao) => {
      setCarregando(true);
      setErro(null);
      try {
        const [p, t] = await Promise.all([
          buscarPainel(),
          listarTitulos({
            quando: filtroQuando || undefined,
            situacao: filtroSituacao || undefined,
          }),
        ]);
        setDados(p);
        setTitulos(t.titulos);
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar o financeiro.');
      } finally {
        setCarregando(false);
      }
    },
    [quando, situacao],
  );

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirBaixa(t: Titulo) {
    setPagando(t);
    setDataPagamento(hojeIso());
    setForma('');
    setValorPago(String(t.valor));
    setErro(null);
    setAviso(null);
  }

  function fecharBaixa() {
    setPagando(null);
    setErro(null);
  }

  /**
   * A pessoa mexeu no formulário, ou está do jeito que abriu?
   *
   * O modal usa isto para perguntar antes de jogar fora o que foi
   * preenchido. Sem a conta, ou ele pergunta sempre — e vira barulho
   * em quem só abriu por engano — ou nunca pergunta, e perde o que
   * a pessoa digitou.
   */
  const mexeuNaBaixa =
    pagando !== null &&
    (forma.trim() !== '' ||
      valorPago !== String(pagando.valor) ||
      dataPagamento !== hojeIso());

  async function confirmarBaixa() {
    if (!pagando) return;

    setOcupado(true);
    setErro(null);

    try {
      const valor = Number(valorPago.replace(',', '.'));

      const r = await pagarTitulo(pagando.id, {
        pagoEm: new Date(dataPagamento + 'T12:00:00').toISOString(),
        valorPago: Number.isFinite(valor) && valor > 0 ? valor : undefined,
        formaPagamento: forma.trim() || undefined,
      });

      setAviso(r.mensagem);
      setPagando(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível registrar o pagamento.');
    } finally {
      setOcupado(false);
    }
  }

  async function exportar(formato: FormatoDeArquivo) {
    try {
      await exportarContas(formato);
    } catch {
      setErro('Não foi possível gerar o arquivo.');
    }
  }

  if (carregando && !dados) return <Carregando mensagem="Montando o painel..." />;
  if (erro && !dados) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  if (!dados) return null;

  const { resumo, indicadores, fluxo, porFornecedor, porObra, carteira, notas } = dados;

  const temMovimento = dados.totalDeParcelas > 0;
  const proximo = indicadores.diasParaProximoVencimento;

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Financeiro"
          descricao={
            <>
              As parcelas nascem da nota fiscal, com as condições combinadas na cotação.
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

        {(notas.comPendencia > 0 || notas.semParcelas > 0) && (
          <div className="aviso aviso--atencao">
            <span className="aviso__icone" aria-hidden="true">⚠</span>
            <div>
              <strong>Tem nota esperando você.</strong>
              <p>
                {notas.comPendencia > 0 && (
                  <>{plural(notas.comPendencia, 'nota', 'notas')} com pendência de conferência. </>
                )}
                {notas.semParcelas > 0 && (
                  <>{plural(notas.semParcelas, 'nota', 'notas')} sem parcelas geradas. </>
                )}
                <Link to="/financeiro/notas">Ver notas fiscais</Link>
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------
            Uma grade só: cartões, indicadores e gráficos usam a
            mesma medida de coluna, então tudo se alinha de cima
            a baixo. Aponte (ou toque) em qualquer um para ver os
            números por trás.
            ------------------------------------------------------ */}
        <div className="painel-financeiro">
          <CartaoIndicador
            rotulo="Vencidas"
            valor={dinheiro(resumo.vencidas.valor)}
            detalhe={contar(resumo.vencidas.quantidade, 'parcela em atraso', 'parcelas em atraso', 'Nada atrasado')}
            explicacao="Parcelas que passaram do vencimento e ainda não foram pagas. É o único número que custa juros."
            destaque={resumo.vencidas.valor > 0 ? 'erro' : undefined}
          />

          <CartaoIndicador
            rotulo="Vencem em 7 dias"
            valor={dinheiro(resumo.proximos7Dias.valor)}
            detalhe={
              proximo === null
                ? 'Nada em aberto'
                : proximo < 0
                  ? 'A mais antiga venceu há ' + -proximo + ' dias'
                  : proximo === 0
                    ? 'A próxima vence hoje'
                    : proximo === 1
                      ? 'A próxima vence amanhã'
                      : 'A próxima vence em ' + proximo + ' dias'
            }
            explicacao="O que precisa entrar no fluxo de caixa desta semana."
            destaque={resumo.proximos7Dias.valor > 0 ? 'atencao' : undefined}
          />

          <CartaoIndicador
            rotulo="Total em aberto"
            valor={dinheiro(resumo.emAberto.valor)}
            detalhe={plural(resumo.emAberto.quantidade, 'parcela a pagar', 'parcelas a pagar')}
            explicacao="Tudo que a Porto Inc. ainda deve, somando todas as parcelas não pagas."
            destaque="info"
          />

          <CartaoIndicador
            rotulo="Pago no mês"
            valor={dinheiro(resumo.pagoNoMes.valor)}
            detalhe={plural(resumo.pagoNoMes.quantidade, 'baixa registrada', 'baixas registradas')}
            explicacao="Quanto já saiu do caixa desde o dia 1º deste mês."
            destaque="sucesso"
          />

          <CartaoIndicador
            rotulo="Prazo médio negociado"
            valor={indicadores.prazoMedioPagamento + ' dias'}
            detalhe="Da nota até o vencimento"
            explicacao="Quanto maior, mais fôlego de caixa o comprador conseguiu negociar com os fornecedores."
          />

          <CartaoIndicador
            rotulo="Maior parcela em aberto"
            valor={dinheiro(indicadores.maiorParcelaAberta)}
            detalhe="A que mais pesa no caixa"
            explicacao="Serve para planejar o mês: é o maior compromisso isolado que ainda vai vencer."
          />

          <CartaoIndicador
            rotulo="Parcela média"
            valor={dinheiro(indicadores.ticketMedio)}
            detalhe="Média do que está em aberto"
            explicacao="Tamanho típico de uma conta. Ajuda a perceber quando algo destoa do normal."
          />

          <CartaoIndicador
            rotulo="Notas lançadas no mês"
            valor={String(notas.lancadasNoMes)}
            detalhe={
              notas.semParcelas > 0
                ? notas.semParcelas + ' sem parcelas geradas'
                : 'Todas com parcelas'
            }
            explicacao="Volume de trabalho do financeiro no mês, e quantas notas ainda esperam a geração das parcelas."
            destaque={notas.semParcelas > 0 ? 'atencao' : undefined}
          />

          {temMovimento && (
            <>
              <Cartao className="col-cheia">
                <GraficoFluxo
                  colunas={fluxo}
                  titulo="Fluxo de caixa: o que já saiu e o que vem por aí"
                  destacar={mesDeHoje()}
                />
              </Cartao>

              <Cartao className="col-meia">
                <GraficoRosca
                  fatias={carteira}
                  titulo="Composição da carteira"
                  centroValor={dinheiro(resumo.emAberto.valor + resumo.pagoNoMes.valor)}
                  centroRotulo="em notas"
                />
              </Cartao>

              <Cartao className="col-meia">
                <Medidor
                  titulo="Pontualidade"
                  percentual={indicadores.pontualidade}
                  detalhe={
                    indicadores.pontualidade === 100
                      ? 'Todas as parcelas pagas saíram até o vencimento'
                      : 'Das parcelas já pagas, quantas saíram até o vencimento'
                  }
                  explicacao="É a régua do processo, não do fornecedor. Pagar atrasado gera juros e desgasta a relação com quem entrega material na obra."
                  tom={
                    indicadores.pontualidade >= 90
                      ? 'sucesso'
                      : indicadores.pontualidade >= 70
                        ? 'atencao'
                        : 'erro'
                  }
                />
              </Cartao>

              <Cartao className="col-meia">
                <GraficoRanking
                  linhas={porFornecedor}
                  titulo="Para quem a Porto Inc. mais deve"
                  vazio="Nenhuma parcela lançada ainda."
                />
              </Cartao>

              <Cartao className="col-meia">
                <GraficoRanking
                  linhas={porObra}
                  titulo="Custo por obra"
                  vazio="Nenhuma parcela vinculada a obra."
                />
              </Cartao>
            </>
          )}
        </div>

        {!temMovimento && (
          <Vazio
            titulo="Ainda não há parcelas para analisar"
            descricao="Os gráficos aparecem assim que a primeira nota fiscal gerar parcelas."
          />
        )}
      </section>

      {/* ---------- A tabela ---------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Parcelas</h2>
        </div>

        <div className="barra-acoes">
          <Selecao
            rotulo="Mostrar"
            valor={quando}
            aoMudar={(v) => {
              setQuando(v);
              void carregar(v, situacao);
            }}
            opcoes={FILTROS}
            semMarcaOpcional
          />

          <Selecao
            rotulo="Situação"
            valor={situacao}
            aoMudar={(v) => {
              setSituacao(v);
              void carregar(quando, v);
            }}
            opcoes={[
              { valor: '', rotulo: 'Todas' },
              { valor: 'ABERTA', rotulo: 'Em aberto' },
              { valor: 'PAGA', rotulo: 'Pagas' },
              { valor: 'CANCELADA', rotulo: 'Canceladas' },
            ]}
            semMarcaOpcional
          />

          <Link to="/financeiro/notas" className="botao botao--secundario">
            Notas fiscais
          </Link>

          <BotaoBaixar
            aoEscolher={(f) => void exportar(f)}
            ocupado={ocupado}
            rotulo="Baixar contas"
            descricao="contas a pagar"
          />
        </div>

        {/* --------------------------------------------------
            Dar baixa

            Era um painel que abria ACIMA da tabela. Quem
            clicava numa parcela do fim da lista não via nada
            acontecer: o formulário nascia fora da tela e a
            página não se mexia.

            Virou modal, que é o que o padrão manda para
            formulário curto que interrompe uma decisão. A
            diferença não é só rolagem: o formulário vem até a
            pessoa, o foco entra nele, e Esc sai.
            -------------------------------------------------- */}
        <Modal
          aberto={pagando !== null}
          aoFechar={fecharBaixa}
          titulo={'Dar baixa em ' + (pagando?.numeroFormatado ?? '')}
          descricao={
            pagando
              ? pagando.fornecedor + ' · parcela ' + pagando.parcela + '/' +
                pagando.totalParcelas + ' · ' + dinheiro(pagando.valor) + ' · ' + pagando.quando
              : undefined
          }
          temAlteracao={mexeuNaBaixa}
          acoes={
            <>
              <button
                type="button"
                className="botao botao--secundario"
                onClick={fecharBaixa}
                disabled={ocupado}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="botao botao--principal"
                onClick={() => void confirmarBaixa()}
                disabled={ocupado}
              >
                {ocupado ? 'Registrando...' : 'Confirmar pagamento'}
              </button>
            </>
          }
        >
          {/* O aviso de erro do topo da página fica ATRÁS do modal.
              Se a baixa falhar, o motivo precisa aparecer aqui. */}
          {erro && (
            <p className="aviso aviso--erro" role="alert">
              <span aria-hidden="true">⚠</span> {erro}
            </p>
          )}

          <div className="formulario__linha">
            <Campo
              rotulo="Pago em"
              valor={dataPagamento}
              aoMudar={setDataPagamento}
              tipo="date"
              obrigatorio
            />
            <Campo
              rotulo="Valor pago"
              valor={valorPago}
              aoMudar={setValorPago}
              ajuda="Mude se pagou com desconto ou juros."
            />
            <Campo
              rotulo="Forma de pagamento"
              valor={forma}
              aoMudar={setForma}
              exemplo="PIX, boleto, transferência"
            />
          </div>
        </Modal>

        {titulos.length === 0 ? (
          <Vazio
            titulo="Nenhuma parcela por aqui"
            descricao="Mude o filtro ou gere as parcelas de uma nota fiscal."
          />
        ) : (
          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Parcelas a pagar</caption>
                <thead>
                  <tr>
                    <th scope="col">Título</th>
                    <th scope="col">Fornecedor</th>
                    <th scope="col">Origem</th>
                    <th scope="col" className="numero">Valor</th>
                    <th scope="col">Vencimento</th>
                    <th scope="col">Situação</th>
                    {podeGerenciar && (
                      <th scope="col">
                        <span className="apenas-leitor-tela">Ações</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {titulos.map((t) => (
                    <tr key={t.id} className={t.estado === 'VENCIDA' ? 'linha-vencida' : undefined}>
                      <th scope="row" className="mono">
                        {t.numeroFormatado}
                        <small className="linha-extra">
                          parcela {t.parcela}/{t.totalParcelas}
                        </small>
                      </th>
                      <td>{t.fornecedor}</td>
                      <td className="celula-texto">
                        NF {t.nota}
                        {t.pedido && <small className="linha-extra">{t.pedido}</small>}
                      </td>
                      <td className="numero destaque">
                        {dinheiro(t.valor)}
                        {t.valorPago !== null && t.valorPago !== t.valor && (
                          <small className="linha-extra">pago {dinheiro(t.valorPago)}</small>
                        )}
                      </td>
                      <td>
                        {dataBr(t.vencimento)}
                        <small className="linha-extra">{t.quando}</small>
                      </td>
                      <td>
                        <Selo tipo={COR_TITULO[t.estado]}>{ROTULO_TITULO[t.estado]}</Selo>
                        {t.pagoEm && (
                          <small className="linha-extra">
                            {dataBr(t.pagoEm)}
                            {t.formaPagamento ? ' · ' + t.formaPagamento : ''}
                          </small>
                        )}
                      </td>
                      {podeGerenciar && (
                        <td>
                          {t.situacao === 'ABERTA' && (
                            <button
                              type="button"
                              className="botao botao--discreto"
                              onClick={() => abrirBaixa(t)}
                            >
                              Dar baixa
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          </Cartao>
        )}
      </section>
    </>
  );
}
