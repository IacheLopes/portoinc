// ============================================================
//  Cadastros - página de entrada
//
//  Explica a ordem em que as coisas devem ser cadastradas.
//  Sem isso, a pessoa tenta cadastrar material antes de ter
//  família e trava logo no primeiro campo.
// ============================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAutenticacao } from '../../contexto/Autenticacao';
import {
  listarFamilias, listarObras, listarMateriais, listarFornecedores,
} from '../../servicos/cadastros';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Icone, type NomeDoIcone } from '../../componentes/Icone';

interface Cartao {
  ordem: number;
  titulo: string;
  descricao: string;
  para: string;
  icone: NomeDoIcone;
  permissoes: string[];
  chave: 'obras' | 'familias' | 'materiais' | 'fornecedores' | 'alcadas';
}

const CARTOES: Cartao[] = [
  {
    ordem: 1,
    titulo: 'Famílias',
    descricao: 'Agrupam os itens por tipo. É por elas que o sistema sabe quais fornecedores convidar para cada cotação.',
    para: '/cadastros/familias',
    icone: 'arquivos',
    permissoes: ['materiais.ver'],
    chave: 'familias',
  },
  {
    ordem: 2,
    titulo: 'Materiais e serviços',
    descricao: 'O catálogo da empresa, com código Porto, código de barras, norma técnica e unidade de medida.',
    para: '/cadastros/materiais',
    icone: 'tijolo',
    permissoes: ['materiais.ver'],
    chave: 'materiais',
  },
  {
    ordem: 3,
    titulo: 'Fornecedores',
    descricao: 'Quem vende para a Porto Inc., e quais famílias cada um atende.',
    para: '/cadastros/fornecedores',
    icone: 'caminhao',
    permissoes: ['fornecedores.ver'],
    chave: 'fornecedores',
  },
  {
    ordem: 4,
    titulo: 'Obras',
    descricao: 'Os empreendimentos, com o orçamento e o almoxarifado de cada um.',
    para: '/cadastros/obras',
    icone: 'obra',
    permissoes: ['obras.ver'],
    chave: 'obras',
  },
  {
    ordem: 5,
    titulo: 'Limites de alçada',
    descricao: 'Até quanto cada função aprova sozinha, e a partir de qual valor sobe para o fundador.',
    para: '/cadastros/alcadas',
    icone: 'balanca',
    permissoes: ['alcadas.gerenciar'],
    chave: 'alcadas',
  },
];

export function CadastrosIndice() {
  const { pode } = useAutenticacao();
  const [contagem, setContagem] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let ativo = true;

    async function contar() {
      const resultado: Record<string, number | null> = {};

      const tarefas: Array<[string, Promise<number>]> = [];

      if (pode('materiais.ver')) {
        tarefas.push(['familias', listarFamilias().then((r) => r.familias.length)]);
        tarefas.push(['materiais', listarMateriais().then((r) => r.materiais.length)]);
      }
      if (pode('fornecedores.ver')) {
        tarefas.push(['fornecedores', listarFornecedores().then((r) => r.fornecedores.length)]);
      }
      if (pode('obras.ver')) {
        tarefas.push(['obras', listarObras().then((r) => r.obras.length)]);
      }

      for (const [chave, promessa] of tarefas) {
        try {
          resultado[chave] = await promessa;
        } catch {
          resultado[chave] = null;
        }
      }

      if (ativo) setContagem(resultado);
    }

    void contar();
    return () => {
      ativo = false;
    };
  }, [pode]);

  const meus = CARTOES.filter((c) => pode(...c.permissoes));

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Cadastros"
          descricao={
            <>
              A base que as próximas etapas usam. Os números indicam a ordem recomendada
            para preencher — cada um depende do anterior.
            </>
          }
        />

        <div className="aviso aviso--info">
          <Icone nome="dica" className="aviso__icone" />
          <div>
            <strong>Por que esta ordem?</strong>
            <p>
              Um material precisa de uma família. Um fornecedor é ligado a famílias.
              Uma obra precisa do orçamento para que as compras sejam apontadas nele.
              Seguindo a ordem, nenhum campo fica travado.
            </p>
          </div>
        </div>

        <div className="grade">
          {meus.map((c) => (
            <Link key={c.para} to={c.para} className="cadastro-cartao">
              <span className="cadastro-cartao__ordem" aria-hidden="true">
                {c.ordem}
              </span>
              <Icone nome={c.icone} className="cadastro-cartao__icone" />
              <span className="cadastro-cartao__texto">
                <strong>{c.titulo}</strong>
                <small>{c.descricao}</small>
                {contagem[c.chave] !== undefined && contagem[c.chave] !== null && (
                  <span className="cadastro-cartao__contagem">
                    {contagem[c.chave]} cadastrado(s)
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
