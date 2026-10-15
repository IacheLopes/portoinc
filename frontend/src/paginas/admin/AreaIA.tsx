// ============================================================
//  ÁREA IA — onde se liga e se molda o assistente
//
//  REFEITA EM 14/10/2026. A versão anterior tinha sete blocos
//  empilhados e quase três mil pixels de altura, todos com o mesmo
//  peso: estado, uma lista de diagnóstico com seis itens, um
//  formulário, quatro interruptores em fila, os grupos e a caixa
//  de teste. O dono resumiu bem: "o usuário final vai ver e pensar
//  pra que isso, ele só quer o botão de ligar e configurar".
//
//  O problema não era quantidade de coisas — era que TUDO tinha o
//  mesmo peso, e por isso nada tinha peso nenhum.
//
//  O QUE MUDOU, E POR QUÊ
//
//  1. O NOME DELE É O HERÓI. É a palavra que as pessoas vão dizer
//     em voz alta para chamá-lo no grupo. Ela fica grande, e tudo
//     em volta fica quieto.
//
//  2. A LISTA DE SEIS ITENS VIROU UMA FRASE. Ninguém abre uma tela
//     para ler um relatório de conformidade: quer saber o que
//     fazer AGORA. Só o próximo passo aparece, e some quando está
//     tudo pronto.
//
//  3. OS INTERRUPTORES FORAM AGRUPADOS PELA PERGUNTA QUE
//     RESPONDEM. "Onde ele atende" junta privado, grupos e o
//     gatilho do nome — que são a mesma decisão vista de ângulos
//     diferentes.
//
//     E O MODO RASCUNHO SAIU DE VEZ. Ele existiu enquanto a regra
//     da casa era "nada sai sem alguém mandar", e virou armadilha:
//     o assistente ficava no ar, pensando, e mudo — porque a chave
//     tinha ficado desligada de um conserto anterior. Ligar é
//     ligar: leu o QR, liberou o grupo, funciona.
//
//  4. O QUE É TÉCNICO FICA RECOLHIDO. Modelo, chave e limite são
//     mexidos uma vez por mês; não podem ocupar a tela de quem
//     entra toda semana.
//
//  O botão principal continua NÃO dizendo "Salvar": ele liga E
//  pergunta ao modelo. Mesma lição do e-mail — chave errada salva
//  em silêncio quebra o assistente em silêncio, e a empresa só
//  descobre quando alguém pergunta no grupo e ninguém responde.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import {
  buscarSituacaoIA, listarModelosIA, salvarCerebro, ligarIA, desligarIA,
  perguntarAoAssistente, listarGruposDoAssistente, buscarDiagnostico,
  listarGruposDisponiveis, adicionarGrupo, tirarGrupo,
  type SituacaoIA, type GrupoDoAssistente, type ItemDoDiagnostico,
} from '../../servicos/ia';
import { dataHoraBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Campo, Selecao } from '../../componentes/Campo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { Cartao } from '../../componentes/Cartao';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Icone } from '../../componentes/Icone';
import { Selo } from '../../componentes/Selo';

