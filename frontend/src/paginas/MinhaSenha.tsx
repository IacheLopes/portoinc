// ============================================================
//  Trocar a própria senha
//
//  Depois de trocar, todas as sessões caem — inclusive a atual.
//  Isso é proposital: se alguém tinha entrado com a senha antiga,
//  perde o acesso na hora. A tela avisa antes de acontecer.
// ============================================================

import { useState, type FormEvent } from 'react';
import { trocarSenha, ErroApi } from '../servicos/api';
import { useAutenticacao } from '../contexto/Autenticacao';
import { CabecalhoDePagina } from '../componentes/CabecalhoDePagina';
import { Cartao } from '../componentes/Cartao';

export function MinhaSenha() {
  const { usuario, sair } = useAutenticacao();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [pronto, setPronto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const diferentes = repetir.length > 0 && senhaNova !== repetir;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setDetalhes([]);

    if (senhaNova !== repetir) {
      setErro('As duas senhas novas não são iguais.');
      return;
    }

    setEnviando(true);

    try {
      await trocarSenha(senhaAtual, senhaNova);
      setPronto(true);
      // Dá tempo de ler a mensagem antes de voltar para o login.
      setTimeout(() => void sair(), 2500);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setDetalhes((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Não foi possível alterar a senha.');
      }
      setEnviando(false);
    }
  }

  if (pronto) {
    return (
      <section className="secao">
        <div className="aviso aviso--sucesso" role="status">
          <span className="aviso__icone" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>Senha alterada com sucesso.</strong>
            <p>Você será levado à tela de entrada para usar a nova senha.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="secao secao--estreita">
      <CabecalhoDePagina
          titulo="Trocar minha senha"
          descricao={
            <>
              Você está conectado como <strong>{usuario?.email}</strong>.
            </>
          }
        />

      <form onSubmit={enviar} noValidate>
        <Cartao className="formulario">
          <div className="campo">
            <label className="campo__rotulo" htmlFor="atual">
              Senha atual
            </label>
            <input
              id="atual"
              type="password"
              className="campo__entrada"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="nova">
              Nova senha
            </label>
            <input
              id="nova"
              type="password"
              className="campo__entrada"
              value={senhaNova}
              onChange={(e) => setSenhaNova(e.target.value)}
              autoComplete="new-password"
              aria-describedby="ajuda-senha"
              required
            />
            <p className="campo__ajuda" id="ajuda-senha">
              Pelo menos 8 caracteres, com letra e número. Senha longa protege mais
              do que senha curta cheia de símbolos.
            </p>
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="repetir">
              Repita a nova senha
            </label>
            <input
              id="repetir"
              type="password"
              className="campo__entrada"
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
              autoComplete="new-password"
              aria-invalid={diferentes}
              required
            />
            {diferentes && (
              <p className="campo__erro" role="alert">
                <span aria-hidden="true">⚠</span> As senhas não são iguais.
              </p>
            )}
          </div>

          <div className="aviso aviso--atencao">
            <span className="aviso__icone" aria-hidden="true">
              ⚠
            </span>
            <div>
              <strong>Ao trocar a senha, você sairá do sistema.</strong>
              <p>Será preciso entrar novamente com a senha nova.</p>
            </div>
          </div>

          {erro && (
            <div className="campo__erro" role="alert">
              <span aria-hidden="true">⚠</span> {erro}
              {detalhes.length > 0 && (
                <ul className="campo__erro-lista">
                  {detalhes.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="formulario__acoes">
            <button
              type="submit"
              className="botao botao--principal"
              disabled={enviando || !senhaAtual || !senhaNova || diferentes}
            >
              {enviando ? 'Alterando...' : 'Alterar senha'}
            </button>
          </div>
        </Cartao>
      </form>
    </section>
  );
}
