// ============================================================
//  Lista de solicitações
//
//  Quem não tem "ver todas" enxerga apenas as próprias — o
//  pedido literal da reunião: "cada usuário deve ver o que ele
//  solicitou". A tela deixa isso explícito, para ninguém achar
//  que sumiu informação.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarSolicitacoes, ROTULO_SITUACAO, COR_SITUACAO, dataBr,
  type Solicitacao, type SituacaoSolicitacao,
} from '../../servicos/solicitacoes';
import { dinheiro } from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Selo } from '../../componentes/Selo';
import { Selecao } from '../../componentes/Campo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';

export function ListaSolicitacoes() {
  const { pode } = useAutenticacao();
  const podeCriar = pode('solicitacoes.criar');

  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [vendoTodas, setVendoTodas] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [situacao, setSituacao] = useState('');
  const [apenasMinhas, setApenasMinhas] = useState(false);

  const carregar = useCallback(
    async (filtros: { situacao?: string; apenasMinhas?: boolean } = {}) => {
      setCarregando(true);
      setErro(null);
      try {
        const r = await listarSolicitacoes(filtros);
        setSolicitacoes(r.solicitacoes);
        setVendoTodas(r.vendoTodas);
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
      } finally {
        setCarregando(false);
      }
    },
    [],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function aplicar() {
    void carregar({ situacao: situacao || undefined, apenasMinhas });
  }

  if (carregando && solicitacoes.length === 0) {
    return <Carregando mensagem="Carregando solicitações..." />;
  }
  if (erro && solicitacoes.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  return (
    <>
      <section className="secao">
        <div className="secao__cabecalho">
          <h1>Solicitações de compra</h1>
          <p className="secao__descricao">
            {vendoTodas
              ? 'Você enxerga as solicitações de toda a empresa.'
              : 'Você enxerga apenas as solicitações que você mesmo abriu.'}
          </p>
        </div>

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

          {vendoTodas && (
            <label className="opcao">
              <input
                type="checkbox"
                checked={apenasMinhas}
                onChange={(e) => setApenasMinhas(e.target.checked)}
              />
              <span>Só as minhas</span>
            </label>
          )}

          <button type="button" className="botao botao--secundario" onClick={aplicar}>
            Filtrar
          </button>

          {podeCriar && (
            <Link to="/solicitacoes/nova" className="botao botao--principal botao--link-cheio">
              + Nova solicitação
            </Link>
          )}
        </div>
      </section>

      <section className="secao">
        {solicitacoes.length === 0 ? (
          <Vazio
            titulo="Nenhuma solicitação encontrada"
            descricao={
              podeCriar
                ? 'Clique em "+ Nova solicitação" para abrir a primeira.'
                : 'Ajuste os filtros para ver outras situações.'
            }
          />
        ) : (
          <div className="cartao cartao--tabela">
            <div className="tabela-area">
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
            </div>
          </div>
        )}

        <p className="secao__descricao" style={{ marginTop: 'var(--esp-3)' }}>
          {solicitacoes.length} solicitação(ões) listada(s).
        </p>
      </section>
    </>
  );
}
