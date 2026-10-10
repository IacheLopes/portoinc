// ============================================================
//  Moldura do sistema: cabeçalho + menu lateral
//
//  O menu mostra APENAS o que a pessoa pode fazer. O Gilson
//  (almoxarife) não vê "Administração"; a Neilma (compradora)
//  não vê "Aprovações".
//
//  Lembrete: esconder o item é conforto visual. Quem garante a
//  segurança é o servidor, que confere a permissão de novo.
// ============================================================

import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAutenticacao } from '../contexto/Autenticacao';
import { barraLateral, porteDaTela, type LinhaDaBarra } from '../navegacao';
import { BotaoTema } from './BotaoTema';
import { Icone } from './Icone';
import { plural } from '../servicos/texto';

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

export function Layout() {
  const { usuario, sair, pode } = useAutenticacao();
  const [menuAberto, setMenuAberto] = useState(false);
  const local = useLocation();

  const linhas = barraLateral((m) => m.permissoes.length === 0 || pode(...m.permissoes));

  // Em que porta a pessoa está, mesmo estando numa tela de dentro.
  const portaAberta = porteDaTela(local.pathname);

  function linkDoMenu(item: LinhaDaBarra) {
    return (
      <NavLink
        to={item.para}
        // `end` só no Início e nos DESTINOS.
        //
        // Sem isso, "Compras" ficaria marcado como ativo enquanto a
        // pessoa estivesse em /compras E em qualquer filha dele. Mas
        // as filhas têm endereço próprio (/solicitacoes, /pedidos),
        // então o destino só acende quando se está no índice.
        //
        // A exceção é o Financeiro, cujas filhas moram DENTRO dele
        // (/financeiro/contas): sem o `end`, a barra acenderia o
        // destino o tempo todo, e quem olha nao saberia se esta no
        // indice ou numa tela de dentro.
        end
        className={({ isActive }) =>
          'menu__item' +
          (isActive || (item.ehDestino && item.para === portaAberta)
            ? ' menu__item--ativo'
            : '')
        }
        onClick={() => setMenuAberto(false)}
      >
        <Icone nome={item.icone} className="menu__icone" />
        {item.rotulo}
      </NavLink>
    );
  }

  return (
    <div className="painel">
      <a className="pular-para-conteudo" href="#conteudo">
        Pular para o conteúdo
      </a>

      <header className="barra">
        <button
          type="button"
          className="barra__menu"
          onClick={() => setMenuAberto((v) => !v)}
          aria-expanded={menuAberto}
          aria-controls="menu-lateral"
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
        >
          ☰
        </button>

        <span className="barra__marca">
          Porto Inc<span className="barra__ponto">.</span>
        </span>

        <div className="barra__usuario">
          <span className="barra__avatar" aria-hidden="true">
            {iniciais(usuario?.nome ?? '?')}
          </span>
          <span className="barra__nome">
            {usuario?.nome}
            <small>{plural(usuario?.funcoes.length ?? 0, 'função', 'funções')}</small>
          </span>
          <button type="button" className="botao botao--discreto" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </header>

      <div className="painel__corpo">
        <nav
          id="menu-lateral"
          className={'menu' + (menuAberto ? ' menu--aberto' : '')}
          aria-label="Menu principal"
        >
          {/* UMA LISTA, SEM TÍTULOS.

              Eram quatro títulos com 14 itens embaixo: 18 linhas para
              quem administra. Agora são seis linhas — Início,
              Relatórios e os quatro destinos — e seguem seis quando
              o sistema crescer, porque tela nova vira cartão dentro
              de um índice.

              Os destinos levam um fio acima do primeiro, separando-os
              das duas telas soltas. É a única divisão que sobrou, e
              ela não precisa de palavra nenhuma.
          */}
          <ul className="menu__lista">
            {linhas.map((item) => (
              <li
                key={item.para}
                className={
                  (item.ehDestino ? 'menu__destino' : '') +
                  (item.primeiroDestino ? ' menu__destino--primeiro' : '')
                }
              >
                {linkDoMenu(item)}
              </li>
            ))}
          </ul>

          <div className="menu__rodape">
            <BotaoTema />

            <NavLink to="/minha-senha" className="menu__item menu__item--secundario">
              <Icone nome="cadeado" className="menu__icone" />
              Trocar minha senha
            </NavLink>
            <p className="menu__versao">versão 0.59.0</p>
          </div>
        </nav>

        {/* Fundo escuro que fecha o menu no celular */}
        {menuAberto && (
          <div className="menu__fundo" onClick={() => setMenuAberto(false)} aria-hidden="true" />
        )}

        <main id="conteudo" className="painel__conteudo" tabIndex={-1} key={local.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
