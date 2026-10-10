// ============================================================
//  Funções e permissões
//
//  "As funções devem ser criáveis dentro do sistema" está na
//  primeira página do fluxo de compras da Porto Inc., como regra
//  confirmada — ao lado de "um usuário pode acumular mais de uma
//  função", que existe desde a Etapa 1.
//
//  Esta é a outra metade. Até 09/10/2026 havia nove funções
//  vindas de migração e nenhuma forma de criar a décima: uma
//  construtora que cresce e precisa de "Encarregado" ou
//  "Engenheiro de segurança" dependia de mudança de código.
//
//  Criar função sem escolher o que ela pode seria um nome sem
//  conteúdo. Por isso a tela é uma coisa só: o nome e as caixas.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import {
  listarFuncoes, listarPermissoes, criarFuncao, editarFuncao, apagarFuncao,
  type Funcao, type Permissao,
} from '../../servicos/funcoes';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Carregando, Erro } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { Campo, ErroFormulario } from '../../componentes/Campo';
import { Modal } from '../../componentes/Modal';
import { Selo } from '../../componentes/Selo';
import { Icone } from '../../componentes/Icone';
import { plural } from '../../servicos/texto';

export function Funcoes() {
  const { pode } = useAutenticacao();
  const podeGerenciar = pode('funcoes.gerenciar');

  const [funcoes, setFuncoes] = useState<Funcao[] | null>(null);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Funcao | null>(null);
  const [apagando, setApagando] = useState<Funcao | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [f, p] = await Promise.all([listarFuncoes(), listarPermissoes()]);
      setFuncoes(f.funcoes);
      setPermissoes(p.permissoes);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function apagar() {
    if (!apagando) return;
    setOcupado(true);
    setErro(null);
    try {
      await apagarFuncao(apagando.id);
      setAviso('Função "' + apagando.nome + '" apagada.');
      setApagando(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível apagar.');
      setApagando(null);
    } finally {
      setOcupado(false);
    }
  }

  if (!funcoes && !erro) return <Carregando mensagem="Buscando as funções..." />;
  if (erro && !funcoes) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;

  const daEmpresa = (funcoes ?? []).filter((f) => !f.sistema);
  const deFabrica = (funcoes ?? []).filter((f) => f.sistema);

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Funções e permissões"
          descricao={
            <>
              A função diz <strong>o que a pessoa faz</strong> no sistema. Uma pessoa pode
              ter mais de uma, e o que ela enxerga é a soma delas.
            </>
          }
          acoes={
            podeGerenciar && (
              <button
                type="button"
                className="botao botao--principal"
                onClick={() => { setEditando(null); setAberto(true); }}
              >
                + Nova função
              </button>
            )
          }
        />

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <Icone nome="certo" /> {aviso}
          </p>
        )}

        {erro && funcoes && (
          <div className="aviso aviso--erro" role="alert">
            <Icone nome="alerta" className="aviso__icone" />
            <div><strong>{erro}</strong></div>
          </div>
        )}

        {/* AS DA EMPRESA PRIMEIRO.
            As nove de fábrica são paisagem — estão lá desde o
            primeiro dia e ninguém mexe nelas toda semana. O que a
            empresa criou é o que ela vai revisitar. */}
        {/* MOLDURA EM VOLTA DE NADA, NÃO.
            Na entrega a empresa não tem nenhuma função própria, e
            um cartão vazio do tamanho de quatro é a primeira coisa
            que ela veria. É a mesma regra do Financeiro: só se
            desenha o que tem o que dizer. */}
        {daEmpresa.length === 0 ? (
          <p className="aviso" role="status">
            <Icone nome="informacao" />{' '}
            {podeGerenciar
              ? 'Nenhuma função criada pela empresa ainda. As nove abaixo cobrem o fluxo '
                + 'de compras — crie uma quando precisar de um papel que elas não descrevem.'
              : 'A empresa ainda não criou nenhuma função própria. Quem cria é o administrador.'}
          </p>
        ) : (
          <Cartao
            nivel={2}
            titulo="Funções da empresa"
            descricao="Criadas aqui dentro. Podem ser renomeadas e apagadas enquanto ninguém as usa."
          >
            <div className="grade grade--larga-firme">
              {daEmpresa.map((f) => (
                <CartaoDaFuncao
                  key={f.id}
                  funcao={f}
                  podeGerenciar={podeGerenciar}
                  aoEditar={() => { setEditando(f); setAberto(true); }}
                />
              ))}
            </div>
          </Cartao>
        )}
      </section>

      <section className="secao">
        <Cartao
          nivel={2}
          titulo="Funções do fluxo de compras"
          descricao="Vieram com o sistema e descrevem o fluxo da Porto Inc. O nome e o código não mudam; o que elas podem, sim."
        >
          <div className="grade grade--larga-firme">
            {deFabrica.map((f) => (
              <CartaoDaFuncao
                key={f.id}
                funcao={f}
                podeGerenciar={podeGerenciar}
                aoEditar={() => { setEditando(f); setAberto(true); }}
              />
            ))}
          </div>
        </Cartao>
      </section>

      {aberto && (
        <FormularioDeFuncao
          key={editando?.id ?? 'nova'}
          funcao={editando}
          permissoes={permissoes}
          aoFechar={() => { setAberto(false); setEditando(null); }}
          aoApagar={
            editando && !editando.sistema
              ? () => { setAberto(false); setApagando(editando); }
              : undefined
          }
          aoSalvar={async (nome, corrigiu) => {
            setAberto(false);
            setEditando(null);
            setAviso(corrigiu ? '"' + nome + '" ajustada.' : 'Função "' + nome + '" criada.');
            await carregar();
          }}
        />
      )}

      <Modal
        aberto={apagando !== null}
        titulo={'Apagar a função ' + (apagando?.nome ?? '') + '?'}
        descricao="Apagar não se desfaz. Só é possível enquanto ninguém usa a função."
        aoFechar={() => setApagando(null)}
        acoes={
          <>
            <button type="button" className="botao botao--secundario" onClick={() => setApagando(null)}>
              Voltar sem apagar
            </button>
            <button
              type="button"
              className="botao botao--perigo"
              onClick={() => void apagar()}
              disabled={ocupado}
            >
              {ocupado ? 'Apagando...' : 'Sim, apagar'}
            </button>
          </>
        }
      >
        <p>
          <strong>{apagando?.nome}</strong> — {apagando?.codigo}
        </p>
      </Modal>
    </>
  );
}

