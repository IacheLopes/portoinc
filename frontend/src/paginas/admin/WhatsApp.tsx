// ============================================================
//  WhatsApp: conexão, trava de segurança e histórico
//
//  A tela tem uma ordem proposital:
//
//    1. A TRAVA vem primeiro. Antes de qualquer botão de conectar,
//       a pessoa precisa entender que mensagem sai de verdade.
//    2. Depois a conexão e o QR Code.
//    3. Só então o envio de teste e o histórico.
//
//  padrao-ignora: sem-titulo — é conteúdo de aba; o <h1> é do
//  invólucro (Avisos.tsx), e dois títulos na mesma tela quebram a
//  hierarquia para quem usa leitor de tela.
//
//  padrao-ignora: sem-cabecalho — é conteúdo de aba; o cabeçalho é do invólucro (Avisos.tsx).
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buscarSituacao, conectar, desconectar, listarAutorizados, autorizarNumero,
  removerAutorizado, enviarTeste, listarHistorico, buscarQr,
  ROTULO_ESTADO, COR_ESTADO, ROTULO_MENSAGEM, COR_MENSAGEM,
  listarEventosDaConexao,
  type SituacaoWhatsApp, type NumeroAutorizado, type MensagemDoHistorico,
  type EventoDaConexao,
} from '../../servicos/whatsapp';
import { dataHoraBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Campo } from '../../componentes/Campo';
import { Indicador } from '../../componentes/Indicador';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';
import { palavra, faz } from '../../servicos/texto';

/** Enquanto o QR está na tela, vale reconferir de perto. */
const ESTADOS_QUE_MUDAM = ['iniciando', 'qr_pronto', 'aguardando_leitura', 'autenticando', 'reconectando'];

