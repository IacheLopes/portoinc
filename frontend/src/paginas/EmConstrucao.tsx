import { CabecalhoDePagina } from '../componentes/CabecalhoDePagina';
// ============================================================
//  Aviso de tela ainda não construída
//
//  Em vez de um link que não leva a lugar nenhum, a pessoa vê
//  o que virá e em qual etapa. Isso é feedback honesto: ela
//  entende que não é um defeito, é obra em andamento.
// ============================================================

interface Props {
  titulo: string;
  etapa: number;
  descricao: string;
  itens: string[];
}

export function EmConstrucao({ titulo, etapa, descricao, itens }: Props) {
  return (
    <section className="secao">
      <CabecalhoDePagina
          titulo={titulo}
          descricao={
            <>
              {descricao}
            </>
          }
        />

      <div className="cartao">
        <h2 className="em-obra__titulo">O que esta tela vai fazer</h2>
        <ul className="em-obra__lista">
          {itens.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="em-obra__nota">
          Esta função entra na <strong>Etapa {etapa}</strong> do plano de desenvolvimento.
        </p>
      </div>
    </section>
  );
}
