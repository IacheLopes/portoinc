// ============================================================
//  Município e nome fantasia
//
//  A lista vem do IBGE (DTB 2023) e tem 5.570 municípios, dos quais
//  232 nomes existem em mais de um estado — "Bom Jesus" em cinco.
//  É por isso que se ESCOLHE da lista em vez de digitar: escolhendo,
//  não se escolhe um nome, escolhe-se um município, e a dúvida
//  acaba antes de existir.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  carregarMunicipios, procurarMunicipios, sugerirNomeFantasia,
  type Municipio,
} from './municipios';

describe('A lista do IBGE', () => {
  it('traz os 5.570 municípios e os 27 estados', async () => {
    const lista = await carregarMunicipios();

    expect(lista).toHaveLength(5570);
    expect(new Set(lista.map((m) => m.uf)).size).toBe(27);
  });

  it('carrega uma vez só', async () => {
    // 72 KB destrinchados em 5.570 objetos a cada tecla seria caro.
    expect(await carregarMunicipios()).toBe(await carregarMunicipios());
  });

  it('as cidades que se repetem vêm com o estado certo', async () => {
    const lista = await carregarMunicipios();
    const bomJesus = lista.filter((m) => m.nome === 'Bom Jesus');

    expect(bomJesus.map((m) => m.uf).sort()).toEqual(['PB', 'PI', 'RN', 'RS', 'SC']);
  });
});

describe('Procurar município', () => {
  const lista: Municipio[] = [
    { nome: 'Santos', uf: 'SP' },
    { nome: 'Santo André', uf: 'SP' },
    { nome: 'Porto dos Santos', uf: 'BA' },
    { nome: 'São Paulo', uf: 'SP' },
    { nome: 'Bom Jesus', uf: 'PI' },
    { nome: 'Bom Jesus', uf: 'SC' },
  ];

  it('quem começa com o texto vem primeiro', () => {
    // Digitando "santos", "Santos" tem de vir antes de "Porto dos
    // Santos". Ordem errada faz a sugestão atrapalhar em vez de ajudar.
    const achados = procurarMunicipios(lista, 'santos');

    expect(achados[0]).toEqual({ nome: 'Santos', uf: 'SP' });
  });

  it('acha sem acento e sem maiúscula', () => {
    // Exigir o acento certo é pedir que a pessoa já saiba escrever o
    // que está tentando achar.
    expect(procurarMunicipios(lista, 'SAO PAU')[0].nome).toBe('São Paulo');
  });

  it('não sugere com uma letra só', () => {
    // Com uma letra a lista seria o catálogo inteiro.
    expect(procurarMunicipios(lista, 's')).toEqual([]);
  });

  it('cidade repetida aparece uma vez por estado', () => {
    const achados = procurarMunicipios(lista, 'bom jesus');

    expect(achados).toHaveLength(2);
    expect(achados.map((m) => m.uf).sort()).toEqual(['PI', 'SC']);
  });

  it('respeita o limite', () => {
    expect(procurarMunicipios(lista, 'sa', 2)).toHaveLength(2);
  });
});

describe('Sugerir nome fantasia', () => {
  it('corta o que descreve o ramo', () => {
    expect(sugerirNomeFantasia('Marquilip Comércio e Representação Ltda')).toBe('Marquilip');
    expect(sugerirNomeFantasia('Constrular Materiais de Construção Ltda')).toBe('Constrular');
  });

  it('não corta nome que tem preposição no meio', () => {
    // "Casa" sozinho não é o nome da empresa; "Casa do Construtor" é.
    expect(sugerirNomeFantasia('Casa do Construtor Ltda')).toBe('Casa do Construtor');
  });

  it('tira a forma jurídica mesmo sem descritor', () => {
    expect(sugerirNomeFantasia('Votorantim S.A.')).toBe('Votorantim');
    expect(sugerirNomeFantasia('Eletrosul EIRELI')).toBe('Eletrosul');
  });

  it('não sugere quando não tem o que cortar', () => {
    // Repetir a razão social inteira no campo ao lado não ajuda.
    expect(sugerirNomeFantasia('Marquilip')).toBe('');
  });

  it('não deixa preposição solta no fim', () => {
    expect(sugerirNomeFantasia('Depósito de Materiais Ltda')).not.toMatch(/\sde$/);
  });

  it('campo vazio não vira sugestão', () => {
    expect(sugerirNomeFantasia('')).toBe('');
    expect(sugerirNomeFantasia('   ')).toBe('');
  });
});
