// ============================================================
//  Criar a senha pelo link recebido
//
//  Tela PÚBLICA: quem chega aqui ainda não tem senha, então não
//  teria como se identificar antes. O que autoriza é o link.
//
//  POR QUE NÃO É A MESMA TELA DE "TROCAR MINHA SENHA"
//
//  Aquela pede a senha ATUAL — e aqui não existe senha atual:
//  é o ponto todo. Aquela roda dentro do sistema, com barra
//  lateral e sessão aberta; esta roda sozinha, na mesma moldura
//  da tela de entrada, para quem nunca entrou.
//
//  A tela confere o link ANTES de mostrar o formulário. Deixar a
//  pessoa escolher uma senha, digitar duas vezes e só então ouvir
//  "este link venceu" é fazer trabalho para jogar fora.
//
//  padrao-ignora: sem-cabecalho — quem chega aqui ainda não entrou
//  no sistema: não há migalha para mostrar nem tela para onde
//  voltar. Mesma dispensa da tela de entrada e do portal.
// ============================================================

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  abrirConvite,
  criarSenhaComConvite,
  type ConviteAberto,
  type RecusaDoConvite,
} from '../servicos/convite';
import { Icone } from '../componentes/Icone';
import { Carregando } from '../componentes/Estado';

export function CriarSenha() {
  const { token = '' } = useParams();

  const [convite, setConvite] = useState<ConviteAberto | null>(null);
  const [recusa, setRecusa] = useState<RecusaDoConvite | null>(null);
  const [conferindo, setConferindo] = useState(true);

  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  const diferentes = repetir.length > 0 && senha !== repetir;

  const conferir = useCallback(async () => {
    setConferindo(true);
    const r = await abrirConvite(token);
    if (r.ok) setConvite(r.convite);
    else setRecusa(r.recusa);
    setConferindo(false);
  }, [token]);

  useEffect(() => {
    void conferir();
  }, [conferir]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setDetalhes([]);

    if (senha !== repetir) {
      setErro('As duas senhas não são iguais.');
      return;
    }

    setEnviando(true);
    const r = await criarSenhaComConvite(token, senha);

    if (r.ok) {
      setPronto(true);
      return;
    }

    setErro(r.erro);
    setDetalhes(r.detalhes);
    setEnviando(false);
  }

  return (
    <div className="entrada">
      <main className="entrada__cartao">
        <div className="entrada__marca">
          Porto Inc<span className="entrada__ponto">.</span>
        </div>

        <h1 className="entrada__titulo">Crie a sua senha</h1>

        {conferindo && <Carregando mensagem="Conferindo o link..." />}

        {/* ---------- O link não serve ---------- */}
        {!conferindo && recusa && (
          <>
            <div className="aviso aviso--atencao" role="alert">
              <Icone nome="alerta" className="aviso__icone" />
              <div>
                <strong>Este link não abre uma senha nova.</strong>
                <p>{recusa.erro}</p>
              </div>
            </div>
            <p className="entrada__rodape">
              <Link to="/entrar">Ir para a tela de entrada</Link>
            </p>
          </>
        )}

        {/* ---------- Deu certo ---------- */}
        {pronto && (
          <>
            <div className="aviso aviso--sucesso" role="status">
              <Icone nome="certo" className="aviso__icone" />
              <div>
                <strong>Senha criada.</strong>
                <p>
                  Este link não funciona mais. Entre com <strong>{convite?.email}</strong> e
                  a senha que você acabou de escolher.
                </p>
              </div>
            </div>
            <p className="entrada__rodape">
              <Link to="/entrar">Entrar agora</Link>
            </p>
          </>
        )}

        {/* ---------- O formulário ---------- */}
        {!conferindo && convite && !pronto && (
          <>
            <p className="entrada__sub">
              Olá, <strong>{convite.nome}</strong>. Escolha a senha da conta{' '}
              <strong>{convite.email}</strong>. Ninguém mais vai saber qual é — nem
              quem criou a sua conta.
            </p>

            <form onSubmit={enviar} noValidate>
                <div className="campo">
                  <label className="campo__rotulo" htmlFor="nova">
                    Sua senha
                  </label>
                  <input
                    id="nova"
                    type="password"
                    className="campo__entrada"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
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
                    Repita a senha
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
                      <Icone nome="alerta" /> As senhas não são iguais.
                    </p>
                  )}
                </div>

                {erro && (
                  <div className="aviso aviso--erro" role="alert">
                    <Icone nome="alerta" className="aviso__icone" />
                    <div>
                      <strong>{erro}</strong>
                      {detalhes.length > 0 && (
                        <ul>
                          {detalhes.map((d) => (
                            <li key={d}>{d}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="botao botao--principal botao--largo"
                  disabled={enviando || diferentes || senha.length === 0}
                >
                  {enviando ? 'Criando...' : 'Criar minha senha'}
                </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
