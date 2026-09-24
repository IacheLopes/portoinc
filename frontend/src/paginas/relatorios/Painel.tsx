// ============================================================
//  Relatórios
//
//  Cinco perguntas, uma aba para cada:
//
//    1. Orçamento    A obra está estourando o orçamento?
//    2. Economia     A cotação valeu a pena?
//    3. Fornecedores Em quem dá para confiar?
//    4. Tempos       Onde o processo trava?
//    5. Consumo      O que a empresa mais compra?
//
//  Em toda aba a ordem é a mesma: primeiro os números grandes
//  (o resumo), depois o gráfico, e só então a tabela. Quem abre
//  a tela quer a resposta; a tabela é para quem já sabe o que
//  procura.
//
//  A aba fica na barra de endereço (?ver=economia), então dá
//  para mandar o link exato para outra pessoa.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  buscarOrcamento, exportarOrcamento,
  buscarEconomia, exportarEconomia,
  buscarFornecedores, exportarFornecedores,
  buscarTempos, exportarTempos,
  buscarConsumo, exportarConsumo,
  ROTULO_SITUACAO, COR_SITUACAO,
  type RelatorioDeOrcamento, type RelatorioDeEconomia,
  type DesempenhoDoFornecedor, type RelatorioDeTempos,
  type RelatorioDeConsumo, type ObraResumo,
} from '../../servicos/relatorios';
import type { FatiaDoGrafico } from '../../componentes/Graficos';
import { dinheiro, quantidade as quantidadeOficial } from '../../servicos/cadastros';
import { plural, porcento, dias } from '../../servicos/texto';
import { ErroApi } from '../../servicos/api';
import { Selecao } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { CartaoIndicador, GraficoRosca, GraficoRanking } from '../../componentes/Graficos';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { BotaoBaixar, type FormatoDeArquivo } from '../../componentes/BotaoBaixar';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';

// ------------------------------------------------------------
//  Abas
// ------------------------------------------------------------

const ABAS = [
  { chave: 'orcamento', rotulo: 'Orçamento', pergunta: 'A obra está estourando o orçamento?' },
  { chave: 'economia', rotulo: 'Economia', pergunta: 'A cotação valeu a pena?' },
  { chave: 'fornecedores', rotulo: 'Fornecedores', pergunta: 'Em quem dá para confiar?' },
  { chave: 'tempos', rotulo: 'Tempos', pergunta: 'Onde o processo trava?' },
  { chave: 'consumo', rotulo: 'Consumo', pergunta: 'O que a empresa mais compra?' },
] as const;

type Aba = (typeof ABAS)[number]['chave'];

function ehAba(v: string | null): v is Aba {
  return ABAS.some((a) => a.chave === v);
}

// ------------------------------------------------------------
//  Apoio
// ------------------------------------------------------------

/**
 * Quantidade num relatório: duas casas.
 *
 * A função oficial usa quatro, que no estoque faz sentido e aqui
 * vira ruído. A diferença fica dita, e não escondida numa cópia.
 */
function quantidade(v: number): string {
  return quantidadeOficial(v, 2);
}

const TONS = ['info', 'sucesso', 'atencao', 'erro'] as const;

/** "2026-09-22" vira "22/09/2026". */
function data(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return dia && mes && ano ? dia + '/' + mes + '/' + ano : iso;
}

/**
 * Monta as fatias da rosca somando o resto em "Outros".
 *
 * Sem isso o anel mostraria só os maiores e ficaria com um vão:
 * as porcentagens não fechariam 100% e o desenho contradiria o
 * total escrito no meio.
 */
function fatiasComResto(
  itens: Array<{ nome: string; valor: number }>,
  total: number,
  quantas = 4,
): FatiaDoGrafico[] {
  const parte = (valor: number) =>
    total > 0 ? Math.round((valor / total) * 1000) / 10 : 0;

  const principais = itens.slice(0, quantas).map((i, indice) => ({
    rotulo: i.nome,
    valor: i.valor,
    percentual: parte(i.valor),
    tom: TONS[indice % TONS.length],
  }));

  const resto = itens.slice(quantas).reduce((s, i) => s + i.valor, 0);
  if (resto <= 0) return principais;

  return [
    ...principais,
    {
      rotulo: 'Outros (' + (itens.length - quantas) + ')',
      valor: resto,
      percentual: parte(resto),
      // Cinza de propósito: se "Outros" repetisse a cor de uma
      // família, as duas fatias virariam um arco só no anel.
      tom: 'neutro',
    },
  ];
}