/** Uma função, com o que ela pode, agrupado. */
function CartaoDaFuncao({
  funcao, podeGerenciar, aoEditar,
}: {
  funcao: Funcao;
  podeGerenciar: boolean;
  aoEditar: () => void;
}) {
  // O CARTÃO MOSTRA OS GRUPOS, NÃO AS 26 PERMISSÕES.
  //
  // A primeira versão listava cada permissão pelo nome. O cartão
  // do Administrador, com 26, ficou com uma parede de texto — e,
  // como a fileira estica todos até a altura do mais alto, os
  // vizinhos de 7 permissões ficaram com meio metro de vazio
  // embaixo. É o mesmo defeito que os cartões do Financeiro
  // tiveram em 09/10, e o conserto é o mesmo: encolher o TEXTO,
  // não esticar a caixa.
  //
  // Quem precisa do detalhe abre "Ajustar", que é onde ele serve
  // — lá as caixas estão marcadas uma a uma.
  const porGrupo = new Map<string, number>();
  for (const p of funcao.permissoes) {
    porGrupo.set(p.grupo, (porGrupo.get(p.grupo) ?? 0) + 1);
  }

  // A MESMA ANATOMIA DA TELA DE FORNECEDORES, que é a irmã mais
  // próxima: grade de cartões em Administração, com `nivel={2}`,
  // ação discreta no cabeçalho e os fatos numa `<dl class="dados">`.
  // Corpo livre aqui faria esta tela parecer de outro sistema.
  // O CABEÇALHO TEM TAMANHO FIXO, E É POR ISSO QUE OS BOTÕES
  // FICAM NA MESMA ALTURA.
  //
  // Antes o cabeçalho levava título, descrição e até dois botões.
  // Como o cabeçalho é `flex-wrap: wrap`, a descrição mais longa
  // empurrava os botões para a linha de baixo — e numa fileira de
  // três cartões o "Ajustar" aparecia em três alturas. O dono viu
  // em 10/10/2026.
  //
  // Agora o cabeçalho é só o título (curto, sempre de uma linha) e
  // UM botão. A descrição desceu para o corpo, onde variar de
  // tamanho não desalinha nada.
  //
  // "Apagar" saiu do cartão e foi para dentro do "Ajustar": ação
  // que não se desfaz a um deslize da ação comum é convite a
  // acidente, e aqui ela ainda por cima só existe em alguns
  // cartões — o que fazia a dupla de botões ter largura diferente
  // de cartão para cartão.
  return (
    <Cartao
      nivel={2}
      titulo={
        <>
          {funcao.nome}
          {funcao.permissoes.length === 0 && (
            <>
              {' '}
              <Selo tipo="atencao">Não faz nada</Selo>
            </>
          )}
        </>
      }
      acoes={
        podeGerenciar && (
          <button type="button" className="botao botao--discreto" onClick={aoEditar}>
            Ajustar
          </button>
        )
      }
    >
      {funcao.descricao && <p>{funcao.descricao}</p>}

      <dl className="dados">
        <div>
          <dt>Código</dt>
          <dd className="mono">{funcao.codigo}</dd>
        </div>
        <div>
          <dt>Pessoas</dt>
          <dd>
            {funcao.usuarios === 0 ? 'Ninguém ainda' : plural(funcao.usuarios, 'pessoa', 'pessoas')}
          </dd>
        </div>
        {funcao.permissoes.length > 0 && (
          <div>
            <dt>Pode</dt>
            <dd>
              <div className="etiquetas">
                {[...porGrupo.entries()].map(([grupo, quantas]) => (
                  <span key={grupo} className="etiqueta">{grupo} {quantas}</span>
                ))}
              </div>
            </dd>
          </div>
        )}
      </dl>
    </Cartao>
  );
}

