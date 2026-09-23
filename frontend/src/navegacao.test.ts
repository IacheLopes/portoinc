// ============================================================
//  O menu e a tela de início saem daqui
//
//  Esta lista decide o que cada pessoa enxerga. Errar nela não
//  dá erro nenhum na tela: o item simplesmente aparece para quem
//  não devia, ou some para quem devia ver. É defeito que só se
//  descobre quando alguém reclama — por isso tem teste.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  MODULOS,
  GRUPOS,
  ETAPAS,
  ETAPAS_PRONTAS,
  ETAPAS_TOTAIS,
  MODULO_COMPLETO,
  menuAgrupado,
  oQueFalta,
  type Modulo,
} from './navegacao';

/** Monta o "pode ver" de alguém que tem estas permissões. */
function quemTem(...permissoes: string[]) {
  return (m: Modulo) =>
    m.permissoes.length === 0 || m.permissoes.some((p) => permissoes.includes(p));
}

describe('quem vê o quê no menu', () => {
  it('o almoxarife não enxerga Aprovações', () => {
    const menu = menuAgrupado(quemTem('estoque.ver', 'recebimento.conferir'));
    const rotulos = menu.grupos.flatMap((g) => g.itens).map((i) => i.rotulo);

    expect(rotulos).not.toContain('Aprovações');
    expect(rotulos).toContain('Estoque');
  });

  it('quem aprova enxerga Aprovações', () => {
    const menu = menuAgrupado(quemTem('solicitacoes.aprovar'));
    const rotulos = menu.grupos.flatMap((g) => g.itens).map((i) => i.rotulo);

    expect(rotulos).toContain('Aprovações');
  });

  it('grupo que ficou sem item nenhum some junto com o rótulo', () => {
    // Um título "Gestão" sozinho, sem nada embaixo, é pior do que
    // não ter o título.
    const menu = menuAgrupado(quemTem('estoque.ver'));

    for (const grupo of menu.grupos) {
      expect(grupo.itens.length).toBeGreaterThan(0);
    }
  });

  it('o Início fica solto no alto, fora de qualquer grupo', () => {
    const menu = menuAgrupado(() => true);

    expect(menu.soltos.map((i) => i.rotulo)).toContain('Início');
    expect(menu.grupos.flatMap((g) => g.itens).map((i) => i.rotulo)).not.toContain('Início');
  });

  it('quem não tem permissão nenhuma ainda vê o Início', () => {
    const menu = menuAgrupado(quemTem());

    expect(menu.soltos.map((i) => i.rotulo)).toEqual(['Início']);
    expect(menu.grupos).toHaveLength(0);
  });

  it('os grupos saem na ordem do caminho do trabalho, não em ordem alfabética', () => {
    const menu = menuAgrupado(() => true);

    expect(menu.grupos.map((g) => g.nome)).toEqual([...GRUPOS]);
  });
});

describe('a lista de módulos', () => {
  it('nenhum grupo passa de quatro itens', () => {
    // Acima disso o olho precisa contar em vez de bater a vista.
    const menu = menuAgrupado(() => true);

    for (const grupo of menu.grupos) {
      expect(grupo.itens.length).toBeLessThanOrEqual(4);
    }
  });

  it('todo módulo tem grupo, menos o Início', () => {
    const semGrupo = MODULOS.filter((m) => !m.grupo).map((m) => m.rotulo);

    expect(semGrupo).toEqual(['Início']);
  });

  it('não há dois módulos apontando para o mesmo endereço', () => {
    const enderecos = MODULOS.map((m) => m.para);

    expect(new Set(enderecos).size).toBe(enderecos.length);
  });
});

describe('o aviso de andamento', () => {
  it('não anuncia falta quando tudo está pronto', () => {
    expect(ETAPAS_PRONTAS).toBe(ETAPAS_TOTAIS);
    expect(MODULO_COMPLETO).toBe(true);
    expect(oQueFalta()).toBe('Nada mais falta para o módulo 1.');
  });

  it('as etapas são numeradas em sequência, sem buraco', () => {
    // A etapa 13 foi retirada quando deixou de ser etapa. Se alguém
    // tirar outra pelo meio, a numeração denuncia.
    expect(ETAPAS.map((e) => e.numero)).toEqual(
      Array.from({ length: ETAPAS.length }, (_, i) => i + 1),
    );
  });
});
