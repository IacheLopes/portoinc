// ============================================================
//  Ponto de entrada do React
// ============================================================

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './estilos/global.css';
import './estilos/painel.css';
import './estilos/cadastros.css';
import './estilos/graficos.css';
import './estilos/relatorios.css';

const raiz = document.getElementById('raiz');

if (!raiz) {
  throw new Error('Elemento #raiz nao encontrado no index.html');
}

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