/** Barra de consumo dentro da tabela do orçamento. */
function BarraDeConsumo({ percentual, tom }: { percentual: number; tom: string }) {
  const largura = Math.min(100, Math.max(0, percentual));

  return (
    <div className="medida" title={porcento(percentual)}>
      <div className="medida__trilho">
        <div className={'medida__preenchimento medida__preenchimento--' + tom} style={{ width: largura + '%' }} />
      </div>
      <span className="medida__numero">{porcento(percentual)}</span>
    </div>
  );
}

/** Seletor de obra, igual nas abas que filtram por obra. */
function FiltroDeObra({
  obras, valor, aoMudar, rotuloTodas,
}: {
  obras: ObraResumo[];
  valor: string;
  aoMudar: (v: string) => void;
  rotuloTodas?: string;
}) {
  return (
    <Selecao
      rotulo="Obra"
      valor={valor}
      aoMudar={aoMudar}
      semMarcaOpcional
      vazio={rotuloTodas}
      opcoes={obras.map((o) => ({ valor: o.id, rotulo: o.codigo + ' — ' + o.nome }))}
    />
  );
}

/**
 * Baixar, com escolha do formato.
 *
 * O mesmo componente nas cinco abas: a escolha aparece sempre no
 * mesmo canto e com as mesmas palavras.
 */
function BotaoExportar({
  aoEscolher, ocupado, descricao,
}: {
  aoEscolher: (f: FormatoDeArquivo) => void;
  ocupado: boolean;
  descricao: string;
}) {
  return <BotaoBaixar aoEscolher={aoEscolher} ocupado={ocupado} descricao={descricao} />;
}

// ============================================================
//  Tela
// ============================================================

