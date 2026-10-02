// ============================================================
//  Cadastro de fornecedores
//
//  O vínculo com famílias é o campo mais importante da tela:
//  é ele que responde "quem convidar para este BID?".
// ============================================================

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import {
  listarFornecedores, listarFamilias, criarFornecedor, UFS,
  type Fornecedor, type Familia,
} from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, Selecao, ErroFormulario } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { Paginacao, ContaDaPagina } from '../../componentes/Paginacao';
import { usePagina } from '../../ganchos/pagina';
import { Icone } from '../../componentes/Icone';
import { Modal } from '../../componentes/Modal';
import { useEsperarDigitar } from '../../ganchos/esperarDigitar';
import { AvisoDeCriacao } from '../../componentes/AvisoDeCriacao';
import { CampoCidade } from '../../componentes/CampoCidade';
import { editarFornecedor } from '../../servicos/cadastros';
import { mascaraCnpj, mascaraTelefone, telefoneParaGuardar, telefoneCompleto } from '../../servicos/mascaras';
import { sugerirNomeFantasia } from '../../servicos/municipios';

export function Fornecedores() {
  const { pode } = useAutenticacao();
  const podeEditar = pode('fornecedores.gerenciar');

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  // `null` = cadastrando. Com fornecedor dentro = corrigindo aquele.
  const [editando, setEditando] = useState<Fornecedor | null>(null);

  const [busca, setBusca] = useState('');
  const [familiaId, setFamiliaId] = useState('');

  // A lista suspensa vale na hora; o campo de digitar espera a
  // pessoa parar, para nao buscar a cada tecla.
  const buscaAdiada = useEsperarDigitar(busca);

  const pag = usePagina(buscaAdiada + '|' + familiaId);

  const carregar = useCallback(
    async (filtros: { busca?: string; familiaId?: string; pagina?: number } = {}) => {
      setCarregando(true);
      setErro(null);
      try {
        const [f, fam] = await Promise.all([listarFornecedores(filtros), listarFamilias()]);
        setFornecedores(f.fornecedores);
        setFamilias(fam.familias);
        pag.chegou(f);
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
        pag.falhou();
      } finally {
        setCarregando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    void carregar({
      busca: buscaAdiada || undefined,
      familiaId: familiaId || undefined,
      pagina: pag.pagina,
    });
  }, [carregar, buscaAdiada, familiaId, pag.pagina]);


  if (carregando && fornecedores.length === 0) {
    return <Carregando mensagem="Carregando fornecedores..." />;
  }
  if (erro && fornecedores.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Fornecedores"
          descricao={
            <>
              Marque <strong>quais famílias cada fornecedor atende</strong>. Na Etapa 5,
            um pacote de cotação de elétrica será enviado apenas a quem vende elétrica —
            exatamente como o fluxo da Porto Inc. determina.
            </>
          }
          acoes={
            podeEditar && (
              <button
                type="button"
                className="botao botao--principal"
                onClick={() => setAberto(true)}
              >
                + Novo fornecedor
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
            exemplo="nome ou CNPJ"
            semMarcaOpcional
          />

          <Selecao
            rotulo="Família atendida"
            valor={familiaId}
            aoMudar={setFamiliaId}
            semMarcaOpcional
            vazio="Todas as famílias"
            opcoes={familias.map((f) => ({ valor: f.id, rotulo: f.nome }))}
          />

        </div>
        {/* A `key` troca junto com o alvo, senao o formulario nasceria
            com os dados do fornecedor anterior. */}
        <FormularioFornecedor
          key={editando?.id ?? String(aberto)}
          aberto={aberto}
          fornecedor={editando}
          aoFechar={() => {
            setAberto(false);
            setEditando(null);
          }}
          familias={familias}
          aoSalvar={async (nome, corrigiu) => {
            setAberto(false);
            setEditando(null);
            setAviso('"' + nome + (corrigiu ? '" corrigido.' : '" cadastrado.'));
            void carregar({ busca: busca || undefined, familiaId: familiaId || undefined });
          }}
        />
      </section>

      <section className="secao secao-com-ancora" ref={pag.topo}>
        <ContaDaPagina
          pagina={pag.pagina}
          total={pag.dados.total}
          porPagina={pag.dados.porPagina}
          oQue="fornecedor"
          oQuePlural="fornecedores"
          carregando={pag.trocando}
        />

        {fornecedores.length === 0 ? (
          <Vazio
            titulo="Nenhum fornecedor encontrado"
            descricao="Ajuste os filtros ou cadastre um fornecedor novo."
          />
        ) : (
          /* Aqui a lista e uma grade de cartoes, nao uma tabela: o
             esmaecido e o fade vao na grade inteira, que e o
             equivalente do cartao da tabela. */
          <div
            className={
              'grade grade--larga ' + (pag.trocando ? 'lista-trocando' : 'lista-chegou')
            }
            key={pag.pagina}
          >
            {fornecedores.map((f) => (
              <Cartao
                key={f.id}
                nivel={2}
                titulo={
                  <>
                    {f.nomeFantasia ?? f.razaoSocial}
                    {!f.ativo && (
                      <>
                        {' '}
                        <Selo tipo="erro">Inativo</Selo>
                      </>
                    )}
                  </>
                }
                descricao={f.razaoSocial}
                acoes={
                  podeEditar && (
                    <button
                      type="button"
                      className="botao botao--discreto"
                      onClick={() => {
                        setEditando(f);
                        setAberto(true);
                      }}
                    >
                      Editar
                    </button>
                  )
                }
              >

                <dl className="dados">
                  <div>
                    <dt>CNPJ</dt>
                    <dd className="mono">{f.cnpjFormatado}</dd>
                  </div>
                  {(f.cidade || f.uf) && (
                    <div>
                      <dt>Cidade</dt>
                      <dd>
                        {f.cidade}
                        {f.uf ? ' / ' + f.uf : ''}
                      </dd>
                    </div>
                  )}
                  {f.email && (
                    <div>
                      <dt>E-mail</dt>
                      <dd>{f.email}</dd>
                    </div>
                  )}
                  {f.whatsapp && (
                    <div>
                      <dt>WhatsApp</dt>
                      <dd className="mono">{telefoneCompleto(f.whatsapp)}</dd>
                    </div>
                  )}
                </dl>

                <p className="linha-de-resumo">Atende:</p>
                <div className="etiquetas">
                  {f.familias.length === 0 ? (
                    <Selo tipo="atencao">Nenhuma família — não será convidado a cotar</Selo>
                  ) : (
                    f.familias.map((fam) => (
                      <span key={fam.id} className="etiqueta">
                        {fam.nome}
                      </span>
                    ))
                  )}
                </div>
              </Cartao>
            ))}
          </div>
        )}

        <Paginacao
          pagina={pag.pagina}
          paginas={pag.dados.paginas}
          aoTrocar={pag.irPara}
          carregando={pag.trocando}
        />
      </section>
    </>
  );
}

// ------------------------------------------------------------
//  Formulário
// ------------------------------------------------------------
function FormularioFornecedor({
  aberto,
  fornecedor,
  aoFechar,
  familias,
  aoSalvar,
}: {
  aberto: boolean;
  /** Preenchido = corrigindo. Vazio = cadastrando um novo. */
  fornecedor: Fornecedor | null;
  aoFechar: () => void;
  familias: Familia[];
  aoSalvar: (nome: string, corrigiu: boolean) => Promise<void>;
}) {
  const idForm = useId();
  const corrigindo = fornecedor !== null;

  const [razaoSocial, setRazaoSocial] = useState(fornecedor?.razaoSocial ?? '');
  const [nomeFantasia, setNomeFantasia] = useState(fornecedor?.nomeFantasia ?? '');
  // Assim que alguem escreve no nome fantasia, a sugestao para de
  // mandar nele. Sem isto, voltar para corrigir a razao social
  // apagaria o que a pessoa tinha escrito.
  //
  // Corrigindo, ele JA nasce tocado: o nome fantasia veio do banco, e
  // mexer na razao social nao pode apagar o que ja estava salvo.
  const [fantasiaTocada, setFantasiaTocada] = useState(corrigindo);

  const [cnpj, setCnpj] = useState(mascaraCnpj(fornecedor?.cnpj ?? ''));
  const [email, setEmail] = useState(fornecedor?.email ?? '');
  const [whatsapp, setWhatsapp] = useState(mascaraTelefone(fornecedor?.whatsapp ?? ''));
  const [cidade, setCidade] = useState(fornecedor?.cidade ?? '');
  const [uf, setUf] = useState(fornecedor?.uf ?? '');
  const [selecionadas, setSelecionadas] = useState<string[]>(
    fornecedor?.familias.map((f) => f.id) ?? [],
  );

  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  function alternar(id: string) {
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
      const campos = {
        razaoSocial,
        nomeFantasia: nomeFantasia || undefined,
        cnpj,
        email: email || undefined,
        whatsapp: telefoneParaGuardar(whatsapp) || undefined,
        cidade: cidade || undefined,
        uf: uf || undefined,
        familias: selecionadas,
      };

      if (fornecedor) await editarFornecedor(fornecedor.id, campos);
      else await criarFornecedor(campos);
      await aoSalvar(nomeFantasia || razaoSocial, corrigindo);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setDetalhes((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Não foi possível cadastrar.');
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
      titulo={corrigindo ? 'Editar fornecedor' : 'Novo fornecedor'}
      descricao="As famílias que ele atende decidem em quais cotações ele será sugerido."
      temAlteracao={
        corrigindo
          ? razaoSocial !== fornecedor.razaoSocial
            || nomeFantasia !== (fornecedor.nomeFantasia ?? '')
            || cnpj !== mascaraCnpj(fornecedor.cnpj)
            || email !== (fornecedor.email ?? '')
            || whatsapp !== mascaraTelefone(fornecedor.whatsapp ?? '')
            || cidade !== (fornecedor.cidade ?? '')
            || uf !== (fornecedor.uf ?? '')
            || selecionadas.slice().sort().join() !== fornecedor.familias.map((f) => f.id).sort().join()
          : Boolean(razaoSocial || nomeFantasia || cnpj)
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
            disabled={enviando || !razaoSocial || !cnpj}
          >
            {enviando ? 'Salvando...' : corrigindo ? 'Salvar alterações' : 'Cadastrar fornecedor'}
          </button>
        </>
      }
    >
      <form id={idForm} onSubmit={enviar} noValidate>
        {!corrigindo && (
        <AvisoDeCriacao>
          O <strong>CNPJ</strong> é o que liga a nota fiscal a este cadastro. O sistema
          checa os dígitos, mas não sabe se é a empresa certa.
        </AvisoDeCriacao>
        )}

        <div className="formulario__linha">
          <Campo
            rotulo="Razão social"
            valor={razaoSocial}
            aoMudar={(v) => {
              setRazaoSocial(v);

              // A sugestão só entra enquanto NINGUÉM mexeu no nome
              // fantasia. Sobrescrever o que a pessoa digitou é o
              // defeito clássico deste recurso — ela escreve, volta
              // para corrigir a razão social, e perde o que escreveu.
              if (!fantasiaTocada) setNomeFantasia(sugerirNomeFantasia(v));
            }}
            exemplo="Marquilip Comércio e Representação Ltda"
            obrigatorio
          />
          <Campo
            rotulo="Nome fantasia"
            valor={nomeFantasia}
            aoMudar={(v) => {
              setFantasiaTocada(true);
              setNomeFantasia(v);
            }}
            exemplo="Marquilip"
            ajuda="Sugerido a partir da razão social. Apague e escreva outro se quiser."
          />
        </div>

        <div className="formulario__linha">
          <Campo
            rotulo="CNPJ"
            valor={cnpj}
            aoMudar={(v) => setCnpj(mascaraCnpj(v))}
            exemplo="19.131.243/0001-97"
            ajuda="O sistema confere o dígito verificador. CNPJ errado só apareceria quando a nota fiscal não batesse."
            obrigatorio
          />
          <Campo rotulo="E-mail" valor={email} aoMudar={setEmail} tipo="email" exemplo="vendas@empresa.com.br" />
        </div>

        <div className="formulario__linha">
          <Campo
            rotulo="WhatsApp"
            valor={whatsapp}
            aoMudar={(v) => setWhatsapp(mascaraTelefone(v))}
            tipo="tel"
            exemplo="(11) 98888-7777"
            ajuda="O +55 do Brasil já entra sozinho ao salvar. Digite só DDD e número."
          />

          {/* Escolhendo da lista, a UF vem junto. Digitar continua
              valendo, para municipio novo ou distrito que nao e
              municipio — a lista sugere, mas nao prende. */}
          <CampoCidade
            cidade={cidade}
            aoMudarCidade={setCidade}
            aoEscolherUf={setUf}
          />
        </div>

        <Selecao
          rotulo="UF"
          valor={uf}
          aoMudar={setUf}
          opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))}
          vazio="Escolha..."
        />

        <fieldset className="campo">
          <legend className="campo__rotulo">Famílias que este fornecedor atende</legend>
          <p className="campo__ajuda">
            Sem marcar pelo menos uma, ele nunca será convidado para uma cotação.
          </p>
          <div className="opcoes">
            {familias.map((f) => (
              <label key={f.id} className="opcao">
                <input
                  type="checkbox"
                  checked={selecionadas.includes(f.id)}
                  onChange={() => alternar(f.id)}
                />
                <span>{f.nome}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {erro && <ErroFormulario mensagem={erro} detalhes={detalhes} />}

      </form>
    </Modal>
  );
}
