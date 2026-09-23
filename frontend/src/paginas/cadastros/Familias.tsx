// ============================================================
//  Cadastro de famílias
// ============================================================

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { listarFamilias, criarFamilia, type Familia } from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, ErroFormulario } from '../../componentes/Campo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';

export function Familias() {
  const { pode } = useAutenticacao();
  const podeEditar = pode('materiais.gerenciar');

  const [familias, setFamilias] = useState<Familia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setFamilias((await listarFamilias()).familias);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando && familias.length === 0) return <Carregando mensagem="Carregando famílias..." />;
  if (erro && familias.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Famílias de material"
          descricao={
            <>
              A família diz a que grupo o item pertence. É ela que define{' '}
            <strong>quais fornecedores são convidados</strong> quando o comprador monta
            uma cotação — um BID de elétrica só vai para quem vende elétrica.
            </>
          }
        />

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <span aria-hidden="true">✓</span> {aviso}
          </p>
        )}

        {podeEditar && (
          <div className="barra-acoes">
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
            >
              {aberto ? 'Cancelar' : '+ Nova família'}
            </button>
          </div>
        )}

        {aberto && (
          <FormularioFamilia
            aoSalvar={async (nome) => {
              setAberto(false);
              setAviso('Família "' + nome + '" cadastrada.');
              await carregar();
            }}
          />
        )}
      </section>

      <section className="secao">
        {familias.length === 0 ? (
          <Vazio
            titulo="Nenhuma família cadastrada"
            descricao="Comece por aqui: sem família não é possível cadastrar material."
          />
        ) : (
          <div className="grade">
            {familias.map((f) => (
              <article key={f.id} className="cartao">
                <h2 className="cartao__titulo">
                  <span className="etiqueta">{f.codigo}</span> {f.nome}
                </h2>
                {f.descricao && <p className="funcao__descricao">{f.descricao}</p>}
                <p className="cartao__rodape">
                  <strong>{f.materiais}</strong> itens ·{' '}
                  <strong>{f.fornecedores}</strong> fornecedor(es)
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function FormularioFamilia({ aoSalvar }: { aoSalvar: (nome: string) => Promise<void> }) {
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setDetalhes([]);
    setEnviando(true);

    try {
      await criarFamilia({ codigo, nome, descricao: descricao || undefined });
      await aoSalvar(nome);
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
    <form className="cartao formulario" onSubmit={enviar} noValidate>
      <h2 className="formulario__titulo">Nova família</h2>

      <div className="formulario__linha">
        <Campo
          rotulo="Código"
          valor={codigo}
          aoMudar={setCodigo}
          exemplo="ELE"
          ajuda="Sigla curta. Vira maiúscula automaticamente."
          obrigatorio
          maximo={10}
        />
        <Campo
          rotulo="Nome"
          valor={nome}
          aoMudar={setNome}
          exemplo="Material elétrico"
          obrigatorio
        />
      </div>

      <Campo
        rotulo="Descrição"
        valor={descricao}
        aoMudar={setDescricao}
        exemplo="Fios, cabos, eletrodutos, quadros e disjuntores."
        ajuda="Ajuda quem for cadastrar material a escolher a família certa."
      />

      {erro && <ErroFormulario mensagem={erro} detalhes={detalhes} />}

      <div className="formulario__acoes">
        <button
          type="submit"
          className="botao botao--principal"
          disabled={enviando || !codigo || !nome}
        >
          {enviando ? 'Salvando...' : 'Cadastrar família'}
        </button>
      </div>
    </form>
  );
}
