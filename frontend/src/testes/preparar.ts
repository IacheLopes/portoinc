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
