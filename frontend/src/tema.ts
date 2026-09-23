// ============================================================
//  Tema claro e escuro
//
//  O claro é o padrão. O escuro é ESCOLHA da pessoa, feita no
//  botão do menu e lembrada pelo navegador.
//
//  Antes o sistema seguia a preferência do Windows: quem tinha o
//  computador no escuro recebia o sistema escuro sem ter pedido,
//  e sem ter como voltar.
// ============================================================

export type Tema = 'claro' | 'escuro';

export const TEMA_PADRAO: Tema = 'claro';

/** Onde a escolha fica guardada no navegador. */
export const CHAVE_TEMA = 'portoink:tema';

export function ehTema(valor: unknown): valor is Tema {
  return valor === 'claro' || valor === 'escuro';
}

/**
 * O tema guardado, ou o padrão.
 *
 * Ler do navegador pode falhar — janela anônima, armazenamento
 * bloqueado por política da empresa. Nesse caso o sistema abre no
 * claro em vez de quebrar.
 */
export function lerTema(): Tema {
  try {
    const guardado = window.localStorage.getItem(CHAVE_TEMA);
    return ehTema(guardado) ? guardado : TEMA_PADRAO;
  } catch {
    return TEMA_PADRAO;
  }
}

/**
 * Põe o tema na página.
 *
 * Só o escuro marca o atributo. O claro é a ausência de marca, que
 * é o que o CSS considera padrão — assim não há um estado a mais
 * para manter sincronizado.
 */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;

  if (tema === 'escuro') raiz.setAttribute('data-tema', 'escuro');
  else raiz.removeAttribute('data-tema');

  // A barra do navegador no celular acompanha: sem isso ela fica
  // clara em cima de um sistema escuro, e parece recorte.
  const cor = tema === 'escuro' ? '#07141f' : '#ffffff';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor);
}

/** Guarda a escolha. Falha em silêncio: o tema já foi aplicado. */
export function guardarTema(tema: Tema): void {
  try {
    window.localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    /* Janela anônima ou armazenamento bloqueado: vale só nesta sessão. */
  }
}

export function outroTema(tema: Tema): Tema {
  return tema === 'claro' ? 'escuro' : 'claro';
}
