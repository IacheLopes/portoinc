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
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';
import { NovaCotacao } from './Nova';

export function ListaCotacoes() {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [disponiveis, setDisponiveis] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [situacao, setSituacao] = useState('');
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async (filtro = '') => {
    setCarregando(true);
    setErro(null);
    try {
      const [c, d] = await Promise.all([
        listarCotacoes(filtro || undefined),
        listarItensDisponiveis(),
      ]);
      setCotacoes(c.cotacoes);
      setDisponiveis(d.itens.length);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando && cotacoes.length === 0) {
    return <Carregando mensagem="Carregando cotações..." />;
  }
  if (erro && cotacoes.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  const abertas = cotacoes.filter((c) => c.situacao === 'ABERTO');

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
        />

        <div className="grade">
          <Indicador
            titulo="Itens esperando cotação"
            valor={String(disponiveis)}
            detalhe="Aprovados e ainda fora de qualquer pacote"
          />
          <Indicador
            titulo="Pacotes abertos"
            valor={String(abertas.length)}
            detalhe="Com o prazo correndo"
          />
          <Indicador
            titulo="Respostas recebidas"
            valor={String(abertas.reduce((s, c) => s + c.respostasRecebidas, 0))}
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

          <button
            type="button"
            className="botao botao--secundario"
            onClick={() => void carregar(situacao)}
          >
            Filtrar
          </button>

          <button
            type="button"
            className="botao botao--principal"
            onClick={() => setCriando(true)}
          >
            + Novo pacote de cotação
          </button>
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

      <section className="secao">
        {cotacoes.length === 0 ? (
          <Vazio
            titulo="Nenhum pacote de cotação"
            descricao="Monte o primeiro juntando itens aprovados."
          />
        ) : (
          <Cartao semEspaco>
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
      </section>
    </>
  );
}
