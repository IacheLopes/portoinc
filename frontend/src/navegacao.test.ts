// ============================================================
//  O menu, as telas índice e a tela de início saem daqui
//
//  Esta lista decide o que cada pessoa enxerga. Errar nela não
//  dá erro nenhum na tela: o item simplesmente aparece para quem
//  não devia, ou some para quem devia ver. É defeito que só se
//  descobre quando alguém reclama — por isso tem teste.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  MODULOS,
  DESTINOS,
  INDICES,
  barraLateral,
  cartoesDoIndice,
  indiceDe,
  porteDaTela,
  trilhaDe,
  voltarDe,
  PAGINAS,
  type Modulo,
} from './navegacao';

/** Monta o "pode ver" de alguém que tem estas permissões. */
function quemTem(...permissoes: string[]) {
  return (m: Modulo) =>
    m.permissoes.length === 0 || m.permissoes.some((p) => permissoes.includes(p));
}

// ------------------------------------------------------------
//  A barra lateral não cresce
//
//  É o pedido da reunião de 08/10/2026: "vai tudo ficar meio que
//  encolhido, pra parecer que é pouca coisa... fica coisa demais".
//  O que protege isso no tempo não é a boa intenção — é este
//  bloco de testes.
// ------------------------------------------------------------
describe('A barra lateral', () => {
  it('cabe em seis linhas, mesmo para quem vê tudo', () => {
    const linhas = barraLateral(() => true);

    expect(linhas).toHaveLength(6);
    expect(linhas.map((l) => l.rotulo)).toEqual([
      'Início',
      'Compras',
      'Almoxarifado',
      'Financeiro',
      'Relatórios',
      'Administração',
    ]);
  });

  it('NÃO cresce quando entra tela nova', () => {
    // Este é o teste que faz a decisão durar. Tela nova é cartão
    // dentro de um índice que já existe; se alguém criar um quinto
    // destino, isto falha e a conversa acontece antes do commit,
    // não seis meses depois com a barra em 11 linhas.
    const antes = barraLateral(() => true).length;

    expect(DESTINOS).toHaveLength(4);
    expect(INDICES).toHaveLength(4);
    expect(antes).toBe(6);
  });

  it('os Relatórios ficam logo abaixo do Financeiro', () => {
    // Eles falam do sistema inteiro e nao cabem dentro de um destino
    // so: o engenheiro e o gestor de obra leem relatorio e NAO abrem
    // o financeiro. Mas o lugar deles e perto do dinheiro, e nao no
    // alto da barra.
    const rotulos = barraLateral(() => true).map((l) => l.rotulo);

    expect(rotulos.indexOf('Relatórios')).toBe(rotulos.indexOf('Financeiro') + 1);
  });

  it('quem não vê o Financeiro ainda vê os Relatórios no lugar deles', () => {
    // O engenheiro tem relatorios.ver e nao tem financeiro.ver. Se os
    // relatorios morassem dentro do Financeiro, ele os perderia; se
    // caissem para o fim da barra, mudariam de lugar conforme a
    // pessoa.
    const rotulos = barraLateral(
      quemTem('relatorios.ver', 'estoque.ver'),
    ).map((l) => l.rotulo);

    expect(rotulos).toEqual(['Início', 'Almoxarifado', 'Relatórios']);
  });

  it('o fio nasce no PRIMEIRO destino, seja ele qual for', () => {
    const todos = barraLateral(() => true).filter((l) => l.primeiroDestino);
    expect(todos.map((l) => l.rotulo)).toEqual(['Compras']);

    // Para o almoxarife, que nao ve Compras, o fio desce junto.
    const doAlmoxarife = barraLateral(quemTem('estoque.ver'))
      .filter((l) => l.primeiroDestino);
    expect(doAlmoxarife.map((l) => l.rotulo)).toEqual(['Almoxarifado']);
  });

  it('só duas telas ficam soltas, e são sempre as mesmas', () => {
    const soltos = MODULOS.filter((m) => !m.grupo).map((m) => m.rotulo);

    expect(soltos).toEqual(['Início', 'Relatórios']);
  });

  it('destino sem nenhum cartão visível some da barra', () => {
    // Um "Financeiro" que abre uma tela vazia é pior que não ter
    // o Financeiro.
    const linhas = barraLateral(quemTem('estoque.ver'));

    expect(linhas.map((l) => l.rotulo)).toContain('Almoxarifado');
    expect(linhas.map((l) => l.rotulo)).not.toContain('Financeiro');
    expect(linhas.map((l) => l.rotulo)).not.toContain('Compras');
  });

  it('quem não tem permissão nenhuma ainda vê o Início', () => {
    const linhas = barraLateral(quemTem());

    expect(linhas.map((l) => l.rotulo)).toEqual(['Início']);
  });

  it('os destinos saem na ordem do caminho do trabalho', () => {
    const linhas = barraLateral(() => true).filter((l) => l.ehDestino);

    expect(linhas.map((l) => l.rotulo)).toEqual([...DESTINOS]);
  });

  it('o almoxarife não enxerga Compras pela porta do Financeiro', () => {
    const linhas = barraLateral(quemTem('estoque.ver', 'recebimento.registrar'));

    expect(linhas.map((l) => l.rotulo)).toEqual(['Início', 'Almoxarifado']);
  });
});

