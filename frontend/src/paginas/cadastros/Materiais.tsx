// ============================================================
//  Catálogo de materiais e serviços
//
//  Aqui ficam os três campos que a reunião pediu separados:
//  código Porto, código de barras e norma técnica (NBR).
// ============================================================

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  listarMateriais, listarFamilias, criarMaterial, biparCodigo,
  quantidade, UNIDADES,
  type Material, type Familia, type TipoItem,
} from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, Selecao, ErroFormulario } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';

export function Materiais() {
  const { pode } = useAutenticacao();
  const podeEditar = pode('materiais.gerenciar');

  const [materiais, setMateriais] = useState<Material[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  const [busca, setBusca] = useState('');
  const [familiaId, setFamiliaId] = useState('');
  const [tipo, setTipo] = useState<'' | TipoItem>('');

  const carregar = useCallback(
    async (filtros: { busca?: string; familiaId?: string; tipo?: TipoItem } = {}) => {
      setCarregando(true);
      setErro(null);
      try {
        const [m, f] = await Promise.all([listarMateriais(filtros), listarFamilias()]);
        setMateriais(m.materiais);
        setFamilias(f.familias);
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
    void carregar({
      busca: busca || undefined,
      familiaId: familiaId || undefined,
      tipo: tipo || undefined,
    });
  }

  if (carregando && materiais.length === 0) return <Carregando mensagem="Carregando catálogo..." />;
  if (erro && materiais.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Materiais e serviços"
          descricao={
            <>
              O catálogo da Porto Inc. Serviço não tem código de barras e não entra no estoque.
            </>
          }
        />

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <span aria-hidden="true">✓</span> {aviso}
          </p>
        )}

        <div className="barra-acoes">
          <Campo
            rotulo="Buscar"
            valor={busca}
            aoMudar={setBusca}
            tipo="search"
            exemplo="descrição, código ou marca"
            semMarcaOpcional
            aoConfirmar={aplicarFiltros}
          />

          <Selecao
            rotulo="Família"
            valor={familiaId}
            aoMudar={setFamiliaId}
            semMarcaOpcional
            vazio="Todas as famílias"
            opcoes={familias.map((f) => ({ valor: f.id, rotulo: f.nome }))}
          />

          <Selecao
            rotulo="Tipo"
            valor={tipo}
            aoMudar={(v) => setTipo(v as '' | TipoItem)}
            semMarcaOpcional
            vazio="Material e serviço"
            opcoes={[
              { valor: 'MATERIAL', rotulo: 'Só material' },
              { valor: 'SERVICO', rotulo: 'Só serviço' },
            ]}
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
              {aberto ? 'Cancelar' : '+ Novo item'}
            </button>
          )}
        </div>

        {aberto && (
          <FormularioMaterial
            familias={familias}
            aoSalvar={async (descricao) => {
              setAberto(false);
              setAviso('"' + descricao + '" cadastrado no catálogo.');
              aplicarFiltros();
            }}
          />
        )}
      </section>

      <section className="secao">
        {materiais.length === 0 ? (
          <Vazio
            titulo="Nenhum item encontrado"
            descricao="Ajuste os filtros ou cadastre um item novo."
          />
        ) : (
          <Cartao semEspaco>
            <div className="tabela-area">
              <table className="tabela">
                <caption className="apenas-leitor-tela">
                  Catálogo de materiais e serviços da Porto Inc.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Cód. Porto</th>
                    <th scope="col">Descrição</th>
                    <th scope="col">Família</th>
                    <th scope="col">Un.</th>
                    <th scope="col">Cód. de barras</th>
                    <th scope="col">Norma</th>
                    <th scope="col" className="numero">Ponto de pedido</th>
                  </tr>
                </thead>
                <tbody>
                  {materiais.map((m) => (
                    <tr key={m.id}>
                      <th scope="row" className="mono">
                        {m.codigoInterno}
                      </th>
                      <td>
                        {m.descricao}
                        {m.marca && <small className="linha-extra">{m.marca}</small>}
                        {m.tipo === 'SERVICO' && (
                          <>
                            {' '}
                            <Selo tipo="info">Serviço</Selo>
                          </>
                        )}
                      </td>
                      <td>
                        <span className="etiqueta">{m.familia.codigo}</span>
                      </td>
                      <td className="mono">{m.unidadeMedida}</td>
                      <td className="mono">{m.gtin ?? '—'}</td>
                      <td>{m.normaTecnica ?? '—'}</td>
                      <td className="numero">
                        {m.pontoPedido !== null ? quantidade(m.pontoPedido) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>
        )}

        <p className="secao__descricao" style={{ marginTop: 'var(--esp-3)' }}>
          {materiais.length} item(ns) listado(s).
        </p>
      </section>
    </>
  );
}

// ------------------------------------------------------------
//  Formulário
// ------------------------------------------------------------
function FormularioMaterial({
  familias,
  aoSalvar,
}: {
  familias: Familia[];
  aoSalvar: (descricao: string) => Promise<void>;
}) {
  const [familiaId, setFamiliaId] = useState('');
  const [codigoInterno, setCodigoInterno] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<TipoItem>('MATERIAL');
  const [marca, setMarca] = useState('');
  const [gtin, setGtin] = useState('');
  const [normaTecnica, setNormaTecnica] = useState('');
  const [unidadeMedida, setUnidadeMedida] = useState('UN');
  const [pontoPedido, setPontoPedido] = useState('');
  const [codigoLinhaPadrao, setCodigoLinhaPadrao] = useState('');

  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [avisoGtin, setAvisoGtin] = useState<string | null>(null);

  const ehServico = tipo === 'SERVICO';

  // Ao sair do campo de código de barras, confere se já existe.
  async function conferirGtin() {
    setAvisoGtin(null);
    if (!gtin.trim()) return;

    try {
      const r = await biparCodigo(gtin.trim());
      if (r.encontrado) {
        setAvisoGtin('Este código já está cadastrado em "' + r.material.descricao + '".');
      }
    } catch {
      /* não encontrado: é o caso normal ao cadastrar item novo */
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setDetalhes([]);
    setEnviando(true);

    try {
      await criarMaterial({
        familiaId,
        codigoInterno,
        descricao,
        tipo,
        marca: marca || undefined,
        gtin: ehServico ? undefined : gtin || undefined,
        normaTecnica: normaTecnica || undefined,
        unidadeMedida,
        pontoPedido: pontoPedido ? Number(pontoPedido) : undefined,
        codigoLinhaPadrao: codigoLinhaPadrao || undefined,
      });
      await aoSalvar(descricao);
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
      <Cartao className="formulario" titulo="Novo item de catálogo" nivel={2}>

        <div className="formulario__linha">
          <Selecao
            rotulo="Tipo"
            valor={tipo}
            aoMudar={(v) => setTipo(v as TipoItem)}
            opcoes={[
              { valor: 'MATERIAL', rotulo: 'Material' },
              { valor: 'SERVICO', rotulo: 'Serviço' },
            ]}
            ajuda={ehServico ? 'Serviço não tem código de barras nem estoque.' : undefined}
            obrigatorio
          />
          <Selecao
            rotulo="Família"
            valor={familiaId}
            aoMudar={setFamiliaId}
            opcoes={familias.map((f) => ({ valor: f.id, rotulo: f.codigo + ' — ' + f.nome }))}
            vazio="Escolha a família..."
            ajuda="Define quais fornecedores serão convidados para cotar."
            obrigatorio
          />
        </div>

        <div className="formulario__linha">
          <Campo
            rotulo="Código Porto"
            valor={codigoInterno}
            aoMudar={setCodigoInterno}
            exemplo="00119"
            ajuda="O mesmo código usado nas planilhas da empresa."
            obrigatorio
          />
          <Selecao
            rotulo="Unidade de medida"
            valor={unidadeMedida}
            aoMudar={setUnidadeMedida}
            opcoes={UNIDADES.map((u) => ({ valor: u, rotulo: u }))}
            obrigatorio
          />
        </div>

        <Campo
          rotulo="Descrição"
          valor={descricao}
          aoMudar={setDescricao}
          exemplo="Cimento Portland CP-II-Z-32 saco 50kg"
          ajuda="Quanto mais específica, menos erro na cotação e no recebimento."
          obrigatorio
        />

        <div className="formulario__linha">
          <Campo rotulo="Marca" valor={marca} aoMudar={setMarca} exemplo="Votoran" />
          <Campo
            rotulo="Norma técnica (NBR)"
            valor={normaTecnica}
            aoMudar={setNormaTecnica}
            exemplo="NBR 16697"
            ajuda="Norma ABNT que o item precisa cumprir."
          />
        </div>

        {!ehServico && (
          <div className="formulario__linha">
            <div onBlur={() => void conferirGtin()}>
              <Campo
                rotulo="Código de barras (GTIN)"
                valor={gtin}
                aoMudar={setGtin}
                exemplo="7899888400575"
                erro={avisoGtin ?? undefined}
                ajuda="O sistema confere o dígito verificador ao salvar."
              />
            </div>
            <Campo
              rotulo="Ponto de pedido"
              valor={pontoPedido}
              aoMudar={setPontoPedido}
              tipo="number"
              exemplo="50"
              ajuda="Abaixo desta quantidade o sistema avisa que é hora de comprar."
            />
          </div>
        )}

        <Campo
          rotulo="Linha de orçamento sugerida"
          valor={codigoLinhaPadrao}
          aoMudar={setCodigoLinhaPadrao}
          exemplo="03.01.001"
          ajuda="Vem preenchida na solicitação, e pode ser trocada lá. Como o mesmo item é usado em várias obras, guardamos só o código da linha."
        />

        {erro && <ErroFormulario mensagem={erro} detalhes={detalhes} />}

        <div className="formulario__acoes">
          <button
            type="submit"
            className="botao botao--principal"
            disabled={enviando || !familiaId || !codigoInterno || !descricao}
          >
            {enviando ? 'Salvando...' : 'Cadastrar item'}
          </button>
        </div>
      </Cartao>
    </form>
  );
}
