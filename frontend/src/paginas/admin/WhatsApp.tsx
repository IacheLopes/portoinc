// ============================================================
//  WhatsApp: conexão, trava de segurança e histórico
//
//  A tela tem uma ordem proposital:
//
//    1. A TRAVA vem primeiro. Antes de qualquer botão de conectar,
//       a pessoa precisa entender que mensagem sai de verdade.
//    2. Depois a conexão e o QR Code.
//    3. Só então o envio de teste e o histórico.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buscarSituacao, conectar, desconectar, listarAutorizados, autorizarNumero,
  removerAutorizado, enviarTeste, listarHistorico, buscarQr,
  ROTULO_ESTADO, COR_ESTADO, ROTULO_MENSAGEM, COR_MENSAGEM,
  type SituacaoWhatsApp, type NumeroAutorizado, type MensagemDoHistorico,
} from '../../servicos/whatsapp';
import { dataHoraBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Campo } from '../../componentes/Campo';
import { Cartao } from '../../componentes/Cartao';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';

/** Enquanto o QR está na tela, vale reconferir de perto. */
const ESTADOS_QUE_MUDAM = ['iniciando', 'qr_pronto', 'aguardando_leitura', 'autenticando', 'reconectando'];

export function ConfiguracaoWhatsApp() {
  const [situacao, setSituacao] = useState<SituacaoWhatsApp | null>(null);
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
      const [s, a, h] = await Promise.all([
        buscarSituacao(),
        listarAutorizados(),
        listarHistorico(),
      ]);

      setSituacao(s);
      setAutorizados(a.autorizados);
      setHistorico(h.mensagens);

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
            {situacao.modoTeste ? '🔒' : '⚠'}
          </span>
          <div>
            <strong>
              {situacao.modoTeste
                ? 'Modo de teste ligado: só sai mensagem para número autorizado.'
                : 'Modo de teste DESLIGADO: o sistema envia para qualquer número.'}
            </strong>
            <p>
              {situacao.modoTeste ? (
                <>
                  Os fornecedores de demonstração têm telefones fictícios. Sem esta trava, um
                  clique em enviar cairia no celular de um desconhecido. Hoje há{' '}
                  <strong>{situacao.numerosAutorizados}</strong> número(s) liberado(s).
                </>
              ) : (
                <>
                  A trava foi desligada no arquivo <code>.env</code>. Todo envio vai para o
                  número real do fornecedor.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="grade">
          <Cartao
            titulo="Situação"
            valor={ROTULO_ESTADO[situacao.estado]}
            detalhe={situacao.numero ?? 'Nenhum número conectado'}
          />
          <Cartao
            titulo="Adaptador"
            valor={situacao.simulado ? 'Simulado' : situacao.adaptador}
            detalhe={situacao.simulado ? 'Nada sai para fora' : 'Envio real'}
          />
          <Cartao
            titulo="Autorizados"
            valor={String(situacao.numerosAutorizados)}
            detalhe="Podem receber mensagem"
          />
          <Cartao
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
            <span aria-hidden="true">✓</span> {aviso}
          </p>
        )}

        {erro && (
          <p className="aviso aviso--erro" role="alert">
            <span aria-hidden="true">⚠</span> {erro}
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

      {mostrandoQr && (
        <section className="secao">
          <div className="cartao painel-movimento qr-area">
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
          </div>
        </section>
      )}

      {/* ---------- Lista de autorizados ---------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Números autorizados</h2>
          <p className="secao__descricao">
            Enquanto o modo de teste estiver ligado, só estes números recebem mensagem.
          </p>
        </div>

        <div className="cartao">
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
        </div>

        {autorizados.length === 0 ? (
          <Vazio
            titulo="Nenhum número liberado"
            descricao="Comece liberando o seu próprio celular para testar com segurança."
          />
        ) : (
          <div className="cartao cartao--tabela">
            <div className="tabela-area">
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
            </div>
          </div>
        )}
      </section>

      {/* ---------- Envio de teste ---------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Enviar uma mensagem de teste</h2>
        </div>

        <div className="cartao">
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
        </div>
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
          <div className="cartao cartao--tabela">
            <div className="tabela-area">
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
            </div>
          </div>
        )}
      </section>

      <div className="aviso aviso--info">
        <span className="aviso__icone" aria-hidden="true">💡</span>
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
