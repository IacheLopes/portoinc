// ============================================================
//  Extrato do estoque
//
//  A resposta para "por que o saldo está assim?". Cada linha diz
//  o que entrou ou saiu, quem fez, para onde foi e quanto ficou.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarMovimentos, buscarEstoque, soma,
  ROTULO_MOVIMENTO, COR_MOVIMENTO,
  type Movimento, type AlmoxarifadoResumo,
} from '../../servicos/estoque';
import { quantidade as qtdBr, dinheiro } from '../../servicos/cadastros';
import { dataHoraBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Selecao } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';

export function MovimentosEstoque() {
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [almoxarifados, setAlmoxarifados] = useState<AlmoxarifadoResumo[]>([]);
  const [almoxarifadoId, setAlmoxarifadoId] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (alvo: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await listarMovimentos(alvo || undefined);
      setMovimentos(r.movimentos);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar o extrato.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const r = await buscarEstoque();
        setAlmoxarifados(r.almoxarifados);
      } catch {
        /* a lista de filtro é um extra; o extrato funciona sem ela */
      }
      await carregar('');
    })();
  }, [carregar]);

  if (carregando && movimentos.length === 0) {
    return <Carregando mensagem="Carregando o extrato..." />;
  }

  if (erro && movimentos.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar(almoxarifadoId)} />;
  }

  return (
    <>
      <section className="secao">
        <nav className="migalhas" aria-label="Você está em">
          <Link to="/estoque">Estoque</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">Extrato</span>
        </nav>

        <div className="secao__cabecalho">
          <h1>Extrato do estoque</h1>
          <p className="secao__descricao">
            Tudo o que entrou e saiu, do mais recente para o mais antigo. Nenhum movimento é
            apagado ou alterado.
          </p>
        </div>

        <div className="barra-acoes">
          <Selecao
            rotulo="Almoxarifado"
            valor={almoxarifadoId}
            aoMudar={(v) => {
              setAlmoxarifadoId(v);
              void carregar(v);
            }}
            opcoes={almoxarifados.map((a) => ({ valor: a.id, rotulo: a.nome }))}
            vazio="Todos"
            semMarcaOpcional
          />
        </div>
      </section>

      <section className="secao">
        {movimentos.length === 0 ? (
          <Vazio
            titulo="Nenhum movimento registrado"
            descricao="O extrato começa na primeira entrega conferida no recebimento."
          />
        ) : (
          <div className="cartao cartao--tabela">
            <div className="tabela-area">
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
            </div>
          </div>
        )}
      </section>
    </>
  );
}
