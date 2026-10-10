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
  removerAutorizado, enviarTeste, buscarQr,
  ROTULO_ESTADO,
  type SituacaoWhatsApp, type NumeroAutorizado,
} from '../../servicos/whatsapp';
import { dataHoraBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Campo } from '../../componentes/Campo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';
import { faz } from '../../servicos/texto';

/** Enquanto o QR está na tela, vale reconferir de perto. */
const ESTADOS_QUE_MUDAM = ['iniciando', 'qr_pronto', 'aguardando_leitura', 'autenticando', 'reconectando'];

export function ConfiguracaoWhatsApp() {
  const [situacao, setSituacao] = useState<SituacaoWhatsApp | null>(null);
  const [autorizados, setAutorizados] = useState<NumeroAutorizado[]>([]);
  const [qr, setQr] = useState<string | null>(null);

  const [carregando, setCarregando] = useState(true);
  //  CADA BLOCO TEM O SEU PRÓPRIO RETORNO.
  //
  //  Eram um par só, compartilhado: conectar, desconectar e o
  //  envio de teste escreviam todos no mesmo lugar. Como o aviso
  //  é desenhado no cartão de conexão, lá em cima, quem clicava
  //  em "Enviar teste" via a confirmação a meia tela de distância
  //  do botão — e às vezes nem via, porque o bloco de teste fica
  //  no fim da página.
  const [erroConexao, setErroConexao] = useState<string | null>(null);
  const [avisoConexao, setAvisoConexao] = useState<string | null>(null);
  const [erroTeste, setErroTeste] = useState<string | null>(null);
  const [avisoTeste, setAvisoTeste] = useState<string | null>(null);
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
      const [s, a] = await Promise.all([buscarSituacao(), listarAutorizados()]);

      setSituacao(s);
      setAutorizados(a.autorizados);

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
      setErroConexao(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
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
    setErroConexao(null);
    setAvisoConexao(null);

    try {
      const r = await acao();
      setAvisoConexao(r.mensagem);
      await carregar();
    } catch (e) {
      setErroConexao(e instanceof ErroApi ? e.message : 'A ação não foi concluída.');
    } finally {
      setOcupado(false);
    }
  }

  async function adicionarNumero() {
    if (numero.trim() === '' || nome.trim() === '') {
      setErroConexao('Informe o número e o nome de quem vai receber.');
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
    setErroTeste(null);
    setAvisoTeste(null);

    try {
      const r = await enviarTeste({ para: paraTeste.trim(), texto: textoTeste.trim() });
      setAvisoTeste(r.mensagem);
      await carregar();
    } catch (e) {
      // O bloqueio pela lista chega como erro: é informação, não falha.
      setErroTeste(e instanceof ErroApi ? e.message : 'Não foi possível enviar.');
      await carregar();
    } finally {
      setOcupado(false);
    }
  }

  if (carregando && !situacao) return <Carregando mensagem="Conferindo o WhatsApp..." />;
  if (erroConexao && !situacao) {
    return <Erro mensagem={erroConexao} aoTentarNovamente={() => void carregar()} />;
  }
  if (!situacao) return null;

  const conectado = situacao.estado === 'conectado';
  const mostrandoQr = qr !== null;

  return (
    <>
      <section className="secao">
        {/* ----------------------------------------------------
            O ESTADO DA CONEXAO, EM UM LUGAR SO

            Antes de 10/10/2026 esta tela respondia "esta no ar?"
            QUATRO vezes: o cartao do topo, um indicador
            "Situacao", a linha do selo e o item "Agora" do
            diario. Mais "0 autorizados" dito tres vezes, em
            registros visuais diferentes.

            O problema nunca foi a quantidade de conteudo: era a
            mesma informacao repetida ate perder o peso. Quando
            tudo tem o mesmo tamanho, nada lidera e o olho nao
            sabe onde pousar.

            Agora: UMA tipografia grande na tela inteira, e ela e
            a resposta. Os tres fatos de tempo sao uma tira fina
            embaixo — detalhe DO estado, nao irmaos dele. Por isso
            nao viraram cartoes com numero grande, que e o padrao
            de painel que estava aqui e que o dono recusou.
            ---------------------------------------------------- */}
        <Cartao className={'conexao' + (conectado ? ' conexao--no-ar' : '')}>
          <div className="conexao__topo">
            <div>
              <p className="conexao__estado">
                {conectado ? 'No ar' : ROTULO_ESTADO[situacao.estado]}
              </p>
              {/* O QUE ACONTECE SE EU ENVIAR AGORA, EM UMA LINHA.
                  Isto era uma caixa vermelha de duas linhas acima do
                  cartão. Vermelho nesta casa quer dizer "alguma coisa
                  quebrou agora" — é a cor de parcela vencida e de erro
                  de formulário. Nada está quebrado aqui, e usar a cor
                  do alarme para informação de rotina ensina a ignorar
                  o alarme quando ele for de verdade. */}
              <p className="conexao__numero">
                {situacao.numero ?? 'Nenhum número conectado'}
                {conectado && (
                  <>
                    {' · '}
                    {situacao.modoTeste
                      ? 'só os números liberados recebem'
                      : 'as mensagens chegam no celular de quem está no cadastro'}
                  </>
                )}
              </p>
            </div>

            <div className="conexao__acoes">
              {conectado ? (
                <button
                  type="button"
                  className="botao botao--perigo"
                  onClick={() => void executar(desconectar)}
                  disabled={ocupado}
                >
                  Desconectar
                </button>
              ) : (
                <button
                  type="button"
                  className="botao botao--principal"
                  onClick={() => void executar(conectar)}
                  disabled={ocupado}
                >
                  Conectar
                </button>
              )}

              <button
                type="button"
                className="botao botao--discreto"
                onClick={() => void carregar()}
                disabled={ocupado}
              >
                Atualizar
              </button>
            </div>
          </div>

          {/* A frase do adaptador so aparece quando ela acrescenta
              alguma coisa. Com "No ar" em corpo 32, ler
              "Conectado." embaixo e ruido. */}
          {!conectado && situacao.detalhe && (
            <p className="conexao__explicacao">{situacao.detalhe}</p>
          )}

          {/* A RESPOSTA DO CLIQUE MORA JUNTO DO BOTAO QUE FOI CLICADO.
              Este cartão só mostra o que é DELE — conectar,
              desconectar, atualizar. O envio de teste tem o próprio
              aviso, lá embaixo: antes os dois dividiam o mesmo
              estado e a confirmação do envio aparecia aqui em cima,
              a meia tela do botão que a pessoa tinha acabado de
              clicar. */}
          {avisoConexao && (
            <p className="aviso aviso--sucesso" role="status">
              <Icone nome="certo" /> {avisoConexao}
            </p>
          )}

          {erroConexao && (
            <p className="aviso aviso--erro" role="alert">
              <Icone nome="alerta" /> {erroConexao}
            </p>
          )}

          <dl className="conexao__tempos">
            <div>
              <dt>Conectou</dt>
              <dd>
                {situacao.conexao.noArDesde
                  ? dataHoraBr(situacao.conexao.noArDesde)
                  : situacao.conexao.ultimaVezNoAr
                    ? dataHoraBr(situacao.conexao.ultimaVezNoAr)
                    : 'Nunca'}
              </dd>
            </div>

            <div>
              <dt>{conectado ? 'Está no ar há' : 'Fora do ar desde'}</dt>
              <dd>
                {conectado
                  ? faz(situacao.conexao.noArDesde).replace(/^há /, '')
                  : faz(situacao.conexao.ultimoFim?.quando ?? null).replace(/^há /, '')}
              </dd>
            </div>

            <div>
              <dt>Última parada</dt>
              <dd>
                {situacao.conexao.ultimoFim || situacao.conexao.ultimaQueda ? (
                  <>
                    {dataHoraBr(
                      (situacao.conexao.ultimaQueda ?? situacao.conexao.ultimoFim)!.quando,
                    )}
                    <span className="conexao__motivo">
                      {situacao.conexao.ultimaQueda ? 'caiu sozinha' : 'reinício do sistema'}
                    </span>
                  </>
                ) : (
                  'Nunca parou'
                )}
              </dd>
            </div>
          </dl>
        </Cartao>
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

      {/* ---------- Lista de autorizados ----------

          A LISTA SO APARECE QUANDO ELA MANDA EM ALGUMA COISA.

          Com o envio liberado, esta lista nao filtra nada: quem
          decide quem recebe passa a ser o cadastro do fornecedor.
          Deixa-la na tela — com formulario, botao e a frase "so
          estes numeros recebem mensagem" — seria oferecer um
          controle desligado a quem esta procurando justamente o
          controle. Pior que esconder: faz a pessoa acreditar que
          se protegeu.

          No lugar dela fica uma linha dizendo onde ela foi parar. */}
      {!situacao.modoTeste ? (
        <section className="secao">
          <p className="texto-fraco">
            A lista de números autorizados não está em uso: com o envio liberado, quem
            recebe é definido pelo <strong>cadastro de cada fornecedor</strong>. Ela volta
            a valer quando o envio for restrito de novo.
          </p>
        </section>
      ) : (
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
              exemplo="DDD + número, ex: 83999994448"
              obrigatorio
              ajuda="Comece pelo DDD. O 55 do Brasil o sistema põe sozinho."
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
      )}

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
              exemplo="DDD + número, ex: 83999994448"
              ajuda="Comece pelo DDD. O 55 do Brasil o sistema põe sozinho."
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

          {avisoTeste && (
            <p className="aviso aviso--sucesso" role="status">
              <Icone nome="certo" /> {avisoTeste}
            </p>
          )}

          {erroTeste && (
            <p className="aviso aviso--erro" role="alert">
              <Icone nome="alerta" /> {erroTeste}
            </p>
          )}

          {!conectado && (
            <p className="texto-fraco">Conecte primeiro para poder enviar.</p>
          )}
        </Cartao>
      </section>

      {/* ---------- O histórico saiu da tela ----------

          Ele mostrava as últimas tentativas, com data, destino
          mascarado e resultado. Gravava os três caminhos — teste,
          cotação e pedido —, não só o campo de teste.

          O dono mandou tirar em 10/10/2026, e a razão dele é boa:
          quem envia já vê a confirmação na hora, e esta tela virou
          ferramenta de conferência, não lugar de trabalho.

          O REGISTRO CONTINUA SENDO GRAVADO, de propósito. Ele
          responde uma pergunta que a tela de cotação ainda não
          responde: "o fornecedor diz que não recebeu — saiu ou não
          saiu?". Lá, "ainda não visualizou" quer dizer tanto "não
          abriu" quanto "nunca chegou", e nada separa as duas.

          O lugar certo dele, quando fizer falta, é uma coluna
          "enviado" na tabela de convidados da cotação, que é onde
          o comprador faz essa pergunta. Os dados estão em
          `mensagens_whatsapp`.
          ---------------------------------------------------- */}
    </>
  );
}
