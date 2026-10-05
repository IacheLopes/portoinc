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
import { menuAgrupado, type Modulo } from '../navegacao';
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

  const menu = menuAgrupado((m) => m.permissoes.length === 0 || pode(...m.permissoes));

  function linkDoMenu(item: Modulo) {
    return (
      <NavLink
        to={item.para}
        end={item.para === '/'}
        className={({ isActive }) => 'menu__item' + (isActive ? ' menu__item--ativo' : '')}
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
          {menu.soltos.length > 0 && (
            <ul className="menu__lista">
              {menu.soltos.map((item) => (
                <li key={item.para}>{linkDoMenu(item)}</li>
              ))}
            </ul>
          )}

          {/* Um bloco por grupo. Grupo sem item nenhum não chega
              aqui: o rótulo sozinho seria pior que a lista solta. */}
          {menu.grupos.map((grupo) => (
            <div className="menu__grupo" key={grupo.nome}>
              <h2 className="menu__grupo-titulo" id={'grupo-' + grupo.nome}>
                {grupo.nome}
              </h2>

              <ul className="menu__lista" aria-labelledby={'grupo-' + grupo.nome}>
                {grupo.itens.map((item) => (
                  <li key={item.para}>{linkDoMenu(item)}</li>
                ))}
              </ul>
            </div>
          ))}

          <div className="menu__rodape">
            <BotaoTema />

            <NavLink to="/minha-senha" className="menu__item menu__item--secundario">
              <Icone nome="cadeado" className="menu__icone" />
              Trocar minha senha
            </NavLink>
            <p className="menu__versao">versão 0.44.2</p>
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
