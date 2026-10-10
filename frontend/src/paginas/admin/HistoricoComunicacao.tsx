// ============================================================
//  Histórico de mensagens enviadas
//
//  Pedido dele em 10/10/2026:
//
//    "coloca em outra aba dentro de comunicações, algo como
//     histórico de mensagens enviadas. Com filtro de dias, anos,
//     paginação... como uma forma de prova que a mensagem foi
//     enviada."
//
//  A palavra é PROVA, e ela define a tela. O convite de cotação e
//  o pedido de compra saem do sistema e viram compromisso com um
//  fornecedor; quando ele liga dizendo "não recebi nada", alguém
//  precisa poder responder com data e hora.
//
//  POR QUE ISTO NÃO MORA MAIS NA TELA DE CONEXÃO
//
//  Morava, no pé da aba do WhatsApp, e atrapalhava duas vezes:
//  enchia uma tela que é de configurar, e mostrava só um canal.
//  Aqui os dois ficam juntos, porque WhatsApp e e-mail levam o
//  MESMO convite — quem pergunta "o BID-00005 saiu?" não quer
//  perguntar duas vezes.
//
//  padrao-ignora: sem-titulo — é conteúdo de aba; o <h1> é do
//  invólucro (Avisos.tsx), e dois <h1> na mesma tela é pior que um.
//  padrao-ignora: sem-cabecalho — é conteúdo de aba; o cabeçalho é do invólucro (Avisos.tsx).
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import {
  buscarHistoricoDeComunicacao,
  ROTULO_CANAL,
  ROTULO_CONTEXTO,
  type ItemDoHistorico,
  type PaginaDoHistorico,
  type Canal,
  type SituacaoEnvio,
} from '../../servicos/historicoComunicacao';
import { ROTULO_MENSAGEM, COR_MENSAGEM } from '../../servicos/whatsapp';
import { ErroApi } from '../../servicos/api';
import { Campo, Selecao } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { ContaDaPagina, Paginacao } from '../../componentes/Paginacao';
import { Icone } from '../../componentes/Icone';
import { useEsperarDigitar } from '../../ganchos/esperarDigitar';
import { dataHoraBr } from '../../servicos/solicitacoes';

/**
 * Os períodos, em dias.
 *
 * "Ano" entra porque ele pediu, e porque é o prazo em que uma
 * conversa sobre nota fiscal ainda volta. Zero quer dizer tudo.
 */
const PERIODOS = [
  { valor: '7', rotulo: 'Últimos 7 dias' },
  { valor: '30', rotulo: 'Últimos 30 dias' },
  { valor: '90', rotulo: 'Últimos 3 meses' },
  { valor: '365', rotulo: 'Último ano' },
  { valor: '0', rotulo: 'Desde o começo' },
] as const;

const CANAIS = [
  { valor: 'todos', rotulo: 'WhatsApp e e-mail' },
  { valor: 'whatsapp', rotulo: 'Só WhatsApp' },
  { valor: 'email', rotulo: 'Só e-mail' },
] as const;

const SITUACOES = [
  { valor: 'todas', rotulo: 'Qualquer resultado' },
  { valor: 'ENVIADA', rotulo: 'Só as que saíram' },
  { valor: 'BLOQUEADA', rotulo: 'Só as barradas' },
  { valor: 'FALHOU', rotulo: 'Só as que falharam' },
] as const;

/** De onde o envio partiu, em português. */
function deOnde(item: ItemDoHistorico): string {
  const nome = item.contexto ? (ROTULO_CONTEXTO[item.contexto] ?? item.contexto) : 'Avulsa';
  return item.referencia ? nome + ' · ' + item.referencia : nome;
}