export default function AreaIA() {
  const [situacao, setSituacao] = useState<SituacaoIA | null>(null);
  const [modelos, setModelos] = useState<string[]>([]);
  const [grupos, setGrupos] = useState<GrupoDoAssistente[]>([]);
  const [diagnostico, setDiagnostico] = useState<ItemDoDiagnostico[]>([]);
  const [disponiveis, setDisponiveis] = useState<Array<{ jid: string; nome: string | null }>>([]);
  const [escolhido, setEscolhido] = useState('');
  const [buscandoGrupos, setBuscandoGrupos] = useState(false);
  const [buscandoModelos, setBuscandoModelos] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [instrucoes, setInstrucoes] = useState('');
  const [modelo, setModelo] = useState('');
  const [chave, setChave] = useState('');
  const [limite, setLimite] = useState('0');

  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState<{
    texto: string;
    consultas: string[];
    tokens: number;
  } | null>(null);
  const [perguntando, setPerguntando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [s, g, d] = await Promise.all([
        buscarSituacaoIA(),
        listarGruposDoAssistente(),
        buscarDiagnostico(),
      ]);

      setSituacao(s);
      setGrupos(g.grupos);
      setDiagnostico(d.itens);

      setNome(s.nome);
      setInstrucoes(s.instrucoes ?? '');
      setModelo(s.modeloEscolhido ?? '');
      setLimite(String(s.limitePorHora));
      setErro(null);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível carregar a Área IA.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  //  AS LISTAS DE FORA SÃO BUSCADAS A PEDIDO.
  //
  //  Modelos e grupos vêm do provedor e do WhatsApp. Tela de
  //  configuração não pode depender de serviço de fora para
  //  terminar de carregar — provedor lento vira tela lenta.
  async function buscarModelos() {
    setBuscandoModelos(true);
    try {
      const r = await listarModelosIA();
      setModelos(r.modelos);
    } catch {
      setModelos([]);
    } finally {
      setBuscandoModelos(false);
    }
  }

  async function buscarGrupos() {
    setBuscandoGrupos(true);
    setErro(null);

    try {
      const r = await listarGruposDisponiveis();
      setDisponiveis(r.grupos);

      if (r.grupos.length === 0) {
        setAviso(
          r.conectado
            ? 'Todos os grupos do WhatsApp já estão na lista.'
            : 'Nenhum grupo encontrado. O WhatsApp está conectado?',
        );
      }
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não consegui buscar os grupos.');
    } finally {
      setBuscandoGrupos(false);
    }
  }

  async function executar(acao: () => Promise<{ mensagem: string }>) {
    setOcupado(true);
    setErro(null);
    setAviso(null);

    try {
      const r = await acao();
      setAviso(r.mensagem);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível concluir.');
    } finally {
      setOcupado(false);
    }
  }

  function ligar() {
    void executar(() =>
      ligarIA({
        nome: nome.trim(),
        instrucoes: instrucoes.trim() || null,
        modelo: modelo || null,
        //  A chave só vai quando foi digitada agora. Em branco, a
        //  que está guardada continua valendo — senão salvar
        //  qualquer outro campo apagaria o segredo.
        ...(chave.trim() ? { chave: chave.trim() } : {}),
        limitePorHora: Number(limite) || 0,
      }).then((r) => ({ mensagem: r.mensagem + (r.resposta ? ' "' + r.resposta + '"' : '') })),
    );
  }

  function salvar() {
    void executar(() =>
      salvarCerebro({
        nome: nome.trim(),
        instrucoes: instrucoes.trim() || null,
        modelo: modelo || null,
        ...(chave.trim() ? { chave: chave.trim() } : {}),
        limitePorHora: Number(limite) || 0,
      }),
    );
  }

  function alternar(campo: keyof SituacaoIA, valor: boolean) {
    void executar(() => salvarCerebro({ [campo]: valor }));
  }

  async function perguntar() {
    setPerguntando(true);
    setErro(null);

    try {
      const r = await perguntarAoAssistente(pergunta.trim());
      setResposta({ texto: r.resposta, consultas: r.consultas, tokens: r.tokens });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'O assistente não respondeu.');
    } finally {
      setPerguntando(false);
    }
  }

  if (carregando) return <Carregando mensagem="Carregando a Área IA..." />;
  if (erro && !situacao) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  if (!situacao) return null;

  const respondendo = situacao.ativo && situacao.pronto;

  //  O PRÓXIMO PASSO, e não a lista inteira.
  //
  //  São seis condições para ele funcionar. Mostrá-las todas é
  //  pedir que a pessoa leia um relatório de conformidade antes de
  //  clicar num botão — e quatro delas costumam estar verdes.
  //  Mostramos só a primeira que falta: resolvida ela, a seguinte
  //  aparece sozinha.
  const proximoPasso = diagnostico.find((i) => !i.ok);

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Área IA"
          descricao="O assistente que responde no WhatsApp para o pessoal da Porto Inc."
        />

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

        {/* ---------- O HERÓI ----------

            O nome em corpo grande porque é a palavra que as pessoas
            vão dizer em voz alta para chamá-lo no grupo. Tudo em
            volta fica quieto para ela aparecer. */}
        <Cartao className={'conexao' + (respondendo ? ' conexao--no-ar' : '')}>
          <div className="conexao__topo">
            <div>
              <p className="conexao__estado">{situacao.nome}</p>
              <p className="conexao__numero">
                {situacao.ativo
                  ? 'Respondendo no WhatsApp, pelo número conectado.'
                  : 'Desligado. Ninguém é respondido.'}
              </p>
            </div>

            <div className="conexao__acoes">
              {situacao.ativo ? (
                <button
                  type="button"
                  className="botao botao--perigo"
                  onClick={() => void executar(desligarIA)}
                  disabled={ocupado}
                >
                  Desligar
                </button>
              ) : (
                <button
                  type="button"
                  className="botao botao--principal"
                  onClick={ligar}
                  disabled={ocupado || (!situacao.temChave && !chave.trim())}
                >
                  {ocupado ? 'Ligando e provando...' : 'Ligar o ' + situacao.nome}
                </button>
              )}
            </div>
          </div>

          {/* UMA LINHA, NÃO SEIS. */}
          {proximoPasso && (
            <p className="ia-passo">
              <Selo tipo="atencao">próximo passo</Selo>
              <span>{proximoPasso.falta}</span>
            </p>
          )}

          {situacao.ativo && (
            <dl className="conexao__tempos">
              <div>
                <dt>Modelo</dt>
                <dd>{situacao.modelo ?? '—'}</dd>
              </div>
              <div>
                <dt>Onde atende</dt>
                <dd>
                  {grupos.length === 0
                    ? 'só no privado'
                    : grupos.length === 1
                      ? (grupos[0].nome ?? '1 grupo')
                      : grupos.length + ' grupos'}
                </dd>
              </div>
              <div>
                <dt>Última prova</dt>
                <dd>{situacao.confirmadoEm ? dataHoraBr(situacao.confirmadoEm) : '—'}</dd>
              </div>
            </dl>
          )}

          {!situacao.ativo && (
            <p className="texto-fraco">
              Ao ligar, ele faz uma pergunta de prova ao modelo. Só fica verde se a resposta
              chegar.
            </p>
          )}
        </Cartao>
      </section>

      {/* ---------- Quem ele é ---------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Quem ele é</h2>
          <p className="secao__descricao">
            O nome é como o pessoal o chama no grupo. Evite palavra comum do dia a dia.
          </p>
        </div>

        <Cartao>
          <Campo
            rotulo="Nome"
            valor={nome}
            aoMudar={setNome}
            exemplo="Vigo"
            obrigatorio
            semMarcaOpcional
          />

          <div className="campo">
            <label className="campo__rotulo" htmlFor="ia-instrucoes">
              Como ele deve trabalhar
              <span className="campo__opcional"> (opcional)</span>
            </label>

            <textarea
              id="ia-instrucoes"
              className="campo__entrada"
              rows={4}
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
              placeholder="Ex.: Fale como colega de obra, direto. Quando falar de dinheiro, confira duas vezes."
            />

            <p className="campo__ajuda">
              Molda o jeito dele falar e o que priorizar. <strong>Não</strong> muda o que ele
              pode ver.
            </p>
          </div>

          <div className="formulario__acoes formulario__acoes--fim">
            <button
              type="button"
              className="botao botao--secundario"
              onClick={salvar}
              disabled={ocupado || !nome.trim()}
            >
              {ocupado ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </Cartao>
      </section>

      {/* ---------- Onde ele atende ----------

          As três marcas abaixo eram interruptores soltos numa
          lista, ao lado de outros que não tinham nada a ver com
          eles. São a MESMA pergunta vista de ângulos diferentes:
          onde ele fala, e quando. Juntas, elas se explicam. */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Onde ele atende</h2>
        </div>

        <Cartao>
          <div className="opcoes">
            <label className="opcao">
              <input
                type="checkbox"
                checked={situacao.responderNoPrivado}
                onChange={(e) => alternar('responderNoPrivado', e.target.checked)}
                disabled={ocupado}
              />
              <span>Conversa privada de quem é da empresa</span>
            </label>

            <label className="opcao">
              <input
                type="checkbox"
                checked={situacao.exigirNomeEmGrupo}
                onChange={(e) => alternar('exigirNomeEmGrupo', e.target.checked)}
                disabled={ocupado}
              />
              <span>Em grupo, só quando chamarem pelo nome</span>
            </label>

            <label className="opcao">
              <input
                type="checkbox"
                checked={situacao.transcreverAudio}
                onChange={(e) => alternar('transcreverAudio', e.target.checked)}
                disabled={ocupado}
              />
              <span>Entender áudio</span>
            </label>
          </div>

          <div className="lista-ia--com-fio">
            <p className="ia-nota">
              No grupo escolhido ele responde a <strong>qualquer pessoa</strong> que o chamar,
              tenha cadastro ou não — e a resposta aparece para todo mundo que está lá.
            </p>

            <Selecao
              rotulo="Adicionar um grupo"
              valor={escolhido}
              aoMudar={setEscolhido}
              opcoes={disponiveis.map((g) => ({
                valor: g.jid,
                rotulo: g.nome ?? 'Grupo sem nome',
              }))}
              vazio={
                disponiveis.length === 0
                  ? 'Primeiro busque os grupos do WhatsApp'
                  : 'Escolha um grupo'
              }
              semMarcaOpcional
            />

            <div className="formulario__acoes formulario__acoes--fim">
              <button
                type="button"
                className="botao botao--discreto"
                onClick={() => void buscarGrupos()}
                disabled={buscandoGrupos || ocupado}
              >
                {buscandoGrupos ? 'Buscando...' : 'Buscar no WhatsApp'}
              </button>

              <button
                type="button"
                className="botao botao--secundario"
                onClick={() => {
                  void executar(() => adicionarGrupo(escolhido)).then(() => setEscolhido(''));
                }}
                disabled={ocupado || !escolhido}
              >
                Adicionar
              </button>
            </div>

            {grupos.length === 0 ? (
              <Vazio
                titulo="Nenhum grupo"
                descricao="Sem grupo, ele só atende na conversa privada."
              />
            ) : (
              <ul className="lista-ia lista-ia--com-fio">
                {grupos.map((g) => (
                  <li key={g.id} className="linha-ia">
                    <div>
                      <p className="linha-ia__titulo">{g.nome ?? 'Grupo sem nome'}</p>
                      <p className="texto-fraco">
                        {g.liberadoEm ? 'desde ' + dataHoraBr(g.liberadoEm) : 'na lista'}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="botao botao--discreto"
                      onClick={() => void executar(() => tirarGrupo(g.id))}
                      disabled={ocupado}
                    >
                      Tirar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Cartao>
      </section>

      {/* ---------- Pergunte a ele ---------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Pergunte a ele</h2>
          <p className="secao__descricao">
            Confere sem precisar do WhatsApp. Nada é enviado a ninguém.
          </p>
        </div>

        <Cartao>
          <Campo
            rotulo="Pergunta"
            valor={pergunta}
            aoMudar={setPergunta}
            exemplo="O fornecedor Marquilip já respondeu a cotação?"
            obrigatorio
            semMarcaOpcional
          />

          <div className="formulario__acoes formulario__acoes--fim">
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => void perguntar()}
              disabled={perguntando || pergunta.trim().length < 2 || !situacao.pronto}
            >
              {perguntando ? 'Pensando...' : 'Perguntar'}
            </button>
          </div>

          {perguntando && (
            <p className="texto-fraco">
              Ele está consultando o sistema antes de responder. Pode levar meio minuto.
            </p>
          )}

          {resposta && (
            <div className="aviso aviso--neutro">
              <p>{resposta.texto}</p>
              <p className="texto-fraco">
                Consultou: {resposta.consultas.join(', ') || 'nada'} · {resposta.tokens} tokens
              </p>
            </div>
          )}
        </Cartao>
      </section>

      {/* ---------- Ajustes técnicos ----------

          RECOLHIDO, e é a decisão que mais enxuga a tela. Modelo,
          chave e limite são mexidos uma vez por mês; não podem
          ocupar a tela de quem entra toda semana.

          `<details>` é o primeiro do sistema. Escolhi o elemento
          nativo em vez de inventar um acordeão: ele abre sem
          JavaScript, funciona no teclado e o navegador já sabe
          anunciá-lo para quem usa leitor de tela. */}
      <section className="secao">
        <details className="ia-ajustes">
          <summary className="ia-ajustes__titulo">Ajustes técnicos</summary>

          <Cartao>
            <div className="formulario__linha">
              <Selecao
                rotulo="Modelo"
                valor={modelo}
                aoMudar={setModelo}
                opcoes={[...new Set([...(modelo ? [modelo] : []), ...modelos])].map((m) => ({
                  valor: m,
                  rotulo: m,
                }))}
                vazio="Escolher sozinho (recomendado)"
                ajuda="Lido da sua conta no provedor."
              />

              <Campo
                rotulo="Limite por pessoa, por hora"
                valor={limite}
                aoMudar={setLimite}
                tipo="number"
                ajuda="Zero tira o limite. Acima dele, ele avisa uma vez e fica quieto."
              />
            </div>

            <Campo
              rotulo="Chave do provedor"
              valor={chave}
              aoMudar={setChave}
              tipo="password"
              exemplo={situacao.temChave ? 'já cadastrada — digite outra para trocar' : 'gsk_...'}
              ajuda="Guardada cifrada. Nunca aparece de volta na tela."
            />

            <div className="formulario__acoes formulario__acoes--fim">
              <button
                type="button"
                className="botao botao--discreto"
                onClick={() => void buscarModelos()}
                disabled={buscandoModelos || !situacao.temChave}
              >
                {buscandoModelos ? 'Buscando...' : 'Buscar os modelos da conta'}
              </button>

              <button
                type="button"
                className="botao botao--secundario"
                onClick={salvar}
                disabled={ocupado}
              >
                Salvar ajustes
              </button>
            </div>
          </Cartao>
        </details>
      </section>
    </>
  );
}
