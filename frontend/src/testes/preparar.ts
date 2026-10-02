// ============================================================
//  Preparação dos testes de tela
//
//  Roda uma vez antes de cada arquivo de teste.
// ============================================================
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Desmonta o que ficou na tela entre um teste e outro. Sem isso o
// segundo teste encontra DOIS botões "Salvar" — o dele e o que
// sobrou do anterior — e falha por um motivo que não é o dele.
afterEach(() => {
  cleanup();
});

// ============================================================
//  Substituto mínimo do scrollIntoView
//
//  O jsdom não rola: ele não tem layout, então não tem para onde
//  rolar. Sem este substituto, trocar de página estoura com
//  "scrollIntoView is not a function" — e é justamente a rolagem
//  que confirma, para quem clicou, que a lista mudou.
//
//  O teste confere que a rolagem foi PEDIDA, com os argumentos
//  certos (instantânea, alinhada no topo). Se ela acontece de
//  fato, e se para no lugar certo embaixo do cabeçalho fixo, isso
//  é medido num navegador de verdade.
// ============================================================
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function rolar() {};
}

// ============================================================
//  Substituto mínimo do matchMedia
//
//  O jsdom também não tem `window.matchMedia`. Sem isto, QUALQUER
//  teste que desenhe a barra de páginas estoura — ela pergunta se
//  a tela é estreita para montar menos botões no celular.
//
//  Foi assim que apareceu: o teste do painel de Locação passou a
//  falhar com "Unable to find LOC-00002", que parecia problema da
//  tabela. A tabela estava certa; a tela inteira morria antes de
//  pintar, no primeiro `matchMedia` da barra.
//
//  Responde "não é estreita", que é a tela de computador — o
//  tamanho em que os testes pensam. O comportamento no celular é
//  conferido medindo num navegador de verdade, em 420px, que é
//  onde ele existe de fato.
// ============================================================
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (consulta: string) =>
    ({
      media: consulta,
      matches: false,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      // Os dois antigos, que algumas bibliotecas ainda chamam.
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// ============================================================
//  Substituto mínimo do <dialog>
//
//  O navegador de mentira do teste (jsdom) não implementa
//  `showModal()`. Sem isto, nenhum teste de modal roda.
//
//  ATENÇÃO AO QUE ISTO PROVA E AO QUE NÃO PROVA.
//
//  Prova: a lógica QUE EU ESCREVI — travar a rolagem, perguntar
//  antes de descartar, devolver o foco, avisar quem abriu.
//
//  NÃO prova: o que é trabalho do NAVEGADOR — foco preso dentro,
//  fundo escurecido, o que está atrás não receber clique. Isso é
//  conferido num navegador de verdade, com medição.
// ============================================================
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function abrir(this: HTMLDialogElement) {
    this.open = true;
  };

  HTMLDialogElement.prototype.close = function fechar(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };

  // O navegador dispara `cancel` no Esc. Aqui isso é imitado, para o
  // caminho do Esc poder ser exercitado.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    const aberto = document.querySelector('dialog[open]');
    if (aberto) aberto.dispatchEvent(new Event('cancel', { cancelable: true }));
  });
}
