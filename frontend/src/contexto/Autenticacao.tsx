// ============================================================
//  Quem está usando o sistema
//
//  Guarda o usuário logado e deixa qualquer tela perguntar
//  "posso fazer isso?" sem precisar chamar a API de novo.
// ============================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as api from '../servicos/api';
import type { UsuarioLogado } from '../servicos/api';

interface ContextoAutenticacao {
  usuario: UsuarioLogado | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  /** Confere se o usuário tem pelo menos uma das permissões. */
  pode: (...codigos: string[]) => boolean;
  atualizarUsuario: (usuario: UsuarioLogado) => void;
}

const Contexto = createContext<ContextoAutenticacao | null>(null);

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Ao abrir o sistema, tenta reaproveitar a sessão do cookie.
  // É isso que evita pedir a senha a cada vez que a aba recarrega.
  useEffect(() => {
    let ativo = true;

    api
      .retomarSessao()
      .then((u) => {
        if (ativo) setUsuario(u);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    // Se a API avisar que a sessão morreu, limpamos a tela na hora.
    api.aoDeslogar(() => setUsuario(null));

    return () => {
      ativo = false;
    };
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const resultado = await api.entrar(email, senha);
    api.guardarToken(resultado.token);
    setUsuario(resultado.usuario);
  }, []);

  const sair = useCallback(async () => {
    try {
      await api.sair();
    } finally {
      api.guardarToken(null);
      setUsuario(null);
    }
  }, []);

  const pode = useCallback(
    (...codigos: string[]) => codigos.some((c) => usuario?.permissoes.includes(c)),
    [usuario],
  );

  const valor = useMemo(
    () => ({ usuario, carregando, entrar, sair, pode, atualizarUsuario: setUsuario }),
    [usuario, carregando, entrar, sair, pode],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAutenticacao(): ContextoAutenticacao {
  const contexto = useContext(Contexto);

  if (!contexto) {
    throw new Error('useAutenticacao precisa estar dentro de <ProvedorAutenticacao>');
  }

  return contexto;
}
