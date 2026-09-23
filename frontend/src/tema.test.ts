// ============================================================
//  O tema
//
//  O claro é o padrão e o escuro é escolha. O que não pode
//  acontecer: abrir escuro sem ninguém ter pedido, ou esquecer a
//  escolha no recarregamento.
// ============================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  TEMA_PADRAO, CHAVE_TEMA, ehTema, lerTema, aplicarTema, guardarTema, outroTema,
} from './tema';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-tema');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Qual tema abre', () => {
  it('sem escolha guardada, abre no CLARO', () => {
    expect(TEMA_PADRAO).toBe('claro');
    expect(lerTema()).toBe('claro');
  });

  it('com escolha guardada, abre no que foi escolhido', () => {
    window.localStorage.setItem(CHAVE_TEMA, 'escuro');
    expect(lerTema()).toBe('escuro');
  });

  it('valor estranho no armazenamento não quebra: volta ao claro', () => {
    // Alguém mexendo no navegador, ou uma versão velha do sistema.
    window.localStorage.setItem(CHAVE_TEMA, 'roxo');
    expect(lerTema()).toBe('claro');
  });

  it('armazenamento bloqueado não quebra o sistema', () => {
    // Janela anônima, ou política da empresa. O sistema tem de
    // abrir assim mesmo, no claro.
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(lerTema()).toBe('claro');
  });
});

describe('Aplicar na página', () => {
  it('o escuro marca a página', () => {
    aplicarTema('escuro');
    expect(document.documentElement.getAttribute('data-tema')).toBe('escuro');
  });

  it('o claro NÃO marca nada: é a ausência de marca', () => {
    // Um estado a menos para manter sincronizado.
    aplicarTema('escuro');
    aplicarTema('claro');
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
  });

  it('a barra do navegador no celular acompanha', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);

    aplicarTema('escuro');
    const escuro = meta.getAttribute('content');

    aplicarTema('claro');
    const claro = meta.getAttribute('content');

    expect(escuro).not.toBe(claro);
    expect(claro).toBe('#ffffff');

    meta.remove();
  });
});

describe('Guardar a escolha', () => {
  it('guarda para a próxima visita', () => {
    guardarTema('escuro');
    expect(window.localStorage.getItem(CHAVE_TEMA)).toBe('escuro');
  });

  it('armazenamento bloqueado não derruba a troca', () => {
    // O tema já foi aplicado na tela; não poder guardar só significa
    // que vale nesta sessão.
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(() => guardarTema('escuro')).not.toThrow();
  });
});

describe('Alternar', () => {
  it('vai e volta', () => {
    expect(outroTema('claro')).toBe('escuro');
    expect(outroTema('escuro')).toBe('claro');
  });

  it('só reconhece os dois temas que existem', () => {
    expect(ehTema('claro')).toBe(true);
    expect(ehTema('escuro')).toBe(true);
    expect(ehTema('automatico')).toBe(false);
    expect(ehTema(null)).toBe(false);
  });
});
