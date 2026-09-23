// ============================================================
//  Tela de entrada
//
//  Cuidados de usabilidade aplicados aqui:
//   - o cursor já começa no campo de e-mail (eficiência)
//   - o erro aparece perto do botão, não no topo da página
//   - o botão mostra que está trabalhando e trava contra clique duplo
//   - o navegador pode salvar a senha (autocomplete correto)
//
//  padrao-ignora: sem-cabecalho — é a tela de entrada: não há sistema atrás dela para onde voltar.
// ============================================================

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAutenticacao } from '../contexto/Autenticacao';
import { ErroApi } from '../servicos/api';

export function Entrar() {
  const { entrar } = useAutenticacao();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const campoEmail = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campoEmail.current?.focus();
  }, []);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      await entrar(email, senha);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível entrar. Tente novamente.');
      setEnviando(false);
    }
  }

  return (
    <div className="entrada">
      <main className="entrada__cartao">
        <div className="entrada__marca">
          Porto Inc<span className="entrada__ponto">.</span>
        </div>

        <h1 className="entrada__titulo">Compras e Almoxarifado</h1>
        <p className="entrada__sub">Entre com seus dados para continuar</p>

        <form onSubmit={aoEnviar} noValidate>
          <div className="campo">
            <label className="campo__rotulo" htmlFor="email">
              E-mail
            </label>
            <input
              ref={campoEmail}
              id="email"
              name="email"
              type="email"
              className="campo__entrada"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              disabled={enviando}
            />
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="senha">
              Senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              className="campo__entrada"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
              disabled={enviando}
            />
          </div>

          {erro && (
            <p className="campo__erro" role="alert">
              <span aria-hidden="true">⚠</span> {erro}
            </p>
          )}

          <button
            type="submit"
            className="botao botao--principal botao--largo"
            disabled={enviando || !email || !senha}
          >
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="entrada__rodape">
          Esqueceu a senha? Fale com o administrador do sistema.
        </p>
      </main>
    </div>
  );
}
