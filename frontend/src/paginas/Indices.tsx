// ============================================================
//  As quatro telas índice
//
//  São as portas dos quatro destinos da barra lateral. Cada uma
//  monta os cartões a partir do `MODULOS` — a mesma lista que
//  desenha a barra e a tela de Início.
//
//  Uma lista só, de propósito, e isso já custou caro uma vez: o
//  menu e a tela inicial liam listas separadas, e a tela inicial
//  passou meses anunciando que faltavam módulos que já existiam.
//
//  Tela nova = uma linha no `navegacao.ts`, e ela aparece nos
//  três lugares.
// ============================================================

import { useAutenticacao } from '../contexto/Autenticacao';
import { useContagens } from '../ganchos/contagens';
import { TelaIndice, type CartaoDoIndice, type BlocoDoIndice } from '../componentes/TelaIndice';
import { cartoesDoIndice, INDICES, type Destino, type Modulo } from '../navegacao';

/** Monta os cartões de um destino, com o número de cada um. */
function useCartoes(destino: Destino): CartaoDoIndice[] {
  const { pode } = useAutenticacao();
  const contagens = useContagens();

  const modulos = cartoesDoIndice(destino, (m: Modulo) =>
    m.permissoes.length === 0 || pode(...m.permissoes),
  );

  return modulos.map((m) => {
    const contagem = contagens.get(m.para);

    return {
      titulo: m.titulo,
      descricao: m.descricao,
      para: m.para,
      icone: m.icone,
      ordem: m.ordem,
      detalhe: contagem?.detalhe ?? null,
      tom: contagem?.tom,
    };
  });
}

function descricaoDe(destino: Destino): string {
  return INDICES.find((i) => i.destino === destino)?.descricao ?? '';
}

// ------------------------------------------------------------
//  Compras
// ------------------------------------------------------------
export function IndiceCompras() {
  const cartoes = useCartoes('Compras');

  return (
    <TelaIndice
      titulo="Compras"
      descricao={descricaoDe('Compras')}
      vazio="Você não participa do fluxo de compras."
      blocos={[
        {
          nota: (
            <>
              <strong>É um caminho, e os números mostram a ordem.</strong>
              <p>
                A obra pede, quem tem alçada assina, o comprador cota com vários
                fornecedores e o pedido sai para quem venceu. Cada passo só existe
                porque o anterior aconteceu.
              </p>
            </>
          ),
          cartoes,
        },
      ]}
    />
  );
}

// ------------------------------------------------------------
//  Almoxarifado
// ------------------------------------------------------------
export function IndiceAlmoxarifado() {
  const cartoes = useCartoes('Almoxarifado');

  return (
    <TelaIndice
      titulo="Almoxarifado"
      descricao={descricaoDe('Almoxarifado')}
      vazio="Você não tem acesso ao almoxarifado."
      blocos={[{ cartoes }]}
    />
  );
}

// ------------------------------------------------------------
//  Financeiro
// ------------------------------------------------------------
export function IndiceFinanceiro() {
  const cartoes = useCartoes('Financeiro');

  return (
    <TelaIndice
      titulo="Financeiro"
      descricao={descricaoDe('Financeiro')}
      vazio="Você não tem acesso ao financeiro."
      blocos={[
        {
          nota: (
            <>
              <strong>O dinheiro sai por dois caminhos.</strong>
              <p>
                A compra nasce da nota fiscal e vira parcela em contas a pagar. O que
                não vem de compra — combustível, aluguel, taxa — é lançado à mão em
                Receitas e despesas, que é também onde entra o dinheiro que a empresa
                recebe.
              </p>
            </>
          ),
          cartoes,
        },
      ]}
    />
  );
}

// ------------------------------------------------------------
//  Administração
//
//  Dois assuntos numa tela, e por isso em dois blocos: os cinco
//  cadastros têm ordem entre si (material precisa de família,
//  fornecedor é ligado a famílias, obra precisa de orçamento), e
//  o resto não tem ordem nenhuma.
// ------------------------------------------------------------
export function IndiceAdministracao() {
  const cartoes = useCartoes('Administração');

  const cadastros: BlocoDoIndice = {
    titulo: 'Cadastros',
    nota: (
      <>
        <strong>Por que esta ordem?</strong>
        <p>
          Um material precisa de uma família. Um fornecedor é ligado a famílias. Uma
          obra precisa do orçamento para que as compras sejam apontadas nele. Seguindo
          a ordem, nenhum campo fica travado.
        </p>
      </>
    ),
    cartoes: cartoes.filter((c) => c.ordem !== undefined),
  };

  const sistema: BlocoDoIndice = {
    titulo: 'Sistema',
    cartoes: cartoes.filter((c) => c.ordem === undefined),
  };

  return (
    <TelaIndice
      titulo="Administração"
      descricao={descricaoDe('Administração')}
      vazio="Você não tem acesso à administração."
      blocos={[cadastros, sistema]}
    />
  );
}