export function PainelRelatorios() {
  const [parametros, setParametros] = useSearchParams();
  const pedida = parametros.get('ver');
  const aba: Aba = ehAba(pedida) ? pedida : 'orcamento';

  function trocarAba(nova: Aba) {
    setParametros(nova === 'orcamento' ? {} : { ver: nova }, { replace: true });
  }

  const atual = ABAS.find((a) => a.chave === aba)!;

  return (
    <section className="secao">
      <CabecalhoDePagina
          titulo="Relatórios"
          descricao={
            <>
              Os números saem do que já aconteceu no sistema: solicitação, cotação,
          pedido e recebimento. Nada é digitado duas vezes.
            </>
          }
        />

      <div className="abas" role="tablist" aria-label="Relatórios disponíveis">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            role="tab"
            id={'aba-' + a.chave}
            aria-selected={a.chave === aba}
            aria-controls={'painel-' + a.chave}
            className={'aba' + (a.chave === aba ? ' aba--ativa' : '')}
            onClick={() => trocarAba(a.chave)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={'painel-' + aba}
        aria-labelledby={'aba-' + aba}
        className="aba__conteudo"
      >
        <p className="aba__pergunta">{atual.pergunta}</p>

        {aba === 'orcamento' && <AbaOrcamento />}
        {aba === 'economia' && <AbaEconomia />}
        {aba === 'fornecedores' && <AbaFornecedores />}
        {aba === 'tempos' && <AbaTempos />}
        {aba === 'consumo' && <AbaConsumo />}
      </div>
    </section>
  );
}

// ------------------------------------------------------------
//  1. Orçado × realizado
// ------------------------------------------------------------

function AbaOrcamento() {
  const [dados, setDados] = useState<RelatorioDeOrcamento | null>(null);
  const [obraId, setObraId] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  const carregar = useCallback(async (obra?: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await buscarOrcamento(obra || undefined);
      setDados(r);
      if (r.obraId) setObraId(r.obraId);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar o orçamento.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function baixar(formato: FormatoDeArquivo) {
    setBaixando(true);
    try {
      await exportarOrcamento(formato, obraId || undefined);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao gerar a planilha.');
    } finally {
      setBaixando(false);
    }
  }

  if (carregando && !dados) return <Carregando mensagem="Somando o que já foi comprado..." />;
  if (erro && !dados) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar(obraId)} />;
  if (!dados) return null;

  const { resumo, linhas } = dados;

  return (
    <>
      {erro && <p className="aviso aviso--erro" role="alert"><Icone nome="alerta" /> {erro}</p>}

      <div className="barra-acoes">
        <FiltroDeObra
          obras={dados.obras}
          valor={obraId}
          aoMudar={(v) => { setObraId(v); void carregar(v); }}
        />
        <BotaoExportar
          aoEscolher={(f) => void baixar(f)}
          ocupado={baixando}
          descricao="orçado × realizado"
        />
      </div>

      {dados.obras.length === 0 ? (
        <Vazio
          titulo="Nenhuma obra cadastrada"
          descricao="Cadastre a obra e o orçamento dela para acompanhar o gasto por linha."
        />
      ) : (
        <>
          <div className="painel-relatorio">
            <CartaoIndicador
              rotulo="Previsto"
              valor={dinheiro(resumo.previsto)}
              detalhe={plural(linhas.length, 'linha de orçamento', 'linhas de orçamento')}
              explicacao="Soma de quantidade prevista × valor unitário de cada linha do orçamento da obra."
            />

            <CartaoIndicador
              rotulo="Já comprado"
              valor={dinheiro(resumo.realizado)}
              detalhe={porcento(resumo.consumido) + ' do previsto'}
              explicacao="Tudo que virou pedido de compra para esta obra, pelo valor que foi realmente fechado com o fornecedor."
              destaque="info"
            />

            <CartaoIndicador
              rotulo="Saldo"
              valor={dinheiro(resumo.saldo)}
              detalhe={resumo.saldo < 0 ? 'Acima do previsto' : 'Disponível'}
              explicacao="O que ainda cabe no orçamento. Negativo significa que a obra já passou do que foi planejado."
              destaque={resumo.saldo < 0 ? 'erro' : 'sucesso'}
            />

            <CartaoIndicador
              rotulo="Linhas em alerta"
              valor={String(resumo.linhasEstouradas + resumo.linhasEmAtencao)}
              detalhe={
                plural(resumo.linhasEstouradas, 'estourada', 'estouradas') + ', ' + resumo.linhasEmAtencao + ' em atenção'
              }
              explicacao="Atenção começa em 80% do previsto: avisar só quando estoura não ajuda, porque nessa hora o dinheiro já saiu."
              destaque={
                resumo.linhasEstouradas > 0
                  ? 'erro'
                  : resumo.linhasEmAtencao > 0
                    ? 'atencao'
                    : 'sucesso'
              }
            />
          </div>

          {dados.foraDoOrcamento > 0 && (
            <div className="aviso aviso--atencao">
              <Icone nome="alerta" className="aviso__icone" />
              <div>
                <strong>{dinheiro(dados.foraDoOrcamento)} sem apontamento.</strong>
                <p>
                  Esse valor foi comprado para a obra, mas o item da solicitação não
                  apontou em qual linha do orçamento entra. Aparece na última linha
                  da tabela para o total continuar batendo com o que foi gasto.
                </p>
              </div>
            </div>
          )}

          {linhas.length === 0 ? (
            <Vazio
              titulo="Esta obra ainda não tem orçamento"
              descricao="Cadastre as linhas do orçamento na tela da obra para acompanhar o gasto."
            />
          ) : (
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">
                  Orçado contra realizado, linha a linha, da obra {dados.obra?.nome}.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Linha</th>
                    <th scope="col" className="celula-valor">Previsto</th>
                    <th scope="col" className="celula-valor">Comprado</th>
                    <th scope="col" className="celula-valor">Saldo</th>
                    <th scope="col">Consumo</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr
                      key={l.codigo}
                      className={
                        l.situacao === 'ESTOUROU'
                          ? 'linha-vencida'
                          : l.situacao === 'ATENCAO'
                            ? 'linha-atencao'
                            : undefined
                      }
                    >
                      <th scope="row" className="celula-texto">
                        <span className="mono">{l.codigo}</span>
                        <span className="celula-extra">{l.descricao}</span>
                      </th>
                      <td className="celula-valor">{dinheiro(l.previsto)}</td>
                      <td className="celula-valor">{dinheiro(l.realizado)}</td>
                      <td className="celula-valor">{dinheiro(l.saldo)}</td>
                      <td>
                        <BarraDeConsumo
                          percentual={l.consumido}
                          tom={COR_SITUACAO[l.situacao]}
                        />
                      </td>
                      <td>
                        {l.situacao === 'SEM_PREVISAO' ? (
                          <span className="texto-fraco">{ROTULO_SITUACAO[l.situacao]}</span>
                        ) : (
                          <Selo tipo={COR_SITUACAO[l.situacao] as 'sucesso' | 'atencao' | 'erro'}>
                            {ROTULO_SITUACAO[l.situacao]}
                          </Selo>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          )}
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------
//  2. Economia nas cotações
// ------------------------------------------------------------

function AbaEconomia() {
  const [dados, setDados] = useState<RelatorioDeEconomia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await buscarEconomia());
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar as cotações.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function baixar(formato: FormatoDeArquivo) {
    setBaixando(true);
    try {
      await exportarEconomia(formato);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao gerar a planilha.');
    } finally {
      setBaixando(false);
    }
  }

  if (carregando && !dados) return <Carregando mensagem="Comparando estimativa e fechamento..." />;
  if (erro && !dados) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  if (!dados) return null;

  const { resumo, cotacoes } = dados;

  if (cotacoes.length === 0) {
    return (
      <Vazio
        titulo="Nenhuma cotação encerrada nos últimos 12 meses"
        descricao="Assim que um pacote de cotação for encerrado, a economia aparece aqui."
      />
    );
  }

  const melhores = [...cotacoes]
    .filter((c) => c.economia > 0)
    .sort((a, b) => b.economia - a.economia)
    .slice(0, 6);

  return (
    <>
      {erro && <p className="aviso aviso--erro" role="alert"><Icone nome="alerta" /> {erro}</p>}

      <div className="barra-acoes">
        <p className="barra-acoes__nota">
          Período: últimos 12 meses ({data(dados.de)} a {data(dados.ate)}).
        </p>
        <BotaoExportar
          aoEscolher={(f) => void baixar(f)}
          ocupado={baixando}
          descricao="economia nas cotações"
        />
      </div>

      <div className="painel-relatorio">
        <CartaoIndicador
          rotulo="Economia"
          valor={dinheiro(resumo.economia)}
          detalhe={porcento(resumo.economiaPercentual) + ' sobre o estimado'}
          explicacao="Diferença entre o que o solicitante estimou e o que o comprador conseguiu fechar. É o dinheiro que a cotação poupou."
          destaque={resumo.economia >= 0 ? 'sucesso' : 'erro'}
        />

        <CartaoIndicador
          rotulo="Ganho na disputa"
          valor={dinheiro(resumo.ganhoNaDisputa)}
          detalhe="Contra a pior proposta"
          explicacao="Quanto se pagaria a mais comprando do fornecedor mais caro da mesma cotação. Mede o valor de convidar mais gente."
          destaque="info"
        />

        <CartaoIndicador
          rotulo="Taxa de resposta"
          valor={porcento(resumo.taxaMediaDeResposta)}
          detalhe={'Média de ' + quantidade(resumo.mediaDeFornecedoresPorCotacao) + ' convidados'}
          explicacao="De cada 10 fornecedores convidados, quantos realmente mandam preço. Taxa baixa deixa a cotação sem disputa."
          destaque={resumo.taxaMediaDeResposta >= 60 ? 'sucesso' : 'atencao'}
        />

        <CartaoIndicador
          rotulo="Cotações encerradas"
          valor={String(resumo.cotacoes)}
          detalhe={dinheiro(resumo.fechado) + ' fechados'}
          explicacao="Quantos pacotes de cotação foram concluídos no período e quanto foi comprado por meio deles."
        />

        {melhores.length > 0 && (
          <Cartao className="col-cheia">
            <GraficoRanking
              titulo="Onde a cotação mais economizou"
              vazio="Nenhuma cotação fechou abaixo do estimado no período."
              unico
              rotuloValor="Economia"
              linhas={melhores.map((c) => ({
                nome: c.numeroFormatado + ' — ' + c.titulo,
                pago: c.economia,
                aberto: 0,
                total: c.economia,
              }))}
            />
          </Cartao>
        )}
      </div>

      <TabelaArea>
        <table className="tabela">
          <caption className="apenas-leitor-tela">
            Economia por cotação encerrada no período.
          </caption>
          <thead>
            <tr>
              <th scope="col">Cotação</th>
              <th scope="col" className="celula-valor">Respostas</th>
              <th scope="col" className="celula-valor">Estimado</th>
              <th scope="col" className="celula-valor">Fechado</th>
              <th scope="col" className="celula-valor">Economia</th>
              <th scope="col" className="celula-valor">Ganho na disputa</th>
            </tr>
          </thead>
          <tbody>
            {cotacoes.map((c) => (
              <tr key={c.numeroFormatado}>
                <th scope="row" className="celula-texto">
                  <span className="mono">{c.numeroFormatado}</span>
                  <span className="celula-extra">{c.titulo}</span>
                </th>
                <td className="celula-valor">
                  {c.fornecedoresResponderam} de {c.fornecedoresConvidados}
                  <span className="celula-extra">{porcento(c.taxaDeResposta)}</span>
                </td>
                <td className="celula-valor">{dinheiro(c.estimado)}</td>
                <td className="celula-valor">{dinheiro(c.fechado)}</td>
                <td className={'celula-valor' + (c.economia < 0 ? ' valor-negativo' : '')}>
                  {dinheiro(c.economia)}
                  <span className="celula-extra">{porcento(c.economiaPercentual)}</span>
                </td>
                <td className="celula-valor">{dinheiro(c.ganhoNaDisputa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaArea>
    </>
  );
}

// ------------------------------------------------------------
//  3. Desempenho do fornecedor
// ------------------------------------------------------------

function AbaFornecedores() {
  const [lista, setLista] = useState<DesempenhoDoFornecedor[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await buscarFornecedores();
      setLista(r.fornecedores);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar os fornecedores.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function baixar(formato: FormatoDeArquivo) {
    setBaixando(true);
    try {
      await exportarFornecedores(formato);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao gerar a planilha.');
    } finally {
      setBaixando(false);
    }
  }

  if (carregando && !lista) return <Carregando mensagem="Somando entregas e prazos..." />;
  if (erro && !lista) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  if (!lista) return null;

  if (lista.length === 0) {
    return (
      <Vazio
        titulo="Nenhum fornecedor com histórico"
        descricao="Convide fornecedores para uma cotação: a partir daí o desempenho começa a ser medido."
      />
    );
  }

  const comEntrega = lista.filter((f) => f.entregas > 0);
  const totalComprado = lista.reduce((s, f) => s + f.valorComprado, 0);

  return (
    <>
      {erro && <p className="aviso aviso--erro" role="alert"><Icone nome="alerta" /> {erro}</p>}

      <div className="barra-acoes">
        <p className="barra-acoes__nota">
          {lista.length} fornecedor(es) com histórico. A leitura só vira veredito
          a partir de 3 entregas.
        </p>
        <BotaoExportar
          aoEscolher={(f) => void baixar(f)}
          ocupado={baixando}
          descricao="desempenho dos fornecedores"
        />
      </div>

      <div className="painel-relatorio">
        <Cartao className="col-meia">
          <GraficoRanking
            titulo="Quanto a empresa comprou de cada um"
            vazio="Nenhuma compra registrada."
            unico
            rotuloValor="Comprado"
            linhas={lista.slice(0, 6).map((f) => ({
              nome: f.nome,
              pago: f.valorComprado,
              aberto: 0,
              total: f.valorComprado,
            }))}
          />
        </Cartao>

        <Cartao className="col-meia">
          <GraficoRosca
            titulo="Concentração das compras"
            centroValor={dinheiro(totalComprado)}
            centroRotulo="comprados"
            rotuloFatia="Fornecedor"
            fatias={fatiasComResto(
              lista.map((f) => ({ nome: f.nome, valor: f.valorComprado })),
              totalComprado,
            )}
          />
        </Cartao>
      </div>

      <TabelaArea>
        <table className="tabela">
          <caption className="apenas-leitor-tela">
            Desempenho de cada fornecedor: resposta, pontualidade e qualidade.
          </caption>
          <thead>
            <tr>
              <th scope="col">Fornecedor</th>
              <th scope="col" className="celula-valor">Comprado</th>
              <th scope="col" className="celula-valor">Respostas</th>
              <th scope="col" className="celula-valor">Entregas</th>
              <th scope="col">Pontualidade</th>
              <th scope="col">Qualidade</th>
              <th scope="col">Leitura</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.nome}>
                <th scope="row" className="celula-texto">{f.nome}</th>
                <td className="celula-valor">
                  {dinheiro(f.valorComprado)}
                  <span className="celula-extra">{plural(f.pedidos, 'pedido', 'pedidos')}</span>
                </td>
                <td className="celula-valor">
                  {f.respostas} de {f.convites}
                  <span className="celula-extra">{porcento(f.taxaDeResposta)}</span>
                </td>
                <td className="celula-valor">
                  {f.entregas}
                  {f.atrasoMedio > 0 && (
                    <span className="celula-extra">
                      atraso médio {dias(f.atrasoMedio)}
                    </span>
                  )}
                </td>
                <td>
                  {f.entregas === 0 ? (
                    <span className="texto-fraco">—</span>
                  ) : (
                    <BarraDeConsumo
                      percentual={f.pontualidade}
                      tom={
                        f.pontualidade >= 80 ? 'sucesso' : f.pontualidade >= 60 ? 'atencao' : 'erro'
                      }
                    />
                  )}
                </td>
                <td>
                  {f.entregas === 0 ? (
                    <span className="texto-fraco">—</span>
                  ) : (
                    <BarraDeConsumo
                      percentual={f.qualidade}
                      tom={f.qualidade >= 90 ? 'sucesso' : f.qualidade >= 70 ? 'atencao' : 'erro'}
                    />
                  )}
                </td>
                <td className="celula-texto">{f.leitura}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaArea>

      {comEntrega.length === 0 && (
        <p className="texto-fraco">
          Nenhuma entrega conferida ainda: pontualidade e qualidade só aparecem
          depois que o almoxarife registra o recebimento.
        </p>
      )}
    </>
  );
}

// ------------------------------------------------------------
//  4. Tempo do processo
// ------------------------------------------------------------

function AbaTempos() {
  const [dados, setDados] = useState<RelatorioDeTempos | null>(null);
  const [obraId, setObraId] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  const carregar = useCallback(async (obra?: string) => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await buscarTempos({ obraId: obra || undefined }));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao medir os tempos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function baixar(formato: FormatoDeArquivo) {
    setBaixando(true);
    try {
      await exportarTempos(formato, { obraId: obraId || undefined });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao gerar a planilha.');
    } finally {
      setBaixando(false);
    }
  }

  if (carregando && !dados) return <Carregando mensagem="Medindo cada etapa do caminho..." />;
  if (erro && !dados) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar(obraId)} />;
  if (!dados) return null;

  const { etapas, total } = dados;
  const maiorEtapa = Math.max(...etapas.map((e) => e.dias), 1);

  return (
    <>
      {erro && <p className="aviso aviso--erro" role="alert"><Icone nome="alerta" /> {erro}</p>}

      <div className="barra-acoes">
        <FiltroDeObra
          obras={dados.obras}
          valor={obraId}
          aoMudar={(v) => { setObraId(v); void carregar(v); }}
          rotuloTodas="Todas as obras"
        />
        <BotaoExportar
          aoEscolher={(f) => void baixar(f)}
          ocupado={baixando}
          descricao="tempo do processo"
        />
      </div>

      {dados.solicitacoes === 0 ? (
        <Vazio
          titulo="Nenhuma solicitação no período"
          descricao="Os tempos aparecem conforme as solicitações avançam pelo fluxo."
        />
      ) : (
        <>
          <div className="painel-relatorio">
            <CartaoIndicador
              rotulo="Do pedido à entrega"
              valor={total.amostra === 0 ? '—' : dias(total.dias)}
              detalhe={
                total.amostra === 0
                  ? 'Nenhuma solicitação concluída ainda'
                  : plural(total.amostra, 'solicitação concluída', 'solicitações concluídas')
              }
              explicacao="Tempo médio do dia em que alguém pediu até o material entrar no almoxarifado. Só entram as que já chegaram por inteiro."
              destaque="info"
            />

            <CartaoIndicador
              rotulo="Etapa mais demorada"
              valor={total.maisDemorada ?? '—'}
              detalhe={
                total.maisDemorada
                  ? 'É onde vale atacar primeiro'
                  : 'Nada travando o processo'
              }
              explicacao="A etapa com a maior média de dias. Reduzir aqui é o que mais encurta o caminho inteiro."
              destaque={total.maisDemorada ? 'atencao' : 'sucesso'}
            />

            <CartaoIndicador
              rotulo="Solicitações no período"
              valor={String(dados.solicitacoes)}
              detalhe={'De ' + data(dados.de) + ' a ' + data(dados.ate)}
              explicacao="Quantas solicitações saíram do rascunho no período analisado."
            />

            <CartaoIndicador
              rotulo="Etapas medidas"
              valor={String(etapas.filter((e) => e.amostra > 0).length) + ' de ' + etapas.length}
              detalhe="Com pelo menos uma passagem"
              explicacao="Uma etapa só entra na conta quando alguma solicitação já passou por ela. Assim a média não fica bonita por falta de dado."
            />
          </div>

          <Cartao>
            <h2 className="gr__titulo">Onde o tempo se perde</h2>

            <ol className="etapas">
              {etapas.map((e) => (
                <li key={e.etapa} className="etapa">
                  <div className="etapa__topo">
                    <span className="etapa__nome">{e.etapa}</span>
                    <span className="etapa__dias">
                      {e.amostra === 0 ? 'sem dados' : dias(e.dias)}
                    </span>
                  </div>

                  <div className="etapa__trilho">
                    <div
                      className={
                        'etapa__barra' +
                        (e.etapa === total.maisDemorada ? ' etapa__barra--pior' : '')
                      }
                      style={{ width: (e.dias / maiorEtapa) * 100 + '%' }}
                    />
                  </div>

                  <p className="etapa__descricao">
                    {e.descricao}
                    {e.amostra > 0 && (
                      <span className="texto-fraco">
                        {' '}· média de {plural(e.amostra, 'solicitação', 'solicitações')}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ol>

            {/* A classe de esconder vai no <div>, não no <table>: a
                largura mínima do conteúdo vence o `width: 1px` de uma
                tabela, e ela empurrava a página 65px para o lado num
                celular de 393. Mesma correção de `TabelaEquivalente`
                em Graficos.tsx. */}
            <div className="apenas-leitor-tela">
            <table>
              <caption>Média de dias por etapa do processo de compra.</caption>
              <thead>
                <tr>
                  <th scope="col">Etapa</th>
                  <th scope="col">Média de dias</th>
                  <th scope="col">Solicitações na conta</th>
                </tr>
              </thead>
              <tbody>
                {etapas.map((e) => (
                  <tr key={e.etapa}>
                    <th scope="row">{e.etapa}</th>
                    <td>{e.amostra === 0 ? 'sem dados' : dias(e.dias)}</td>
                    <td>{e.amostra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Cartao>
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------
//  5. Consumo por família e material
// ------------------------------------------------------------

function AbaConsumo() {
  const [dados, setDados] = useState<RelatorioDeConsumo | null>(null);
  const [obraId, setObraId] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  const carregar = useCallback(async (obra?: string) => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await buscarConsumo({ obraId: obra || undefined }));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar o consumo.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function baixar(formato: FormatoDeArquivo) {
    setBaixando(true);
    try {
      await exportarConsumo(formato, { obraId: obraId || undefined });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao gerar a planilha.');
    } finally {
      setBaixando(false);
    }
  }

  if (carregando && !dados) return <Carregando mensagem="Agrupando o que foi comprado..." />;
  if (erro && !dados) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar(obraId)} />;
  if (!dados) return null;

  const { familias, materiais, total } = dados;

  return (
    <>
      {erro && <p className="aviso aviso--erro" role="alert"><Icone nome="alerta" /> {erro}</p>}

      <div className="barra-acoes">
        <FiltroDeObra
          obras={dados.obras}
          valor={obraId}
          aoMudar={(v) => { setObraId(v); void carregar(v); }}
          rotuloTodas="Todas as obras"
        />
        <BotaoExportar
          aoEscolher={(f) => void baixar(f)}
          ocupado={baixando}
          descricao="consumo por material"
        />
      </div>

      {materiais.length === 0 ? (
        <Vazio
          titulo="Nenhuma compra no período"
          descricao="Assim que um pedido for gerado, ele aparece aqui agrupado por família e por item."
        />
      ) : (
        <>
          <div className="painel-relatorio">
            <Cartao className="col-meia">
              <GraficoRosca
                titulo="Para onde vai o dinheiro"
                centroValor={dinheiro(total)}
                centroRotulo="comprados"
                rotuloFatia="Família"
                fatias={fatiasComResto(familias, total)}
              />
            </Cartao>

            <Cartao className="col-meia">
              <GraficoRanking
                titulo="Itens que mais pesam na conta"
                vazio="Nenhum item comprado no período."
                unico
                rotuloValor="Comprado"
                linhas={materiais.slice(0, 6).map((m) => ({
                  nome: m.descricao,
                  pago: m.valor,
                  aberto: 0,
                  total: m.valor,
                }))}
              />
            </Cartao>
          </div>

          <TabelaArea>
            <table className="tabela">
              <caption className="apenas-leitor-tela">
                Consumo por família de material no período.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Família</th>
                  <th scope="col" className="celula-valor">Itens diferentes</th>
                  <th scope="col" className="celula-valor">Valor</th>
                  <th scope="col">Participação</th>
                </tr>
              </thead>
              <tbody>
                {familias.map((f) => (
                  <tr key={f.nome}>
                    <th scope="row" className="celula-texto">{f.nome}</th>
                    <td className="celula-valor">{f.itens}</td>
                    <td className="celula-valor">{dinheiro(f.valor)}</td>
                    <td>
                      <BarraDeConsumo percentual={f.participacao} tom="info" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaArea>

          <h2 className="secao__subtitulo">Os itens mais comprados</h2>

          <TabelaArea>
            <table className="tabela">
              <caption className="apenas-leitor-tela">
                Os materiais com maior valor comprado no período.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="celula-valor">Quantidade</th>
                  <th scope="col" className="celula-valor">Preço médio</th>
                  <th scope="col" className="celula-valor">Valor</th>
                  <th scope="col" className="celula-valor">Participação</th>
                </tr>
              </thead>
              <tbody>
                {materiais.map((m) => (
                  <tr key={m.codigo}>
                    <th scope="row" className="celula-texto">
                      <span className="mono">{m.codigo}</span>
                      <span className="celula-extra">{m.descricao}</span>
                    </th>
                    <td className="celula-valor">
                      {quantidade(m.quantidade)}
                      <span className="celula-extra">{m.unidadeMedida}</span>
                    </td>
                    <td className="celula-valor">{dinheiro(m.precoMedio)}</td>
                    <td className="celula-valor">{dinheiro(m.valor)}</td>
                    <td className="celula-valor">{porcento(m.participacao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaArea>
        </>
      )}
    </>
  );
}
