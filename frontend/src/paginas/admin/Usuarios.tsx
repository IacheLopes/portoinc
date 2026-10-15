// ============================================================
//  Usuários e funções
//
//  Mostra quem tem acesso, com quais funções, e permite
//  cadastrar gente nova. É aqui que se cumpre o pedido da
//  reunião: "cada usuário pode ter mais de uma função".
//
//  AS DUAS ABAS, E POR QUE ELAS SE JUNTARAM
//
//  "Funções e permissões" tinha bloco próprio no menu até
//  10/10/2026. Eram duas telas para uma pergunta só — quem pode
//  o quê — e quem cadastrava alguém tinha de sair daqui para ver
//  o que a função dele libera. Pior: esta tela já listava as
//  funções embaixo, sem deixar mexer. Duas respostas para a
//  mesma coisa, e a de baixo era a pior.
//
//  O botão azul fica no cabeçalho padrão, não dentro da aba: é
//  dele que a régua mede o alinhamento entre telas. Por isso o
//  pedido de "novo" desce do pai para a aba, em vez de cada aba
//  ter o seu botão em altura própria.
// ============================================================

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listarUsuarios,
  listarFuncoes,
  criarUsuario,
  editarUsuario,
  redefinirSenhaDe,
  ErroApi,
  type UsuarioAdmin,
  type Convite,
} from '../../servicos/api';
import { Selo } from '../../componentes/Selo';
import { Campo, ErroFormulario } from '../../componentes/Campo';
import { AvisoDeCriacao } from '../../componentes/AvisoDeCriacao';
import { LinkDeSenha } from '../../componentes/LinkDeSenha';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { dataHoraBr } from '../../servicos/solicitacoes';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';
import { Modal } from '../../componentes/Modal';
import { useEsperarDigitar } from '../../ganchos/esperarDigitar';
import { mascaraTelefone, telefoneParaGuardar } from '../../servicos/mascaras';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { PainelDeFuncoes } from './Funcoes';

interface FuncaoItem {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  usuarios: number;
  permissoes: Array<{ codigo: string; nome: string; grupo: string }>;
}

function formatarData(iso: string | null): string {
  if (!iso) return 'Nunca entrou';
  return dataHoraBr(iso);
}

