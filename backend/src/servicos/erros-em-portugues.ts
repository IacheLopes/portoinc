// ============================================================
//  As mensagens de validação, em português e para gente
//
//  O Zod fala inglês de programador por padrão: "Required",
//  "Expected number, received nan", "Invalid uuid". Essas frases
//  chegavam à tela do usuário exatamente assim.
//
//  Pior: metade das telas nem mostrava. A pessoa via só "Dados
//  inválidos" e ficava adivinhando qual campo era — foi o que
//  aconteceu ao registrar uma locação, em 2026-09-24.
//
//  Este mapa é o PISO: vale para todo esquema do sistema, mesmo os
//  que ninguém revisou. Onde o esquema diz a frase certa
//  ("Escolha o fornecedor."), a dele vence — este só entra quando
//  não há nada melhor.
// ============================================================

import { z } from 'zod';

export function ligarMensagensEmPortugues(): void {
  z.setErrorMap((issue, contexto) => {
    switch (issue.code) {
      case z.ZodIssueCode.invalid_type:
        if (issue.received === 'undefined' || issue.received === 'null') {
          return { message: 'Campo obrigatório.' };
        }
        if (issue.expected === 'number') {
          return { message: 'Informe um número.' };
        }
        if (issue.expected === 'string') {
          return { message: 'Informe um texto.' };
        }
        return { message: 'Valor inválido para este campo.' };

      case z.ZodIssueCode.invalid_enum_value:
        return { message: 'Escolha uma das opções da lista.' };

      case z.ZodIssueCode.invalid_string:
        if (issue.validation === 'uuid') return { message: 'Escolha uma opção da lista.' };
        if (issue.validation === 'email') return { message: 'Informe um e-mail válido.' };
        if (issue.validation === 'date') return { message: 'Informe uma data válida.' };
        return { message: 'Formato inválido.' };

      case z.ZodIssueCode.too_small:
        if (issue.type === 'string') {
          return issue.minimum === 1
            ? { message: 'Campo obrigatório.' }
            : { message: 'Precisa ter pelo menos ' + issue.minimum + ' caracteres.' };
        }
        if (issue.type === 'number') {
          return { message: 'Precisa ser maior que ' + issue.minimum + '.' };
        }
        if (issue.type === 'array') {
          return { message: 'Inclua pelo menos ' + issue.minimum + ' item.' };
        }
        return { message: 'Valor pequeno demais.' };

      case z.ZodIssueCode.too_big:
        if (issue.type === 'string') {
          return { message: 'Passou de ' + issue.maximum + ' caracteres.' };
        }
        if (issue.type === 'number') {
          return { message: 'Precisa ser menor que ' + issue.maximum + '.' };
        }
        return { message: 'Valor grande demais.' };

      case z.ZodIssueCode.unrecognized_keys:
        return { message: 'Campo desconhecido enviado.' };

      default:
        // Mantém o que o Zod já diria, para não esconder um caso
        // que ainda não foi traduzido.
        return { message: contexto.defaultError };
    }
  });
}
