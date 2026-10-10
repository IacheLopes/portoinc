// ============================================================
//  E-mail: trava de segurança, envio de teste e histórico
//
//  Mesma ordem da tela de WhatsApp, e pelo mesmo motivo:
//
//    1. A TRAVA vem primeiro. Antes de qualquer botão de enviar,
//       a pessoa precisa entender que o e-mail sai de verdade.
//    2. Depois a lista de quem pode receber.
//    3. Só então o envio de teste e o histórico.
//
//  padrao-ignora: sem-titulo — é conteúdo de aba; o <h1> é do
//  invólucro (Avisos.tsx), e dois títulos na mesma tela quebram a
//  hierarquia para quem usa leitor de tela.
//
//  padrao-ignora: sem-cabecalho — é conteúdo de aba; o cabeçalho é do invólucro (Avisos.tsx).
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import {
  buscarSituacaoEmail, listarEmailsAutorizados, autorizarEmail, removerEmailAutorizado,
  enviarEmailDeTeste, listarHistoricoDeEmail,
  type SituacaoEmail, type EmailAutorizado, type EmailDoHistorico,
} from '../../servicos/email';
import { ROTULO_MENSAGEM, COR_MENSAGEM } from '../../servicos/whatsapp';
import { dataHoraBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Campo } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';

