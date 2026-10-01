// ============================================================
//  Lista de solicitações
//
//  Quem não tem "ver todas" enxerga apenas as próprias — o
//  pedido literal da reunião: "cada usuário deve ver o que ele
//  solicitou". A tela deixa isso explícito, para ninguém achar
//  que sumiu informação.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarSolicitacoes, ROTULO_SITUACAO, COR_SITUACAO, dataBr,
  type Solicitacao, type SituacaoSolicitacao,
} from '../../servicos/solicitacoes';
import { dinheiro } from '../../servicos/cadastros';
import { Paginacao, ContaDaPagina } from '../../componentes/Paginacao';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Selo } from '../../componentes/Selo';
import { Selecao } from '../../componentes/Campo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { NovaSolicitacao } from './Nova';

/**
 * Por que a lista veio vazia.
 *
 * O dono escolheu "Aprovada", nao veio nada e concluiu que o
 * filtro estava quebrado. Nao estava: APROVADA e um estado de
 * passagem — assim que o comprador monta o pacote de cotacao, a
 * solicitacao sai dali. Tela vazia que nao explica vira chamado.
 */
function explicarVazio(situacao: string, podeCriar: boolean): string {
  if (situacao === 'APROVADA') {
    return 'Aprovada é um estado de passagem: assim que o comprador monta o pacote ' +
      'de cotação, a solicitação passa para Em cotação. Se nenhuma está esperando ' +
      'cotação neste momento, esta lista fica vazia mesmo.';
  }

  if (situacao === 'ATENDIDA') {
    return 'Nenhuma compra chegou por inteiro ainda. A solicitação vira Atendida ' +
      'quando o almoxarife confere a última entrega dela.';
  }

  if (situacao) return 'Nenhuma solicitação está nesta situação agora. Troque o filtro para ver as outras.';

  return podeCriar
    ? 'Clique em "+ Nova solicitação" para abrir a primeira.'
    : 'Ajuste os filtros para ver outras situações.';
}

