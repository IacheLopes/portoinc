// ============================================================
//  Cadastro de fornecedores
//
//  O vínculo com famílias é o campo mais importante da tela:
//  é ele que responde "quem convidar para este BID?".
// ============================================================

import { useCallback, useEffect, useState, type FormEvent } from 'react';
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
import { Icone } from '../../componentes/Icone';

export function Fornecedores() {
  const { pode } = useAutenticacao();
  const podeEditar = pode('fornecedores.gerenciar');

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  const [busca, setBusca] = useState('');
  const [familiaId, setFamiliaId] = useState('');

  const carregar = useCallback(
    async (filtros: { busca?: string; familiaId?: string } = {}) => {
      setCarregando(true);
      setErro(null);
      try {
        const [f, fam] = await Promise.all([listarFornecedores(filtros), listarFamilias()]);
        setFornecedores(f.fornecedores);
        setFamilias(fam.familias);
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
      } finally {
        setCarregando(false);
      }
    },
    [],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function aplicarFiltros() {
    void carregar({ busca: busca || undefined, familiaId: familiaId || undefined });
  }

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
            aoConfirmar={aplicarFiltros}
          />

          <Selecao
            rotulo="Família atendida"
            valor={familiaId}
            aoMudar={setFamiliaId}
            semMarcaOpcional
            vazio="Todas as famílias"
            opcoes={familias.map((f) => ({ valor: f.id, rotulo: f.nome }))}
          />

          <button type="button" className="botao botao--secundario" onClick={aplicarFiltros}>
            Filtrar
          </button>

          {podeEditar && (
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
            >
              {aberto ? 'Cancelar' : '+ Novo fornecedor'}
            </button>
          )}
        </div>

        {aberto && (
          <FormularioFornecedor
            familias={familias}
            aoSalvar={async (nome) => {
              setAberto(false);
              setAviso('"' + nome + '" cadastrado.');
              aplicarFiltros();
            }}
          />
        )}
      </section>

      <section className="secao">
        {fornecedores.length === 0 ? (
          <Vazio
            titulo="Nenhum fornecedor encontrado"
            descricao="Ajuste os filtros ou cadastre um fornecedor novo."
          />
        ) : (
          <div className="grade grade--larga">
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
                      <dd className="mono">{f.whatsapp}</dd>
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
      </section>
    </>
  );
}

// ------------------------------------------------------------
//  Formulário
// ------------------------------------------------------------
function FormularioFornecedor({
  familias,
  aoSalvar,
}: {
  familias: Familia[];
  aoSalvar: (nome: string) => Promise<void>;
}) {
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

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
      await criarFornecedor({
        razaoSocial,
        nomeFantasia: nomeFantasia || undefined,
        cnpj,
        email: email || undefined,
        whatsapp: whatsapp || undefined,
        cidade: cidade || undefined,
        uf: uf || undefined,
        familias: selecionadas,
      });
      await aoSalvar(nomeFantasia || razaoSocial);
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
    <form onSubmit={enviar} noValidate>
      <Cartao className="formulario" titulo="Novo fornecedor" nivel={2}>

        <div className="formulario__linha">
          <Campo
            rotulo="Razão social"
            valor={razaoSocial}
            aoMudar={setRazaoSocial}
            exemplo="Marquilip Comércio e Representação Ltda"
            obrigatorio
          />
          <Campo
            rotulo="Nome fantasia"
            valor={nomeFantasia}
            aoMudar={setNomeFantasia}
            exemplo="Marquilip"
          />
        </div>

        <div className="formulario__linha">
          <Campo
            rotulo="CNPJ"
            valor={cnpj}
            aoMudar={setCnpj}
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
            aoMudar={setWhatsapp}
            tipo="tel"
            exemplo="5511988887777"
            ajuda="Com DDI e DDD. Usado para mandar a cotação na Etapa 10."
          />
          <Campo rotulo="Cidade" valor={cidade} aoMudar={setCidade} exemplo="São Paulo" />
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

        <div className="formulario__acoes">
          <button
            type="submit"
            className="botao botao--principal"
            disabled={enviando || !razaoSocial || !cnpj}
          >
            {enviando ? 'Salvando...' : 'Cadastrar fornecedor'}
          </button>
        </div>
      </Cartao>
    </form>
  );
}