export function Usuarios() {
  const [parametros, setParametros] = useSearchParams();
  const { pode } = useAutenticacao();
  const podeFuncoes = pode('funcoes.gerenciar');

  //  Quem não administra funções não vê a aba — e nem chega nela
  //  pelo endereço.
  const pedida = parametros.get('ver');
  const aba: Aba = pedida === 'funcoes' && podeFuncoes ? 'funcoes' : 'pessoas';

  //  O pedido de "novo" é um contador, não um booleano: clicar duas
  //  vezes seguidas precisa abrir duas vezes, e um booleano já em
  //  `true` não avisaria a segunda.
  const [pedidoDeNovo, setPedidoDeNovo] = useState(0);

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Usuários e funções"
          descricao={
            <>
              Quem entra no sistema, e o que cada função libera. As permissões somam:
              quem é Comprador <em>e</em> Solicitante tem o que as duas liberam.
            </>
          }
          acoes={
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => setPedidoDeNovo((n) => n + 1)}
            >
              {aba === 'pessoas' ? '+ Novo usuário' : '+ Nova função'}
            </button>
          }
        />

        {podeFuncoes && (
          <div className="abas" role="tablist" aria-label="Usuários e funções">
            {ABAS.map((a) => (
              <button
                key={a.chave}
                type="button"
                role="tab"
                id={'aba-' + a.chave}
                aria-selected={a.chave === aba}
                aria-controls={'painel-' + a.chave}
                className={'aba' + (a.chave === aba ? ' aba--ativa' : '')}
                onClick={() => setParametros(a.chave === 'pessoas' ? {} : { ver: a.chave })}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
        )}
      </section>

      <div role="tabpanel" id={'painel-' + aba} aria-labelledby={'aba-' + aba}>
        {aba === 'pessoas' ? (
          <PainelDePessoas pedidoDeNovo={pedidoDeNovo} />
        ) : (
          <PainelDeFuncoes pedidoDeNovo={pedidoDeNovo} />
        )}
      </div>
    </>
  );
}

const ABAS = [
  { chave: 'pessoas', rotulo: 'Pessoas' },
  { chave: 'funcoes', rotulo: 'Funções' },
] as const;

type Aba = (typeof ABAS)[number]['chave'];

function PainelDePessoas({ pedidoDeNovo }: { pedidoDeNovo: number }) {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [formAberto, setFormAberto] = useState(false);

  //  O botão azul mora no cabeçalho, que é do pai. O contador sobe
  //  de zero a cada clique; o zero inicial não abre nada.
  useEffect(() => {
    if (pedidoDeNovo > 0) setFormAberto(true);
  }, [pedidoDeNovo]);
  /** De quem estamos redefinindo a senha. `null` = de ninguém. */
  const [redefinindo, setRedefinindo] = useState<UsuarioAdmin | null>(null);
  /**
   * Quem estamos editando.
   *
   * A tela deixava DESATIVAR e REDEFINIR SENHA, mas não corrigir
   * um nome, um telefone ou uma função — para trocar qualquer um
   * deles era preciso criar outra conta. O buraco apareceu em
   * 14/10/2026, quando o assistente do WhatsApp passou a
   * reconhecer as pessoas PELO TELEFONE e não havia por onde
   * cadastrá-lo em quem já existia.
   */
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** O link de senha recém-gerado, e para quem ele é. */
  const [convite, setConvite] = useState<(Convite & { chamada: string }) | null>(null);

  const carregar = useCallback(async (termo = '') => {
    setCarregando(true);
    setErro(null);
    try {
      const [resUsuarios, resFuncoes] = await Promise.all([
        listarUsuarios(termo || undefined),
        listarFuncoes(),
      ]);
      setUsuarios(resUsuarios.usuarios);
      setFuncoes(resFuncoes.funcoes);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  // O campo de digitar espera a pessoa parar, para nao buscar a
  // cada tecla.
  const buscaAdiada = useEsperarDigitar(busca);

  useEffect(() => {
    void carregar(buscaAdiada);
  }, [carregar, buscaAdiada]);

  async function alternarAtivo(usuario: UsuarioAdmin) {
    setAviso(null);
    try {
      await editarUsuario(usuario.id, { ativo: !usuario.ativo });
      setAviso(
        usuario.nome + (usuario.ativo ? ' foi desativado.' : ' foi reativado.'),
      );
      await carregar(busca);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao alterar.');
    }
  }

  if (carregando && usuarios.length === 0) {
    return <Carregando mensagem="Carregando usuários..." />;
  }

  if (erro && usuarios.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  return (
    <>
      <section className="secao">
        <div className="barra-acoes">
          <Campo
            rotulo="Buscar"
            valor={busca}
            aoMudar={setBusca}
            tipo="search"
            exemplo="nome ou e-mail"
            semMarcaOpcional
            aoConfirmar={() => void carregar(busca)}
          />
        </div>

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <Icone nome="certo" /> {aviso}
          </p>
        )}

        {/* O LINK APARECE UMA VEZ SÓ.
            O token não fica guardado em lugar nenhum — o banco tem
            só o resumo dele. Recarregar a tela não traz de volta, e
            é por isso que ele fica aqui em cima, grande, em vez de
            numa notificação que some sozinha. */}
        {convite && (
          <LinkDeSenha
            token={convite.token}
            expiraEm={convite.expiraEm}
            chamada={convite.chamada}
          />
        )}

        <FormularioUsuario
          key={String(formAberto)}
          aberto={formAberto}
          aoFechar={() => setFormAberto(false)}
          funcoes={funcoes}
          aoSalvar={async (nome, novo) => {
            setFormAberto(false);
            setAviso(null);
            setConvite({ ...novo, chamada: 'Conta criada. Passe este link para ' + nome + '.' });
            await carregar(busca);
          }}
        />

        <ModalEditarUsuario
          key={'editar-' + (editando?.id ?? 'nenhum')}
          usuario={editando}
          funcoes={funcoes}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (nome) => {
            setEditando(null);
            setAviso(nome + ' foi atualizado.');
            await carregar(busca);
          }}
        />

        <ModalRedefinirSenha
          key={redefinindo?.id ?? 'nenhum'}
          usuario={redefinindo}
          aoFechar={() => setRedefinindo(null)}
          aoTrocar={(nome, novo) => {
            setRedefinindo(null);
            setAviso(null);
            setConvite({
              ...novo,
              chamada: 'A senha antiga de ' + nome + ' não vale mais. Passe este link para ele.',
            });
          }}
        />
      </section>

      <section className="secao">
        {usuarios.length === 0 ? (
          <Vazio
            titulo="Nenhum usuário encontrado"
            descricao="Tente outro termo de busca ou cadastre um novo usuário."
          />
        ) : (
          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">
                  Lista de usuários com suas funções e situação
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">E-mail</th>
                    <th scope="col">Funções</th>
                    <th scope="col">Último acesso</th>
                    <th scope="col">Situação</th>
                    <th scope="col">
                      <span className="apenas-leitor-tela">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <th scope="row">{u.nome}</th>
                      <td className="mono">{u.email}</td>
                      <td>
                        <span className="etiquetas">
                          {u.funcoes.map((f) => (
                            <span key={f.id} className="etiqueta">
                              {f.nome}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td>{formatarData(u.ultimoAcesso)}</td>
                      <td>
                        {u.ativo ? (
                          <Selo tipo="sucesso">Ativo</Selo>
                        ) : (
                          <Selo tipo="erro">Desativado</Selo>
                        )}
                      </td>
                      <td className="celula-acoes">
                        <button
                          type="button"
                          className="botao botao--discreto"
                          onClick={() => setEditando(u)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="botao botao--discreto"
                          onClick={() => setRedefinindo(u)}
                        >
                          Redefinir senha
                        </button>
                        <button
                          type="button"
                          className="botao botao--discreto"
                          onClick={() => void alternarAtivo(u)}
                        >
                          {u.ativo ? 'Desativar' : 'Reativar'}
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

    </>
  );
}

// ------------------------------------------------------------
//  Formulário de novo usuário
// ------------------------------------------------------------
function FormularioUsuario({
  aberto,
  aoFechar,
  funcoes,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  funcoes: FuncaoItem[];
  aoSalvar: (nome: string, convite: Convite) => Promise<void>;
}) {
  const idForm = useId();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  function alternarFuncao(id: string) {
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setDetalhes([]);
    setEnviando(true);

    try {
      const r = await criarUsuario({
        nome,
        email,
        telefone: telefoneParaGuardar(telefone) || undefined,
        funcoes: selecionadas,
      });
      await aoSalvar(r.usuario.nome, r.convite);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setDetalhes(
          (e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)),
        );
      } else {
        setErro('Não foi possível cadastrar.');
      }
      setEnviando(false);
    }
  }

  return (
    /* O botao de enviar mora no RODAPE do modal, fora do <form>, e
       alcanca o formulario pelo atributo `form`: um submit fora do
       formulario continua enviando aquele formulario. */
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo usuário"
      descricao="As funções decidem o que a pessoa enxerga e o que ela pode fazer."
      temAlteracao={Boolean(nome || email || telefone || selecionadas.length > 0)}
      acoes={
        <>
          <button type="button" className="botao botao--discreto" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="submit"
            form={idForm}
            className="botao botao--principal"
            disabled={enviando || selecionadas.length === 0}
          >
            {enviando ? 'Salvando...' : 'Cadastrar usuário'}
          </button>
        </>
      }
    >
      <form id={idForm} onSubmit={enviar} noValidate>

        <div className="formulario__linha">
          <div className="campo">
            <label className="campo__rotulo" htmlFor="novo-nome">
              Nome completo
            </label>
            <input
              id="novo-nome"
              className="campo__entrada"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="novo-email">
              E-mail
            </label>
            <input
              id="novo-email"
              type="email"
              className="campo__entrada"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
        </div>

        <div className="formulario__linha">
          <div className="campo">
            <label className="campo__rotulo" htmlFor="novo-telefone">
              Telefone <span className="campo__opcional">(opcional)</span>
            </label>
            {/* Escapou da máscara porque não usa o componente Campo.
                Era o último telefone cru do sistema. */}
            <input
              id="novo-telefone"
              className="campo__entrada"
              type="tel"
              inputMode="decimal"
              placeholder="(11) 99999-8888"
              value={telefone}
              onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
            />
            <p className="campo__ajuda">
              Usado para os avisos por WhatsApp na Etapa 10. O +55 entra sozinho ao salvar.
            </p>
          </div>

        </div>

        <fieldset className="campo">
          <legend className="campo__rotulo">Funções (pode marcar mais de uma)</legend>
          <div className="opcoes">
            {funcoes.map((f) => (
              <label key={f.id} className="opcao">
                <input
                  type="checkbox"
                  checked={selecionadas.includes(f.id)}
                  onChange={() => alternarFuncao(f.id)}
                />
                <span>{f.nome}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {erro && (
          <div className="campo__erro" role="alert">
            <Icone nome="alerta" /> {erro}
            {detalhes.length > 0 && (
              <ul className="campo__erro-lista">
                {detalhes.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

      </form>
    </Modal>
  );
}

// ------------------------------------------------------------
//  Redefinir a senha de alguém
//
//  Pedido do dono em 27/09/2026: quando alguém esquece a senha, o
//  administrador precisa conseguir devolver o acesso.
//
//  ATÉ 10/10/2026 ISTO SORTEAVA UMA SENHA. Hoje gera um LINK.
//
//  A senha sorteada funcionava, e tinha um defeito que nenhum
//  sorteio conserta: durante o trajeto até a pessoa, DUAS pessoas
//  sabiam a senha de uma conta — e a primeira não era a dona.
//
//  O link não espera domínio: ele nasce da origem da própria
//  janela, então vale em `localhost` hoje e no endereço da empresa
//  amanhã, sem configurar nada. É o mesmo desenho do portal do
//  fornecedor, que roda assim desde a Etapa 5.
// ------------------------------------------------------------
function ModalRedefinirSenha({
  usuario,
  aoFechar,
  aoTrocar,
}: {
  /** Preenchido = modal aberto para essa pessoa. */
  usuario: UsuarioAdmin | null;
  aoFechar: () => void;
  aoTrocar: (nome: string, convite: Convite) => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (!usuario) return;

    setErro(null);
    setEnviando(true);

    try {
      const r = await redefinirSenhaDe(usuario.id);
      aoTrocar(usuario.nome, r.convite);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível redefinir.');
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto={usuario !== null}
      aoFechar={aoFechar}
      titulo={'Redefinir a senha de ' + (usuario?.nome ?? '')}
      descricao="A senha atual deixa de valer e a pessoa cria uma nova pelo link."
      acoes={
        <>
          <button type="button" className="botao botao--discreto" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="botao botao--principal"
            onClick={() => void confirmar()}
            disabled={enviando}
          >
            {enviando ? 'Gerando o link...' : 'Gerar o link'}
          </button>
        </>
      }
    >
      <AvisoDeCriacao titulo="Isto não tem volta.">
        Ao confirmar, <strong>a senha atual para de funcionar na hora</strong> e a pessoa é
        desconectada de onde estiver. Só volta a entrar depois de criar a nova pelo link.
      </AvisoDeCriacao>

      <p>
        O link aparece aqui atrás assim que você confirmar. Mande para{' '}
        <strong>{usuario?.email}</strong> por WhatsApp ou pessoalmente — e repare que você
        não vai saber a senha que ele escolher.
      </p>

      {erro && <ErroFormulario mensagem={erro} />}
    </Modal>
  );
}

// ------------------------------------------------------------
//  Editar usuário
//
//  Existe porque a tela deixava desativar e redefinir senha, mas
//  não CORRIGIR: um nome errado, um telefone novo ou uma função a
//  mais exigiam criar outra conta — e duas contas para a mesma
//  pessoa estragam a trilha de quem pediu, quem aprovou e quem
//  recebeu.
//
//  O e-mail NÃO entra aqui de propósito: ele é o login e aparece
//  em tudo que a pessoa já assinou. Trocar e-mail é outro assunto,
//  com outras consequências.
// ------------------------------------------------------------
function ModalEditarUsuario({
  usuario,
  funcoes,
  aoFechar,
  aoSalvar,
}: {
  usuario: UsuarioAdmin | null;
  funcoes: FuncaoItem[];
  aoFechar: () => void;
  aoSalvar: (nome: string) => Promise<void>;
}) {
  const idForm = useId();
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [telefone, setTelefone] = useState(mascaraTelefone(usuario?.telefone ?? ''));
  const [selecionadas, setSelecionadas] = useState<string[]>(
    (usuario?.funcoes ?? []).map((f) => f.id),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  function alternarFuncao(id: string) {
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!usuario) return;

    setErro(null);
    setDetalhes([]);
    setEnviando(true);

    try {
      await editarUsuario(usuario.id, {
        nome,
        //  Campo esvaziado vira NULO, não string vazia: "sem
        //  telefone" e "telefone em branco" precisam ser a mesma
        //  coisa para quem procura por número depois.
        telefone: telefoneParaGuardar(telefone) || null,
        funcoes: selecionadas,
      });

      await aoSalvar(nome);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setDetalhes((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Não foi possível salvar.');
      }
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto={usuario !== null}
      aoFechar={aoFechar}
      titulo={'Editar ' + (usuario?.nome ?? '')}
      descricao="O e-mail não muda por aqui: ele é o login e já está em tudo que a pessoa assinou."
      temAlteracao={
        nome !== (usuario?.nome ?? '') ||
        telefone !== mascaraTelefone(usuario?.telefone ?? '') ||
        selecionadas.length !== (usuario?.funcoes ?? []).length
      }
      acoes={
        <>
          <button type="button" className="botao botao--discreto" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="submit"
            form={idForm}
            className="botao botao--principal"
            disabled={enviando || !nome.trim() || selecionadas.length === 0}
          >
            {enviando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </>
      }
    >
      <form id={idForm} onSubmit={enviar} noValidate>
        <div className="formulario__linha">
          <div className="campo">
            <label className="campo__rotulo" htmlFor="editar-nome">
              Nome completo
            </label>
            <input
              id="editar-nome"
              className="campo__entrada"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="editar-telefone">
              Telefone <span className="campo__opcional">(opcional)</span>
            </label>
            <input
              id="editar-telefone"
              className="campo__entrada"
              type="tel"
              inputMode="decimal"
              placeholder="(11) 99999-8888"
              value={telefone}
              onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
            />
            <p className="campo__ajuda">
              É por ele que o assistente do WhatsApp reconhece a pessoa. Sem telefone, ela
              não recebe resposta. O +55 entra sozinho ao salvar.
            </p>
          </div>
        </div>

        <fieldset className="campo">
          <legend className="campo__rotulo">Funções (pode marcar mais de uma)</legend>
          <div className="opcoes">
            {funcoes.map((f) => (
              <label key={f.id} className="opcao">
                <input
                  type="checkbox"
                  checked={selecionadas.includes(f.id)}
                  onChange={() => alternarFuncao(f.id)}
                />
                <span>{f.nome}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {erro && (
          <div className="campo__erro" role="alert">
            <Icone nome="alerta" /> {erro}
            {detalhes.length > 0 && (
              <ul className="campo__erro-lista">
                {detalhes.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
