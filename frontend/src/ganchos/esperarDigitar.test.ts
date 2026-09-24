// ============================================================
//  A espera existe para proteger o servidor
//
//  Sem ela, digitar "cimento" no campo de procurar dispara SETE
//  buscas, e seis são jogadas fora. O sistema limita 200
//  requisições por minuto — três pessoas digitando ao mesmo tempo
//  derrubariam a busca de todas.
//
//  Por isso o teste conta CHAMADAS, e não só o valor final.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEsperarDigitar } from './esperarDigitar';

describe('Esperar a pessoa parar de digitar', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('o primeiro valor vale na hora', () => {
    const { result } = renderHook(() => useEsperarDigitar('cimento'));
    expect(result.current).toBe('cimento');
  });

  it('não muda enquanto a digitação continua', () => {
    const { result, rerender } = renderHook(({ v }) => useEsperarDigitar(v), {
      initialProps: { v: '' },
    });

    for (const parcial of ['c', 'ci', 'cim', 'cime']) {
      rerender({ v: parcial });
      act(() => { vi.advanceTimersByTime(100); });
    }

    // 400ms no total, mas nunca 400ms de silêncio.
    expect(result.current).toBe('');
  });

  it('entrega o ÚLTIMO valor depois da pausa', () => {
    const { result, rerender } = renderHook(({ v }) => useEsperarDigitar(v), {
      initialProps: { v: '' },
    });

    rerender({ v: 'c' });
    rerender({ v: 'ci' });
    rerender({ v: 'cimento' });

    act(() => { vi.advanceTimersByTime(400); });

    expect(result.current).toBe('cimento');
  });

  it('sete teclas dão UMA entrega, e não sete', () => {
    const entregas: string[] = [];

    const { rerender } = renderHook(
      ({ v }) => {
        const adiado = useEsperarDigitar(v);
        if (entregas.at(-1) !== adiado) entregas.push(adiado);
        return adiado;
      },
      { initialProps: { v: '' } },
    );

    for (const parcial of ['c', 'ci', 'cim', 'cime', 'cimen', 'ciment', 'cimento']) {
      rerender({ v: parcial });
      act(() => { vi.advanceTimersByTime(80); });
    }

    act(() => { vi.advanceTimersByTime(400); });

    // O '' da primeira renderização, e depois só 'cimento'.
    expect(entregas).toEqual(['', 'cimento']);
  });
});
