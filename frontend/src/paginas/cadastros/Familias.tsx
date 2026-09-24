// ============================================================
//  Cadastro de famílias
// ============================================================

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { listarFamilias, criarFamilia, type Familia } from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, ErroFormulario } from '../../componentes/Campo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { plural } from '../../servicos/texto';
import { Cartao } from '../../componentes/Cartao';
import { Icone } from '../../componentes/Icone';
import { Modal } from '../../componentes/Modal';

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
          acoes={
            podeEditar && (
              <button
                type="button"
                className="botao botao--principal"
                onClick={() => setAberto(true)}
              >
                + Nova família
              </button>
            )
          }
        />

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <Icone nome="certo" /> {aviso}
          </p>
        )}

        {podeEditar && (
          <div className="barra-acoes">

          </div>
        )}

        <FormularioFamilia
          aberto={aberto}
          aoFechar={() => setAberto(false)}
          aoSalvar={async (nome) => {
            setAberto(false);
            setAviso('Família "' + nome + '" cadastrada.');
            await carregar();
          }}
        />
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
              <Cartao
                key={f.id}
                nivel={2}
                titulo={
                  <>
                    <span className="etiqueta">{f.codigo}</span> {f.nome}
                  </>
                }
                descricao={f.descricao}
              >
                <p className="linha-de-resumo">
                  <strong>{plural(f.materiais, 'item', 'itens')}</strong> ·{' '}
                  <strong>{plural(f.fornecedores, 'fornecedor', 'fornecedores')}</strong>
                </p>
              </Cartao>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function FormularioFamilia({
  aberto,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (nome: string) => Promise<void>;
}) {
  const idForm = useId();
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

  function fechar() {
    setCodigo('');
    setNome('');
    setDescricao('');
    setErro(null);
    setDetalhes([]);
    aoFechar();
  }

  return (
    /* O botao que envia mora no RODAPE do modal, fora do <form>, e
       alcanca o formulario pelo atributo `form`. E HTML de sempre:
       um submit fora do formulario continua enviando aquele
       formulario — e assim o rodape fica onde o padrao manda, sem
       quebrar o envio nem exigir estado a mais. */
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo="Nova família"
      descricao="A família agrupa material do mesmo tipo, e é por ela que o sistema sugere fornecedor."
      temAlteracao={Boolean(codigo || nome || descricao)}
      acoes={
        <>
          <button type="button" className="botao botao--discreto" onClick={fechar}>
            Cancelar
          </button>
          <button
            type="submit"
            form={idForm}
            className="botao botao--principal"
            disabled={enviando || !codigo || !nome}
          >
            {enviando ? 'Salvando...' : 'Cadastrar família'}
          </button>
        </>
      }
    >
      <form id={idForm} onSubmit={enviar} noValidate>

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
      </form>
    </Modal>
  );
}