export function HistoricoComunicacao() {
  const [dados, setDados] = useState<PaginaDoHistorico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [dias, setDias] = useState('30');
  const [canal, setCanal] = useState<Canal | 'todos'>('todos');
  const [situacao, setSituacao] = useState<SituacaoEnvio | 'todas'>('todas');
  const [termo, setTermo] = useState('');
  const [pagina, setPagina] = useState(1);

  //  Digitar não dispara uma busca por tecla.
  const termoBuscado = useEsperarDigitar(termo, 400);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    try {
      const r = await buscarHistoricoDeComunicacao({
        canal,
        situacao,
        dias: Number(dias) || undefined,
        termo: termoBuscado,
        pagina,
      });
      setDados(r);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível buscar o histórico.');
    } finally {
      setCarregando(false);
    }
  }, [canal, situacao, dias, termoBuscado, pagina]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  //  Trocar um filtro volta para a primeira página: a página 4 do
  //  filtro anterior quase nunca existe no novo, e cair numa lista
  //  vazia parece defeito.
  function mudarFiltro(acao: () => void) {
    acao();
    setPagina(1);
  }

  if (carregando && !dados) return <Carregando mensagem="Buscando o histórico..." />;
  if (erro && !dados) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  if (!dados) return null;

  return (
    <>
      <section className="secao">
        <div className="barra-acoes barra-acoes--filtros">
          <Selecao
            rotulo="Período"
            valor={dias}
            aoMudar={(v) => mudarFiltro(() => setDias(v))}
            opcoes={PERIODOS.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))}
            semMarcaOpcional
          />
          <Selecao
            rotulo="Canal"
            valor={canal}
            aoMudar={(v) => mudarFiltro(() => setCanal(v as Canal | 'todos'))}
            opcoes={CANAIS.map((c) => ({ valor: c.valor, rotulo: c.rotulo }))}
            semMarcaOpcional
          />
          <Selecao
            rotulo="Resultado"
            valor={situacao}
            aoMudar={(v) => mudarFiltro(() => setSituacao(v as SituacaoEnvio | 'todas'))}
            opcoes={SITUACOES.map((s) => ({ valor: s.valor, rotulo: s.rotulo }))}
            semMarcaOpcional
          />
          <Campo
            rotulo="Procurar"
            valor={termo}
            aoMudar={(v) => mudarFiltro(() => setTermo(v))}
            tipo="search"
            exemplo="fornecedor ou BID-00005"
            semMarcaOpcional
          />
        </div>

        <ContaDaPagina
          pagina={dados.pagina}
          total={dados.total}
          porPagina={dados.porPagina}
          oQue="mensagem"
          oQuePlural="mensagens"
          carregando={carregando}
        />

        {erro && (
          <p className="aviso aviso--erro" role="alert">
            <Icone nome="alerta" /> {erro}
          </p>
        )}

        {dados.itens.length === 0 ? (
          <Vazio
            titulo="Nada neste período"
            descricao="Cada convite de cotação, pedido de compra e teste de conexão fica registrado aqui assim que o sistema tenta enviar."
          />
        ) : (
          <>
            <Cartao semEspaco>
              <TabelaArea>
                <table className="tabela">
                  <caption className="apenas-leitor-tela">
                    Mensagens que o sistema enviou
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Quando</th>
                      <th scope="col">Para</th>
                      <th scope="col">Sobre o quê</th>
                      <th scope="col">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.itens.map((m) => (
                      <tr key={m.canal + m.id}>
                        <td data-rotulo="Quando">
                          {dataHoraBr(m.quando)}
                          {m.quem && <small className="linha-extra">{m.quem}</small>}
                        </td>

                        <td data-rotulo="Para">
                          {m.destino ?? m.para}
                          <small className="linha-extra">
                            {ROTULO_CANAL[m.canal]}
                            {m.destino ? ' · ' + m.para : ''}
                            {m.temAnexo ? ' · com anexo' : ''}
                          </small>
                        </td>

                        <td data-rotulo="Sobre o quê">
                          {deOnde(m)}
                          <small className="linha-extra">{m.resumo.slice(0, 80)}</small>
                        </td>

                        <td data-rotulo="Resultado">
                          <Selo tipo={COR_MENSAGEM[m.situacao]}>
                            {ROTULO_MENSAGEM[m.situacao]}
                          </Selo>
                          {m.erro && <small className="linha-extra">{m.erro}</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabelaArea>
            </Cartao>

            <Paginacao
              pagina={dados.pagina}
              paginas={dados.paginas}
              aoTrocar={setPagina}
              carregando={carregando}
            />
          </>
        )}
      </section>
    </>
  );
}