// ------------------------------------------------------------
//  As telas índice
// ------------------------------------------------------------
describe('Os cartões de cada índice', () => {
  it('Compras traz as quatro telas do fluxo, na ordem', () => {
    const cartoes = cartoesDoIndice('Compras', () => true);

    expect(cartoes.map((c) => c.rotulo)).toEqual([
      'Solicitações', 'Aprovações', 'Cotações', 'Pedidos',
    ]);
  });

  it('a numeração só existe onde a lista é mesmo uma sequência', () => {
    // Solicitar → aprovar → cotar → pedir é um caminho. Receber,
    // estocar e alugar acontecem em paralelo: numerar prometeria
    // uma ordem que não existe.
    const compras = cartoesDoIndice('Compras', () => true);
    const almoxarifado = cartoesDoIndice('Almoxarifado', () => true);

    expect(compras.every((c) => c.ordem !== undefined)).toBe(true);
    expect(almoxarifado.every((c) => c.ordem === undefined)).toBe(true);
  });

  it('na Administração, os cadastros são numerados e o resto não', () => {
    const cartoes = cartoesDoIndice('Administração', () => true);
    const numerados = cartoes.filter((c) => c.ordem !== undefined).map((c) => c.rotulo);
    const soltos = cartoes.filter((c) => c.ordem === undefined).map((c) => c.rotulo);

    expect(numerados).toEqual([
      'Famílias', 'Materiais', 'Fornecedores', 'Obras', 'Limites de alçada',
    ]);
    // Os cinco numerados são a ORDEM de alimentar o sistema —
    // família antes de material, material antes de fornecedor. O
    // resto é ajuste de quem administra e não entra nessa fila.
    //
    // "Funções" saiu da lista em 10/10/2026: virou a segunda aba de
    // Usuários, porque eram duas telas para uma pergunta só.
    //
    // "Área IA" entrou em 14/10/2026. Ela fica SOLTA, e não
    // numerada, pelo mesmo motivo dos outros: não faz parte da
    // ordem de alimentar o sistema — é ajuste de quem administra.
    expect(soltos).toEqual(['Usuários', 'Comunicação', 'Área IA', 'Status do sistema']);
  });

  it('o índice mostra só o que a pessoa pode abrir', () => {
    const cartoes = cartoesDoIndice('Administração', quemTem('obras.ver'));

    expect(cartoes.map((c) => c.rotulo)).toEqual(['Obras']);
  });

  it('a porta fica acesa mesmo numa tela de dentro', () => {
    // Sem isto a barra apagava enquanto a pessoa trabalhava: estando
    // em Contas a pagar, nenhuma das seis linhas ficava marcada.
    expect(porteDaTela('/financeiro/contas')).toBe('/financeiro');
    expect(porteDaTela('/solicitacoes')).toBe('/compras');
    expect(porteDaTela('/cadastros/obras/abc-123')).toBe('/administracao');
    expect(porteDaTela('/estoque/movimentos')).toBe('/almoxarifado');
  });

  it('tela solta não acende porta nenhuma', () => {
    expect(porteDaTela('/')).toBeNull();
    expect(porteDaTela('/relatorios')).toBeNull();
    expect(porteDaTela('/minha-senha')).toBeNull();
  });

  it('todo módulo com destino aponta para um índice que existe', () => {
    for (const m of MODULOS.filter((x) => x.grupo)) {
      expect(indiceDe(m.para), m.rotulo).not.toBeNull();
    }
  });
});