export function ListaSolicitacoes() {
  const { pode } = useAutenticacao();
  const podeCriar = pode('solicitacoes.criar');

  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [vendoTodas, setVendoTodas] = useState(false);

  // A conta de verdade, que vem do servidor junto com as linhas.
  const [pagina, setPagina] = useState(1);
  // Trocando de página agora? É isto que esmaece a lista e trava
  // os botões — diferente de `carregando`, que vale só na
  // primeira vez, quando ainda não há nada em tela.
  const [trocandoPagina, setTrocandoPagina] = useState(false);
  const topoDaLista = useRef<HTMLElement>(null);
  const [dados, setDados] = useState({ total: 0, paginas: 1, porPagina: 20 });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [situacao, setSituacao] = useState('');
  const [criando, setCriando] = useState(false);
  const [apenasMinhas, setApenasMinhas] = useState(false);

  const carregar = useCallback(
    async (filtros: { situacao?: string; apenasMinhas?: boolean; pagina?: number } = {}) => {
      setCarregando(true);
      setErro(null);
      try {
        const r = await listarSolicitacoes(filtros);
        setSolicitacoes(r.solicitacoes);
        setVendoTodas(r.vendoTodas);
        setDados({ total: r.total, paginas: r.paginas, porPagina: r.porPagina });
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
      } finally {
        setCarregando(false);
        setTrocandoPagina(false);
      }
    },
    [],
  );

  // Recarrega ao ESCOLHER, sem botão.
  //
  // Antes havia um "Filtrar" ao lado: a pessoa trocava a situação, a
  // lista não mexia, e parecia que o filtro estava quebrado. Botão que
  // existe só para confirmar o que já foi escolhido é trabalho a mais
  // para quem usa — a tela já sabe o que ele quer.
  /**
   * Trocar de página: rola até a lista e avisa que está buscando.
   *
   * Sem rolar, a pessoa clica no rodapé, as linhas mudam ACIMA
   * dela e ela continua olhando o mesmo pedaço de tela. Foi
   * exatamente a dúvida do dono: "será que eu mudei de página?".
   *
   * Rola para o topo da LISTA, não da página: o cabeçalho e os
   * filtros saírem de vista tirariam o contexto de onde ela está.
   */
  function irPara(nova: number) {
    setTrocandoPagina(true);
    setPagina(nova);

    // Rolagem INSTANTÂNEA, não suave.
    //
    // Com a tabela cheia, a distância até o topo passa de mil
    // pixels, e a rolagem suave faz a pessoa assistir a lista
    // inteira voar — que desorienta em vez de orientar. Vi isso
    // numa foto tirada no meio da animação.
    //
    // Instantâneo é mais seco e mais honesto: você clica e está
    // lá. Quem confirma que a lista mudou é o fade das linhas
    // novas e o contador logo acima delas.
    topoDaLista.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  // Trocar o filtro volta para a página 1.
  //
  // Sem isto, quem está na página 7 e filtra por "Rascunho" cai
  // numa página 7 que não existe mais, vê a lista vazia e conclui
  // que não há rascunho nenhum.
  useEffect(() => {
    setPagina(1);
  }, [situacao, apenasMinhas]);

  useEffect(() => {
    void carregar({ situacao: situacao || undefined, apenasMinhas, pagina });
  }, [carregar, situacao, apenasMinhas, pagina]);

  if (carregando && solicitacoes.length === 0) {
    return <Carregando mensagem="Carregando solicitações..." />;
  }
  if (erro && solicitacoes.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Solicitações de compra"
          descricao={
            <>
              {vendoTodas
              ? 'Você enxerga as solicitações de toda a empresa.'
              : 'Você enxerga apenas as solicitações que você mesmo abriu.'}
            </>
          }
          acoes={
            podeCriar && (
              <button
                type="button"
                className="botao botao--principal"
                onClick={() => setCriando(true)}
              >
                + Nova solicitação
              </button>
            )
          }
        />

        {/* Formulario longo em modal, por pedido do dono do sistema.
            Perdeu o endereco proprio ("/solicitacoes/nova" nao existe
            mais): nao da mais para mandar o link do formulario vazio
            para alguem. Em troca, quem cria nao sai da lista. */}
        {podeCriar && (
          <NovaSolicitacao
            key={String(criando)}
            aberto={criando}
            aoFechar={() => setCriando(false)}
          />
        )}

        <div className="barra-acoes">
          <Selecao
            rotulo="Situação"
            valor={situacao}
            aoMudar={setSituacao}
            semMarcaOpcional
            vazio="Todas as situações"
            opcoes={Object.entries(ROTULO_SITUACAO).map(([valor, rotulo]) => ({
              valor,
              rotulo,
            }))}
          />

          {/* Uma <Selecao>, e não uma caixa de marcar.

              "Só as minhas" era a ÚNICA caixa de marcar de filtro
              do sistema — ao lado de um campo de escolha com rótulo
              em cima, ela ficava desalinhada e falando outra
              língua. A casa filtra lista com campo de escolha, em
              Cotações, Pedidos, Materiais, Fornecedores e
              Movimentos.

              De dois controles iguais, as bases alinham sozinhas —
              que é a regra escrita no documento de design. */}
          {vendoTodas && (
            <Selecao
              rotulo="Quem pediu"
              valor={apenasMinhas ? 'EU' : ''}
              aoMudar={(v) => setApenasMinhas(v === 'EU')}
              semMarcaOpcional
              vazio="Todo mundo"
              opcoes={[{ valor: 'EU', rotulo: 'Só as minhas' }]}
            />
          )}

        </div>
      </section>

      <section className="secao secao-com-ancora" ref={topoDaLista}>
        {/* A conta vem ANTES da lista, e não no rodapé.
            É o que o olho encontra quando a tela rola de volta
            depois de trocar de página — e, no fundo, ela é uma
            propriedade do filtro, que fica logo acima. */}
        <ContaDaPagina
          pagina={pagina}
          total={dados.total}
          porPagina={dados.porPagina}
          oQue="solicitação"
          oQuePlural="solicitações"
          carregando={trocandoPagina}
        />

        {solicitacoes.length === 0 ? (
          <Vazio
            titulo={
              situacao
                ? 'Nenhuma solicitação ' + ROTULO_SITUACAO[situacao as SituacaoSolicitacao]
                : 'Nenhuma solicitação encontrada'
            }
            descricao={explicarVazio(situacao, podeCriar)}
          />
        ) : (
          /* `key` na página: o React troca o elemento inteiro, e a
             animação de entrada roda de novo. É ela que confirma,
             sem texto, que a lista é outra. */
          <Cartao
            semEspaco
            key={pagina}
            className={trocandoPagina ? 'lista-trocando' : 'lista-chegou'}
          >
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Solicitações de compra</caption>
                <thead>
                  <tr>
                    <th scope="col">Número</th>
                    <th scope="col">Obra</th>
                    <th scope="col">Solicitante</th>
                    <th scope="col">Itens</th>
                    <th scope="col" className="numero">Total estimado</th>
                    <th scope="col">Precisa até</th>
                    <th scope="col">Situação</th>
                    <th scope="col">
                      <span className="apenas-leitor-tela">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {solicitacoes.map((s) => (
                    <tr key={s.id}>
                      <th scope="row" className="mono">
                        {s.numeroFormatado}
                      </th>
                      <td>
                        {s.obra.codigo}
                        <small className="linha-extra">{s.obra.nome}</small>
                      </td>
                      <td>{s.solicitante.nome}</td>
                      <td className="numero">{s.itens.length}</td>
                      <td className="numero">{dinheiro(s.totalEstimado)}</td>
                      <td>{dataBr(s.dataDesejada)}</td>
                      <td>
                        <Selo tipo={COR_SITUACAO[s.situacao as SituacaoSolicitacao]}>
                          {ROTULO_SITUACAO[s.situacao as SituacaoSolicitacao]}
                        </Selo>
                      </td>
                      <td>
                        <Link
                          className="botao botao--discreto botao--link"
                          to={'/solicitacoes/' + s.id}
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          </Cartao>
        )}

        {/* A conta saía de `solicitacoes.length` — o tamanho do que
            CHEGOU, não do que existe. Com a lista cortada em 200,
            ela dizia "200 solicitações listadas" havendo 347, e a
            201ª não aparecia em lugar nenhum.

            Agora o número vem do servidor, contado no banco, com
            o mesmo filtro da busca. */}
        <Paginacao
          pagina={pagina}
          paginas={dados.paginas}
          aoTrocar={irPara}
          carregando={trocandoPagina}
        />
      </section>
    </>
  );
}
