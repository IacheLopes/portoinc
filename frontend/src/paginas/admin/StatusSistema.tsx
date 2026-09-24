// ============================================================
//  Status do sistema (área administrativa)
//
//  Primeira tela do projeto. Serve para conferir, de um olhar,
//  se as três peças (site, API e banco) estão conversando e
//  quais integrações estão ligadas de verdade.
// ============================================================

// padrao-ignora: sem-estados — a tabela lista as verificacoes que o
// sistema FAZ, e essa lista e fixa no codigo. Ela nunca vem vazia;
// um <Vazio> ali seria um aviso sobre algo impossivel.

import { useCallback, useEffect, useState } from 'react';
import { buscarStatus, ErroApi, type StatusSistema as DadosStatus } from '../../servicos/api';
import { Indicador } from '../../componentes/Indicador';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';

function formatarTempo(segundos: number): string {
  if (segundos < 60) return segundos + ' s';
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return minutos + ' min';
  return Math.floor(minutos / 60) + ' h ' + (minutos % 60) + ' min';
}

export function StatusSistema() {
  const [status, setStatus] = useState<DadosStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setStatus(await buscarStatus());
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha inesperada.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando && !status) {
    return <Carregando mensagem="Conferindo o sistema..." />;
  }

  if (erro && !status) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  if (!status) return null;

  const memoriaPorcento = Math.round((status.memoria.usadaMb / status.memoria.limiteMb) * 100);
  const integracoesReais = status.integracoes.filter((i) => !i.simulado).length;

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Status do sistema"
          descricao={
            <>
              Confira se as três partes do sistema estão no ar e o que já está ligado.
            </>
          }
        />

        <div className="grade">
          <Indicador
            titulo="Interface"
            valor={<Selo tipo="sucesso">No ar</Selo>}
            detalhe="Você está vendo esta tela, então o React respondeu."
          />

          <Indicador
            titulo="API"
            valor={<Selo tipo="sucesso">No ar</Selo>}
            detalhe={
              'Versão ' + status.versao + ' · ligada há ' + formatarTempo(status.ligadoHaSegundos)
            }
          />

          <Indicador
            titulo="Banco de dados"
            valor={
              status.banco.conectado ? (
                <Selo tipo="sucesso">Conectado</Selo>
              ) : (
                <Selo tipo="erro">Sem conexão</Selo>
              )
            }
            detalhe={
              status.banco.conectado
                ? status.banco.funcoesCadastradas +
                  ' funções e ' +
                  status.banco.usuariosCadastrados +
                  ' usuários cadastrados'
                : 'A API não conseguiu falar com o PostgreSQL.'
            }
          />

          <Indicador
            titulo="Memória da API"
            valor={status.memoria.usadaMb + ' MB'}
            detalhe={'De ' + status.memoria.limiteMb + ' MB disponíveis (' + memoriaPorcento + '%)'}
          />
        </div>
      </section>

      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Integrações externas</h2>
          <p className="secao__descricao">
            A estrutura de todas já está pronta. Enquanto estiverem como{' '}
            <strong>simulado</strong>, nada sai do sistema: nenhuma mensagem é enviada e nenhum
            pagamento é feito.
            {integracoesReais === 0 && ' Nenhuma integração real está ligada no momento.'}
          </p>
        </div>

        <Cartao semEspaco>
          <TabelaArea>
            <table className="tabela">
              <caption className="apenas-leitor-tela">
                Situação de cada integração externa do sistema
              </caption>
              <thead>
                <tr>
                  <th scope="col">Área</th>
                  <th scope="col">Para que serve</th>
                  <th scope="col">Ligado em</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {status.integracoes.map((item) => (
                  <tr key={item.area}>
                    <th scope="row">{item.area}</th>
                    <td>{item.descricao}</td>
                    <td className="mono">{item.adaptador}</td>
                    <td>
                      {item.simulado ? (
                        <Selo tipo="atencao">Simulado</Selo>
                      ) : (
                        <Selo tipo="sucesso">Ativo</Selo>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaArea>
        </Cartao>
      </section>

      <button
        type="button"
        className="botao botao--secundario"
        onClick={() => void carregar()}
        disabled={carregando}
      >
        {carregando ? 'Atualizando...' : 'Atualizar agora'}
      </button>
    </>
  );
}