/** Criar ou ajustar. */
function FormularioDeFuncao({
  funcao, permissoes, aoFechar, aoSalvar, aoApagar,
}: {
  funcao: Funcao | null;
  permissoes: Permissao[];
  aoFechar: () => void;
  aoSalvar: (nome: string, corrigiu: boolean) => Promise<void>;
  /** Só nas funções criadas pela empresa. */
  aoApagar?: () => void;
}) {
  const corrigindo = funcao !== null;
  const deFabrica = funcao?.sistema === true;

  const [codigo, setCodigo] = useState(funcao?.codigo ?? '');
  const [nome, setNome] = useState(funcao?.nome ?? '');
  const [descricao, setDescricao] = useState(funcao?.descricao ?? '');
  const [marcadas, setMarcadas] = useState<string[]>(
    () => permissoes.filter((p) => funcao?.permissoes.some((x) => x.codigo === p.codigo))
      .map((p) => p.id),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const grupos = new Map<string, Permissao[]>();
  for (const p of permissoes) grupos.set(p.grupo, [...(grupos.get(p.grupo) ?? []), p]);

  function alternar(id: string) {
    setMarcadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
  }

  async function enviar() {
    setErro(null);
    setDetalhes([]);
    setEnviando(true);

    try {
      if (funcao) {
        await editarFuncao(funcao.id, {
          ...(deFabrica ? {} : { codigo, nome }),
          descricao: descricao || null,
          permissoes: marcadas,
        });
      } else {
        await criarFuncao({ codigo, nome, descricao: descricao || null, permissoes: marcadas });
      }
      await aoSalvar(nome, corrigindo);
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

  const serve = Boolean(nome.trim() && codigo.trim() && marcadas.length > 0);

  return (
    <Modal
      aberto
      titulo={corrigindo ? 'Ajustar ' + funcao.nome : 'Nova função'}
      descricao="A função é o conjunto do que a pessoa pode fazer. Marque abaixo."
      aoFechar={aoFechar}
      acoes={
        <>
          {/* Apagar fica aqui, longe do caminho de quem só queria
              ajustar — e à ESQUERDA, separada das duas que
              concluem. */}
          {aoApagar && (
            <button
              type="button"
              className="botao botao--discreto"
              onClick={aoApagar}
              disabled={enviando}
            >
              Apagar função
            </button>
          )}
          <button type="button" className="botao botao--secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="botao botao--principal"
            onClick={() => void enviar()}
            disabled={enviando || !serve}
          >
            {enviando
              ? 'Salvando...'
              : corrigindo ? 'Salvar alterações' : 'Criar função'}
          </button>
        </>
      }
    >
      {deFabrica && (
        <div className="aviso aviso--info" role="status">
          <Icone nome="informacao" className="aviso__icone" />
          <div>
            <strong>Esta função veio com o sistema.</strong>
            <p>
              O nome e o código descrevem o fluxo de compras da Porto Inc. e não mudam.
              O que ela pode fazer, sim.
            </p>
          </div>
        </div>
      )}

      <div className="formulario__linha">
        <Campo
          rotulo="Código"
          valor={codigo}
          aoMudar={(v) => setCodigo(v.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
          exemplo="ENCARREGADO"
          desabilitado={deFabrica}
          obrigatorio
          maximo={30}
          ajuda="Sem espaço e sem acento. É o nome curto que o sistema usa por dentro."
        />
        <Campo
          rotulo="Nome"
          valor={nome}
          aoMudar={setNome}
          exemplo="Encarregado de obra"
          desabilitado={deFabrica}
          obrigatorio
          maximo={60}
          ajuda="É assim que a pessoa vê a função na tela."
        />
      </div>

      {/* A DESCRIÇÃO NÃO ENTRA NA TRAVA.
          O que fica travado nas nove de fábrica é o nome e o
          código: um é citado em documento, o outro em migração. A
          descrição é frase para gente ler, e reescrevê-la com as
          palavras da Porto Inc. é justamente o que a empresa deve
          poder fazer. O servidor já permitia; era esta tela que
          estava mais fechada que a regra. */}
      <Campo
        rotulo="Descrição"
        valor={descricao}
        aoMudar={setDescricao}
        exemplo="Vê o estoque da obra e abre solicitação."
        maximo={200}
      />

      <fieldset className="campo">
        <legend className="campo__rotulo">O que esta função pode fazer</legend>
        <p className="campo__ajuda">
          <strong>Pelo menos uma.</strong> Função sem permissão é um nome que não abre
          nenhuma tela.
        </p>

        {[...grupos.entries()].map(([grupo, lista]) => (
          <div key={grupo} className="campo">
            <p className="grupo-de-opcoes">{grupo}</p>
            <div className="opcoes">
              {lista.map((p) => (
                <label key={p.id} className="opcao">
                  <input
                    type="checkbox"
                    checked={marcadas.includes(p.id)}
                    onChange={() => alternar(p.id)}
                  />
                  <span>{p.nome}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      {erro && <ErroFormulario mensagem={erro} detalhes={detalhes} />}
    </Modal>
  );
}