describe('a lista de módulos', () => {
  it('não há dois módulos apontando para o mesmo endereço', () => {
    const enderecos = MODULOS.map((m) => m.para);

    expect(new Set(enderecos).size).toBe(enderecos.length);
  });

  it('toda tela do menu tem uma migalha declarada', () => {
    // Sem a migalha, a tela abre sem trilha e o botão de Voltar
    // some — e isso não dá erro nenhum, só uma tela sem saída.
    const rotas = new Set(PAGINAS.map((p) => p.rota));

    for (const m of MODULOS) {
      expect(rotas.has(m.para), m.rotulo + ' (' + m.para + ')').toBe(true);
    }
  });

  it('toda tela índice tem migalha e sai do Início', () => {
    for (const i of INDICES) {
      const pagina = PAGINAS.find((p) => p.rota === i.para);
      expect(pagina, i.destino).toBeDefined();
      expect(pagina?.mae).toBe('/');
    }
  });
});

// ------------------------------------------------------------
//  De onde a pessoa veio vence a hierarquia fixa
//
//  A solicitação mora debaixo de Solicitações. Mas chega-se a ela
//  também pela fila de Aprovações — e aí a migalha anunciava
//  "Início › Solicitações", como se o sistema a tivesse jogado para
//  outro lugar. Relatado pelo dono do sistema em 24/09/2026.
// ------------------------------------------------------------
describe('A trilha respeita o caminho que a pessoa fez', () => {
  const ID = '/solicitacoes/21c990c3-54f7-4cd6-a7d8-3f9fb7007a2d';

  it('sem origem, a trilha é a de sempre', () => {
    const t = trilhaDe(ID).map((d) => d.titulo);
    expect(t).toContain('Solicitações');
    expect(t).not.toContain('Aprovações');
  });

  it('a trilha passa pelo índice, como a pessoa passou', () => {
    // A barra não leva mais direto a Solicitações: passa-se por
    // Compras. Se a migalha pulasse esse degrau, o botão de Voltar
    // devolveria a pessoa a um lugar por onde ela não veio.
    const t = trilhaDe('/solicitacoes').map((d) => d.titulo);

    expect(t).toEqual(['Início', 'Compras', 'Solicitações']);
  });

  it('vindo de Aprovações, o degrau do meio é Aprovações', () => {
    const t = trilhaDe(ID, '/aprovacoes').map((d) => d.titulo);
    expect(t).toContain('Aprovações');
    expect(t).not.toContain('Solicitações');
  });

  it('o Voltar leva de volta para onde a pessoa estava', () => {
    expect(voltarDe(ID)?.para).toBe('/solicitacoes');
    expect(voltarDe(ID, '/aprovacoes')?.para).toBe('/aprovacoes');
  });

  it('origem igual ao destino não muda nada', () => {
    const t = trilhaDe(ID, ID).map((d) => d.titulo);
    expect(t).toContain('Solicitações');
  });
});
