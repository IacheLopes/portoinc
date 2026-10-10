// ============================================================
//  Lista de obras
// ============================================================

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  listarObras, criarObra, ROTULO_SITUACAO, UFS,
  type Obra, type SituacaoObra,
} from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, Selecao, ErroFormulario } from '../../componentes/Campo';
import { Selo, type TipoSelo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';
import { Modal } from '../../componentes/Modal';
import { useEsperarDigitar } from '../../ganchos/esperarDigitar';
import { AvisoDeCriacao } from '../../componentes/AvisoDeCriacao';
import { CampoCidade } from '../../componentes/CampoCidade';
import { editarObra } from '../../servicos/cadastros';

const COR_SITUACAO: Record<SituacaoObra, TipoSelo> = {
  PLANEJAMENTO: 'info',
  EM_ANDAMENTO: 'sucesso',
  PARALISADA: 'atencao',
  CONCLUIDA: 'info',
};

export function Obras() {
  const { pode } = useAutenticacao();
  const podeEditar = pode('obras.gerenciar');

  const [obras, setObras] = useState<Obra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  // `null` = criando. Com obra dentro = corrigindo aquela.
  const [editando, setEditando] = useState<Obra | null>(null);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async (termo = '') => {
    setCarregando(true);
    setErro(null);
    try {
      setObras((await listarObras(termo || undefined)).obras);
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

  if (carregando && obras.length === 0) return <Carregando mensagem="Carregando obras..." />;
  if (erro && obras.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Obras"
          descricao={
            <>
              Cada obra tem o próprio orçamento e o próprio almoxarifado. Toda compra é
            apontada para uma linha do orçamento — é assim que se descobre quanto custou
            cada parte da obra.
            </>
          }
          acoes={
            podeEditar && (
              <button
                type="button"
                className="botao botao--principal"
                onClick={() => setAberto(true)}
              >
                + Nova obra
              </button>
            )
          }
        />

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <Icone nome="certo" /> {aviso}
          </p>
        )}

        <div className="barra-acoes">
          <Campo
            rotulo="Buscar"
            valor={busca}
            aoMudar={setBusca}
            tipo="search"
            exemplo="nome, código ou cliente"
            semMarcaOpcional
            aoConfirmar={() => void carregar(busca)}
          />

        </div>
        {/* A `key` troca junto com o alvo: sem isso o formulario
            guardaria os valores da obra anterior e a pessoa corrigiria
            a obra errada sem perceber. */}
        <FormularioObra
          key={editando?.id ?? String(aberto)}
          aberto={aberto}
          obra={editando}
          aoFechar={() => {
            setAberto(false);
            setEditando(null);
          }}
          aoSalvar={async (nome, corrigiu) => {
            setAberto(false);
            setEditando(null);
            setAviso(
              corrigiu
                ? 'Obra "' + nome + '" corrigida. O almoxarifado foi renomeado junto.'
                : 'Obra "' + nome + '" criada, já com o almoxarifado dela.',
            );
            await carregar();
          }}
        />
      </section>

      <section className="secao">
        {obras.length === 0 ? (
          /* A TELA VAZIA DIZ A QUEM PEDIR.
             Abrir obra é do Administrador e do Comprador: obra tem
             contrato, cliente e orçamento, e é registro da empresa,
             não do canteiro. Mas o gestor de obra ABRE esta tela e
             via "cadastre a primeira obra" sem nenhum botão para
             fazer isso — instrução para uma ação que ele não tem. */
          <Vazio
            titulo="Nenhuma obra cadastrada"
            descricao={
              podeEditar
                ? 'Cadastre a primeira obra para começar.'
                : 'Quem abre obra é o administrador ou o comprador — obra tem contrato, '
                  + 'cliente e orçamento. Peça a um deles para cadastrar a sua.'
            }
          />
        ) : (
          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Obras da Porto Inc.</caption>
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Obra</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Local</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Orçamento</th>
                    <th scope="col">
                      <span className="apenas-leitor-tela">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {obras.map((o) => (
                    <tr key={o.id}>
                      <th scope="row" className="mono">
                        {o.codigo}
                      </th>
                      <td>{o.nome}</td>
                      <td>{o.cliente ?? '—'}</td>
                      <td>
                        {o.cidade ?? '—'}
                        {o.uf ? ' / ' + o.uf : ''}
                      </td>
                      <td>
                        <Selo tipo={COR_SITUACAO[o.situacao]}>{ROTULO_SITUACAO[o.situacao]}</Selo>
                      </td>
                      <td className="numero">
                        {o.linhas === 0 ? (
                          <Selo tipo="atencao">Sem orçamento</Selo>
                        ) : (
                          o.linhas + ' linhas'
                        )}
                      </td>
                      <td className="celula-acoes">
                        <Link className="botao botao--discreto botao--link" to={'/cadastros/obras/' + o.id}>
                          Abrir
                        </Link>
                        {podeEditar && (
                          <button
                            type="button"
                            className="botao botao--discreto"
                            onClick={() => {
                              setEditando(o);
                              setAberto(true);
                            }}
                          >
                            Editar
                          </button>
                        )}
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
//  Formulário
// ------------------------------------------------------------
function FormularioObra({
  aberto,
  obra,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  /** Preenchida = corrigindo. Vazia = criando uma obra nova. */
  obra: Obra | null;
  aoFechar: () => void;
  aoSalvar: (nome: string, corrigiu: boolean) => Promise<void>;
}) {
  const idForm = useId();
  const corrigindo = obra !== null;

  const [codigo, setCodigo] = useState(obra?.codigo ?? '');
  const [nome, setNome] = useState(obra?.nome ?? '');
  const [cliente, setCliente] = useState(obra?.cliente ?? '');
  const [cidade, setCidade] = useState(obra?.cidade ?? '');
  const [uf, setUf] = useState(obra?.uf ?? '');
  const [situacao, setSituacao] = useState<SituacaoObra>(obra?.situacao ?? 'PLANEJAMENTO');
  const [dataInicio, setDataInicio] = useState(obra?.dataInicio?.slice(0, 10) ?? '');

  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setDetalhes([]);
    setEnviando(true);

    try {
      const campos = {
        codigo,
        nome,
        cliente: cliente || undefined,
        cidade: cidade || undefined,
        uf: uf || undefined,
        situacao,
        dataInicio: dataInicio || undefined,
      };

      if (obra) await editarObra(obra.id, campos);
      else await criarObra(campos);

      await aoSalvar(nome, corrigindo);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setDetalhes((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro(corrigindo ? 'Não foi possível salvar.' : 'Não foi possível criar a obra.');
      }
      setEnviando(false);
    }
  }

  return (
    /* O botao de enviar mora no RODAPE do modal, fora do <form>, e
       alcanca o formulario pelo atributo `form`: um submit fora do
       formulario continua enviando aquele formulario. Assim o rodape
       fica onde o padrao manda, sem estado a mais. */
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={corrigindo ? 'Editar obra' : 'Nova obra'}
      descricao={
        corrigindo
          ? 'O almoxarifado da obra é renomeado junto, para os dois não ficarem com nomes diferentes.'
          : 'Cada obra ganha um almoxarifado próprio, criado junto com ela.'
      }
      temAlteracao={
        corrigindo
          ? codigo !== obra.codigo
            || nome !== obra.nome
            || cliente !== (obra.cliente ?? '')
            || cidade !== (obra.cidade ?? '')
            || uf !== (obra.uf ?? '')
            || situacao !== obra.situacao
            || dataInicio !== (obra.dataInicio?.slice(0, 10) ?? '')
          : Boolean(codigo || nome || cliente || cidade)
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
            disabled={enviando || !codigo || !nome}
          >
            {enviando ? 'Salvando...' : corrigindo ? 'Salvar alterações' : 'Criar obra'}
          </button>
        </>
      }
    >
      <form id={idForm} onSubmit={enviar} noValidate>
        {/* O texto anterior dizia que corrigir a obra depois NAO
            renomeava o almoxarifado. Era verdade ate 25/09/2026, e
            deixou de ser no mesmo dia: agora o almoxarifado acompanha.
            Aviso que mente e pior que aviso nenhum. */}
        {!corrigindo && (
        <AvisoDeCriacao>
          A obra nasce com o <strong>almoxarifado dela</strong>, batizado a partir deste
          nome e deste código. Os dois acompanham se você corrigir depois — mas o
          <strong> código</strong> aparece em todo pedido e relatório da obra.
        </AvisoDeCriacao>
        )}

        <div className="formulario__linha">
          <Campo
            rotulo="Código"
            valor={codigo}
            aoMudar={setCodigo}
            exemplo="OB-004"
            ajuda="Identificação curta e única."
            obrigatorio
          />
          <Campo
            rotulo="Nome da obra"
            valor={nome}
            aoMudar={setNome}
            exemplo="Residencial Porto Belo"
            obrigatorio
          />
        </div>

        <div className="formulario__linha">
          <Campo rotulo="Cliente" valor={cliente} aoMudar={setCliente} exemplo="Porto Inc. Incorporações" />
          <Selecao
            rotulo="Situação"
            valor={situacao}
            aoMudar={(v) => setSituacao(v as SituacaoObra)}
            opcoes={Object.entries(ROTULO_SITUACAO).map(([valor, rotulo]) => ({ valor, rotulo }))}
            obrigatorio
          />
        </div>

        <div className="formulario__linha">
          {/* Mesma escolha de Fornecedores: a lista do IBGE sugere,
              a UF vem junto, e digitar fora da lista continua valendo. */}
          <CampoCidade cidade={cidade} aoMudarCidade={setCidade} aoEscolherUf={setUf} />
          <Selecao
            rotulo="UF"
            valor={uf}
            aoMudar={setUf}
            opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))}
            vazio="Escolha..."
          />
        </div>

        <Campo rotulo="Data de início" valor={dataInicio} aoMudar={setDataInicio} tipo="date" />

        <div className="aviso aviso--info">
          <Icone nome="dica" className="aviso__icone" />
          <div>
            <strong>O almoxarifado é criado junto.</strong>
            <p>
              Toda obra nasce com o próprio local de estoque. Assim o material de uma obra
              nunca se mistura com o de outra.
            </p>
          </div>
        </div>

        {erro && <ErroFormulario mensagem={erro} detalhes={detalhes} />}

      </form>
    </Modal>
  );
}