export function ConfiguracaoEmail() {
  const [situacao, setSituacao] = useState<SituacaoEmail | null>(null);
  const [autorizados, setAutorizados] = useState<EmailAutorizado[]>([]);
  const [historico, setHistorico] = useState<EmailDoHistorico[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Cadastro de endereço autorizado.
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [observacao, setObservacao] = useState('');

  // Envio de teste.
  const [paraTeste, setParaTeste] = useState('');
  const [assuntoTeste, setAssuntoTeste] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [s, a, h] = await Promise.all([
        buscarSituacaoEmail(),
        listarEmailsAutorizados(),
        listarHistoricoDeEmail(),
      ]);
      setSituacao(s);
      setAutorizados(a.autorizados);
      setHistorico(h.historico);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar a tela de e-mail.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Executa e recarrega, mostrando o que aconteceu.
   *
   * O bloqueio pela lista NÃO é erro: é a trava funcionando. Por
   * isso ele aparece como aviso, não como falha vermelha.
   */
  async function executar(acao: () => Promise<{ mensagem: string }>) {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await acao();
      setAviso(r.mensagem);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não deu certo.');
    } finally {
      setOcupado(false);
    }
  }

  async function adicionarEndereco() {
    await executar(async () => {
      const r = await autorizarEmail({
        email,
        nome,
        observacao: observacao || undefined,
      });
      setEmail('');
      setNome('');
      setObservacao('');
      return r;
    });
  }

  async function testar() {
    await executar(() =>
      enviarEmailDeTeste({
        para: paraTeste,
        assunto: assuntoTeste || undefined,
      }),
    );
  }

  if (carregando) return <Carregando mensagem="Carregando a configuração de e-mail..." />;
  if (erro && !situacao) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;

  return (
    <>
      {/* ---------- A trava, antes de tudo ---------- */}
      <section className="secao">
        <div
          className={'aviso ' + (situacao?.simulado ? 'aviso--info' : 'aviso--atencao')}
          role="status"
        >
          <span className="aviso__icone" aria-hidden="true">
            <Icone nome={situacao?.simulado ? 'cadeado' : 'alerta'} />
          </span>
          <div>
            <strong>
              {situacao?.simulado
                ? 'Nenhum e-mail sai do sistema ainda.'
                : 'Ligado no provedor: o e-mail SAI.'}
            </strong>
            <p>{situacao?.detalhe}</p>
            {situacao?.modoTeste && (
              <p>
                O envio está <strong>restrito</strong>: só os endereços da lista abaixo
                recebem alguma coisa. Qualquer outro é barrado antes de sair, e a
                tentativa fica registrada.
              </p>
            )}
          </div>
        </div>

        {aviso && (
          <div className="aviso aviso--sucesso" role="status">
            <Icone nome="certo" className="aviso__icone" />
            <div>{aviso}</div>
          </div>
        )}

        {erro && situacao && (
          <div className="aviso aviso--erro" role="alert">
            <Icone nome="alerta" className="aviso__icone" />
            <div>{erro}</div>
          </div>
        )}
      </section>

      {/* ---------- Lista de autorizados ---------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Endereços autorizados</h2>
          <p className="secao__descricao">
            Enquanto o envio estiver restrito, só estes endereços recebem e-mail.
          </p>
        </div>

        <Cartao>
          <div className="formulario__linha">
            <Campo
              rotulo="E-mail"
              valor={email}
              aoMudar={setEmail}
              tipo="email"
              exemplo="voce@suaempresa.com.br"
              obrigatorio
              ajuda="Comece pelo seu próprio, para testar com segurança."
            />
            <Campo
              rotulo="De quem é"
              valor={nome}
              aoMudar={setNome}
              exemplo="Meu e-mail"
              obrigatorio
            />
            <Campo rotulo="Observação" valor={observacao} aoMudar={setObservacao} maximo={200} />
          </div>

          <div className="formulario__acoes formulario__acoes--fim">
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => void adicionarEndereco()}
              disabled={ocupado || !email || !nome}
            >
              Liberar e-mail
            </button>
          </div>
        </Cartao>

        {autorizados.length === 0 ? (
          <Vazio
            titulo="Nenhum endereço liberado"
            descricao="Comece liberando o seu próprio e-mail para testar com segurança."
          />
        ) : (
          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Endereços autorizados a receber</caption>
                <thead>
                  <tr>
                    <th scope="col">E-mail</th>
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
                        {a.emailMascarado}
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
                          onClick={() => void executar(() => removerEmailAutorizado(a.id))}
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
          <h2>Enviar um e-mail de teste</h2>
          <p className="secao__descricao">
            Serve para conferir a configuração antes de mandar qualquer coisa a fornecedor.
          </p>
        </div>

        <Cartao>
          <div className="formulario__linha">
            <Campo
              rotulo="Para"
              valor={paraTeste}
              aoMudar={setParaTeste}
              tipo="email"
              exemplo="voce@suaempresa.com.br"
              obrigatorio
              semMarcaOpcional
            />
            <Campo
              rotulo="Assunto"
              valor={assuntoTeste}
              aoMudar={setAssuntoTeste}
              exemplo="Porto Inc. — teste de envio"
              ajuda="Em branco, usa o assunto padrão."
            />
          </div>

          <div className="formulario__acoes formulario__acoes--fim">
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => void testar()}
              disabled={ocupado || !paraTeste}
            >
              {ocupado ? 'Enviando...' : 'Enviar teste'}
            </button>
          </div>
        </Cartao>
      </section>

      {/* ---------- Histórico ---------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>O que o sistema tentou enviar</h2>
          <p className="secao__descricao">
            Inclui o que foi barrado pela lista. Tentativa bloqueada também fica registrada.
          </p>
        </div>

        {historico.length === 0 ? (
          <Vazio
            titulo="Nada enviado ainda"
            descricao="Assim que o sistema mandar o primeiro e-mail, ele aparece aqui."
          />
        ) : (
          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">
                  Histórico de e-mails enviados e bloqueados
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Quando</th>
                    <th scope="col">Para</th>
                    <th scope="col">Assunto</th>
                    <th scope="col">De onde</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((m) => (
                    <tr key={m.id}>
                      <th scope="row" className="celula-texto">
                        {dataHoraBr(m.criadoEm)}
                        {m.enviadoPor && <small className="linha-extra">por {m.enviadoPor}</small>}
                      </th>
                      <td className="celula-texto">
                        <span className="mono">{m.emailMascarado}</span>
                        {m.destino && <small className="linha-extra">{m.destino}</small>}
                      </td>
                      <td className="celula-texto">
                        {m.assunto}
                        {m.temAnexo && <small className="linha-extra">com anexo</small>}
                      </td>
                      <td className="celula-texto">
                        {m.contexto ?? '—'}
                        {m.referencia && <small className="linha-extra">{m.referencia}</small>}
                      </td>
                      <td>
                        <Selo tipo={COR_MENSAGEM[m.situacao]}>{ROTULO_MENSAGEM[m.situacao]}</Selo>
                        {m.erro && <small className="linha-extra">{m.erro}</small>}
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
