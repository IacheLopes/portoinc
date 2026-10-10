// ============================================================
//  O convite de senha, do lado da tela
//
//  Estas duas chamadas são PÚBLICAS: quem as faz ainda não tem
//  senha, então não teria como se identificar antes.
// ============================================================

export interface ConviteAberto {
  nome: string;
  email: string;
}

export interface RecusaDoConvite {
  erro: string;
  motivo: 'inexistente' | 'usado' | 'vencido' | 'inativo';
}

/**
 * Monta o endereço que o administrador copia e manda.
 *
 * Sai da origem da própria janela, então funciona em localhost
 * hoje e no domínio da empresa amanhã, sem configurar nada.
 */
export function enderecoDoConvite(token: string): string {
  return window.location.origin + '/senha/' + token;
}

/** Confere o convite sem gastá-lo. */
export async function abrirConvite(
  token: string,
): Promise<{ ok: true; convite: ConviteAberto } | { ok: false; recusa: RecusaDoConvite }> {
  const r = await fetch('/api/convite/' + encodeURIComponent(token), {
    headers: { Accept: 'application/json' },
  });

  const corpo = await r.json().catch(() => null);

  if (r.ok && corpo) return { ok: true, convite: corpo as ConviteAberto };

  return {
    ok: false,
    recusa: (corpo as RecusaDoConvite) ?? {
      erro: 'Não foi possível conferir este link. Tente de novo em instantes.',
      motivo: 'inexistente',
    },
  };
}

/** Gasta o convite e grava a senha escolhida. */
export async function criarSenhaComConvite(
  token: string,
  senha: string,
): Promise<{ ok: true; email: string } | { ok: false; erro: string; detalhes: string[] }> {
  const r = await fetch('/api/convite/' + encodeURIComponent(token), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha }),
  });

  const corpo = (await r.json().catch(() => null)) as
    | { ok?: boolean; email?: string; erro?: string; detalhes?: unknown }
    | null;

  if (r.ok && corpo?.email) return { ok: true, email: corpo.email };

  const detalhes = Array.isArray(corpo?.detalhes)
    ? corpo.detalhes.map((d) => (typeof d === 'string' ? d : String((d as { mensagem?: string })?.mensagem ?? d)))
    : [];

  return {
    ok: false,
    erro: corpo?.erro ?? 'Não foi possível criar a senha. Tente de novo.',
    detalhes,
  };
}
