// ============================================================
//  Lista de pacotes de cotação
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarCotacoes, listarItensDisponiveis,
  ROTULO_SITUACAO_BID, COR_SITUACAO_BID,
  type Cotacao,
} from '../../servicos/cotacoes';
import { dataBr, dataHoraBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Indicador } from '../../componentes/Indicador';
import { Selecao } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { Paginacao, ContaDaPagina } from '../../componentes/Paginacao';
import { usePagina } from '../../ganchos/pagina';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';
import { NovaCotacao } from './Nova';

export function ListaCotacoes() {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [disponiveis, setDisponiveis] = useState(0);
  // Os dois números do alto. Vêm contados no banco.
  const [resumo, setResumo] = useState({ abertos: 0, respostas: 0 });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [situacao, setSituacao] = useState('');
  const [criando, setCriando] = useState(false);

  const pag = usePagina(situacao);

  const carregar = useCallback(async (filtro = '', pagina = 1) => {
    setCarregando(true);
    setErro(null);
    try {
      const [c, d] = await Promise.all([
        listarCotacoes(filtro || undefined, pagina),
        listarItensDisponiveis(),
      ]);
      setCotacoes(c.cotacoes);
      setDisponiveis(d.itens.length);
      setResumo(c.resumo);
      pag.chegou(c);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
      pag.falhou();
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sem botao: escolher a situacao ja recarrega.
  useEffect(() => {
    void carregar(situacao, pag.pagina);
  }, [carregar, situacao, pag.pagina]);

  if (carregando && cotacoes.length === 0) {
    return <Carregando mensagem="Carregando cotações..." />;
  }
  if (erro && cotacoes.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }


  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Cotações"
          descricao={
            <>
              Um <strong>pacote de cotação</strong> (BID) agrupa itens já aprovados e vai
            de uma vez para todos os fornecedores da família correspondente.
            </>
          }
          acoes={
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => setCriando(true)}
            >
              + Novo pacote de cotação
            </button>
          }
        />

        <div className="grade">
          <Indicador
            titulo="Itens esperando cotação"
            valor={String(disponiveis)}
            detalhe="Aprovados e ainda fora de qualquer pacote"
          />
          {/* Os dois saíam de filtrar o array da página: com vinte
              por página, contariam só os abertos que por acaso
              caíssem na página que está na tela. Agora vêm do banco.

              E não seguem o filtro da lista de propósito: são o
              estado do trabalho em andamento, e continuam valendo
              enquanto a pessoa olha as canceladas do ano passado. */}
          <Indicador
            titulo="Pacotes abertos"
            valor={String(resumo.abertos)}
            detalhe="Com o prazo correndo"
          />
          <Indicador
            titulo="Respostas recebidas"
            valor={String(resumo.respostas)}
            detalhe="De fornecedores nos pacotes abertos"
          />
        </div>

        <div className="barra-acoes" style={{ marginTop: 'var(--esp-4)' }}>
          <Selecao
            rotulo="Situação"
            valor={situacao}
            aoMudar={setSituacao}
            semMarcaOpcional
            vazio="Todas as situações"
            opcoes={Object.entries(ROTULO_SITUACAO_BID).map(([valor, rotulo]) => ({
              valor,
              rotulo,
            }))}
          />
        </div>

        <NovaCotacao
          key={String(criando)}
          aberto={criando}
          aoFechar={() => setCriando(false)}
        />

        {disponiveis === 0 && (
          <div className="aviso aviso--info">
            <Icone nome="dica" className="aviso__icone" />
            <div>
              <strong>Nenhum item esperando cotação.</strong>
              <p>
                Só entram no pacote itens de solicitações <strong>já aprovadas</strong>.
                Se não há nenhum, é porque tudo já foi cotado ou ainda está na aprovação.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="secao secao-com-ancora" ref={pag.topo}>
        <ContaDaPagina
          pagina={pag.pagina}
          total={pag.dados.total}
          porPagina={pag.dados.porPagina}
          oQue="pacote de cotação"
          oQuePlural="pacotes de cotação"
          carregando={pag.trocando}
        />

        {cotacoes.length === 0 ? (
          <Vazio
            titulo="Nenhum pacote de cotação"
            descricao="Monte o primeiro juntando itens aprovados."
          />
        ) : (
          <Cartao
            semEspaco
            key={pag.pagina}
            className={pag.trocando ? 'lista-trocando' : 'lista-chegou'}
          >
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Pacotes de cotação</caption>
                <thead>
                  <tr>
                    <th scope="col">Número</th>
                    <th scope="col">Título</th>
                    <th scope="col" className="numero">Itens</th>
                    <th scope="col" className="numero">Convidados</th>
                    <th scope="col" className="numero">Respostas</th>
                    <th scope="col">Prazo</th>
                    <th scope="col">Situação</th>
                    <th scope="col">
                      <span className="apenas-leitor-tela">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cotacoes.map((c) => (
                    <tr key={c.id}>
                      <th scope="row" className="mono">
                        {c.numeroFormatado}
                        <small className="linha-extra">
                          {c.abertoEm ? 'aberto em ' + dataHoraBr(c.abertoEm) : 'não aberto'}
                        </small>
                      </th>
                      <td>{c.titulo}</td>
                      <td className="numero">{c.itens.length}</td>
                      <td className="numero">{c.convidados.length}</td>
                      <td className="numero">
                        {c.convidados.length === 0 ? (
                          '—'
                        ) : (
                          <Selo
                            tipo={
                              c.respostasRecebidas === c.convidados.length ? 'sucesso' : 'atencao'
                            }
                          >
                            {c.respostasRecebidas} de {c.convidados.length}
                          </Selo>
                        )}
                      </td>
                      <td>{dataBr(c.prazoResposta)}</td>
                      <td>
                        <Selo tipo={COR_SITUACAO_BID[c.situacao]}>
                          {ROTULO_SITUACAO_BID[c.situacao]}
                        </Selo>
                      </td>
                      <td>
                        <Link className="botao botao--discreto botao--link" to={'/cotacoes/' + c.id}>
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

        <Paginacao
          pagina={pag.pagina}
          paginas={pag.dados.paginas}
          aoTrocar={pag.irPara}
          carregando={pag.trocando}
        />
      </section>
    </>
  );
}
