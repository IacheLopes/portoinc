// ============================================================
//  Extrato do estoque
//
//  A resposta para "por que o saldo está assim?". Cada linha diz
//  o que entrou ou saiu, quem fez, para onde foi e quanto ficou.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import {
  listarMovimentos, buscarEstoque, soma,
  ROTULO_MOVIMENTO, COR_MOVIMENTO,
  type Movimento, type AlmoxarifadoResumo,
} from '../../servicos/estoque';
import { quantidade as qtdBr, dinheiro } from '../../servicos/texto';
import { dataHoraBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Selecao } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Paginacao, ContaDaPagina } from '../../componentes/Paginacao';
import { usePagina } from '../../ganchos/pagina';

export function MovimentosEstoque() {
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [almoxarifados, setAlmoxarifados] = useState<AlmoxarifadoResumo[]>([]);
  const [almoxarifadoId, setAlmoxarifadoId] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const pag = usePagina(almoxarifadoId);

  const carregar = useCallback(async (alvo: string, pagina = 1) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await listarMovimentos(alvo || undefined, undefined, pagina);
      setMovimentos(r.movimentos);
      pag.chegou(r);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar o extrato.');
      pag.falhou();
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A lista de almoxarifados é o recheio do filtro, e não muda:
  // busca uma vez.
  useEffect(() => {
    void (async () => {
      try {
        const r = await buscarEstoque();
        setAlmoxarifados(r.almoxarifados);
      } catch {
        /* a lista de filtro é um extra; o extrato funciona sem ela */
      }
    })();
  }, []);

  // O extrato recarrega ao trocar de almoxarifado ou de página.
  //
  // Antes a troca de almoxarifado chamava `carregar` dentro do
  // próprio campo. Com a página no meio havia dois caminhos para
  // a mesma busca, e o do campo não sabia da página — então
  // filtrar estando na página 5 pedia a página 1 do filtro novo
  // e, na sequência, a 5 dele. Com um caminho só isso não existe.
  useEffect(() => {
    void carregar(almoxarifadoId, pag.pagina);
  }, [carregar, almoxarifadoId, pag.pagina]);

  if (carregando && movimentos.length === 0) {
    return <Carregando mensagem="Carregando o extrato..." />;
  }

  if (erro && movimentos.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar(almoxarifadoId)} />;
  }

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Extrato do estoque"
          descricao={
            <>
              Tudo o que entrou e saiu, do mais recente para o mais antigo. Nenhum movimento é
            apagado ou alterado.
            </>
          }
        />

        <div className="barra-acoes">
          <Selecao
            rotulo="Almoxarifado"
            valor={almoxarifadoId}
            aoMudar={setAlmoxarifadoId}
            opcoes={almoxarifados.map((a) => ({ valor: a.id, rotulo: a.nome }))}
            vazio="Todos"
            semMarcaOpcional
          />
        </div>
      </section>

      <section className="secao secao-com-ancora" ref={pag.topo}>
        <ContaDaPagina
          pagina={pag.pagina}
          total={pag.dados.total}
          porPagina={pag.dados.porPagina}
          oQue="movimento"
          oQuePlural="movimentos"
          carregando={pag.trocando}
        />

        {movimentos.length === 0 ? (
          <Vazio
            titulo="Nenhum movimento registrado"
            descricao="O extrato começa na primeira entrega conferida no recebimento."
          />
        ) : (
          <Cartao
            semEspaco
            key={pag.pagina}
            className={pag.trocando ? 'lista-trocando' : 'lista-chegou'}
          >
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Movimentos de estoque</caption>
                <thead>
                  <tr>
                    <th scope="col">Movimento</th>
                    <th scope="col">Material</th>
                    <th scope="col">O que foi</th>
                    <th scope="col" className="numero">Quantidade</th>
                    <th scope="col" className="numero">Saldo depois</th>
                    <th scope="col">Quem / para onde</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentos.map((m) => (
                    <tr key={m.id}>
                      <th scope="row" className="mono">
                        {m.numeroFormatado}
                        <small className="linha-extra">{dataHoraBr(m.criadoEm)}</small>
                      </th>
                      <td>
                        <span className="mono">{m.codigo}</span> {m.descricao}
                        <small className="linha-extra">{m.almoxarifado}</small>
                      </td>
                      <td>
                        <Selo tipo={COR_MOVIMENTO[m.tipo]}>{ROTULO_MOVIMENTO[m.tipo]}</Selo>
                        {m.observacao && <small className="linha-extra">{m.observacao}</small>}
                      </td>
                      <td className="numero">
                        {(m.tipo === 'AJUSTE'
                          ? m.quantidade > 0
                            ? '+'
                            : '−'
                          : soma(m.tipo)
                            ? '+'
                            : '−') + qtdBr(Math.abs(m.quantidade))}{' '}
                        {m.unidadeMedida}
                        {m.valorUnitario ? (
                          <small className="linha-extra">{dinheiro(m.valorUnitario)} cada</small>
                        ) : null}
                      </td>
                      <td className="numero destaque">{qtdBr(m.saldoDepois)}</td>
                      <td className="celula-texto">
                        {m.usuario}
                        {m.destino && (
                          <small className="linha-extra">
                            {m.tipo === 'TRANSFERENCIA_ENTRADA' ? 'veio de ' : '→ '}
                            {m.destino}
                          </small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          </Cartao>
        )}

        {/* O extrato é a lista que cresce mais rápido do sistema:
            toda retirada de saco de cimento vira uma linha, e
            nenhuma é apagada. Era a que mais precisava disto. */}
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