export function ConfiguracaoWhatsApp() {
  const [situacao, setSituacao] = useState<SituacaoWhatsApp | null>(null);
  const [eventos, setEventos] = useState<EventoDaConexao[]>([]);
  const [autorizados, setAutorizados] = useState<NumeroAutorizado[]>([]);
  const [historico, setHistorico] = useState<MensagemDoHistorico[]>([]);
  const [qr, setQr] = useState<string | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Cadastro de número autorizado.
  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState('');
  const [observacao, setObservacao] = useState('');

  // Envio de teste.
  const [paraTeste, setParaTeste] = useState('');
  const [textoTeste, setTextoTeste] = useState('Mensagem de teste do sistema da Porto Inc.');

  const qrAnterior = useRef<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [s, a, h, d] = await Promise.all([
        buscarSituacao(),
        listarAutorizados(),
        listarHistorico(),
        listarEventosDaConexao(),
      ]);

      setSituacao(s);
      setAutorizados(a.autorizados);
      setHistorico(h.mensagens);
      setEventos(d.eventos);

      if (s.temQr) {
        const novo = await buscarQr();
        if (qrAnterior.current) URL.revokeObjectURL(qrAnterior.current);
        qrAnterior.current = novo;
        setQr(novo);
      } else {
        if (qrAnterior.current) URL.revokeObjectURL(qrAnterior.current);
        qrAnterior.current = null;
        setQr(null);
      }
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Enquanto a conexão está em movimento, reconfere sozinho.
  useEffect(() => {
    if (!situacao || !ESTADOS_QUE_MUDAM.includes(situacao.estado)) return;

    const relogio = setInterval(() => void carregar(), 4000);
    return () => clearInterval(relogio);
  }, [situacao, carregar]);

  // Libera o endereço temporário do QR ao sair da tela.
  useEffect(() => {
    return () => {
      if (qrAnterior.current) URL.revokeObjectURL(qrAnterior.current);
    };
  }, []);

  async function executar(acao: () => Promise<{ mensagem: string }>) {
    setOcupado(true);
    setErro(null);
    setAviso(null);

    try {
      const r = await acao();
      setAviso(r.mensagem);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'A ação não foi concluída.');
    } finally {
      setOcupado(false);
    }
  }

  async function adicionarNumero() {
    if (numero.trim() === '' || nome.trim() === '') {
      setErro('Informe o número e o nome de quem vai receber.');
      return;
    }

    await executar(async () => {
      const r = await autorizarNumero({
        numero: numero.trim(),
        nome: nome.trim(),
        observacao: observacao.trim() || undefined,
      });

      setNumero('');
      setNome('');
      setObservacao('');
      return r;
    });
  }

  async function testar() {
    setOcupado(true);
    setErro(null);
    setAviso(null);

    try {
      const r = await enviarTeste({ para: paraTeste.trim(), texto: textoTeste.trim() });
      setAviso(r.mensagem);
      await carregar();
    } catch (e) {
      // O bloqueio pela lista chega como erro: é informação, não falha.
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível enviar.');
      await carregar();
    } finally {
      setOcupado(false);
    }
  }

  if (carregando && !situacao) return <Carregando mensagem="Conferindo o WhatsApp..." />;
  if (erro && !situacao) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  if (!situacao) return null;

  const conectado = situacao.estado === 'conectado';
  const mostrandoQr = qr !== null;

  return (
    <>
      <section className="secao">
        {/* ---------- A trava, antes de tudo ---------- */}
        <div className={'aviso ' + (situacao.modoTeste ? 'aviso--atencao' : 'aviso--erro')}>
          <span className="aviso__icone" aria-hidden="true">
            <Icone nome={situacao.modoTeste ? 'cadeado' : 'alerta'} />
          </span>
          <div>
            <strong>
              {situacao.modoTeste
                ? 'Envio restrito: só os números desta lista recebem mensagem.'
                : 'Envio liberado: o sistema manda para qualquer número de fornecedor.'}
            </strong>
            <p>
              {situacao.modoTeste ? (
                <>
                  Os fornecedores de demonstração têm telefones fictícios. Sem esta trava, um
                  clique em enviar cairia no celular de um desconhecido. Hoje há{' '}
                  <strong>{situacao.numerosAutorizados}</strong>{' '}
                  {palavra(
                    situacao.numerosAutorizados,
                    'número liberado',
                    'números liberados',
                  )}.
                </>
              ) : (
                <>
                  A restrição está desligada. Todo envio vai para o número real do
                  fornecedor, sem conferência.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="grade">
          {/* "Conectado" responde O QUE. Quem administra pergunta
              DESDE QUANDO — e a resposta estava no sistema, perdida
              a cada reinicio da API. Agora ela mora no diário. */}
          <Indicador
            titulo="Situação"
            valor={conectado ? 'No ar' : ROTULO_ESTADO[situacao.estado]}
            detalhe={
              conectado && situacao.conexao.noArDesde
                ? 'Desde ' + dataHoraBr(situacao.conexao.noArDesde)
                  + ' · ' + faz(situacao.conexao.noArDesde)
                : (situacao.numero ?? 'Nenhum número conectado')
            }
          />
          {/* O QUE ACONTECE SE EU CLICAR EM ENVIAR AGORA?
              É esta a pergunta, e ela tem DUAS condições: o canal
              precisa estar conectado E precisa ser o adaptador de
              verdade. A primeira versão deste cartão olhava só o
              adaptador e dizia "Sai de verdade" com o WhatsApp
              desligado — mentira para o lado perigoso. */}
          <Indicador
            titulo="Envio"
            valor={!conectado ? 'Não sai' : situacao.simulado ? 'Não sai do sistema' : 'Sai de verdade'}
            detalhe={
              !conectado
                ? 'Conecte um número primeiro'
                : situacao.simulado
                  ? 'As mensagens ficam registradas aqui'
                  : 'Chega no aparelho do fornecedor'
            }
          />
          <Indicador
            titulo="Autorizados"
            valor={String(situacao.numerosAutorizados)}
            detalhe="Podem receber mensagem"
          />
          <Indicador
            titulo="Mensagens"
            valor={String(historico.length)}
            detalhe="No histórico"
          />
        </div>

        <p className="rodape-info">
          <Selo tipo={COR_ESTADO[situacao.estado]}>{ROTULO_ESTADO[situacao.estado]}</Selo>{' '}
          {situacao.detalhe}
        </p>

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <Icone nome="certo" /> {aviso}
          </p>
        )}

        {erro && (
          <p className="aviso aviso--erro" role="alert">
            <Icone nome="alerta" /> {erro}
          </p>
        )}

        <div className="formulario__acoes">
          <button
            type="button"
            className="botao botao--principal"
            onClick={() => void executar(conectar)}
            disabled={ocupado || conectado}
          >
            {conectado ? 'Conectado' : 'Conectar'}
          </button>

          <button
            type="button"
            className="botao botao--perigo"
            onClick={() => void executar(desconectar)}
            disabled={ocupado || situacao.estado === 'desconectado'}
          >
            Desconectar
          </button>

          <button
            type="button"
            className="botao botao--discreto"
            onClick={() => void carregar()}
            disabled={ocupado}
          >
            Atualizar
          </button>
        </div>
      </section>

      {/* ----------------------------------------------------
          O DIÁRIO DA CONEXÃO

          Pedido dele em 10/10/2026, olhando a tela conectada:
          "hora que foi conectado, hora que foi desconectado,
          status online/offline, se caiu".

          O adaptador sempre soube disso no instante em que
          acontecia — e esquecia no instante seguinte, porque
          `desde` era sobrescrito a cada mudança e nada sobrevivia
          a um reinício da API.

          As três linhas de cima respondem as perguntas dele de
          uma vez; a lista embaixo é para quando a resposta curta
          não basta ("caiu de novo às 3 da manhã?").
          ---------------------------------------------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>A conexão ao longo do tempo</h2>
          <p className="secao__descricao">
            Quando subiu, quando caiu e o que aconteceu no meio. Fica guardado mesmo que o
            sistema reinicie.
          </p>
        </div>

        <Cartao>
          <dl className="diario">
            <div className="diario__item">
              <dt>Agora</dt>
              <dd>
                <Selo tipo={conectado ? 'sucesso' : 'atencao'}>
                  {conectado ? 'No ar' : 'Fora do ar'}
                </Selo>
                <span className="diario__nota">
                  {conectado
                    ? 'Recebendo e enviando pelo ' + (situacao.numero ?? 'número conectado')
                    : situacao.detalhe}
                </span>
              </dd>
            </div>

            <div className="diario__item">
              <dt>Entrou no ar</dt>
              <dd>
                {situacao.conexao.noArDesde ? (
                  <>
                    {dataHoraBr(situacao.conexao.noArDesde)}
                    <span className="diario__nota">{faz(situacao.conexao.noArDesde)}</span>
                  </>
                ) : situacao.conexao.ultimaVezNoAr ? (
                  <>
                    {/* Fora do ar: a pergunta vira "quando foi a
                        última vez que esteve", que é outra coisa. */}
                    <span className="texto-fraco">Não está no ar</span>
                    <span className="diario__nota">
                      A última vez foi {dataHoraBr(situacao.conexao.ultimaVezNoAr)},{' '}
                      {faz(situacao.conexao.ultimaVezNoAr)}
                    </span>
                  </>
                ) : (
                  <span className="texto-fraco">Nunca esteve no ar</span>
                )}
              </dd>
            </div>

            <div className="diario__item">
              <dt>Última queda</dt>
              <dd>
                {situacao.conexao.ultimaQueda ? (
                  <>
                    {dataHoraBr(situacao.conexao.ultimaQueda.quando)}
                    <span className="diario__nota">
                      {faz(situacao.conexao.ultimaQueda.quando)}
                      {situacao.conexao.ultimaQueda.detalhe
                        ? ' · ' + situacao.conexao.ultimaQueda.detalhe
                        : ''}
                    </span>
                  </>
                ) : (
                  <span className="texto-fraco">Nunca caiu</span>
                )}
              </dd>
            </div>

            {/* "DESLIGADA POR ALGUÉM" ERA MENTIRA METADE DAS VEZES.
                O mesmo estado `desconectado` cobre três coisas: o
                clique em Desconectar, a sessão encerrada no celular
                e o sistema reiniciando. O rótulo dizia que alguém
                desligou mesmo quando ninguém encostou. Agora o
                rótulo é neutro e quem explica é o motivo, que já
                vinha pronto e eu não estava mostrando. */}
            <div className="diario__item">
              <dt>Última parada</dt>
              <dd>
                {situacao.conexao.ultimoFim ? (
                  <>
                    {dataHoraBr(situacao.conexao.ultimoFim.quando)}
                    <span className="diario__nota">
                      {faz(situacao.conexao.ultimoFim.quando)}
                      {situacao.conexao.ultimoFim.detalhe
                        ? ' · ' + situacao.conexao.ultimoFim.detalhe
                        : ''}
                    </span>
                  </>
                ) : (
                  <span className="texto-fraco">Nunca parou</span>
                )}
              </dd>
            </div>

            <div className="diario__item">
              <dt>Quedas em 24 horas</dt>
              <dd>
                {/* ZERO TAMBÉM É RESPOSTA, e é a boa. Esconder o
                    número quando não há queda obrigaria a pessoa a
                    concluir pelo silêncio. */}
                <strong>{situacao.conexao.quedasEm24h}</strong>
                <span className="diario__nota">
                  {situacao.conexao.quedasEm24h === 0
                    ? 'A conexão não caiu sozinha no último dia'
                    : 'Queda demais costuma ser sinal de internet instável no servidor'}
                </span>
              </dd>
            </div>
          </dl>
        </Cartao>

        <h3 className="diario__titulo">O que aconteceu</h3>

        {eventos.length === 0 ? (
          <Vazio
            titulo="Nada registrado ainda"
            descricao="Cada vez que a conexão subir, cair ou for desligada, aparece uma linha aqui."
          />
        ) : (
          <TabelaArea>
            <table className="tabela">
              <caption className="apenas-leitor-tela">Mudanças da conexão do WhatsApp</caption>
              <thead>
                <tr>
                  <th scope="col">Quando</th>
                  <th scope="col">O que houve</th>
                  <th scope="col">Detalhe</th>
                  <th scope="col">Número</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id}>
                    <td data-rotulo="Quando">
                      {dataHoraBr(e.quando)}
                      <span className="diario__nota">{faz(e.quando)}</span>
                    </td>
                    <td data-rotulo="O que houve">
                      <Selo tipo={COR_ESTADO[e.estado]}>{ROTULO_ESTADO[e.estado]}</Selo>
                    </td>
                    <td data-rotulo="Detalhe">{e.detalhe ?? '—'}</td>
                    <td data-rotulo="Número">{e.numeroMascarado ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaArea>
        )}
      </section>

      {mostrandoQr && (
        <section className="secao">
          <Cartao className="painel-movimento qr-area">
            <div>
              <h2>Leia o QR Code</h2>
              <ol className="lista-passos">
                <li>Abra o WhatsApp no celular</li>
                <li>
                  Toque em <strong>Aparelhos conectados</strong>
                </li>
                <li>
                  Toque em <strong>Conectar um aparelho</strong>
                </li>
                <li>Aponte a câmera para o código ao lado</li>
              </ol>
              <p className="texto-fraco">
                O código muda sozinho de tempos em tempos. A tela atualiza junto.
              </p>
            </div>

            <img src={qr} alt="QR Code para conectar o WhatsApp" width={280} height={280} />
          </Cartao>
        </section>
      )}

      {/* ---------- Lista de autorizados ---------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Números autorizados</h2>
          <p className="secao__descricao">
            Enquanto o envio estiver restrito, só estes números recebem mensagem.
          </p>
        </div>

        <Cartao>
          <div className="formulario__linha">
            <Campo
              rotulo="Número"
              valor={numero}
              aoMudar={setNumero}
              exemplo="5511987654321"
              obrigatorio
              ajuda="Com DDI e DDD, só números."
            />
            <Campo
              rotulo="De quem é"
              valor={nome}
              aoMudar={setNome}
              exemplo="Meu celular"
              obrigatorio
            />
            <Campo rotulo="Observação" valor={observacao} aoMudar={setObservacao} maximo={200} />
          </div>

          <div className="formulario__acoes formulario__acoes--fim">
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => void adicionarNumero()}
              disabled={ocupado}
            >
              Liberar número
            </button>
          </div>
        </Cartao>

        {autorizados.length === 0 ? (
          <Vazio
            titulo="Nenhum número liberado"
            descricao="Comece liberando o seu próprio celular para testar com segurança."
          />
        ) : (
          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Números autorizados a receber</caption>
                <thead>
                  <tr>
                    <th scope="col">Número</th>
                    <th scope="col">De quem é</th>
                    <th scope="col">Observação</th>
                    <th scope="col">Liberado por</th>
                    <th scope="col">
                      <span className="apenas-leitor-tela">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {autorizados.map((a) => (
                    <tr key={a.id}>
                      <th scope="row" className="mono">
                        {a.numeroMascarado}
                      </th>
                      <td>{a.nome}</td>
                      <td className="celula-texto">{a.observacao ?? '—'}</td>
                      <td className="celula-texto">
                        {a.criadoPor}
                        <small className="linha-extra">{dataHoraBr(a.criadoEm)}</small>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="botao botao--discreto"
                          onClick={() =>
                            void executar(async () => {
                              const r = await removerAutorizado(a.id);
                              return r;
                            })
                          }
                          disabled={ocupado}
                        >
                          Tirar da lista
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          </Cartao>
        )}
      </section>

      {/* ---------- Envio de teste ---------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Enviar uma mensagem de teste</h2>
        </div>

        <Cartao>
          <div className="formulario__linha">
            <Campo
              rotulo="Para o número"
              valor={paraTeste}
              aoMudar={setParaTeste}
              exemplo="5511987654321"
              obrigatorio
            />
            <Campo rotulo="Mensagem" valor={textoTeste} aoMudar={setTextoTeste} maximo={1000} />
          </div>

          <div className="formulario__acoes formulario__acoes--fim">
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => void testar()}
              disabled={ocupado || !conectado}
            >
              Enviar teste
            </button>
          </div>

          {!conectado && (
            <p className="texto-fraco">Conecte primeiro para poder enviar.</p>
          )}
        </Cartao>
      </section>

      {/* ---------- Histórico ---------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Histórico de envios</h2>
          <p className="secao__descricao">
            Inclui o que foi <strong>bloqueado</strong>: se alguém tentou mandar para fora da
            lista, aparece aqui.
          </p>
        </div>

        {historico.length === 0 ? (
          <Vazio
            titulo="Nada enviado ainda"
            descricao="Cada tentativa fica registrada aqui, com o resultado."
          />
        ) : (
          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Mensagens enviadas pelo sistema</caption>
                <thead>
                  <tr>
                    <th scope="col">Quando</th>
                    <th scope="col">Para</th>
                    <th scope="col">De onde</th>
                    <th scope="col">Resultado</th>
                    <th scope="col">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((m) => (
                    <tr key={m.id}>
                      <td className="celula-texto">
                        {dataHoraBr(m.criadoEm)}
                        {m.enviadoPor && <small className="linha-extra">{m.enviadoPor}</small>}
                      </td>
                      <td>
                        <span className="mono">{m.numeroMascarado}</span>
                        {m.destino && <small className="linha-extra">{m.destino}</small>}
                      </td>
                      <td className="celula-texto">
                        {m.contexto ?? '—'}
                        {m.referencia && <small className="linha-extra">{m.referencia}</small>}
                      </td>
                      <td>
                        <Selo tipo={COR_MENSAGEM[m.situacao]}>{ROTULO_MENSAGEM[m.situacao]}</Selo>
                        {m.erro && <small className="linha-extra">{m.erro}</small>}
                      </td>
                      <td className="celula-texto">
                        {m.temAnexo && <Selo tipo="info">anexo</Selo>}{' '}
                        {m.texto.split('\n')[0].slice(0, 60)}
                        {m.texto.length > 60 ? '...' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          </Cartao>
        )}
      </section>

      <div className="aviso aviso--info">
        <Icone nome="dica" className="aviso__icone" />
        <div>
          <strong>Use um chip de testes, não o número da empresa.</strong>
          <p>
            Esta conexão usa a biblioteca Baileys, que <strong>não é oficial</strong> do WhatsApp.
            Existe risco real de bloqueio da conta. Quando a Porto Inc. tiver a conta comercial
            aprovada pela Meta, trocar para a API oficial é uma linha de configuração — e nada
            nesta tela muda.
          </p>
        </div>
      </div>
    </>
  );
}
