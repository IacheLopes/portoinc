// ============================================================
//  Cartao de indicador
//
//  Agrupa titulo, valor e detalhe. O agrupamento visual e o que
//  aplica a PROXIMIDADE: o olho entende que os tres pertencem
//  ao mesmo assunto.
// ============================================================

interface Props {
  titulo: string;
  valor: React.ReactNode;
  detalhe?: React.ReactNode;
}

export function Cartao({ titulo, valor, detalhe }: Props) {
  return (
    <article className="cartao">
      <h3 className="cartao__titulo">{titulo}</h3>
      <p className="cartao__valor">{valor}</p>
      {detalhe && <p className="cartao__rodape">{detalhe}</p>}
    </article>
  );
}
