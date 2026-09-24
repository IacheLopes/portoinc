import { useEffect, useState } from 'react';

// ============================================================
//  Esperar a pessoa parar de digitar
//
//  Filtro de lista suspensa aplica na hora: você escolhe um valor e
//  acabou. Campo de digitar é outra coisa — aplicar a cada tecla
//  faria uma busca por letra.
//
//  "cimento" são sete buscas, e seis delas são jogadas fora. Pior:
//  o sistema limita 200 requisições por minuto, e três pessoas
//  digitando ao mesmo tempo derrubariam a busca de todas.
//
//  Aqui o valor só "chega" depois que a digitação para.
// ============================================================

/**
 * Devolve `valor` com atraso: ele só muda quando ninguém mexe nele
 * por `ms` milissegundos.
 *
 * 400ms é o padrão porque é mais que a pausa entre duas teclas de
 * quem digita rápido (~150ms) e menos que o tempo em que a espera
 * começa a parecer travamento (~600ms).
 */
export function useEsperarDigitar<T>(valor: T, ms = 400): T {
  const [adiado, setAdiado] = useState(valor);

  useEffect(() => {
    const relogio = setTimeout(() => setAdiado(valor), ms);

    // Cada tecla nova cancela o relógio anterior: só a última vale.
    return () => clearTimeout(relogio);
  }, [valor, ms]);

  return adiado;
}
